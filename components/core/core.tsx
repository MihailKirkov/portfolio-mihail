"use client";

import { useEffect, useRef, useState } from "react";
import { CssCore } from "@/components/core/reactor-core";
import type { CoreVariant, ShaderCoreProps } from "@/components/core/shader-core";
import { prefersReducedMotion } from "@/lib/agent/choreo";
import { statusOf, useAgentState, type AgentStatus } from "@/lib/agent/store";

// The core's gate. Server-rendered as the CSS core, which stays as the
// placeholder and the fallback. On the client it loads the shader core (three
// in its own chunk) only when it will run well:
//   - not under reduced motion, not with hardwareConcurrency <= 4, not with
//     data saver on, not without a hardware-backed WebGL2 context
//   - not while the core is hidden (phones): nothing is fetched until it shows
//   - never in the middle of the boot intro: a context + shader compile stalls
//     a frame, so a chunk that lands mid-intro mounts once the intro has ended
// Once the shader core has drawn its first frame the CSS core fades out under
// it. If the WebGL context is lost the CSS core comes back and stays.
//
// Dev only: ?core=1|2|3 picks a variant, ?state=idle|thinking|executing holds
// the core in one state (both compiled out of production builds).

type ShaderModule = { ShaderCore: (p: ShaderCoreProps) => React.JSX.Element };

const DEV = process.env.NODE_ENV === "development";

function canRunShader() {
  if (prefersReducedMotion()) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= 4) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** run `fn` now, or once the boot intro has ended if it is mid-run */
function outsideIntro(fn: () => void): () => void {
  const html = document.documentElement;
  if (html.dataset.intro !== "running") {
    fn();
    return () => {};
  }
  const mo = new MutationObserver(() => {
    if (html.hasAttribute("data-intro")) return;
    mo.disconnect();
    fn();
  });
  mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
  return () => mo.disconnect();
}

export function Core() {
  const wrap = useRef<HTMLDivElement>(null);
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [ready, setReady] = useState(false);
  const [cssGone, setCssGone] = useState(false);
  const [lost, setLost] = useState(false);
  const [active, setActive] = useState(true);
  const [pointer, setPointer] = useState(false);
  const [variant, setVariant] = useState<CoreVariant>(1);
  const [forced, setForced] = useState<AgentStatus | null>(null);
  const status = useAgentState(statusOf);

  // decide, load, and mount outside the intro
  useEffect(() => {
    if (!canRunShader()) return;
    if (DEV) {
      const q = new URLSearchParams(location.search);
      const v = Number(q.get("core"));
      if (v === 1 || v === 2 || v === 3) setVariant(v);
      const s = q.get("state");
      if (s === "idle" || s === "thinking" || s === "executing") setForced(s);
    }
    setPointer(finePointer());

    let disposed = false;
    let undo = () => {};
    const shown = () => (wrap.current?.getBoundingClientRect().width ?? 0) > 0;
    const load = () => {
      void import("@/components/core/shader-core").then((m) => {
        if (disposed) return;
        undo = outsideIntro(() => !disposed && setMod(m));
      });
    };
    if (shown()) {
      load();
    } else {
      // hidden (phones): fetch nothing unless a resize shows it
      const onResize = () => {
        if (!shown()) return;
        window.removeEventListener("resize", onResize);
        load();
      };
      window.addEventListener("resize", onResize);
      return () => {
        disposed = true;
        undo();
        window.removeEventListener("resize", onResize);
      };
    }
    return () => {
      disposed = true;
      undo();
    };
  }, []);

  // pause off screen or in a hidden tab
  useEffect(() => {
    const el = wrap.current;
    if (!mod || !el) return;
    let inView = true;
    let visible = document.visibilityState !== "hidden";
    const update = () => setActive(inView && visible);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mod]);

  // the CSS core fades out under the first shader frame, then unmounts
  useEffect(() => {
    if (!ready) {
      setCssGone(false);
      return;
    }
    const id = setTimeout(() => setCssGone(true), 600);
    return () => clearTimeout(id);
  }, [ready]);

  const gl = mod && !lost;
  return (
    <div className="core-stack" ref={wrap} data-core-ready={ready && gl ? "" : undefined}>
      {!(cssGone && gl) && <CssCore />}
      {gl && (
        <mod.ShaderCore
          variant={variant}
          status={forced ?? status}
          pointer={pointer}
          active={active}
          onReady={() => setReady(true)}
          onLost={() => {
            setLost(true);
            setReady(false);
          }}
        />
      )}
    </div>
  );
}
