import { NextRequest } from "next/server";
import { openai, MODEL } from "@/lib/openai";
import { retrieve, toContext } from "@/lib/rag";

// stream tokens as Server-Sent Events so the shadcn UI feels instant.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const { messages } = await req.json();
    const userText = messages?.[messages.length - 1]?.content ?? "";

    const top = await retrieve(userText, 6);
    const context = toContext(top);

    const system = [
        "You are a portfolio assistant for a software developer.",
        "Answer ONLY using the provided CONTEXT.",
        "If the answer is not in CONTEXT, say you don't know and offer a way to contact the developer.",
        "Keep answers brief and factual. Use short sentences. Include links from context if relevant.",
        "",
        "If users ask for things like salary expectations or personal data not in context, say you don't know.",
        "",
        "CONTEXT:",
        context,
    ].join("\n");

  // OpenAI Responses API with text stream
    const response = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        stream: true,
        messages: [{ role: "system", content: system }, ...(messages ?? [])],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
        try {
            for await (const part of response) {
            const token = part.choices?.[0]?.delta?.content ?? "";
            if (token) {
                controller.enqueue(
                encoder.encode(
                    `data: ${JSON.stringify({ type: "text", content: token })}\n\n`
                )
                );
            }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        } catch (err) {
            controller.error(err);
        }
        },
    });

  // SSE response (compatible with common chat hooks)
    return new Response(stream, {
        headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        },
    });
}
