"use client";

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
