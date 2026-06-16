"use client";

import { useEffect, useRef, useState } from "react";
import type { TerminalConfig } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  text: string;
  /** still streaming / typing */
  pending?: boolean;
}

export function Terminal({ config }: { config: TerminalConfig }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // type out the greeting once
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

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
    const id = setInterval(() => {
      i++;
      setMessages([
        { role: "assistant", text: greeting.slice(0, i), pending: i < greeting.length },
      ]);
      if (i >= greeting.length) {
        clearInterval(id);
        setBooted(true);
      }
    }, 18);
    return () => clearInterval(id);
  }, [config.greeting]);

  // autoscroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = input;
    setInput("");
    ask(v);
  }

  return (
    <>
      <div className="tt">
        <span className="dot" />
        ask-mihail.exe — live
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
              onClick={() => ask(s)}
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
