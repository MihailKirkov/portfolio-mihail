import type { Content } from "@/lib/types";
import { CssCore } from "@/components/core/reactor-core";
import { CommandBar } from "@/components/agent/command-bar";
import { agentId } from "@/lib/agent/targets";

export function Hero({ content }: { content: Content }) {
  const { profile } = content;
  return (
    <section id="hero" className="hero" data-agent-id={agentId.section("hero")}>
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
        <CommandBar config={content.terminal} />
      </div>
    </section>
  );
}
