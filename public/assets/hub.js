/* Homeroom site: the product's Rail screens, rebuilt as live HTML from the product's
   docs/design/reference/rail-v1/house-test.html. Shared by / and /log/.
   Sample household only (the product's sample-data build): Avery, Jordan, Sam, Riley. Fake photos only.
   Every screen renders into the 1111×717 content box of a 1263×841 hub, exactly as the shell gives it. */
(function(){
'use strict';

const IMG = {
  hero:'/assets/photos/harbour-dusk.jpg',
  cam:'/assets/photos/forest-path.jpg',
  meadow:'/assets/photos/meadow-evening-760.jpg',
  alpine:'/assets/photos/alpine-morning-760.jpg',
};
const ALT = {
  hero:'A sample photo: a harbour at dusk, the sun behind dark hills.',
  meadow:'A sample photo: green hills at sunset.',
  alpine:'A sample photo: blue ridges under a pale sun.',
};
const P = {A:{n:'Avery',c:'var(--c-person-1)',home:true},J:{n:'Jordan',c:'var(--c-person-2)',home:false},S:{n:'Sam',c:'var(--c-person-3)',home:false},R:{n:'Riley',c:'var(--c-person-4)',home:true},H:{n:'Household',c:'var(--c-person-household)',home:true}};
const PEOPLE = ['A','J','S','R'];
const PATHS = {
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  week:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  meals:'<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 21V3c-2.5 1.5-3 5-3 8h3"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  chores:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cam:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  garage:'<path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  door:'<path d="M14 3H6v18h8M14 3l5 2v14l-5 2zM11 12h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', chev:'<path d="M9 6l6 6-6 6"/>', down:'<path d="M6 9l6 6 6-6"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7"/>', bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
  cloud:'<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 18z"/>',
};
const I = (n,s=22,w=2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[n]}</svg>`;
const av = (k,s=30,ring=false) => `<span class="av" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.45)}px;${ring?`background:transparent;box-shadow:inset 0 0 0 2px ${P[k].c};color:${P[k].c}`:`background:${P[k].c}`}">${P[k].n[0]}</span>`;
const head = (l,go) => `<div class="more"><span class="lab">${l}</span>${go?`<span class="go">${go}${I('chev',16)}</span>`:''}</div>`;

/* ── Today ── */
const AG = [['6:30 AM','Gym','J','','past'],['9 AM','Pay water bill','A','','past'],['Now','Coffee with Mara','A','Corner café','now'],['11 AM','Library story time','R','Main library'],['12 PM','Team lunch','J','Downtown'],['3 PM','Pick up Sam','J','Lincoln Elementary'],['4 PM','Piano lesson','S','Ms. Ortiz']];
const CH = [['Feed the cat','S',1],['Piano practice, 20 min','S',0],['Make bed','R',1],['Bins out tonight','J',0],['Water the plants','A',0]];
function scrToday(){
  return `<div class="scr" data-s="today"><div style="display:grid;grid-template-columns:470px 290px 1fr;gap:16px;height:717px">
    <div class="card col rise" style="gap:8px;--i:0">${head('Today','Week')}
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip">${av('S',24)}School</span><span class="chip">${av('H',24)}Trash day</span></div>
      <div>${AG.map(e=>`<div class="ev ${e[4]||''}"><span class="t">${e[0]}</span><span class="bar" style="background:${P[e[2]].c}"></span><span><div class="ti">${e[1]}</div><div class="sub">${P[e[2]].n}${e[3]?' · '+e[3]:''}</div></span></div>`).join('')}</div></div>
    <div class="col rise" style="gap:16px;--i:1">
      <div class="card">${head('Dinner tonight','Meals')}<div class="h" style="font-size:24px;margin-top:6px">Spaghetti</div><div style="font-size:15px;color:var(--c-mute);margin-top:4px">6:30 PM · Plan lunch ›</div></div>
      <div class="card col" style="flex:1;gap:4px">${head('Chores · 3 left','All')}${CH.map(c=>`<div class="chore${c[2]?' done':''}"><span class="chk">${c[2]?I('check',16,3):''}</span>${av(c[1],24)}<span class="tx">${c[0]}</span></div>`).join('')}</div>
      <div class="card row" style="padding:16px 22px;justify-content:space-between"><span><div class="lab">Lists</div><div style="font-size:17px;margin-top:4px">Groceries 6 · To-do 3</div></span>${I('chev',18)}</div>
    </div>
    <div class="col rise" style="gap:16px;--i:2">
      <div class="card">${head('Home','All')}<div style="margin:8px 0 10px">${scenes(2,82)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${light('Kitchen',80,true,0)}${light('Living room',60,false,1)}${light('Porch',100,false,2)}<div class="dev"><span class="ic">${I('lock',18)}</span><span><div class="nm">Front door</div><div class="st">Locked</div></span></div></div></div>
      <div class="card col" style="padding:14px;flex:1;gap:8px">${head('Cameras','All')}<div class="cam" style="height:150px"><img src="${IMG.cam}" alt="" loading="lazy"><span class="tag"><i></i>LIVE</span><span class="nm">Backyard</span></div></div>
    </div></div></div>`;
}
function scenes(cols,minH){
  return `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:10px">${[['Leaving','door'],['Dinner','meals'],['Movie','film'],['Goodnight','moon']].map(([n,ic])=>`<div class="scene" data-scene="${n}" style="min-height:${minH}px">${I(ic,20)}<span>${n}</span><span class="on-l">${I('check',20,2.4)}<span>Done</span></span></div>`).join('')}</div>`;
}
function light(n,pct,on,r){
  return `<div class="dev${on?' is-on':''}" data-light="${n}" style="--r:${r}"><span class="ic">${I('bulb',18)}</span><span><div class="nm">${n}</div><div class="st">Off</div></span>
    <span class="lit"><span class="ic">${I('bulb',18)}</span><span><div class="nm">${n}</div><div class="st">On · ${pct}%</div></span></span></div>`;
}

/* ── Week: this week and next on one track ── */
const W1 = [
  ['Sun',25,'68°','past','Roast chicken',[]],
  ['Mon',26,'66°','past','Tacos',[['6:30 AM','Gym','J'],['9 AM','Dentist','A'],['3:30 PM','Swim class','R']]],
  ['Tue',27,'64°','today','Spaghetti',[['Now','Coffee with Mara','A','now'],['11 AM','Library story time','R'],['12 PM','Team lunch','J'],['4 PM','Piano lesson','S']]],
  ['Wed',28,'63°','','Salmon & rice',[['All day','Field trip','S'],['3:30 PM','Math tutoring','S'],['7 PM','Book club','A']]],
  ['Thu',29,'66°','','Stir fry',[['All day','Work trip','A'],['5 PM','Soccer practice','S']]],
  ['Fri',30,'64°','','Pizza night',[['8:30 AM','Yoga','A'],['6 PM','Pizza night','H']]],
  ['Sat',31,'68°','','Burgers',[['10 AM','Haircut','J'],['1 PM','Playdate','R'],['5:30 PM','Trick-or-treat','H']]]];
const W2 = [
  ['Sun',1,'61°','','Chili',[['10 AM','Farmers market','H']]],
  ['Mon',2,'60°','','',[['All day','School','S'],['6:30 AM','Gym','J']]],
  ['Tue',3,'58°','','Soup & bread',[['All day','Trash day','H'],['7 PM','Parent night','H']]],
  ['Wed',4,'59°','','',[['3:30 PM','Math tutoring','S'],['5:30 PM','Soccer coaching','J']]],
  ['Thu',5,'62°','','Tacos',[['6:30 AM','Gym','J'],['11 AM','Story time','R']]],
  ['Fri',6,'63°','','Pizza night',[['6 PM','Movie night','H']]],
  ['Sat',7,'65°','','',[['9 AM','Soccer game','S'],['2 PM','Birthday party','R']]]];
function weekGrid(days,rise){
  return `<div class="wk-grid">${days.map((d,i)=>`<div class="card day ${d[3]} ${rise?'rise':''}" style="--i:${i}">
    <div class="more" style="min-height:0"><span class="lab">${d[0]}</span><span style="font-size:13px;color:var(--c-mute);display:flex;gap:4px;align-items:center">${I('cloud',14)} ${d[2]}</span></div>
    <div class="dnum">${d[1]}</div>
    <div class="din${d[4]?'':' no'}">${I('meals',14)}<span>${d[4]||'Plan dinner'}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px">${d[5].length?d[5].map(e=>`<div class="wev ${e[3]||''}" style="--pc:${P[e[2]].c}"><div class="wt">${e[0]}</div><div class="wn">${e[1]}</div></div>`).join(''):'<div class="none">Nothing planned</div>'}</div></div>`).join('')}</div>`;
}
function scrWeek(){
  const cnt = {A:7,J:9,S:9,R:5};
  return `<div class="scr" data-s="week">
    <div class="row rise" style="height:48px;gap:8px;--i:0"><span class="pill on">Everyone <span style="opacity:.6">37</span></span>${PEOPLE.map(k=>`<span class="pill">${av(k,22)}${P[k].n} <span style="opacity:.6">${cnt[k]}</span></span>`).join('')}
      <div style="flex:1"></div><span class="pill wkp" data-w="1">This week</span><span class="pill wkp" data-w="2">Next week</span></div>
    <div class="wk-view"><div class="wk-track">${weekGrid(W1,true)}${weekGrid(W2,false)}</div></div></div>`;
}

/* ── Home ── */
function scrHome(){
  const L = [['Kitchen',80,true],['Living room',60,false],['Dining',70,false],['Porch',100,false],['Office',45,true],['Kids’ room',30,false]];
  return `<div class="scr" data-s="home"><div style="display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:16px;height:717px">
    <div class="col rise" style="gap:16px;--i:0">
      <div class="card">${head('Scenes')}<div style="margin-top:10px">${scenes(2,96)}</div></div>
      <div class="card col" style="flex:1;gap:14px">${head('Climate')}
        <div class="row" style="justify-content:space-between;margin-top:10px"><span class="icn" style="width:56px;height:56px">${I('minus',22)}</span>
          <div style="text-align:center"><div style="font-size:76px;font-weight:600;letter-spacing:-.03em;line-height:1">70°</div><div style="font-size:14px;color:var(--c-mute);margin-top:6px">Set · inside 68°</div></div>
          <span class="icn" style="width:56px;height:56px">${I('plus',22)}</span></div>
        <div class="row" style="gap:8px;justify-content:center;margin-top:auto"><span class="pill on">Heat</span><span class="pill">Cool</span><span class="pill">Off</span></div></div></div>
    <div class="card col rise" style="--i:1">${head('Lights')}
      <div style="display:flex;flex-direction:column;gap:10px">${L.map((l,i)=>light(l[0],l[1],l[2],i)).join('')}</div></div>
    <div class="col rise" style="gap:16px;--i:2">
      <div class="card col" style="gap:10px">${head('Locks & doors')}${[['Front door','Locked','lock'],['Back door','Locked','lock'],['Garage','Closed','garage']].map(d=>`<div class="dev"><span class="ic">${I(d[2],18)}</span><span><div class="nm">${d[0]}</div><div class="st">${d[1]}</div></span></div>`).join('')}</div>
      <div class="card col" style="flex:1;gap:10px;padding:16px">${head('Cameras','All')}<div class="cam" style="height:210px"><img src="${IMG.cam}" alt="" loading="lazy"><span class="tag"><i></i>LIVE</span><span class="nm">Backyard</span></div></div>
    </div></div></div>`;
}

/* ── The shell: rail, header, content box ── */
const RAIL = [['today','cal','Today'],['week','week','Week'],['meals','meals','Meals'],['lists','list','Lists'],['chores','chores','Chores'],['home','home','Home'],['cams','cam','Cameras']];
const HEAD = {today:['Tuesday, October 27','10:42 · 64° rain after 3'],week:['Week','This week · Oct 25 – 31'],week2:['Week','Next week · Nov 1 – 7'],home:['Home','2 lights on · 70° heat · locked'],homelit:['Home','4 lights on · 70° heat · locked']};
function hubHTML(){
  return `<div class="h-rail"><span class="h-ind"></span>${RAIL.map(r=>`<span class="h-nav" data-k="${r[0]}">${I(r[1],24)}${r[2]}</span>`).join('')}
    <span class="h-photos"><span class="thumb"><img src="${IMG.hero}" alt=""></span>Photos</span></div>
    <div class="h-head"><div><div class="h-title"></div><div class="h-sum"></div></div><div style="flex:1"></div>
      <span class="row" style="gap:6px">${PEOPLE.map(k=>av(k,34,!P[k].home)).join('')}</span><span class="icn">${I('bell',20)}<span class="badge">2</span></span><span class="btn pri">${I('plus',18)} Add</span></div>
    <div class="h-content">${scrToday()}${scrWeek()}${scrHome()}</div>`;
}
/* The Wall's overlay without the cue: used for build-log thumbnails. The hero's Wall is static HTML (works without JS). */
function wallHTML(photo){
  return `<div class="kb"><img src="${IMG[photo]}" alt="" loading="lazy"></div>
  <div class="w-ov"><div class="s s-bl"></div><div class="s s-tr"></div>
    <div class="abs w-temp"><b>64°</b><span>Rain after 3</span></div>
    <div class="abs w-time"><div class="w-date">Tuesday, October 27</div><div class="w-clock">10:42</div>
      <div class="w-next"><i>NEXT</i><b>11 AM&nbsp; Library story time</b><span>Riley</span></div></div></div>`;
}

/* ── Hub state: screen, week slide, lamps; replays the rise like the shell does ── */
function replay(el){ el.classList.remove('play'); void el.offsetWidth; el.classList.add('play'); }
function tick(el,text){ if(el.textContent===text) return; el.textContent=text; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
function setHead(hub,key){
  const T=hub.querySelector('.h-title'), S=hub.querySelector('.h-sum');
  if(!T||!HEAD[key]) return; tick(T,HEAD[key][0]); tick(S,HEAD[key][1]);
}
function showScreen(hub,s,{rise=true}={}){
  hub.querySelectorAll('.scr').forEach(x=>x.classList.toggle('on-scr',x.dataset.s===s));
  hub.style.setProperty('--ni',RAIL.findIndex(r=>r[0]===s));
  hub.querySelectorAll('.h-nav').forEach(n=>n.classList.toggle('cur',n.dataset.k===s));
  hub.dataset.cur=s; setWeek(hub,1); setLit(hub,false); setHead(hub,s);
  if(rise) replay(hub);
}
function setWeek(hub,w){
  hub.classList.toggle('wk2',w===2);
  hub.querySelectorAll('.wkp').forEach(p=>p.classList.toggle('on',+p.dataset.w===w));
  if(hub.dataset.cur==='week') setHead(hub,w===2?'week2':'week');
}
/* Dinner scene: the table lights ripple on, 40 ms apart (the product's --dur-ripple). */
const LIT_DEFAULT = {Kitchen:1,Office:1}, LIT_DINNER = {Kitchen:1,Office:1,Dining:1,'Living room':1};
function setLit(hub,dinner){
  const scr=hub.querySelector('[data-s="home"]'); if(!scr) return;
  const want=dinner?LIT_DINNER:LIT_DEFAULT; let r=0;
  scr.querySelectorAll('[data-light]').forEach(t=>{ const on=!!want[t.dataset.light];
    if(on!==t.classList.contains('is-on')) t.style.setProperty('--r',r++); t.classList.toggle('is-on',on); });
  const d=scr.querySelector('[data-scene="Dinner"]');
  if(d){ clearTimeout(d._t); d.classList.toggle('pressed',dinner); if(dinner) d._t=setTimeout(()=>d.classList.remove('pressed'),2400); }
  if(hub.dataset.cur==='home') setHead(hub,dinner?'homelit':'home');
}
function wake(hub,s='today'){ hub.classList.remove('asleep'); showScreen(hub,s); }
function sleep(hub){ hub.classList.add('asleep'); }

/* ── Build-log thumbnails: a hub screen or the Wall, scaled to the card's width ── */
function mountMinis(root=document){
  root.querySelectorAll('[data-mini]').forEach(f=>{
    if(f.dataset.ready) return; f.dataset.ready=1;
    const kind=f.dataset.mini;
    if(kind.startsWith('wall:')){ f.innerHTML=`<div class="wall">${wallHTML(kind.slice(5))}</div>`; return; }
    f.innerHTML='<div class="hub rl"></div>';
    const h=f.firstElementChild; h.innerHTML=hubHTML(); h.querySelector('.thumb').classList.add('shown'); showScreen(h,kind,{rise:false});
  });
  fitMinis(root);
}
function fitMinis(root=document){
  root.querySelectorAll('[data-mini]').forEach(f=>{ const c=f.firstElementChild; if(c) c.style.transform=`scale(${f.clientWidth/1263})`; });
}

/* ── Scroll reveals (opacity with a rise; CSS gates them behind .js) ── */
function watchReveals(root=document){
  if(!('IntersectionObserver' in window)){ root.querySelectorAll('.rv').forEach(el=>el.classList.add('in')); return; }
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{threshold:.2});
  root.querySelectorAll('.rv').forEach(el=>io.observe(el));
}

let rz; addEventListener('resize',()=>{ cancelAnimationFrame(rz); rz=requestAnimationFrame(()=>fitMinis()); });

window.HR = {IMG,ALT,I,hubHTML,showScreen,setWeek,setLit,wake,sleep,replay,mountMinis,fitMinis,watchReveals};
})();
