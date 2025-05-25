import React from 'react'
import { HeroParticles } from '../hero-particles';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';

const HeroSection = () => {
    return (
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
            <HeroParticles />
            <div className="container relative z-10 flex flex-col items-center justify-center gap-8 text-center">
            <div className="inline-block rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-4 py-1 text-xs font-light tracking-wider">
                Full Stack Developer
            </div>
            <h1 className="max-w-4xl bg-gradient-to-br from-white to-white/60 bg-clip-text text-6xl font-bold tracking-tighter text-transparent sm:text-7xl md:text-8xl">
                Mihail Kirkov
            </h1>
            <p className="max-w-xl text-lg font-light leading-relaxed text-white/70">
                I build innovative web applications with cutting-edge technologies, focusing on performance, accessibility,
                and user experience.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button className="group rounded-full bg-white px-6 text-black hover:bg-white/90">
                View Projects
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button variant="outline" className="rounded-full border-white/20 px-6">
                Contact Me
                </Button>
            </div>
            </div>
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
            <div className="flex animate-bounce items-center gap-2 text-sm font-light text-white/50">
                <span>Scroll to explore</span>
                <ArrowRight className="h-4 w-4 rotate-90" />
            </div>
            </div>
        </section>
    );
}
export default HeroSection