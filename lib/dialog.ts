// Modal dialogs (detail overlay, gallery viewer): showModal() already traps
// focus and makes the page inert. On close, focus goes back to whatever had it
// before the dialog opened, so keyboard and screen-reader users land where
// they left off - browsers differ on doing this themselves, and an overlay
// that unmounts on close would otherwise drop focus to <body>.

export function showModalReturningFocus(d: HTMLDialogElement) {
  if (d.open) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  d.showModal();
  d.addEventListener(
    "close",
    () => {
      const lost = document.activeElement === document.body || d.contains(document.activeElement);
      if (opener?.isConnected && lost) opener.focus({ preventScroll: true });
    },
    { once: true }
  );
}
