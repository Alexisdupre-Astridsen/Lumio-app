/* LUMIO — graphiques SVG/HTML sans dépendance : courbe avec réticule et balayage tactile,
   sparklines, colonnes, treemap « squarified », heatmap, éventail Monte-Carlo, jauge. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart = {};
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/* Graduations « rondes » pour un axe */
C.ticks = (lo, hi, n = 3, retry = true) => {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / n; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n + 0.5) || 10 * mag;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out.length < 3 && retry ? C.ticks(lo, hi, n + 2, false) : out;   // jamais moins de 3 repères
};

/* ── Courbe : série(s) alignée(s) sur un même axe temporel (index), un seul axe Y à droite ── */
C.line = (el, o) => {
  const st = { o, hover: null };
  el.classList.add('ch');
  el.tabIndex = 0;
  el.setAttribute('role', 'img');
  if (o.label) el.setAttribute('aria-label', o.label);
  const tip = document.createElement('div'); tip.className = 'tip';
  const draw = (animate) => {
    if (!el.isConnected && st.svg) return;
    const { t, series } = st.o;
    const n = t.length;
    const W = Math.max(120, el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 600), H = st.o.h || 240;
    const pL = st.o.padL ?? 0, pR = st.o.padR ?? 54, pT = st.o.padT ?? 14, pB = st.o.padB ?? 24;
    if (n < 2) { el.innerHTML = `<div class="empty" style="height:${H}px;display:grid;place-items:center">Pas assez de points pour tracer la courbe.</div>`; return; }
    const all = [];
    series.forEach(s => { if (!s.noScale) s.v.forEach(v => { if (v != null && isFinite(v)) all.push(v); }); });
    if (st.o.ref && st.o.ref.v != null) all.push(st.o.ref.v);
    (st.o.refs || []).forEach(rf => { if (rf.scale && rf.v != null && isFinite(rf.v)) all.push(rf.v); });
    let lo = st.o.yMin ?? Math.min(...all), hi = st.o.yMax ?? Math.max(...all);
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1; lo -= pad; hi += pad;
    const X = i => pL + (i / (n - 1)) * (W - pL - pR);
    const Y = v => pT + ((hi - v) / (hi - lo)) * (H - pT - pB);
    st.X = X; st.Y = Y; st.W = W; st.H = H; st.n = n; st.pL = pL; st.pR = pR;
    const id = 'g' + (++uid);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="${NS}"><defs><clipPath id="${id}c"><rect x="${pL - 6}" y="${pT - 6}" width="${W - pL - pR + 12}" height="${H - pT - pB + 6}"/></clipPath>`;
    series.forEach((se, k) => { if (se.area) s += `<linearGradient id="${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity=".16"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>`; });
    s += '</defs><g class="grid">';
    const tk = C.ticks(lo, hi, st.o.nTicks || 3);
    tk.forEach(v => { s += `<line x1="${pL}" x2="${W - pR + 4}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`; });
    s += '</g>';
    const step = tk.length > 1 ? tk[1] - tk[0] : 0;
    const axc = st.o.money ? 'ax m-ax' : 'ax';   // montants : masqués en mode discret
    tk.forEach(v => { s += `<text class="${axc}" x="${W - pR + 8}" y="${(Y(v) + 3.5).toFixed(1)}">${L.esc((st.o.fmtY || (x => F.n(x)))(v, step))}</text>`; });
    const nx = W < 420 ? 3 : 4;
    for (let j = 0; j < nx; j++) {
      const i = Math.round(j * (n - 1) / (nx - 1));
      const anchor = j === 0 ? 'start' : j === nx - 1 ? 'end' : 'middle';
      s += `<text class="ax" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${L.esc((st.o.fmtX || F.dshort)(t[i]))}</text>`;
    }
    if (st.o.ref && st.o.ref.v != null) {
      const yv = Y(st.o.ref.v).toFixed(1);
      s += `<line x1="${pL}" x2="${W - pR}" y1="${yv}" y2="${yv}" stroke="${st.o.ref.color || L.P.bench}" stroke-width="1" stroke-dasharray="3 4" opacity=".7"/>`;
      if (st.o.ref.label) s += `<text class="${st.o.money ? 'ax m-ax' : 'ax'}" x="${pL + 2}" y="${(+yv - 5).toFixed(1)}">${L.esc(st.o.ref.label)}</text>`;
    }
    // Plusieurs niveaux horizontaux (prix de revient, seuils) : tracés s'ils tombent dans la plage affichée
    (st.o.refs || []).forEach(rf => {
      if (rf.v == null || !isFinite(rf.v) || rf.v < lo || rf.v > hi) return;
      const yv = Y(rf.v).toFixed(1);
      s += `<line x1="${pL}" x2="${W - pR}" y1="${yv}" y2="${yv}" stroke="${rf.color || L.P.bench}" stroke-width="1" stroke-dasharray="${rf.dash || '4 4'}" opacity=".85"/>`;
      if (rf.label) s += `<text class="ax" x="${pL + 2}" y="${(+yv - 5).toFixed(1)}" style="fill:${rf.color || L.P.bench}">${L.esc(rf.label)}</text>`;
    });
    series.forEach((se, k) => {
      let d = '', pen = false, first = null, last = null;
      se.v.forEach((v, i) => {
        if (v == null || !isFinite(v)) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true;
        if (first === null) first = i; last = i;
      });
      if (!d) return;
      if (se.area && first !== null) s += `<path d="${d}L${X(last).toFixed(1)} ${H - pB}L${X(first).toFixed(1)} ${H - pB}Z" fill="url(#${id}${k})" class="${animate ? 'fade' : ''}" clip-path="url(#${id}c)"/>`;
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w || 2}" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#${id}c)"
        ${se.dash ? `stroke-dasharray="${se.dash}"` : ''} ${se.opacity ? `opacity="${se.opacity}"` : ''} ${se.dash ? '' : 'pathLength="1"'} class="${animate && !se.dash ? 'draw' : ''}"/>`;
    });
    (st.o.marks || []).forEach(m => {
      const v = series[0].v[m.i]; if (v == null) return;
      const c = m.kind === 'sell' ? L.P.down : m.kind === 'buy' ? L.P.up : L.P.vio;
      s += `<circle cx="${X(m.i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="5" fill="${c}" stroke="#090B1D" stroke-width="2"><title>${L.esc(m.label || '')}</title></circle>`;
    });
    if (st.o.endDot !== false) {
      const se = series[0]; const li = se.v.length - 1;
      if (se.v[li] != null) s += `<circle cx="${X(li).toFixed(1)}" cy="${Y(se.v[li]).toFixed(1)}" r="4" fill="${se.color}" stroke="#090B1D" stroke-width="2"/>`;
    }
    s += `<g class="xh" style="display:none"><line y1="${pT}" y2="${H - pB}" stroke="rgba(237,233,223,.35)" stroke-width="1"/>${series.map(se => `<circle r="4.5" fill="${se.color}" stroke="#090B1D" stroke-width="2"/>`).join('')}</g>`;
    s += `<rect class="ov" x="${pL}" y="0" width="${W - pL - pR}" height="${H}" fill="transparent"/></svg>`;
    el.innerHTML = s; el.appendChild(tip);
    st.svg = el.firstChild;
    if (st.hover != null) show(st.hover);
  };
  const show = (i) => {
    const { series, t } = st.o; if (!st.svg || i == null) return;
    i = Math.max(0, Math.min(st.n - 1, i)); st.hover = i;
    const g = st.svg.querySelector('.xh'); g.style.display = '';
    const x = st.X(i);
    g.firstChild.setAttribute('x1', x); g.firstChild.setAttribute('x2', x);
    let ymin = st.H;
    series.forEach((se, k) => {
      const c = g.children[k + 1]; const v = se.v[i];
      if (v == null) { c.style.display = 'none'; return; }
      c.style.display = ''; c.setAttribute('cx', x); c.setAttribute('cy', st.Y(v)); ymin = Math.min(ymin, st.Y(v));
    });
    if (st.o.tip) {
      tip.innerHTML = st.o.tip(i); tip.style.display = 'block';
      if (st.kb) { const txt = (tip.innerText || tip.textContent).split(/\n+/).map(t => t.trim()).filter(Boolean).join(', '); L.live(document.body.classList.contains('priv') ? txt.replace(/[-+−]?\d[\d\u202f\u00a0 .,]*\s?€/g, 'montant masqué') : txt); }
      const tw = tip.offsetWidth || 140;
      tip.style.left = Math.max(tw / 2 + 2, Math.min(st.W - tw / 2 - 2, x)) + 'px';
      tip.style.top = Math.max(tip.offsetHeight + 4, ymin - 12) + 'px';
    }
    st.o.onScrub && st.o.onScrub(i);
  };
  const hide = () => {
    st.hover = null; if (!st.svg) return;
    const g = st.svg.querySelector('.xh'); if (g) g.style.display = 'none';
    tip.style.display = 'none'; st.o.onScrub && st.o.onScrub(null);
  };
  const idxAt = (ev) => {
    const r = el.getBoundingClientRect();
    const x = ev.clientX - r.left;
    return Math.round(((x - st.pL) / (st.W - st.pL - st.pR)) * (st.n - 1));
  };
  el.addEventListener('pointermove', ev => { if (ev.pointerType === 'touch' && !st.down) return; st.kb = false; show(idxAt(ev)); });
  el.addEventListener('pointerdown', ev => { st.down = true; st.kb = false; show(idxAt(ev)); });
  const up = () => { st.down = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', () => { up(); hide(); });
  // Choix d'un jour (clic, ou Entrée au clavier) : par exemple « le portefeuille à cette date »
  el.addEventListener('click', ev => { if (st.o.onPick && st.svg) { const i = st.hover ?? idxAt(ev); if (i != null) st.o.onPick(Math.max(0, Math.min(st.n - 1, i))); } });
  el.addEventListener('pointerleave', ev => { up(); hide(); });
  el.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); st.kb = true; show((st.hover ?? (st.n - 1)) + (ev.key === 'ArrowRight' ? 1 : -1)); }
    if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); st.kb = true; show(ev.key === 'Home' ? 0 : st.n - 1); }
    if (ev.key === 'Escape') hide();
    if (ev.key === 'Enter' && st.o.onPick && st.hover != null) { ev.preventDefault(); st.o.onPick(st.hover); }
  });
  el.addEventListener('blur', hide);
  draw(o.animate !== false);
  let w0 = el.clientWidth;
  const ro = new ResizeObserver(L.debounce(() => { if (!el.isConnected) { ro.disconnect(); return; } if (el.clientWidth !== w0) { w0 = el.clientWidth; draw(false); } }, 120));
  ro.observe(el);
  return { update(no) { st.o = { ...st.o, ...no }; draw(!!no.animate); }, destroy() { ro.disconnect(); } };
};
/* Une série « hors échelle » est-elle visible dans la plage des autres ? */
C.inRange = (main, other) => {
  const m = main.filter(v => v != null), o = other.filter(v => v != null);
  if (!m.length || !o.length) return false;
  const lo = Math.min(...m), hi = Math.max(...m), pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01;
  return o.some(v => v >= lo - pad && v <= hi + pad);
};

/* ── Sparkline statique ── */
C.spark = (vals, { w = 88, h = 28, color } = {}) => {
  const v = (vals || []).filter(x => x != null && isFinite(x));
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1;
  const col = color || (v[v.length - 1] >= v[0] ? L.P.up : L.P.down);
  const pts = v.map((x, i) => `${(i / (v.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (x - lo) / sp * (h - 6)).toFixed(1)}`);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="2.2" fill="${col}"/></svg>`;
};

/* ── Mini-colonnes (dividendes : reçus pleins, prévus estompés) ── */
C.cols = (items) => {
  const mx = Math.max(...items.map(i => i.v), 0.01);
  return `<div class="cols" role="img" aria-label="${L.esc(items.map(i => `${i.label} ${F.eur(i.v, 0)}`).join(', '))}">${items.map((i, k) =>
    `<i class="${i.fc ? 'fc' : ''}" style="height:${Math.max(4, i.v / mx * 100)}%;animation-delay:${k * 25}ms" title="${L.esc(i.label)} : ${L.esc(F.eur(i.v))}${i.fc ? ' (prévu)' : ''}"></i>`).join('')}</div>`;
};

/* ── Échelle divergente à 7 classes (sarcelle = hausse, rose = baisse ; libellé toujours signé) ── */
C.qClass = (v, b = [0.5, 1.5, 3]) => {
  if (v == null || isNaN(v)) return 'q0';
  const a = Math.abs(v); const k = a < b[0] ? 0 : a < b[1] ? 1 : a < b[2] ? 2 : 3;
  return 'q' + (v < 0 && k ? '-' + k : k);
};
C.qLegend = (b, unit = '%', note = '') => {
  const NB = '\u00a0', lbl = x => F.n(x, x % 1 ? 1 : 0) + NB + unit;
  const st = [['q-3', '≤' + NB + '−' + lbl(b[2])], ['q-2', '−' + lbl(b[1])], ['q-1', '−' + lbl(b[0])], ['q0', '0'],
    ['q1', '+' + lbl(b[0])], ['q2', '+' + lbl(b[1])], ['q3', '≥' + NB + '+' + lbl(b[2])]];
  return `<div class="tm-legend" aria-hidden="true"><span class="tm-sw">${st.map(([c, t]) => `<span class="st2"><i class="${c}"></i><small>${t}</small></span>`).join('')}</span>${note ? `<span class="note tm-note">${L.esc(note)}</span>` : ''}</div>`;
};

/* ── Treemap « squarified » (Bruls, Huizing, van Wijk) regroupé par secteur ── */
const worst = (row, s) => {
  const sum = row.reduce((a, r) => a + r.a, 0); const mx = Math.max(...row.map(r => r.a)); const mn = Math.min(...row.map(r => r.a));
  return Math.max((s * s * mx) / (sum * sum), (sum * sum) / (s * s * mn));
};
C.squarify = (items, x, y, w, h) => {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  let rest = items.filter(i => i.value > 0).map(i => ({ ...i, a: i.value / total * w * h }));
  const out = [];
  while (rest.length) {
    const s = Math.min(w, h);
    let row = [rest[0]], k = 1;
    while (k < rest.length && worst(row.concat(rest[k]), s) <= worst(row, s)) { row.push(rest[k]); k++; }
    const sum = row.reduce((a, r) => a + r.a, 0);
    if (w >= h) {
      const rw = sum / h; let yy = y;
      row.forEach(r => { const rh = r.a / rw; out.push({ ...r, x, y: yy, w: rw, h: rh }); yy += rh; });
      x += rw; w -= rw;
    } else {
      const rh = sum / w; let xx = x;
      row.forEach(r => { const rw = r.a / rh; out.push({ ...r, x: xx, y, w: rw, h: rh }); xx += rw; });
      y += rh; h -= rh;
    }
    rest = rest.slice(row.length);
  }
  return out;
};
/* Texte ajusté à la case (mesure réelle de la police, comme Finviz) : nom entier si possible,
   sur deux lignes au besoin, sinon ticker ; jamais de nom rogné. */
const TM_FONT = '"Plex Cond", "IBM Plex Sans Condensed", system-ui, sans-serif';
let tmCtx = null;
const tmW = (txt, fs, wt = 700, fam = TM_FONT) => {
  tmCtx = tmCtx || document.createElement('canvas').getContext('2d');
  tmCtx.font = `${wt} ${fs}px ${fam}`;
  return tmCtx.measureText(txt).width;
};
const tmSplit = txt => {          // coupure en deux lignes la plus équilibrée
  const w = txt.split(/\s+/); if (w.length < 2) return null;
  let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
    const m = Math.max(tmW(a, 10), tmW(b, 10));
    if (!best || m < best.m) best = { a, b, m };
  }
  return best;
};
C.tmLabel = (c, w, h, sub, subShort) => {
  /* Ce qui tient dans la case, du plus riche au plus court : nom (1 ou 2 lignes) et variation
     dessous ; ticker et variation dessous ; « NKE −3 % » sur une ligne ; la variation seule ; le nom
     seul ; le ticker vertical (case haute et étroite) ; les initiales. Jamais de case muette. */
  const aw = w - 8, ah = h - 4;
  if (aw < 10 || ah < 8) return { html: '' };
  const maxFs = Math.max(11, Math.min(30, Math.sqrt(w * h) / 6.2));
  const subR = 0.74;                                   // taille de la variation / taille du nom
  const ss = subShort || sub;
  const cands = [c.short || c.name];
  if (c.tk && !cands.includes(c.tk)) cands.push(c.tk);
  for (const txt of cands) {
    const w1 = tmW(txt, 10) / 10;                      // largeur pour 1 px de police
    let fs = Math.min(maxFs, aw / w1, ah / (1.18 + (sub ? subR * 1.25 : 0)));
    let lines = [txt];
    const sp = tmSplit(txt);
    if (sp) {                                          // deux lignes si le nom y gagne vraiment
      const fs2 = Math.min(maxFs, aw / (sp.m / 10), ah / (2.3 + (sub ? subR * 1.25 : 0)));
      if (fs2 > fs * 1.25 && fs2 >= 11) { fs = fs2; lines = [sp.a, sp.b]; }
    }
    const min = txt === c.tk ? 9.5 : 11;
    if (fs >= min) {
      const sfs = Math.max(9, fs * subR);
      const showSub = !!sub && ah >= fs * 1.18 * lines.length + sfs * 1.2 && tmW(ss, sfs) <= aw;
      if (showSub || !sub) return { fs, sfs, lines, showSub };
    }
  }
  if (sub) {
    // une ligne : « NKE −3 % » (ticker, sinon nom court), puis la variation seule
    for (const txt of [c.tk, c.short || c.name].filter(Boolean)) {
      const line = `${txt} ${ss}`;
      const fs = Math.min(maxFs, aw / (tmW(line, 10) / 10), ah / 1.2);
      if (fs >= 9) return { fs, lines: [txt], inline: true, showSub: false };
    }
    const fs = Math.min(maxFs, aw / (tmW(ss, 10) / 10), ah / 1.2);
    if (fs >= 8.5) return { fs, lines: [], subOnly: true, showSub: false };
  }
  for (const txt of cands) {
    const fs = Math.min(maxFs, aw / (tmW(txt, 10) / 10), ah / 1.18);
    if (fs >= 9) return { fs, sfs: 0, lines: [txt], showSub: false };
  }
  // case haute et très étroite : ticker vertical
  const tk = c.tk || L.initials(c.name);
  if (h > w * 2.2 && h > 40) {
    const fsV = Math.min(14, w - 4, (h - 8) / (tmW(tk, 10) / 10));
    if (fsV >= 8) return { fs: fsV, lines: [tk], vert: true };
  }
  const ini = L.initials(c.name);
  const fsI = Math.min(12, aw / (tmW(ini, 10) / 10), ah / 1.2);
  return fsI >= 7.5 ? { fs: fsI, lines: [ini], showSub: false } : { html: '' };
};
C.treemap = (el, items, o = {}) => {
  const H = o.h || 260;
  // Surface minimale (1,2 % par défaut) : une petite ligne reste visible et nommée ; le poids affiché reste le vrai
  const minShare = o.minShare ?? 0.012;
  const tot = items.reduce((a, i) => a + Math.max(0, i.value), 0) || 1;
  items = items.map(i => ({ ...i, raw: i.value, value: Math.max(i.value, tot * minShare) }));
  C.treemap.enlarged = items.filter(i => i.raw < tot * minShare).length;
  const render = () => {
    const W = el.clientWidth || 600;
    const groups = {};
    items.forEach(it => { const g = o.group ? (it[o.group] || 'Autre') : '·'; (groups[g] = groups[g] || []).push(it); });
    const gl = Object.entries(groups).map(([g, its]) => ({ g, its: its.sort((a, b) => b.value - a.value), value: its.reduce((a, i) => a + i.value, 0) }))
      .sort((a, b) => b.value - a.value);
    const rects = C.squarify(gl, 0, 0, W, H);
    let html = '', dots = '';
    rects.forEach(R => {
      const gap = o.group ? 2 : 0;
      const showG = o.group && R.w > 64 && R.h > 50 && gl.length > 1;
      const top = showG ? 19 : 0;
      const gw = R.its.reduce((a, i) => a + (i.raw || 0), 0) / tot * 100;
      html += `<div class="tm-g" style="left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px">${showG ? `<div class="tm-gl" style="max-width:${R.w - 12}px"><span>${L.esc(R.g)}</span>${R.w > 150 ? `<i>${F.pctU(gw, 0)}</i>` : ''}</div>` : ''}</div>`;
      const cells = C.squarify(R.its, R.x + gap, R.y + gap + top, Math.max(1, R.w - 2 * gap), Math.max(1, R.h - 2 * gap - top));
      cells.forEach(c => {
        const col = o.color(c);
        const w = c.w - 2, h = c.h - 2;
        const ns = o.dots ? (o.dots(c) || []).slice(0, 2) : [];
        const sz = w >= 60 && h >= 60 ? 17 : 14;
        // petite case avec point : le texte centré laisse la place du point en haut
        const subT = col.label && col.label !== '—' ? col.label : '';
        const subS = col.short || subT;
        let lab = ns.length && h < 90 && w < 150 ? C.tmLabel(c, w, h - 2 * (sz + 3), subT, subS) : null;
        if (!lab || !(lab.lines || lab.subOnly) || lab.inline || lab.subOnly) lab = C.tmLabel(c, w, h, subT, subS);   // trop petit pour réserver : texte d'abord
        let inner = '';
        if (lab.subOnly) inner = `<b style="font-size:${lab.fs.toFixed(1)}px">${L.esc(subS)}</b>`;
        else if (lab.inline) inner = `<b style="font-size:${lab.fs.toFixed(1)}px">${L.esc(lab.lines[0])} <span class="tm-in">${L.esc(subS)}</span></b>`;
        else if (lab.lines) {
          const sub = lab.showSub ? `<span style="font-size:${lab.sfs.toFixed(1)}px">${L.esc(lab.fs >= 15 ? col.label : subS)}</span>` : '';
          const extra = lab.fs >= 17 && h > 120 && w > 180 ? `<em>${L.esc(F.pctU(c.weight, 1))} du portefeuille</em>` : '';
          inner = `<b style="font-size:${lab.fs.toFixed(1)}px">${lab.lines.map(L.esc).join('<br>')}</b>${sub}${extra}`;
        }
        const lbl = `${c.name}, ${F.pctU(c.weight, 1)} du portefeuille, ${col.label}${ns.length ? `, ${ns.length} actualité${ns.length > 1 ? 's' : ''} importante${ns.length > 1 ? 's' : ''}` : ''}`;
        const xc = o.cellCls ? o.cellCls(c) : '';
        html += `<div class="tm-c ${col.cls}${lab.vert ? ' vert' : ''}${ns.length ? ' has-dot' : ''}${xc ? ' ' + xc : ''}" role="button" tabindex="0" data-uid="${L.esc(c.uid)}" aria-label="${L.esc(lbl + (xc === 'sig-out' ? ', à réexaminer' : xc === 'sig-in' ? ', à renforcer' : xc === 'sig-both' ? ', signaux de sortie et d\'entrée' : ''))}"
          style="left:${(c.x + 1).toFixed(1)}px;top:${(c.y + 1).toFixed(1)}px;width:${Math.max(0, w).toFixed(1)}px;height:${Math.max(0, h).toFixed(1)}px">${inner}</div>`;
        // Points d'actualité : calque au-dessus des cases (jamais rognés), coin haut droit ;
        // décision à prendre maintenant (niveau « alerte ») : point marqué « ! » qui clignote
        ns.forEach((n, i) => {
          const x = Math.min(c.x + c.w - 4 - sz - i * (sz + 3), W - sz - 2), y = Math.max(c.y + 4, 1);
          const urg = n.level === 'alerte';
          dots += `<button class="tm-dot ${n.pol > 0 ? 'pos' : n.pol < 0 ? 'neg' : 'neu'}${sz < 17 ? ' sm' : ''}${urg ? ' urgent' : ''}" data-news="${L.esc(n.k)}" data-uid="${L.esc(c.uid)}"
            style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px" aria-label="${L.esc(`${urg ? 'Décision à prendre maintenant, actualité' : 'Actualité'} ${n.pol > 0 ? 'favorable' : n.pol < 0 ? 'défavorable' : 'à lire'}${n.n ? `, n° ${n.n}, commune à plusieurs lignes` : ''} : ${n.title}`)}">${n.n || (urg ? '!' : '')}</button>`;
        });
      });
    });
    el.className = 'tm' + (o.sigMode ? ' sig-mode' : ''); el.style.height = H + 'px';
    el.innerHTML = html + dots;
  };
  render();
  // Largeurs mesurées avec la vraie police : si elle n'était pas encore chargée, on recalcule
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (el.isConnected) render(); });
  // Info-bulle flottante (hors de la carte, jamais rognée) : au-dessus du curseur, sinon en dessous
  const tip = C.ftip;
  let pt = 'mouse';
  el.onpointerdown = ev => { pt = ev.pointerType; };
  el.onpointermove = ev => {
    if (ev.pointerType === 'touch') return;          // au doigt : la case ouvre un aperçu (onPeek)
    const t = tip();
    const dot = ev.target.closest('.tm-dot');
    const c = dot ? null : ev.target.closest('.tm-c');
    if (!dot && !c) { t.style.display = 'none'; return; }
    let html;
    if (dot) { if (!o.dotTip) return; html = o.dotTip(dot.dataset.news, dot.dataset.uid); }
    else { const it = items.find(i => String(i.uid) === c.dataset.uid); if (!it) return; html = o.tip ? o.tip(it) : L.esc(it.name); }
    if (html !== t._h) { t.innerHTML = html; t._h = html; }
    t.style.display = 'block';
    C.placeTip(t, ev.clientX, ev.clientY);
  };
  el.onpointerleave = () => C.hideTip();
  el.onclick = ev => {
    C.hideTip();
    const dot = ev.target.closest('.tm-dot');
    if (dot) { ev.stopPropagation(); o.onDot && o.onDot(dot.dataset.news, dot.dataset.uid); return; }
    const c = ev.target.closest('.tm-c'); if (!c) return;
    if (pt === 'touch' && o.onPeek) o.onPeek(c.dataset.uid); else if (o.onClick) o.onClick(c.dataset.uid);
  };
  el.onkeydown = ev => { const c = ev.target.closest('.tm-c'); if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); o.onClick && o.onClick(c.dataset.uid); } };
  let w0 = el.clientWidth;
  const ro = new ResizeObserver(L.debounce(() => { if (!el.isConnected) { ro.disconnect(); return; } if (el.clientWidth !== w0) { w0 = el.clientWidth; render(); } }, 120));
  ro.observe(el);
  return { destroy() { ro.disconnect(); C.hideTip(); }, render };
};
C.ftip = () => {
  let t = document.getElementById('ftip');
  if (!t) { t = document.createElement('div'); t.id = 'ftip'; t.className = 'tip ftip'; document.body.appendChild(t); }
  return t;
};
C.hideTip = () => { const t = document.getElementById('ftip'); if (t) t.style.display = 'none'; };
C.placeTip = (t, x, y) => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const tw = t.offsetWidth, th = t.offsetHeight;
  const left = Math.max(8, Math.min(vw - tw - 8, x - tw / 2));
  let top = y - th - 14;
  if (top < 8) top = y + 20 + th <= vh - 8 ? y + 20 : Math.max(8, vh - th - 8);
  t.style.left = left + 'px'; t.style.top = top + 'px';
};
/* Sous un élément (nom survolé), sinon au-dessus, toujours dans l'écran */
C.placeTipAt = (t, r) => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const tw = t.offsetWidth, th = t.offsetHeight;
  const left = Math.max(8, Math.min(vw - tw - 8, r.left));
  let top = r.bottom + 8;
  if (top + th > vh - 8) top = r.top - th - 8 >= 8 ? r.top - th - 8 : Math.max(8, vh - th - 8);
  t.style.left = left + 'px'; t.style.top = top + 'px';
};
window.addEventListener('scroll', () => C.hideTip(), { passive: true, capture: true });
window.addEventListener('hashchange', () => C.hideTip());

/* ── Constellation du portefeuille (élément signature « Observatoire ») ──
   Direction = secteur (part d'angle proportionnelle au poids du secteur), distance au centre =
   volatilité sur un an, taille = poids, couleur = plus-value depuis l'achat ; traits = lignes très
   corrélées ; halo = secteur au-delà de votre limite. Le ciel s'allume une fois, par ordre de taille. */
C.sky = (el, d, o = {}) => {
  const stars = (d.stars || []).filter(x => (x.weight || 0) > 0);
  const NB = ' ';
  const render = () => {
    const W = el.clientWidth || 700, H = o.h || 470;
    const narrow = W < 520;
    const side = W >= 980 ? 172 : 0;                       // colonnes de légende et de mouvements (grand écran)
    const cx = W / 2, cy = H / 2 + 6, R = Math.min((W - 2 * side) / 2 - (narrow ? 64 : 92), H / 2 - 38);
    // Échelle LINÉAIRE (une étoile à 30 % est à mi-chemin des anneaux 20 et 40) : 80 % de volatilité
    // au bord, plus si une fenêtre courte en compte davantage (160 au plus). Volatilité inconnue :
    // sur l'anneau extérieur pointillé, jamais à une valeur inventée.
    const vmx = Math.max(0, ...stars.map(x => x.vol ?? 0));
    const VMAX = Math.max(80, Math.min(160, Math.ceil(vmx / 20) * 20));
    const RU = R + (narrow ? 2 : 4);
    const rOf = v => v == null ? RU : 18 + (R - 18) * Math.min(Math.max(v, 0), VMAX) / VMAX;
    const sOf = w => 3.5 + Math.sqrt(w) * 3.1;
    const secs = {};
    stars.forEach(x => { (secs[x.sector] = secs[x.sector] || []).push(x); });
    const sl = Object.entries(secs).map(([k, xs]) => ({ k, xs: xs.sort((a, b) => b.weight - a.weight), w: xs.reduce((a, x) => a + x.weight, 0) }))
      .sort((a, b) => b.w - a.w);
    const tot = sl.reduce((a, x) => a + x.w, 0) || 1;
    const minSpan = Math.PI * 2 * 0.06;
    let spans = sl.map(x => Math.max(minSpan, x.w / tot * Math.PI * 2));
    const k = Math.PI * 2 / spans.reduce((a, b) => a + b, 0); spans = spans.map(x => x * k);
    let a0 = -Math.PI / 2, svg = '', lbl = '', pos = {}, cons = '';
    const secL = [];
    const boxes = [];                                       // étiquettes déjà posées (anti-chevauchement)
    const NS2 = 'http://www.w3.org/2000/svg';
    svg += `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="${NS2}" class="sky-svg">`;
    const RINGS = VMAX > 80 ? (narrow ? [VMAX / 2, VMAX] : [VMAX / 4, VMAX / 2, VMAX * 3 / 4, VMAX]) : narrow ? [40, 80] : [20, 40, 60, 80];     // anneaux de volatilité
    RINGS.forEach(v => { svg += `<circle cx="${cx}" cy="${cy}" r="${rOf(v).toFixed(1)}" class="sky-ring"/>`; });
    if (stars.some(x => x.vol == null)) svg += `<circle cx="${cx}" cy="${cy}" r="${RU.toFixed(1)}" class="sky-ring unk"/>`;
    sl.forEach((sec, i) => {
      const span = spans[i], a1 = a0 + span, mid = (a0 + a1) / 2;
      svg += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a0) * (R + 8)).toFixed(1)}" y2="${(cy + Math.sin(a0) * (R + 8)).toFixed(1)}" class="sky-sp"/>`;
      const over = (d.over || []).includes(sec.k);
      if (over) svg += `<path d="M${cx + Math.cos(a0) * (R + 10)} ${cy + Math.sin(a0) * (R + 10)} A${R + 10} ${R + 10} 0 ${span > Math.PI ? 1 : 0} 1 ${cx + Math.cos(a1) * (R + 10)} ${cy + Math.sin(a1) * (R + 10)}" class="sky-over"/>`;
      let lx = cx + Math.cos(mid) * (R + 20), ly = cy + Math.sin(mid) * (R + 20);
      const anchor = Math.cos(mid) > .25 ? 'start' : Math.cos(mid) < -.25 ? 'end' : 'middle';
      ly = Math.max(14, Math.min(H - 6, ly));
      const name = narrow && sec.k.length > 11 ? sec.k.slice(0, 10) + '.' : sec.k;
      const tw = tmW(`${name} ${F.n(sec.w, 0)} %`, narrow ? 11.5 : 13, 500, '"Newsreader", Georgia, serif');   // libellé en Newsreader          // jamais hors du cadre ni sur les colonnes
      if (anchor === 'end') lx = Math.max(lx, side + tw + 4);
      else if (anchor === 'start') lx = Math.min(lx, W - side - tw - 4);
      else lx = Math.max(side + tw / 2 + 4, Math.min(W - side - tw / 2 - 4, lx));
      secL.push({ lx, ly, anchor, tw, name, over, w: sec.w, k: sec.k });
      const pts = [];
      sec.xs.forEach((x, j) => {
        const ang = a0 + span * (j + .5) / sec.xs.length;
        const r = rOf(x.vol);
        pos[x.uid] = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, s: sOf(x.weight) };
        pts.push(pos[x.uid]);
      });
      if (pts.length > 1) cons += `<polyline points="${pts.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ')}" class="sky-cons"/>`;   // constellation du secteur
      a0 = a1;
    });
    const order = stars.slice().sort((a, b) => b.weight - a.weight);
    const hitsStar = (bx, self) => order.some(y => { const q = pos[y.uid]; if (!q || y.uid === self) return false;
      const nx = Math.max(bx.x, Math.min(q.x, bx.x + bx.w)), ny = Math.max(bx.y, Math.min(q.y, bx.y + bx.h));
      return (nx - q.x) ** 2 + (ny - q.y) ** 2 < (q.s + 1.5) ** 2; });
    const hitsBox = bx => boxes.some(b => bx.x < b.x + b.w && bx.x + bx.w > b.x && bx.y < b.y + b.h && bx.y + bx.h > b.y);
    // libellés de secteurs : décalés verticalement s'ils couvrent une étoile
    secL.forEach(L0 => {
      const x0 = L0.anchor === 'end' ? L0.lx - L0.tw : L0.anchor === 'start' ? L0.lx : L0.lx - L0.tw / 2;
      const bx = [0, -13, 13, -26, 26].map(dy => ({ x: x0, y: L0.ly + dy - 11, w: L0.tw, h: 14, dy }))
        .filter(c => c.y >= 2 && c.y + c.h <= H - 2).find(c => !hitsStar(c, null) && !hitsBox(c)) || { x: x0, y: L0.ly - 11, w: L0.tw, h: 14, dy: 0 };
      boxes.push(bx);
      lbl += `<text x="${L0.lx.toFixed(1)}" y="${(L0.ly + bx.dy).toFixed(1)}" text-anchor="${L0.anchor}" class="sky-sec${L0.over ? ' over' : ''}${narrow ? ' sm' : ''}">${L.esc(L0.name)} <tspan>${F.n(L0.w, 0)}${NB}%</tspan><title>${L.esc(L0.k)}</title></text>`;
    });
    // libellés d'anneaux : de part et d'autre du rayon du haut, seulement là où ils ne touchent ni étoile ni secteur
    RINGS.forEach(v => {
      const r = rOf(v), t = `vol. ${v}${NB}%`, w = tmW(t, 10.5, 500), y = cy - r - 3;
      const c = [[cx - 5 - w, cx - 5, 'end'], [cx + 5, cx + 5, 'start']].map(([x0, tx, a]) => ({ x: x0, y: y - 9, w, h: 11, tx, a })).find(bx => !hitsBox(bx) && !hitsStar(bx, null));
      if (c) { boxes.push(c); svg += `<text x="${c.tx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${c.a}" class="sky-rl">${t}</text>`; }
    });
    svg += cons;
    (d.links || []).forEach(l => { const a = pos[l.a], b = pos[l.b]; if (a && b) svg += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="sky-link" style="opacity:${(0.25 + (l.rho - .7) * 2).toFixed(2)}"><title>Corrélation ${F.n(l.rho, 2)}</title></line>`; });
    const place = (x, p) => {                               // à droite, sinon dessous ; rien si ça chevauche (le nom reste dans l'infobulle)
      const nm = (x.name || '').replace(/\s*\(.*\)/, '').slice(0, 22), w = tmW(nm, 12, 500);
      const cand = [{ x: p.x + p.s + 5, y: p.y - 9, w, h: 13, tx: p.x + p.s + 5, ty: p.y + 4, a: 'start' }];
      if (!narrow) { const bx = Math.max(side + w / 2 + 4, Math.min(W - side - w / 2 - 4, p.x)); cand.push({ x: bx - w / 2, y: p.y + p.s + 4, w, h: 13, tx: bx, ty: p.y + p.s + 14, a: 'middle' }); }
      const ok = cand.find(c => c.x >= side + 2 && c.x + c.w <= W - side - 2 && c.y >= 0 && c.y + c.h <= H && !hitsBox(c) && !hitsStar(c, x.uid));
      if (!ok) return '';
      boxes.push(ok);
      return `<text x="${ok.tx.toFixed(1)}" y="${ok.ty.toFixed(1)}" text-anchor="${ok.a}" class="sky-nm">${L.esc(nm)}</text>`;
    };
    order.forEach((x, i) => {
      const p = pos[x.uid]; if (!p) return;
      const cls = C.qClass(x.pnl_pct, [10, 25, 50]);
      svg += `<g class="sky-st" data-uid="${L.esc(x.uid)}" role="button" tabindex="0" aria-label="${L.esc(`${x.name}, ${F.pctU(x.weight, 1)} du portefeuille, volatilité ${x.vol != null ? F.n(x.vol, 0) + ' %' : 'inconnue'}, plus-value ${F.pct(x.pnl_pct, 0)}`)}" style="animation-delay:${(i * 55)}ms">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.s + 5).toFixed(1)}" class="sky-glow ${cls}"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.s.toFixed(1)}" class="sky-dot ${cls}${x.vol == null ? ' unk' : ''}"/>
        ${x.weight >= (o.labelMin ?? 2.5) ? place(x, p) : ''}</g>`;
    });
    svg += lbl;
    if (side) {
      // clé de lecture (gauche) : taille = poids, couleur = plus-value, traits
      let y = 26, kx = 18, g = `<g class="sky-key"><text x="${kx}" y="${y}" class="sky-kh">Lire le ciel</text>`;
      y += 26; g += `<text x="${kx}" y="${y}" class="sky-kl">Taille : poids</text>`; y += 22;
      let xx = kx;
      [[2, '2'], [8, '8'], [20, '20 %']].forEach(([w, t]) => { const r = sOf(w); g += `<circle cx="${(xx + r).toFixed(1)}" cy="${y}" r="${r.toFixed(1)}" class="sky-kc"/><text x="${(xx + r).toFixed(1)}" y="${(y + r + 13).toFixed(1)}" text-anchor="middle" class="sky-kt">${t}</text>`; xx += 2 * r + 14; });
      y += 48; g += `<text x="${kx}" y="${y}" class="sky-kl">Couleur : plus-value</text>`; y += 12;
      ['q-3', 'q-2', 'q-1', 'q0', 'q1', 'q2', 'q3'].forEach((q, j) => { g += `<rect x="${kx + j * 19}" y="${y}" width="17" height="10" rx="2" class="${q}"/>`; });
      y += 24; g += `<text x="${kx}" y="${y}" class="sky-kt">−50${NB}%</text><text x="${kx + 66}" y="${y}" text-anchor="middle" class="sky-kt">0</text><text x="${kx + 131}" y="${y}" text-anchor="end" class="sky-kt">+50${NB}%</text>`;
      y += 30; g += `<text x="${kx}" y="${y}" class="sky-kl">Distance : volatilité ${L.esc(o.volLabel || '1 an')}</text>`;
      if (stars.some(x => x.vol == null)) { y += 22; g += `<line x1="${kx}" x2="${kx + 26}" y1="${y - 4}" y2="${y - 4}" class="sky-ring unk"/><text x="${kx + 34}" y="${y}" class="sky-kt">volatilité inconnue</text>`; }
      y += 24; g += `<line x1="${kx}" x2="${kx + 26}" y1="${y - 4}" y2="${y - 4}" class="sky-cons"/><text x="${kx + 34}" y="${y}" class="sky-kt">même secteur</text>`;
      y += 20; g += `<line x1="${kx}" x2="${kx + 26}" y1="${y - 4}" y2="${y - 4}" class="sky-link"/><text x="${kx + 34}" y="${y}" class="sky-kt">corrélation ≥ 0,7</text>`;
      if ((d.over || []).length) { y += 20; g += `<line x1="${kx}" x2="${kx + 26}" y1="${y - 4}" y2="${y - 4}" class="sky-over" style="stroke-width:4"/><text x="${kx + 34}" y="${y}" class="sky-kt">secteur > limite</text>`; }
      svg += g + '</g>';
      // mouvements du jour (droite)
      const mv = stars.filter(x => x.day != null && isFinite(x.day)).sort((a, b) => Math.abs(b.day) - Math.abs(a.day)).slice(0, 5);
      if (mv.length) {
        const rx = W - side + 8, rw = side - 26;
        let m = `<g class="sky-key"><text x="${rx}" y="26" class="sky-kh">Le jour</text>`;
        mv.forEach((x, j) => {
          const yy = 56 + j * 38, pc = F.pct(x.day, 2), pw = tmW(pc, 13, 600);
          let nm = (x.name || '').replace(/\s*\(.*\)/, ''); while (nm.length > 3 && tmW(nm, 12.5, 500) > rw - pw - 10) nm = nm.slice(0, -2).trimEnd() + '…';
          m += `<g class="sky-mv" data-uid="${L.esc(x.uid)}" role="button" tabindex="0" aria-label="${L.esc(`${x.name} : ${pc} aujourd'hui`)}"><rect x="${rx - 6}" y="${yy - 17}" width="${rw + 12}" height="30" rx="7" class="sky-mvb"/>
            <text x="${rx}" y="${yy + 2}" class="sky-mvn">${L.esc(nm)}</text><text x="${rx + rw}" y="${yy + 2}" text-anchor="end" class="sky-mvp ${x.day > 0 ? 'up' : x.day < 0 ? 'dn' : ''}">${pc}</text></g>`;
        });
        svg += m + '</g>';
      }
    }
    svg += '</svg>';
    el.className = 'sky' + (side ? ' keyed' : ''); el.style.height = H + 'px';
    el.innerHTML = svg + '<div class="tip"></div>';
  };
  render();
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (el.isConnected) render(); });
  const tip = () => el.querySelector('.tip');
  el.onpointermove = ev => {
    const g = ev.target.closest('.sky-st'); const t = tip(); if (!t) return;
    if (!g) { t.style.display = 'none'; return; }
    const x = stars.find(s2 => s2.uid === g.dataset.uid); if (!x) return;
    t.innerHTML = `<b>${L.esc(x.name)}</b><div class="r"><span>Poids</span><span>${F.pctU(x.weight, 1)}</span></div><div class="r"><span>Volatilité ${L.esc(o.volLabel || '1 an')}</span><span>${x.vol != null ? F.n(x.vol, 0) + ' %' : 'inconnue'}</span></div><div class="r"><span>Plus-value</span><span class="${L.cls(x.pnl_pct)}">${F.pct(x.pnl_pct, 1)}</span></div><div class="r"><span>Jour</span><span class="${L.cls(x.day)}">${F.pct(x.day, 2)}</span></div>`;
    t.style.display = 'block';
    const r = el.getBoundingClientRect(); const tw = t.offsetWidth;
    t.style.left = Math.max(tw / 2, Math.min(r.width - tw / 2, ev.clientX - r.left)) + 'px';
    t.style.top = Math.max(t.offsetHeight + 4, ev.clientY - r.top - 14) + 'px';
  };
  el.onpointerleave = () => { const t = tip(); if (t) t.style.display = 'none'; };
  el.onclick = ev => { const g = ev.target.closest('.sky-st,.sky-mv'); if (g && o.onClick) o.onClick(g.dataset.uid); };
  el.onkeydown = ev => { const g = ev.target.closest('.sky-st,.sky-mv'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); o.onClick && o.onClick(g.dataset.uid); } };
  let w0 = el.clientWidth;
  const ro = new ResizeObserver(L.debounce(() => { if (!el.isConnected) { ro.disconnect(); return; } if (el.clientWidth !== w0) { w0 = el.clientWidth; render(); } }, 120));
  ro.observe(el);
  return { destroy() { ro.disconnect(); } };
};

/* ── Heatmap des rendements mensuels ── */
C.heat = (years) => {
  const m = F.months;
  let h = `<div class="tbl-wrap"><table class="hm"><thead><tr><th></th>${m.map(x => `<th>${x.replace('.', '')}</th>`).join('')}<th>Année</th></tr></thead><tbody>`;
  [...years].reverse().forEach(y => {
    h += `<tr><td class="yr">${y.year}</td>`;
    for (let k = 1; k <= 12; k++) {
      const v = y.months[k] ?? y.months[String(k)];
      h += v == null ? '<td class="na">·</td>' : `<td class="${C.qClass(v, [1, 3, 6])}" title="${m[k - 1]} ${y.year} : ${F.pct(v, 1)}">${F.s(v, 1)}</td>`;
    }
    h += `<td class="tot ${C.qClass(y.total, [2, 6, 12])}">${F.s(y.total, 1)}</td></tr>`;
  });
  const NB = '\u00a0';
  return h + `</tbody></table></div><div class="hm-leg" aria-hidden="true">Rendement du mois (TWR, en${NB}%) :
    <i class="q-3"></i>≤${NB}−6 <i class="q-2"></i>−3 <i class="q-1"></i>−1 <i class="q0"></i>0 <i class="q1"></i>+1 <i class="q2"></i>+3 <i class="q3"></i>≥${NB}+6 ; colonne Année : seuils ×2</div>`;
};

/* ── Éventail Monte-Carlo (p10–p90, médiane, objectif, versements) ── */
C.fan = (el, g) => {
  const W = Math.max(280, el.clientWidth || 600), H = 230, pL = 0, pR = 62, pT = 12, pB = 24;
  const by = g.by_year || []; const n = by.length; if (n < 2) { el.innerHTML = ''; return; }
  const inv = by.map((b, i) => (by[0].p50) + g.monthly_contribution * 12 * i);
  const hi = Math.max(...by.map(b => b.p90), g.target) * 1.06, lo = 0;
  const X = i => pL + i / (n - 1) * (W - pL - pR), Y = v => pT + (hi - v) / (hi - lo) * (H - pT - pB);
  const band = by.map((b, i) => `${X(i).toFixed(1)},${Y(b.p90).toFixed(1)}`).join(' ') + ' ' + [...by].reverse().map((b, k) => `${X(n - 1 - k).toFixed(1)},${Y(b.p10).toFixed(1)}`).join(' ');
  const line = by.map((b, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(b.p50).toFixed(1)}`).join('');
  const invL = inv.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g class="grid">${C.ticks(lo, hi, 3).map(v => `<line x1="0" x2="${W - pR + 4}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>`;
  s += C.ticks(lo, hi, 3).map(v => `<text class="ax m-ax" x="${W - pR + 8}" y="${Y(v) + 3.5}">${F.k(v)}</text>`).join('');
  s += `<polygon points="${band}" fill="${L.P.vio}" fill-opacity=".2" class="fade"/>`;
  s += `<path d="${invL}" fill="none" stroke="${L.P.ink2}" stroke-width="1.3" stroke-dasharray="4 4" opacity=".7"/>`;
  s += `<path d="${line}" fill="none" stroke="${L.P.acc}" stroke-width="2.2" pathLength="1" class="draw"/>`;
  s += `<line x1="0" x2="${W - pR}" y1="${Y(g.target)}" y2="${Y(g.target)}" stroke="${L.P.ref}" stroke-width="1.2" stroke-dasharray="2 4"/>`;
  s += `<text class="ax" x="4" y="${Y(g.target) - 6}" style="fill:${L.P.ref}">Objectif <tspan class="m-ax">${L.esc(F.k(g.target))}</tspan></text>`;
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i, j) => { s += `<text class="ax" x="${X(i)}" y="${H - 6}" text-anchor="${j === 0 ? 'start' : j === 2 ? 'end' : 'middle'}">${new Date().getFullYear() + by[i].year}</text>`; });
  el.classList.add('ch'); el.innerHTML = s + '</svg>';
};

/* ── Anneau de score (qualité, santé) ── */
C.ring = (score, size = 72) => {
  const r = size / 2 - 6, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score || 0));
  const col = v >= 80 ? L.P.up : v >= 60 ? L.P.ref : L.P.down;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${v} sur 100"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(150,160,255,.14)" stroke-width="7"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#EDE9DF" font-size="${size / 3.2}" font-weight="500" style="font-family:var(--f-num)">${v}</text></svg>`;
};
C.gauge = (v, max = 100) => {
  const p = Math.max(0, Math.min(100, (v || 0) / max * 100));
  const col = v >= 80 ? 'var(--up)' : v >= 60 ? 'var(--warn)' : 'var(--down)';
  return `<div class="gauge" role="img" aria-label="${Math.round(v)} sur ${max}"><i style="width:${p}%;background:${col}"></i></div>`;
};

/* ── Barres classées (répartition) avec repère de seuil ── */
C.hbars = (rows, { max, tick, fmt = x => F.pctU(x, 1), color = '', target } = {}) => {
  const mx = max || Math.max(...rows.map(r => r.pct), tick || 0, 1);
  return rows.map(r => `<div class="hb"><span class="lbl" title="${L.esc(r.label)}">${L.esc(r.label)}</span>
    <span class="trk"><span class="fil ${color}" style="width:${Math.max(1.5, r.pct / mx * 100)}%"></span>${tick ? `<span class="tick" style="left:${tick / mx * 100}%" title="Seuil d'alerte ${F.pctU(tick, 0)}"></span>` : ''}${target && r.target_pct ? `<span class="tgt" style="left:${Math.min(100, r.target_pct / mx * 100)}%" title="Cible ${F.pctU(r.target_pct, 0)}"></span>` : ''}</span>
    <span class="val">${fmt(r.pct, r)}</span></div>`).join('');
};
/* ── Barres divergentes (contributions en €) ── */
C.dbars = (rows, fmt = x => F.eurS(x, 0)) => {
  const mx = Math.max(...rows.map(r => Math.abs(r.v)), 1);
  return rows.map(r => `<div class="db"><span class="lbl" title="${L.esc(r.label)}">${L.esc(r.label)}</span><span class="trk"><span class="fil ${r.v >= 0 ? 'p' : 'n'}" style="width:${Math.abs(r.v) / mx * 50}%"></span></span><span class="val ${L.cls(r.v)}">${L.m(fmt(r.v))}</span></div>`).join('');
};

/* ── Colonnes groupées (états financiers), axe zéro, une seule échelle ── */
C.groupCols = (el, years, series, fmt) => {
  const W = Math.max(280, el.clientWidth || 420), H = 190, pR = 56, pT = 10, pB = 22;
  const vals = series.flatMap(s => s.v.filter(v => v != null));
  if (!vals.length) { el.innerHTML = ''; return; }
  let hi = Math.max(0, ...vals), lo = Math.min(0, ...vals); const pad = (hi - lo) * .08; hi += pad; lo -= lo < 0 ? pad : 0;
  const Y = v => pT + (hi - v) / (hi - lo) * (H - pT - pB);
  const n = years.length, gw = (W - pR) / n, bw = Math.min(26, gw / (series.length + 1.2));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g class="grid">${C.ticks(lo, hi, 3).map(v => `<line x1="0" x2="${W - pR + 4}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>`;
  s += C.ticks(lo, hi, 3).map(v => `<text class="ax" x="${W - pR + 8}" y="${Y(v) + 3.5}">${L.esc(fmt(v))}</text>`).join('');
  s += `<line x1="0" x2="${W - pR}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(124,152,224,.4)"/>`;
  years.forEach((y, i) => {
    const x0 = i * gw + (gw - bw * series.length - 3 * (series.length - 1)) / 2;
    series.forEach((se, k) => {
      const v = se.v[i]; if (v == null) return;
      const y1 = Y(Math.max(v, 0)), y2 = Y(Math.min(v, 0));
      s += `<rect x="${x0 + k * (bw + 3)}" y="${y1}" width="${bw}" height="${Math.max(1, y2 - y1)}" rx="3" fill="${se.color}"><title>${L.esc(se.name)} ${L.esc(y)} : ${L.esc(fmt(v))}</title></rect>`;
    });
    s += `<text class="ax" x="${i * gw + gw / 2}" y="${H - 5}" text-anchor="middle">${L.esc(y)}</text>`;
  });
  el.classList.add('ch'); el.innerHTML = s + '</svg>';
};
})();
