"use client";

import { useChat } from "@ai-sdk/react";
import { ChatSection as ChatUI, useChatWorkflow } from "@llamaindex/chat-ui";
import { DefaultChatTransport } from "ai";
import { getConfig } from "../lib/utils";
import { ResizablePanel, ResizablePanelGroup } from "../resizable";
import { ChatCanvasPanel } from "./canvas/panel";
import { ChatInjection } from "./chat-injection";
import CustomChatInput from "./chat-input";
import CustomChatMessages from "./chat-messages";
import { ChatLayout } from "./layout";

export default function ChatSection() {
	const deployment = getConfig("DEPLOYMENT") || "";
	const workflow = getConfig("WORKFLOW") || "";
	const shouldUseChatWorkflow = deployment && workflow;

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

	const useChatHandler = useChat({
		transport: new DefaultChatTransport({
			api: getConfig("CHAT_API") || "/api/chat",
		}),
		onError: handleError,
		experimental_throttle: 100,
	});

	const useChatWorkflowHandler = useChatWorkflow({
		fileServerUrl: getConfig("FILE_SERVER_URL"),
		deployment,
		workflow,
		onError: handleError,
	});

	const handler = shouldUseChatWorkflow
		? useChatWorkflowHandler
		: useChatHandler;

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
			<ChatInjection />
		</>
	);
}

function ChatSectionPanel() {

	return (
		<ResizablePanel defaultSize={40} minSize={30} className="max-w-1/2 mx-auto">
			<div className="flex h-full min-w-0 flex-1 flex-col gap-4">
				<CustomChatMessages />
				<CustomChatInput />
			</div>
		</ResizablePanel>
	);
}
