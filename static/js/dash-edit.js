/* LUMIO — tableau de bord en mode édition. Appui long sur un module (ou bouton « Personnaliser ») :
   le module se soulève ; le glisser le déplace (d'une section à l'autre aussi), la poignée du coin
   change sa largeur, le bouton œil le masque, la corbeille aussi. Souris, doigt et clavier (boutons
   avant / après) ; disposition gardée sur cet appareil. Pendant l'édition, rien ne se rafraîchit. */
(function () {
'use strict';
const L = window.L;
const SPAN = { kpi: 2, third: 4, half: 6, lead: 6, twothird: 8, full: 12 };
const SZL = { kpi: 'Petit', third: '1/3', half: '1/2', lead: '1/2', twothird: '2/3', full: 'Largeur' };
const ALLOWED = { kpi: ['kpi', 'third', 'half'], lead: ['lead', 'twothird', 'full'], third: ['third', 'half', 'twothird', 'full'],
  half: ['third', 'half', 'twothird', 'full'], twothird: ['half', 'twothird', 'full'], full: ['half', 'twothird', 'full'] };
const E = { on: false, drag: null, press: null, obs: null, swallow: 0, rs: null, undo: null };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = () => document.getElementById('dash');
const mods = () => [...document.querySelectorAll('#dash .dash > .w[data-mod]')];
const NOPRESS = 'button,select,input,textarea,a.lnk,.seg,.chip,#b1c,.sky-svg,.tm-dot,.ed-rs';
const allowed = id => ALLOWED[L.dash.MODS[id]?.sz] || ['third', 'half', 'twothird', 'full'];

/* ── Barre d'édition de chaque module ── */
function addBar(el) {
  if (el.querySelector(':scope > .ed-bar')) return;
  const id = el.dataset.mod, M = L.dash.MODS[id]; if (!M) return;
  const sz = el.dataset.sz;
  const b = document.createElement('div');
  b.className = 'ed-bar'; b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', `Module ${M.t}`);
  b.innerHTML = `<span class="ed-grip" aria-hidden="true">${L.icon('grip')}</span><b class="ell">${L.esc(M.t)}</b>
    <button type="button" class="ed-btn" data-ed="prev" aria-label="Déplacer ${L.esc(M.t)} avant" title="Avant">${L.icon('chevl')}</button>
    <button type="button" class="ed-btn" data-ed="next" aria-label="Déplacer ${L.esc(M.t)} après" title="Après">${L.icon('chev')}</button>
    ${allowed(id).length > 1 ? `<button type="button" class="ed-btn ed-sz" data-ed="size" aria-label="Largeur de ${L.esc(M.t)} : ${SZL[sz] || sz}, changer" title="Changer la largeur">${SZL[sz] || sz}</button>` : ''}
    <button type="button" class="ed-btn" data-ed="hide" aria-label="Masquer ${L.esc(M.t)}" title="Masquer">${L.icon('eyeoff')}</button>`;
  el.prepend(b);
  if (allowed(id).length > 1) {
    const rs = document.createElement('span'); rs.className = 'ed-rs'; rs.title = 'Glisser pour changer la largeur'; rs.setAttribute('aria-hidden', 'true');
    el.append(rs);
  }
}
const decorate = () => mods().forEach(addBar);

/* ── Barre du bas : aide, modules masqués, rétablir, terminé ; corbeille pendant un glissement ── */
function dock() {
  let d = document.getElementById('edDock');
  if (!d) { d = document.createElement('div'); d.id = 'edDock'; d.className = 'ed-dock'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Édition du tableau de bord'); document.body.append(d); }
  const hid = L.dash.layout().hidden.length;
  d.innerHTML = `<div class="ed-help">${L.coarse ? 'Maintenez un module puis glissez-le' : 'Glissez un module pour le déplacer ; le coin change sa largeur'}</div>
    <div class="ed-acts"><button type="button" class="btn sm" data-edd="more">${L.icon('sliders')}Modules${hid ? ` masqués (${hid})` : ''}</button>
    <button type="button" class="btn sm g" data-edd="reset">${L.icon('refresh')}Rétablir</button>
    <button type="button" class="btn sm p" data-edd="done">${L.icon('check')}Terminé</button></div>
    <div class="ed-trash" aria-hidden="true">${L.icon('trash')}<span>Déposer ici pour masquer le module</span></div>`;
  return d;
}

/* ── Disposition : ordre lu dans la page ; les modules masqués gardent leur section ── */
function persist() {
  const l = L.dash.layout();
  document.querySelectorAll('#dash .dash[data-sec]').forEach(g => {
    const sec = g.dataset.sec;
    const vis = [...g.children].map(c => c.dataset.mod).filter(id => id && L.dash.MODS[id]);
    const hid = (l.order[sec] || []).filter(id => l.hidden.includes(id) && !vis.includes(id));
    l.order[sec] = vis.concat(hid);
  });
  mods().forEach(el => { if (el.dataset.sz !== L.dash.MODS[el.dataset.mod]?.sz) l.size[el.dataset.mod] = el.dataset.sz; else delete l.size[el.dataset.mod]; });
  L.dash.save(l);
  document.querySelectorAll('#dash .dsec').forEach(s => {
    const g = s.querySelector('.dash');
    s.classList.toggle('empty', !g.querySelector('[data-mod]'));
    g.style.setProperty('--lead', L.dash.leadOf([...g.children].map(c => c.dataset.mod).filter(Boolean)));
  });
}

/* Animation des voisins (FLIP) quand l'emplacement libre se déplace */
function flip(change) {
  const els = mods().filter(m => !m.classList.contains('ed-lift'));
  const before = new Map(els.map(m => [m, m.getBoundingClientRect()]));
  change();
  if (reduce()) return;
  els.forEach(m => {
    const a = before.get(m), b = m.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    m.style.transition = 'none'; m.style.transform = `translate(${dx}px,${dy}px)`;
    requestAnimationFrame(() => { m.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; m.style.transform = ''; });
  });
}

function hideMod(el) {
  const id = el.dataset.mod; const g = el.parentElement; const next = el.nextElementSibling;
  const l = L.dash.layout();
  if (!l.hidden.includes(id)) l.hidden.push(id);
  L.dash.save(l);
  flip(() => el.remove());
  persist(); dock();
  E.undo = () => { const l2 = L.dash.layout(); l2.hidden = l2.hidden.filter(x => x !== id); L.dash.save(l2); g.insertBefore(el, next && next.parentElement === g ? next : null); persist(); dock(); };
  L.toast(`« ${L.dash.MODS[id].t} » masqué`, false, { label: 'Annuler', fn: () => E.undo && E.undo() });
}

function cycleSize(el) {
  const id = el.dataset.mod, al = allowed(id);
  const i = al.indexOf(el.dataset.sz);
  setSize(el, al[(i + 1) % al.length]);
}
function setSize(el, sz) {
  if (el.dataset.sz === sz) return;
  flip(() => { el.dataset.sz = sz; });
  const b = el.querySelector('.ed-sz'); if (b) { b.textContent = SZL[sz] || sz; b.setAttribute('aria-label', `Largeur de ${L.dash.MODS[el.dataset.mod].t} : ${SZL[sz] || sz}, changer`); }
  persist();
  clearTimeout(el._rr); el._rr = setTimeout(() => L.dash.rerender(el.dataset.mod), 250);
}

/* ── Entrer et sortir du mode édition ── */
function enter() {
  if (E.on || !root()) return;
  E.on = true;
  root().classList.add('editing');
  document.documentElement.classList.add('dash-editing');
  decorate();
  dock();
  // un rendu tardif (donnée arrivée) remplace le contenu d'un module : la barre est remise
  E.obs = new MutationObserver(() => { if (E.on) decorate(); });
  mods().forEach(m => E.obs.observe(m, { childList: true }));
  L.live && L.live('Mode édition du tableau de bord');
}
function exit() {
  if (!E.on) return;
  E.on = false;
  E.obs && E.obs.disconnect(); E.obs = null;
  document.querySelectorAll('#dash .ed-bar, #dash .ed-rs').forEach(n => n.remove());
  root()?.classList.remove('editing');
  document.documentElement.classList.remove('dash-editing');
  document.getElementById('edDock')?.remove();
  persist();
  L.live && L.live('Disposition enregistrée');
  L.dash.refill();                     // redessin propre (graphiques à leur nouvelle largeur, données à jour)
}

/* ── Glisser-déposer ── */
function startDrag(el, x, y) {
  const r = el.getBoundingClientRect();
  const ph = document.createElement('div');
  ph.className = 'w ed-ph'; ph.dataset.sz = el.dataset.sz; ph.style.height = r.height + 'px';
  el.parentElement.insertBefore(ph, el);
  E.drag = { el, ph, dx: x - r.left, dy: y - r.top, x, y, x0: x, y0: y, moved: false, over: null, raf: 0 };
  // soulevé dans <body> : un ancêtre transformé fausserait la position fixe
  document.body.append(el);
  Object.assign(el.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 210, transform: '', margin: 0 });
  el.classList.add('ed-lift');
  document.getElementById('edDock')?.classList.add('dragging');
  if (navigator.vibrate && L.coarse) try { navigator.vibrate(12); } catch (e) { /* facultatif */ }
  autoScroll();
}
/* Défilement automatique près des bords (sous la barre du haut, au-dessus de la barre d'édition),
   seulement une fois le module réellement déplacé : le prendre en bas de l'écran ne fait rien défiler */
function autoScroll() {
  const D = E.drag; if (!D) return;
  if (D.moved) {
    const top = (document.getElementById('tb')?.getBoundingClientRect().bottom || 56) + 40;
    const dk = document.getElementById('edDock')?.getBoundingClientRect().top || innerHeight;
    const bot = dk - 56, y = D.y;                      // sur la corbeille elle-même : pas de défilement
    const v = y < top ? -Math.min(14, Math.ceil((top - y) / 4)) : y > bot && y < dk ? Math.min(14, Math.ceil((y - bot) / 4)) : 0;
    if (v) { window.scrollBy(0, v); moveDrag(D.x, D.y); }
  }
  D.raf = requestAnimationFrame(autoScroll);
}
function moveDrag(x, y) {
  const D = E.drag; if (!D) return;
  if (!D.moved && Math.hypot(x - D.x0, y - D.y0) > 12) D.moved = true;
  D.x = x; D.y = y;
  D.el.style.transform = `translate(${x - D.dx - parseFloat(D.el.style.left)}px,${y - D.dy - parseFloat(D.el.style.top)}px) rotate(.6deg)`;
  const t = document.elementFromPoint(x, y);
  const trash = t && t.closest('.ed-trash');
  document.querySelector('.ed-trash')?.classList.toggle('hot', !!trash);
  D.over = trash ? 'trash' : null;
  if (trash || !t) return;
  const tgt = t.closest('#dash .dash > .w[data-mod]');
  const grid = t.closest('#dash .dash') || t.closest('#dash .dsec')?.querySelector('.dash');
  if (tgt && tgt !== D.el) {
    const r = tgt.getBoundingClientRect(), gw = tgt.parentElement.getBoundingClientRect().width;
    const before = r.width < gw * .7 ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    const ref = before ? tgt : tgt.nextElementSibling;
    if (ref !== D.ph && (before ? tgt.previousElementSibling !== D.ph : tgt.nextElementSibling !== D.ph)) flip(() => tgt.parentElement.insertBefore(D.ph, ref));
  } else if (grid && !tgt && D.ph.parentElement !== grid) {
    const last = [...grid.children].filter(c => c !== D.el).pop();
    if (!last || y > last.getBoundingClientRect().bottom - 4) flip(() => grid.append(D.ph));
  }
}
function endDrag(cancel = false) {
  const D = E.drag; if (!D) return;
  cancelAnimationFrame(D.raf);
  E.drag = null;
  document.getElementById('edDock')?.classList.remove('dragging');
  document.querySelector('.ed-trash')?.classList.remove('hot');
  const el = D.el;
  if (D.over === 'trash' && !cancel) {
    D.ph.replaceWith(el); el.classList.remove('ed-lift'); el.removeAttribute('style');
    hideMod(el);
    return;
  }
  // retour en douceur vers l'emplacement libre
  const to = D.ph.getBoundingClientRect();
  const finish = () => { D.ph.replaceWith(el); el.classList.remove('ed-lift'); el.removeAttribute('style'); persist(); L.dash.rerender(el.dataset.mod); };
  if (reduce() || cancel) { if (cancel) { D.ph.replaceWith(el); el.classList.remove('ed-lift'); el.removeAttribute('style'); } else finish(); return; }
  el.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)';
  el.style.transform = `translate(${to.left - parseFloat(el.style.left)}px,${to.top - parseFloat(el.style.top)}px)`;
  setTimeout(finish, 210);
}

/* ── Poignée de largeur : la case suit le pointeur, arrondie à 1/3, 1/2, 2/3 ou toute la largeur ── */
function startResize(el, x) {
  const g = el.parentElement.getBoundingClientRect();
  const cols = getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length || 12;
  E.rs = { el, x0: x, w0: el.getBoundingClientRect().width, col: g.width / cols, cols };
  el.classList.add('ed-resizing');
}
function moveResize(x) {
  const R = E.rs; if (!R) return;
  const want = Math.max(R.col, R.w0 + (x - R.x0)) / R.col * (12 / R.cols);
  const al = allowed(R.el.dataset.mod);
  const best = al.reduce((a, b) => Math.abs(SPAN[b] - want) < Math.abs(SPAN[a] - want) ? b : a, al[0]);
  setSize(R.el, best);
}

/* ── Pointeur : appui long (hors édition) ou glissement (en édition) ── */
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !root()) return;
  const el = e.target.closest('#dash .dash > .w[data-mod]');
  if (!el || el.classList.contains('sk-on')) return;
  if (E.on && e.target.closest('.ed-rs')) { e.preventDefault(); startResize(el, e.clientX); return; }
  if (e.target.closest('.ed-bar button')) return;
  if (!E.on && e.target.closest(NOPRESS)) return;
  const touch = e.pointerType !== 'mouse';
  E.press = { el, x: e.clientX, y: e.clientY, id: e.pointerId, touch, t: performance.now(), timer: 0, started: false };
  if (!E.on || touch) {
    // appui long : 450 ms hors édition, 220 ms au doigt en édition (le défilement reste possible)
    if (touch) el.classList.add('ed-press-sel');
    E.press.timer = setTimeout(() => {
      const P = E.press; if (!P || P.started) return;
      if (!E.on) enter();
      P.started = true; E.swallow = Date.now();
      el.classList.remove('ed-pressing');
      startDrag(el, P.x, P.y);
    }, E.on ? 220 : 450);
    if (!E.on) setTimeout(() => { if (E.press && E.press.el === el && !E.press.started) el.classList.add('ed-pressing'); }, 160);
  }
}, true);
document.addEventListener('pointermove', e => {
  if (E.rs) { moveResize(e.clientX); return; }
  const P = E.press; if (!P) return;
  if (E.drag) { e.preventDefault(); moveDrag(e.clientX, e.clientY); return; }
  const moved = Math.hypot(e.clientX - P.x, e.clientY - P.y);
  if (E.on && !P.touch && moved > 5) {                       // souris en édition : glisser tout de suite
    clearTimeout(P.timer); P.started = true; E.swallow = Date.now();
    startDrag(P.el, P.x, P.y); moveDrag(e.clientX, e.clientY);
  } else if (moved > 8) cancelPress();                          // c'était un défilement ou une sélection
}, { passive: false });
const release = e => {
  if (E.rs) { E.rs.el.classList.remove('ed-resizing'); E.rs = null; return; }
  if (E.drag) endDrag(e.type === 'pointercancel');
  cancelPress();
};
const cancelPress = () => {
  const P = E.press; if (!P) return;
  clearTimeout(P.timer); P.el.classList.remove('ed-pressing', 'ed-press-sel'); E.press = null;
};
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
// pendant un glissement au doigt, la page ne défile pas (le module suit le doigt)
document.addEventListener('touchmove', e => { if (E.drag) e.preventDefault(); }, { passive: false });
// un appui long ne se termine ni en clic (lien de la carte) ni en menu contextuel
document.addEventListener('click', e => { if (Date.now() - E.swallow < 400 && e.target.closest('#dash')) { e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('contextmenu', e => { if (E.press || E.drag || (E.on && e.target.closest('#dash .w'))) e.preventDefault(); });
// en édition, les modules ne s'ouvrent pas : seuls les boutons d'édition répondent
document.addEventListener('click', e => {
  if (!E.on) return;
  const b = e.target.closest('[data-ed]');
  if (b) {
    e.preventDefault(); e.stopPropagation();
    const el = b.closest('.w[data-mod]'); const k = b.dataset.ed;
    if (k === 'hide') hideMod(el);
    else if (k === 'size') cycleSize(el);
    else if (k === 'prev' || k === 'next') {
      const sib = k === 'prev' ? el.previousElementSibling : el.nextElementSibling;
      if (sib) flip(() => el.parentElement.insertBefore(el, k === 'prev' ? sib : sib.nextElementSibling));
      else {                                               // bord de section : passe à la section voisine
        const secs = [...document.querySelectorAll('#dash .dsec')];
        const i = secs.indexOf(el.closest('.dsec')); const to = secs[i + (k === 'prev' ? -1 : 1)]?.querySelector('.dash');
        if (to) { to.closest('.dsec').classList.remove('empty'); flip(() => k === 'prev' ? to.append(el) : to.prepend(el)); }
      }
      persist(); b.focus();
    }
    return;
  }
  const d = e.target.closest('[data-edd]');
  if (d) {
    const k = d.dataset.edd;
    if (k === 'done') exit();
    else if (k === 'reset') { exit(); L.dash.reset(); L.toast('Disposition d\'origine rétablie'); }
    else if (k === 'more') { exit(); L.dash.customize(); }
    return;
  }
  if (e.target.closest('#dash .w[data-mod]')) { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener('keydown', e => {
  if (!E.on) return;
  if (e.key === 'Escape') { if (E.drag) endDrag(true); else exit(); }
});
// quitter le tableau de bord ferme l'édition (sans redessiner une vue disparue)
window.addEventListener('hashchange', () => { if (E.on && !location.hash.startsWith('#/accueil') && location.hash !== '' && location.hash !== '#/') { E.on = false; document.getElementById('edDock')?.remove(); document.documentElement.classList.remove('dash-editing'); persist(); } });

L.dashEdit = { get on() { return E.on; }, enter, exit, toggle() { E.on ? exit() : enter(); } };
})();
