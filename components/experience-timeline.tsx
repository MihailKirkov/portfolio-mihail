"use client"

import { motion } from "framer-motion"
import { Briefcase, Computer, Loader2 } from "lucide-react"
import { useExperiences } from "@/hooks/useExperiences";

export function ExperienceTimeline() {
  
  const { experiences, loading, error } = useExperiences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="ml-3 text-sm text-white/70">Loading experience...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-10">
        Failed to load experiences. Please try again later.
      </div>
    );
  }
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-purple-500 to-cyan-500 md:left-1/2 md:-ml-px"></div>

      {/* Experience items */}
      <div className="space-y-12">
        {experiences.map((exp, index) => (
          <motion.div
            key={`${index}-${exp.id}`}
            className={`relative flex flex-col gap-8 md:flex-row ${index % 2 === 0 ? "md:flex-row-reverse" : ""}`}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 flex h-10 w-10 z-20 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-black md:left-1/2">
              <Computer className="h-5 w-5 text-purple-500" />
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
