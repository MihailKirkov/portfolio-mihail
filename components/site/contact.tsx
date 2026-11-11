import type { Profile } from "@/lib/types";
import {
  DownloadIcon,
  EmailIcon,
  GithubIcon,
  LinkedinIcon,
} from "@/components/site/icons";
import { Section } from "@/components/site/section";
import { agentId } from "@/lib/agent/targets";

export function Contact({ profile }: { profile: Profile }) {
  return (
    <Section id="contact" label="06 / contact" title="Contact">
      <ul className="hero-status">
        <li className="label">{profile.availability}</li>
      </ul>
      <div className="contact-links">
        <a
          className="btn btn-primary"
          href={profile.cv_url}
          download="Mihail-Kirkov-CV.pdf"
          data-agent-id={agentId.cta("cv-contact")}
          data-magnet=""
        >
          <DownloadIcon /> CV
        </a>
        <a className="btn" href={`mailto:${profile.email}`} data-agent-id={agentId.cta("email")}>
          <EmailIcon /> {profile.email}
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
    </Section>
  );
}
