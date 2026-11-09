"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

// Project screenshot carousel. Extracted from the v2 project deck; arrow keys
// are scoped to the focused carousel (not the document) because several
// galleries now live on one page.

function isExternalImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

function GalleryImage({
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

export function Gallery({ title, gallery }: { title: string; gallery: string[] }) {
  const [i, setI] = useState(0);
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

  return (
    <div
      className="gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${title} screenshots`}
      onKeyDown={onKeyDown}
    >
      <div className="gallery-stage">
        <GalleryImage
          key={gallery[i]}
          src={gallery[i]}
          alt={`${title} screenshot ${i + 1} of ${count}`}
          sizes="(max-width: 768px) 100vw, 60vw"
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
            >
              <GalleryImage src={g} alt="" sizes="80px" fit="cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
