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
  name: string;
  period: string;
  description: string;
  stack: string[];
  link: string;
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
  languages: Language[];
  terminal: TerminalConfig;
}
