import React from 'react'
import { SkillsShowcase } from '../skills-showcase'
import { Button } from '@/components/ui/button';
import { Coffee, Github, Linkedin, Twitter } from 'lucide-react';
import Link from 'next/link';

const AboutSection = () => {
    return (
        <section id="about" className="py-32">
            <div className="container">
                <div className="mb-16 flex flex-col items-center">
                    <h2 className="text-5xl font-bold tracking-tighter">About Me</h2>
                    <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"></div>
                </div>
                <div className="grid gap-16 md:grid-cols-2">
                    <div className="flex flex-col justify-center space-y-6">
                        <p className="text-lg font-light leading-relaxed text-white/70">
                            I love working with React and TypeScript on the frontend, and I’m just as comfortable on the backend with tools like Node.js, PHP, or Python. I care about writing clean, maintainable code and designing smooth experiences that people actually enjoy using.
                        </p>
                        <p className="text-lg font-light leading-relaxed text-white/70">
                            I started coding when I was 10, attending C++ classes for about five years. During that time, I even assisted my teacher in running a C# summer course. Afterward, I completed courses in Python and full-stack web development, which solidified my passion for building complete applications—from backend to frontend.
                        </p>
                        <div className="flex gap-4">
                        <Link href="https://github.com/MihailKirkov" target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="rounded-full border border-white/20">
                            <Github className="h-5 w-5" />
                            <span className="sr-only">GitHub</span>
                            </Button>
                        </Link>
                        <Link href="https://www.linkedin.com/in/mihail-kirkov-b65b36262/" target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="rounded-full border border-white/20">
                            <Linkedin className="h-5 w-5" />
                            <span className="sr-only">LinkedIn</span>
                            </Button>
                        </Link>
                    </div>
                </div>
                <div>
                    <SkillsShowcase />
                </div>
                </div>
            </div>
        </section>
    )
}

export default AboutSection