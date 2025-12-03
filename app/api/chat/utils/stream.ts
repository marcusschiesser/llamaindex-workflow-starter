import { type WorkflowEventData } from "@llamaindex/workflow-core";
import type { ChatMessage, MessageContentTextDetail } from "llamaindex";
import {
  SUGGESTION_PART_TYPE,
  suggestionEvent,
  TEXT_DELTA_PART_TYPE,
  TEXT_END_PART_TYPE,
  TEXT_START_PART_TYPE,
  textDeltaEvent,
} from "./parts";
import { generateNextQuestions } from "./parts/suggestion";

/**
 * Responsible for handling specific LlamaIndexServer events in the workflow stream
 */
export class ServerAdapter {
  static readonly encoder = new TextEncoder();

  /**
   * Accumulate text parts from stream and do post processing such as suggest next questions
   */
  static postActions(options?: {
    chatHistory?: ChatMessage[];
    enableSuggestion?: boolean;
  }) {
    const { enableSuggestion, chatHistory } = options ?? {};

    // get the text parts from stream
    const accumulatedTextParts: Record<string, MessageContentTextDetail> = {};

    return new TransformStream({
      async transform(event, controller) {
        if (textDeltaEvent.include(event)) {
          const textPart = accumulatedTextParts[event.data.id];
          if (textPart) {
            // if text part already exists, append the delta to the text
            textPart.text += event.data.delta;
          } else {
            // if text part does not exist, add a new text part
            accumulatedTextParts[event.data.id] = {
              type: "text",
              text: event.data.delta,
            };
          }
        }
        controller.enqueue(event);
      },
      async flush(controller) {
        if (Object.keys(accumulatedTextParts).length === 0) return;

        const newMessage: ChatMessage = {
          role: "assistant",
          content: Object.values(accumulatedTextParts),
        };
        const conversation: ChatMessage[] = [
          ...(chatHistory ?? []),
          newMessage,
        ];

        if (enableSuggestion) {
          const nextQuestions = await generateNextQuestions(conversation);
          controller.enqueue(
            suggestionEvent.with({
              type: SUGGESTION_PART_TYPE,
              data: nextQuestions,
            }),
          );
        }
      },
    });
  }

  /**
   * Transform LlamaIndexServer events to Server-Sent Events (SSE)
   * This is useful when we want to send events to client in SSE format to work with Vercel v5
   */
  static transformToSSE() {
    return new TransformStream<WorkflowEventData<unknown>>({
      async transform(event, controller) {
        if (ServerAdapter.isValidUIEvent(event)) {
          controller.enqueue(ServerAdapter.toSSE(event.data));
        }
      },
    });
  }

  /**
   * useChat will stop stream immediately if it's not valid (only support text parts or data-* parts)
   * Therefore, we need to filter out the events that are not valid with Vercel AI SDK contract
   * See how Vercel AI SDK useChat validate the parts here:
   * https://github.com/vercel/ai/blob/d583b8487450f0c0f12508cc2a8309c676653357/packages/ai/src/ui/process-ui-message-stream.ts#L630-L636
   */
  private static isValidUIEvent(event: WorkflowEventData<unknown>) {
    if (
      typeof event.data === "object" &&
      event.data !== null &&
      "type" in event.data &&
      typeof event.data.type === "string"
    ) {
      const { type } = event.data;

      if (
        [
          TEXT_DELTA_PART_TYPE,
          TEXT_START_PART_TYPE,
          TEXT_END_PART_TYPE,
        ].includes(type)
      ) {
        return true;
      }

      if (type.startsWith("data-") && "data" in event.data) {
        return true;
      }
    }

    return false;
  }

  private static toSSE<T>(data: T) {
    return ServerAdapter.encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }
}
