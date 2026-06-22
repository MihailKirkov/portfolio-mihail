"use client";

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
          <button className="btn-ghost" onClick={() => reset()}>
            ↻ reboot system
          </button>
          <a className="btn-ghost" href="/">
            ← return to base
          </a>
        </div>
      </div>
    </main>
  );
}
