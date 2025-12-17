# LlamaIndex Workflow Chat Starter

A Next.js starter template for running [LlamaIndex Workflows](https://developers.llamaindex.ai/typescript/workflows/) with a modern chat interface powered by [LlamaIndex Chat UI](https://ui.llamaindex.ai/).

## Overview

This project is a hackable Next.js starter template that demonstrates how to:

- Build an **Agentic RAG** (Retrieval-Augmented Generation) workflow using [vectorstores.org](https://vectorstores.org/), [LlamaIndex Workflows](https://developers.llamaindex.ai/typescript/workflows/) and [Vercel AI SDK](https://ai-sdk.dev/docs)
- Stream workflow events to a React frontend using the [Vercel AI SDK data part format](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-parts)
- Render rich, interactive chat messages with sources, artifacts, and suggestions

## Getting Started

### Prerequisites

- Node.js 20+
- An OpenAI API key (or another LLM provider)

### Installation

```bash
npm install
```

### Environment Variables

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your-openai-api-key
```

### Generating Embeddings

Before running the development server, you need to generate embeddings for the PDF documents in the `data` directory:

```bash
npm run generate
```

This command processes all documents in the `data` folder, creates embeddings, and stores them in the `storage` directory. The embeddings are required for the RAG workflow to function properly.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

### Workflow Definition

The LlamaIndex workflow is defined in [`app/api/chat/app/workflow.ts`](app/api/chat/app/workflow.ts).

This creates a agentic RAG workflow with a document query tool. Customize this file to:

- Add more tools
- Implement custom workflow logic
- Configure different retrieval strategies

### Event Streaming & Adapters

The API route [`app/api/chat/route.ts`](app/api/chat/route.ts) handles the conversion of workflow events to the [data part format](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-parts) used by Vercel AI SDK:

```typescript
const stream = workflowStream.pipeThrough(ServerAdapter.transformToSSE());
```

The adapters transform LlamaIndex workflow events into streamable data parts that the frontend can render.
For example, the `sourceEvent` from [`app/api/chat/utils/parts/sources.ts`](app/api/chat/utils/parts/sources.ts) is transformed to a [`data-sources` part](https://github.com/run-llama/chat-ui/blob/main/docs/chat-ui/parts.mdx#source-parts-data-sources).

### Chat UI Components

Message parts are rendered in [`app/components/ui/chat/chat-message-content.tsx`](app/components/ui/chat/chat-message-content.tsx):

```tsx
import { ChatMessage } from "@llamaindex/chat-ui";

export function ChatMessageContent() {
  return (
    <ChatMessage.Content>
      <ChatMessage.Part.Event />
      <ChatMessage.Part.File />
      <ChatMessage.Part.Markdown />
      <ChatMessage.Part.Artifact />
      <ChatMessage.Part.Source />
      <ChatMessage.Part.Suggestion />
    </ChatMessage.Content>
  );
}
```

E.g. the `data-sources` part from the last section is rendered by the `ChatMessage.Part.Source` component.

Each part component renders a specific type of content:

- **Event** – Shows workflow progress and tool execution status
- **File** – Displays uploaded files
- **Markdown** – Renders formatted text responses
- **Artifact** – Interactive code blocks and documents
- **Source** – Retrieved document sources with citations
- **Suggestion** – Follow-up question suggestions

Learn more about message parts and how to render custom parts in the [Chat UI documentation](https://github.com/run-llama/chat-ui/blob/main/docs/chat-ui/parts.mdx).

### Model Configuration

Configure LLM and embedding models in [`app/api/chat/app/settings.ts`](app/api/chat/app/settings.ts):

```typescript
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
```

Swap out OpenAI for other providers by modifying `settings.ts`:

```typescript
import { anthropic } from "@ai-sdk/anthropic";

export const llm = anthropic("claude-sonnet-4-20250514");
```

## Learn More

- [LlamaIndex Workflows Documentation](https://developers.llamaindex.ai/typescript/workflows/)
- [LlamaIndex Chat UI](https://ui.llamaindex.ai/)
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
