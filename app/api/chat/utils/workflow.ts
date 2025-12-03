import type { ChatResponseChunk, JSONObject, ToolCall } from "llamaindex";

/**
 * Extract tool calls from a ChatResponseChunk
 * Tool calls are found in chunk.options.toolCall
 */
export function getToolCallFromResponseChunk(
  responseChunk: ChatResponseChunk,
): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const options = responseChunk.options ?? {};

  if (options && "toolCall" in options && Array.isArray(options.toolCall)) {
    toolCalls.push(
      ...options.toolCall.map((call) => {
        // Convert input to arguments format
        let toolKwargs: JSONObject;

        if (typeof call.input === "string") {
          try {
            toolKwargs = JSON.parse(call.input);
          } catch (e) {
            toolKwargs = { rawInput: call.input };
          }
        } else {
          toolKwargs = call.input as JSONObject;
        }

        return {
          name: call.name,
          input: toolKwargs,
          id: call.id,
        };
      }),
    );
  }

  return toolCalls;
}
