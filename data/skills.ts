import {
  DiReact,
  DiSass,
  DiNodejsSmall,
  DiPython,
  DiHtml5,
  DiCss3,
  DiMysql,
  DiPostgresql,
  DiPhp,
  DiLinux,
  DiGithubBadge,
} from "react-icons/di";
import {
  SiTypescript,
  SiNextdotjs,
  SiTailwindcss,
  SiDocker,
} from "react-icons/si";
import { IconType } from "react-icons";

export interface Skill {
  name: string;
  level: number;
  icon: IconType;
  color: string;
  gridSpan?: { col: number; row: number };
}

export const skills_lg: Skill[] = [
  { name: "Sass", level: 75, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "GitHub", level: 80, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 68, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 2, row: 2 } },
  { name: "PHP", level: 65, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 1, row: 2 } },
  { name: "React", level: 80, icon: DiReact, color: "#61DBFB", gridSpan: { col: 3, row: 2 } },
  { name: "TypeScript", level: 85, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "Node.js", level: 80, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "Tailwind CSS", level: 85, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 70, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "HTML", level: 85, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "CSS", level: 80, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "MySQL", level: 85, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 85, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 60, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 55, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
];

export const skills_md: Skill[] = [
  { name: "React", level: 75, icon: DiReact, color: "#61DBFB", gridSpan: { col: 2, row: 2 } },
  { name: "GitHub", level: 80, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 68, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 1, row: 2 } },
  { name: "HTML", level: 85, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "TypeScript", level: 85, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "CSS", level: 80, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "Node.js", level: 80, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "PHP", level: 65, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 60, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 55, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 70, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "MySQL", level: 85, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 85, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Sass", level: 75, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "Tailwind CSS", level: 85, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
];

export const skills_sm: Skill[] = [
  { name: "Sass", level: 75, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "GitHub", level: 85, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 85, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 2, row: 2 } },
  { name: "PHP", level: 65, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 1, row: 2 } },
  { name: "React", level: 93, icon: DiReact, color: "#61DBFB", gridSpan: { col: 3, row: 2 } },
  { name: "TypeScript", level: 85, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "Node.js", level: 80, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "Tailwind CSS", level: 85, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 55, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 70, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "HTML", level: 85, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "CSS", level: 80, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "MySQL", level: 85, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 85, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 60, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
];
