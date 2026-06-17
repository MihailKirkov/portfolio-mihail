import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-screen">
      <div className="status-card">
        <p className="status-code">
          SIGNAL LOST <span className="sep">//</span> 404
        </p>
        <p className="status-msg">
          That coordinate isn&apos;t on the map. The page you were looking for
          doesn&apos;t exist or has drifted out of range.
        </p>
        <div className="status-actions">
          <Link className="btn-ghost" href="/">
            ← return to base
          </Link>
        </div>
      </div>
    </main>
  );
}
