import { Settings } from "@vectorstores/core";
import { Settings as LlamaSettings } from "llamaindex";
import { OpenAI as LlamaOpenAI } from "@llamaindex/openai";
import { OpenAI } from "openai";

export function initSettings() {
  LlamaSettings.llm = new LlamaOpenAI({
    model: process.env.MODEL ?? "gpt-4o-mini",
    maxTokens: process.env.LLM_MAX_TOKENS
      ? Number(process.env.LLM_MAX_TOKENS)
      : undefined,
  });
  const openai = new OpenAI();
  Settings.embedFunc = async (input: string[]): Promise<number[][]> => {
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input,
    });
    return data.map((d) => d.embedding);
  };
}
