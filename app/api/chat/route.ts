import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/chat-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- abuse guards -----------------------------------------------------------
const MAX_INPUT_CHARS = 500;
const MAX_HISTORY_MESSAGES = 10;
const MAX_OUTPUT_TOKENS = 300;

// simple in-memory per-IP rate limiter (sliding window).
// Survives within a warm serverless instance; good enough to stop a bored
// visitor running up a bill. For multi-instance scale, swap for a shared store.
const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("Chat is not configured.", { status: 503 });
  }

  const ip = getIp(req);
  if (rateLimited(ip)) {
    return new Response("Too many messages - give me a moment.", {
      status: 429,
    });
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request.", { status: 400 });
  }

  const message =
    typeof body.message === "string"
      ? body.message.slice(0, MAX_INPUT_CHARS).trim()
      : "";
  if (!message) {
    return new Response("Empty message.", { status: 400 });
  }

  const history: IncomingMessage[] = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter(
          (m): m is IncomingMessage =>
            !!m &&
            typeof m === "object" &&
            (("role" in m && (m.role === "user" || m.role === "assistant")) as boolean) &&
            "content" in m &&
            typeof (m as IncomingMessage).content === "string"
        )
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, MAX_INPUT_CHARS),
        }))
    : [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ai = client.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: MAX_OUTPUT_TOKENS,
          system: buildSystemPrompt(),
          messages,
        });

        ai.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await ai.finalMessage();
        controller.close();
      } catch {
        controller.enqueue(
          encoder.encode(
            "Something glitched on my end - try again, or email me at mihailkirkov04@gmail.com."
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
