"use client";

import { Fragment, useEffect, useRef } from "react";
import { Gallery } from "@/components/projects/gallery";
import { agentId } from "@/lib/agent/targets";
import type { StageProject } from "@/components/projects/depth-stage";
import { showModalReturningFocus } from "@/lib/dialog";

// The depth stage's detail overlay: a full-viewport modal with the long
// description, stack, links and the gallery. Nothing on the stage scrolls;
// this is where the long content lives. `gallery` opens the gallery's own
// full-viewport viewer on top as soon as it mounts (show_gallery).

export function ProjectOverlay({
  project,
  gallery,
  onClose,
}: {
  project: StageProject;
  gallery: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    showModalReturningFocus(d);
    if (gallery) {
      d.querySelector<HTMLElement>(`[data-agent-id="${agentId.gallery(project.slug)}"]`)?.click();
    }
  }, [project.slug, gallery]);

  return (
    <dialog
      ref={ref}
      className="project-overlay"
      aria-labelledby="project-overlay-title"
      onClose={(e) => {
        // the gallery's own viewer is a dialog nested inside this one
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="project-overlay-inner">
        <header className="project-overlay-head">
          <div>
            <p className="label">
              {project.number} / {project.role} / {project.period}
            </p>
            <h3 id="project-overlay-title" className="project-title">
              {project.title}
            </h3>
          </div>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            close
          </button>
        </header>
        <div className="project-overlay-body">
          <div className="project-text">
            <p className="project-lead">{project.shortDescription}</p>
            {project.longDescription.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <ul className="tags" aria-label="Stack">
              {project.stack.map((s) => (
                <li key={s} className="tag">
                  {s}
                </li>
              ))}
            </ul>
            <ProjectLinks project={project} />
          </div>
          <Gallery slug={project.slug} title={project.title} gallery={project.gallery} />
        </div>
      </div>
    </dialog>
  );
}

/** live / repo buttons; `bare` leaves out the wrapper to join another .links row */
export function ProjectLinks({ project, bare }: { project: StageProject; bare?: boolean }) {
  if (!project.live && !project.repo) return null;
  const Wrap = bare ? Fragment : "div";
  return (
    <Wrap {...(bare ? {} : { className: "links" })}>
      {project.live && (
        <a
          className="btn"
          href={project.live}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`live: ${project.title} (opens in new tab)`}
        >
          live <span aria-hidden="true">↗</span>
        </a>
      )}
      {project.repo && (
        <a
          className="btn"
          href={project.repo}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`repo: ${project.title} source code (opens in new tab)`}
        >
          repo <span aria-hidden="true">↗</span>
        </a>
      )}
    </Wrap>
  );
}
