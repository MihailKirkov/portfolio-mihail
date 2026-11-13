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
      <div className="status-card" role="alert">
        <div className="status-head">
          <span className="label">ask-mihail</span>
          <span className="label">error</span>
        </div>
        <h1 className="status-title">Something broke.</h1>
        <p className="status-msg">
          The page hit an unexpected error. Trying again usually clears it; if
          it does not, reload the site.
        </p>
        <div className="status-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            try again
          </button>
          <Link className="btn" href="/">
            back to the site
          </Link>
        </div>
      </div>
    </main>
  );
}
