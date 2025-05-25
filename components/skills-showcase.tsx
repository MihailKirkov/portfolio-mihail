"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

const skills = [
  { name: "JavaScript", level: 95 },
  { name: "TypeScript", level: 95 },
  { name: "React", level: 92 },
  { name: "Next.js", level: 82 },
  { name: "Node.js", level: 85 },
  { name: "SQL", level: 95 },
  { name: "CSS/SCSS", level: 90 },
  { name: "Tailwind CSS", level: 95 },
  { name: "AWS", level: 75 },
  { name: "Docker", level: 78 },
  { name: "Python", level: 80 },
  { name: "Git", level: 95 },
  { name: "UI/UX Design", level: 85 },
]

export function SkillsShowcase() {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsInView(true)
    }, 500)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
      <h3 className="text-2xl font-bold">Technical Skills</h3>
      <div className="grid gap-6 sm:grid-cols-2">
        {skills.map((skill, index) => (
          <div key={skill.name} className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">{skill.name}</span>
              <span className="text-xs text-white/70">{skill.level}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: isInView ? `${skill.level}%` : 0 }}
                transition={{ duration: 1, delay: index * 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
