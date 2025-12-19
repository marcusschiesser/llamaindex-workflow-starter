import { workflowEvent } from "@llamaindex/workflow-core";
import type { ModelMessage, TextPart } from "ai";

export const TEXT_START_PART_TYPE = "text-start";
export const TEXT_DELTA_PART_TYPE = "text-delta";
export const TEXT_END_PART_TYPE = "text-end";

type TextStartPart = {
  type: typeof TEXT_START_PART_TYPE;
  id: string;
};

type TextDeltaPart = {
  type: typeof TEXT_DELTA_PART_TYPE;
  id: string;
  delta: string;
};

type TextEndPart = {
  type: typeof TEXT_END_PART_TYPE;
  id: string;
};

export type VercelTextPart = TextStartPart | TextDeltaPart | TextEndPart;

export const vercelTextEvent = workflowEvent<VercelTextPart>();

/**
 * Check if the data is a Vercel text event part
 * @param data - The data to check
 * @returns True if the data is a Vercel text event part
 */
export function isVercelTextEvent(data: unknown): data is VercelTextPart {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    [TEXT_START_PART_TYPE, TEXT_DELTA_PART_TYPE, TEXT_END_PART_TYPE].includes(
      (data as { type: string }).type,
    )
  );
}

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
