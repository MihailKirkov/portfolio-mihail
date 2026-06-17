"use client";

import { useEffect, useRef, useState } from "react";
import type { TerminalConfig } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  text: string;
  /** still streaming / typing */
  pending?: boolean;
}

// Hardcoded, polished answers for the three suggestion chips. These render with
// the same typewriter effect but NEVER hit the network, so the headline answers
// always work — no API key, rate limit, or outage can break them. Only questions
// the visitor free-types go to /api/chat. Keys must match config.suggestions.
const CANNED: Record<string, string> = {
  "What's your stack?":
    "Frontend is React / Next.js / TypeScript; backend is Node.js, PHP and Python; plus real AI integration — Claude API, RAG, tool use and agents. Full-stack, shipped end to end.",
  "Why should we hire you?":
    "I ship AI features end to end, not just demos. EU citizen, so zero sponsorship friction — relocating to Eindhoven in September, available August. A fast, low-risk hire who already builds in production.",
  "Tell me about a project":
    "Lead-HQ — a lead-management platform I built solo: Next.js 15 + Supabase, Apify for Google-Maps scraping, and an AI grader that scores every lead automatically. End-to-end, from scrape to scored pipeline.",
};

// Faint ambient statuses the idle agent slowly cycles through, so the empty
// terminal reads as a live presence rather than a dead box.
const AMBIENT = ["listening…", "context: cv loaded", "awaiting query", "standby"];

export function Terminal({ config }: { config: TerminalConfig }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // slow ambient ticker (the "system log" feel)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3400);
    return () => clearInterval(id);
  }, []);

  // Type out the greeting once per mount. A cancelled flag (not a ref guard)
  // is used so the effect survives StrictMode's mount→cleanup→remount in dev
  // and replays cleanly when this component remounts on a layout switch.
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const greeting = config.greeting;

    if (reduce) {
      setMessages([{ role: "assistant", text: greeting }]);
      setBooted(true);
      return;
    }

    setMessages([{ role: "assistant", text: "", pending: true }]);
    let i = 0;
    let cancelled = false;
    const id = setInterval(() => {
      if (cancelled) return;
      i++;
      setMessages([
        {
          role: "assistant",
          text: greeting.slice(0, i),
          pending: i < greeting.length,
        },
      ]);
      if (i >= greeting.length) {
        clearInterval(id);
        setBooted(true);
      }
    }, 18);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [config.greeting]);

  // autoscroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  // stop any in-flight canned typewriter on unmount
  useEffect(
    () => () => {
      if (typingRef.current) clearInterval(typingRef.current);
    },
    []
  );

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    const history = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.text }));

    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
      { role: "assistant", text: "", pending: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`bad response: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            text: acc,
            pending: true,
          };
          return next;
        });
      }
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: acc, pending: false };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: "Connection dropped — try again in a moment, or reach me by email.",
          pending: false,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  // Type a known answer into the last assistant bubble — used by the canned
  // suggestion chips. No network. Respects reduced motion (renders instantly).
  function typeInto(text: string) {
    return new Promise<void>((resolve) => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const setLast = (t: string, pending: boolean) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: t, pending };
          return next;
        });
      if (reduce) {
        setLast(text, false);
        resolve();
        return;
      }
      let i = 0;
      const id = setInterval(() => {
        i++;
        setLast(text.slice(0, i), i < text.length);
        if (i >= text.length) {
          clearInterval(id);
          typingRef.current = null;
          resolve();
        }
      }, 16);
      typingRef.current = id;
    });
  }

  async function answerCanned(question: string) {
    if (busy) return;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: "", pending: true },
    ]);
    await typeInto(CANNED[question] ?? "");
    setBusy(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = input;
    setInput("");
    ask(v);
  }

  return (
    <>
      <div className="tt">
        <span className="agent" data-state={busy ? "gen" : "idle"}>
          <span className="agent-eye" />
        </span>
        <span className="tt-name">ask-mihail.exe</span>
        <span className="tt-status">
          // {busy ? "generating…" : AMBIENT[tick % AMBIENT.length]}
        </span>
      </div>
      <div className="log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} style={{ margin: "3px 0" }}>
            {m.role === "user" ? (
              <span className="me">› you: </span>
            ) : (
              <span className="ai">mihail: </span>
            )}
            {m.text}
            {m.pending && <span className="cur">▋</span>}
          </div>
        ))}
      </div>
      {booted && messages.length <= 1 && (
        <div className="chips">
          {config.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => answerCanned(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="inrow" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="type a question…"
          aria-label="Ask Mihail a question"
          maxLength={500}
          disabled={busy}
        />
        <button type="submit" aria-label="Send" disabled={busy}>
          ↵
        </button>
      </form>
    </>
  );
}
