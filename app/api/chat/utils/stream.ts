import { type WorkflowEventData } from "@llamaindex/workflow-core";
import {
  TEXT_DELTA_PART_TYPE,
  TEXT_END_PART_TYPE,
  TEXT_START_PART_TYPE,
} from "./parts";

/**
 * Responsible for handling specific LlamaIndexServer events in the workflow stream
 */
export class ServerAdapter {
  static readonly encoder = new TextEncoder();

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
