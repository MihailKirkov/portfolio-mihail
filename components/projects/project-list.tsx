import type { Project } from "@/lib/types";
import { Gallery } from "@/components/projects/gallery";

// Static project chapters. Phase 5 layers the scroll-driven depth stage on
// top; this plain vertical list stays as its mobile / reduced-motion form.

function hasUrl(u?: string): u is string {
  return !!u && u.trim() !== "" && u.trim() !== "#";
}

export function ProjectList({ projects }: { projects: Project[] }) {
  const ordered = [...projects].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ol className="projects">
      {ordered.map((p, n) => {
        const repo = hasUrl(p.links?.repo) ? p.links.repo : undefined;
        const live = hasUrl(p.links?.live) ? p.links.live : undefined;
        return (
          <li
            key={p.slug}
            id={`project-${p.slug}`}
            className="project"
            data-agent-id={`project:${p.slug}`}
          >
            <div className="project-head">
              <span className="label">{String(n + 1).padStart(2, "0")}</span>
              <h3 className="project-title">{p.title}</h3>
              <span className="label">
                {p.role} / {p.period}
              </span>
            </div>

            <div className="project-body">
              <div className="project-text">
                <p className="project-lead">{p.shortDescription}</p>
                {p.longDescription.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
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
              <Gallery title={p.title} gallery={p.gallery} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
