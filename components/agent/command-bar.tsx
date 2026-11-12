"use client";

import { useEffect, useRef, useState } from "react";
import type { TerminalConfig } from "@/lib/types";
import { CANNED } from "@/lib/agent/canned";
import { formatCall, type ActionCall } from "@/lib/agent/actions";
import { choreo, prefersReducedMotion } from "@/lib/agent/choreo";
import {
  remainingCalls,
  replayRemaining,
  runActions,
  startActionRun,
  type ToolLogEntry,
} from "@/lib/agent/runner";
import { setAgentState, statusOf, useAgentState } from "@/lib/agent/store";
import { agentId } from "@/lib/agent/targets";

// The command bar: input, suggestion chips, the streamed answer line and the
// tool log. One state source renders two views - the full panel in the hero
// and a compact bar docked to the bottom of the viewport once the hero
// scrolls away - so the conversation is the same wherever the visitor is.
//
// Chips play a canned answer + canned action script (no network). Free-typed
// questions go to /api/chat, which streams NDJSON events: validated actions
// for the cursor queue (pushed as each one arrives) and text deltas for the
// answer line. Either way the agent acts first and talks while it moves.
//
// If the visitor cancels a reply's actions, or scrolls the agent's current
// target off screen, a "Show me" button offers to play
// the ones that did not run. One use per reply; the next question clears it.

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 10;
const TYPE_MS = 16;
const FAILURE_TEXT =
  "Connection dropped - try again in a moment, or reach me by email.";
// shown when the model drove the page but wrote no text
const ACTION_ONLY_TEXT = "Here, take a look.";

function ToolLog({ log }: { log: ToolLogEntry[] }) {
  if (!log.length) return null;
  return (
    <ol className="toollog" aria-label="Agent actions">
      {log.map((e, i) => (
        <li key={i} className="toollog-row" data-status={e.status}>
          <span className="toollog-call">{formatCall(e.call)}</span>
          <span className="toollog-status">{e.status}</span>
        </li>
      ))}
    </ol>
  );
}

export function CommandBar({ config }: { config: TerminalConfig }) {
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState(config.greeting);
  const [pending, setPending] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [log, setLog] = useState<ToolLogEntry[]>([]);
  const [input, setInput] = useState("");
  const [docked, setDocked] = useState(false);
  // the docked bar on narrow viewports: the answer row shown or collapsed,
  // and the input focused (which shows the chips)
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const executing = useAgentState((s) => s.executing);
  const status = useAgentState(statusOf);
  const requesting = useAgentState((s) => s.requesting);
  const panelRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef(0);
  const history = useRef<Turn[]>([]);
  // bumped per question so a superseded typewriter stops writing
  const turnRef = useRef(0);

  // dock once the hero panel has scrolled up out of view
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      const d = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      setDocked(d);
      // the core travels with the dock (components/core/core.tsx)
      setAgentState({ docked: d });
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // keep the docked bar above the on-screen keyboard: where the visual
  // viewport is shorter than the layout viewport (iOS), lift the bar by the
  // difference (--kb). Chrome resizes the layout viewport instead
  // (interactive-widget=resizes-content), where this stays 0.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = dockRef.current;
    if (!vv || !el) return;
    const update = () => {
      const lift = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      el.style.setProperty("--kb", `${lift}px`);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  function begin(q: string) {
    choreo.cancel();
    const turn = ++turnRef.current;
    setQuestion(q);
    setAnswer("");
    setPending(true);
    setLog([]);
    setReplayed(false);
    setExpanded(true);
    setAgentState({ requesting: true });
    return turn;
  }

  function finish(turn: number, q: string, text: string) {
    if (turn !== turnRef.current) return false;
    setAnswer(text);
    setPending(false);
    setAnnounce(text);
    setAgentState({ requesting: false });
    history.current = [
      ...history.current,
      { role: "user" as const, content: q },
      { role: "assistant" as const, content: text },
    ].slice(-MAX_HISTORY);
    return true;
  }

  function typeOut(turn: number, text: string) {
    return new Promise<void>((resolve) => {
      if (prefersReducedMotion()) return resolve();
      let i = 0;
      const id = setInterval(() => {
        if (turn !== turnRef.current) {
          clearInterval(id);
          return resolve();
        }
        i++;
        setAnswer(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(id);
          resolve();
        }
      }, TYPE_MS);
    });
  }

  async function askCanned(q: string) {
    const reply = CANNED[q];
    if (!reply || requesting) return;
    const turn = begin(q);
    // act first: the cursor starts now and the answer types while it moves
    const acting = runActions(reply.actions, (next) => {
      if (turn === turnRef.current) setLog(next);
    });
    await typeOut(turn, reply.text);
    finish(turn, q, reply.text);
    await acting;
  }

  function showMe() {
    const turn = turnRef.current;
    setReplayed(true);
    void replayRemaining(log, (next) => {
      if (turn === turnRef.current) setLog(next);
    });
  }

  async function askFree(raw: string) {
    const q = raw.trim();
    if (!q || requesting) return;
    const prior = history.current;
    const turn = begin(q);
    let text = "";
    let acted = false;
    // actions start playing the moment they arrive, while text still streams
    const run = startActionRun((next) => {
      if (turn === turnRef.current) setLog(next);
    });

    // one NDJSON event; anything malformed or unknown is skipped
    function onLine(line: string) {
      if (!line.trim()) return;
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (!event || typeof event !== "object") return;
      const e = event as Record<string, unknown>;
      if (e.t === "text" && typeof e.d === "string") {
        text += e.d;
        if (turn === turnRef.current) setAnswer(text);
      } else if (e.t === "action" && typeof e.name === "string") {
        if (turn !== turnRef.current) return;
        acted = true;
        // re-validated against the registry by the run before anything plays
        run.push({ name: e.name, params: e.params as ActionCall["params"] });
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: prior }),
      });
      if (!res.ok || !res.body) throw new Error(`bad response: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(onLine);
      }
      onLine(buffer + decoder.decode());
    } catch {
      text = FAILURE_TEXT;
    }

    finish(turn, q, text.trim() || (acted ? ACTION_ONLY_TEXT : FAILURE_TEXT));
    await run.settled();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = input;
    setInput("");
    void askFree(v);
  }

  // the same input in the hero panel and in the dock; only the hero's is a
  // part of the boot intro (typed in, held grey)
  const form = (inHero: boolean) => (
    <form className="cmd-input" onSubmit={onSubmit}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="type a question…"
        aria-label="Ask Mihail a question"
        maxLength={500}
        disabled={requesting}
        data-agent-id={agentId.commandInput()}
        data-intro-type={inHero ? "placeholder" : undefined}
        onFocus={() => {
          clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        // a tap on a chip blurs the input first: keep the chips a moment
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 250);
        }}
      />
      <button type="submit" className="btn" aria-label="Send" disabled={requesting}>
        ↵
      </button>
    </form>
  );

  const chips = (
    <div className="chips">
      {config.suggestions.map((s) => (
        <button
          key={s}
          type="button"
          className="chip"
          disabled={requesting}
          onClick={() => void askCanned(s)}
        >
          <span className="chip-label" data-intro-type="chip">
            {s}
          </span>
        </button>
      ))}
    </div>
  );

  // playback stopped with actions left over (the visitor cancelled)
  const showMeButton = !replayed &&
    !requesting &&
    !executing &&
    remainingCalls(log).length > 0 && (
      <button type="button" className="chip showme" onClick={showMe}>
        Show me
      </button>
    );

  const caret = pending && <span className="cmd-caret" aria-hidden="true" />;

  return (
    <>
      <div
        className="cmd"
        ref={panelRef}
        data-agent-id="chat"
        data-intro-part="frame"
        data-intro-tone="panel"
      >
        <div className="cmd-head">
          <span className="label">ask-mihail</span>
          <span className="label cmd-status" data-status={status}>
            {status}
          </span>
        </div>
        <p className="cmd-caption">
          an AI agent I built - Claude API + RAG. Ask anything.
        </p>
        <div className="cmd-answer">
          {question && (
            <p className="cmd-line user">
              <span className="label">you</span>
              <span>{question}</span>
            </p>
          )}
          <p className="cmd-line">
            <span className="label">mihail</span>
            <span data-intro-type="greeting">
              {answer}
              {caret}
            </span>
          </p>
          <ToolLog log={log} />
          {showMeButton}
        </div>
        {chips}
        {form(true)}
      </div>

      <div
        className="dock"
        ref={dockRef}
        data-docked={docked}
        data-has-answer={question !== null}
        data-expanded={question !== null && expanded}
        data-focus={focused}
        inert={!docked}
        aria-hidden={!docked}
      >
        <div className="dock-inner">
          <div className="dock-head">
            {/* where the core lands when docked; the core itself overlays it */}
            <span className="dock-core" data-core-slot="" aria-hidden="true" />
            <span className="label cmd-status" data-status={status}>
              {status}
            </span>
            {/* narrow viewports: the answer row folds away */}
            {question !== null && (
              <button
                type="button"
                className="dock-toggle label"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? "hide" : "answer"}
              </button>
            )}
          </div>
          <div className="dock-body">
            <p className="dock-answer">
              {answer}
              {caret}
            </p>
            {status !== "idle" && <ToolLog log={log} />}
            {showMeButton}
          </div>
          <div className="dock-chips">{chips}</div>
          {form(false)}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
