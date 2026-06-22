"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Project } from "@/lib/types";

// Full-screen holographic project deck. Replaces the small modal for the
// Projects node only: a grid of bracketed "monitor-frame" HUD cards (featured
// first/larger) that stagger-project in, each expanding into a detail view with
// a keyboard-navigable gallery carousel. Images live under /public/projects/
// <slug>/ and lazy-load via next/image only once this component mounts (on open).

function hasUrl(u?: string): u is string {
  return !!u && u.trim() !== "" && u.trim() !== "#";
}

// ---- holographic placeholder for empty galleries --------------------------
function HoloPlaceholder({ label = "no preview feed" }: { label?: string }) {
  return (
    <div className="pholo" aria-hidden="true">
      <div className="pholo-grid" />
      <div className="pholo-mark">◳</div>
      <div className="pholo-lbl">{label}</div>
    </div>
  );
}

// ---- a single grid card ---------------------------------------------------
function ProjectCard({
  project,
  index,
  reduce,
  onOpen,
}: {
  project: Project;
  index: number;
  reduce: boolean;
  onOpen: () => void;
}) {
  const { title, period, role, shortDescription, stack, gallery, links } =
    project;
  const repo = hasUrl(links?.repo) ? links.repo : undefined;
  const live = hasUrl(links?.live) ? links.live : undefined;

  return (
    <motion.article
      className={`pcard${project.featured ? " featured" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.5, delay: 0.12 + index * 0.09, ease: [0.2, 0.8, 0.2, 1] }
      }
    >
      <button
        type="button"
        className="pcard-main"
        onClick={onOpen}
        aria-label={`Open ${title} details`}
      >
        <span className="pcard-hero">
          {gallery.length > 0 ? (
            <>
              <Image
                src={gallery[0]}
                alt={`${title} screenshot`}
                fill
                sizes="(max-width: 780px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
              {gallery.length > 1 && (
                <span className="pcard-count">⧉ {gallery.length}</span>
              )}
            </>
          ) : (
            <HoloPlaceholder />
          )}
        </span>

        <span className="pcard-text">
          <span className="pcard-titlerow">
            <span className="pcard-title">{title}</span>
            <span className="pcard-meta">{period}</span>
          </span>
          <span className="pcard-role">{role}</span>
          <span className="pcard-desc">{shortDescription}</span>
          <span className="pcard-chips">
            {stack.map((s) => (
              <span key={s} className="pchip">
                {s}
              </span>
            ))}
          </span>
        </span>
      </button>

      <div className="pcard-links">
        {repo && (
          <a
            className="btn-ghost"
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} source code (opens in new tab)`}
          >
            repo ↗
          </a>
        )}
        {live && (
          <a
            className="btn-ghost"
            href={live}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} live site (opens in new tab)`}
          >
            live ↗
          </a>
        )}
        <button type="button" className="pcard-cta" onClick={onOpen}>
          details →
        </button>
      </div>
    </motion.article>
  );
}

function isExternalImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

function GalleryImage({
  src,
  alt,
  fill,
  sizes,
  style,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  style?: Record<string, string | number | undefined>;
  loading?: "lazy" | "eager";
}) {
  if (isExternalImage(src)) {
    console.log('external image: ', src)
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        style={{
          ...style,
          width: fill ? "100%" : undefined,
          height: fill ? "100%" : undefined,
        }}
      />
    );
  }
  console.log ('not')

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      style={style}
      loading={loading}
    />
  );
}

// ---- gallery carousel inside the detail view ------------------------------
function Carousel({ title, gallery }: { title: string; gallery: string[] }) {
  const [i, setI] = useState(0);
  const count = gallery.length;
  const go = useCallback(
    (n: number) => setI((p) => (count ? (p + n + count) % count : 0)),
    [count]
  );

  useEffect(() => {
    if (count < 2) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, count]);

  if (count === 0) {
    return (
      <div className="pdetail-stage">
        <HoloPlaceholder label="screenshots coming soon" />
      </div>
    );
  }

  return (
    <div className="pcarousel">
      <div className="pdetail-stage">
        <GalleryImage
          key={gallery[i]}
          src={gallery[i]}
          alt={`${title} screenshot ${i + 1} of ${count}`}
          fill
          sizes="(max-width: 780px) 100vw, 70vw"
          style={{ objectFit: "contain" }}
          loading="lazy"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              className="pcar-nav prev"
              onClick={() => go(-1)}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              className="pcar-nav next"
              onClick={() => go(1)}
              aria-label="Next image"
            >
              ›
            </button>
            <span className="pcar-count" aria-live="polite">
              {i + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="pcar-thumbs" role="tablist" aria-label="Gallery thumbnails">
          {gallery.map((g, n) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Show image ${n + 1}`}
              className={`pcar-thumb${n === i ? " on" : ""}`}
              onClick={() => setI(n)}
            >
              <GalleryImage
                src={g}
                alt=""
                fill
                sizes="80px"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- detail view ----------------------------------------------------------
function ProjectDetail({
  project,
  reduce,
  onBack,
}: {
  project: Project;
  reduce: boolean;
  onBack: () => void;
}) {
  const repo = hasUrl(project.links?.repo) ? project.links.repo : undefined;
  const live = hasUrl(project.links?.live) ? project.links.live : undefined;

  return (
    <motion.div
      className="pdetail"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <button type="button" className="btn-ghost pdetail-back" onClick={onBack}>
        ← all projects
      </button>

      <Carousel title={project.title} gallery={project.gallery} />

      <div className="pdetail-body">
        <div className="pdetail-titlerow">
          <h4 className="pdetail-title">{project.title}</h4>
          <span className="pdetail-meta">
            {project.role} · {project.period}
          </span>
        </div>

        {project.longDescription.split("\n\n").map((para, n) => (
          <p key={n} className="pdetail-para">
            {para}
          </p>
        ))}

        <div className="head" style={{ marginTop: 16 }}>
          stack
        </div>
        <div className="pcard-chips" style={{ marginTop: 6 }}>
          {project.stack.map((s) => (
            <span key={s} className="pchip">
              {s}
            </span>
          ))}
        </div>

        {(repo || live) && (
          <div className="pdetail-links">
            {repo && (
              <a
                style={{color: "red !important", borderColor: "red !important"}}
                className="btn-ghost"
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} source code (opens in new tab)`}
              >
                repo ↗
              </a>
            )}
            {live && (
              <a
                className="btn-ghost"
                href={live}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} live site (opens in new tab)`}
              >
                live ↗
              </a>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---- the deck overlay -----------------------------------------------------
export function ProjectDeck({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // featured first, then by sort_order
  const ordered = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order
      ),
    [projects]
  );
  const active = ordered.find((p) => p.slug === activeSlug) ?? null;

  const handleClose = useCallback(() => {
    setShow(false);
    restoreRef.current?.focus();
    setTimeout(onClose, 280);
  }, [onClose]);

  // mount: remember opener, project in, focus the close button
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, []);

  // ESC (back to grid from detail, else close) + focus trap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (activeSlug) setActiveSlug(null);
        else handleClose();
        return;
      }
      if (e.key === "Tab") {
        const root = rootRef.current;
        if (!root) return;
        const f = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSlug, handleClose]);

  return (
    <>
      <div
        className={`deck-backdrop${show ? " show" : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={rootRef}
        className={`deck${show ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Projects"
      >
        <div className="deck-head">
          <div className="deck-title">
            <span className="deck-title-main">projects</span>
            <span className="deck-title-sub">
              // {ordered.length} builds
              {active ? ` · ${active.title.toLowerCase()}` : ""}
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="deck-x"
            onClick={handleClose}
            aria-label="Close projects"
          >
            ✕
          </button>
        </div>

        <div className="deck-body">
          {active ? (
            <ProjectDetail
              project={active}
              reduce={reduce}
              onBack={() => setActiveSlug(null)}
            />
          ) : (
            <div className="deck-grid">
              {ordered.map((p, i) => (
                <ProjectCard
                  key={p.slug}
                  project={p}
                  index={i}
                  reduce={reduce}
                  onOpen={() => setActiveSlug(p.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
