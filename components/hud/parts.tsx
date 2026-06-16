"use client";

// Small shared HUD pieces used across all three layout modes so the brand,
// socials, and CV button stay identical no matter which mode is active.

import type { Profile } from "@/lib/types";
import {
  GithubIcon,
  LinkedinIcon,
  EmailIcon,
  DownloadIcon,
} from "@/components/hud/icons";

export function Brand({ profile }: { profile: Profile }) {
  return (
    <div className="brand" style={{ left: 0, top: 2 }}>
      <div className="mono">MK</div>
      <div>
        <h1>{profile.name.toUpperCase()}</h1>
        <div className="sub">{profile.tagline}</div>
      </div>
    </div>
  );
}

export function CvLink({ profile }: { profile: Profile }) {
  return (
    <a className="cv" href={profile.cv_url} download>
      <DownloadIcon /> CV
    </a>
  );
}

export function Socials({ profile }: { profile: Profile }) {
  return (
    <>
      <a
        className="ico"
        href={profile.social.github}
        aria-label="GitHub"
        target="_blank"
        rel="noopener noreferrer"
      >
        <GithubIcon />
      </a>
      <a
        className="ico"
        href={profile.social.linkedin}
        aria-label="LinkedIn"
        target="_blank"
        rel="noopener noreferrer"
      >
        <LinkedinIcon />
      </a>
      <a className="ico" href={`mailto:${profile.email}`} aria-label="Email">
        <EmailIcon />
      </a>
    </>
  );
}
