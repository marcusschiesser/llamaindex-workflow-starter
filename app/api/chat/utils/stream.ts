import type { WorkflowEventData } from "@llamaindex/workflow-core";
import { isVercelTextEvent } from "./parts";

const encoder = new TextEncoder();

/**
 * Transform LlamaIndexServer events to Server-Sent Events (SSE)
 * This is useful when we want to send events to client in SSE format to work with Vercel v5
 */
export function transformToVercel() {
  return new TransformStream<WorkflowEventData<unknown>>({
    async transform(event, controller) {
      const { data } = event;
      if (isVercelTextEvent(data) || isDataPart(data)) {
        controller.enqueue(toSSE(data));
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
function isDataPart(data: unknown): boolean {
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  ) {
    const { type } = data as { type: string };
    if (type.startsWith("data-") && "data" in data) {
      return true;
    }
  }
  return false;
}

function toSSE<T>(data: T) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}
