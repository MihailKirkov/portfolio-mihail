import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-screen">
      <div className="status-card">
        <div className="status-head">
          <span className="label">ask-mihail</span>
          <span className="label">404</span>
        </div>
        <h1 className="status-title">Nothing here.</h1>
        <p className="status-msg">
          There is no page at this address. Head back to the site and ask the
          agent for what you were looking for.
        </p>
        <div className="status-actions">
          <Link className="btn btn-primary" href="/">
            back to the site
          </Link>
        </div>
      </div>
    </main>
  );
}
