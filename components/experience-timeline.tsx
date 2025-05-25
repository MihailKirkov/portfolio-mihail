"use client"

import { motion } from "framer-motion"
import { Briefcase } from "lucide-react"

const experiences = [
  {
    id: 1,
    role: "Senior Full Stack Developer",
    company: "TechVision Inc.",
    period: "2022 - Present",
    description:
      "Led the development of a scalable microservices architecture, resulting in a 40% improvement in system performance. Mentored junior developers and implemented CI/CD pipelines.",
    technologies: ["React", "Node.js", "AWS", "Docker", "GraphQL"],
  },
  {
    id: 2,
    role: "Frontend Developer",
    company: "InnovateLabs",
    period: "2020 - 2022",
    description:
      "Developed responsive web applications with modern JavaScript frameworks. Collaborated with UX designers to implement pixel-perfect interfaces and animations.",
    technologies: ["Vue.js", "TypeScript", "SCSS", "Jest", "Webpack"],
  },
  {
    id: 3,
    role: "Web Developer",
    company: "Digital Solutions",
    period: "2018 - 2020",
    description:
      "Built and maintained client websites and e-commerce platforms. Implemented SEO best practices and performance optimizations.",
    technologies: ["JavaScript", "PHP", "MySQL", "WordPress", "jQuery"],
  },
  {
    id: 4,
    role: "Junior Developer",
    company: "StartUp Studio",
    period: "2017 - 2018",
    description:
      "Assisted in the development of web applications and mobile apps. Participated in code reviews and agile development processes.",
    technologies: ["HTML", "CSS", "JavaScript", "React Native", "Firebase"],
  },
]

export function ExperienceTimeline() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-purple-500 to-cyan-500 md:left-1/2 md:-ml-px"></div>

      {/* Experience items */}
      <div className="space-y-12">
        {experiences.map((exp, index) => (
          <motion.div
            key={exp.id}
            className={`relative flex flex-col gap-8 md:flex-row ${index % 2 === 0 ? "md:flex-row-reverse" : ""}`}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-black md:left-1/2">
              <Briefcase className="h-5 w-5 text-purple-500" />
            </div>

            {/* Content */}
            <div className={`w-full md:w-1/2 ${index % 2 === 0 ? "md:pr-16" : "md:pl-16"}`}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xl font-bold">{exp.role}</h3>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-light">{exp.period}</span>
                </div>
                <p className="mb-4 text-lg font-medium text-purple-400">{exp.company}</p>
                <p className="mb-4 text-sm font-light leading-relaxed text-white/70">{exp.description}</p>
                <div className="flex flex-wrap gap-2">
                  {exp.technologies.map((tech) => (
                    <span key={tech} className="rounded-full bg-white/10 px-3 py-1 text-xs font-light text-white/80">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
