/* Homeroom site, landing page: "Dinner, start to finish" (owner, 2026-11-02).
   Steps, not scrubbing, like the hero: plan (Meals) → one list (Shopping) → the phone ticks it off →
   Cook mode → Cook mode over the whole viewport. The tablet is sized by CSS; only the last step
   measures, and it re-measures whenever the stage changes size, so it can't be stuck at a stale scale.
   Without JS the section is a still cook screen with every caption (site.css, .no-js). */
(function(){
'use strict';
const pin = document.getElementById('dinner');
if(!pin) return;

const RM = matchMedia('(prefers-reduced-motion: reduce)'), NARROW = matchMedia('(max-width: 820px)');
const stage = pin.querySelector('.stage'), dev = pin.querySelector('.d-device'), scr = pin.querySelector('.d-scr');
const shots = [...pin.querySelectorAll('.d-s')], caps = [...pin.querySelectorAll('.d-cap')], dots = [...pin.querySelectorAll('.d-dots i')];
const phone = pin.querySelector('.d-phone'), lines = [...phone.querySelectorAll('li')], clip = pin.querySelector('.d-clip');
const N = caps.length;

// Lazy images in a pinned section load late; ask for them once the section is near.
new IntersectionObserver((es,io)=>{ if(es.some(e=>e.isIntersecting)){ pin.querySelectorAll('img[loading="lazy"]').forEach(i=>i.loading='eager'); io.disconnect(); } },{rootMargin:'100% 0px'}).observe(pin);

/* The last step: the screen covers the viewport. translate()+scale() from the device's top-left, measured on
   layout boxes (offset*), never mid-transition. */
function cover(){
  const k = Math.max(innerWidth/scr.offsetWidth, innerHeight/scr.offsetHeight);
  let x = 0, y = 0; for(let el = dev; el && el!==stage; el = el.offsetParent){ x += el.offsetLeft; y += el.offsetTop; }
  const pad = scr.offsetLeft;
  const tx = (innerWidth - scr.offsetWidth*k)/2 - x - pad*k, ty = (innerHeight - scr.offsetHeight*k)/2 - y - pad*k;
  return `translate(${tx}px,${ty}px) scale(${k})`;
}

let ticks = [];
const stopTicks = ()=>{ ticks.forEach(clearTimeout); ticks = []; };
function tickLines(){
  stopTicks();
  lines.forEach(l=>l.classList.remove('done'));
  if(RM.matches){ lines.slice(0,3).forEach(l=>l.classList.add('done')); return; }
  [0,2,1,4].forEach((n,j)=>ticks.push(setTimeout(()=>lines[n].classList.add('done'), 700 + j*650)));
}

function play(on){
  if(!clip) return;
  if(on && !RM.matches){ clip.preload = 'auto'; clip.play().catch(()=>{}); } else clip.pause();
}

let cur = -1;
function show(i){
  if(i===cur) return; const p = cur; cur = i;
  caps.forEach(c=>c.classList.toggle('on', +c.dataset.c===i));
  dots.forEach((d,j)=>d.classList.toggle('now', j===i));
  const want = i===0 ? 'meals' : i<=2 ? 'shopping' : 'cook';
  shots.forEach(s=>s.classList.toggle('on', s.dataset.s===want));
  phone.classList.toggle('on', i===2);
  if(i===2 && p!==2) tickLines(); else if(i!==2) stopTicks();
  play(i>=3);
  // Phone width: the tablet is already the screen's width, so a cover would only crop it.
  const full = i===4 && !NARROW.matches;
  stage.classList.toggle('full', full);
  dev.style.transform = full ? cover() : '';
}

function step(){
  const r = pin.getBoundingClientRect(), total = Math.max(1, r.height - innerHeight);
  show(Math.min(N-1, Math.max(0, Math.floor((-r.top/total)*N))));
}
let raf = 0;
addEventListener('scroll',()=>{ if(!raf) raf = requestAnimationFrame(()=>{ raf = 0; step(); }); },{passive:true});
// Any size change (window, fonts, the address bar) re-places the cover; no resize-only path.
new ResizeObserver(()=>{ if(cur===4){ const full = !NARROW.matches; stage.classList.toggle('full', full); dev.style.transition = 'none'; dev.style.transform = full ? cover() : ''; void dev.offsetWidth; dev.style.transition = ''; } }).observe(stage);
step();
})();
