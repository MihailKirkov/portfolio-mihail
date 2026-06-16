import { getContent } from "@/lib/content";
import { HudRoot } from "@/components/hud/hud-root";

// Statically generated at build time; content is baked into the HTML.
export const dynamic = "force-static";

export default async function Home() {
  const content = await getContent();
  return <HudRoot content={content} />;
}
