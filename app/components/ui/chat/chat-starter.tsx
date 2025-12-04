"use client";

import { useChatUI } from "@llamaindex/chat-ui";
import { StarterQuestions } from "@llamaindex/chat-ui/widgets";

export function ChatStarter({ className }: { className?: string }) {
  const { sendMessage, messages, requestData } = useChatUI();

  const starterQuestions = ["What are the physical standards for letters?", "What are the physical standards for parcels?"];

  if (starterQuestions.length === 0 || messages.length > 0) return null;
  return (
    <StarterQuestions
      sendMessage={(message) => sendMessage(message, { body: requestData })}
      questions={starterQuestions}
      className={className}
    />
  );
}
