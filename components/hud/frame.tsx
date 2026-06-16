"use client";

import { useEffect, useState } from "react";
import { ModeTabs, type Mode } from "@/components/hud/mode-tabs";

// Live 24h clock for the status strip. Renders a stable placeholder on the
// server so hydration matches, then ticks on the client.
function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-GB", { hour12: false });
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{t}</span>;
}

// The enclosing cockpit frame: a responsive bracketed border inset from the
// viewport edges, with a top status strip carrying the mode switcher. Purely
// decorative except the strip (which holds the clickable tabs).
export function Frame({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="frame">
      <div className="strip">
        <span className="strip-l">
          ask-mihail <span className="sep">//</span> portfolio
        </span>
        <ModeTabs mode={mode} onChange={onChange} />
        <span className="strip-r">
          <span className="on1">●</span> online <Clock />
        </span>
      </div>
    </div>
  );
}
