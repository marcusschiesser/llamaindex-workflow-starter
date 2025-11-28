"use client";

import { ChatMessage } from "@llamaindex/chat-ui";
import { LLAMA_LOGO_URL } from "../../../constants";

export function ChatMessageAvatar() {
  return (
    <ChatMessage.Avatar>
      <img
        className="rounded-full border-1 border-[#e711dd]"
        src={LLAMA_LOGO_URL}
        alt="Llama Logo"
      />
    </ChatMessage.Avatar>
  );
}
