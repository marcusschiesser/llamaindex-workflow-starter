"use client";

import { useChat } from "@ai-sdk/react";
import { ChatSection as ChatUI } from "@llamaindex/chat-ui";
import { DefaultChatTransport } from "ai";
import { ResizablePanel, ResizablePanelGroup } from "../resizable";
import { ChatCanvasPanel } from "./canvas/panel";
import CustomChatInput from "./chat-input";
import CustomChatMessages from "./chat-messages";
import { ChatLayout } from "./layout";

export default function ChatSection() {
  const handleError = (error: unknown) => {
    if (!(error instanceof Error)) throw error;
    let errorMessage: string;
    try {
      errorMessage = JSON.parse(error.message).detail;
    } catch (e) {
      errorMessage = error.message;
    }
    alert(errorMessage);
  };

  const handler = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onError: handleError,
    experimental_throttle: 100,
  });

  return (
    <>
      <ChatLayout>
        <ChatUI
          handler={handler}
          className="relative flex min-h-0 flex-1 flex-row justify-center gap-4 px-4 py-0"
        >
          <ResizablePanelGroup direction="horizontal">
            <ChatSectionPanel />
            <ChatCanvasPanel />
          </ResizablePanelGroup>
        </ChatUI>
      </ChatLayout>
    </>
  );
}

function ChatSectionPanel() {
  return (
    <ResizablePanel defaultSize={40} minSize={30} className="mx-auto max-w-1/2">
      <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
        <CustomChatMessages />
        <CustomChatInput />
      </div>
    </ResizablePanel>
  );
}
