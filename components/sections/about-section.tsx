import React from 'react'
import { SkillsShowcase } from '../skills-showcase'
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Twitter } from 'lucide-react';
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
                    I'm a passionate developer with a keen eye for design and a love for creating seamless user experiences.
                    With expertise in both frontend and backend technologies, I bring ideas to life through clean, efficient
                    code.
                    </p>
                    <p className="text-lg font-light leading-relaxed text-white/70">
                    My approach combines technical excellence with creative problem-solving, resulting in applications that
                    are not only functional but also intuitive and engaging.
                    </p>
                    <div className="flex gap-4">
                    <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="rounded-full border border-white/20">
                        <Github className="h-5 w-5" />
                        <span className="sr-only">GitHub</span>
                        </Button>
                    </Link>
                    <Link href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="rounded-full border border-white/20">
                        <Linkedin className="h-5 w-5" />
                        <span className="sr-only">LinkedIn</span>
                        </Button>
                    </Link>
                    <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="rounded-full border border-white/20">
                        <Twitter className="h-5 w-5" />
                        <span className="sr-only">Twitter</span>
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