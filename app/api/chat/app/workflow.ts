import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import type { Metadata, NodeWithScore } from "@vectorstores/core";
import { formatLLM } from "@vectorstores/core";
import { streamText, tool, type ModelMessage, type ToolCallPart } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  generateNextQuestions,
  runEvent,
  SUGGESTION_PART_TYPE,
  suggestionEvent,
  textDeltaEvent,
  textEndEvent,
  textStartEvent,
} from "../utils/parts";
import { toSourceEvent } from "../utils/parts/sources";
import { getIndex } from "./data";
import { llm } from "./settings";

// Define workflow state
type AgentWorkflowState = {
  expectedToolCount: number;
  messages: ModelMessage[];
  toolResponses: Array<{
    toolCallId: string;
    result: string;
    isError: boolean;
  }>;
  textPartId: string;
};

// Define workflow events
export type StartEventData = {
  userInput: string;
  chatHistory: ModelMessage[];
};

export const startEvent = workflowEvent<StartEventData>();
export const stopEvent = workflowEvent<void>();

// Internal events for tool call flow
const toolCallEvent = workflowEvent<{
  toolCall: ToolCallPart;
}>();

const toolResponseEvent = workflowEvent<{
  toolCallId: string;
  result: string;
  isError: boolean;
}>();

const continueEvent = workflowEvent<void>();

export const workflowFactory = async () => {
  const index = await getIndex();
  const retriever = index.asRetriever();

  // Define tool parameters type
  type QueryDocumentParams = { query: string };
  type QueryDocumentResult = {
    sourceNodes: NodeWithScore<Metadata>[];
    response: string;
  };

  // Execute function for the query document tool
  async function executeQueryDocument(
    params: QueryDocumentParams,
  ): Promise<QueryDocumentResult> {
    const nodes = await retriever.retrieve({ query: params.query });
    return { sourceNodes: nodes, response: formatLLM(nodes) };
  }

  // Define tool for querying documents
  const queryDocumentTool = tool({
    description: `This tool can retrieve information about letter standards`,
    inputSchema: z.object({
      query: z
        .string()
        .describe("The query to retrieve information about letter standards"),
    }),
  });

  // Create stateful middleware
  const stateful = createStatefulMiddleware(
    (state: AgentWorkflowState) => state,
  );
  const workflow = stateful.withState(createWorkflow());

  // Handler for processing user input and LLM responses
  workflow.handle([startEvent], async (context, event) => {
    const { sendEvent, state } = context;
    const { userInput, chatHistory } = event.data;

    // Initialize state
    state.messages = [...chatHistory];
    state.messages.push({
      role: "user",
      content: userInput,
    });
    state.toolResponses = [];
    state.expectedToolCount = 0;
    state.textPartId = randomUUID();

    // Trigger the continue event to start processing
    sendEvent(continueEvent.with(undefined));
  });

  // Handler for continue event - calls LLM and processes response
  workflow.handle([continueEvent], async (context) => {
    const { sendEvent, state } = context;
    const { messages, textPartId } = state;

    // Call LLM with tools - use streaming via Vercel AI SDK
    const result = streamText({
      model: llm,
      messages,
      tools: { query_document: queryDocumentTool },
    });

    let response = "";
    const toolCalls: Map<string, ToolCallPart> = new Map();

    sendEvent(
      textStartEvent.with({
        id: textPartId,
        type: "text-start",
      }),
    );

    // Process stream using Vercel AI's fullStream
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") {
        response += chunk.text;
        sendEvent(
          textDeltaEvent.with({
            id: textPartId,
            type: "text-delta",
            delta: chunk.text,
          }),
        );
      } else if (chunk.type === "tool-call") {
        toolCalls.set(chunk.toolCallId, chunk);
      }
    }

    // Handle tool calls
    if (toolCalls.size > 0) {
      // Add assistant message with tool calls to state
      state.messages.push({
        role: "assistant",
        content: [
          ...(response ? [{ type: "text" as const, text: response }] : []),
          ...Array.from(toolCalls.values()),
        ],
      } satisfies ModelMessage);

      state.expectedToolCount = toolCalls.size;
      state.toolResponses = [];

      // Send tool call events for each requested tool
      for (const toolCall of toolCalls.values()) {
        sendEvent(
          toolCallEvent.with({
            toolCall,
          }),
        );
      }
    } else {
      // Add assistant message to state
      state.messages.push({
        role: "assistant" as const,
        content: response,
      });

      // Send text end event
      sendEvent(
        textEndEvent.with({
          id: textPartId,
          type: "text-end",
        }),
      );

      // Generate next question suggestions
      const nextQuestions = await generateNextQuestions(state.messages);
      sendEvent(
        suggestionEvent.with({
          type: SUGGESTION_PART_TYPE,
          data: nextQuestions,
        }),
      );

      // No tools requested, send stop event
      sendEvent(stopEvent.with(undefined));
    }
  });

  // Handler for executing tool calls
  workflow.handle([toolCallEvent], async (context, event) => {
    const { sendEvent } = context;
    const { toolCall } = event.data;

    // Emit runEvent (pending)
    sendEvent(
      runEvent.with({
        id: toolCall.toolCallId,
        type: "data-event",
        data: {
          title: `Agent Tool Call: ${toolCall.toolName}`,
          description: `Using tool: '${toolCall.toolName}' with inputs: '${JSON.stringify(toolCall.input)}'`,
          status: "pending",
        },
      }),
    );

    try {
      let toolOutput: QueryDocumentResult | undefined;

      if (toolCall.toolName === "query_document") {
        // Extract query from toolCall.input and execute the tool
        const input = toolCall.input as QueryDocumentParams;
        toolOutput = await executeQueryDocument(input);
      } else {
        throw new Error(`Unknown tool: ${toolCall.toolName}`);
      }

      // Emit runEvent (success)
      sendEvent(
        runEvent.with({
          id: toolCall.toolCallId,
          type: "data-event",
          data: {
            title: `Agent Tool Call: ${toolCall.toolName}`,
            description: `Using tool: '${toolCall.toolName}' with inputs: '${JSON.stringify(toolCall.input)}'`,
            status: "success",
            data: toolOutput,
          },
        }),
      );

      // Extract source nodes and emit sourceEvent
      if (toolOutput) {
        sendEvent(toSourceEvent(toolOutput.sourceNodes));
        // Send tool response
        const toolResultText = JSON.stringify(toolOutput);

        sendEvent(
          toolResponseEvent.with({
            toolCallId: toolCall.toolCallId,
            result: toolResultText,
            isError: false,
          }),
        );
      }
    } catch (error) {
      // Emit runEvent (error)
      sendEvent(
        runEvent.with({
          id: toolCall.toolCallId,
          type: "data-event",
          data: {
            title: `Agent Tool Call: ${toolCall.toolName}`,
            description: `Error: ${(error as Error).message}`,
            status: "error",
          },
        }),
      );

      // Send error response
      sendEvent(
        toolResponseEvent.with({
          toolCallId: toolCall.toolCallId,
          result: `Error: ${(error as Error).message}`,
          isError: true,
        }),
      );
    }
  });

  // Handler for aggregating tool call responses
  workflow.handle([toolResponseEvent], async (context, event) => {
    const { sendEvent, state } = context;
    const { toolCallId, result, isError } = event.data;

    // Collect tool response
    state.toolResponses.push({ toolCallId, result, isError });

    // Once we have all responses, continue the conversation
    if (state.toolResponses.length === state.expectedToolCount) {
      // Check if any tool had an error
      const hasError = state.toolResponses.some((r) => r.isError);
      if (hasError) {
        sendEvent(stopEvent.with(undefined));
        return;
      }

      // Add tool result messages using Vercel AI's format
      for (const toolResponse of state.toolResponses) {
        state.messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: toolResponse.toolCallId,
              toolName: "query_document",
              output: {
                type: "json",
                value: JSON.parse(toolResponse.result),
              },
            },
          ],
        });
      }

      // Continue the loop with the updated conversation
      sendEvent(continueEvent.with(undefined));
    }
  });

  return workflow.createContext({
    expectedToolCount: 0,
    messages: [],
    toolResponses: [],
    textPartId: "",
  });
};
