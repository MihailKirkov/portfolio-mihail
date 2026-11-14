import { getContent } from "@/lib/content";
import { buildSections } from "@/lib/sections";
import { uniqueSkills } from "@/lib/skills";
import { TopBar } from "@/components/site/top-bar";
import { Hero } from "@/components/site/hero";
import { Section } from "@/components/site/section";
import { Contact } from "@/components/site/contact";
import { ProjectList } from "@/components/projects/project-list";
import { CursorLayer } from "@/components/agent/cursor-lazy";
import { BootIntro } from "@/components/intro/intro-lazy";
import { PointerEffects } from "@/components/site/pointer-effects-lazy";
import { Narrator } from "@/components/site/narrator";
import { LimeStream } from "@/components/site/lime-stream-lazy";

// Statically generated at build time; content is baked into the HTML.
export const dynamic = "force-static";

export default async function Home() {
  const content = await getContent();
  const sections = buildSections(content);

  return (
    <>
      <LimeStream />
      <TopBar profile={content.profile} />
      <main>
        <Hero content={content} />
        <Section id="projects" title="Projects">
          <ProjectList projects={content.projects} skipTo={sections[0]?.key ?? "contact"} />
        </Section>
        {sections.map((s) => (
          <Section key={s.key} id={s.key} title={s.title}>
            {s.body}
          </Section>
        ))}
        <Contact
          profile={content.profile}
          images={content.projects
            .filter((p) => p.gallery[0])
            .map((p) => ({ slug: p.slug, src: p.gallery[0] }))}
          skills={uniqueSkills(content.skill_groups).slice(0, 6).map((s) => s.name)}
        />
      </main>
      <CursorLayer />
      <BootIntro />
      <PointerEffects />
      <Narrator narration={content.narration} />
    </>
  );
}
