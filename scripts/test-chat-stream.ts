import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { toChatEvents } from "@/lib/agent/chat-stream";
import { MAX_ACTIONS_PER_REPLY, type ChatEvent } from "@/lib/agent/schema";

// Drives toChatEvents (what /api/chat streams) with a mocked model stream.
// No network, no API key. Run: npm run test:chat

type Ev = Anthropic.RawMessageStreamEvent;
const ev = (e: unknown) => e as Ev;

let index = 0;

/**
 * a tool_use block; `json` is streamed in two chunks (or `chunk`-sized pieces),
 * `stop: false` leaves it open
 */
function tool(name: string, json: string, { stop = true, chunk = 0 } = {}): Ev[] {
  const i = index++;
  const size = chunk || Math.ceil(json.length / 2) || 1;
  const pieces = json.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [""];
  return [
    ev({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: `toolu_${i}`, name, input: {} } }),
    ...pieces.map((partial_json) =>
      ev({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json } })
    ),
    ...(stop ? [ev({ type: "content_block_stop", index: i })] : []),
  ];
}

function text(...deltas: string[]): Ev[] {
  const i = index++;
  return [
    ev({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } }),
    ...deltas.map((d) => ev({ type: "content_block_delta", index: i, delta: { type: "text_delta", text: d } })),
    ev({ type: "content_block_stop", index: i }),
  ];
}

const end = (stop_reason: string): Ev[] => [
  ev({ type: "message_delta", delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 0 } }),
  ev({ type: "message_stop" }),
];

async function run(events: Ev[], failAfter = Infinity): Promise<ChatEvent[]> {
  async function* mock() {
    let n = 0;
    for (const e of events) {
      if (n++ >= failAfter) throw new Error("mock stream failure");
      yield e;
    }
  }
  const out: ChatEvent[] = [];
  for await (const e of toChatEvents(mock, "FAILED")) out.push(e);
  return out;
}

const actions = (out: ChatEvent[]) =>
  out.flatMap((e) => (e.t === "action" ? [`${e.name}:${Object.values(e.params).join(",")}`] : []));
const said = (out: ChatEvent[]) => out.flatMap((e) => (e.t === "text" ? [e.d] : [])).join("");
const endsWithDone = (out: ChatEvent[]) =>
  out.at(-1)?.t === "done" && out.filter((e) => e.t === "done").length === 1;

const tests: [string, () => Promise<void>][] = [
  [
    "cap: 6 valid tool calls -> first 4 emitted, in order",
    async () => {
      const out = await run([
        ...tool("scroll_to", '{"section":"stack"}'),
        ...tool("highlight", '{"target":"stack:frontend"}'),
        ...tool("highlight", '{"target":"stack:backend"}'),
        ...tool("highlight", '{"target":"stack:ai"}'),
        ...tool("offer_cv", ""),
        ...tool("offer_contact", "{}"),
        ...text("Here is ", "the stack."),
        ...end("tool_use"),
      ]);
      assert.equal(MAX_ACTIONS_PER_REPLY, 4);
      assert.deepEqual(actions(out), [
        "scroll_to:stack",
        "highlight:stack:frontend",
        "highlight:stack:backend",
        "highlight:stack:ai",
      ]);
      assert.equal(said(out), "Here is the stack.");
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "cap: rejected calls do not use up the cap",
    async () => {
      const out = await run([
        ...tool("delete_site", '{"confirm":true}'),
        ...tool("open_project", '{"slug":"admin"}'),
        ...tool("scroll_to", '{"section":"projects"}'),
        ...tool("open_project", '{"slug":"lead-hq"}'),
        ...tool("show_gallery", '{"slug":"lead-hq"}'),
        ...tool("offer_cv", ""),
        ...tool("offer_contact", ""),
        ...end("tool_use"),
      ]);
      assert.deepEqual(actions(out), [
        "scroll_to:projects",
        "open_project:lead-hq",
        "show_gallery:lead-hq",
        "offer_cv:",
      ]);
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "order: actions are emitted before the text that follows them",
    async () => {
      const out = await run([...tool("offer_contact", ""), ...text("Email is best."), ...end("end_turn")]);
      assert.deepEqual(out.map((e) => e.t), ["action", "text", "done"]);
    },
  ],
  [
    "say: page tools first, then the answer streams out of say as text, never as an action",
    async () => {
      const out = await run([
        ...tool("open_project", '{"slug":"lead-hq"}'),
        ...tool("highlight", '{"target":"project:job-cc"}'),
        ...tool("say", '{"text": "Two projects use AI."}', { chunk: 5 }),
        ...end("tool_use"),
      ]);
      assert.deepEqual(actions(out), ["open_project:lead-hq", "highlight:project:job-cc"]);
      assert.equal(said(out), "Two projects use AI.");
      assert.deepEqual(out.slice(0, 3).map((e) => e.t), ["action", "action", "text"]);
      assert.ok(out.filter((e) => e.t === "text").length > 1, "text should arrive in several deltas");
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "say: does not count toward the action cap",
    async () => {
      const out = await run([
        ...tool("scroll_to", '{"section":"stack"}'),
        ...tool("highlight", '{"target":"stack:frontend"}'),
        ...tool("highlight", '{"target":"stack:backend"}'),
        ...tool("highlight", '{"target":"stack:ai"}'),
        ...tool("say", '{"text":"That is the stack."}'),
        ...end("tool_use"),
      ]);
      assert.equal(actions(out).length, 4);
      assert.equal(said(out), "That is the stack.");
    },
  ],
  [
    "say: escapes split across chunks decode correctly",
    async () => {
      const spoken = 'He said "hi"\\ and left.\nCaf\u00e9 - \ud83d\ude00 done';
      const json = `{"text":${JSON.stringify(spoken).replace("\u00e9", "\\u00e9").replace("\ud83d\ude00", "\\ud83d\\ude00")}}`;
      for (const chunk of [1, 2, 3, 7]) {
        index = 0;
        const out = await run([...tool("say", json, { chunk }), ...end("tool_use")]);
        assert.equal(said(out), spoken, `chunk size ${chunk}`);
      }
    },
  ],
  [
    "truncation: say cut mid-sentence -> the text that arrived is kept, done sent",
    async () => {
      const out = await run([
        ...tool("offer_cv", ""),
        ...tool("say", '{"text": "My CV is right he', { chunk: 4 }),
        ...end("max_tokens"),
      ]);
      assert.deepEqual(actions(out), ["offer_cv:"]);
      assert.equal(said(out), "My CV is right he");
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "truncation: tool call cut mid-value, block closed -> dropped, done sent",
    async () => {
      const out = await run([
        ...tool("scroll_to", '{"section":"projects"}'),
        ...tool("open_project", '{"slug": "lead-'),
        ...end("max_tokens"),
      ]);
      assert.deepEqual(actions(out), ["scroll_to:projects"]);
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "truncation: value complete but JSON unterminated -> dropped (no lenient parse)",
    async () => {
      const out = await run([...tool("open_project", '{"slug": "lead-hq"'), ...end("max_tokens")]);
      assert.deepEqual(actions(out), []);
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "truncation: tool block never closed -> dropped, done sent",
    async () => {
      const out = await run([
        ...text("Opening it now."),
        ...tool("open_project", '{"slug":"lead-hq"}', { stop: false }),
        ...end("max_tokens"),
      ]);
      assert.deepEqual(actions(out), []);
      assert.equal(said(out), "Opening it now.");
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "truncation: text cut off after complete tool calls -> actions kept, done sent",
    async () => {
      const out = await run([...tool("offer_cv", ""), ...text("My CV is right").slice(0, -1), ...end("max_tokens")]);
      assert.deepEqual(actions(out), ["offer_cv:"]);
      assert.equal(said(out), "My CV is right");
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "error: stream throws mid-reply -> failure text, done sent",
    async () => {
      const out = await run([...tool("offer_cv", ""), ...text("one", "two"), ...end("end_turn")], 6);
      assert.deepEqual(actions(out), ["offer_cv:"]);
      assert.ok(said(out).endsWith("FAILED"));
      assert.ok(endsWithDone(out));
    },
  ],
  [
    "error: stream cannot be opened -> failure text, done sent",
    async () => {
      const out: ChatEvent[] = [];
      const broken = (): AsyncIterable<Ev> => {
        throw new Error("no connection");
      };
      for await (const e of toChatEvents(broken, "FAILED")) out.push(e);
      assert.deepEqual(out, [{ t: "text", d: "FAILED" }, { t: "done" }]);
    },
  ],
];

async function main() {
  let failed = 0;
  for (const [name, fn] of tests) {
    index = 0;
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${(err as Error).message.split("\n").join("\n      ")}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
}

void main();
