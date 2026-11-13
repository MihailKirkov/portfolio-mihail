import type { Profile } from "@/lib/types";
import {
  DownloadIcon,
  GithubIcon,
  LinkedinIcon,
} from "@/components/site/icons";
import { Section } from "@/components/site/section";
import { CoreSlot } from "@/components/core/core-slot";
import { CopyEmail } from "@/components/site/copy-email";
import { agentId } from "@/lib/agent/targets";

// The closing beat: a large headline, the email as the one big action, the
// CV and profiles as secondary links, and the core coming to rest here
// (components/core/core-slot.tsx). offer_contact lands on the email.
export function Contact({ profile }: { profile: Profile }) {
  return (
    <Section id="contact" title="Contact">
      <div className="contact">
        <div className="contact-main">
          <p className="contact-headline">{profile.contact_headline}</p>
          <ul className="hero-status">
            <li className="label">{profile.availability}</li>
          </ul>
          <div className="contact-email">
            <a
              className="contact-email-link"
              href={`mailto:${profile.email}`}
              data-agent-id={agentId.cta("email")}
            >
              {profile.email}
            </a>
            <CopyEmail email={profile.email} />
          </div>
          <div className="contact-links">
            <a
              className="btn"
              href={profile.cv_url}
              download="Mihail-Kirkov-CV.pdf"
              data-agent-id={agentId.cta("cv-contact")}
              data-magnet=""
            >
              <DownloadIcon /> CV
            </a>
            <a
              className="btn"
              href={profile.social.github}
              target="_blank"
              rel="noopener noreferrer"
              data-agent-id={agentId.cta("github")}
            >
              <GithubIcon /> GitHub
            </a>
            <a
              className="btn"
              href={profile.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              data-agent-id={agentId.cta("linkedin")}
            >
              <LinkedinIcon /> LinkedIn
            </a>
          </div>
        </div>
        <CoreSlot spot="contact" className="contact-core" />
      </div>
    </Section>
  );
}
