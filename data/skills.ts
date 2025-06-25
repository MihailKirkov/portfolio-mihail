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
  { name: "Sass", level: 84, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "GitHub", level: 90, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 90, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 2, row: 2 } },
  { name: "PHP", level: 70, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 1, row: 2 } },
  { name: "React", level: 98, icon: DiReact, color: "#61DBFB", gridSpan: { col: 3, row: 2 } },
  { name: "TypeScript", level: 95, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "Node.js", level: 88, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "Tailwind CSS", level: 94, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 85, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "HTML", level: 80, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "CSS", level: 78, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "MySQL", level: 82, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 79, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 85, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 78, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
];

export const skills_md: Skill[] = [
  { name: "React", level: 98, icon: DiReact, color: "#61DBFB", gridSpan: { col: 2, row: 2 } },
  { name: "GitHub", level: 90, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 90, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 1, row: 2 } },
  { name: "HTML", level: 80, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "TypeScript", level: 95, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "CSS", level: 78, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "Node.js", level: 88, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "PHP", level: 70, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 85, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 78, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 85, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "MySQL", level: 82, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 79, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Sass", level: 84, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "Tailwind CSS", level: 94, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
];

export const skills_sm: Skill[] = [
  { name: "Sass", level: 84, icon: DiSass, color: "#CC6699", gridSpan: { col: 1, row: 1 } },
  { name: "GitHub", level: 90, icon: DiGithubBadge, color: "#a0a0a0", gridSpan: { col: 2, row: 1 } },
  { name: "Next.js", level: 90, icon: SiNextdotjs, color: "#ffffff", gridSpan: { col: 2, row: 2 } },
  { name: "PHP", level: 70, icon: DiPhp, color: "#4F5B93", gridSpan: { col: 1, row: 2 } },
  { name: "React", level: 98, icon: DiReact, color: "#61DBFB", gridSpan: { col: 3, row: 2 } },
  { name: "TypeScript", level: 95, icon: SiTypescript, color: "#007acc", gridSpan: { col: 2, row: 1 } },
  { name: "Node.js", level: 88, icon: DiNodejsSmall, color: "#68A063", gridSpan: { col: 1, row: 2 } },
  { name: "Tailwind CSS", level: 94, icon: SiTailwindcss, color: "#38BDF8", gridSpan: { col: 1, row: 1 } },
  { name: "Docker", level: 78, icon: SiDocker, color: "#2496ED", gridSpan: { col: 1, row: 1 } },
  { name: "Python", level: 85, icon: DiPython, color: "#306998", gridSpan: { col: 2, row: 1 } },
  { name: "HTML", level: 80, icon: DiHtml5, color: "#E34F26", gridSpan: { col: 1, row: 1 } },
  { name: "CSS", level: 78, icon: DiCss3, color: "#1572B6", gridSpan: { col: 1, row: 1 } },
  { name: "MySQL", level: 82, icon: DiMysql, color: "#4479A1", gridSpan: { col: 2, row: 1 } },
  { name: "PostgreSQL", level: 79, icon: DiPostgresql, color: "#336791", gridSpan: { col: 2, row: 1 } },
  { name: "Linux", level: 85, icon: DiLinux, color: "#FCC624", gridSpan: { col: 1, row: 1 } },
];