/* LUMIO — mouvement : la pastille de l'onglet actif glisse d'un onglet à l'autre (barre du haut,
   sélecteurs de période, sous-onglets, barre du bas), le logo s'anime au clic, et un ciel vivant
   (nébuleuses, étoiles, étoile filante) passe derrière les cartes. « Réduire les animations » du
   système arrête tout, sauf si le fond est réglé sur « toujours animé ». */
(function () {
'use strict';
const L = window.L;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Pastille glissante ──
   Un seul indicateur par groupe, derrière le texte (les libellés gardent leur taille et leur place) ;
   il se déplace en transform. Un groupe redessiné (période changée, vue rafraîchie) repart de la
   position qu'avait son prédécesseur : le glissement se voit même quand le HTML est remplacé. */
const GROUPS = [
  { sel: '.nav', item: 'a', kind: 'pill' },
  { sel: '.seg', item: 'button', kind: 'pill' },
  { sel: '.subnav', item: 'a', kind: 'line' },
  { sel: '.bn', item: 'a', kind: 'top' },
];
const last = new Map();        // groupe -> dernière position, signature (libellés) et instant
let raf = 0;

function place(ind, kind, it) {
  if (kind === 'top') return { x: it.offsetLeft + (it.offsetWidth - 26) / 2, y: 0, w: 26, h: 3 };
  if (kind === 'line') return { x: it.offsetLeft, y: it.offsetTop + it.offsetHeight - 2, w: it.offsetWidth, h: 2 };
  return { x: it.offsetLeft, y: it.offsetTop, w: it.offsetWidth, h: it.offsetHeight };
}
const apply = (ind, r) => {
  ind.style.transform = `translate(${r.x}px,${r.y}px)`;
  ind.style.width = r.w + 'px';
  ind.style.height = r.h + 'px';
};
/* Glissement en transform seul (FLIP) : taille finale posée tout de suite, départ simulé par une
   échelle ; l'animation tourne hors du fil principal, donc fluide même pendant le rendu d'une vue */
function slide(ind, from, to) {
  if (!from || reduce()) { apply(ind, to); return; }
  ind.classList.add('ni');
  ind.style.width = to.w + 'px';
  ind.style.height = to.h + 'px';
  ind.style.transform = `translate(${from.x}px,${from.y}px) scale(${from.w / to.w},${from.h / to.h})`;
  void ind.offsetWidth;
  ind.classList.remove('ni');
  ind.style.transform = `translate(${to.x}px,${to.y}px)`;
}

function sync() {
  raf = 0;
  const count = new Map();
  for (const G of GROUPS) {
    document.querySelectorAll(G.sel).forEach(g => {
      const base = g.id || `${G.sel}|${g.getAttribute('aria-label') || ''}`;
      const n = (count.get(base) || 0) + 1; count.set(base, n);
      const key = `${base}#${n}`;
      const sig = [...g.children].map(c => c.textContent.trim()).join('|');
      const on = [...g.children].find(c => c.matches(`${G.item}.on`));
      let ind = [...g.children].find(c => c.classList.contains('mv-ind'));
      if (!on || !g.getClientRects().length) { if (ind) ind.style.opacity = '0'; return; }   // barre fixe : offsetParent nul
      const r = place(ind, G.kind, on);
      if (!r.w) return;
      const fresh = !ind;
      if (fresh) {
        ind = document.createElement('span');
        ind.className = `mv-ind mv-${G.kind} ni`;
        ind.setAttribute('aria-hidden', 'true');
        g.append(ind);
        g.classList.add('mv-on');
        // Même groupe redessiné à l'instant (mêmes libellés) : départ de l'ancienne position
        const prev = last.get(key);
        const again = prev && prev.sig === sig && performance.now() - prev.t < 1500;
        apply(ind, r);
        ind.dataset.p = `${r.x},${r.y},${r.w},${r.h}`;
        if (again) slide(ind, prev.r, r); else { void ind.offsetWidth; ind.classList.remove('ni'); }
        ind._r = r;
      }
      ind.style.opacity = '';
      const cur = ind.dataset.p, nxt = `${r.x},${r.y},${r.w},${r.h}`;
      if (cur !== nxt) { slide(ind, ind._r, r); ind.dataset.p = nxt; ind._r = r; }
      last.set(key, { r, sig, t: performance.now() });
    });
  }
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
new MutationObserver(recs => {
  for (const r of recs) {
    const t = r.target;
    if (t.nodeType === 1 && (t.closest?.('.nav,.seg,.subnav,.bn') || r.type === 'childList')) { schedule(); return; }
  }
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
window.addEventListener('resize', schedule);
document.fonts?.ready.then(schedule);
schedule();
L.syncPills = schedule;

/* ── Logo : la lettre se retrace et l'étoile tourne, au clic (comme à l'ouverture) ── */
const brand = document.querySelector('.brand');
if (brand) {
  const img = brand.querySelector('img');
  if (img) {
    img.outerHTML = `<svg class="brand-ic" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true"><defs><linearGradient id="brg" x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6FA8FF"/><stop offset="1" stop-color="#8A6CFF"/></linearGradient></defs>
      <rect class="br-bg" width="64" height="64" rx="15" fill="url(#brg)"/>
      <path class="br-l" pathLength="1" d="M21 15v32h25" fill="none" stroke="#090B1D" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="br-s" d="M46 11.5l1.9 4.6 4.6 1.9-4.6 1.9L46 24.5l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#090B1D"/></svg>`;
  }
  brand.addEventListener('click', () => {
    if (reduce()) return;
    brand.classList.remove('play'); void brand.offsetWidth; brand.classList.add('play');
  });
  brand.addEventListener('animationend', e => { if (e.target.classList?.contains('br-s')) brand.classList.remove('play'); });
}

/* ── Fond : ciel vivant. Nébuleuses qui dérivent (CSS, sur le compositeur), étoiles qui scintillent
   et dérivent lentement, étoile filante de temps en temps (canevas, 30 images/s au plus, en pause
   onglet caché). Réglages, Affichage : automatique (suit « réduire les animations » du système),
   toujours animé, ou fixe. ── */
const bgMode = () => { const m = L.store.get('bg.mode', 'auto'); return ['auto', 'on', 'off'].includes(m) ? m : 'auto'; };
const animOK = () => bgMode() === 'on' || (bgMode() === 'auto' && !reduce());
let sky = document.querySelector('.bg-sky');
if (!sky) {
  document.querySelector('.bg-drift')?.remove();
  sky = document.createElement('div');
  sky.className = 'bg-sky'; sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = '<i class="nb nb1"></i><i class="nb nb2"></i><i class="nb nb3"></i><canvas></canvas>';
  document.body.prepend(sky);
}
const cv = sky.querySelector('canvas'), g = cv.getContext && cv.getContext('2d');
const COLS = ['237,233,223', '182,166,255', '143,203,255'];        // papier, nébuleuse, étoile chaude
let W = 0, H = 0, stars = [], shoot = null, nextShoot = 0, loop = 0, lastF = 0;
const t0 = performance.now();
function initSky() {
  if (!g) return;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(Math.min(260, Math.max(80, W * H / 7000)));
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H, r: .35 + Math.random() ** 2.2 * 1.35, a: .3 + Math.random() * .6,
    w: .5 + Math.random() * 1.9, p: Math.random() * 6.283, z: .25 + Math.random() * .75,
    c: Math.random() < .12 ? 1 : Math.random() < .16 ? 2 : 0,
  }));
}
function drawSky(now) {
  if (!g) return;
  const t = (now - t0) / 1000, moving = animOK();
  g.clearRect(0, 0, W, H);
  for (const s of stars) {
    const tw = moving ? .5 + .5 * Math.sin(t * s.w + s.p) : .75;
    let x = s.x, y = s.y;
    if (moving) { x = ((s.x - t * 4 * s.z) % W + W) % W; y = ((s.y + t * 1.2 * s.z) % H + H) % H; }
    g.globalAlpha = s.a * (.35 + .65 * tw);
    g.fillStyle = `rgb(${COLS[s.c]})`;
    g.beginPath(); g.arc(x, y, s.r, 0, 6.283); g.fill();
    if (s.r > 1.25 && tw > .8) {                                  // les plus brillantes : petite croix
      g.globalAlpha = s.a * (tw - .8) * 2.2; g.fillRect(x - s.r * 3, y - .25, s.r * 6, .5); g.fillRect(x - .25, y - s.r * 3, .5, s.r * 6);
    }
  }
  if (moving) {
    if (!shoot && t > nextShoot) {
      const ang = Math.PI * (1.06 + Math.random() * .1);
      shoot = { x: W * (.25 + Math.random() * .7), y: H * Math.random() * .35, vx: Math.cos(ang) * -1, vy: Math.sin(ang) * -1,
        sp: 700 + Math.random() * 400, len: 110 + Math.random() * 90, t: t };
      nextShoot = t + 9 + Math.random() * 12;
    }
    if (shoot) {
      const k = t - shoot.t, life = .95;
      if (k > life) shoot = null;
      else {
        const hx = shoot.x + shoot.vx * shoot.sp * k, hy = shoot.y + shoot.vy * shoot.sp * k;
        const tx = hx - shoot.vx * shoot.len, ty = hy - shoot.vy * shoot.len;
        const fade = Math.sin(Math.PI * k / life);
        const gr = g.createLinearGradient(hx, hy, tx, ty);
        gr.addColorStop(0, `rgba(237,233,223,${(.9 * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(182,166,255,0)');
        g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
}
function frame(now) {
  loop = 0;
  if (document.hidden || !animOK()) return;
  if (now - lastF >= 33) { lastF = now; drawSky(now); }
  loop = requestAnimationFrame(frame);
}
L.applyBg = () => {
  const m = bgMode();
  document.documentElement.classList.toggle('bg-off', m === 'off');
  document.documentElement.classList.toggle('bg-force', m === 'on');
  document.documentElement.classList.toggle('bg-still', !animOK());
  if (m === 'off') { if (loop) cancelAnimationFrame(loop); loop = 0; return; }
  if (!W) initSky();
  drawSky(performance.now());
  if (animOK() && !loop && !document.hidden) loop = requestAnimationFrame(frame);
};
window.addEventListener('resize', L.debounce ? L.debounce(() => { initSky(); L.applyBg(); }, 200) : () => { initSky(); L.applyBg(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) L.applyBg(); });
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => L.applyBg());
initSky();
L.applyBg();
})();
