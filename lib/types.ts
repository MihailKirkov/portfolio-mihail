export interface Profile {
  name: string;
  title: string;
  tagline: string;
  summary: string;
  pitch: string;
  location_current: string;
  location_target: string;
  availability: string;
  eligibility_note: string;
  email: string;
  phone: string | null;
  cv_url: string;
  social: {
    github: string;
    linkedin: string;
    portfolio: string;
  };
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
  sort_order: number;
}

export interface Project {
  id: string;
  /** url-safe id; also the folder name under /public/projects/<slug>/ */
  slug: string;
  name: string;
  title: string;
  period: string;
  role: string;
  /** kept for the deck-status readout in chrome.tsx + fallbacks */
  description: string;
  shortDescription: string;
  /** narrative: problem -> approach -> outcome */
  longDescription: string;
  stack: string[];
  /** legacy single link, kept for backwards compat */
  link: string;
  links: { repo?: string; live?: string };
  /** image paths under /public/projects/<slug>/ — may be empty */
  gallery: string[];
  featured: boolean;
  sort_order: number;
}

export interface SkillGroup {
  id: string;
  label: string;
  items: string[];
  sort_order: number;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  note: string;
  sort_order: number;
}

export interface Education {
  id: string;
  institution: string;
  focus: string;
  credential_line: string;
  period: string;
  sort_order: number;
}

export interface Competitive {
  id: string;
  lines: string[];
}

export interface TimelineEntry {
  id: string;
  date: string;
  label: string;
  sort_order: number;
}

export interface Language {
  id: string;
  name: string;
  level: string;
  sort_order: number;
}

export interface TerminalConfig {
  greeting: string;
  suggestions: string[];
}

export interface Content {
  profile: Profile;
  experiences: Experience[];
  projects: Project[];
  skill_groups: SkillGroup[];
  certifications: Certification[];
  education: Education[];
  competitive: Competitive;
  timeline: TimelineEntry[];
  languages: Language[];
  terminal: TerminalConfig;
}
