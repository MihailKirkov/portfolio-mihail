"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    disabled?: boolean;
};

export default function ChatInput({ value, onChange, onSend, disabled }: Props) {
    const onSubmit = useCallback(
        (e: React.FormEvent) => {
        e.preventDefault();
        onSend();
        },
        [onSend]
    );

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
        },
        [onSend]
    );

    return (
        <form onSubmit={onSubmit} className="p-3 flex gap-2 border-t" aria-label="Send a message">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about anything..."
                disabled={disabled}
                aria-disabled={disabled}
                aria-label="Message input"
                required
            />
            <Button type="submit" disabled={disabled} aria-disabled={disabled}>
                {disabled ? "…" : "Send"}
            </Button>
        </form>
    );
}
