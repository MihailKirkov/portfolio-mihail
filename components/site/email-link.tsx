"use client";

import { useState } from "react";
import { agentId } from "@/lib/agent/targets";

// The email as one large click-to-copy link. Without JS (or without a
// clipboard) it is a plain mailto link.
export function EmailLink({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <a
        className="contact-email-link"
        href={`mailto:${email}`}
        data-agent-id={agentId.cta("email")}
        onClick={(e) => {
          if (!navigator.clipboard || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          void navigator.clipboard.writeText(email).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            },
            () => {
              location.href = `mailto:${email}`;
            }
          );
        }}
      >
        {email}
      </a>
      <span className="label contact-copied" aria-live="polite">
        {copied ? "copied" : ""}
      </span>
    </>
  );
}
