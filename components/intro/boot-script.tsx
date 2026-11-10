// Runs in <head>, before the hero paints. It alone decides whether the boot
// intro plays, so the hero is never shown and then hidden again:
//   - once per session (sessionStorage), never under reduced motion, never
//     when the page opens on a #section link or in a background tab
//   - sets <html data-intro="pending">; CSS holds the hero parts in their
//     "before" state only while that attribute exists, so with JS off (or this
//     script failing) the hero is simply there
//   - any click (the Skip button included), key, wheel or touch scroll ends it,
//     which works from the first frame, before React or the intro chunk load
//   - failsafes: if the intro has not started 2.5s in it is dropped, and
//     nothing stays hidden past 9s
//   - ending (any way) snaps: data-intro-snap turns transitions off for two
//     frames, so grey text and the CTA jump to their final colours at once
// components/intro/boot-intro.tsx takes over once loaded (data-intro="running")
// and calls window.__introEnd when it finishes.

export const INTRO_SESSION_KEY = "mk:intro-played";

const script = `(function(){
var h=document.documentElement;
try{
if(sessionStorage.getItem(${JSON.stringify(INTRO_SESSION_KEY)}))return;
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
if(location.hash&&location.hash!=="#hero")return;
if(document.visibilityState==="hidden")return;
sessionStorage.setItem(${JSON.stringify(INTRO_SESSION_KEY)},"1");
}catch(e){return}
h.setAttribute("data-intro","pending");
var evs=["click","keydown","wheel","touchmove"],o={capture:true,passive:true},a,b;
function end(){
clearTimeout(a);clearTimeout(b);
evs.forEach(function(t){removeEventListener(t,end,o)});
document.removeEventListener("visibilitychange",end);
h.setAttribute("data-intro-snap","");
h.removeAttribute("data-intro");
requestAnimationFrame(function(){requestAnimationFrame(function(){h.removeAttribute("data-intro-snap")})});
}
evs.forEach(function(t){addEventListener(t,end,o)});
document.addEventListener("visibilitychange",end);
a=setTimeout(function(){if(h.getAttribute("data-intro")==="pending")end()},2500);
b=setTimeout(end,9000);
window.__introEnd=end;
})();`;

export function IntroBootScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

/**
 * Server-rendered so it exists from the first frame; CSS shows it only while
 * <html data-intro> is set. The click needs no handler: the boot script ends
 * the intro on any click.
 */
export function SkipIntroButton() {
  return (
    <button type="button" className="btn intro-skip" data-intro-skip="">
      Skip intro
    </button>
  );
}
