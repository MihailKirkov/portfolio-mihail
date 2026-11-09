import { getContent } from "@/lib/content";
import { buildSections } from "@/lib/sections";
import { Hero } from "@/components/site/hero";
import { Section } from "@/components/site/section";
import { Contact } from "@/components/site/contact";
import { ProjectList } from "@/components/projects/project-list";

// Statically generated at build time; content is baked into the HTML.
export const dynamic = "force-static";

export default async function Home() {
  const content = await getContent();
  const sections = buildSections(content);

  return (
    <main>
      <Hero content={content} />
      <Section id="projects" label="02 / projects" title="Projects">
        <ProjectList projects={content.projects} />
      </Section>
      {sections.map((s) => (
        <Section key={s.key} id={s.key} label={s.label} title={s.title}>
          {s.body}
        </Section>
      ))}
      <Contact profile={content.profile} />
    </main>
  );
}
