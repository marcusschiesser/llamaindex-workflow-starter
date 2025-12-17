import { openai } from "@ai-sdk/openai";
import { Settings } from "@vectorstores/core";
import { embedMany } from "ai";

export const llm = openai("gpt-5-mini");

export function initSettings() {
  Settings.embedFunc = async (input: string[]): Promise<number[][]> => {
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: input,
    });
    return embeddings;
  };
}
