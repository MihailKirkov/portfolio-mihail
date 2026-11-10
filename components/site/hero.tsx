import type { Content } from "@/lib/types";
import { CssCore } from "@/components/core/reactor-core";
import { CommandBar } from "@/components/agent/command-bar";
import { agentId } from "@/lib/agent/targets";
import { SkipIntroButton } from "@/components/intro/boot-script";

export function Hero({ content }: { content: Content }) {
  const { profile } = content;
  return (
    <section id="hero" className="hero" data-agent-id={agentId.section("hero")}>
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="label" data-intro-part="label" data-intro-tone="label">
            {profile.name} / {profile.tagline}
          </p>
          <h1 className="hero-title" data-intro-part="headline" data-intro-tone="headline">{profile.headline}</h1>
          <p className="hero-sub" data-intro-part="sub" data-intro-tone="sub">{profile.subhead}</p>
          <ul className="hero-status" data-intro-part="status" data-intro-tone="status">
            <li className="label">{profile.availability}</li>
          </ul>
          <div className="hero-core" data-intro-part="core">
            <CssCore />
          </div>
        </div>
        <CommandBar config={content.terminal} />
      </div>
      <SkipIntroButton />
    </section>
  );
}
