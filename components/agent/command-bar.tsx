"use client";

import { useEffect, useRef, useState } from "react";
import type { TerminalConfig } from "@/lib/types";
import { CANNED } from "@/lib/agent/canned";
import { formatCall } from "@/lib/agent/actions";
import { choreo, prefersReducedMotion } from "@/lib/agent/choreo";
import { runActions, type ToolLogEntry } from "@/lib/agent/runner";
import { setAgentState, statusOf, useAgentState } from "@/lib/agent/store";
import { agentId } from "@/lib/agent/targets";

// The command bar: input, suggestion chips, the streamed answer line and the
// tool log. One state source renders two views - the full panel in the hero
// and a compact bar docked to the bottom of the viewport once the hero
// scrolls away - so the conversation is the same wherever the visitor is.
//
// Chips play a canned answer + canned action script (no network). Free-typed
// questions go to /api/chat (plain text stream until phase 2).

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 10;
const TYPE_MS = 16;
const FAILURE_TEXT =
  "Connection dropped - try again in a moment, or reach me by email.";

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
  const status = useAgentState(statusOf);
  const requesting = useAgentState((s) => s.requesting);
  const panelRef = useRef<HTMLDivElement>(null);
  const history = useRef<Turn[]>([]);
  // bumped per question so a superseded typewriter stops writing
  const turnRef = useRef(0);

  // dock once the hero panel has scrolled up out of view
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setDocked(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function begin(q: string) {
    choreo.cancel();
    const turn = ++turnRef.current;
    setQuestion(q);
    setAnswer("");
    setPending(true);
    setLog([]);
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
    await typeOut(turn, reply.text);
    if (!finish(turn, q, reply.text)) return;
    await runActions(reply.actions, (next) => {
      if (turn === turnRef.current) setLog(next);
    });
  }

  async function askFree(raw: string) {
    const q = raw.trim();
    if (!q || requesting) return;
    const prior = history.current;
    const turn = begin(q);
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: prior }),
      });
      if (!res.ok || !res.body) throw new Error(`bad response: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (turn === turnRef.current) setAnswer(acc);
      }
    } catch {
      acc = FAILURE_TEXT;
    }
    finish(turn, q, acc || FAILURE_TEXT);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = input;
    setInput("");
    void askFree(v);
  }

  const form = (
    <form className="cmd-input" onSubmit={onSubmit}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="type a question…"
        aria-label="Ask Mihail a question"
        maxLength={500}
        disabled={requesting}
        data-agent-id={agentId.commandInput()}
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
          {s}
        </button>
      ))}
    </div>
  );

  const caret = pending && <span className="cmd-caret" aria-hidden="true" />;

  return (
    <>
      <div className="cmd" ref={panelRef} data-agent-id="chat">
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
            <span>
              {answer}
              {caret}
            </span>
          </p>
          <ToolLog log={log} />
        </div>
        {chips}
        {form}
      </div>

      <div
        className="dock"
        data-docked={docked}
        inert={!docked}
        aria-hidden={!docked}
      >
        <div className="dock-inner">
          <div className="dock-top">
            <span className="label cmd-status" data-status={status}>
              {status}
            </span>
            <p className="dock-answer">
              {answer}
              {caret}
            </p>
          </div>
          {status !== "idle" && <ToolLog log={log} />}
          <div className="dock-chips">{chips}</div>
          {form}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
