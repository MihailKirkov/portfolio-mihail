"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Eye, Github } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Project } from "@/types/project"
import ProjectDialog from "./dialogs/project-dialog"

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({project} : ProjectCardProps) {
  const { title, summary, tags, thumbnail, link_code, link_preview } = project;
  const [isHovered, setIsHovered] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm h-full"
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 z-0 cursor-pointer" onClick={() => setIsDialogOpen(true)} />

      {/* IMAGE SECTION */}
      <div className="relative w-full h-48 overflow-hidden z-10 pointer-events-none">
        <Image
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      </div>

      {/*  CONTENT SECTION */}
      <div className="relative z-10 flex flex-col flex-1 p-6" onClick={stopPropagation}>
        <h3 className="mb-2 text-xl font-bold">{title}</h3>
        <p className="mb-4 text-sm font-light text-white/70">{summary}</p>

        {/* Spacer to push tags/buttons to bottom */}
        <div className="mt-auto">
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge key={`${index}-${tag}`} variant="outline" className="border-white/20 text-xs font-light">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex gap-3 md:gap-2 lg:gap-3">
            <Link href={link_code} onClick={stopPropagation} target="_blank">
              <Button variant="ghost" size="sm" className="rounded-full border border-white/20 px-4 md:px-2 lg:px-4" disabled={!link_code}>
                <Github className="mr-2 h-4 w-4" />
                Code
              </Button>
            </Link>

            <Link href={link_preview} onClick={stopPropagation} target="_blank">
              <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90 px-4 md:px-2 lg:px-4">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </Link>

            <Button size="sm" variant="link" className="text-xs ml-auto" onClick={(e) => { stopPropagation(e); setIsDialogOpen(true); }}>
              <Eye />
              Read more
            </Button>
          </div>
        </div>
      </div>

      {/* Hover border */}
      <motion.div
        className="absolute inset-0 rounded-3xl border-2 border-transparent pointer-events-none"
        animate={{
          borderColor: isHovered ? "rgba(168, 85, 247, 0.5)" : "rgba(255, 255, 255, 0)",
        }}
        transition={{ duration: 0.3 }}
      />
      {isDialogOpen && (
        <ProjectDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          project={project}
        />
      )}
    </motion.div>
  )
}
