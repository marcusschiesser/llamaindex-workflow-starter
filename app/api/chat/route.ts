import type { UIMessage } from "@ai-sdk/react";
import type { ChatMessage } from "llamaindex";
import { type NextRequest, NextResponse } from "next/server";
import { initSettings } from "./app/settings";
import { stopEvent, workflowFactory } from "./app/workflow";
import { runWorkflow, ServerAdapter, ServerMessage } from "./utils";

initSettings();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enableSuggestion = process.env.SUGGEST_NEXT_QUESTIONS === "true";
    const { messages } = body as {
      messages: UIMessage[];
    };

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user" || !lastMessage.parts.length) {
      return NextResponse.json(
        {
          detail: "Messages cannot be empty and last message must be from user",
        },
        { status: 400 },
      );
    }

    const serverMessage = new ServerMessage(lastMessage);

    const userInput = serverMessage.llamaindexMessage.content;
    const chatHistory: ChatMessage[] = messages.map(
      (message) => new ServerMessage(message).llamaindexMessage,
    );

    // run workflow
    const context = await runWorkflow({
      workflow: await workflowFactory(),
      input: { userInput, chatHistory },
    });

    // abort controller
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () =>
      abortController.abort("Connection closed"),
    );

    // get workflow stream from workflow context
    const workflowStream = context.stream.until(
      (event: any) =>
        abortController.signal.aborted || stopEvent.include(event),
    );

    // transform workflow stream to SSE format
    const stream = workflowStream
      .pipeThrough(ServerAdapter.postActions({ chatHistory, enableSuggestion })) // actions on stream finished
      .pipeThrough(ServerAdapter.transformToSSE()); // transform all events to SSE format

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chat handler error:", error);
    return NextResponse.json(
      {
        detail: (error as Error).message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
