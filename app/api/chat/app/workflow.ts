import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
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

// Define workflow state
type AgentWorkflowState = {
  expectedToolCount: number;
  messages: ChatMessage[];
  toolResponses: Array<{
    toolCallId: string;
    result: string;
    isError: boolean;
  }>;
  textPartId: string;
};

// Define workflow events
export type StartEventData = {
  userInput: MessageContent;
  chatHistory: ChatMessage[];
};

export const startEvent = workflowEvent<StartEventData>();
export const stopEvent = workflowEvent<void>();

// Internal events for tool call flow
const toolCallEvent = workflowEvent<{
  toolCall: ToolCall;
}>();

const toolResponseEvent = workflowEvent<{
  toolCallId: string;
  result: string;
  isError: boolean;
}>();

const continueEvent = workflowEvent<void>();

export const workflowFactory = async () => {
  const index = await getIndex();

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information about letter standards`,
    },
    includeSourceNodes: true,
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

    // Call LLM with tools - use streaming
    const stream = await Settings.llm.chat({
      messages,
      tools: [queryEngineTool],
      stream: true,
    });

    let response = "";
    const toolCalls: Map<string, ToolCall> = new Map();

    sendEvent(
      textStartEvent.with({
        id: textPartId,
        type: "text-start",
      }),
    );

    // Process stream - collect chunks and check for tool calls
    for await (const chunk of stream) {
      response += chunk.delta;

      sendEvent(
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

    // Add assistant message to state
    const message: ChatMessage = {
      role: "assistant" as const,
      content: response,
    };

    // Handle tool calls
    if (toolCalls.size > 0) {
      message.options = {
        toolCall: Array.from(toolCalls.values()).map((toolCall) => ({
          name: toolCall.name,
          input: toolCall.input,
          id: toolCall.id,
        })),
      };

      state.messages.push(message);
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
      state.messages.push(message);

      // Send text end event
      sendEvent(
        textEndEvent.with({
          id: textPartId,
          type: "text-end",
        }),
      );

      // Generate next question suggestions if enabled
      const enableSuggestion = process.env.SUGGEST_NEXT_QUESTIONS === "true";
      if (enableSuggestion) {
        const nextQuestions = await generateNextQuestions(state.messages);
        sendEvent(
          suggestionEvent.with({
            type: SUGGESTION_PART_TYPE,
            data: nextQuestions,
          }),
        );
      }

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
        id: toolCall.id,
        type: "data-event",
        data: {
          title: `Agent Tool Call: ${toolCall.name}`,
          description: `Using tool: '${toolCall.name}' with inputs: '${JSON.stringify(toolCall.input)}'`,
          status: "pending",
        },
      }),
    );

    try {
      let toolOutput: any;

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
      sendEvent(
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
        sendEvent(toSourceEvent(sourceNodes));
      }

      // Send tool response
      const toolResultText =
        typeof toolOutput === "string"
          ? toolOutput
          : JSON.stringify(toolOutput);

      sendEvent(
        toolResponseEvent.with({
          toolCallId: toolCall.id,
          result: toolResultText,
          isError: false,
        }),
      );
    } catch (error) {
      // Emit runEvent (error)
      sendEvent(
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

      // Send error response
      sendEvent(
        toolResponseEvent.with({
          toolCallId: toolCall.id,
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

      // Add tool result messages for each response
      for (const toolResponse of state.toolResponses) {
        state.messages.push({
          role: "user",
          content: toolResponse.result,
          options: {
            toolResult: {
              id: toolResponse.toolCallId,
              result: toolResponse.result,
              isError: false,
            },
          },
        } as ChatMessage);
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
