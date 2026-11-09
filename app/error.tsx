"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-screen">
      <div className="status-card">
        <p className="status-code">SYSTEM FAULT</p>
        <p className="status-msg">
          Something tripped a breaker on board. The instrument panel hit an
          unexpected error - a reload usually clears it.
        </p>
        <div className="status-actions">
          <button className="btn" onClick={() => reset()}>
            ↻ reboot system
          </button>
          <Link className="btn" href="/">
            ← return to base
          </Link>
        </div>
      </div>
    </main>
  );
}
