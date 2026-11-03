/* Homeroom site, landing page: "The tablet, pinned" (direction B, homeroom-site #1).
   One Wall object (1263×841) is placed by a single translate()+scale(): covering the viewport,
   filling the tablet's screen, or landing in the Rail's 72×48 Photos thumbnail.
   Steps, not scrubbing: each scroll step triggers a timed product animation, so the photo
   can never be stuck half-scaled. Without JS the page shows a still Wall and continues below. */
(function(){
'use strict';
const HR = window.HR;
const pin = document.getElementById('pin');
if(!HR || !pin) return;

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const stage = pin.querySelector('.stage'), wall = pin.querySelector('.wall'), fitEl = pin.querySelector('.device .fit'), bLeft = pin.querySelector('.b-left');
const hub = fitEl.querySelector('.hub');
hub.innerHTML = HR.hubHTML();
const thumb = hub.querySelector('.thumb');

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
const step = stepper(pin,7,(i,p)=>{
  at = i;
  stage.classList.toggle('b-on', i>=1);
  stage.classList.toggle('b-cover', i===0);
  quiet.forEach(el=>el.style.opacity = i>=1 ? 0 : '');
  caps.forEach(c=>c.classList.toggle('on', +c.dataset.c===i));
  dots.forEach((d,j)=>d.classList.toggle('now', j===i-1));
  clearTimeout(litT);
  if(i===0){ fl.go('cover'); HR.sleep(hub); }
  else if(i===1){ fl.go('screen',{dur:p===0?'900ms':''}); HR.sleep(hub); }                 // zoom out into the tablet
  else if(i<=5){
    if(fl.at!=='thumb'){ fl.go('thumb'); HR.wake(hub,'today'); }                           // a touch: the photo yields, Today rises
    const want = i===2 ? 'today' : (i<=4 ? 'week' : 'home');
    if(hub.dataset.cur!==want) HR.showScreen(hub,want);
    if(want==='week') HR.setWeek(hub, i===4 ? 2 : 1);                                       // next week slides in
    if(want==='home') litT = setTimeout(()=>{ HR.setLit(hub,true); pressMark(); },700);   // Dinner: lamps ripple on
  }
  else { fl.go('screen',{dur:'var(--dur-return-idle)'}); HR.sleep(hub); }                  // idle: leans back, slower
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
  const r = stage.getBoundingClientRect(); burst(stage, e.clientX - r.left, e.clientY - r.top);
  setTimeout(continueToStory, RM.matches ? 0 : 160);                                       // feedback first, then movement
});

/* The cue arrives once, after the photo has landed; the drift holds while it does. */
setTimeout(()=>{
  stage.classList.add('cued');
  if(RM.matches) return;
  stage.classList.add('kb-hold'); setTimeout(()=>stage.classList.remove('kb-hold'),700);
},RM.matches ? 0 : 700);

let rz;
addEventListener('resize',()=>{ cancelAnimationFrame(rz); rz = requestAnimationFrame(()=>{ sizeDevice(); fl.re(); }); });

HR.mountMinis();
HR.watchReveals();
})();
