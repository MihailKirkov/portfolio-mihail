// Runs in <head>, before the hero paints. It alone decides whether the boot
// intro plays, so the hero is never shown and then hidden again:
//   - once per session (sessionStorage), never under reduced motion, never
//     when the page opens on a #section link or in a background tab
//   - sets <html data-intro="pending">; CSS holds the hero parts in their
//     "before" state only while that attribute exists, so with JS off (or this
//     script failing) the hero is simply there
// It also owns visitor input for the whole intro, from the first frame,
// before React or the intro chunk load:
//   - any click or tap (the Skip button included) or Escape ends it at once
//   - the first wheel, touch scroll or other key (arrows, space, page keys...)
//     fast-forwards it instead: the scroll is absorbed, and so is every scroll
//     after it until the intro ends. Absorbed scrolls are dropped, never
//     replayed, so the page does not lurch when the hold ends.
//   - the hold never lasts more than HOLD_MS: then the intro is ended,
//     whatever state it is in, and scrolling is released
//   - failsafes: if the intro has not started 2.5s in it is dropped, and
//     nothing stays hidden past 12s
//   - ending (any way) snaps: data-intro-snap turns transitions off for two
//     frames, so grey text and the CTA jump to their final colours at once
// components/intro/boot-intro.tsx takes over once loaded (data-intro="running"),
// receives fast-forwards via window.__introFastForward (or window.__introFF if
// one came before it loaded) and calls window.__introEnd when it finishes.

export const INTRO_SESSION_KEY = "mk:intro-played";
export const INTRO_HOLD_MS = 1200;

// keys that scroll the page: absorbed during the intro (unless typed into a field)
const SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
];

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
var P={capture:true,passive:false},K=${JSON.stringify(SCROLL_KEYS)},held=0,a,b,c;
function mk(n){try{performance.mark("intro:"+n)}catch(e){}}
function ff(e){
if(e&&e.cancelable)e.preventDefault();
if(held)return;
held=performance.now();mk("hold");
c=setTimeout(function(){mk("cap");end()},${INTRO_HOLD_MS});
if(window.__introFastForward)window.__introFastForward(held);else window.__introFF=held;
}
function key(e){
if(e.key==="Escape")return end();
if(e.metaKey||e.ctrlKey||e.altKey)return;
var t=e.target,n=t&&t.tagName;
var field=n==="INPUT"||n==="TEXTAREA"||n==="SELECT"||n==="BUTTON"||n==="A"||(t&&t.isContentEditable);
ff(K.indexOf(e.key)>=0&&!field?e:null);
}
var on=[["click",end],["keydown",key],["wheel",ff],["touchmove",ff]];
function end(){
clearTimeout(a);clearTimeout(b);clearTimeout(c);
on.forEach(function(x){removeEventListener(x[0],x[1],P)});
document.removeEventListener("visibilitychange",end);
if(!h.hasAttribute("data-intro"))return;
h.setAttribute("data-intro-snap","");
h.removeAttribute("data-intro");
requestAnimationFrame(function(){requestAnimationFrame(function(){h.removeAttribute("data-intro-snap")})});
}
on.forEach(function(x){addEventListener(x[0],x[1],P)});
document.addEventListener("visibilitychange",end);
a=setTimeout(function(){if(h.getAttribute("data-intro")==="pending")end()},2500);
b=setTimeout(end,12000);
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
