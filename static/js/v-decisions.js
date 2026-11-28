/* LUMIO — Décisions : le bureau du gestionnaire de patrimoine.
   En tête, ce qui demande une réponse (à trancher, à préparer, à lire) et sur quelle part du
   portefeuille ; puis chaque dossier avec ses raisons, la ligne, des options chiffrées côte à côte
   (poids, liquidités, plus-value, impôt) et un journal qui suit chaque décision dans le temps.
   LUMIO ne recommande rien : il chiffre, vous tranchez. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const SUBS = [['dossiers', 'À décider'], ['synthese', 'Synthèse'], ['marche', 'Marché'], ['actus', 'Actualités'], ['journal', 'Journal'], ['bilan', 'Bilan']];
const S = { sel: null, data: null, case: null, filter: L.store.get('dec.filter', 'all'), sim: { k: 'conserver', amt: 25, eur: 0 } };

function shell(root, sub) {
  root.innerHTML = `<div class="ph"><h1 class="title">Décisions</h1><span class="note" id="decMeta"></span></div>
    <nav class="subnav" style="margin-top:0" aria-label="Sections du bureau de décision">${SUBS.map(([k, l]) => `<a href="#/decisions/${k}" data-sub="${k}" class="${k === sub ? 'on' : ''}">${l}</a>`).join('')}</nav><div id="dSub"></div>`;
}
function renderSub(sub, dir) {
  const el = document.getElementById('dSub'); if (!el) return;
  el.className = dir && !document.documentElement.classList.contains('vt-sub') ? (dir > 0 ? 'slide-r' : 'slide-l') : '';
  L.qsa('.subnav a').forEach(a => { a.classList.toggle('on', a.dataset.sub === sub); if (a.dataset.sub === sub) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  el.innerHTML = `<div class="sk-on">${L.skel(320)}</div>`;
  ({ dossiers, synthese: L.synthese, marche, actus, journal, bilan })[sub](el);        // synthese : v-synthese.js
}

/* ── À décider : ce qui demande une réponse, et sur quelle part du portefeuille ── */
const NEEDS = ['trancher', 'preparer', 'lire'];
const NEED = { trancher: { label: 'À trancher', cls: 'nd-t' }, preparer: { label: 'À préparer', cls: 'nd-p' }, lire: { label: 'À lire', cls: 'nd-l' } };
const needOf = c => NEED[c && c.need] ? c.need : 'lire';
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const weights = () => { const m = {}; ((L.data.portfolio || {}).positions || []).forEach(p => { m[p.uid] = p.weight || 0; }); return m; };
/* Part du portefeuille touchée par des dossiers (une ligne comptée une fois, même dans deux dossiers) */
const exposure = (cs, w) => { let s = 0; new Set(cs.flatMap(c => c.uids)).forEach(u => { s += w[u] || 0; }); return s || cs.reduce((a, c) => a + (c.exposure_pct || 0), 0); };

function headline(open, w) {
  const by = k => open.filter(c => needOf(c) === k);
  const t = by('trancher'), p = by('preparer'), l = by('lire');
  const rest = [p.length ? plural(p.length, 'rendez-vous à préparer', 'rendez-vous à préparer') : '',
    l.length ? plural(l.length, 'information à lire', 'informations à lire') : ''].filter(Boolean).join(' et ');
  const verb = p.length + l.length > 1 ? 's\'y ajoutent' : 's\'y ajoute';
  if (t.length) {
    return { h: plural(t.length, 'décision à trancher', 'décisions à trancher'),
      s: `${t.length > 1 ? 'Elles portent' : 'Elle porte'} sur ${F.pctU(exposure(t, w), 0)} de votre portefeuille${rest ? ` ; ${verb} ${rest}` : ''}.` };
  }
  return { h: 'Rien à trancher', s: rest ? `Aucune de vos règles n'est franchie ; vous avez ${rest}.` : 'Aucune actualité importante, aucune de vos règles franchie.' };
}

/* Ruban : le portefeuille entier, une case par ligne à la taille de son poids, éclairée selon ce qu'elle demande */
function ribbon(open) {
  const ps = ((L.data.portfolio || {}).positions || []).filter(p => (p.weight || 0) > 0);
  if (!ps.length) return '';
  const rank = { trancher: 0, preparer: 1, lire: 2 };
  const best = {};
  open.forEach(c => c.uids.forEach(u => {
    const cur = best[u], k = needOf(c);
    if (!cur || rank[k] < rank[cur.k] || (rank[k] === rank[cur.k] && c.uids.length < cur.c.uids.length)) best[u] = { k, c };
  }));
  const segs = ps.map(p => ({ p, b: best[p.uid] }))
    .sort((x, y) => (x.b ? rank[x.b.k] : 3) - (y.b ? rank[y.b.k] : 3) || (y.p.weight - x.p.weight));
  const total = segs.reduce((a, x) => a + x.p.weight, 0) || 100;
  return `<div class="rb" role="group" aria-label="Votre portefeuille, ligne par ligne">${segs.map(({ p, b }) => {
    const share = p.weight / total * 100;
    const lbl = `${p.name} : ${F.pctU(p.weight, 1)} du portefeuille, ${b ? NEED[b.k].label.toLowerCase() : 'rien à signaler'}`;
    const attr = b ? `data-case="${L.esc(b.c.id)}"` : `data-pos="${L.esc(p.uid)}"`;
    return `<button type="button" class="rb-s ${b ? NEED[b.k].cls : 'nd-0'}${b && b.c.id === S.sel ? ' on' : ''}" style="flex-grow:${share.toFixed(3)}" ${attr} aria-label="${L.esc(lbl)}" title="${L.esc(lbl)}">${share >= 6 ? `<span>${L.esc(p.name)}</span>` : ''}</button>`;
  }).join('')}</div>
  <p class="rb-cap"><i class="sw nd-0" aria-hidden="true"></i>Rien à signaler. Chaque case est une ligne, à la taille de son poids : ${L.tapW(false)} une case pour ouvrir son dossier.</p>`;
}

const triage = (open) => `<div class="tri" role="group" aria-label="Afficher les dossiers">${NEEDS.map(k => {
  const n = open.filter(c => needOf(c) === k).length;
  return `<button type="button" class="tri-b${S.filter === k ? ' on' : ''}" data-df="${k}" aria-pressed="${S.filter === k}"${n ? '' : ' disabled'}><i class="sw ${NEED[k].cls}" aria-hidden="true"></i><span class="only-d">${NEED[k].label}</span><span class="only-m">${NEED[k].label.slice(2).replace(/^./, x => x.toUpperCase())}</span><b>${n}</b></button>`;
}).join('')}<button type="button" class="tri-b${S.filter === 'all' ? ' on' : ''}" data-df="all" aria-pressed="${S.filter === 'all'}">Tous<b>${open.length}</b></button></div>`;

/* Jauge : votre chiffre face à votre limite (le texte du signal porte les valeurs) */
const gauge = (s, cls = '') => {
  if (!s || s.value == null || s.limit == null) return '';
  const v = Math.abs(s.value), lim = Math.abs(s.limit), max = Math.max(lim * 1.5, v * 1.08, 1);
  return `<span class="gg ${cls}" aria-hidden="true"><i style="width:${Math.min(100, v / max * 100).toFixed(1)}%"></i><em style="left:${(lim / max * 100).toFixed(1)}%"></em></span>`;
};
const SIGN = { actu: 'actualité', regle: 'règle', prix: 'seuil de prix', resultats: 'résultats', agenda: 'rendez-vous' };
function card(c) {
  const sig = c.signals || [c], top = sig[0] || c, multi = c.uids.length > 1;
  const p = multi ? null : L.posByUid(c.uids[0]);
  const name = multi ? c.title : (c.line_name || (p && p.name) || c.title);
  const text = multi ? (top.kind === 'actu' ? c.why : top.short || c.why) : (top.short || c.title);
  const rule = !multi ? sig.find((x, i) => i > 0 && x.value != null && x.limit != null) : null;
  const others = sig.slice(1).filter(x => x !== rule);
  const names = multi ? c.uids.map(u => (L.posByUid(u) || {}).name || u) : [];
  const meta = [multi ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : '',
    others.length ? `+ ${[...new Set(others.map(x => SIGN[x.kind] || 'signal'))].join(', ')}` : '',
    p && p.change_pct_day != null ? `jour ${F.pct(p.change_pct_day, 1)}` : '',
    c.last_decision && c.last_decision.new_signals ? 'nouveau depuis votre décision' : ''].filter(Boolean);
  return `<button type="button" class="dc ${NEED[needOf(c)].cls}${c.id === S.sel ? ' on' : ''}" data-case="${L.esc(c.id)}" role="listitem">
    <span class="dc-h"><b class="dc-n"${multi ? '' : ` data-co="${L.esc(c.uids[0])}"`}>${L.esc(name)}</b><span class="dc-w">${F.pctU(multi ? c.exposure_pct : (p ? p.weight : c.exposure_pct), 1)}</span></span>
    <span class="dc-x">${L.mText(text)}</span>${gauge(top)}${rule ? `<span class="dc-x dc-r">${L.mText(rule.short || rule.title)}</span>${gauge(rule)}` : ''}
    ${meta.length ? `<span class="dc-m">${L.esc(meta.join(' ; '))}</span>` : ''}</button>`;
}
const cardDone = c => `<button type="button" class="dc done" data-case="${L.esc(c.id)}" role="listitem">
  <span class="dc-h"><b class="dc-n"${(c.uids || []).length === 1 ? ` data-co="${L.esc(c.uids[0])}"` : ''}>${L.esc(c.line_name || c.title)}</b><span class="dc-w">${F.pctU(c.exposure_pct, 1)}</span></span>
  <span class="dc-m">${L.esc(ACT[c.decided.action] || 'Traité')} ${F.ago((Date.now() / 1000 - c.decided.ts) / 3600)}${c.decided.until && c.decided.until - Date.now() / 1000 < 400 * 86400 ? `, réexamen le ${F.dshort(c.decided.until)}` : ''}</span></button>`;

function groups(open, done) {
  const shown = open.filter(c => S.filter === 'all' || needOf(c) === S.filter);
  let html = NEEDS.map(k => {
    const cs = shown.filter(c => needOf(c) === k); if (!cs.length) return '';
    return `<div class="dg"><h3 class="dg-h"><i class="sw ${NEED[k].cls}" aria-hidden="true"></i>${NEED[k].label}<span class="muted">${cs.length}</span></h3>
      <div class="dec-list" role="list">${cs.map(card).join('')}</div></div>`;
  }).join('');
  if (!shown.length) html = `<div class="empty">${open.length ? 'Aucun dossier de ce type pour l\'instant.' : 'Rien à trancher : aucune actualité importante, aucune de vos règles franchie.'}</div>`;
  if (done.length) html += `<details class="dg dg-done"><summary class="dg-h">${L.icon('chev')}Déjà tranchés<span class="muted">${done.length}</span></summary>
    <div class="dec-list" role="list">${done.map(cardDone).join('')}</div></details>`;
  return html;
}

async function dossiers(el, force = false, quiet = false) {
  let d;
  try { d = await L.get('/api/decisions', 45000, force); } catch (e) { if (!quiet) el.innerHTML = L.errBox(e); return; }
  if (!document.getElementById('dSub')) return;
  S.data = d;
  if (S.filter !== 'all' && !NEEDS.includes(S.filter)) { S.filter = 'all'; L.store.set('dec.filter', 'all'); }   // anciens filtres (par type)
  const cases = d.cases || [], open = cases.filter(c => !c.decided), done = cases.filter(c => c.decided);
  const meta = document.getElementById('decMeta');
  if (meta) meta.textContent = d.open ? `${plural(d.open, 'dossier ouvert', 'dossiers ouverts')}${d.reviews_due ? `, ${plural(d.reviews_due, 'décision à réexaminer', 'décisions à réexaminer')}` : ''}` : 'Aucun dossier ouvert';
  L.setBadge(d.urgent ?? open.filter(c => needOf(c) === 'trancher').length);
  const shown = open.filter(c => S.filter === 'all' || needOf(c) === S.filter);
  const keep = S.sel && cases.some(c => c.id === S.sel);
  if (!keep) S.sel = (shown[0] || open[0] || cases[0] || {}).id || null;
  const hl = headline(open, weights());
  const top = `<h2 class="dk-h">${hl.h}</h2><p class="dk-s">${L.esc(hl.s)}</p>${ribbon(open)}${triage(open)}`;
  const left = `${groups(open, done)}${d.empty ? '' : rulesBox(d.rules)}`;
  // Rafraîchissement : le dossier ouvert à droite reste tel quel (option choisie, note en cours de saisie)
  if (quiet && keep && document.getElementById('decCase') && document.getElementById('dk')) {
    L.swap(document.getElementById('dk'), top, false); L.swap(document.getElementById('decL'), left, false);
  } else {
    el.innerHTML = `<div class="dk" id="dk">${top}</div><div class="dec"><aside class="dec-l" id="decL">${left}</aside>
      <section class="dec-r" id="decCase" aria-live="polite">${S.sel ? L.skel(420) : '<div class="empty">Choisissez un dossier.</div>'}</section></div>`;
    if (S.sel && window.innerWidth >= 900) openCase(S.sel);     // téléphone : la fiche s'ouvre au toucher
  }
  L.on(el, 'click', '[data-df]', (e, b) => { S.filter = b.dataset.df === S.filter ? 'all' : b.dataset.df; L.store.set('dec.filter', S.filter); dossiers(el); });
  L.on(el, 'click', '[data-case]', (e, b) => {
    S.sel = b.dataset.case;
    L.qsa('[data-case]', el).forEach(x => x.classList.toggle('on', x.dataset.case === S.sel));
    openCase(S.sel);
    if (b.classList.contains('rb-s') && window.innerWidth >= 900) { const box = document.getElementById('decCase'); if (box && box.getBoundingClientRect().top > window.innerHeight * 0.6) box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  L.on(el, 'submit', '#rulesF', async (e, f) => {
    e.preventDefault();
    const fd = new FormData(f); const body = {};
    for (const k of ['max_line', 'max_sector', 'stop', 'take_profit', 'drawdown', 'max_spec', 'tranches']) { const v = fd.get(k); if (v !== null) body[k] = v === '' ? null : +String(v).replace(',', '.'); }
    try { await L.api('/api/rules', { method: 'PUT', body }); L.forget('/api/decisions'); L.forget('/api/synthese'); L.toast('Règles enregistrées'); dossiers(el, true); } catch (err) { L.toast(err.message, true); }
  });
}
const ACT = { conserver: 'Conservé', alleger: 'Allégé', renforcer: 'Renforcé', vendre: 'Vendu', surveiller: 'Surveillé' };
const rulesBox = r => `<details class="w dec-rules"><summary><b>Vos règles</b><span class="note"> : ligne ${F.n(r.max_line, 0)} %, secteur ${F.n(r.max_sector, 0)} %, perte ${F.n(r.stop, 0)} %</span></summary>
  <form id="rulesF" class="frm" style="grid-template-columns:1fr 1fr;margin-top:10px">
    <label>Poids max d'une action (%)<input class="inp" name="max_line" inputmode="decimal" value="${r.max_line}"></label>
    <label>Poids max d'un secteur (%)<input class="inp" name="max_sector" inputmode="decimal" value="${r.max_sector}"></label>
    <label>Seuil de perte (%)<input class="inp" name="stop" inputmode="decimal" value="${r.stop}"></label>
    <label>Recul depuis le plus-haut (%)<input class="inp" name="drawdown" inputmode="decimal" value="${r.drawdown}"></label>
    <label>Prise de bénéfices (%, facultatif)<input class="inp" name="take_profit" inputmode="decimal" value="${r.take_profit ?? ''}" placeholder="aucune"></label>
    <label>Poids max d'un pari spéculatif (%)<input class="inp" name="max_spec" inputmode="decimal" value="${r.max_spec ?? 2}"></label>
    <label>Paliers pour une entrée<input class="inp" name="tranches" inputmode="numeric" value="${r.tranches ?? 3}"></label>
    <div style="display:flex;align-items:flex-end"><button class="btn" type="submit">Enregistrer</button></div>
  </form><p class="note" style="margin-top:6px">Une règle franchie ouvre un dossier : elle ne décide rien à votre place. Les ETF sont exclus du poids max d'une action. Les deux derniers seuils servent à la <a class="lnk" style="font-size:12px" href="#/decisions/synthese">synthèse</a>.</p></details>`;

async function openCase(id) {
  const mob = window.innerWidth < 900;
  const box = mob ? null : document.getElementById('decCase');
  let c;
  try { c = await L.get('/api/decisions/case/' + encodeURIComponent(id), 30000); }
  catch (e) { if (box) box.innerHTML = L.errBox(e); else L.toast(e.message, true); return; }
  if (S.sel !== id) return;
  if (!S.case || S.case.id !== c.id) S.sim = { k: 'conserver', amt: 25, eur: 0 };     // nouveau dossier : rien de choisi
  S.case = c;
  const head = caseHead(c), html = caseHtml(c);
  if (mob) {
    const d = L.drawer.open('detail', { wide: true, title: L.esc(c.line_name || c.title), head, html });
    bindCase(d, c);
  } else if (box) { box.innerHTML = `<div class="dec-h">${head}</div>${html}`; bindCase(box, c); }
}

function caseHead(c) {
  const lines = c.lines || [], l = lines.length === 1 ? lines[0] : null;
  const where = l ? [l.sector, l.envelope].filter(Boolean).join(', ') : '';
  const sub = l ? `${where ? L.esc(where) + '. ' : ''}${F.pctU(l.weight, 1)} du portefeuille, ${L.m(F.eur(l.value, 0))}`
    : `${lines.length} lignes, ${F.pctU(c.exposure_pct, 1)} du portefeuille, ${L.m(F.eur(c.exposure_eur, 0))}`;
  return `<span class="nd-chip ${c.decided ? '' : NEED[needOf(c)].cls}">${c.decided ? 'Déjà tranché' : NEED[needOf(c)].label}</span><h2${l ? ` data-co="${L.esc(l.uid)}"` : ''}>${L.esc(l ? l.name : c.title)}</h2><div class="note">${sub}</div>`;
}

const fmtR = r => !r ? '' : r.pending ? `<div class="dec-rx"><div><span class="k-l">Réaction du cours</span><b class="flat" style="font-size:15px">pas encore de cotation depuis</b><span class="note">dernier cours : ${F.dshort(r.quote_ts)} à ${F.time(r.quote_ts)}</span></div></div>` : `<div class="dec-rx"><div><span class="k-l"${r.partial ? ' title="Actualité tombée en séance : la variation compte aussi la partie de séance qui la précède"' : ''}>${r.intraday ? 'Depuis l\'actualité' : r.session ? (r.partial ? 'Séance (en partie avant)' : 'Séance') : r.partial ? 'Depuis la clôture d\'avant' : 'Depuis l\'actualité'}</span><b class="${L.cls(r.line_pct)}">${F.pct(r.line_pct, 1)}</b></div>
  <div><span class="k-l">Marché</span><b class="${L.cls(r.market_pct)}">${r.market_pct != null ? F.pct(r.market_pct, 1) : '—'}</b></div>
  <div><span class="k-l">Écart</span><b class="${L.cls(r.relative_pt)}">${r.relative_pt != null ? F.pt(r.relative_pt, 1) : '—'}</b></div></div>`;

function sigRow(s) {
  const n = s.news, k = needOf(s);
  const txt = n && n.link ? `<a class="lnk" href="${L.url(n.link)}" target="_blank" rel="noopener noreferrer" data-nk="${L.esc(n.k)}">${L.esc(s.short || s.title)}</a>` : L.mText(s.short || s.title);
  const sub = n ? [n.source, n.age_h != null ? F.ago(n.age_h) : '', n.pol > 0 ? 'titre plutôt favorable' : n.pol < 0 ? 'titre plutôt défavorable' : 'tonalité neutre ou mitigée'].filter(Boolean).join(', ')
    : s.kind === 'agenda' ? s.why : s.rule ? '' : s.why;
  return `<div class="sg ${NEED[k].cls}"><span class="sg-k">${NEED[k].label}</span><div class="sg-b"><div class="sg-t">${txt}</div>${gauge(s, 'lg')}
    ${sub ? `<div class="sg-s">${L.esc(sub)}</div>` : ''}${n && n.summary ? `<p class="sg-p">${L.esc(n.summary)}</p>` : ''}</div></div>`;
}
/* ── Présentation de l'entreprise : au survol d'un nom (souris), et dépliable dans le dossier ── */
const capFmt = (x, c) => { const s = F.sym(c); return x >= 1e9 ? `${F.n(x / 1e9, x >= 1e10 ? 0 : 1)}${' '}Md${s}` : `${F.n(x / 1e6, 0)}${' '}M${s}`; };
const coFacts = d => {
  const f = d.facts || {}; const out = [];
  if (d.kind === 'etf') {
    if (f.index) out.push(['Indice suivi', f.index]);
    if (f.top_sectors) out.push(['Secteurs principaux', f.top_sectors]);
    if (f.ter != null) out.push(['Frais annuels', F.pctU(f.ter, 2)]);
    return out;
  }
  if (f.founded) out.push(['Création', String(f.founded)]);
  if (f.hq) out.push(['Siège', f.hq]);
  if (f.employees) out.push(['Effectif', `≈${' '}${F.n(f.employees, 0)} salariés`]);
  if (f.ceo) out.push(['Dirigeant', f.ceo]);
  if (f.market_cap && f.currency) out.push(['Capitalisation', capFmt(f.market_cap, f.currency)]);
  return out;
};
L.coHtml = (d, head = true) => {
  const f = d.facts || {}; const facts = coFacts(d);
  const sub = [f.industry, f.country].filter(Boolean).join(', ');
  const lng = d.summary_lang === 'en' ? ', texte en anglais' : d.summary_lang === 'de' ? ', texte en allemand' : '';
  return `${head ? `<div class="co-h"><b>${L.esc(d.name)}</b>${d.sector ? `<span class="co-tag">${L.esc(d.sector)}</span>` : ''}</div>` : ''}
    ${sub ? `<div class="co-s">${L.esc(sub)}</div>` : ''}
    <p class="co-p${d.summary ? '' : ' muted'}">${d.summary ? L.esc(d.summary) : 'Pas de présentation disponible pour cette ligne.'}</p>
    ${facts.length ? `<dl class="co-f">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${L.esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${d.source ? `<div class="tt-foot">Source : ${head || !d.url ? L.esc(d.source) : `<a class="lnk" href="${L.url(d.url)}" target="_blank" rel="noopener noreferrer">${L.esc(d.source)}</a>`}${lng}</div>` : ''}`;
};
const coGet = uid => L.get('/api/company/' + encodeURIComponent(uid), 3600000);
let coT = null, coEl = null;
const coPlace = (t, el) => { if (el.isConnected) C.placeTipAt(t, el.getBoundingClientRect()); };
async function coShow(el) {
  const t = C.ftip(); t._h = null;
  t.innerHTML = `<div class="tt co"><div class="co-h"><b>${L.esc(el.textContent)}</b></div><p class="co-p muted">Chargement de la présentation…</p></div>`;
  t.style.display = 'block'; coPlace(t, el);
  let html;
  try { html = L.coHtml(await coGet(el.dataset.co)); } catch (e) { html = `<p class="co-p muted">Présentation indisponible : ${L.esc(e.message)}</p>`; }
  if (coEl !== el) return;
  t.innerHTML = `<div class="tt co">${html}</div>`; coPlace(t, el);
}
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('[data-co]');
  if (el === coEl) return;
  clearTimeout(coT);
  if (coEl) C.hideTip();
  coEl = el;
  if (el) coT = setTimeout(() => { if (coEl === el) coShow(el); }, 350);
});
document.addEventListener('pointerout', e => {
  const el = e.target.closest('[data-co]');
  if (!el || el !== coEl || (e.relatedTarget && el.contains(e.relatedTarget))) return;
  clearTimeout(coT); coEl = null; C.hideTip();
});
document.addEventListener('click', () => { if (coEl) { clearTimeout(coT); coEl = null; C.hideTip(); } }, true);
const coBox = l => `<details class="dec-co" data-cofill="${L.esc(l.uid)}"><summary>${L.icon('chev')}${['ETF', 'Fonds'].includes(l.asset_type) ? 'Le fonds en bref' : l.asset_type === 'Crypto' ? 'En bref' : "L'entreprise en bref"}</summary><div class="dec-co-b"><p class="co-p muted">Chargement…</p></div></details>`;
document.addEventListener('toggle', async e => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.open || !d.dataset.cofill || d._filled) return;
  d._filled = true;
  const b = d.querySelector('.dec-co-b');
  try { b.innerHTML = L.coHtml(await coGet(d.dataset.cofill), false); } catch (err) { d._filled = false; b.innerHTML = `<p class="co-p muted">Présentation indisponible : ${L.esc(err.message)}</p>`; }
}, true);
const lineBlock = l => `<div class="dec-line"><div class="dec-ln"><a href="#" data-pos="${L.esc(l.uid)}"><b data-co="${L.esc(l.uid)}">${L.esc(l.name)}</b></a><span class="note">${L.esc([l.sector, l.envelope].filter(Boolean).join(', '))}</span></div>
  ${coBox(l)}
  ${fmtR(l.reaction)}
  <dl class="kv kv4">
    <div><dt>Valeur</dt><dd>${L.m(F.eur(l.value, 0))}</dd></div><div><dt>Poids</dt><dd>${F.pctU(l.weight, 1)}</dd></div>
    <div><dt>+/− latente</dt><dd class="${L.cls(l.pnl)}">${L.m(F.eurS(l.pnl))}, ${F.pct(l.pnl_pct, 0)}</dd></div><div><dt>PRU</dt><dd>${L.m(F.eur(l.avg_cost))}</dd></div>
    <div><dt>Jour</dt><dd class="${L.cls(l.day_pct)}">${F.pct(l.day_pct, 1)}</dd></div><div><dt>1 mois</dt><dd class="${L.cls(l.perf['1m'])}">${F.pct(l.perf['1m'], 1)}</dd></div>
    <div><dt>1 an</dt><dd class="${L.cls(l.perf['1y'])}">${F.pct(l.perf['1y'], 0)}</dd></div><div><dt>Volatilité</dt><dd>${l.volatility != null ? F.frU(l.volatility / 100, 0) : '—'}</dd></div>
    <div><dt>Sous le plus-haut 1 an</dt><dd class="${L.cls(l.drawdown_52w)}">${l.drawdown_52w != null ? F.pct(l.drawdown_52w, 0) : '—'}</dd></div>
    <div><dt>Prochain rendez-vous</dt><dd>${l.next_event ? `${L.esc(l.next_event.label)}, ${F.date(new Date(l.next_event.date).getTime() / 1000)}` : '—'}</dd></div>
    ${l.consensus && l.consensus.target_mean ? `<div><dt>Objectif moyen des analystes</dt><dd>${F.n(l.consensus.target_mean, 0)} (${l.consensus.analysts || '?'} analystes)</dd></div>` : ''}
    ${l.consensus && l.consensus.pe ? `<div><dt>PER</dt><dd>${F.n(l.consensus.pe, 1)}${l.consensus.forward_pe ? `, ${F.n(l.consensus.forward_pe, 1)} attendu` : ''}</dd></div>` : ''}
  </dl></div>`;

function caseHtml(c) {
  const lines = c.lines || [];
  return `<div class="sec"><h3>Pourquoi ce dossier</h3><div class="sgs">${(c.signals || [c]).map(sigRow).join('')}</div></div>
    <div class="sec"><h3>${lines.length > 1 ? 'Les lignes concernées' : 'Votre ligne'}</h3>${lines.map(lineBlock).join('')}</div>
    <div class="sec"><h3>Vos options, chiffrées</h3>
      ${lines.length > 1 ? `<label class="note" style="display:flex;gap:8px;align-items:center;margin-bottom:10px">Ligne <select class="sel" id="simL" style="width:auto;height:34px">${lines.map((l, i) => `<option value="${i}">${L.esc(l.name)}</option>`).join('')}</select></label>` : ''}
      <div class="opts" role="radiogroup" aria-label="Vos options" id="optG"></div>
      <div id="simIn"></div><div id="simOut"></div></div>
    <div class="sec"><h3>Questions à vous poser</h3><ul class="dec-q">${(c.questions || []).map(q => `<li>${L.esc(q)}</li>`).join('')}</ul>
      <button class="btn sm ia" data-ask="${L.esc(`Dossier « ${c.title} » : quels faits pèsent pour et contre chaque option (conserver, alléger, renforcer) pour ${lines.map(l => l.name).join(', ')} ? Ne recommande rien.`)}">${L.icon('spark')}Peser le pour et le contre avec l'IA</button></div>
    <div class="sec"><h3>Consigner ma décision</h3>
      <form id="decF" class="frm" style="grid-template-columns:1fr 1fr">
        <label>Décision<select class="sel" name="action">${Object.entries({ conserver: 'Conserver', alleger: 'Alléger', renforcer: 'Renforcer', vendre: 'Tout vendre', surveiller: 'Surveiller' }).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
        <label>Réexaminer dans<select class="sel" name="review_days"><option value="">jamais</option><option value="7">1 semaine</option><option value="30" selected>1 mois</option><option value="90">3 mois</option><option value="180">6 mois</option></select></label>
        <label style="grid-column:1/-1">Pourquoi (pour vous relire plus tard)<textarea class="inp" name="note" rows="3" maxlength="1000" placeholder="Ce qui a pesé dans ma décision, ce qui me ferait changer d'avis…"></textarea></label>
        <p class="note" style="grid-column:1/-1;margin:0">Le journal suivra le cours et l'indice depuis aujourd'hui, et repérera l'opération qui l'exécute. LUMIO ne passe aucun ordre.</p>
      </form></div>
    <div class="dec-bar"><p id="decRecap" aria-live="polite"></p><button class="btn p" type="button" data-consign>${L.icon('check')}Consigner</button></div>`;
}

/* Options d'une ligne, toujours dans le même ordre (le statu quo d'abord) : des calculs, pas des conseils */
function options(l, c) {
  const T = c.total_value || 0, V = l.value || 0, lim = (c.rules || {}).max_line;
  const out = [{ k: 'conserver', action: 'conserver', label: 'Conserver' }];
  if (lim && T && V && !['ETF', 'Fonds'].includes(l.asset_type) && V / T * 100 > lim + 0.05) {
    const x = lim / 100, f = (V - x * T) / (V * (1 - x));          // part à vendre pour que le poids revienne à la limite
    out.push({ k: 'limite', action: 'alleger', amt: Math.min(99, Math.max(1, Math.ceil(f * 100))), label: `Revenir à ${F.n(lim, lim % 1 ? 1 : 0)} %`, sub: 'votre limite' });
  }
  out.push({ k: 'alleger', action: 'alleger', amt: S.sim.amt, label: `Alléger ${S.sim.amt} %` },
    { k: 'vendre', action: 'vendre', label: 'Tout vendre' },
    { k: 'renforcer', action: 'renforcer', eur: S.sim.eur, label: `Renforcer ${F.k(S.sim.eur)}` });
  return out;
}
function optCard(o, l, c, scale) {
  const r = simulate(l, o.action, o.action === 'renforcer' ? o.eur : o.amt, c);
  const lim = ['ETF', 'Fonds'].includes(l.asset_type) ? null : (c.rules || {}).max_line;
  const on = S.sim.k === o.k, sell = r.dq < 0, buy = r.dq > 0;
  const t = Math.round(r.tax) || 0;     // coût : montant simple ; une vente en perte peut le réduire (signe moins)
  const tax = sell ? (l.envelope === 'PEA' ? '0 € (PEA)' : L.m(t < 0 ? F.eurS(t, 0) : F.eur(t, 0))) : '—';
  return `<button type="button" class="opt${on ? ' on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-opt="${o.k}">
    <span class="opt-t">${L.esc(o.label)}${o.sub ? `<em>${L.esc(o.sub)}</em>` : ''}</span>
    <span class="opt-w"><span class="k-l">Poids après</span><b>${F.pctU(r.wAfter, 1)}</b>
      <span class="gg" aria-hidden="true"><i style="width:${Math.min(100, r.wAfter / scale * 100).toFixed(1)}%"></i>${lim ? `<em style="left:${Math.min(100, lim / scale * 100).toFixed(1)}%"></em>` : ''}</span></span>
    <span class="opt-r"><span>Liquidités</span><b>${sell || buy ? L.m(F.eurS(r.cash, 0)) : '—'}</b></span>
    <span class="opt-r"><span>Plus-value</span><b class="${sell ? L.cls(r.gain) : ''}">${sell ? L.m(F.eurS(r.gain, 0)) : '—'}</b></span>
    <span class="opt-r"><span>Impôt</span><b class="${sell && r.tax < -0.5 ? 'up' : ''}">${tax}</b></span></button>`;
}

function bindCase(root, c) {
  const lines = c.lines || [];
  let li = 0;
  // Le conteneur sert à chaque dossier ouvert : on retire les écouteurs du dossier précédent
  // (sinon ils s'exécutent encore et imposent leurs montants au nouveau dossier)
  if (root._decAbort) root._decAbort.abort();
  root._decAbort = new AbortController();
  const once = { signal: root._decAbort.signal };
  const q = s => root.querySelector(s);
  const current = () => { const l = lines[li]; const opts = options(l, c); return { l, opts, o: opts.find(x => x.k === S.sim.k) || opts[0] }; };
  const amountOf = o => (o.action === 'renforcer' ? S.sim.eur : o.amt);
  const grid = () => {
    const { l, opts, o } = current(); if (!l) return;
    S.sim.k = o.k;
    const T = c.total_value || 1, lim = ['ETF', 'Fonds'].includes(l.asset_type) ? 0 : ((c.rules || {}).max_line || 0);
    const scale = Math.max(lim * 1.5, (l.value || 0) / T * 100 * 1.08, 1);   // même échelle pour toutes les options
    const refocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#optG');
    q('#optG').innerHTML = opts.map(x => optCard(x, l, c, scale)).join('');
    if (refocus) { const b = q(`[data-opt="${o.k}"]`); if (b) b.focus({ preventScroll: true }); }
    q('#simOut').innerHTML = `<h4 class="sim-h">En détail : ${L.esc(o.label.toLowerCase())}</h4>${simHtml(simulate(l, o.action, amountOf(o), c), l, c)}`;
    const f = q('#decF [name=action]');
    if (f && !(o.action === 'conserver' && f.value === 'surveiller')) f.value = o.action;   // le formulaire suit toujours l'option choisie
    recap();
  };
  const adjust = () => {
    const { l, o } = current(); if (!l) return;
    q('#simIn').innerHTML = o.k === 'alleger' ? `<label class="note sim-r">Part vendue <input type="range" id="simA" min="1" max="99" step="1" value="${S.sim.amt}" aria-label="Part vendue en %"><b id="simAv">${S.sim.amt} %</b></label>`
      : o.k === 'renforcer' ? `<label class="note sim-r">Montant investi <input class="inp" id="simE" inputmode="decimal" value="${S.sim.eur}" style="width:120px;height:34px"> €</label>`
      : o.k === 'limite' ? `<p class="note sim-r">Vendre ${o.amt} % de la ligne (≈ ${L.m(F.qty((l.qty || 0) * o.amt / 100))} part${(l.qty || 0) * o.amt / 100 > 1 ? 's' : ''}) ramène son poids sous votre limite.</p>` : '';
  };
  const draw = () => {
    const l = lines[li]; if (!l) return;
    if (!S.sim.eur) S.sim.eur = Math.round((l.value || 1000) * 0.1 / 50) * 50 || 500;
    adjust(); grid();
  };
  // Ce qui sera consigné, toujours visible : jamais une autre décision que celle affichée
  const recap = () => {
    const f = q('#decF [name=action]'), el = q('#decRecap'); if (!f || !el) return;
    const { l, o } = current(); const a = f.value, name = (l && l.name) || 'la ligne';
    const pct = o.action === 'alleger' ? o.amt : S.sim.amt;
    const what = a === 'alleger' ? `Alléger ${pct} % de ${name} (≈ ${F.qty(((l && l.qty) || 0) * pct / 100)} parts)${o.k === 'limite' ? `, pour revenir à votre limite` : ''}`
      : a === 'renforcer' ? `Renforcer ${name} de ${F.eur(S.sim.eur || 0, 0)}` : a === 'vendre' ? `Tout vendre ${name}`
      : a === 'surveiller' ? 'Surveiller, sans rien changer' : 'Conserver, sans rien changer';
    el.innerHTML = `Sera consigné : <b>${L.esc(what)}</b>`;
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-opt]');
    if (b && root.contains(b)) { S.sim.k = b.dataset.opt; adjust(); grid(); return; }
    if (e.target.closest('[data-consign]')) { const f = q('#decF'); if (f) f.requestSubmit(); return; }
    const nk = e.target.closest('[data-nk]'); if (nk && L.markNewsRead) L.markNewsRead(nk.dataset.nk);
  }, once);
  root.addEventListener('keydown', e => {          // groupe d'options : flèches comme des boutons radio
    const b = e.target.closest('[data-opt]'); if (!b || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const all = L.qsa('[data-opt]', root), i = all.indexOf(b), n = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
    S.sim.k = n.dataset.opt; adjust(); grid(); const nb = q(`[data-opt="${S.sim.k}"]`); if (nb) nb.focus();
  }, once);
  root.addEventListener('input', e => {
    if (e.target.id === 'simA') { S.sim.amt = +e.target.value; const v = q('#simAv'); if (v) v.textContent = S.sim.amt + ' %'; grid(); }
    if (e.target.id === 'simE') { S.sim.eur = +String(e.target.value).replace(',', '.') || 0; grid(); }
  }, once);
  root.addEventListener('change', e => {
    if (e.target.id === 'simL') { li = +e.target.value; S.sim.eur = 0; draw(); }   // montant par défaut de la nouvelle ligne
    if (e.target.name === 'action' && e.target.closest('#decF')) {   // formulaire -> option (sens inverse)
      const v = e.target.value;
      S.sim.k = v === 'surveiller' ? 'conserver' : v === 'alleger' ? (S.sim.k === 'limite' ? 'limite' : 'alleger') : v;
      adjust(); grid();
    }
  }, once);
  q('#decF').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const action = fd.get('action'); const { o } = current();
    const body = { case_id: c.id, title: c.title, uids: c.uids, action, note: fd.get('note'), review_days: fd.get('review_days') ? +fd.get('review_days') : null };
    if (action === 'alleger') { body.amount = o.action === 'alleger' ? o.amt : S.sim.amt; body.unit = 'pct'; }
    if (action === 'renforcer') {
      if (!(S.sim.eur > 0)) { L.toast('Indiquez le montant à investir dans l\'option « Renforcer »', true); return; }
      body.amount = S.sim.eur; body.unit = 'eur';
    }
    const go = q('[data-consign]'); if (go) go.disabled = true;
    try {
      await L.api('/api/decisions/journal', { method: 'POST', body }); L.forget('/api/decisions'); L.toast('Décision consignée dans le journal');
      S.sel = null; S.case = null; L.drawer.close(); const el = document.getElementById('dSub'); if (el) dossiers(el, true);
    } catch (err) { L.toast(err.message, true); if (go) go.disabled = false; }
  }, once);
  draw();
}

/* Scénario : calcul pur (aucune recommandation). Vente au cours du jour, 1 € de frais d'ordre,
   plus-value au prix de revient moyen, impôt au PFU sur un compte-titres (PEA : à la sortie). */
function simulate(l, action, amt, c) {
  const px = l.price_eur || (l.qty ? l.value / l.qty : 0), q = l.qty || 0, T = c.total_value || 0;
  let dq = 0;
  if (action === 'alleger') dq = -q * Math.min(Math.max(amt, 0), 100) / 100;
  else if (action === 'vendre') dq = -q;
  else if (action === 'renforcer') dq = px ? Math.max(amt, 0) / px : 0;
  const dv = dq * px, fee = dq ? 1 : 0;
  const newV = (l.value || 0) + dv, newT = T + dv;
  const gain = dq < 0 ? -dq * (px - (l.avg_cost || 0)) - fee : 0;
  // Impôt MARGINAL de l'année (compte-titres) : plus-values nettes déjà réalisées et moins-values
  // reportées comprises ; une vente en perte peut donc réduire l'impôt. Crypto : régime à part.
  const tc = c.tax_ctx || {}, rate = c.pfu || 0.314, carry = tc.carry || 0, R = tc.realized || 0;
  const base = x => Math.max(0, x - carry);
  const tax = dq >= 0 || l.envelope === 'PEA' ? 0 : l.asset_type === 'Crypto' ? Math.max(gain, 0) * rate : (base(R + gain) - base(R)) * rate;
  const pf = (c.portfolio || []).map(p => ({ ...p, value: p.uid === l.uid ? newV : p.value }));
  const hhi = arr => { const t = arr.reduce((a, p) => a + Math.max(0, p.value || 0), 0) || 1; return 1 / arr.reduce((a, p) => a + ((p.value || 0) / t) ** 2, 0); };
  const secW = arr => { const t = arr.reduce((a, p) => a + (p.value || 0), 0) || 1; return arr.filter(p => p.sector === l.sector).reduce((a, p) => a + (p.value || 0), 0) / t * 100; };
  return { dq, dv, newV, wBefore: T ? (l.value || 0) / T * 100 : 0, wAfter: newT ? newV / newT * 100 : 0, gain, tax, fee, R, carry, year: tc.year,
    cash: dq < 0 ? -dv - fee - tax : dq > 0 ? -(dv + fee) : 0, nBefore: hhi(c.portfolio || []), nAfter: hhi(pf),
    secBefore: secW(c.portfolio || []), secAfter: secW(pf), rule: c.rules };
}
function taxNote(r, l, c) {
  const pfu = `PFU ${F.n((c.pfu || .314) * 100, 1)} %`;
  if (l.asset_type === 'Crypto') return `${pfu}, régime des actifs numériques (formulaire 2086) : calcul indicatif`;
  if (r.tax < -0.5) return `économie : la moins-value s'impute sur ${F.eur(r.R, 0)} de plus-values ${r.year || ''} déjà réalisées`;
  if (r.gain < 0) return `aucune plus-value à compenser cette année : moins-value reportable 10 ans`;
  if (r.carry > 0 && r.gain > 0) return `${pfu}, après ${F.eur(Math.min(r.carry, Math.max(r.R + r.gain, 0)), 0)} de moins-values reportées`;
  return `${pfu} sur la plus-value nette de l'année`;
}
function simHtml(r, l, c) {
  const rl = r.rule || {};
  const bar = (w, lim) => `<span class="sim-bar" aria-hidden="true"><i style="width:${Math.min(100, w / Math.max(lim * 1.5, w, 1) * 100)}%"></i>${lim ? `<em style="left:${Math.min(100, lim / Math.max(lim * 1.5, w, 1) * 100)}%"></em>` : ''}</span>`;
  const lim = l.asset_type === 'ETF' ? null : rl.max_line;
  return `<dl class="kv sim">
    <div><dt>Poids de la ligne</dt><dd>${F.pctU(r.wBefore, 1)} → <b>${F.pctU(r.wAfter, 1)}</b>${bar(r.wAfter, lim)}${lim ? `<span class="note">votre limite ${F.n(lim, 0)} %</span>` : ''}</dd></div>
    <div><dt>Secteur ${L.esc(l.sector || '')}</dt><dd>${F.pctU(r.secBefore, 1)} → <b>${F.pctU(r.secAfter, 1)}</b></dd></div>
    <div><dt>${r.dq < 0 ? 'Parts vendues' : r.dq > 0 ? 'Parts achetées' : 'Parts'}</dt><dd>${r.dq ? L.m(F.qty(Math.abs(r.dq))) : 'inchangées'}</dd></div>
    <div><dt>Valeur de la ligne</dt><dd>${L.m(F.eur(r.newV, 0))}</dd></div>
    ${r.dq < 0 ? `<div><dt>Plus-value réalisée</dt><dd class="${L.cls(r.gain)}">${L.m(F.eurS(r.gain))}</dd></div>
    <div><dt>Impôt ${r.year || ''} estimé</dt><dd>${l.envelope === 'PEA' ? 'aucun avant retrait (PEA)' : `<span class="${r.tax < 0 ? 'up' : ''}">${L.m(F.eurS(Math.round(r.tax) || 0))}</span> <span class="note">${taxNote(r, l, c)}</span>`}</dd></div>
    <div><dt>Liquidités nettes</dt><dd><b>${L.m(F.eur(r.cash, 0))}</b></dd></div>` : r.dq > 0 ? `<div><dt>À investir</dt><dd>${L.m(F.eur(-r.cash, 0))} <span class="note">frais d'ordre compris</span></dd></div>` : ''}
    <div><dt>Diversification</dt><dd>${F.n(r.nBefore, 1)} → <b>${F.n(r.nAfter, 1)}</b> lignes « effectives »</dd></div>
  </dl><p class="note">Calcul au cours du jour, 1 € de frais d'ordre, plus-value au prix de revient moyen ; estimation indicative, l'IFU fait foi. Ce n'est pas un conseil en investissement.</p>`;
}

/* ── Marché ── */
async function marche(el, force = false) {
  let d;
  try { d = await L.get('/api/decisions', 45000, force); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const m = d.market || {}; const r = m.regime;
  const idx = m.indices || [];
  el.innerHTML = `<div class="cards">
    <section class="w c8"><div class="w-h"><h2>Régime de marché${r ? ' · ' + L.esc(r.label) : ''}</h2>${m.yahoo && !m.yahoo.ok ? `<div class="r"><span class="tag warn" title="${L.esc(m.yahoo.reason || '')}">cours Trade Republic</span></div>` : ''}</div>
      ${r ? `<div class="regime">
        <div class="rg-big"><span class="k-l">Tendance</span><b>${L.esc(r.trend)}</b><span class="note">cours ${F.pct(r.vs_ma200_pct, 1)} par rapport à sa moyenne de 200 séances</span></div>
        <div class="rg-big"><span class="k-l">Climat</span><b>${L.esc(r.stress)}</b><span class="note">volatilité d'un mois ${F.n(r.vol_1m, 0)} % contre ${F.n(r.vol_1y, 0)} % sur un an</span></div>
        <div class="rg-big"><span class="k-l">Sous le plus-haut</span><b class="${L.cls(r.drawdown_pct)}">${F.pct(r.drawdown_pct, 1)}</b><span class="note">depuis le plus-haut d'un an</span></div>
      </div><div id="rgC"></div>
      <div class="stat-row" style="margin-top:10px">${[['1 mois', r.perf_1m], ['3 mois', r.perf_3m], ['1 an', r.perf_1y]].map(([k, v]) => `<div class="kpi"><span class="k-l">${k}</span><span class="k-d ${L.cls(v)}">${F.pct(v, 1)}</span></div>`).join('')}</div>` : '<div class="empty">Historique de l\'indice indisponible : relancez maj.bat pour rapatrier les repères Trade Republic.</div>'}
      <p class="note" style="margin-top:8px">Des faits sur l'état du marché, pas une prévision.</p></section>
    <section class="w c4"><div class="w-h"><h2>Vos lignes aujourd'hui</h2></div>
      <div class="breadth"><b>${m.breadth ? m.breadth.up : 0}</b><span>en hausse sur ${m.breadth ? m.breadth.known : 0} cotées${m.breadth && m.breadth.known < m.breadth.total ? ` (${m.breadth.total - m.breadth.known} sans cours)` : ''}</span></div>
      <div class="w-h" style="margin-top:14px"><h2>Vos secteurs</h2></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Secteur</th><th class="num">Poids</th><th class="num">Jour</th><th class="num">1 mois</th></tr></thead><tbody>
      ${(m.sectors || []).map(x => `<tr><td>${L.esc(x.sector)} <span class="muted">${x.lines}</span></td><td class="num">${F.pctU(x.weight, 0)}</td><td class="num ${L.cls(x.day)}">${F.pct(x.day, 1)}</td><td class="num ${L.cls(x.perf_1m)}">${F.pct(x.perf_1m, 1)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="w c12"><div class="w-h"><h2>Marchés du jour</h2></div><div class="idx-grid">
      ${idx.map(x => `<div class="idx"><div class="idx-n">${L.esc(x.label)}${x.proxy ? ' <span class="muted" title="ETF coté chez Trade Republic">ETF</span>' : ''}</div>
        <div class="idx-v">${x.price != null ? F.n(x.price, x.price < 10 ? 4 : x.price < 1000 ? 2 : 0) : '—'}</div>
        <div class="${L.cls(x.change_pct_day)}">${F.pct(x.change_pct_day, 2)}</div>${C.spark(x.spark || [], { w: 120, h: 30, color: (x.change_pct_day || 0) >= 0 ? L.P.up : L.P.down })}</div>`).join('')}</div></section>
  </div>`;
  if (r && r.spark && r.spark.length > 2) {
    const v = r.spark, t = v.map((_, i) => i);
    C.line(document.getElementById('rgC'), { t, h: 140, label: 'Indice mondial sur six mois', series: [{ v, color: L.P.vio, w: 2, area: true }], fmtY: x => F.n(x, 0), fmtX: () => '', endDot: true, nTicks: 2,
      tip: i => `<b>${F.n(v[i], 2)}</b>` });
  }
}

/* ── Actualités (vue existante, dans le bureau) ── */
function actus(el) {
  el.innerHTML = '';
  L.views.actus.render(el, { view: 'actus', embedded: true });
}

/* ── Journal ── */
/* ── Bilan (8.0) : ce que valent les signaux sur vos lignes, et vos seuils face à votre portefeuille ── */
const RK = { recul: 'Recul depuis le plus-haut', tendance: 'Baisse de plus de 15 % en 3 mois' };
const sgn = x => (x > 0 ? '+' : '') + F.n(x, 1) + ' %';
function retroRows(r) {
  const row = (k, h) => {
    const a = (r[k] || {})[h]; if (!a) return `<td colspan="3" class="muted">pas assez d'historique</td>`;
    return `<td class="num ${L.cls(a.ligne)}">${sgn(a.ligne)}</td><td class="num ${L.cls(a.indice)}">${sgn(a.indice)}</td><td class="num">${a.sous} sur ${a.n}</td>`;
  };
  return ['recul', 'tendance'].map(k => `<tr><td>${RK[k]}${k === 'recul' ? ` (au-delà de ${F.n(r.lim, 0)} %)` : ''}</td>
    <td class="num">${((r[k] || {})['30'] || {}).n || 0}</td>${row(k, '30')}${row(k, '90')}</tr>`).join('');
}
function retroLead(r, idx) {
  const a = (r.recul || {})['30'];
  if (!a) return 'Pas assez d\'historique pour rejouer les signaux sur vos lignes.';
  const worse = a.sous / a.n >= 0.5;
  return `Sur un an, ${plural(a.n, 'signal de recul', 'signaux de recul')} sur vos lignes : un mois après, la ligne a fait moins bien que ${L.esc(idx)} dans ${a.sous} cas sur ${a.n}${worse ? ' ; le signal a le plus souvent annoncé la suite.' : ' ; le plus souvent, la ligne s\'est ensuite reprise.'}`;
}
const CAL = { stop: ['Seuil de perte', 'depuis l\'achat'], drawdown: ['Recul depuis le plus-haut', 'sur un an'], max_line: ['Poids maximum d\'une action', 'du portefeuille'] };
function calHtml(c) {
  return Object.keys(CAL).map(k => {
    const r = c[k]; if (!r || r.current == null) return '';
    const alts = r.alts.filter(a => a.v !== r.current && a.n !== r.n);
    return `<div class="bl-cal"><div><b>${CAL[k][0]}</b> : ${F.n(r.current, 0)} % ${CAL[k][1]}<span class="note"> · franchi aujourd'hui par ${plural(r.n, 'ligne', 'lignes')} sur ${c.n}</span></div>
      ${alts.length ? `<div class="bl-alts">${alts.map(a => `<button type="button" class="chip" data-blrule="${k}" data-blv="${a.v}" title="Enregistrer ce seuil dans vos règles">${F.n(a.v, 0)} % : ${plural(a.n, 'ligne', 'lignes')}</button>`).join('')}</div>` : ''}</div>`;
  }).join('');
}
async function bilan(el, force = false) {
  let b;
  try { b = await L.get('/api/bilan', 60000, force); } catch (e) { el.innerHTML = L.errBox(e); return; }
  if (b.empty) { el.innerHTML = '<div class="empty"><b>Pas encore de portefeuille</b><span>Le bilan apparaît après la première mise à jour.</span></div>'; return; }
  const r = b.retro || {}, sg = b.signaux || {}, j = b.journal || {}, idx = b.indice || 'l\'indice';
  const sgHtml = sg.out || sg.in ? [['out', 'Sorties et allègements signalés'], ['in', 'Renforcements signalés']].filter(([k]) => sg[k]).map(([k, l]) =>
    `<p>${l} : ${plural(sg[k].n, 'ligne', 'lignes')} ; un mois après, ${sgn(sg[k].ligne)} contre ${sgn(sg[k].indice)} pour ${L.esc(idx)} (moins bien que l'indice : ${sg[k].sous} sur ${sg[k].n}).</p>`).join('')
    : `<p class="ink2">File du matin notée depuis le ${sg.premier ? F.date(new Date(sg.premier).getTime() / 1000) : 'premier jour'} (${plural(sg.jours || 0, 'jour', 'jours')}). Premier bilan le ${sg.pret ? F.date(sg.pret) : '—'} : il faut un mois de recul.</p>`;
  const jHtml = j.juges ? `<p>${plural(j.juges, 'décision jugée', 'décisions jugées')} sur ${j.n} : ${j.tiennent} tiennent face à ${L.esc(idx)}${j.effet_eur != null ? ` ; effet cumulé ${L.m(F.eurS(j.effet_eur, 0))}` : ''}.</p>
      <p class="note">Un allègement ou une vente tient si la ligne a fait moins bien que l'indice depuis ; un renforcement, si elle a fait mieux ; conserver, si elle n'a pas fait moins bien. Jugé après une semaine.</p>`
    : `<p class="ink2">${j.n ? `${plural(j.n, 'décision consignée', 'décisions consignées')}, jugée${j.n > 1 ? 's' : ''} une semaine après.` : 'Aucune décision consignée : « Consigner » depuis un dossier les ajoute au journal.'}</p>`;
  el.innerHTML = `<div class="cards">
    <section class="w c12 bl-lead"><h2 class="dk-h">${retroLead(r, idx)}</h2>
      <p class="dk-s">Les deux signaux de prix de LUMIO rejoués chaque séance de la dernière année, sur vos ${r.lines || 0} actions actuelles, face à ${L.esc(idx)}. Sans frais ni impôt : un ordre de grandeur pour régler votre confiance, pas une prévision.</p></section>
    <section class="w c12"><div class="w-h"><h2>Signaux rejoués sur un an</h2></div>
      <div class="tbl-wrap"><table class="tbl bl-t"><thead><tr><th>Signal</th><th class="num">Signaux</th><th class="num">Ligne à 1 mois</th><th class="num">Indice à 1 mois</th><th class="num">Moins bien que l'indice</th><th class="num">Ligne à 3 mois</th><th class="num">Indice à 3 mois</th><th class="num">Moins bien</th></tr></thead>
      <tbody>${retroRows(r)}</tbody></table></div>
      ${(r.recent || []).length ? `<p class="note" style="margin-top:8px">Derniers signaux : ${r.recent.slice(0, 4).map(e => `${L.esc(e.name)} le ${F.dshort(e.t)} (${sgn(e.r30)} en un mois${e.b30 != null ? `, indice ${sgn(e.b30)}` : ''})`).join(' ; ')}.</p>` : ''}</section>
    <section class="w c6"><div class="w-h"><h2>Vos seuils face à votre portefeuille</h2></div>
      <p class="ink2" style="margin-top:0">Une règle franchie par une ligne sur quatre ne trie plus rien. Choisissez un seuil pour l'enregistrer dans vos règles.</p>
      ${calHtml(b.calibrage || {})}</section>
    <section class="w c6"><div class="w-h"><h2>File du matin et journal</h2></div>${sgHtml}${jHtml}</section>
  </div>`;
  L.on(el, 'click', '[data-blrule]', async (e, btn) => {
    if (L.statique) { L.toast('Vos règles se règlent sur le PC.', true); return; }
    try {
      await L.api('/api/rules', { method: 'PUT', body: { [btn.dataset.blrule]: +btn.dataset.blv } });
      ['/api/decisions', '/api/synthese', '/api/matin', '/api/bilan'].forEach(u => L.forget(u));
      L.toast(`Seuil enregistré : ${F.n(+btn.dataset.blv, 0)} %`); bilan(el, true);
    } catch (err) { L.toast(err.message, true); }
  });
}
async function journal(el, force = false) {
  let j;
  try { j = await L.get('/api/decisions/journal', 30000, force); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const items = j.items || [];
  el.innerHTML = items.length ? `<div class="cards">${items.map(e => {
    const f = e.follow || {};
    return `<section class="w c6 jr"><div class="w-h"><span class="tag ${e.action === 'alleger' || e.action === 'vendre' ? 'dn' : e.action === 'renforcer' ? 'up' : ''}">${L.esc((j.actions || {})[e.action] || e.action)}${e.amount ? ` · ${e.unit === 'pct' ? F.n(e.amount, 0) + ' %' : L.m(F.eur(e.amount, 0))}` : ''}</span><span class="note">${F.date(e.ts)}</span>
      <div class="r">${f.review_overdue ? '<span class="tag warn">à réexaminer</span>' : f.review_due ? `<span class="note">revue le ${F.date(f.review_due)}</span>` : ''}<button class="ibtn" data-jd="${L.esc(e.id)}" aria-label="Supprimer cette entrée">${L.icon('trash')}</button></div></div>
      <div class="t1"><b>${L.esc(e.title || '')}</b></div>${e.note ? `<p class="ink2" style="margin:6px 0">${L.esc(e.note)}</p>` : ''}
      ${e.executed ? `<p class="note" style="margin:4px 0"><span class="tag up">exécutée</span> ${e.executed.type === 'sell' ? 'vente' : 'achat'} de ${L.m(F.qty(e.executed.shares))} part${e.executed.shares > 1 ? 's' : ''} le ${F.date(e.executed.ts)} · ${L.m(F.eur(e.executed.value_eur, 0))}</p>`
        : ['alleger', 'vendre', 'renforcer'].includes(e.action) ? '<p class="note" style="margin:4px 0">Aucune opération correspondante dans vos exports pour l\'instant.</p>' : ''}
      <div class="jr-f">${(f.lines || []).map(x => `<div><span>${L.esc(x.name)}</span><b class="${L.cls(x.change_pct)}">${x.change_pct != null ? F.pct(x.change_pct, 1) : '—'}</b></div>`).join('')}
        <div><span>${L.esc(j.benchmark || 'Indice')}</span><b class="${L.cls(f.market_pct)}">${f.market_pct != null ? F.pct(f.market_pct, 1) : '—'}</b></div>
        ${f.effect_eur != null ? `<div><span>Effet de la décision</span><b class="${L.cls(f.effect_eur)}">${L.m(F.eurS(f.effect_eur))}</b></div>` : ''}</div>
      ${f.effect_eur != null ? `<p class="note">Effet : ce que la quantité ${e.action === 'renforcer' ? 'achetée a gagné' : 'vendue aurait gagné ou perdu'} depuis, au cours du jour de la décision.</p>` : ''}</section>`;
  }).join('')}</div>` : `<div class="empty jr-empty"><b>Votre journal est vide</b><span>Depuis un dossier, « Consigner » garde ce que vous avez décidé et pourquoi, puis suit le cours et l'indice depuis, et repère l'opération qui l'exécute.</span><a class="btn sm" href="#/decisions/dossiers">Ouvrir les dossiers</a></div>`;
  L.on(el, 'click', '[data-jd]', async (e, b) => {
    if (!(await L.confirmBox('Supprimer cette entrée du journal ?', 'Supprimer'))) return;
    try { await L.api('/api/decisions/journal/' + encodeURIComponent(b.dataset.jd), { method: 'DELETE' }); L.forget('/api/decisions'); journal(el, true); } catch (err) { L.toast(err.message, true); }
  });
}

L.views.decisions = {
  render(root, r) { const sub = SUBS.some(s => s[0] === r.sub) ? r.sub : 'dossiers'; shell(root, sub); renderSub(sub); },
  sub(r, prev) { const order = SUBS.map(s => s[0]); const sub = order.includes(r.sub) ? r.sub : 'dossiers'; renderSub(sub, order.indexOf(sub) - order.indexOf(prev.sub || 'dossiers')); },
  refresh() { const el = document.getElementById('dSub'); const a = document.querySelector('.subnav a.on'); if (el && a && a.dataset.sub === 'dossiers') dossiers(el, true, true); },
};
})();
