'use client'

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { skills_lg, skills_md, skills_sm } from "@/data/skills"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { SkillGridItem } from "./skill-grid-item"
import { BarChart, LayoutGrid } from "lucide-react"
import { Button } from "./ui/button"
import LoadingSpinner from './common/loading-spinner'
import { useTranslations } from "next-intl"

export function SkillsShowcase() {
  const t = useTranslations("skillsShowcase")

  const [view, setView] = useState<"progress" | "grid">("grid")
  const [isInView, setIsInView] = useState(false)
  const breakpoint = useBreakpoint()

  const activeSkills =
    breakpoint === "sm"
      ? skills_sm
      : breakpoint === "md"
      ? skills_md
      : skills_lg

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsInView(true)
    }, 300)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-sm sm:text-lg lg:text-xl font-bold">{t("title")}</h3>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Button
              onClick={() => setView("grid")}
              variant={view === "grid" ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-1 p-2 sm:p-4"
            >
              {breakpoint !== "lg" ? (
                <LayoutGrid className="w-4 h-4" />
              ) : (
                t("view.grid")
              )}
            </Button>

            <Button
              onClick={() => setView("progress")}
              variant={view === "progress" ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-1 p-2 sm:p-4"
            >
              {breakpoint !== "lg" ? (
                <BarChart className="w-4 h-4" />
              ) : (
                t("view.progress")
              )}
            </Button>
          </div>
        </div>
      </div>

      {!isInView && <LoadingSpinner text={t("loading")} />}
      
      {view === "progress" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-x-6 sm:gap-y-5 auto-rows-auto">
          {activeSkills.map((skill, index) => (
            <div
              className="flex md:flex-row flex-col md:items-center gap-2 md:gap-4"
              key={`${index}-skill-${skill.name}`}
            >
              <div
                className="w-6 h-6 flex items-center justify-center shrink-0"
                style={{ color: skill.color }}
              >
                <skill.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 w-full md:max-w-[80%] lg:max-w-full overflow-hidden">
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="truncate max-w-[50%] md:max-w-[50%] text-xs">{skill.name}</span>
                  <span className="text-[10px] lg:text-xs rounded-full px-1 py-0.5 bg-muted/30 whitespace-nowrap">
                    {skill.level >= 90
                      ? t("levels.expert")
                      : skill.level >= 75
                      ? t("levels.advanced")
                      : t("levels.intermediate")}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full mt-1">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(to right, ${skill.color}, white)` }}
                    initial={{ width: 0 }}
                    animate={{ width: isInView ? `${skill.level}%` : 0 }}
                    transition={{ duration: 0.8, delay: index * 0.05 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 auto-rows-[minmax(80px,auto)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
        >
          {activeSkills.map((skill, i) => (
            <SkillGridItem key={skill.name} skill={skill} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
