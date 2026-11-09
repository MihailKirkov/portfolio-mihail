import type { Content } from "@/lib/types";
import { CssCore } from "@/components/core/reactor-core";
import { Terminal } from "@/components/chat/terminal";
import { DownloadIcon } from "@/components/site/icons";

const NAV = [
  { id: "projects", label: "projects" },
  { id: "stack", label: "stack" },
  { id: "experience", label: "experience" },
  { id: "credentials", label: "credentials" },
  { id: "contact", label: "contact" },
];

export function Hero({ content }: { content: Content }) {
  const { profile } = content;
  return (
    <section id="hero" className="hero" data-agent-id="section:hero">
      <header className="topbar">
        <a className="topbar-brand" href="#hero">
          <span className="mark">MK</span>
          <span className="label">{profile.name}</span>
        </a>
        <nav aria-label="Sections" className="topbar-nav">
          {NAV.map((n) => (
            <a key={n.id} className="label" href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <a
          className="btn btn-primary"
          href={profile.cv_url}
          download="Mihail-Kirkov-CV.pdf"
          data-agent-id="cta:cv"
        >
          <DownloadIcon /> CV
        </a>
      </header>

      <div className="hero-grid">
        <div className="hero-copy">
          <p className="label">
            {profile.name} / {profile.tagline}
          </p>
          <h1 className="hero-title">{profile.headline}</h1>
          <p className="hero-sub">{profile.subhead}</p>
          <ul className="hero-status">
            <li className="label">{profile.availability}</li>
          </ul>
          <div className="hero-core">
            <CssCore />
          </div>
        </div>
        <Terminal config={content.terminal} />
      </div>
    </section>
  );
}
