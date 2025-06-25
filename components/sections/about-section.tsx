'use client';

import React from 'react';
import { SkillsShowcase } from '../skills-showcase';
import { Button } from '@/components/ui/button';
import { Github, Linkedin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const AboutSection = () => {
    const t = useTranslations("about");

    return (
        <section id="about" className="py-32">
            <div className="container">
                <div className="mb-16 flex flex-col items-center">
                <h2 className="text-5xl font-bold tracking-tighter">{t("title")}</h2>
                <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"></div>
                </div>
                <div className="grid gap-16 md:grid-cols-2">
                <div className="flex flex-col justify-center space-y-6">
                    <p className="text-lg font-light leading-relaxed text-white/70">
                    {t("paragraph1")}
                    </p>
                    <p className="text-lg font-light leading-relaxed text-white/70">
                    {t("paragraph2")}
                    </p>
                    <div className="flex gap-4">
                    <Link
                        href="https://github.com/MihailKirkov"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full border border-white/20"
                        >
                        <Github className="h-5 w-5" />
                        <span className="sr-only">{t("github")}</span>
                        </Button>
                    </Link>
                    <Link
                        href="https://www.linkedin.com/in/mihail-kirkov-b65b36262/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full border border-white/20"
                        >
                        <Linkedin className="h-5 w-5" />
                        <span className="sr-only">{t("linkedin")}</span>
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
    );
};

export default AboutSection;
