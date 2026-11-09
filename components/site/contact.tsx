import type { Profile } from "@/lib/types";
import {
  DownloadIcon,
  EmailIcon,
  GithubIcon,
  LinkedinIcon,
} from "@/components/site/icons";
import { Section } from "@/components/site/section";

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
          data-agent-id="cta:cv-contact"
        >
          <DownloadIcon /> CV
        </a>
        <a className="btn" href={`mailto:${profile.email}`} data-agent-id="cta:email">
          <EmailIcon /> {profile.email}
        </a>
        <a
          className="btn"
          href={profile.social.github}
          target="_blank"
          rel="noopener noreferrer"
          data-agent-id="cta:github"
        >
          <GithubIcon /> GitHub
        </a>
        <a
          className="btn"
          href={profile.social.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          data-agent-id="cta:linkedin"
        >
          <LinkedinIcon /> LinkedIn
        </a>
      </div>
    </Section>
  );
}
