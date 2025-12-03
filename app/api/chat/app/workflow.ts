import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import type { MessageContent, Metadata, NodeWithScore } from "llamaindex";
import { Settings, type ChatMessage, type ToolCall } from "llamaindex";
import { randomUUID } from "node:crypto";
import {
  runEvent,
  SUGGESTION_PART_TYPE,
  suggestionEvent,
  textDeltaEvent,
  textEndEvent,
  textStartEvent,
} from "../utils/parts";
import { toSourceEvent } from "../utils/parts/sources";
import { generateNextQuestions } from "../utils/parts/suggestion";
import { getToolCallFromResponseChunk } from "../utils/workflow";
import { getIndex } from "./data";

// Define workflow events
export type StartEventData = {
  userInput: MessageContent;
  chatHistory: ChatMessage[];
};

export const startEvent = workflowEvent<StartEventData>();
export const stopEvent = workflowEvent<void>();

export const workflowFactory = async () => {
  const index = await getIndex();

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information about letter standards`,
    },
    includeSourceNodes: true,
  });

  const workflow = createWorkflow();

  workflow.handle([startEvent], async (context, event) => {
    const { userInput, chatHistory } = event.data;
    const messages: ChatMessage[] = [...chatHistory];

    // Add user message
    messages.push({
      role: "user",
      content: userInput,
    });

    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    const textPartId = randomUUID();

    while (iteration < maxIterations) {
      iteration++;

      // Call LLM with tools - use streaming
      const stream = await Settings.llm.chat({
        messages,
        tools: [queryEngineTool],
        stream: true,
      });

      let response = "";
      const toolCalls: Map<string, ToolCall> = new Map();

      context.sendEvent(
        textStartEvent.with({
          id: textPartId,
          type: "text-start",
        }),
      );

      // Process stream - collect chunks and check for tool calls
      for await (const chunk of stream) {
        response += chunk.delta;

        context.sendEvent(
          textDeltaEvent.with({
            id: textPartId,
            type: "text-delta",
            delta: chunk.delta,
          }),
        );

        // Extract tool calls from chunk
        const toolCallsInChunk = getToolCallFromResponseChunk(chunk);
        if (toolCallsInChunk.length > 0) {
          // Just upsert the tool calls with the latest one if they exist
          toolCallsInChunk.forEach((toolCall) => {
            toolCalls.set(toolCall.id, toolCall);
          });
        }
      }

      const message: ChatMessage = {
        role: "assistant" as const,
        content: response,
      };
      messages.push(message);

      // Handle tool calls
      if (toolCalls.size > 0) {
        const toolCall = toolCalls.values().next().value;
        if (!toolCall) {
          continue;
        }

        message.options = {
          toolCall: Array.from(toolCalls.values()).map((toolCall) => ({
            name: toolCall.name,
            input: toolCall.input,
            id: toolCall.id,
          })),
        };

        // Emit runEvent (pending)
        context.sendEvent(
          runEvent.with({
            id: toolCall.id,
            type: "data-event",
            data: {
              title: `Agent Tool Call: ${toolCall.name}`,
              description: `Using tool: '${toolCall.name}' with inputs: '${JSON.stringify(toolCall.input)}'`,
              status: "pending",
            },
          }),
        );

        // Execute tool
        let toolOutput: any;
        try {
          if (toolCall.name === "query_document") {
            // Extract query from toolCall.input (which is JSONObject)
            const query =
              (toolCall.input as any).query ||
              (toolCall.input as any).rawInput ||
              JSON.stringify(toolCall.input);
            toolOutput = await queryEngineTool.call({
              query: typeof query === "string" ? query : JSON.stringify(query),
            });
          } else {
            throw new Error(`Unknown tool: ${toolCall.name}`);
          }

          // Emit runEvent (success)
          context.sendEvent(
            runEvent.with({
              id: toolCall.id,
              type: "data-event",
              data: {
                title: `Agent Tool Call: ${toolCall.name}`,
                description: `Using tool: '${toolCall.name}' with inputs: '${JSON.stringify(toolCall.input)}'`,
                status: "success",
                data: toolOutput,
              },
            }),
          );

          // Extract source nodes and emit sourceEvent
          if (
            toolOutput != null &&
            typeof toolOutput === "object" &&
            "sourceNodes" in toolOutput &&
            Array.isArray(toolOutput.sourceNodes)
          ) {
            const sourceNodes =
              toolOutput.sourceNodes as unknown as NodeWithScore<Metadata>[];
            context.sendEvent(toSourceEvent(sourceNodes));
          }

          context.sendEvent(
            textEndEvent.with({
              id: textPartId,
              type: "text-end",
            }),
          );

          // Add tool result as user message for next iteration
          const toolResultText =
            typeof toolOutput === "string"
              ? toolOutput
              : JSON.stringify(toolOutput);
          messages.push({
            role: "user",
            content: toolResultText,
            options: {
              toolResult: {
                id: toolCall.id,
                result: toolResultText,
                isError: false,
              },
            },
          } as ChatMessage);

          // Continue loop to get final response
          continue;
        } catch (error) {
          // Emit runEvent (error)
          context.sendEvent(
            runEvent.with({
              id: toolCall.id,
              type: "data-event",
              data: {
                title: `Agent Tool Call: ${toolCall.name}`,
                description: `Error: ${(error as Error).message}`,
                status: "error",
              },
            }),
          );
          context.sendEvent(stopEvent.with(undefined));
          return;
        }
      }

      // Generate next question suggestions if enabled
      const enableSuggestion = process.env.SUGGEST_NEXT_QUESTIONS === "true";
      if (enableSuggestion) {
        const nextQuestions = await generateNextQuestions(messages);
        context.sendEvent(
          suggestionEvent.with({
            type: SUGGESTION_PART_TYPE,
            data: nextQuestions,
          }),
        );
      }

      // Done - emit stopEvent
      context.sendEvent(stopEvent.with(undefined));
      break;
    }

    if (iteration >= maxIterations) {
      context.sendEvent(stopEvent.with(undefined));
    }
  });

  return workflow;
};
