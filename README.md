# LlamaIndex Workflow Chat Starter

A Next.js starter template for running [LlamaIndex Workflows](https://developers.llamaindex.ai/typescript/workflows/) with a modern chat interface powered by [LlamaIndex Chat UI](https://ui.llamaindex.ai/).

## Overview

This project is a hackable Next.js starter template that demonstrates how to:

- Build an **Agentic RAG** (Retrieval-Augmented Generation) workflow using LlamaIndex
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

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your-openai-api-key

# Optional: Enable suggested follow-up questions
SUGGEST_NEXT_QUESTIONS=true

# Optional: Starter questions shown when chat is empty (JSON array)
NEXT_PUBLIC_STARTER_QUESTIONS='["What is this document about?", "Summarize the key points"]'
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

### Workflow Definition

The LlamaIndex workflow is defined in [`app/api/chat/app/workflow.ts`](app/api/chat/app/workflow.ts):

```typescript
import { agent } from "@llamaindex/workflow";
import { getIndex } from "./data";

export const workflowFactory = async (reqBody: any) => {
  const index = await getIndex(reqBody?.data);

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information about letter standards`,
    },
    includeSourceNodes: true,
  });

  return agent({ tools: [queryEngineTool] });
};
```

This creates a simple agent with a document query tool. Customize this file to:

- Add more tools
- Implement custom workflow logic
- Configure different retrieval strategies

### Event Streaming & Adapters

The API route [`app/api/chat/route.ts`](app/api/chat/route.ts) handles the conversion of workflow events to the data part format used by Vercel AI SDK:

```typescript
const stream = workflowStream
  .pipeThrough(AgentWorkflowAdapter.processStreamEvents())
  .pipeThrough(AgentWorkflowAdapter.processToolCallEvents())
  .pipeThrough(AgentWorkflowAdapter.processToolCallResultEvents(parsers))
  .pipeThrough(ServerAdapter.postActions({ chatHistory, enableSuggestion }))
  .pipeThrough(ServerAdapter.transformToSSE());
```

The adapters transform LlamaIndex workflow events into streamable data parts that the frontend can render.

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

Each part component renders a specific type of content:

- **Event** – Shows workflow progress and tool execution status
- **File** – Displays uploaded files
- **Markdown** – Renders formatted text responses
- **Artifact** – Interactive code blocks and documents
- **Source** – Retrieved document sources with citations
- **Suggestion** – Follow-up question suggestions

Learn more about message parts in the [Chat UI documentation](https://github.com/run-llama/chat-ui/blob/main/docs/chat-ui/parts.mdx).

### Model Configuration

Configure LLM and embedding models in [`app/api/chat/app/settings.ts`](app/api/chat/app/settings.ts):

```typescript
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings } from "llamaindex";

export function initSettings() {
  Settings.llm = new OpenAI({
    model: "gpt-4o-mini",
    maxTokens: 2000,
  });
  Settings.embedModel = new OpenAIEmbedding({
    model: "text-embedding-3-small",
    dimensions: 1536,
  });
}
```

## Customization

### Adding New Tools

Extend the workflow by adding more tools to the agent:

```typescript
import { agent, tool } from "@llamaindex/workflow";

const customTool = tool({
  name: "my_tool",
  description: "Description of what this tool does",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    // Your tool logic here
    return result;
  },
});

return agent({ tools: [queryEngineTool, customTool] });
```

### Using Different LLM Providers

Swap out OpenAI for other providers by modifying `settings.ts`:

```typescript
import { Anthropic } from "@llamaindex/anthropic";

Settings.llm = new Anthropic({
  model: "claude-sonnet-4-20250514",
});
```

## Learn More

- [LlamaIndex Workflows Documentation](https://developers.llamaindex.ai/typescript/workflows/)
- [LlamaIndex Chat UI](https://ui.llamaindex.ai/)
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)



