"use client";

import { useState } from "react";

// Copies the address; the mailto link beside it stays the plain path.
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn contact-copy"
      onClick={() => {
        void navigator.clipboard?.writeText(email).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      <span aria-live="polite">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
