'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { HeroParticles } from '../hero-particles';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';

const HeroSection = () => {
  const t = useTranslations('hero');

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
      <HeroParticles />
      <div className="container relative z-10 flex flex-col items-center justify-center gap-4 sm:gap-6 md:gap-8 text-center">
        <div className="inline-block rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-4 py-1 text-xs font-light tracking-wider">
          {t('role')}
        </div>
        <h1 className="bg-gradient-to-br from-white to-white/60 bg-clip-text font-bold tracking-tighter text-transparent max-w-4xl text-4xl sm:text-5xl md:text-6xl">
          {t('title')}
        </h1>
        <p className="max-w-xl text-md md:text-lg font-light leading-relaxed text-white/70">
          {t('description')}
        </p>
        <div className="sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          <a href="#projects">
            <Button className="group rounded-full bg-white px-6 text-black hover:bg-white/90">
              {t('viewProjects')}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </a>
          <a href="#contact">
            <Button variant="outline" className="rounded-full border-white/20 px-6">
              {t('contact')}
            </Button>
          </a>
        </div>
      </div>
      <div className="absolute bottom-0 sm:bottom-4 md:bottom-10 left-0 right-0 flex justify-center">
        <div className="flex animate-bounce items-center gap-2 text-sm font-light text-white/50">
          <span>{t('scroll')}</span>
          <ArrowRight className="h-4 w-4 rotate-90" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
