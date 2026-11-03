/* Homeroom site, landing page: "The tablet, pinned" (direction B, homeroom-site #1).
   One Wall object (1263×841) is placed by a single translate()+scale(): covering the viewport,
   filling the tablet's screen, or landing in the Rail's 72×48 Photos thumbnail.
   Steps, not scrubbing: each scroll step triggers a timed product animation, so the photo
   can never be stuck half-scaled. Without JS the page shows a still Wall and continues below. */
(function(){
'use strict';
const HR = window.HR;
const pin = document.getElementById('pin');
if(!HR || !pin){ pin && pin.querySelector('.stage').classList.remove('intro'); return; }   // no hero script: show the still Wall now

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const stage = pin.querySelector('.stage'), wall = pin.querySelector('.wall'), fitEl = pin.querySelector('.device .fit'), bLeft = pin.querySelector('.b-left');
const hub = fitEl.querySelector('.hub');
hub.innerHTML = HR.hubHTML();
const thumb = hub.querySelector('.thumb');
// The Meals, Shopping and Cook captures load once the visitor is past the first screen, not with the hero photo.
addEventListener('scroll',function h(){ removeEventListener('scroll',h); HR.hydrate(hub); },{passive:true});

/* Shopping: the phone arrives, and each line it ticks ticks on the wall too (same order, ~650 ms apart). */
const phone = pin.querySelector('.d-phone'), phLeft = phone.querySelector('[data-left]');
const ORDER = ['cucumber','asparagus','coconut','rice'];
let ticks = [];
function shop(on){
  ticks.forEach(clearTimeout); ticks = [];
  phone.classList.toggle('on', on);
  const set = n=>{ ORDER.forEach((k,j)=>phone.querySelector(`[data-ph="${k}"]`).classList.toggle('done', j<n)); phLeft.textContent = `${45-n} to buy`; HR.setTicks(hub,n); };
  set(0);
  if(!on) return;
  if(RM.matches){ set(ORDER.length); return; }
  ORDER.forEach((_,j)=>ticks.push(setTimeout(()=>set(j+1), 900 + j*650)));
}

/* Size the tablet to whatever space is left beside the captions (or above them on phones), at 1263:841. */
function sizeDevice(){
  const sr = stage.getBoundingClientRect(), wide = innerWidth > 820;
  const avail = wide ? sr.right - Math.max(24,innerWidth*.044) - 56 - (bLeft.getBoundingClientRect().right + Math.max(24,innerWidth*.04)) - 32
                     : sr.width - 48 - 32;
  const maxH = (wide ? innerHeight*.78 : innerHeight*.42) - 32;
  const w = Math.max(240, Math.min(avail, maxH*1263/841));
  fitEl.style.width = w+'px'; fitEl.style.height = (w*841/1263)+'px'; hub.style.transform = `scale(${w/1263})`;
}

/* ── The yield ── */
function flyer(){
  let at = null, timers = [];
  const clear = ()=>{ timers.forEach(clearTimeout); timers = []; };
  // Layout boxes (offset*), not getBoundingClientRect: the device eases in from scale(1.04),
  // and measuring mid-transition would land the photo ~4% off the real screen.
  const offsetIn = (el,root)=>{ let x = 0, y = 0; while(el && el!==root){ x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return {x,y}; };
  const rectOf = (t)=>{
    if(t==='cover'){ const w = stage.clientWidth, h = stage.clientHeight, k = Math.max(w/1263, h/841); return {x:(w-1263*k)/2, y:(h-841*k)/2, k}; }
    const sc = offsetIn(fitEl,stage), k = fitEl.offsetWidth/1263;
    if(t==='screen') return {x:sc.x, y:sc.y, k};
    const th = offsetIn(thumb,hub);
    return {x:sc.x + th.x*k, y:sc.y + th.y*k, k:k*thumb.offsetWidth/1263};
  };
  const put = (t,snap)=>{
    const r = rectOf(t);
    if(snap) wall.classList.add('snap');
    wall.style.transform = `translate(${r.x}px,${r.y}px) scale(${r.k})`;
    if(snap){ void wall.offsetWidth; wall.classList.remove('snap'); }
  };
  function go(t,{dur,snap=false}={}){
    if(t===at && !snap) return;
    clear(); const from = at; at = t;
    wall.style.transitionDuration = (!RM.matches && dur) || '';
    wall.classList.toggle('yielded', t==='thumb');
    // Reduced motion: fade out, move while invisible, fade back. Never an in-between scale.
    if(RM.matches && !snap && from){
      wall.classList.add('fadeout');
      timers.push(setTimeout(()=>{ put(t,true);
        if(t==='thumb') thumb.classList.add('shown'); else { thumb.classList.remove('shown'); wall.classList.remove('fadeout'); } },330));
      return;
    }
    if(from==='thumb'){ wall.classList.remove('fadeout'); thumb.classList.remove('shown'); }
    put(t,snap);
    if(t==='thumb'){
      if(snap){ thumb.classList.add('shown'); wall.classList.add('fadeout'); return; }
      // The real 10px-radius thumbnail takes over at --delay-mat as a step (never a radius transition).
      timers.push(setTimeout(()=>thumb.classList.add('shown'),560));
      timers.push(setTimeout(()=>{ wall.style.transition='none'; wall.style.opacity=0; void wall.offsetWidth; wall.style.transition=''; wall.style.opacity=''; wall.classList.add('fadeout'); },820));
    }
  }
  return {go, re:()=>{ if(at) put(at,true); }, get at(){ return at; }};
}

/* ── Scroll steps: the pinned section split into n equal steps; step 1 fires at 24px ── */
function stepper(sec,n,cb,first=24){
  let cur = -1;
  const f = ()=>{
    const r = sec.getBoundingClientRect(), total = Math.max(1, r.height-innerHeight), y = -r.top;
    let i = y<first ? 0 : Math.min(n-1, Math.max(0, Math.floor((y/total)*n)));
    if(i===0 && y>=first && n>1) i = 1;
    if(i!==cur){ const p = cur; cur = i; cb(i,p); }
  };
  let raf = 0;
  addEventListener('scroll',()=>{ if(!raf) raf = requestAnimationFrame(()=>{ raf = 0; f(); }); },{passive:true});
  return f;
}

sizeDevice();
const fl = flyer();
fl.go('cover',{snap:true}); HR.showScreen(hub,'today',{rise:false});

/* The cue arrives once, last, after the words have risen; the drift holds while it does. */
let cuedOnce = false;
function cue(){
  if(cuedOnce) return; cuedOnce = true;
  stage.classList.add('cued');
  if(RM.matches) return;
  stage.classList.add('kb-hold'); setTimeout(()=>stage.classList.remove('kb-hold'),700);
}

/* ── The hero develops (#28): once per load. The photo is revealed only whole: after img.decode(), it settles
   in on --ease-settle, and --delay-intro-words later the gradient and words rise (CSS staggers them), then
   the cue. If the photo hasn't decoded 1.5 s after navigation start, the words rise over the ground anyway
   and the photo settles in whenever it arrives. Reduced motion: the same gates, but every step snaps.
   A press, a scroll past step 0 or focus in the hero skips to the end state; a photo still on its way
   keeps waiting for decode. If the image fails, everything shows (the static Wall). ── */
const intro = (()=>{
  const cl = stage.classList, img = wall.querySelector('.kb img');
  if(!cl.contains('intro') || !img){ cl.remove('intro'); cue(); return {skip(){}}; }
  const css = getComputedStyle(document.documentElement);
  const ms = n=>parseFloat(css.getPropertyValue(n)) || 0;                                 // the tokens are written in ms
  let photo = false, words = false, photoDone = false, wordsDone = false, over = false;
  const timers = [], later = (fn,t)=>timers.push(setTimeout(fn,t));
  const snap = fn=>{ cl.add('intro-snap'); fn(); void stage.offsetWidth; cl.remove('intro-snap'); };
  const step = (fn,instant)=>instant || RM.matches ? snap(fn) : fn();
  function tidy(){                                                                        // back to the plain base styles: same values, nothing moves
    if(over || !photoDone || !wordsDone) return;
    over = true; timers.forEach(clearTimeout);
    cl.remove('intro','run','photo-in','words-in');
  }
  function showWords(instant){
    if(words) return; words = true;
    step(()=>cl.add('words-in'),instant);
    if(instant || RM.matches){ cue(); wordsDone = true; tidy(); return; }
    later(cue, ms('--delay-intro-cue'));
    later(()=>{ wordsDone = true; tidy(); }, ms('--delay-intro-cue') + ms('--dur-rise'));
  }
  function showPhoto(instant){
    if(photo) return; photo = true;
    step(()=>cl.add('photo-in'),instant);
    if(!words) later(()=>showWords(), RM.matches ? 0 : ms('--delay-intro-words'));
    if(instant || RM.matches){ photoDone = true; tidy(); }
    else later(()=>{ photoDone = true; tidy(); }, ms('--dur-intro-settle'));
  }
  // Start state is already painted (from the HTML); .run hands it from the CSS failsafe to these timers.
  cl.add('run'); void stage.offsetWidth;
  const decoded = 'decode' in img ? img.decode()
    : new Promise((ok,no)=>{ if(img.complete) return img.naturalWidth ? ok() : no(); img.addEventListener('load',ok,{once:true}); img.addEventListener('error',no,{once:true}); });
  decoded.then(()=>showPhoto(), ()=>{
    if(img.complete && img.naturalWidth) return showPhoto();                              // decode() can reject on a good image (e.g. a source swap)
    showPhoto(true); showWords(true);                                                     // a broken image: the static Wall, at once
  });
  later(()=>{ if(!photo) showWords(); }, Math.max(0, 1500 - performance.now()));          // the page is never blank
  // Skip: snap whatever is mid-flight (words, a settling photo) to its end; an undecoded photo keeps its gate.
  return {skip(){ if(over) return; snap(()=>{ words = true; cl.add('words-in'); }); cue(); wordsDone = true; if(photo) photoDone = true; tidy(); }};
})();
stage.addEventListener('focusin',()=>intro.skip());                                      // never an invisible focused link

/* ── The burst: a chalk dot springs in and two rings expand from a press point (in parent px) ── */
function burst(parent,x,y,cls=''){
  if(RM.matches) return;
  const b = document.createElement('span'); b.className = ('burst '+cls).trim(); b.style.left = x+'px'; b.style.top = y+'px';
  b.innerHTML = '<i></i><i></i><b></b>'; parent.appendChild(b); setTimeout(()=>b.remove(),900);
}

/* ── Click to continue (#26): at step 0, a press on the photo scrolls to the middle of step 1's band,
   so stepper lands cleanly on 1 and runs its own 900ms zoom. A one-off rAF tween on --ease-settle
   (behavior:'smooth' can't take the house curve); any wheel, touch or key from the visitor cancels it. ── */
const settle = (()=>{ // cubic-bezier(.22,1,.36,1): solve x(t)=u by Newton, return y(t)
  const c = (a,b,t)=>3*a*t*(1-t)*(1-t) + 3*b*t*t*(1-t) + t*t*t, d = (a,b,t)=>3*a*(1-t)*(1-t) + 6*(b-a)*t*(1-t) + 3*(1-b)*t*t;
  return u=>{ let t = u; for(let k=0;k<8;k++){ const s = d(.22,.36,t); if(Math.abs(s)<1e-6) break; t -= (c(.22,.36,t)-u)/s; t = Math.min(1,Math.max(0,t)); } return c(1,1,t); };
})();
let tween = 0;
const stopTween = ()=>{ if(tween){ cancelAnimationFrame(tween); tween = 0; } };
['wheel','touchstart','keydown'].forEach(ev=>addEventListener(ev,stopTween,{passive:true}));
function continueToStory(){
  const total = Math.max(1, pin.offsetHeight - innerHeight);
  const to = pin.getBoundingClientRect().top + scrollY + Math.max(48, total/14);
  stopTween();
  if(RM.matches){ scrollTo(0,to); return; }
  const from = scrollY, t0 = performance.now(), dur = 900;
  const tick = now=>{ const u = Math.min(1,(now-t0)/dur); scrollTo(0, from + (to-from)*settle(u)); tween = u<1 ? requestAnimationFrame(tick) : 0; };
  tween = requestAnimationFrame(tick);
}

const caps = [...pin.querySelectorAll('.b-cap')], dots = [...pin.querySelectorAll('.b-dots i')];
const quiet = [...wall.querySelectorAll('.w-cue')];
let litT, at = -1;
const SCREENS = [,, 'today','week','meals','shopping','meals','home'];   // step 6 is Cook, over Meals
let idleT;
const step = stepper(pin,9,(i,p)=>{
  at = i;
  stage.classList.toggle('b-on', i>=1);
  stage.classList.toggle('b-cover', i===0);
  if(i!==0){ stage.classList.remove('hov'); intro.skip(); }                                // the finger only lives on the photo; the intro never chases a scroll
  quiet.forEach(el=>el.style.opacity = i>=1 ? 0 : '');
  caps.forEach(c=>c.classList.toggle('on', +c.dataset.c===i));
  dots.forEach((d,j)=>d.classList.toggle('now', j===i-1));
  clearTimeout(litT); clearTimeout(idleT);
  if((i===5) !== (p===5)) shop(i===5);
  HR.cook(hub, i===6);
  stage.classList.toggle('b-home', false);
  if(i===0){ fl.go('cover'); HR.sleep(hub); }
  else if(i===1){ fl.go('screen',{dur:p===0?'900ms':''}); HR.sleep(hub); }                 // zoom out into the tablet
  else if(i<=7){
    if(fl.at!=='thumb'){ fl.go('thumb'); HR.wake(hub,'today'); }
    const want = SCREENS[i];
    if(hub.dataset.cur!==want) HR.showScreen(hub,want,{rise:i!==6});
    if(want==='home') litT = setTimeout(()=>{ HR.setLit(hub,true); pressMark(); },700);   // Dinner: lamps ripple on
  }
  else {                                                                                   // idle: leans back, slower,
    fl.go('screen',{dur:'var(--dur-return-idle)'}); HR.sleep(hub);                         // then the photo fills the room again
    idleT = setTimeout(()=>{ if(at===8){ fl.go('cover',{dur:'1400ms'}); stage.classList.add('b-home'); } }, RM.matches ? 0 : 1600);
  }
});
step();

/* The Dinner press inside the tablet gets the same burst, smaller (hub px, scaled with the hub). */
function pressMark(){
  const d = hub.querySelector('[data-scene="Dinner"]'); if(!d || hub.dataset.cur!=='home') return;
  let x = d.offsetWidth/2, y = d.offsetHeight/2;
  for(let el = d; el && el!==hub; el = el.offsetParent){ x += el.offsetLeft; y += el.offsetTop; }
  burst(hub,x,y,'sm');
}

stage.addEventListener('click',e=>{
  if(at!==0 || e.button!==0 || e.defaultPrevented) return;
  if(e.target.closest('a,button,input,select,textarea,label,summary,[tabindex],[contenteditable]')) return;
  const sel = getSelection(); if(sel && String(sel).length) return;
  intro.skip();                                                                            // a press mid-intro: the end state, then continue
  const r = stage.getBoundingClientRect(); burst(stage, e.clientX - r.left, e.clientY - r.top);
  setTimeout(continueToStory, RM.matches ? 0 : 160);                                       // feedback first, then movement
});

/* The cursor is the finger: with a real mouse, a touch point trails the pointer over the photo
   (first-order lag, so it never overshoots) and the native cursor hides while it shows.
   Hybrid devices only get it from an actual mouse pointer, so a touch never leaves a ghost ring. */
const FINE = matchMedia('(hover:hover) and (pointer:fine)');
const fing = document.createElement('div'); fing.className = 'fing'; fing.setAttribute('aria-hidden','true');
fing.innerHTML = '<span class="ring"><i></i><i></i><b></b></span><span class="lab">Tap</span>'; stage.appendChild(fing);
let fx = 0, fy = 0, tx = 0, ty = 0, fRaf = 0, fT = 0;
const fPut = ()=>{ fing.style.transform = `translate3d(${fx}px,${fy}px,0)`; };
function fTick(now){
  const a = RM.matches ? 1 : 1 - Math.exp(-(now - fT)/50); fT = now;                    // ~50ms time constant, frame-rate independent
  fx += (tx-fx)*a; fy += (ty-fy)*a; fPut();
  fRaf = Math.abs(tx-fx) + Math.abs(ty-fy) > .3 ? requestAnimationFrame(fTick) : 0;
}
const fHide = ()=>stage.classList.remove('hov');
stage.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse' || !FINE.matches || at!==0 || e.target.closest('.top,a,button')){ fHide(); return; }
  const r = stage.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
  if(!stage.classList.contains('hov') || RM.matches){ cancelAnimationFrame(fRaf); fRaf = 0; fx = tx; fy = ty; fPut(); stage.classList.add('hov'); return; } // appear in place, no swoop
  if(!fRaf){ fT = performance.now(); fRaf = requestAnimationFrame(fTick); }
});
stage.addEventListener('pointerleave',fHide);


let rz;
addEventListener('resize',()=>{ cancelAnimationFrame(rz); rz = requestAnimationFrame(()=>{ sizeDevice(); fl.re(); }); });

HR.mountMinis();
HR.watchReveals();
})();
