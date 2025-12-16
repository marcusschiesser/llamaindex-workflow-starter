import { Settings } from "@vectorstores/core";
import { OpenAI } from "openai";

export function initSettings() {
  const openai = new OpenAI();
  Settings.embedFunc = async (input: string[]): Promise<number[][]> => {
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input,
    });
    return data.map((d) => d.embedding);
  };
}
