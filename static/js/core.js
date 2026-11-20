/* LUMIO — noyau : formats, API, état, routeur, tiroirs, notifications. Aucune dépendance. */
(function () {
'use strict';
const L = window.L = window.L || {};
/* Version en ligne (GitHub Pages, statique.js chargé avant ce fichier) : copie en lecture seule */
L.statique = !!(window.LUMIO_STATIC && window.LUMIO_STATIC.on);
const NB = ' ', NN = ' ', MI = '−';

/* ── Stockage local (préférences d'affichage seulement ; tout peut manquer) ── */
L.store = {
  get(k, d) { try { const v = localStorage.getItem('lumio.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lumio.' + k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } },
};

/* Période et indice de comparaison communs à toutes les vues : tableau de bord, portefeuille,
   performance et barre du haut changent ensemble */
L.PERIODS = [['1d', '1J'], ['1w', '1S'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1A'], ['max', 'Max']];
L.PLABEL = { '1d': "aujourd'hui", '1w': 'sur 1 semaine', '1m': 'sur 1 mois', ytd: 'depuis le 1er janvier', '1y': 'sur 1 an',
  max: 'depuis le début', '3m': 'sur 3 mois', '3y': 'sur 3 ans', custom: 'sur la période choisie' };
L.PSHORT = { '1d': '1J', '1w': '1S', '1m': '1M', ytd: 'YTD', '1y': '1A', max: 'Max', '3m': '3M', '3y': '3A', custom: 'Dates' };
L.period = () => { const k = L.store.get('app.period', null) ?? L.store.get('dash.period', '1m'); return L.PERIODS.some(p => p[0] === k) ? k : '1m'; };
L.setPeriod = k => {
  if (!L.PERIODS.some(p => p[0] === k)) return;
  const changed = k !== L.period();
  L.store.set('app.period', k);
  document.querySelectorAll('[data-gper]').forEach(b => { const on = b.dataset.gper === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  if (changed) document.dispatchEvent(new CustomEvent('lumio:period', { detail: k }));
};
L.perSeg = (extra = '', id = '') => `<div class="seg ${extra}"${id ? ` id="${id}"` : ''} role="group" aria-label="Période">${L.PERIODS.map(([k, l]) => `<button type="button" data-gper="${k}" class="${k === L.period() ? 'on' : ''}" aria-pressed="${k === L.period()}">${l}</button>`).join('')}</div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-gper]'); if (b) { e.preventDefault(); L.setPeriod(b.dataset.gper); } });

L.bench = () => L.store.get('app.bench', null) ?? L.store.get('dash.bench', null) ?? L.store.get('pf.bench', 'msci_world');
L.setBench = k => { if (k === L.bench()) return; L.store.set('app.bench', k); document.dispatchEvent(new CustomEvent('lumio:bench', { detail: k })); };
/* Liste des indices et de vos ETF, plus « autre ETF » (ticker Yahoo ou ISIN) */
L.benchSelect = (list, label = '', id = '', small = false) => {
  const cur = L.bench();
  const groups = {};
  (list || []).forEach(b => { (groups[b.group || 'Indices'] = groups[b.group || 'Indices'] || []).push(b); });
  const known = (list || []).some(b => b.key === cur);
  const opt = b => `<option value="${L.esc(b.key)}"${b.key === cur ? ' selected' : ''}>${L.esc(b.label)}</option>`;
  return `<span class="bench-pick"><select class="sel${small ? ' sm' : ''}" data-bench${id ? ` id="${id}"` : ''} aria-label="Indice ou ETF de comparaison">
    ${Object.entries(groups).map(([g, xs]) => `<optgroup label="${L.esc(g)}">${xs.map(opt).join('')}</optgroup>`).join('')}
    <optgroup label="Autre">${known ? '' : `<option value="${L.esc(cur)}" selected>${L.esc(label || cur)}</option>`}<option value="__custom">Autre ETF (ticker ou ISIN)…</option></optgroup></select>
    <form data-benchf hidden><input class="inp" placeholder="VWCE.DE, IE00BK5BQT80…" aria-label="Ticker Yahoo ou ISIN de l'ETF de comparaison" maxlength="15"><button class="btn sm" type="submit">Comparer</button></form></span>`;
};
document.addEventListener('change', e => {
  const s = e.target.closest('select[data-bench]'); if (!s) return;
  if (s.value === '__custom') { const f = s.parentElement.querySelector('form[data-benchf]'); if (f) { f.hidden = false; f.querySelector('input').focus(); } return; }
  L.setBench(s.value);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-benchf]'); if (!f) return;
  e.preventDefault();
  const v = f.querySelector('input').value.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v) && !/^[A-Z0-9^][A-Z0-9.\-=^]{0,14}$/.test(v)) { L.toast('Ticker ou ISIN invalide (ex. VWCE.DE ou IE00BK5BQT80)', true); return; }
  L.setBench(v);
});

/* ── Palette : couleurs des graphiques lues dans les variables CSS (palette « Observatoire » bleu /
   orange, ou « classique » vert / rouge choisie dans Réglages) ── */
try { if (L.store.get('palette', 'obs') === 'classic') document.documentElement.dataset.pal = 'classic'; } catch (e) { /* ignore */ }
L.palette = () => {
  const cs = getComputedStyle(document.documentElement);
  const g = (k, d) => (cs.getPropertyValue('--' + k).trim() || d);
  L.P = { up: g('up', '#8FCBFF'), down: g('down', '#FF8F4A'), acc: g('acc', '#B6A6FF'), vio: g('violet', '#8A6CFF'),
    ref: g('ref', '#E9C46A'), ink2: g('ink2', '#BDB9CC'), bench: g('bench', '#9592AE'), accSoft: g('acc-soft', 'rgba(182,166,255,.45)') };
  return L.P;
};
L.palette();
L.setPalette = (name) => {
  L.store.set('palette', name);
  if (name === 'classic') document.documentElement.dataset.pal = 'classic'; else delete document.documentElement.dataset.pal;
  L.palette();
};

/* ── Échappement : texte et URL ── */
L.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Boîte de dialogue intégrée (remplace prompt/confirm : même style que l'appli, accessible au
   clavier, et fonctionnelle là où le navigateur bloque les fenêtres natives). Promesse : liste des
   valeurs saisies, ou null si annulé. */
L.form = (title, fields = [], okLabel = 'Valider', danger = false) => new Promise((res) => {
  if (typeof HTMLDialogElement === 'undefined') {            // très vieux navigateur : fenêtres natives
    if (!fields.length) return res(window.confirm(title) ? [] : null);
    const out = []; for (const f of fields) { const v = window.prompt(f.label, f.value ?? ''); if (v === null) return res(null); out.push(v); }
    return res(out);
  }
  const d = document.createElement('dialog');
  d.className = 'dlg';
  d.setAttribute('aria-labelledby', 'dlgT');
  d.innerHTML = `<form><h2 id="dlgT">${L.esc(title)}</h2>${fields.map((f, i) => `<label class="dlg-f"><span>${L.esc(f.label)}</span><input class="inp" name="f${i}" type="text" value="${L.esc(f.value ?? '')}" placeholder="${L.esc(f.placeholder || '')}"${f.maxlength ? ` maxlength="${f.maxlength}"` : ''}${f.inputmode ? ` inputmode="${f.inputmode}"` : ''} autocomplete="off"></label>`).join('')}
    <div class="dlg-b"><button class="btn sm" type="button" data-x>Annuler</button><button class="btn sm ${danger ? 'danger' : 'p'}" type="submit">${L.esc(okLabel)}</button></div></form>`;
  document.body.appendChild(d);
  const opener = document.activeElement;
  const done = (v) => { if (d.open) d.close(); d.remove(); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); res(v); };
  d.querySelector('[data-x]').onclick = () => done(null);
  d.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
  d.addEventListener('click', (e) => { if (e.target === d) done(null); });   // clic sur le fond
  d.querySelector('form').onsubmit = (e) => { e.preventDefault(); done(fields.map((f, i) => d.querySelector(`[name=f${i}]`).value)); };
  d.showModal();
  const first = d.querySelector('input');
  if (first) first.select(); else d.querySelector('[type=submit]').focus();
});
L.confirmBox = (text, okLabel = 'Confirmer', danger = true) => L.form(text, [], okLabel, danger).then(v => v !== null);

/* Écrit dans un élément s'il existe encore (la vue a pu changer pendant un chargement) */
L.put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; return el; };
L.url = u => { const s = String(u || ''); return /^https?:\/\//i.test(s) ? L.esc(s) : '#'; };

/* ── Formats français : espace fine insécable, virgule, vrai signe moins ── */
const grp = (x, d) => {
  const s = Math.abs(x).toFixed(d);
  const [i, f] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, NN) + (f ? ',' + f : '');
};
const F = L.fmt = {
  n(x, d = 0) { if (x == null || isNaN(x)) return '—'; return (x < 0 && Math.abs(x) >= 0.5 * Math.pow(10, -d) ? MI : '') + grp(x, d); },
  s(x, d = 0) { if (x == null || isNaN(x)) return '—'; const r = Math.abs(x) < 0.5 * Math.pow(10, -d); return (r ? '' : x > 0 ? '+' : MI) + grp(x, d); },
  eur(x, d = 2) { return x == null || isNaN(x) ? '—' : F.n(x, d) + NB + '€'; },
  eurS(x, d = 0) { return x == null || isNaN(x) ? '—' : F.s(x, d) + NB + '€'; },
  pct(x, d = 2) { return x == null || isNaN(x) ? '—' : F.s(x, d) + NB + '%'; },
  pctU(x, d = 1) { return x == null || isNaN(x) ? '—' : F.n(x, d) + NB + '%'; },
  fr(x, d = 1) { return x == null || isNaN(x) ? '—' : F.s(x * 100, d) + NB + '%'; },      // fraction -> %
  frU(x, d = 1) { return x == null || isNaN(x) ? '—' : F.n(x * 100, d) + NB + '%'; },
  pt(x, d = 1) { return x == null || isNaN(x) ? '—' : F.s(x, d) + NB + 'pt'; },
  sym(c) { return ({ EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥', GBp: 'p' })[c] || c || '€'; },
  cur(x, c, d = 2) { if (x == null || isNaN(x)) return '—'; const s = F.sym(c); return c === 'USD' ? F.n(x, d) + NB + '$' : F.n(x, d) + NB + s; },
  qty(q) { if (q == null) return '—'; const d = Math.abs(q - Math.round(q)) < 1e-9 ? 0 : Math.min(6, String(q).split('.')[1]?.length || 0); return F.n(q, d); },
  big(x, c = 'EUR') {
    if (x == null) return '—'; const s = F.sym(c); const a = Math.abs(x);
    if (a >= 1e12) return F.n(x / 1e12, 1) + NB + 'T' + s; if (a >= 1e9) return F.n(x / 1e9, 1) + NB + 'Md' + s;
    if (a >= 1e6) return F.n(x / 1e6, a >= 1e8 ? 0 : 1) + NB + 'M' + s; return F.n(x, 0) + NB + s;
  },
  k(x, step) {
    const a = Math.abs(x);
    if (a >= 1e6) return F.n(x / 1e6, step && step < 1e5 ? 2 : 1) + NB + 'M€';
    if (a >= 1e3) return F.n(x / 1e3, step ? (step < 100 ? 2 : step < 1000 ? 1 : 0) : (a >= 1e4 ? 0 : 1)) + NB + 'k€';
    return F.n(x, 0) + NB + '€';
  },
  months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  monthsL: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  toDate(t) { if (t == null) return null; if (typeof t === 'number') return new Date(t < 1e11 ? t * 1000 : t); const s = String(t); return new Date(s.length === 10 ? s + 'T12:00:00' : s); },
  date(t) { const d = F.toDate(t); return d && !isNaN(d) ? `${d.getDate()} ${F.months[d.getMonth()]} ${d.getFullYear()}` : '—'; },
  dshort(t) { const d = F.toDate(t); return d && !isNaN(d) ? `${d.getDate()} ${F.months[d.getMonth()]}` : '—'; },
  dlong(t) { const d = F.toDate(t); return d ? `${F.days[d.getDay()]} ${d.getDate()} ${F.monthsL[d.getMonth()]}` : '—'; },
  time(t) { const d = F.toDate(t); return d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; },
  mon(m) { const [y, mm] = String(m).split('-'); return F.months[+mm - 1] + (y ? ' ' + y.slice(2) : ''); },
  ago(h) {
    if (h == null) return ''; if (h < 1) return 'il y a ' + Math.max(1, Math.round(h * 60)) + NB + 'min';
    if (h < 48) return 'il y a ' + Math.round(h) + NB + 'h'; return 'il y a ' + Math.round(h / 24) + NB + 'j';
  },
  inDays(iso) {
    const d = F.toDate(iso); const t = new Date(); t.setHours(12, 0, 0, 0);
    const n = Math.round((d - t) / 864e5); return n <= 0 ? "aujourd'hui" : n === 1 ? 'demain' : 'dans ' + n + NB + 'j';
  },
};
L.cls = x => x == null || isNaN(x) || Math.abs(x) < 1e-9 ? 'flat' : x > 0 ? 'up' : 'dn';
L.arrow = x => x == null || Math.abs(x) < 1e-9 ? '' : `<span class="arrow" aria-hidden="true">${x > 0 ? '▲' : '▼'}</span>`;
/* Variation : couleur + flèche + signe (jamais la couleur seule) */
L.delta = (x, txt) => `<span class="${L.cls(x)}">${L.arrow(x)} ${txt}</span>`;
/* Montants en euros : classe .m floutée en mode discret */
L.m = (txt, k) => `<span class="m"${k ? ` data-k="${k}"` : ''}>${txt}</span>`;
/* Texte venu du serveur (titres, réponses) : échappé, et chaque montant en € masqué en mode discret */
const MONEY = /[-+−]?\d[\d\u202f\u00a0 .,]*\s?(?:k€|M€|€)/g;
L.mText = (txt) => L.esc(txt).replace(MONEY, x => L.m(x));
/* Annonce pour lecteurs d'écran (région aria-live de la coque) */
L.live = (msg) => { const n = document.getElementById('live'); if (n) { n.textContent = ''; setTimeout(() => { n.textContent = msg; }, 30); } };
/* Mot adapté à l'appareil : « Touchez » sur écran tactile, « Cliquez » à la souris */
L.coarse = window.matchMedia('(pointer: coarse)').matches;
/* « Touchez une case » (tactile) / « Cliquez sur une case » (souris) : toucher est transitif */
L.tapW = (cap = true) => (L.coarse ? (cap ? 'Touchez' : 'touchez') : (cap ? 'Cliquez sur' : 'cliquez sur'));
/* Valeur héros : partie entière grande, décimales petites */
L.heroVal = x => {
  if (x == null) return '—';
  const s = F.n(x, 2); const i = s.lastIndexOf(',');
  return `${s.slice(0, i)}<small>${s.slice(i)}${NB}€</small>`;
};
/* Avant-dernière clôture européenne (17 h 30, jours ouvrés) : des cours plus anciens sont périmés,
   quel que soit le jour (lundi matin, les cours de vendredi soir restent à jour) */
L.prevClose = (now = new Date()) => {
  const d = new Date(now); d.setHours(17, 30, 0, 0);
  const back = () => { do d.setDate(d.getDate() - 1); while (d.getDay() === 0 || d.getDay() === 6); };
  if (d > now || d.getDay() === 0 || d.getDay() === 6) back();   // dernière clôture passée
  back();                                                         // celle d'avant
  return d.getTime() / 1000;
};
/* Pont de la période (7.9) : valeur de départ + achats nets + gain = valeur actuelle. Tout vient de
   la série quotidienne de la performance (h.bridge), et le pont se termine sur la valeur affichée en
   grand (cours en direct) : les chiffres s'additionnent toujours. Achats nets = titres achetés moins
   titres vendus, au prix payé ou reçu. Dividendes : encaissés sur le compte, hors valeur des titres,
   mais comptés dans le gain (comme la performance). 1J : rien, la variation du jour suffit. */
L.PSTART = { '1w': 'il y a 1 semaine', '1m': 'il y a 1 mois', ytd: 'au 1er janvier', '1y': 'il y a 1 an', max: 'au départ' };
L.bridge = (h, p, total) => {
  if (p === '1d' || !h || h.range !== p || !h.bridge || total == null) return null;
  const b = h.bridge, extra = b.extra_flows || 0, flows = (b.flows || 0) + extra, divs = b.dividends || 0;
  let pct = b.twr;
  if (pct != null && b.last_value > 0) {          // séance en cours (cours en direct) ajoutée au rendement
    const stub = (total - extra) / b.last_value - 1;
    if (Math.abs(stub) < 0.5) pct = (1 + pct) * (1 + stub) - 1;
  }
  return { t: b.start_t, start: b.start_value, flows, divs, gain: total - b.start_value - flows + divs, end: total,
    pct: pct == null ? null : pct * 100, begin: !!b.from_beginning, deposits: b.deposits };
};
/* Le pont en une phrase, arrondi à l'euro sans casser l'égalité (le gain absorbe les arrondis) */
L.bridgeText = (br, p) => {
  const e = x => L.m(F.eur(x, 0)), sg = x => L.m(F.eurS(x, 0));
  const rs = Math.round(br.start), rf = Math.round(br.flows), re = Math.round(br.end), rg = re - rs - rf;
  const head = br.begin ? `Depuis le ${F.dshort(br.t)} : achats nets ${sg(rf)}`
    : `${L.PSTART[p].charAt(0).toUpperCase()}${L.PSTART[p].slice(1)} (${F.dshort(br.t)}) : ${e(rs)} ; achats nets ${sg(rf)}`;
  const divs = Math.round(br.divs) ? ` (et ${e(Math.round(br.divs))} de dividendes encaissés)` : '';
  const dep = br.deposits ? ` Versements sur le compte : ${sg(br.deposits)}.` : '';
  return `${head} ; ${divs ? 'gain sur les cours' : 'gain'} ${sg(rg)} ; aujourd'hui ${e(re)}${divs}.${dep}`;
};
L.BRIDGE_TIP = "Valeur de départ + achats nets + gain = valeur d'aujourd'hui. Achats nets : titres achetés moins titres vendus, au prix payé ou reçu ; versements : argent versé sur le compte moins les retraits.";
L.initials = n => (n || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const HUES = ['#B6A6FF', '#8A6CFF', '#C9BCFF', '#D8D2F0', '#9A8FD0', '#EDE9DF'];   // avatars : nuancier nébuleuse, texte nuit
L.avColor = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
L.avatar = (name, key) => `<span class="av" style="background:${L.avColor(key || name)}">${L.esc(L.initials(name))}</span>`;

/* ── API : en-tête anti-CSRF pour toute écriture, cache mémoire court pour les lectures ── */
const memo = new Map();
L.api = async (url, opts = {}) => {
  const o = { method: opts.method || 'GET', headers: {} };
  if (o.method !== 'GET') { o.headers['X-LUMIO'] = '1'; }
  if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
  const r = await fetch(url, o);
  if (r.headers.get('X-LUMIO-Stale') && L.staleSoon) L.staleSoon();   // chiffres en cours de recalcul : relus bientôt
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (r.status === 401 && data && data.login) {          // LUMIO en ligne : session expirée ou révoquée
    L.snap.clear();
    location.replace('/login' + (location.hash || ''));
    const err = new Error('Connexion requise'); err.status = 401; throw err;
  }
  if (!r.ok) { const err = new Error((data && data.error) || `Erreur ${r.status}`); err.status = r.status; err.data = data; throw err; }
  return data;
};
L.get = (url, ttl = 20000, force = false) => {
  const hit = memo.get(url);
  if (!force && hit && Date.now() - hit.t < ttl) return hit.p;
  const p = L.api(url).then(d => { L.snap.put(url, d); return d; }).catch(e => { memo.delete(url); throw e; });
  memo.set(url, { t: Date.now(), p });
  return p;
};
/* Démarrage instantané : la dernière réponse des lectures de l'accueil reste sur cet appareil
   (12 h au plus) et s'affiche aussitôt, le temps que la réponse fraîche arrive (puis la remplace).
   Effacée à la déconnexion et à l'écran de connexion. */
const SNAP_OK = [/^\/api\/portfolio$/, /^\/api\/dashboard$/, /^\/api\/portfolio\/history\?range=\w+$/,
  /^\/api\/performance\?period=\w+&bench=[\w.%-]+$/, /^\/api\/indices$/];
L.snap = {
  ok: url => !L.statique && SNAP_OK.some(r => r.test(url)),     // version en ligne : rien en clair sur l'appareil
  get(url) {
    if (!L.snap.ok(url)) return null;
    const s = L.store.get('snap:' + url, null);
    return s && s.d && Date.now() - s.t < 12 * 3600e3 ? s.d : null;
  },
  put(url, d) { if (d && L.snap.ok(url)) L.store.set('snap:' + url, { t: Date.now(), d }); },
  clear() { try { Object.keys(localStorage).filter(k => k.startsWith('lumio.snap:')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* stockage indisponible */ } },
};
/* Sauvegarde LUMIO : choisir le fichier, confirmer, l'envoyer tel quel (zip), tout recharger */
L.importBackup = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.zip,application/zip';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (!(await L.confirmBox(`Importer « ${f.name} » ? Les données de ce LUMIO seront remplacées par celles de la sauvegarde (une copie de l'état actuel est gardée).`, 'Importer', false))) return;
    L.toast('Import de la sauvegarde…');
    try {
      const r = await fetch('/api/backup/restore', { method: 'POST', headers: { 'X-LUMIO': '1', 'Content-Type': 'application/zip' }, body: f, credentials: 'same-origin' });
      let d = {}; try { d = await r.json(); } catch (e) { d = {}; }
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
      L.toast(`Sauvegarde importée : ${d.files} fichier${d.files > 1 ? 's' : ''}`);
      if (L.reloadAll) L.reloadAll(); else location.reload();
    } catch (e) { L.toast(e.message, true); }
  };
  inp.click();
};
document.addEventListener('click', e => { const b = e.target.closest('[data-restore]'); if (b) { e.preventDefault(); L.importBackup(); } });
L.forget = (prefix) => { for (const k of [...memo.keys()]) if (!prefix || k.startsWith(prefix)) memo.delete(k); };

/* ── Icônes (traits 1,8 px, 24 × 24) ── */
const P = {
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',
  chevl: '<path d="m15 18-6-6 6-6"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h5v-6h4v6h5V9"/>',
  dash: '<rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/>',
  news: '<path d="M4 5h12v14H6a2 2 0 0 1-2-2z"/><path d="M16 9h3a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2"/><path d="M7.5 9h5M7.5 12.5h5M7.5 16h3"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18.5 5.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.4 6.5A16.5 16.5 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/>',
  map: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M12 10h9M3 14h9"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.2h2"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.1v.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.6-3 3-5 6-5s5.4 2 6 5"/><path d="M16 5.5a3 3 0 010 5.5M18 14c1.5.6 2.6 2.4 3 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>',
  scale: '<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8 2.5 14a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
};
L.icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ── Toast ── */
let toastT;
L.toast = (msg, err = false, act = null) => {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '') + (act ? ' act' : ''); t.setAttribute('role', err ? 'alert' : 'status');
  if (act) {                                  // action rattrapable : « Annuler »
    const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-b'; b.textContent = act.label;
    b.onclick = () => { clearTimeout(toastT); t.className = 'toast'; act.fn(); };
    t.append(' ', b);
  }
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, err || act ? 5000 : 2600);
};

/* ── Mise à jour en place : les nombres modifiés s'illuminent ── */
L.swap = (el, html, flash = true) => {
  if (!el) return;
  const before = {};
  if (flash) el.querySelectorAll('[data-k]').forEach(n => { before[n.dataset.k] = n.textContent; });
  el.innerHTML = html;
  if (!flash) return;
  el.querySelectorAll('[data-k]').forEach(n => {
    const b = before[n.dataset.k];
    if (b !== undefined && b !== n.textContent) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
  });
};
L.skel = (h, w = '100%') => `<div class="sk" style="height:${h}px;width:${w}"></div>`;
L.errMsg = (e) => {
  if (!e || !e.status || e.status >= 500) return navigator.onLine === false ? 'Hors ligne : les dernières valeurs connues restent affichées.' : 'Données indisponibles pour le moment.';
  return (e && e.message) || 'Données indisponibles pour le moment.';
};
L.errBox = (e, retry) => `<div class="err-box" role="alert"><span>${L.esc(L.errMsg(e))}</span>${retry ? `<button class="btn sm" data-retry="${retry}">Réessayer</button>` : ''}</div>`;

/* ── Tiroirs : un seul ouvert, Échap ferme, focus rendu à l'élément d'origine ── */
const drawers = {};
let lastFocus = null;
/* Hors du tiroir ouvert, la page est inerte : le focus clavier y reste piégé (aria-modal tenu) */
const INERT = ['skip', 'main', 'tb', 'bn'];
const setInert = (on) => INERT.forEach(id => { const n = document.getElementById(id); if (n) { if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); } });
/* Feuille du bas (téléphone) : glisser la poignée ou l'en-tête vers le bas pour fermer */
const swipe = (d) => {
  let y0 = null, dy = 0;
  const start = e => {
    if (window.innerWidth >= 720 || e.target.closest('button,a,input,select,textarea')) return;
    y0 = e.clientY; dy = 0; d.style.transition = 'none';
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }   // le doigt peut sortir de la poignée
  };
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); d.style.transform = `translateY(${dy}px)`; };
  const end = () => { if (y0 == null) return; d.style.transition = ''; d.style.transform = ''; if (dy > 90) L.drawer.close(); y0 = null; };
  d.addEventListener('pointerdown', e => { if (e.target.closest('.grab,.dr-h')) start(e); });
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
};
/* Tiroir fermé : inerte et masqué aux lecteurs d'écran (sinon Tab y entre, hors de l'écran) */
const hideDrawer = (d) => { d.setAttribute('inert', ''); d.setAttribute('aria-hidden', 'true'); };
L.drawer = {
  open(id, { title = '', sub = '', html = '', narrow = false, wide = false, head = '' } = {}) {
    let d = drawers[id];
    if (!d) {
      d = document.createElement('aside');
      d.className = 'drawer'; d.id = 'dr-' + id; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      document.body.appendChild(d); drawers[id] = d; swipe(d);
    }
    Object.keys(drawers).forEach(k => { if (k !== id) { drawers[k].classList.remove('on'); hideDrawer(drawers[k]); } });
    d.removeAttribute('inert'); d.removeAttribute('aria-hidden');
    d.classList.toggle('narrow', narrow); d.classList.toggle('wide', wide);
    d.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="dr-h"><div class="t">${head || `<h2>${title}</h2>${sub ? `<div class="note">${sub}</div>` : ''}`}</div>
      <button class="ibtn" data-close aria-label="Fermer">${L.icon('x')}</button></div><div class="dr-b">${html}</div>`;
    d.setAttribute('aria-label', String(title).replace(/<[^>]+>/g, '') || id);
    if (!d.classList.contains('on') && !Object.values(drawers).some(x => x !== d && x.classList.contains('on'))) lastFocus = document.activeElement;
    setInert(true);
    requestAnimationFrame(() => { d.classList.add('on'); document.getElementById('scrim').classList.add('on'); });
    setTimeout(() => { const f = d.querySelector('[data-close]'); f && f.focus({ preventScroll: true }); }, 60);
    L.drawer.current = id;
    return d;
  },
  body(id) { const d = drawers[id]; return d && d.querySelector('.dr-b'); },
  el(id) { return drawers[id]; },
  close(silent) {
    Object.values(drawers).forEach(d => { d.classList.remove('on'); hideDrawer(d); });
    document.getElementById('scrim').classList.remove('on');
    setInert(false);
    const was = L.drawer.current; L.drawer.current = null;
    // Focus rendu à l'élément d'origine ; s'il a disparu ou est inerte (feuille ouverte par un lien
    // ou une notification), au titre de la vue
    if (lastFocus && lastFocus.isConnected && lastFocus.focus && !lastFocus.closest('[inert]')) lastFocus.focus({ preventScroll: true });
    else { const h = document.querySelector('#main h1') || document.getElementById('main'); if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    if (!silent && was) L.router.dropParam(was === 'pos' ? 'p' : was === 'ia' ? 'ia' : 'd');
  },
  current: null,
};

/* ── Popover ancré ── */
/* Bulle d'information (cloche, qualité, « i ») : un nom par usage, focus déplacé dans la bulle,
   Échap ou focus sorti la ferment et rendent le focus au bouton d'origine. */
let popAnchor = null;
const popClose = (refocus) => {
  const p = document.getElementById('pop');
  if (!p.classList.contains('on')) return;
  p.classList.remove('on');
  if (popAnchor) { popAnchor.setAttribute('aria-expanded', 'false'); if (refocus) popAnchor.focus(); }
  popAnchor = null;
};
L.popClose = popClose;
L.pop = (anchor, html, label) => {
  const p = document.getElementById('pop');
  if (popAnchor && popAnchor !== anchor) popAnchor.setAttribute('aria-expanded', 'false');
  p.innerHTML = html; p.classList.add('on');
  p.setAttribute('aria-label', label || anchor.getAttribute('aria-label') || 'Détails');
  p.tabIndex = -1;
  popAnchor = anchor; anchor.setAttribute('aria-expanded', 'true');
  const r = anchor.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  p.style.top = (r.bottom + 8) + 'px';
  p.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w)) + 'px';
  p.focus({ preventScroll: true });
  const off = ev => { if (!p.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) { popClose(false); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
};
document.addEventListener('keydown', (e) => {
  if (!popAnchor) return;
  if (e.key === 'Escape') { e.stopPropagation(); popClose(true); return; }
  if (e.key !== 'Tab') return;
  const p = document.getElementById('pop');
  const items = [...p.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')];
  const at = document.activeElement;
  if (e.shiftKey && (at === p || at === items[0])) { e.preventDefault(); popClose(true); return; }
  if (!e.shiftKey && (at === items[items.length - 1] || (at === p && !items.length))) {
    e.preventDefault();
    const anchor = popAnchor;
    popClose(false);
    const all = [...document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]')]
      .filter(x => !x.closest('[inert],#pop') && x.offsetParent !== null);
    const next = all[all.indexOf(anchor) + 1];
    (next || anchor).focus();
  }
}, true);
document.addEventListener('focusin', (e) => {
  const p = document.getElementById('pop');
  if (popAnchor && p && !p.contains(e.target) && e.target !== popAnchor) popClose(false);
});

/* ── Routeur par adresse (#/vue/sous-vue?p=ISIN&ia=1) : le bouton retour fonctionne ── */
L.views = {};
L.router = {
  parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = (path || 'accueil').split('/').filter(Boolean);
    const q = {}; new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    return { view: parts[0] || 'accueil', sub: parts[1] || '', q };
  },
  href(view, sub, q) {
    const qs = new URLSearchParams(q || {}).toString();
    return '#/' + view + (sub ? '/' + sub : '') + (qs ? '?' + qs : '');
  },
  go(view, sub, q) { location.hash = L.router.href(view, sub, q); },
  setParam(k, v) {
    const r = L.router.parse(); r.q[k] = v; history.pushState(null, '', L.router.href(r.view, r.sub, r.q)); L.router.apply(false);
  },
  dropParam(k) {
    const r = L.router.parse(); if (!(k in r.q)) return; delete r.q[k];
    history.replaceState(null, '', L.router.href(r.view, r.sub, r.q));
  },
  last: null,
  apply(render = true) {
    const r = L.router.parse();
    const prev = L.router.last;
    const viewChanged = !prev || prev.view !== r.view || prev.sub !== r.sub;
    L.router.last = r;
    if (render && viewChanged || !prev) L.render(r, prev);
    // Calques : fiche valeur, panneau IA, détail
    if (r.q.p) { if (!(L.drawer.current === 'pos' && L.pos && L.pos.uid === r.q.p)) L.openPosition(r.q.p, true); }
    else if (r.q.ia) { if (L.drawer.current !== 'ia') L.openIA(true); }
    else if (L.drawer.current && L.drawer.current !== 'detail') L.drawer.close(true);
  },
};

/* ── Marchés : ouverture de Paris et New York (heures locales des places) ── */
L.marketStatus = () => {
  const now = new Date();
  const part = (tz) => {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const g = t => f.find(x => x.type === t)?.value;
    return { wd: g('weekday'), m: (+g('hour') % 24) * 60 + (+g('minute')) };
  };
  const paris = part('Europe/Paris').m;
  const hm = (tzMin, tz) => { const off = ((paris - part(tz).m) % 1440 + 1440) % 1440; const v = (tzMin + off) % 1440; return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const one = (name, tz, o, c) => {
    const { wd, m } = part(tz); const we = wd === 'Sat' || wd === 'Sun';
    const open = !we && m >= o && m < c;
    return { name, open, txt: open ? `${name} ferme à ${hm(c, tz)}` : `${name} ${we ? 'fermé' : m < o ? 'ouvre à ' + hm(o, tz) : 'fermé'}` };
  };
  return [one('Paris', 'Europe/Paris', 540, 1050), one('New York', 'America/New_York', 570, 960)];
};

/* ── Divers ── */
L.debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
L.qs = (s, r = document) => r.querySelector(s);
L.qsa = (s, r = document) => [...r.querySelectorAll(s)];
/* Délégation idempotente : relier deux fois le même sélecteur remplace l'ancien gestionnaire */
L.on = (root, ev, sel, fn) => {
  root.__on = root.__on || {};
  if (!root.__on[ev]) {
    root.__on[ev] = {};
    root.addEventListener(ev, e => { for (const [s, f] of Object.entries(root.__on[ev] || {})) { const t = e.target.closest(s); if (t && root.contains(t)) f(e, t); } });
  }
  root.__on[ev][sel] = fn;
};
/* Info-bulle « i » : un vrai bouton (clavier, toucher), le texte s'ouvre dans une bulle */
L.tipTxt = (txt) => `<button type="button" class="info" data-tip="${L.esc(txt)}" aria-label="Explication : ${L.esc(txt)}">i</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('button.info[data-tip]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  L.pop(b, `<div class="note" style="font-size:13px;color:var(--ink2)" tabindex="0">${L.esc(b.dataset.tip)}</div>`, 'Explication');
}, true);
L.state = { privacy: L.store.get('privacy', false), demo: false, health: null };
})();
