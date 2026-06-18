"use client";

import type { Content } from "@/lib/types";
import type { Section, SectionKey } from "@/lib/sections";
import { Terminal } from "@/components/hud/terminal";
import { DownloadIcon } from "@/components/hud/icons";

export function MobileView({
  content,
  sections,
  onOpen,
}: {
  content: Content;
  sections: Section[];
  onOpen: (key: SectionKey) => void;
}) {
  const { profile } = content;
  return (
    <div className="mobile">
      <div className="mwrap">
        <h1 className="mhead">{profile.name}</h1>
        <p className="msub">{profile.title.toLowerCase()}</p>
        <span className="mpill">2+ yrs production</span>
        <span className="mpill">available aug 2026</span>
        <span className="mpill">eu citizen</span>

        <div className="mlist">
          {sections.map((s) => (
            <button
              key={s.key}
              className="mitem"
              onClick={() => onOpen(s.key)}
            >
              › {s.label}
            </button>
          ))}
        </div>

        <a className="cv" href={profile.cv_url} download="Mihail-Kirkov-CV.pdf">
          <DownloadIcon /> download CV
        </a>
        <a
          className="btn-ghost"
          style={{ marginLeft: 8 }}
          href={`mailto:${profile.email}`}
        >
          book a call
        </a>

        <div
          className="panel term"
          style={{
            position: "relative",
            marginTop: 18,
            height: 320,
            clipPath: "none",
            border: "1px solid var(--line2)",
          }}
        >
          <Terminal config={content.terminal} />
        </div>
      </div>
    </div>
  );
}
