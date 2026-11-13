import type { Profile } from "@/lib/types";
import { DownloadIcon } from "@/components/site/icons";
import { agentId, type SectionId } from "@/lib/agent/targets";
import { TopBarMenu } from "@/components/site/top-bar-menu";

// Sticky across the whole page, so the agent can "click" a nav link or the CV
// button from any section.

const NAV: SectionId[] = ["projects", "stack", "experience", "contact"];

export function TopBar({ profile }: { profile: Profile }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="topbar-brand" href="#hero" data-agent-id={agentId.nav("hero")}>
          <span className="mark">MK</span>
          <span className="label">{profile.name}</span>
        </a>
        <nav aria-label="Sections" className="topbar-nav">
          {NAV.map((id) => (
            <a key={id} className="label" href={`#${id}`} data-agent-id={agentId.nav(id)}>
              {id}
            </a>
          ))}
        </nav>
        <TopBarMenu items={NAV} />
        <a
          className="btn btn-primary"
          href={profile.cv_url}
          download="Mihail-Kirkov-CV.pdf"
          data-agent-id={agentId.cta("cv")}
          data-intro-tone="cta"
          data-magnet=""
        >
          <DownloadIcon /> CV
        </a>
      </div>
    </header>
  );
}
