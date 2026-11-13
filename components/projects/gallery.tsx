"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { agentId } from "@/lib/agent/targets";
import { showModalReturningFocus } from "@/lib/dialog";

// Project screenshot carousel. Extracted from the v2 project deck; arrow keys
// are scoped to the focused carousel (not the document) because several
// galleries now live on one page. "view larger" opens the same carousel in a
// native <dialog>; it is also the agent's show_gallery target.

function isExternalImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

export function GalleryImage({
  src,
  alt,
  sizes,
  fit,
}: {
  src: string;
  alt: string;
  sizes: string;
  fit: "contain" | "cover";
}) {
  if (isExternalImage(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      style={{ objectFit: fit }}
      loading="lazy"
    />
  );
}

function Stage({
  title,
  gallery,
  i,
  go,
  sizes,
}: {
  title: string;
  gallery: string[];
  i: number;
  go: (n: number) => void;
  sizes: string;
}) {
  const count = gallery.length;
  return (
    <div className="gallery-stage">
      <GalleryImage
        key={gallery[i]}
        src={gallery[i]}
        alt={`${title} screenshot ${i + 1} of ${count}`}
        sizes={sizes}
        fit="contain"
      />
      {count > 1 && (
        <>
          <button
            type="button"
            className="gallery-nav prev"
            onClick={() => go(-1)}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            className="gallery-nav next"
            onClick={() => go(1)}
            aria-label="Next image"
          >
            ›
          </button>
          <span className="gallery-count" aria-live="polite">
            {i + 1} / {count}
          </span>
        </>
      )}
    </div>
  );
}

export function Gallery({
  slug,
  title,
  gallery,
}: {
  slug: string;
  title: string;
  gallery: string[];
}) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = gallery.length;
  const go = useCallback(
    (n: number) => setI((p) => (count ? (p + n + count) % count : 0)),
    [count]
  );

  if (count === 0) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (count < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  }

  function openLarge() {
    setOpen(true);
    if (dialogRef.current) showModalReturningFocus(dialogRef.current);
  }

  return (
    <div
      className="gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${title} screenshots`}
      onKeyDown={onKeyDown}
    >
      <Stage
        title={title}
        gallery={gallery}
        i={i}
        go={go}
        sizes="(max-width: 768px) 100vw, 60vw"
      />
      <div className="gallery-bar">
        {count > 1 && (
          <div className="gallery-thumbs">
            {gallery.map((g, n) => (
              <button
                key={g}
                type="button"
                aria-pressed={n === i}
                aria-label={`Show image ${n + 1}`}
                className="gallery-thumb"
                onClick={() => setI(n)}
                // keep a keyboard-focused thumb inside the scrolling strip
                onFocus={(e) => {
                  const b = e.currentTarget;
                  const strip = b.parentElement;
                  if (!strip) return;
                  const l = b.offsetLeft - strip.offsetLeft;
                  if (l < strip.scrollLeft) strip.scrollLeft = l;
                  else if (l + b.offsetWidth > strip.scrollLeft + strip.clientWidth)
                    strip.scrollLeft = l + b.offsetWidth - strip.clientWidth;
                }}
              >
                <GalleryImage src={g} alt="" sizes="80px" fit="cover" />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn gallery-open"
          onClick={openLarge}
          data-agent-id={agentId.gallery(slug)}
        >
          view larger
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="gallery-dialog"
        aria-label={`${title} screenshots`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // a click on the backdrop lands on the dialog element itself
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="gallery-dialog-head">
          <span className="label">{title}</span>
          <button
            type="button"
            className="btn"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close gallery"
          >
            close
          </button>
        </div>
        {open && (
          <Stage title={title} gallery={gallery} i={i} go={go} sizes="100vw" />
        )}
      </dialog>
    </div>
  );
}
