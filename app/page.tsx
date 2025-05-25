import Link from "next/link"
import { Code2, Github, Linkedin, Mail, Twitter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExperienceTimeline } from "@/components/experience-timeline"
import Navbar from "@/components/sections/navbar"
import HeroSection from "@/components/sections/hero-section"
import AboutSection from "@/components/sections/about-section"
import ProjectSection from "@/components/sections/project-section"
import ExperienceSection from "@/components/sections/experiene-section"
import ContactSection from "@/components/sections/contact-section"
import Footer from "@/components/sections/footer"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Navbar/>
      <HeroSection/>
      <AboutSection/>
      <ProjectSection/>
      <ExperienceSection/>
      <ContactSection/>
      <Footer/>
    </div>
  )
}
