import type Anthropic from "@anthropic-ai/sdk";
import {
  MAX_ACTIONS_PER_REPLY,
  validateCall,
  type ChatEvent,
} from "@/lib/agent/schema";

// Turns the model's raw stream into the NDJSON events /api/chat sends, in
// stream order: text deltas as they arrive, and one action per tool call the
// moment that call's block closes. Kept apart from the route (and free of any
// network or env access) so it can be driven by a mocked stream in tests.
//
//
// Acting first: a model turn ends at its tool calls, so text can never follow
// them in the same call. To let the page move before the answer is written,
// the answer itself travels through one extra tool, `say`, called last. It is
// not an action and is never emitted as one: its text is decoded from the
// streaming tool input and sent as ordinary text events.
//
// Guarantees:
// - A tool call is emitted only if its input arrived as complete JSON and it
//   passes the registry check. A call cut off by max_tokens (or by anything
//   else) never parses, so it is dropped, never guessed at.
// - At most MAX_ACTIONS_PER_REPLY actions per reply.
// - `done` is always the last event, including after truncation or an error.

type StreamEvent = Anthropic.RawMessageStreamEvent;

/** strict parse of a finished tool input; undefined if it is not complete JSON */
function parseInput(json: string): unknown {
  // a tool without params streams no input at all
  if (!json.trim()) return {};
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** the reply channel for turns that drive the page; see the note at the top */
export const SAY_TOOL = {
  name: "say",
  description:
    "Speak your answer to the visitor. Required in every reply that calls a page tool: call it exactly once, in the same reply, after all the page tools, and put the whole answer here instead of writing plain text. Tool results are never returned, so do not wait for them before calling it.",
  input_schema: {
    type: "object" as const,
    properties: {
      text: { type: "string", description: "The answer, 1-2 plain-text sentences." },
    },
    required: ["text"],
    additionalProperties: false,
  },
};

/**
 * The part of say's `text` that has arrived so far, decoded from the partial
 * tool input (`{"text": "Here is my st`). An escape sequence that is still
 * arriving is held back until it is whole.
 */
function spokenSoFar(json: string): string {
  const head = /^\s*\{\s*"text"\s*:\s*"/.exec(json);
  if (!head) return "";
  const body = json.slice(head[0].length);
  let end = body.length;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '"') {
      end = i;
      break;
    }
    if (body[i] !== "\\") continue;
    const size = body[i + 1] === "u" ? 6 : 2;
    if (i + size > body.length) {
      end = i;
      break;
    }
    i += size - 1;
  }
  try {
    return JSON.parse(`"${body.slice(0, end)}"`) as string;
  } catch {
    return "";
  }
}

export async function* toChatEvents(
  open: () => AsyncIterable<StreamEvent>,
  failureText: string
): AsyncGenerator<ChatEvent> {
  /** the tool_use block currently streaming, if any; `sent` = say text already emitted */
  let tool: { name: string; json: string; sent: number } | null = null;
  let emitted = 0;
  let spoke = false;

  try {
    for await (const event of open()) {
      switch (event.type) {
        case "content_block_start":
          tool =
            event.content_block.type === "tool_use"
              ? { name: event.content_block.name, json: "", sent: 0 }
              : null;
          break;

        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            spoke = true;
            yield { t: "text", d: event.delta.text };
          } else if (event.delta.type === "input_json_delta" && tool) {
            tool.json += event.delta.partial_json;
            if (tool.name !== SAY_TOOL.name) break;
            const spoken = spokenSoFar(tool.json);
            if (spoken.length <= tool.sent) break;
            // a second say (or say after plain text) continues the same line
            const gap = spoke && tool.sent === 0 ? " " : "";
            yield { t: "text", d: gap + spoken.slice(tool.sent) };
            tool.sent = spoken.length;
            spoke = true;
          }
          break;

        case "content_block_stop": {
          const call = tool;
          tool = null;
          // say is the reply channel, never an action; its text already went out
          if (!call || call.name === SAY_TOOL.name) break;
          if (emitted >= MAX_ACTIONS_PER_REPLY) break;
          const input = parseInput(call.json);
          if (input === undefined) break;
          const valid = validateCall(call.name, input);
          if (!valid) break;
          emitted++;
          yield { t: "action", name: valid.name, params: valid.params };
          break;
        }

        case "message_delta":
          // out of tokens: whatever block was still open is incomplete
          if (event.delta.stop_reason === "max_tokens") tool = null;
          break;
      }
    }
  } catch {
    yield { t: "text", d: failureText };
  }
  yield { t: "done" };
}
