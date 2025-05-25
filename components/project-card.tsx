"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Eye, Github } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Project } from "@/services/projects"
import ProjectDialog from "./dialogs/project-dialog"



export function ProjectCard(project: Project) {
  const { title, summary, description, tags, image, link_code, link_preview } = project;
  const [isHovered, setIsHovered] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
    <motion.div
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm"
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={image || "/placeholder.svg"}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      </div>
      <div className="relative z-10 p-6">
        <h3 className="mb-2 text-xl font-bold">{title}</h3>
        <p className="mb-4 text-sm font-light text-white/70">{summary}</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="border-white/20 text-xs font-light">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-3">
          <Link href={link_code} className="cursor-pointer">
            <Button variant="ghost" size="sm" className="rounded-full border border-white/20 px-4">
              <Github className="mr-2 h-4 w-4" />
              Code
            </Button>
          </Link>

          <Link href={link_preview} className="inline-block cursor-pointer">
            <Button size="sm" className="rounded-full bg-white px-4 text-black hover:bg-white/90">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </Link>

          <Button size="sm" variant="link" className="text-xs ml-auto" onClick={() => {console.log('setIsDialogOpen!');setIsDialogOpen(!isDialogOpen)}}>
            <Eye/>
            Read more
          </Button>
        </div>
      </div>
      <motion.div
        className="absolute inset-0 rounded-3xl border-2 border-transparent pointer-events-none"
        animate={{
          borderColor: isHovered ? "rgba(168, 85, 247, 0.5)" : "rgba(255, 255, 255, 0)",
        }}
        transition={{ duration: 0.3 }}
      ></motion.div>
    </motion.div>
    {isDialogOpen && (
        <ProjectDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          project={project}
        />
      )}
    </>
  )
}
