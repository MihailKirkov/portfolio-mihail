"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/types/chat";

function uuid() {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

type UseChatStreamOpts = {
    welcome?: Message;
    apiPath?: string; // default "/api/chat"
};

export function useChatStream(opts: UseChatStreamOpts = {}) {
    const { welcome = { id: "welcome", role: "assistant", content: "Hi! Ask me about my experience, projects, skills, tools, or availability." }, apiPath = "/api/chat" } = opts;

    const [messages, setMessages] = useState<Message[]>([welcome]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const controllerRef = useRef<AbortController | null>(null);
    const bufferRef = useRef<string>(""); // carry incomplete SSE line
    const pendingAppendRef = useRef<string>(""); // buffer tokens for rAF
    const animRef = useRef<number | null>(null);
    const streamingMsgIdRef = useRef<string | null>(null);

    // Cancel helpers
    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        bufferRef.current = "";
        pendingAppendRef.current = "";
        if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
        }
        streamingMsgIdRef.current = null;
        setLoading(false);
    }, []);

    useEffect(() => () => cancel(), [cancel]); // cleanup on unmount

    // Append a message
    const push = useCallback((m: Message) => {
        setMessages(prev => [...prev, m]);
    }, []);

    // rAF flush: apply pendingAppendRef to the streaming assistant message
    const flushAppend = useCallback(() => {
        animRef.current = null;
        const append = pendingAppendRef.current;
        if (!append || !streamingMsgIdRef.current) return;

        setMessages(prev => {
        const idx = prev.findIndex(m => m.id === streamingMsgIdRef.current);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], content: next[idx].content + append };
        return next;
        });

        pendingAppendRef.current = "";
    }, []);

    // Schedule a flush (one per frame)
    const scheduleFlush = useCallback(() => {
        if (animRef.current != null) return;
        animRef.current = requestAnimationFrame(flushAppend);
    }, [flushAppend]);

    // Main send
    const send = useCallback(async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || loading) return;

        // Cancel previous stream if any
        cancel();

        const user: Message = { id: uuid(), role: "user", content };
        const nextMessages = [...messages, user];
        setMessages(nextMessages);
        if (!text) setInput("");
        setLoading(true);

        const ctrl = new AbortController();
        controllerRef.current = ctrl;

        const res = await fetch(apiPath, {
        method: "POST",
        body: JSON.stringify({ messages: nextMessages }),
        signal: ctrl.signal,
        }).catch(() => null);

        if (!res || !res.ok || !res.body) {
        push({
            id: uuid(),
            role: "assistant",
            content: "Sorry, something went wrong. Please try again or contact me.",
        });
        setLoading(false);
        controllerRef.current = null;
        return;
        }

        // Add placeholder assistant message we’ll stream into
        const assistantId = uuid();
        streamingMsgIdRef.current = assistantId;
        push({ id: assistantId, role: "assistant", content: "" });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done || !value) break;

        const chunk = decoder.decode(value, { stream: true });
        let buffer = bufferRef.current + chunk;
        const lines = buffer.split("\n");
        bufferRef.current = lines.pop() ?? ""; // save incomplete line

        for (const raw of lines) {
            if (!raw.startsWith("data:")) continue;
            const data = raw.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
            const evt = JSON.parse(data);
            if (evt?.type === "text" && typeof evt.content === "string") {
                pendingAppendRef.current += evt.content; // buffer token(s)
                scheduleFlush();
            }
            } catch {
            // ignore malformed JSON lines
            }
        }
        }

        // Final flush if any
        flushAppend();
        setLoading(false);
        controllerRef.current = null;
        streamingMsgIdRef.current = null;
        bufferRef.current = "";
    }, [apiPath, cancel, flushAppend, input, loading, messages, push, scheduleFlush]);

    return {
        messages,
        input,
        setInput,
        loading,
        send,
        cancel,
        reset: () => setMessages([welcome]),
    };
}
