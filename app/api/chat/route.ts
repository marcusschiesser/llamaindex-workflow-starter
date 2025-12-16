import type { UIMessage } from "@ai-sdk/react";
import { convertToModelMessages, type ModelMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { initSettings } from "./app/settings";
import { startEvent, stopEvent, workflowFactory } from "./app/workflow";
import { ServerAdapter } from "./utils";

initSettings();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const userInput = lastMessage.parts.find(
      (part) => part.type === "text" && "text" in part,
    )?.text as string;
    const chatHistory: ModelMessage[] = convertToModelMessages(messages);

    // create workflow and context
    const context = await workflowFactory();
    // send start event
    context.sendEvent(
      startEvent.with({
        userInput,
        chatHistory,
      }),
    );

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
    const stream = workflowStream.pipeThrough(ServerAdapter.transformToSSE());

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
