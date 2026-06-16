"use client";

import { useEffect, useRef, useState } from "react";
import type { Section } from "@/lib/sections";

export function NodeModal({
  section,
  onClose,
}: {
  section: Section | null;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // trigger the scale-in once mounted
  useEffect(() => {
    if (!section) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => setShow(true));
    // move focus into the dialog
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [section]);

  // ESC + focus trap
  useEffect(() => {
    if (!section) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  function handleClose() {
    setShow(false);
    // restore focus to the node that opened the modal
    restoreRef.current?.focus();
    setTimeout(onClose, 300);
  }

  if (!section) return null;

  return (
    <>
      <div
        className={`backdrop${show ? " show" : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className={`beam${show ? " show" : ""}`} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={`modal${show ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mh">
          <h3 id="modal-title">{section.title}</h3>
          <button
            ref={closeRef}
            className="mx"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mb">{section.body}</div>
      </div>
    </>
  );
}
