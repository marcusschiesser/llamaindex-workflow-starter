import { workflowEvent } from "@llamaindex/workflow-core";
import type { ModelMessage, TextPart } from "ai";

export const TEXT_START_PART_TYPE = "text-start";
export const TEXT_DELTA_PART_TYPE = "text-delta";
export const TEXT_END_PART_TYPE = "text-end";

export type TextStartPart = {
  type: typeof TEXT_START_PART_TYPE;
  id: string;
};

export type TextDeltaPart = {
  type: typeof TEXT_DELTA_PART_TYPE;
  id: string;
  delta: string;
};

export type TextEndPart = {
  type: typeof TEXT_END_PART_TYPE;
  id: string;
};

export const textStartEvent = workflowEvent<TextStartPart>(); // this event must be triggered before streaming text
export const textDeltaEvent = workflowEvent<TextDeltaPart>(); // equal to agentStreamEvent but using TextDeltaPart format
export const textEndEvent = workflowEvent<TextEndPart>(); // this event must be triggered after streaming text

/**
 * Extract the text content from Vercel AI ModelMessage content
 * @param content - The ModelMessage content (string or array of parts)
 * @returns The text content of the message
 */
export function getModelMessageTextContent(
  content: ModelMessage["content"],
): string {
  if (typeof content === "string") {
    return content;
  }
  // Handle array content - filter for text parts
  return content
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}
