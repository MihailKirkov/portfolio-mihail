import type { CSSProperties } from "react";
import type { Project } from "@/lib/types";
import { Gallery } from "@/components/projects/gallery";
import { ProjectFilter } from "@/components/projects/project-filter";
import { DepthStage } from "@/components/projects/depth-stage";
import { agentId } from "@/lib/agent/targets";

// Project chapters. This server markup is the plain vertical list (JS off,
// under 768px, reduced motion); DepthStage turns the same elements into the
// scroll-driven depth stage with a chapter rail. The long description sits in
// a native <details> (works with JS off) that the agent's open_project expands.

function hasUrl(u?: string): u is string {
  return !!u && u.trim() !== "" && u.trim() !== "#";
}

export function ProjectList({ projects }: { projects: Project[] }) {
  const ordered = [...projects].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <ProjectFilter />
      <DepthStage>
        <div
          className="depth-track"
          style={{ "--n": ordered.length } as CSSProperties}
        >
          <div className="depth-stage">
            <nav className="chapter-rail" aria-label="Project chapters">
              <ol>
                {ordered.map((p, n) => (
                  <li key={p.slug}>
                    <a
                      href={`#project-${p.slug}`}
                      data-chapter-link={n}
                      data-project-tags={p.stack.join("|")}
                    >
                      <span className="label">{String(n + 1).padStart(2, "0")}</span>
                      <span className="chapter-rail-title">{p.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <ol className="projects">
              {ordered.map((p, n) => {
                const repo = hasUrl(p.links?.repo) ? p.links.repo : undefined;
                const live = hasUrl(p.links?.live) ? p.links.live : undefined;
                return (
                  <li
                    key={p.slug}
                    id={`project-${p.slug}`}
                    className="project"
                    data-depth-chapter
                    data-agent-id={agentId.project(p.slug)}
                    data-project-tags={p.stack.join("|")}
                  >
                    <div className="project-head">
                      <span className="label">{String(n + 1).padStart(2, "0")}</span>
                      <h3 className="project-title" data-agent-aim>{p.title}</h3>
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
                        {(repo || live) && (
                          <div className="links">
                            {live && (
                              <a
                                className="btn"
                                href={live}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${p.title} live site (opens in new tab)`}
                              >
                                live ↗
                              </a>
                            )}
                            {repo && (
                              <a
                                className="btn"
                                href={repo}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${p.title} source code (opens in new tab)`}
                              >
                                repo ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <Gallery slug={p.slug} title={p.title} gallery={p.gallery} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </DepthStage>
    </>
  );
}
