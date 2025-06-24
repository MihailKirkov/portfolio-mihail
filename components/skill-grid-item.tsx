import { useState } from "react"
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function SkillGridItem({ skill, index }: { skill: any; index: number }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const span = skill.gridSpan || { col: 1, row: 1 };
  
  function handleMouseEnter() {
    if (!isAnimating) {
      setIsAnimating(true)
    }
  }

  function handleAnimationEnd() {
    setIsAnimating(false)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        
        <motion.div
          className="group relative flex items-center justify-center overflow-hidden rounded-sm p-4 transition duration-300"
          onMouseEnter={handleMouseEnter}
          onAnimationEnd={handleAnimationEnd}
          // style={{ gridColumn: `span ${skill.gridSpan?.col || 1}`, gridRow: `span ${skill.gridSpan?.row || 1}` }}
          style={{
            gridColumn: `span ${span.col}`,
            gridRow: `span ${span.row}`,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 z-0 rounded-xl bg-gradient-to-br from-purple-500 via-[#100936] to-cyan-500 opacity-20 group-hover:opacity-100 transition-all duration-500 blur-sm" />

          {/* Light beam effect */}
          <div
            className={`pointer-events-none absolute -inset-0.5 z-10 bg-gradient-to-r from-transparent via-white/30 to-transparent ${
              isAnimating ? "animate-light-sweep-diagonal opacity-100" : "opacity-0"
            } [mask-image:linear-gradient(to_right,transparent,white,transparent)] transition-opacity duration-300`}
          />


          {/* Icon */}
          <div className="relative z-20 text-5xl transition-transform duration-500 group-hover:scale-125" style={{ color: skill.color }}>
            <skill.icon />
          </div>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>{skill.name}</TooltipContent>
    </Tooltip>
  )
}
