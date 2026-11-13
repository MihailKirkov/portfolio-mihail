import type { Profile } from "@/lib/types";
import {
  DownloadIcon,
  GithubIcon,
  LinkedinIcon,
} from "@/components/site/icons";
import { Section } from "@/components/site/section";
import { CoreSlot } from "@/components/core/core-slot";
import { EmailLink } from "@/components/site/email-link";
import { CoreStill } from "@/components/core/core-still";
import { Finale } from "@/components/site/finale";
import type { FinaleItem } from "@/components/site/finale-orbit";
import { agentId } from "@/lib/agent/targets";

// The closing scene (V3-PLAN Round 2, part 3): the core large at the centre
// (components/core/core-slot.tsx) with the finale orbit round it
// (components/site/finale.tsx), then the headline, the email as a large
// click-to-copy link, the CV as the primary action and the profiles as
// secondary links. offer_contact lands on the email.
export function Contact({
  profile,
  images,
  skills,
}: {
  profile: Profile;
  images: FinaleItem[];
  skills: string[];
}) {
  return (
    <Section id="contact" title="Contact">
      <div className="contact">
        <div className="contact-stage">
          <CoreSlot spot="contact" className="contact-core" />
          {/* the fallback (phones, reduced motion): a static large core */}
          <span className="contact-still" aria-hidden="true">
            <CoreStill />
          </span>
        </div>
        <div className="contact-main">
          <p className="contact-headline">{profile.contact_headline}</p>
          <ul className="hero-status">
            <li className="label">{profile.availability}</li>
          </ul>
          <div className="contact-email">
            <EmailLink email={profile.email} />
            <Finale images={images} skills={skills} />
          </div>
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
      </div>
    </Section>
  );
}
