"use client";

import type { Message } from "@/types/chat";
import AvatarWithPreview from "./avatar-with-preview";

const ASSISTANT_AVATAR = "/me.jpg";

type Props = { messages: Message[]; bottomRef: React.RefObject<HTMLDivElement> };

export default function MessageList({ messages, bottomRef }: Props) {
    return (
        <div className="space-y-3" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((m) => {
                const isUser = m.role === "user";

                if (!isUser) {
                // assistant: avatar + bubble
                return (
                    <div key={m.id} className="flex items-start gap-2">
                    <AvatarWithPreview
                        src={ASSISTANT_AVATAR}
                        alt="Assistant avatar"
                        fallback="AI"
                        size={28}
                        previewSize={180}
                    />
                    <div className="inline-block rounded-2xl px-3 py-2 text-sm bg-muted">
                        {m.content}
                    </div>
                    </div>
                );
                }

                // user: right-aligned bubble
                return (
                <div key={m.id} className="flex justify-end">
                    <div className="inline-block rounded-2xl px-3 py-2 text-sm bg-primary text-primary-foreground max-w-[90%]">
                    {m.content}
                    </div>
                </div>
                );
            })}
            <div ref={bottomRef} />
        </div>
    );
}
