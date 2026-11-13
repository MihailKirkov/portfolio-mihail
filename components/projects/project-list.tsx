import type { Project } from "@/lib/types";
import type { SectionId } from "@/lib/agent/targets";
import { Gallery, GalleryImage } from "@/components/projects/gallery";
import { ProjectFilter } from "@/components/projects/project-filter";
import { DepthStage, type StageProject } from "@/components/projects/depth-stage";
import { agentId } from "@/lib/agent/targets";

// Project chapters. This server markup is the plain vertical list (JS off,
// under 768px, reduced motion): the long description sits in a native
// <details> that the agent's open_project expands. DepthStage turns the same
// list into the scroll-driven depth stage: each item then shows only its slab
// (the first gallery image), the front project's text moves to a flat panel
// and the long content to a full-viewport overlay.

function hasUrl(u?: string): u is string {
  return !!u && u.trim() !== "" && u.trim() !== "#";
}

export function ProjectList({
  projects,
  skipTo,
}: {
  projects: Project[];
  /** the section after projects, for the rail's skip link */
  skipTo: SectionId;
}) {
  const ordered = [...projects].sort((a, b) => a.sort_order - b.sort_order);
  const stage: StageProject[] = ordered.map((p, n) => ({
    slug: p.slug,
    number: String(n + 1).padStart(2, "0"),
    title: p.title,
    role: p.role,
    period: p.period,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    stack: p.stack,
    gallery: p.gallery,
    live: hasUrl(p.links?.live) ? p.links.live : undefined,
    repo: hasUrl(p.links?.repo) ? p.links.repo : undefined,
  }));

  const rail = (
    <nav className="chapter-rail" aria-label="Project chapters">
      <a className="chapter-skip label" href={`#${skipTo}`}>
        skip projects ↓
      </a>
      <ol>
        {stage.map((p, n) => (
          <li key={p.slug}>
            <a
              href={`#project-${p.slug}`}
              data-chapter-link={n}
              data-project-tags={p.stack.join("|")}
            >
              <span className="label">{p.number}</span>
              <span className="chapter-rail-title">{p.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    <>
      <ProjectFilter />
      <DepthStage projects={stage} rail={rail}>
        <ol className="projects">
          {stage.map((p) => (
            <li
              key={p.slug}
              id={`project-${p.slug}`}
              className="project"
              data-depth-chapter
              data-agent-id={agentId.project(p.slug)}
              data-project-tags={p.stack.join("|")}
            >
              {/* depth stage only: the image slab; the panel's "details" is its keyboard route */}
              <button
                type="button"
                className="slab"
                data-slab={p.slug}
                tabIndex={-1}
                aria-hidden
              >
                {p.gallery[0] ? (
                  <GalleryImage
                    src={p.gallery[0]}
                    alt=""
                    sizes="(max-width: 1200px) 55vw, 640px"
                    fit="cover"
                  />
                ) : (
                  <span className="slab-title">{p.title}</span>
                )}
              </button>

              <div className="project-head">
                <span className="label">{p.number}</span>
                <h3 className="project-title" data-agent-aim>
                  {p.title}
                </h3>
                <span className="label">
                  {p.role} / {p.period}
                </span>
              </div>

              <div className="project-body">
                <div className="project-text">
                  <p className="project-lead">{p.shortDescription}</p>
                  <details className="project-detail">
                    <summary data-agent-id={agentId.projectDetail(p.slug)}>
                      <span className="label">details</span>
                    </summary>
                    {p.longDescription.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </details>
                  <ul className="tags" aria-label="Stack">
                    {p.stack.map((s) => (
                      <li key={s} className="tag">
                        {s}
                      </li>
                    ))}
                  </ul>
                  {(p.repo || p.live) && (
                    <div className="links">
                      {p.live && (
                        <a
                          className="btn"
                          href={p.live}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`live: ${p.title} (opens in new tab)`}
                        >
                          live <span aria-hidden="true">↗</span>
                        </a>
                      )}
                      {p.repo && (
                        <a
                          className="btn"
                          href={p.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`repo: ${p.title} source code (opens in new tab)`}
                        >
                          repo <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <Gallery slug={p.slug} title={p.title} gallery={p.gallery} />
              </div>
            </li>
          ))}
        </ol>
      </DepthStage>
    </>
  );
}
