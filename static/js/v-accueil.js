/* LUMIO — Tableau de bord : l'état en 5 secondes (combien, combien aujourd'hui, est-ce que
   je bats l'indice, qu'est-ce que je dois traiter), puis la carte, l'agenda, le risque, la veille. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const PERIODS = [['1d', '1J'], ['1w', '1S'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1A'], ['max', 'Max']];
const PLABEL = { '1d': "aujourd'hui", '1w': 'sur 1 semaine', '1m': 'sur 1 mois', ytd: 'depuis le 1er janvier', '1y': 'sur 1 an', max: 'depuis le début' };
const PSHORT = { '1d': '1J', '1w': '1S', '1m': '1M', ytd: 'YTD', '1y': '1A', max: 'Max' };
const S = { charts: {}, root: null, data: {} };
const per = () => L.period();                    // période commune à toutes les vues
const bench = () => L.bench();
const mode = () => L.store.get('dash.b1', 'eur');
const allocDim = () => L.store.get('dash.alloc', 'sector');
const allocLt = () => L.store.get('dash.alloclt', true);
const handled = () => { const h = L.store.get('handled', {}); const now = Date.now(); Object.keys(h).forEach(k => { if (now - h[k] > 864e5) delete h[k]; }); return h; };

/* Chaque carte garde son squelette jusqu'à SA donnée (jamais de carte vide). Une carte cliquable
   porte un vrai lien étiré (toute la carte réagit, le lecteur d'écran entend un lien), ses
   boutons et liens internes restent au-dessus et gardent leur propre rôle. */
const LINKS = { a1: ['Voir les positions', '#/portefeuille/positions'], a2: ['Voir les positions', '#/portefeuille/positions'],
  a3: ['Voir la performance', '#/portefeuille/performance'], a5: ['Voir les revenus', '#/portefeuille/revenus'],
  c3: ['Voir les marchés', '#/veille/marches'], d3: ['Voir l\'analyse du portefeuille', '#/portefeuille/analyse'] };
/* Modules du tableau de bord, rangés en sections ; l'utilisateur les affiche, masque et ordonne
   (bouton « Personnaliser »), disposition gardée sur cet appareil */
const MODS = {
  a1: { t: 'Valeur du portefeuille', d: 'Valeur, variation sur la période et lignes qui l\'expliquent', sz: 'lead', click: 1 },
  a2: { t: 'Plus-value latente', d: 'Gain non réalisé et plus-values réalisées de l\'année', sz: 'kpi', click: 1 },
  a3: { t: 'Performance', d: 'Rendement de la période hors versements (TWR) et XIRR', sz: 'kpi', click: 1 },
  a4: { t: 'Écart à l\'indice', d: 'Avance ou retard sur l\'indice ou l\'ETF choisi', sz: 'kpi' },
  c1: { t: 'Carte du portefeuille', d: 'Poids, variation de la période, pourquoi ça bouge, actualités à trancher', sz: 'full' },
  b2: { t: 'Bureau de décision', d: 'Alertes à traiter et articles à lire, notés selon leur impact', sz: 'half' },
  d1: { t: 'Agenda', d: 'Résultats, détachements et versements des 14 prochains jours', sz: 'third' },
  i1: { t: 'Initiés', d: 'Pistes, achats de dirigeants, d\'élus américains et de grands fonds (vos valeurs d\'abord)', sz: 'third' },
  c3: { t: 'Marchés', d: 'Indices, taux, devises et matières premières du jour', sz: 'third', click: 1 },
  e2: { t: 'Veille', d: 'Tensions offre / demande, innovations de rupture, décisions politiques', sz: 'full' },
  b1: { t: 'Évolution', d: 'Courbe de la période, en euros ou comparée à l\'indice, risque', sz: 'twothird' },
  c2: { t: 'Contributions', d: 'Lignes qui ont fait gagner ou perdre sur la période', sz: 'third' },
  d3: { t: 'Bilan de santé', d: 'Note sur 100 : concentration, diversification, frais, données', sz: 'half', click: 1 },
  d2: { t: 'Répartition', d: 'Secteurs, régions, devises, ETF compris (transparence)', sz: 'half' },
  a5: { t: 'Dividendes', d: 'Reçus sur 12 mois et versements prévus', sz: 'half', click: 1 },
  a6: { t: 'Comptes', d: 'Valeur et poids de chaque compte (Trade Republic, eToro, comptes saisis)', sz: 'half' },
  e1: { t: 'Watchlist', d: 'Valeurs que vous suivez sans les détenir, avec votre prix visé', sz: 'full' },
  s1: { t: 'Sortir ou entrer', d: 'Vos lignes à réexaminer et les entrées possibles à étudier, signaux datés et sourcés', sz: 'full' },
  m4: { t: 'Liquidités', d: 'Espèces non placées sur Trade Republic, réserve et montant à placer', sz: 'kpi', click: 1 },
  m1: { t: 'À traiter ce matin', d: 'Sorties, allègements, renforcements à étudier et placement des liquidités, avec le détail de chaque décision', sz: 'twothird' },
  m2: { t: 'À savoir ce matin', d: 'Actualités importantes sur vos lignes, résultats publiés, rendez-vous de la semaine, marchés', sz: 'third' },
  m3: { t: 'État de vos lignes', d: 'Un état par ligne (sortie, allègement, surveillance, renforcement), tendance, RSI, seuil de perte', sz: 'full' },
};
const SECN = { pf: 'Votre portefeuille', matin: 'Ce matin', news: 'Actualité et veille', perf: 'Performance', state: 'État du portefeuille' };
/* 7.2 : la journée commence par « Ce matin » (décisions à traiter, infos clés, état des lignes) ;
   « Sortir ou entrer », le bureau de décision et l'écart à l'indice restent disponibles (Personnaliser).
   7.5 : rangées sans trou (agenda, marchés, initiés côte à côte ; état du portefeuille par paires) */
const DEF_LAYOUT = { v: 75, secs: ['pf', 'matin', 'perf', 'news', 'state'], order: { pf: ['a1', 'm4', 'a2', 'a3', 'a4'], matin: ['m1', 'm2', 'm3'],
  perf: ['c1', 'b1', 'c2'], news: ['d1', 'c3', 'i1', 'e2', 'e1', 's1', 'b2'], state: ['d3', 'd2', 'a6', 'a5'] }, hidden: ['e1', 's1', 'b2', 'a4'], size: {} };
const layout = () => {
  const l = L.store.get('dash.layout', null);
  if (!l || !Array.isArray(l.secs) || !l.order) return JSON.parse(JSON.stringify(DEF_LAYOUT));
  if (!(l.v >= 75)) {
    // 7.2 puis 7.5 : nouvelle disposition du tableau de bord (« Personnaliser » permet de la retoucher)
    const fresh = JSON.parse(JSON.stringify(DEF_LAYOUT)); L.store.set('dash.layout', fresh); L.store.set('dash.closed', {});
    return fresh;
  }
  l.size = l.size && typeof l.size === 'object' ? l.size : {};
  // modules apparus depuis (nouvelle version) : ajoutés à leur section d'origine
  const all = Object.values(l.order).flat();
  Object.entries(DEF_LAYOUT.order).forEach(([sec, ids]) => ids.forEach(id => { if (!all.includes(id)) (l.order[sec] = l.order[sec] || []).push(id); }));
  Object.keys(l.order).forEach(sec => { l.order[sec] = l.order[sec].filter(id => MODS[id]); });
  l.secs = l.secs.filter(x => SECN[x]).concat(DEF_LAYOUT.secs.filter(x => !l.secs.includes(x)));
  l.hidden = (l.hidden || []).filter(id => MODS[id]);
  return l;
};
const shown = id => !layout().hidden.includes(id);
const szOf = (id, l = layout()) => l.size[id] || MODS[id]?.sz || 'half';
const card = (id, extra = '', l = layout()) => `<section class="w sk-on ${MODS[id]?.click ? 'click ' : ''}${extra}" id="${id}" data-sz="${szOf(id, l)}" data-mod="${id}" aria-busy="true">${L.skel(18, '40%')}<div style="height:10px"></div>${L.skel(id === 'b1' ? 300 : id.startsWith('a') || id === 'm4' ? 48 : 180)}</section>`;
/* Sections repliables : un clic sur le titre replie la section et n'en garde que l'essentiel */
const closedSecs = () => {
  if (L.store.get('dash.foldv', 0) < 76) {          // 7.6 : sur téléphone, « Actualité et veille » et « État du portefeuille » repliés d'abord
    const cl = L.store.get('dash.closed', {}) || {};
    if (window.matchMedia && matchMedia('(max-width:719px)').matches) { cl.news = true; cl.state = true; }
    L.store.set('dash.closed', cl); L.store.set('dash.foldv', 76);
  }
  return L.store.get('dash.closed', {}) || {};
};
const leadOf = ids => Math.max(4, 12 - 2 * ids.filter(id => MODS[id].sz === 'kpi').length);
const sections = () => {
  const l = layout(); const cl = closedSecs();
  return l.secs.map(sec => {
    const ids = (l.order[sec] || []).filter(id => !l.hidden.includes(id));
    const closed = !!cl[sec];
    return `<section class="dsec${ids.length ? '' : ' empty'}${closed ? ' closed' : ''}" data-sec="${sec}" aria-labelledby="dsec-${sec}">
      <h2 class="dsec-h" id="dsec-${sec}"><button type="button" class="dsec-b" data-dsec="${sec}" aria-expanded="${!closed}" aria-controls="dgrid-${sec}"><span>${SECN[sec]}</span>${L.icon('chev')}</button></h2>
      <div class="dsec-sum" id="dsum-${sec}" ${closed ? '' : 'hidden'}></div>
      <div class="dash" id="dgrid-${sec}" data-sec="${sec}" style="--lead:${leadOf(ids)}">${ids.map(id => card(id, '', l)).join('')}</div></section>`;
  }).join('');
};
const DEP = ['a5', 'b2', 'c1', 'd1', 'd2', 'd3', 'e1', 'e2'];          // cartes servies par /api/dashboard
const done = el => {
  if (!el) return;
  el.removeAttribute('aria-busy'); el.classList.remove('sk-on');
  const lk = LINKS[el.id];
  if (lk && !el.querySelector(':scope > a.card-a')) el.insertAdjacentHTML('beforeend', `<a class="card-a" href="${lk[1]}" aria-label="${L.esc(lk[0])}"></a>`);
};
const inner = 'button,select,input,.info,a:not(.card-a)';

function shell(root) {
  const ms = L.marketStatus();
  const now = new Date();
  root.innerHTML = `<h1 class="sr">Tableau de bord</h1>
  <div class="dash-wrap" id="dash">
    <div id="period" class="ph" style="margin:0">
      <div class="ph-t"><b>${F.dlong(now).replace(/^./, c => c.toUpperCase())}</b>${ms.map(m => `<span class="mk ${m.open ? 'open' : ''}"><i></i>${m.txt}</span>`).join('')}</div>
      <div class="ph-r">${L.perSeg()}<a class="ibtn" href="#/rapport" id="dashRep" title="Rapport à imprimer ou en PDF" aria-label="Rapport du portefeuille, à imprimer ou en PDF">${L.icon('download')}</a><button type="button" class="ibtn" id="dashCfg" title="Personnaliser le tableau de bord" aria-label="Personnaliser le tableau de bord">${L.icon('sliders')}</button></div>
    </div>
    ${sections()}
  </div>`;
  const go = (view, sub, before) => (e) => { if (e.target.closest(inner)) return; e.preventDefault(); if (before) before(); L.router.go(view, sub); };
  L.on(root, 'click', '#a1,#a2', go('portefeuille', 'positions'));
  L.on(root, 'click', '#a3', go('portefeuille', 'performance', () => L.store.set('pf.pover', null)));   // même période que le tableau de bord
  L.on(root, 'click', '#a5', go('portefeuille', 'revenus'));
  L.on(root, 'click', '#c3', go('veille', 'marches'));
  L.on(root, 'click', '#d3', go('portefeuille', 'analyse'));
  L.on(root, 'click', '[data-b1]', (e, b) => { L.store.set('dash.b1', b.dataset.b1); renderB1(true); });
  L.on(root, 'click', '[data-c1v]', (e, b) => { L.store.set('dash.c1view', b.dataset.c1v); renderC1(); });
  L.on(root, 'click', '[data-skyv]', (e, b) => { L.store.set('sky.vol', b.dataset.skyv); const c = document.getElementById('c1'); if (c) renderSky(c); });
  L.on(root, 'click', '[data-alloc]', (e, b) => { L.store.set('dash.alloc', b.dataset.alloc); renderD2(); });
  L.on(root, 'click', '#ltToggle', () => { L.store.set('dash.alloclt', !allocLt()); renderD2(); });
  L.on(root, 'click', '[data-b2]', (e, b) => { S.b2tab = b.dataset.b2; renderB2(); });
  L.on(root, 'click', '[data-dec]', (e, row) => openDecision(+row.dataset.dec));
  L.on(root, 'click', '#explainBtn', () => L.explainIA(per()));
  L.on(root, 'click', '#b1table', () => { S.b1table = !S.b1table; renderB1(); });
  L.on(root, 'click', '[data-retry]', (e, b) => { if (b.dataset.retry === 'per') loadPeriod(true, true); else load(true); });
  L.on(root, 'click', '#dashCfg', () => (L.dashEdit ? L.dashEdit.toggle() : openCustomize()));
  L.on(root, 'click', '[data-dsec]', (e, b) => toggleSec(b.dataset.dsec));
  L.on(root, 'click', '.dsec-sum', (e, el) => { if (!e.target.closest('a,button')) toggleSec(el.id.replace('dsum-', '')); });
  L.on(root, 'click', '[data-sig]', (e, row) => { if (e.target.closest('a,button')) return; openSignal(row.dataset.sig, row.dataset.side); });
  L.on(root, 'click', '#c1sig', () => { const on = !L.store.get('dash.c1sig', false); L.store.set('dash.c1sig', on); if (on && !S.data.sig) loadSignals(); renderC1(); });
  L.on(root, 'dblclick', '.hero-v', () => L.togglePriv());
}

document.addEventListener('lumio:period', () => { if (document.getElementById('dash')) { renderA1(); loadPeriod(true, true); } });
document.addEventListener('lumio:bench', () => { if (document.getElementById('dash')) loadPeriod(true, true); });

/* ── Personnaliser : afficher, masquer, ordonner les modules et les sections ── */
function openCustomize() {
  const save = l => { L.store.set('dash.layout', l); paint(); if (S.root && document.getElementById('dash')) { shell(S.root); load(false); } };
  const body = () => {
    const l = layout();
    return l.secs.map((sec, si) => `<div class="cz-sec"><div class="cz-sh"><b>${SECN[sec]}</b>
        <button type="button" class="ibtn sm" data-czs="${si}" data-dir="-1" aria-label="Monter la section ${SECN[sec]}" ${si === 0 ? 'disabled' : ''}>${L.icon('up')}</button>
        <button type="button" class="ibtn sm" data-czs="${si}" data-dir="1" aria-label="Descendre la section ${SECN[sec]}" ${si === l.secs.length - 1 ? 'disabled' : ''}>${L.icon('down')}</button></div>
      ${(l.order[sec] || []).map((id, mi) => `<div class="cz-m${l.hidden.includes(id) ? ' off' : ''}">
        <label class="cz-l"><input type="checkbox" data-czv="${id}" ${l.hidden.includes(id) ? '' : 'checked'}><span><b>${L.esc(MODS[id].t)}</b><small>${L.esc(MODS[id].d)}</small></span></label>
        <select class="sel sm" data-czmv="${id}" aria-label="Section de ${L.esc(MODS[id].t)}">${l.secs.map(x => `<option value="${x}"${x === sec ? ' selected' : ''}>${SECN[x]}</option>`).join('')}</select>
        <button type="button" class="ibtn sm" data-czm="${id}" data-dir="-1" aria-label="Monter ${L.esc(MODS[id].t)}" ${mi === 0 ? 'disabled' : ''}>${L.icon('up')}</button>
        <button type="button" class="ibtn sm" data-czm="${id}" data-dir="1" aria-label="Descendre ${L.esc(MODS[id].t)}" ${mi === l.order[sec].length - 1 ? 'disabled' : ''}>${L.icon('down')}</button></div>`).join('')}</div>`).join('');
  };
  const d = L.drawer.open('detail', { title: 'Personnaliser le tableau de bord', sub: 'Choisissez les modules affichés, leur section et leur ordre ; gardé sur cet appareil.',
    html: `<div id="czBody" class="cz">${body()}</div><div class="sec" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="czReset">${L.icon('refresh')}Rétablir la disposition d'origine</button><button type="button" class="btn g" data-tour-start>${L.icon('help')}Visite guidée</button></div>` });
  const paint = () => { const b = d.querySelector('#czBody'); if (b) b.innerHTML = body(); };
  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  d.onclick = e => {
    const sb = e.target.closest('[data-czs]'), mb = e.target.closest('[data-czm]');
    if (e.target.closest('#czReset')) { L.store.set('dash.layout', null); paint(); if (S.root) { shell(S.root); load(false); } return; }
    if (!sb && !mb) return;
    const l = layout();
    if (sb) move(l.secs, +sb.dataset.czs, +sb.dataset.dir);
    else { const id = mb.dataset.czm; const sec = Object.keys(l.order).find(k => l.order[k].includes(id)); move(l.order[sec], l.order[sec].indexOf(id), +mb.dataset.dir); }
    save(l);
  };
  d.onchange = e => {
    const l = layout();
    const v = e.target.closest('[data-czv]'), mv = e.target.closest('[data-czmv]');
    if (v) { const id = v.dataset.czv; l.hidden = v.checked ? l.hidden.filter(x => x !== id) : l.hidden.concat(id); }
    else if (mv) { const id = mv.dataset.czmv; Object.keys(l.order).forEach(k => { l.order[k] = l.order[k].filter(x => x !== id); }); (l.order[mv.value] = l.order[mv.value] || []).push(id); }
    else return;
    save(l);
  };
}

/* ── Chargement : chaque widget s'affiche dès que sa donnée arrive ── */
function fromPortfolio() {
  /* Valeur et plus-value tout de suite, depuis /api/portfolio (déjà chargé au démarrage) */
  const p = L.data.portfolio; if (!p || p.empty || S.data.dash) return;
  S.data.dash = { kpis: { total_value: p.total_value, day_change_eur: p.day_change_eur, day_change_pct: p.day_change_pct,
    total_pnl: p.total_pnl, total_pnl_pct: p.total_pnl_pct, realized_ytd: null }, treemap: p.positions, _partial: true };
  renderA1(); renderA2(); renderA6();
  S.data.dash = null;
}
function fromSnap() {
  /* Dernier tableau de bord connu sur cet appareil : affiché aussitôt (estompé), remplacé dès la réponse fraîche */
  const d = L.snap.get('/api/dashboard'), p = per();
  if (S.data.dash || !d || d.empty) return;
  const h = L.snap.get(`/api/portfolio/history?range=${p}`);
  const pf = p === '1d' ? null : L.snap.get(`/api/performance?period=${p}&bench=${bench()}`);
  const h1 = L.snap.get('/api/portfolio/history?range=1d'), ix = L.snap.get('/api/indices');
  S.data.dash = d; S.data.snap = true;
  if (h1) S.data.h1d = h1;
  if (ix) S.data.idx = ix.indices || [];
  if (h && pf) { S.data.hist = h; S.data.perf = pf; S.data.explain = null; }
  document.getElementById('dash')?.classList.add('from-snap');
  L.quietly(() => {
    renderA1(); renderA2(); renderA5(); renderA6(); renderB2(); renderC1(); renderD1(); renderD2(); renderD3(); renderE1(); renderE2();
    if (S.data.hist) { renderA3(); renderA4(); renderB1(false); renderC2(); }
    if (ix) renderC3();
  });
}
async function load(force = false) {
  fromPortfolio();
  if (!force) { try { fromSnap(); } catch (e) { S.data.dash = null; S.data.hist = null; S.data.snap = false; } }
  const dash = L.get('/api/dashboard', 50000, force).then(d => {
    S.data.dash = d; S.data.snap = false;
    document.getElementById('dash')?.classList.remove('from-snap');
    if (d.empty) { emptyState(); return d; }
    L.setBadge(d.decisions_urgent ?? (d.decisions || []).filter(x => x.kind === 'alerte').length);
    renderA1(); renderA2(); renderA5(); renderA6(); renderB2(); renderC1(); renderD1(); renderD2(); renderD3(); renderE1(); renderE2();
    if (S.data.hist) renderB1(false);   // Sharpe et bêta sur 1 an (repli des périodes courtes) arrivent avec ces chiffres
    if ((d.pending || []).length && (S.retry = (S.retry || 0) + 1) <= 8) {
      clearTimeout(S.retryT);   // parties lentes (actualités, agenda) : rechargées en silence, sans rejouer d'animation
      S.retryT = setTimeout(() => { if (document.getElementById('dash')) { L.forget('/api/dashboard'); L.quietly(() => load(true)); } }, 2500);
    } else if (!(d.pending || []).length) S.retry = 0;
    return d;
  }).catch(e => {
    // La valeur déjà connue reste affichée ; chaque carte qui dépend de ce point d'accès dit pourquoi elle est vide
    DEP.concat(L.data.portfolio ? [] : ['a1', 'a2']).forEach(id => { const el = document.getElementById(id); if (el && (el.querySelector('.sk') || el.querySelector('.err-box'))) { el.innerHTML = L.errBox(e, 'dash'); done(el); } });
  });
  L.get('/api/portfolio/history?range=1d', 50000, force).then(h => { S.data.h1d = h; renderA1(); }).catch(() => {});
  L.get('/api/indices', 50000, force).then(x => { S.data.idx = x.indices || []; renderC3(); renderA4(); }).catch(e => { const c = document.getElementById('c3'); if (c && c.querySelector('.sk')) { c.innerHTML = L.errBox(e, 'dash'); done(c); } });
  L.get('/api/veille/politique', 600000).then(x => { S.data.pol = x; renderE2(); }).catch(() => {});
  L.get('/api/price-alerts', 60000, force).then(x => { S.data.palerts = x.items || []; renderE1(); }).catch(() => {});
  if (shown('i1')) loadI1(force);
  if (shown('s1') || L.store.get('dash.c1sig', false)) loadSignals(force);
  if (L.matin) L.matin.load(force).then(renderSums);
  await Promise.allSettled([dash, loadPeriod(force)]);   // la fenêtre silencieuse couvre tout le rafraîchissement
  renderSums();
}
async function loadPeriod(force = false, animate = false) {
  const p = per();
  S.data.period = p;
  renderC1();                                        // la carte suit la période tout de suite
  L.loadMap(p, force).catch(() => {});               // pourquoi ça bouge, valorisation, impact : au survol
  // Changement de période : les cartes concernées s'estompent jusqu'aux nouveaux chiffres
  ['a1', 'a3', 'a4', 'b1', 'c2'].forEach(id => { const el = document.getElementById(id); if (el && S.data.hist && !el.classList.contains('sk-on')) { el.classList.add('stale'); el.setAttribute('aria-busy', 'true'); } });
  const hist = L.get(`/api/portfolio/history?range=${p}`, 50000, force);
  const perf = p === '1d' ? L.get('/api/ai/explain?range=1d', 50000, force) : L.get(`/api/performance?period=${p}&bench=${bench()}`, 120000, force);
  try {
    const [h, pf] = await Promise.all([hist, perf]);
    if (p !== per()) return;
    const first = !S.data.hist;
    S.data.hist = h; S.data.perf = p === '1d' ? null : pf; S.data.explain = p === '1d' ? pf : null;
    ['a1', 'a3', 'a4', 'b1', 'c2'].forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('stale'); if (id !== 'a1') done(el); } });
    renderA1(); renderA3(); renderA4(); renderB1(first || animate); renderC2();
  } catch (e) {
    ['b1', 'a1', 'a3', 'a4', 'c2'].forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('stale'); if (id === 'a1') return; if (id === 'b1' || el.querySelector('.sk')) { el.innerHTML = L.errBox(e, 'per'); done(el); } else done(el); } });
  }
}

function emptyState() {
  const d = document.getElementById('dash');
  d.innerHTML = `<section class="w" style="--s:12;grid-column:1/-1"><div class="w-h"><h2>Bienvenue dans LUMIO</h2></div>
  <p class="ink2" style="max-width:640px">Aucun portefeuille pour l'instant. Deux façons de commencer :</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
    <button class="btn p" data-syncopen>${L.icon('refresh')}Mettre à jour depuis Trade Republic</button>
    <button class="btn" data-restore>${L.icon('upload')}Importer la sauvegarde de mon PC</button></div>
  <p class="note" style="margin-top:12px;max-width:640px">La mise à jour vous demande votre numéro et votre code PIN Trade Republic, puis une validation dans l'app Trade Republic ; le PIN n'est enregistré nulle part. La sauvegarde s'exporte depuis le LUMIO de votre PC (Réglages, rubrique Sauvegarde) et reprend aussi vos décisions, règles, alertes et opérations saisies.</p></section>`;
}

/* ── A1 · Valeur : variation et contexte de la période choisie ── */
const periodDelta = () => {
  const p = per(); const d = S.data.dash; const k = d?.kpis || {};
  if (p === '1d') return { eur: k.day_change_eur, pct: k.day_change_pct, ready: k.day_change_eur != null };
  const h = S.data.hist; const pf = S.data.perf?.performance;
  if (!h || h.range !== p) return { ready: false };
  const br = L.bridge(h, p, k.total_value);          // 7.9 : le même pont que la phrase sous le chiffre
  if (br && br.pct != null) return { eur: br.gain, pct: br.pct, ready: true, br };
  return pf && pf.available ? { eur: pf.gain_eur, pct: pf.twr * 100, ready: true } : { eur: h.change_eur, pct: h.change_pct, ready: true };
};
L.dashMini = () => {
  const k = S.data.dash?.kpis; if (!k) return '';
  const p = per(), dl = periodDelta();
  return `${L.m(F.eur(k.total_value, 0))} ${dl.ready ? `<span class="${L.cls(dl.eur)}">${L.arrow(dl.eur)} ${F.pct(dl.pct, p === '1d' ? 2 : 1)}</span>` : ''}<span class="muted">${PLABEL[p]}</span>`;
};
/* Cours anciens : toutes les lignes, ou seulement quelques-unes (nommées) ; l'action dépend de l'endroit */
/* Mode d'emploi de la carte (visible sur ordinateur, à déplier sur téléphone) */
const tmHow = (m, rk) => `Surface = poids dans le portefeuille, regroupé par secteur ; couleur = ${m === 'pv' ? "plus-value depuis l'achat" : `variation ${RKL[rk]}`} (période choisie en haut). ${L.coarse
  ? "Touchez une valeur pour voir pourquoi elle bouge et ce qu'elle vaut, un point pour lire l'actualité."
  : "Survolez une valeur pour voir pourquoi elle bouge et ce qu'elle vaut ; cliquez pour ouvrir sa fiche, sur un point pour lire l'actualité."}`;
function staleMsg() {
  const at = L.state.quotesStale, part = L.state.staleLines;
  const sb = document.getElementById('syncBtn'), can = sb && !sb.hidden;
  const act = L.statique ? (can ? '<button class="lnk" data-sync-now>Demander une mise à jour au PC</button>' : 'Mettez à jour sur le PC.')
    : can ? '<button class="lnk" data-sync-now>Mettre à jour</button>' : 'Relancez la mise à jour.';
  if (part) {
    const who = part.length === 1 ? `${L.esc(part[0].name)} (${F.pctU(part[0].w, 1)} du portefeuille)`
      : `${part.length} lignes (${F.pctU(part.reduce((s, x) => s + x.w, 0), 1)} du portefeuille : ${part.slice(0, 3).map(x => L.esc(x.name)).join(', ')}${part.length > 3 ? '…' : ''})`;
    return `Cours du ${F.dshort(at)} pour ${who} ; les autres lignes sont à jour. ${act}`;
  }
  const tr = L.data.portfolio?.quotes_src === 'tr' ? ', dernière mise à jour Trade Republic' : '';
  if (L.statique) return `Cours du ${F.dshort(at)}${tr}. ${act}`;
  const why = L.state.online || L.data.health?.online ? 'le serveur ne reçoit plus les cours en direct' : 'les cours en direct ne répondent pas';
  return `Cours du ${F.dshort(at)}${tr} : ${why}. ${act}`;
}
function renderA1() {
  const el = document.getElementById('a1'); const d = S.data.dash; if (!el || !d || d.empty) return;
  const k = d.kpis; const p = per(); const dl = periodDelta();
  let best, worst;
  if (p === '1d') {
    const tm = (d.treemap || []).filter(x => x.day_pnl != null).sort((a, b) => b.day_pnl - a.day_pnl);
    best = tm[0] && { name: tm[0].name, v: tm[0].day_pnl }; worst = tm.length && { name: tm[tm.length - 1].name, v: tm[tm.length - 1].day_pnl };
  } else if (dl.ready) {
    const at = (S.data.perf?.attribution || []).filter(a => a.gain_eur != null).sort((a, b) => b.gain_eur - a.gain_eur);
    best = at[0] && { name: at[0].name, v: at[0].gain_eur }; worst = at.length && { name: at[at.length - 1].name, v: at[at.length - 1].gain_eur };
  }
  let ctx = '';
  if (best && best.v > 0) ctx += `Porté par ${L.esc(best.name)} (${L.m(F.eurS(best.v))})`;
  if (worst && worst.v < 0) ctx += `${ctx ? ', freiné par ' : 'Freiné par '}${L.esc(worst.name)} (${L.m(F.eurS(worst.v))})`;
  const pts = ((p === '1d' ? S.data.h1d : S.data.hist?.range === p ? S.data.hist : null)?.points || []).map(x => x.value);
  // Grand chiffre : toujours la valeur actuelle ; en dessous, le pont de la période (départ + achats nets + gain)
  L.swap(el, `<div class="hero-l" style="display:flex;align-items:center;gap:8px">Valeur du portefeuille<span style="margin-left:auto">${C.spark(pts, { w: 84, h: 26 })}</span></div>
    <div class="hero-v m" data-k="a1v" data-hero>${L.heroVal(k.total_value)}</div>
    <div class="hero-d" data-k="a1d">${dl.ready ? L.delta(dl.eur, `${L.m(F.eurS(dl.eur, 2))} · ${F.pct(dl.pct, p === '1d' ? 2 : 1)}`) : '<span class="muted">calcul…</span>'}<span class="muted">${PLABEL[p]}</span></div>
    ${dl.br ? `<div class="hero-ctx hero-was" title="${L.esc(L.BRIDGE_TIP)}">${L.bridgeText(dl.br, p)}</div>` : ''}
    ${ctx ? `<div class="hero-ctx">${ctx}.</div>` : ''}
    ${L.state.quotesStale ? `<div class="hero-stale">${L.icon('alert')}<span>${staleMsg()}</span></div>` : ''}`);
  done(el);
  L.watchHero(el.querySelector('[data-hero]'), L.dashMini);
}
/* ── A2 · Plus-value latente ── */
function renderA2() {
  const el = document.getElementById('a2'); const d = S.data.dash; if (!el || !d) return;
  const k = d.kpis;
  L.swap(el, `<div class="kpi"><span class="k-l">Plus-value latente</span><span class="k-v m" data-k="a2v">${F.eurS(k.total_pnl)}</span>
    <span class="k-d" data-k="a2d">${L.delta(k.total_pnl_pct, F.pct(k.total_pnl_pct))}</span>
    <span class="k-s">${k.realized_ytd == null ? '&nbsp;' : `réalisé ${new Date().getFullYear()} : ${L.m(F.eurS(k.realized_ytd))}`}</span></div>`);
  done(el);
}
/* ── A3 · Performance de la période ── */
function renderA3() {
  const el = document.getElementById('a3'); if (!el) return;
  const p = per(); const h = S.data.hist; const pf = S.data.perf?.performance;
  let v = h?.change_pct, g = h?.change_eur, x = null;
  if (pf && pf.available) { v = pf.twr * 100; g = pf.gain_eur; x = pf.mwr; }
  const mp = pf && pf.available ? pf.mwr_period : null;
  const xirr = x != null && (p === 'max' || p === '1y') ? `XIRR ${F.fr(x, 1)}/an` : mp != null ? `votre argent : ${F.fr(mp, 1)}` : 'variation hors versements';
  L.swap(el, `<div class="kpi"><span class="k-l">Performance · ${PSHORT[p]} ${L.tipTxt('TWR : performance hors effet des versements, comparable à un indice. XIRR : rendement annualisé de votre argent, versements compris.')}</span>
    <span class="k-v ${L.cls(v)}" data-k="a3v"${pf && (pf.estimated || []).length ? ' title="Chiffre approché : une ligne est valorisée sans historique de cours"' : ''}>${L.arrow(v)} ${pf && (pf.estimated || []).length ? '≈ ' : ''}${F.pct(v, p === '1d' ? 2 : 1)}</span>
    <span class="k-d" data-k="a3g">${L.m(`<span class="${L.cls(g)}">${F.eurS(g)}</span>`)} <span class="muted" style="font-weight:500">de gain</span></span>
    <span class="k-s">${xirr}</span></div>`);
  done(el);
}
/* ── A4 · Écart à l'indice ── */
function renderA4() {
  const el = document.getElementById('a4'); if (!el) return;
  const p = per(); const pf = S.data.perf?.performance; const bl = S.data.perf?.benchmarks || [{ key: 'msci_world', label: 'MSCI World' }, { key: 'cac40', label: 'CAC 40' }, { key: 'sp500', label: 'S&P 500' }, { key: 'nasdaq', label: 'Nasdaq' }];
  let gap = null, bv = null, lbl = (bl.find(b => b.key === bench()) || bl[0]).label;
  if (p === '1d') {
    const ix = (S.data.idx || []).find(i => i.label === lbl || (lbl === 'MSCI World' && i.label === 'MSCI World'));
    const k = S.data.dash?.kpis;
    if (ix && k) { bv = ix.change_pct_day; gap = k.day_change_pct - bv; }
  } else if (pf && pf.available && pf.benchmark && pf.benchmark.twr != null) { bv = pf.benchmark.twr * 100; gap = (pf.twr - pf.benchmark.twr) * 100; lbl = pf.benchmark.label; }
  L.swap(el, `<div class="kpi"><span class="k-l">vs ${L.benchSelect(bl, pf?.benchmark?.label || '', 'benchSel', true)}</span>
    <span class="k-v ${L.cls(gap)}" data-k="a4v">${gap == null ? '—' : L.arrow(gap) + ' ' + F.pt(gap, 1)}</span>
    <span class="k-d muted" style="font-weight:500">indice ${bv == null ? '—' : `<span class="${L.cls(bv)}">${F.pct(bv, 1)}</span>`}</span>
    <span class="k-s">${gap == null ? 'pas assez d\'historique' : gap >= 0 ? 'vous faites mieux que l\'indice' : 'l\'indice fait mieux'}</span></div>`);
  done(el);
}
/* ── A5 · Dividendes ── */
function renderA5() {
  const el = document.getElementById('a5'); const d = S.data.dash; if (!el || !d) return;
  const past = (d.income.by_month || []).slice(-6).map(m => ({ label: F.mon(m.month), v: m.dividends }));
  const fut = (d.income.forecast || []).slice(1, 7).map(m => ({ label: F.mon(m.month), v: m.amount, fc: true }));
  L.swap(el, `<div class="kpi"><span class="k-l">Dividendes · 12 mois</span><span class="k-v m" data-k="a5v">${F.eur(d.kpis.dividends_ttm, 0)}</span>
    <span class="k-s">prévus : ${L.m(F.eur(d.kpis.forecast_12m, 0))} bruts</span></div><div style="margin-top:8px">${C.cols(past.concat(fut))}</div>`);
  done(el);
}

/* ── B1 · Évolution ── */
function renderB1(animate = false) {
  const el = document.getElementById('b1'); if (!el) return;
  const p = per(); const h = S.data.hist; const pf = S.data.perf?.performance;
  if (!h) return;
  const md = p === '1d' ? 'eur' : mode();
  const g = pf && pf.available ? pf.gain_eur : h.change_eur; const r = pf && pf.available ? pf.twr * 100 : h.change_pct;
  const at = S.data.perf?.attribution || (S.data.explain?.contributors || []).map(c => ({ name: c.name, gain_eur: c.delta_eur }));
  const pos = at.filter(a => a.gain_eur > 0).sort((a, b) => b.gain_eur - a.gain_eur)[0], neg = at.filter(a => a.gain_eur < 0).sort((a, b) => a.gain_eur - b.gain_eur)[0];
  const ctx = [pos ? `porté par ${L.esc(pos.name)} (${L.m(F.eurS(pos.gain_eur))})` : '', neg ? `freiné par ${L.esc(neg.name)} (${L.m(F.eurS(neg.gain_eur))})` : ''].filter(Boolean).join(', ');
  const stat = (lbl, v, tip) => `<div class="kpi"><span class="k-l">${lbl}${tip ? ' ' + L.tipTxt(tip) : ''}</span><span class="k-d" style="color:var(--ink)">${v}</span></div>`;
  const per1y = !pf || !pf.available;
  const src = per1y ? S.data.dash?.kpis : null;
  const vol = pf?.volatility ?? src?.volatility, mdd = pf?.max_drawdown ?? src?.max_drawdown;
  // Moins de 3 mois de séances : Sharpe sans valeur statistique, on montre celui d'un an (signalé)
  const sharpe = pf?.sharpe ?? S.data.dash?.kpis?.sharpe, beta = pf?.benchmark?.beta ?? S.data.dash?.kpis?.beta;
  const sharpeLbl = !per1y && pf?.sharpe == null && sharpe != null ? ' (1 an)' : '';
  const betaLbl = pf?.benchmark?.beta == null && beta != null ? ' (1 an)' : '';
  el.innerHTML = `<div class="w-h"><h2>Évolution · ${PSHORT[p]}</h2><div class="r">
      ${p === '1d' ? '' : `<div class="seg sm" role="group" aria-label="Unité"><button data-b1="eur" class="${md === 'eur' ? 'on' : ''}" aria-pressed="${md === 'eur'}">€</button><button data-b1="pct" class="${md === 'pct' ? 'on' : ''}" aria-pressed="${md === 'pct'}">%<span class="only-d"> vs indice</span></button></div>`}
      <button class="ibtn" id="b1table" title="Voir en tableau" aria-label="Voir en tableau" aria-pressed="${!!S.b1table}">${L.icon('list')}</button>
      <button class="btn sm ia" id="explainBtn">${L.icon('spark')}Expliquer</button></div></div>
    <div class="note" style="font-size:13px;color:var(--ink2);margin:-4px 0 8px">${L.delta(g, `${L.m(F.eurS(g))} (${F.pct(r, p === '1d' ? 2 : 1)})`)} ${PLABEL[p]}${ctx ? ' · ' + ctx : ''}${h.approx ? ' · <span class="tag warn">Courbe estimée</span>' : (h.estimated || []).length ? ` · <span class="tag warn" title="${L.esc('Sans historique de cours (prix d\'exécution interpolés) : ' + h.estimated.join(', '))}">≈ ${h.estimated.length} ligne${h.estimated.length > 1 ? 's' : ''} estimée${h.estimated.length > 1 ? 's' : ''}</span>` : ''}</div>
    <div id="b1c"></div>
    <div class="w-f" style="gap:22px;flex-wrap:wrap">
      ${stat('Volatilité' + (per1y ? ' (1 an)' : ''), vol != null ? F.frU(vol, 1) : '—', 'Ampleur annualisée des variations quotidiennes.')}
      ${stat('Pire baisse' + (per1y ? ' (1 an)' : ''), mdd != null ? `<span class="dn">${F.fr(mdd, 1)}</span>` : '—', 'Plus forte chute depuis un plus-haut sur la période (max drawdown).')}
      ${stat('Sharpe' + (per1y ? ' (1 an)' : sharpeLbl), sharpe != null ? F.n(sharpe, 2) : '—', 'Rendement au-delà du taux sans risque (€STR) par unité de volatilité ; calculé sur au moins 3 mois de séances.')}
      ${stat('Bêta' + betaLbl, beta != null ? F.n(beta, 2) : '—', 'Sensibilité à l\'indice : 1,2 = le portefeuille bouge 20 % plus que l\'indice.')}
    </div>`;
  const box = document.getElementById('b1c');
  const intraday = p === '1d' || p === '1w';
  const fx = t => intraday ? (p === '1d' ? F.time(t) : F.dshort(t)) : F.dshort(t);
  if (md === 'pct' && pf && pf.chart && pf.chart.length > 1) {
    const ch = pf.chart; const t = ch.map(c => c.t);
    const sp = ch.map(c => c.p - 100), sb = ch.map(c => c.b == null ? null : c.b - 100);
    if (S.b1table) { box.innerHTML = table(t, [['Portefeuille', sp, v => F.pct(v, 2)], [pf.benchmark?.label || 'Indice', sb, v => F.pct(v, 2)]]); return; }
    S.charts.b1 = C.line(box, { t, h: 250, animate, label: 'Performance du portefeuille comparée à l\'indice', series: [{ v: sp, color: L.P.acc, w: 2.2 }, { v: sb, color: L.P.bench, w: 1.5 }],
      fmtY: v => F.s(v, 0) + ' %', fmtX: F.dshort, ref: { v: 0 },
      tip: i => `<b>${F.date(t[i])}</b><div class="r"><span><i style="display:inline-block;width:8px;height:2px;background:${L.P.acc};vertical-align:3px;margin-right:5px"></i>Portefeuille</span><b>${F.pct(sp[i], 2)}</b></div><div class="r"><span><i style="display:inline-block;width:8px;height:2px;background:${L.P.bench};vertical-align:3px;margin-right:5px"></i>${L.esc(pf.benchmark?.label || 'Indice')}</span><b>${F.pct(sb[i], 2)}</b></div><div class="r muted"><span>Écart</span><span>${sb[i] == null ? '—' : F.pt(sp[i] - sb[i], 1)}</span></div>` });
    box.insertAdjacentHTML('afterend', `<div class="legend" style="margin-top:6px"><span><i class="ln" style="background:${L.P.acc}"></i>Portefeuille (TWR)</span><span><i class="ln" style="background:${L.P.bench}"></i>${L.esc(pf.benchmark?.label || 'Indice')}</span></div>`);
  } else {
    const pts = h.points || []; const t = pts.map(x => x.t), v = pts.map(x => x.value), inv = pts.map(x => x.invested);
    const up = (v[v.length - 1] ?? 0) >= (h.reference === 'prev_close' ? inv[0] : v[0]);
    const col = up ? L.P.up : L.P.down;
    if (S.b1table) { box.innerHTML = table(t, [['Valeur', v, x => F.eur(x, 0)], [h.reference === 'prev_close' ? 'Clôture veille' : 'Investi', inv, x => F.eur(x, 0)]], intraday); return; }
    const invScale = p === 'max' || p === '1d';
    const invShown = invScale || C.inRange(v, inv);
    S.charts.b1 = C.line(box, { t, h: 250, animate, money: true, label: 'Valeur du portefeuille' + (intraday ? '' : ' ; cliquez un jour pour voir le portefeuille à cette date'), series: [{ v, color: col, w: 2, area: true }, { v: inv, color: L.P.ink2, w: 1.2, dash: '4 4', opacity: .65, noScale: !invScale }],
      fmtY: x => F.k(x), fmtX: p === 'max' || p === '1y' ? (t => F.mon(new Date(t * 1000).toISOString().slice(0, 7))) : fx,
      onPick: intraday ? null : i => L.openAtDate(t[i]),
      tip: i => `<b>${intraday ? F.dshort(t[i]) + ' ' + F.time(t[i]) : F.date(t[i])}</b><div class="r"><span>Valeur</span><b>${L.m(F.eur(v[i], 0))}</b></div><div class="r muted"><span>${h.reference === 'prev_close' ? 'Clôture veille' : 'Investi'}</span><span>${L.m(F.eur(inv[i], 0))}</span></div>${intraday ? '' : `<div class="note" style="margin-top:4px">${L.tapW()} pour voir le portefeuille ce jour-là</div>`}` });
    box.insertAdjacentHTML('afterend', `<div class="legend" style="margin-top:6px"><span><i class="ln" style="background:${col}"></i>Valeur</span>${invShown ? `<span><i class="dash"></i>${h.reference === 'prev_close' ? 'Clôture de la veille' : 'Capital investi'}</span>` : `<span>Capital investi : ${L.m(F.eur(inv[inv.length - 1], 0))}</span>`}</div>`);
  }
}
const table = (t, cols, time = false) => {
  const step = Math.max(1, Math.ceil(t.length / 40));
  let h = `<div class="tbl-wrap" style="max-height:260px;overflow:auto"><table class="tbl"><thead><tr><th>Date</th>${cols.map(c => `<th>${L.esc(c[0])}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = t.length - 1; i >= 0; i -= step) h += `<tr><td>${time ? F.dshort(t[i]) + ' ' + F.time(t[i]) : F.date(t[i])}</td>${cols.map(c => `<td>${c[1][i] == null ? '—' : L.m(c[2](c[1][i]))}</td>`).join('')}</tr>`;
  return h + '</tbody></table></div>';
};

/* Le portefeuille tel qu'il était un jour donné, et ce que chaque ligne a rapporté depuis */
L.openAtDate = async ts => {
  L.drawer.open('detail', { title: `Portefeuille au ${F.date(ts)}`, sub: 'Chargement…', html: L.skel(260) });
  let r;
  try { r = await L.get('/api/portfolio/at?ts=' + Math.round(ts), 300000); }
  catch (e) { L.drawer.open('detail', { title: `Portefeuille au ${F.date(ts)}`, html: L.errBox(e) }); return; }
  if (!r.available) { L.drawer.open('detail', { title: `Portefeuille au ${F.date(ts)}`, html: '<div class="empty">Historique indisponible.</div>' }); return; }
  const gain = r.lines.reduce((a, x) => a + (x.gain_since || 0), 0);
  L.drawer.open('detail', {
    wide: true, title: `Portefeuille au ${F.date(r.date)}`,
    sub: `${L.m(F.eur(r.total, 0))} · ${r.lines.length} lignes${r.cost != null ? ` · investi ${L.m(F.eur(r.cost, 0))}` : ''}`,
    html: `<p class="note" style="margin-top:0">Valeur de chaque ligne ce jour-là (parts détenues × cours de clôture${r.price_source === 'tr' ? ' Trade Republic' : ''}) et ce qu'elle a rapporté depuis, achats et ventes exclus : ${L.delta(gain, L.m(F.eurS(gain)))} au total.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ligne</th><th class="num">Parts</th><th class="num">Cours</th><th class="num">Valeur</th><th class="num">Poids</th><th class="num">+/− latente</th><th class="num">Depuis</th></tr></thead><tbody>
      ${r.lines.map(x => `<tr class="click" data-pos="${L.esc(x.uid)}" tabindex="0"><td><b>${L.esc(x.name)}</b>${(r.estimated || []).includes(x.uid) ? ' <span class="tag warn" title="Cours estimés (prix d\'exécution)">estimé</span>' : ''}</td>
        <td class="num">${L.m(F.qty(x.qty))}</td><td class="num">${x.price != null ? F.eur(x.price, x.price < 10 ? 3 : 2) : '—'}</td>
        <td class="num">${L.m(F.eur(x.value, 0))}</td><td class="num">${F.pctU(x.weight, 1)}</td>
        <td class="num ${L.cls(x.pnl)}">${x.pnl != null ? L.m(F.eurS(x.pnl)) : '—'}</td>
        <td class="num ${L.cls(x.gain_since)}">${L.m(F.eurS(x.gain_since))}</td></tr>`).join('')}
      </tbody></table></div>`,
  });
};

/* ── B2 · À traiter / À lire ── */
const KIND = {
  alerte: ['alert', '!'], prix: ['warn', '€'], resultats: ['info', 'R'], evenement: ['info', '◷'], stop: ['alert', '▼'], mouvement: ['', ''],
};
function renderB2() {
  const el = document.getElementById('b2'); const d = S.data.dash; if (!el || !d) return;
  const hd = handled();
  const dec = (d.decisions || []).map((x, i) => ({ ...x, _i: i })).filter(x => !hd[x.kind + '|' + x.titre]);
  const dig = d.digest || [];
  const tab = S.b2tab || 'todo';
  const row = (x) => {
    const [st, ic] = KIND[x.kind] || ['info', '•'];
    const mv = x.kind === 'mouvement';
    const end = x.kind === 'alerte' ? `<span class="score ${x.score >= 70 ? 'hi' : x.score >= 50 ? 'mid' : ''}" title="Score d'importance">${x.score}</span>`
      : mv ? `<span class="${x.down ? 'dn' : 'up'}">${x.down ? '▼' : '▲'}</span>` : '';
    const meta = [x.detail, x.source, x.age_h != null ? F.ago(x.age_h) : ''].filter(Boolean).join(' · ');
    return `<div class="li click" data-dec="${x._i}" role="button" tabindex="0"><span class="st ${mv ? (x.down ? 'alert' : 'ok') : st}">${mv ? (x.down ? '▼' : '▲') : ic}</span>
      <div class="main"><div class="t1 ell">${L.mText(x.titre)}</div><div class="t2 ell">${L.mText(meta)}</div></div>${end}</div>`;
  };
  const readRow = a => `<a class="li click" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><span class="score ${a.score >= 50 ? 'mid' : ''}">${a.score}</span>
    <div class="main"><div class="t1 ell">${L.esc(a.title)}</div><div class="t2 ell">${L.esc([a.why, a.source, F.ago(a.age_h)].filter(Boolean).join(' · '))}</div></div></a>`;
  el.innerHTML = `<div class="w-h"><div class="seg sm" role="group" aria-label="Liste affichée"><button data-b2="todo" class="${tab === 'todo' ? 'on' : ''}" aria-pressed="${tab === 'todo'}">À traiter (${dec.length})</button><button data-b2="read" class="${tab === 'read' ? 'on' : ''}" aria-pressed="${tab === 'read'}">À lire (${dig.length})</button></div>
    <div class="r"><a class="lnk" href="#/decisions">Ouvrir le bureau de décision</a></div></div>
    ${(d.pending || []).includes('alerts') ? '<div class="note" style="margin:-4px 0 6px">Analyse des actualités en cours…</div>' : ''}
    <div>${tab === 'todo' ? (dec.length ? dec.slice(0, 6).map(row).join('') : '<div class="empty">Aucune alerte ≥ 70, aucun seuil franchi, aucun mouvement notable aujourd\'hui.</div>')
      : (dig.length ? dig.slice(0, 6).map(readRow).join('') : '<div class="empty">Rien de notable à lire.</div>')}</div>`;
  done(el);
}
function openDecision(i) {
  const x = (S.data.dash?.decisions || [])[i]; if (!x) return;
  const key = x.kind + '|' + x.titre;
  const bk = x.breakdown ? `<div class="bk">${Object.entries(x.breakdown).map(([k, v]) => `<span>${L.esc(k)} ${F.n(v, 0)}</span>`).join('')}</div>` : '';
  const d = L.drawer.open('detail', {
    narrow: true, title: L.mText(x.titre),
    sub: L.esc([x.source, x.age_h != null ? F.ago(x.age_h) : '', x.kind === 'alerte' ? `score ${x.score}/100` : ''].filter(Boolean).join(' · ')),
    html: `${x.text ? `<div class="callout">${L.mText(x.text)}</div>` : x.detail ? `<p class="ink2">${L.mText(x.detail)}</p>` : ''}
      ${bk ? `<div class="sec"><h3>Décomposition du score</h3>${bk}<p class="note" style="margin-top:8px">Exposition = poids de la ligne ou du secteur ; événement = gravité (enquête, résultats, contrat…) ; fraîcheur ; fiabilité de la source.</p></div>` : ''}
      <div class="sec"><h3>À trancher</h3><p>${L.esc(x.question || '')}</p></div>
      <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap">
        ${x.link ? `<a class="btn" href="${L.url(x.link)}" target="_blank" rel="noopener noreferrer">${L.icon('ext')}Ouvrir l'article</a>` : ''}
        <button class="btn ia" data-ask="${L.esc(`Quel impact pour mon portefeuille : « ${x.titre} » ?`)}">${L.icon('spark')}Analyser l'impact</button>
        ${x.isin ? `<button class="btn" data-pos="${L.esc(x.isin)}">Voir la fiche</button>` : ''}
        <button class="btn g" id="markDone">Marquer comme traité</button></div>
      <p class="guard">LUMIO expose les faits et la question à trancher ; il ne passe aucun ordre.</p>`,
  });
  d.querySelector('#markDone').onclick = () => { const h = handled(); h[key] = Date.now(); L.store.set('handled', h); L.drawer.close(); renderB2(); L.toast('Masqué pendant 24 h'); };
}

/* ── C1 · Carte (treemap) ── */
const RKL = { '1d': "aujourd'hui", '1w': 'sur 1 semaine', '1m': 'sur 1 mois', ytd: 'depuis le 1er janvier', '1y': 'sur 1 an', max: "depuis l'achat" };
L.rkLabel = rk => RKL[rk] || '';
/* Période du tableau de bord -> couleur des cases : 1J = jour, Max = plus-value depuis l'achat, sinon variation du cours */
L.tmOf = rk => rk === '1d' ? 'jour' : rk === 'max' ? 'pv' : 'per';
L.tmQ = (m, pk) => m === 'pv' ? [10, 25, 50] : m === 'jour' ? [0.5, 1.5, 3]
  : ({ '1w': [1, 3, 6], '1m': [2, 5, 10], ytd: [5, 12, 25], '1y': [5, 12, 25] })[pk] || [2, 5, 10];
L.tmColor = (p, m, perKey) => {
  const NN = ' ';   // espace fine insécable : « +4,8 % » tient dans une petite case
  const na = { cls: 'qna', label: 'n.d.', short: 'n.d.' };   // variation inconnue : hachuré et « n.d. », jamais un faux « 0 % » gris
  // Titres reçus gratuitement (cadeau, parrainage) : prix de revient nul, toute la valeur est gagnée
  if (m === 'pv' && p.pnl_pct === 0 && p.value > 0 && p.pnl != null && Math.abs(p.pnl - p.value) < 0.01) return { cls: 'q3', label: 'offerte', short: 'offerte' };
  if (m === 'pv') return p.pnl_pct == null ? na : { cls: C.qClass(p.pnl_pct, L.tmQ('pv')), label: F.pct(p.pnl_pct, 1), short: F.s(p.pnl_pct, 0) + NN + '%' };
  if (m === 'per') { const v = p.perf?.[perKey]; return v == null ? na : { cls: C.qClass(v, L.tmQ('per', perKey)), label: F.pct(v, 1), short: F.s(v, 0) + NN + '%' }; }
  return p.change_pct_day == null ? na : { cls: C.qClass(p.change_pct_day, L.tmQ('jour')), label: F.pct(p.change_pct_day, 2), short: F.s(p.change_pct_day, 1) + NN + '%' };
};
L.tmTip = (p, m, perKey) => `<b>${L.esc(p.name)}</b><div class="r"><span>Valeur</span><b>${L.m(F.eur(p.value, 0))}</b></div><div class="r"><span>Poids</span><span>${F.pctU(p.weight, 1)}</span></div>
  <div class="r"><span>Jour</span><span class="${L.cls(p.change_pct_day)}">${p.change_pct_day == null ? 'cours indisponible' : `${F.pct(p.change_pct_day, 2)} · ${L.m(F.eurS(p.day_pnl))}`}</span></div>
  ${p.perf && perKey ? `<div class="r"><span>${({ '1w': '1 semaine', '1m': '1 mois', ytd: 'Depuis janv.', '1y': '1 an' })[perKey]}</span><span class="${L.cls(p.perf[perKey])}">${F.pct(p.perf[perKey], 1)}</span></div>` : ''}
  <div class="r"><span>Plus-value</span><span class="${L.cls(p.pnl_pct)}">${F.pct(p.pnl_pct, 1)} · ${L.m(F.eurS(p.pnl))}</span></div>
  ${p.quote_source === 'tr' ? '<div class="note" style="margin-top:4px">Cours Trade Republic de la dernière mise à jour</div>' : ''}`;
L.perKey = p => ({ '1d': '1w', '1w': '1w', '1m': '1m', ytd: 'ytd', '1y': '1y', max: '1y' })[p];

/* Analyse de la carte (/api/map) : pourquoi chaque ligne bouge sur la période, ce que vaut l'action,
   impact estimé des actualités qui demandent une décision. Gardée par période pour l'info-bulle. */
L.mapData = {};
L.loadMap = (rk, force = false) => L.get(`/api/map?range=${rk}`, 240000, force).then(d => { L.mapData[rk] = d; return d; });
L.urgentOf = (k, uid) => { for (const d of Object.values(L.mapData)) { const u = d?.urgent?.[k]?.[uid]; if (u) return u; } return null; };
const moveOf = (p, rk) => rk === '1d' ? p.change_pct_day : rk === 'max' ? p.pnl_pct : p.perf?.[rk];
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const NOVAL = { ETF: 'un ETF (panier de titres)', Fonds: 'un fonds', Crypto: 'une crypto-monnaie', Obligation: 'une obligation', 'Matière première': 'une matière première' };

/* Fourchette d'impact : « −4,3 à −7,9 % », montant sur la ligne « ≈ −356 à −654 € » */
L.impactTxt = u => {
  if (!u) return '';
  return u.sign ? `${F.s(u.sign * u.lo_pct, 1)} à ${F.pct(u.sign * u.hi_pct, 1)}` : `± ${F.n(u.lo_pct, 1)} à ${F.pctU(u.hi_pct, 1)}`;
};
L.impactEur = u => u && u.lo_eur != null ? L.m(u.sign ? `≈ ${F.s(u.sign * u.lo_eur, 0)} à ${F.eurS(u.sign * u.hi_eur, 0)}` : `≈ ± ${F.n(u.lo_eur, 0)} à ${F.eur(u.hi_eur, 0)}`) : '';
L.impactCalc = (u, f) => `Calcul : variation habituelle d'une séance ${F.pctU(u.vol_pct / Math.sqrt(252), 1)}${u.vol_assumed ? ' (supposée)' : ''} × gravité ${F.n(u.k, 1)}${f && f.score != null ? ` (note ${f.score}/100)` : ''}, à ± 30 %. Un ordre de grandeur, pas une prévision.`;
L.impactHtml = (u, f) => {
  if (!u) return `<div class="tt-urg"><b>Décision à prendre maintenant</b></div><div class="tt-calc">Impact en cours d'estimation…</div>`;
  return `<div class="tt-urg"><b>Décision à prendre maintenant</b></div>
    <div class="r"><span>Impact potentiel estimé</span><b class="${u.sign < 0 ? 'dn' : u.sign > 0 ? 'up' : ''}">${L.impactTxt(u)}</b></div>
    ${u.lo_eur != null ? `<div class="r"><span>Sur votre ligne</span><span>${L.impactEur(u)}${u.sign ? '' : ', sens incertain'}</span></div>` : ''}
    ${u.day_pct != null ? `<div class="r"><span>Déjà bougé aujourd'hui</span><span class="${L.cls(u.day_pct)}">${F.pct(u.day_pct, 1)}</span></div>` : ''}
    <div class="tt-calc">${L.impactCalc(u, f)}</div>`;
};

/* Info-bulle d'une case (et aperçu au doigt) */
L.whyHtml = (p, rk, o = {}) => {
  const mp = L.mapData[rk]; const x = mp?.items?.[p.uid];
  const mv = x ? x.move : moveOf(p, rk);
  const ce = x && x.contrib_eur != null ? x.contrib_eur : rk === '1d' ? p.day_pnl : rk === 'max' ? p.pnl : null;
  let h = o.sheet ? '' : `<div class="tt-h"><b>${L.esc(p.name)}</b><span>${L.m(F.eur(p.value, 0))} · ${F.pctU(p.weight, 1)}</span></div>`;
  if (mv == null) h += `<p class="tt-why">Variation ${RKL[rk]} inconnue : cours indisponible.</p>`;
  else {
    h += `<div class="tt-lead">${L.delta(mv, `<b>${F.pct(mv, rk === '1d' ? 2 : 1)}</b>`)} <span>${RKL[rk]}${ce != null ? ` · ${L.m(F.eurS(ce))}${x?.contrib_approx ? ' env.' : ''}` : ''}</span></div>`;
    const why = x?.lead ? x.lead.split(' : ').slice(1).join(' : ') : '';
    h += x ? (why ? `<p class="tt-why">${L.esc(cap1(why))}</p>` : '') : '<p class="tt-why tt-wait">Analyse de la période en cours…</p>';
  }
  if (x && mv != null && Math.abs(mv) >= 0.25 && x.expected_pt != null && x.own_pt != null) {
    const b = x.beta_assumed ? '1 (supposée)' : F.n(x.beta, 2);
    h += `<div class="tt-sec"><div class="r"><span>Part du marché <i>${L.esc(mp.market?.name || 'MSCI World')} ${F.pct(x.market_pct, 1)} × sensibilité ${b}</i></span><span>${F.pt(x.expected_pt)}</span></div>
      <div class="r"><span>Part propre à l'action</span><span>${F.pt(x.own_pt)}</span></div></div>`;
  }
  const cl = (x?.clues || []).filter(c => !(c.kind === 'news' && x.lead && x.lead.includes(c.title)));
  if (cl.length) h += `<div class="tt-sec"><div class="tt-k">Faits de la période</div><ul class="tt-cl">${cl.map(c => c.kind === 'news'
    ? `<li><i class="tt-pol ${c.pol > 0 ? 'up' : c.pol < 0 ? 'dn' : ''}"></i>« ${L.esc(c.title)} »${c.source || c.age_h != null ? ` <span>${L.esc([c.source, c.age_h != null ? F.ago(c.age_h) : ''].filter(Boolean).join(', '))}</span>` : ''}</li>`
    : `<li><i class="tt-pol"></i>${L.esc(c.text)}</li>`).join('')}</ul></div>`;
  const urg = (o.nd?.by[p.isin] || []).filter(f => f.level === 'alerte');
  urg.forEach(f => { const u = L.urgentOf(f.k, p.uid);
    h += `<div class="tt-sec"><div class="tt-urg"><b>Décision à prendre maintenant</b>${x?.lead && x.lead.includes(f.title) ? ' sur cette actualité' : ` : « ${L.esc(f.title)} »`}</div>${u ? `<div class="r"><span>Impact potentiel estimé</span><b class="${u.sign < 0 ? 'dn' : u.sign > 0 ? 'up' : ''}">${L.impactTxt(u)}</b></div>` : ''}</div>`; });
  const v = x?.valuation;
  if (v) {
    const nfair = (v.items || []).filter(i => i.fair != null).length;
    h += `<div class="tt-sec"><div class="tt-k">Valorisation</div>${v.verdict
      ? `<div class="tt-vh"><span class="tt-v ${v.verdict}">${L.esc(v.label)}</span></div>
        <div class="r"><span>Cours</span><span>${F.eur(v.price)}</span></div>
        ${v.verdict === 'partage' ? '' : `<div class="r"><span>Valeur estimée${nfair > 1 ? ' (moyenne des repères)' : ''}</span><b>${F.eur(v.fair)} <span class="${L.cls(v.gap_pct)}">${F.pct(v.gap_pct, 0)}</span></b></div>`}`
      : `<div class="tt-calc">${L.esc(v.label)}</div>`}
      ${(v.items || []).map(it => it.fair == null ? `<div class="tt-calc">${L.esc(it.label)}</div>`
        : `<div class="tt-calc">${L.esc(it.label)} : ${it.calc ? L.esc(it.calc) : F.eur(it.fair)} <span class="${L.cls(it.gap_pct)}">(${F.pct(it.gap_pct, 0)})</span></div>`).join('')}
      <div class="tt-foot">Repère indicatif, pas un conseil.</div></div>`;
  } else if (x && p.asset_type !== 'Liquidités') {
    h += `<div class="tt-sec tt-calc">${NOVAL[p.asset_type] ? `Valorisation : sans objet pour ${NOVAL[p.asset_type]}.` : "Valorisation : pas assez de données (ni bénéfice ni objectif d'analystes)."}</div>`;
  }
  return o.sheet ? h : `<div class="tt">${h}</div>`;
};
/* Au doigt : un aperçu (pourquoi ça bouge, valorisation, actualité à trancher), puis la fiche */
L.openPeek = (p, rk, nd) => {
  const d = L.drawer.open('detail', {
    narrow: true, title: L.esc(p.name),
    sub: `${L.m(F.eur(p.value, 0))} · ${F.pctU(p.weight, 1)} du portefeuille`,
    html: `<div class="tt tt-sheet" id="pkBody">${L.whyHtml(p, rk, { nd, sheet: true })}</div>
      <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-pos="${L.esc(p.uid)}">Voir la fiche</button></div>`,
  });
  if (!L.mapData[rk]) L.loadMap(rk).then(() => { const b = d.querySelector('#pkBody'); if (b && b.isConnected) b.innerHTML = L.whyHtml(p, rk, { nd, sheet: true }); }).catch(() => {});
};

/* Actualités importantes sur la carte : un point par actualité non lue (2 au plus par case),
   vert = plutôt favorable, rouge = plutôt défavorable, clair = à lire ; une actualité qui touche
   plusieurs lignes porte le même numéro sur chacune. Lu = ouvert ou marqué comme lu (7 jours). */
const READ_KEY = 'news.read';
L.newsRead = () => {
  const r = L.store.get(READ_KEY, {}) || {}; const now = Date.now(); let ch = false;
  for (const k of Object.keys(r)) if (now - r[k] > 7 * 864e5) { delete r[k]; ch = true; }
  if (ch) L.store.set(READ_KEY, r);
  return r;
};
L.markNewsRead = k => { const r = L.newsRead(); r[k] = Date.now(); L.store.set(READ_KEY, r); };
L.newsDots = flags => {
  const read = L.newsRead();
  const unread = (flags || []).filter(f => !read[f.k]);
  let n = 0; const num = {}; const by = {};
  unread.forEach(f => { if (f.isins.length > 1) num[f.k] = ++n; });
  unread.forEach(f => f.isins.forEach(i => (by[i] = by[i] || []).push({ ...f, n: num[f.k] || null })));
  return { by, unread, find: k => (flags || []).find(f => f.k === k) };
};
L.newsLegend = nd => {
  if (!nd.unread.length) return '';
  const pols = new Set(nd.unread.map(f => f.pol));
  const multi = nd.unread.some(f => f.isins.length > 1);
  const urg = nd.unread.some(f => f.level === 'alerte');
  return `<div class="tm-news"><span>Actualités importantes non lues :</span>${pols.has(1) ? '<span><i class="pos"></i>plutôt favorable</span>' : ''}${pols.has(-1) ? '<span><i class="neg"></i>plutôt défavorable</span>' : ''}${pols.has(0) ? '<span><i class="neu"></i>à lire</span>' : ''}${multi ? '<span><b>1</b>même numéro = même actualité</span>' : ''}${urg ? `<span><i class="urg">!</i>clignote : décision à prendre maintenant (impact estimé ${L.coarse ? 'en touchant le point' : 'au survol du point'})</span>` : ''}</div>`;
};
L.newsTip = (nd, k, uid) => {
  const f = nd.find(k); if (!f) return '';
  const names = f.isins.map(i => (L.data.portfolio?.positions || []).find(p => p.isin === i)?.name || i);
  return `<div class="tt"><b>${L.esc(f.title)}</b><div class="note" style="margin-top:4px">${L.esc([f.source, f.age_h != null ? F.ago(f.age_h) : ''].filter(Boolean).join(' · '))}</div>${names.length > 1 ? `<div class="note">Concerne : ${L.esc(names.join(', '))}</div>` : ''}
    ${f.level === 'alerte' ? `<div class="tt-sec">${L.impactHtml(uid ? L.urgentOf(k, uid) : null, f)}</div>` : ''}</div>`;
};
/* Impact estimé, ligne par ligne, pour le tiroir d'une actualité à trancher */
const impactRows = f => {
  const ps = L.data.portfolio?.positions || [];
  const rows = f.isins.flatMap(i => ps.filter(p => p.isin === i)).map(p => ({ p, u: L.urgentOf(f.k, p.uid) })).filter(r => r.u);
  if (!rows.length) return '';
  return rows.map(({ p, u }) => `<div class="r"><span>${L.esc(p.name)}</span><span><b class="${u.sign < 0 ? 'dn' : u.sign > 0 ? 'up' : ''}">${L.impactTxt(u)}</b>${u.lo_eur != null ? ` · ${L.impactEur(u)}` : ''}</span></div>`).join('')
    + `<p class="note" style="margin-top:6px">${L.impactCalc(rows[0].u, f)}</p>`;
};
L.openNews = (nd, k, after) => {
  const f = nd.find(k); if (!f) return;
  const names = f.isins.map(i => (L.data.portfolio?.positions || []).find(p => p.isin === i)?.name || i);
  const tone = f.pol > 0 ? 'Titre plutôt favorable' : f.pol < 0 ? 'Titre plutôt défavorable' : 'Tonalité neutre ou mitigée';
  const d = L.drawer.open('detail', {
    narrow: true, title: L.esc(f.title),
    sub: L.esc([f.source, f.age_h != null ? F.ago(f.age_h) : '', `score ${f.score}/100`].filter(Boolean).join(' · ')),
    html: `<div class="sec" style="margin-top:0"><h3>Lignes concernées</h3><p>${names.map(L.esc).join(', ')}${f.sector ? ' (actualité de secteur)' : ''}</p></div>
      ${f.summary ? `<div class="sec"><h3>Résumé</h3><p>${L.esc(f.summary)}</p></div>` : ''}
      ${f.level === 'alerte' ? `<div class="sec tt-imp"><h3>Décision à prendre maintenant : impact potentiel estimé</h3><div id="nwImp">${impactRows(f) || '<p class="note">Estimation en cours…</p>'}</div></div>` : ''}
      <div class="sec"><h3>Lecture automatique du titre</h3><p>${tone}. LUMIO lit le titre, pas l'article : à vérifier en le lisant.</p></div>
      <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap">
        ${f.link ? `<a class="btn" id="nwOpen" href="${L.url(f.link)}" target="_blank" rel="noopener noreferrer">${L.icon('ext')}Lire l'article</a>` : ''}
        <button class="btn ia" data-ask="${L.esc(`Quel impact pour mon portefeuille : « ${f.title} » ?`)}">${L.icon('spark')}Analyser l'impact</button>
        <button class="btn g" id="nwRead">Marquer comme lu</button></div>`,
  });
  const done_ = () => { L.markNewsRead(k); after && after(); };
  if (f.level === 'alerte' && !impactRows(f)) L.loadMap('1d').then(() => { const b = d.querySelector('#nwImp'); if (b && b.isConnected) b.innerHTML = impactRows(f) || '<p class="note">Impact non estimable : cours de la ligne indisponible.</p>'; }).catch(() => {});
  d.querySelector('#nwOpen')?.addEventListener('click', done_);
  d.querySelector('#nwRead').onclick = () => { done_(); L.drawer.close(); L.toast('Actualité marquée comme lue'); };
};

function renderC1() {
  const el = document.getElementById('c1'); const d = S.data.dash; if (!el || !d) return;
  if (L.store.get('dash.c1view', 'carte') === 'ciel') return renderSky(el);
  const rk = per(); const m = L.tmOf(rk);
  const items = (d.treemap || []).map(p => ({ ...p, short: p.name.replace(/\s*\(.*\)/, ''), tk: (p.ticker || '').split(/[.-]/)[0] }));
  const mob = window.innerWidth < 720;
  const nd = L.newsDots(d.news_flags);
  const sigOn = L.store.get('dash.c1sig', false);
  const sg = S.data.sig;
  const out = {}, inn = {};
  (sg?.exits || []).forEach(x => { out[x.uid] = x; });
  (sg?.entries || []).filter(x => x.held && x.uid).forEach(x => { inn[x.uid] = x; });
  el.innerHTML = `<div class="w-h"><h2>Carte du portefeuille<span class="h2-sub">${RKL[rk]}</span></h2><div class="r">
      <button type="button" class="chip${sigOn ? ' on' : ''}" id="c1sig" aria-pressed="${sigOn}" title="Contour orange : à réexaminer ; contour bleu : à renforcer">Signaux</button>${c1Views('carte')}
      <a class="more" href="#/portefeuille/positions">Voir en liste${L.icon('chev')}</a></div></div>
    <div id="tmc"></div><div id="tmleg"></div>
    ${mob ? `<details class="tm-how"><summary>Comment lire la carte</summary><div id="tmleg2"></div><p class="note">${tmHow(m, rk)}</p></details>`
      : `<p class="note" style="margin-top:6px">${tmHow(m, rk)}</p>`}`;
  const box = document.getElementById('tmc');
  S.charts.tm && S.charts.tm.destroy();
  S.charts.tm = C.treemap(box, items, { h: mob ? 400 : 470, group: 'sector', minShare: mob ? 0.03 : 0.015,
    color: p => L.tmColor(p, m, rk), tip: p => (sigOn ? sigTip(out[p.uid], inn[p.uid]) : '') + L.whyHtml(p, rk, { nd }), onClick: uid => L.router.setParam('p', uid),
    sigMode: sigOn, cellCls: p => !sigOn ? '' : out[p.uid] && inn[p.uid] ? 'sig-both' : out[p.uid] ? 'sig-out' : inn[p.uid] ? 'sig-in' : '',
    onPeek: uid => { const p = items.find(i => String(i.uid) === uid); if (p) L.openPeek(p, rk, nd); },
    dots: c => nd.by[c.isin], dotTip: (k, uid) => L.newsTip(nd, k, uid), onDot: k => L.openNews(nd, k, () => renderC1()) });
  const unknown = items.some(p => L.tmColor(p, m, rk).cls === 'qna');
  if (mob) document.getElementById('tmleg2').innerHTML = L.newsLegend(nd);
  document.getElementById('tmleg').innerHTML = C.qLegend(L.tmQ(m, rk), '%',
    [C.treemap.enlarged ? `Lignes de moins de ${mob ? '3' : '1,5'} % agrandies pour rester lisibles` : '',
     unknown ? 'hachuré, n.d. : variation inconnue (cours indisponible)' : ''].filter(Boolean).join(' · ')) + (mob ? '' : L.newsLegend(nd))
    + (sigOn ? `<div class="tm-news sg-leg"><span><i class="sgo"></i>contour orange : à réexaminer (signaux de sortie)</span><span><i class="sgi"></i>contour bleu : à renforcer (signaux d'entrée)</span><span>estompé : aucun signal${sg ? '' : ' (calcul en cours)'}</span></div>` : '');
  done(el);
}

const sigTip = (o, i) => !o && !i ? '' : `<div class="tt sg-tt">${o ? `<div class="tt-k sg-out">À réexaminer · ${o.score}/100</div><ul class="tt-cl">${o.signals.slice(0, 3).map(x => `<li><i class="tt-pol dn"></i>${L.mText(x.text)}</li>`).join('')}</ul>` : ''}${i ? `<div class="tt-k sg-in">À renforcer ? · ${i.score}/100</div><ul class="tt-cl">${i.signals.slice(0, 3).map(x => `<li><i class="tt-pol up"></i>${L.mText(x.text)}</li>`).join('')}</ul>` : ''}</div>`;
const c1Views = cur => `<div class="seg sm" role="group" aria-label="Vue"><button data-c1v="carte" class="${cur === 'carte' ? 'on' : ''}" aria-pressed="${cur === 'carte'}">Surface</button><button data-c1v="ciel" class="${cur === 'ciel' ? 'on' : ''}" aria-pressed="${cur === 'ciel'}">Ciel</button></div>`;
const SKYV = [['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1A']];
const SKYL = { '1m': '1 mois', '3m': '3 mois', '6m': '6 mois', '1y': '1 an' };
const skyVol = () => { const v = L.store.get('sky.vol', '1y'); return SKYL[v] ? v : '1y'; };
async function renderSky(el) {
  const sv = skyVol();
  el.innerHTML = `<div class="w-h"><h2>Constellation du portefeuille</h2><div class="r">
      <div class="seg sm sky-win" role="group" aria-label="Fenêtre de la volatilité"><span class="seg-l" aria-hidden="true">Volatilité</span>${SKYV.map(([k, l]) => `<button data-skyv="${k}" class="${k === sv ? 'on' : ''}" aria-pressed="${k === sv}" title="Volatilité calculée sur ${SKYL[k]}">${l}</button>`).join('')}</div>
      ${c1Views('ciel')}<a class="more" href="#/portefeuille/analyse">Analyse du risque${L.icon('chev')}</a></div></div>
    <div id="skyC">${L.skel(420)}</div>
    <div class="sky-legend"><span>Direction : secteur</span><span>Distance au centre : volatilité sur ${SKYL[sv]} (annualisée, échelle linéaire)</span><span>Anneau pointillé : volatilité inconnue sur cette fenêtre (historique trop court)</span><span>Taille : poids</span><span>Couleur : plus-value depuis l'achat</span><span>Trait fin : même secteur</span><span>Trait violet : lignes très corrélées (≥ 0,7)</span><span>Arc violet : secteur au-delà de votre limite</span></div>`;
  let sk;
  try { sk = await L.get('/api/sky?vol=' + sv, 120000); } catch (e) { const b = document.getElementById('skyC'); if (b) b.innerHTML = L.errBox(e); return; }
  const box = document.getElementById('skyC'); if (!box || sv !== skyVol()) return;
  S.charts.tm && S.charts.tm.destroy();
  S.charts.tm = C.sky(box, sk, { h: window.innerWidth < 720 ? 400 : 560, labelMin: window.innerWidth < 720 ? 5 : 2.5, volLabel: SKYL[sv], onClick: uid => L.router.setParam('p', uid) });
  done(el);
}

/* ── C2 · Contributions ── */
function renderC2() {
  const el = document.getElementById('c2'); if (!el) return;
  const p = per();
  const at = S.data.perf?.attribution || (S.data.explain?.contributors || []).map(c => ({ name: c.name, isin: c.isin, gain_eur: c.delta_eur }));
  const total = S.data.perf?.attribution_total ?? (S.data.hist?.change_eur);
  const pos = at.filter(a => a.gain_eur > 0).sort((a, b) => b.gain_eur - a.gain_eur).slice(0, 4);
  const neg = at.filter(a => a.gain_eur < 0).sort((a, b) => a.gain_eur - b.gain_eur).slice(0, 4);
  const rows = pos.concat(neg.reverse()).map(a => ({ label: a.name + (a.estimated ? ' ≈' : ''), v: a.gain_eur }));
  // le reste regroupé : la somme affichée boucle sur le total
  const rest = at.length - rows.length, diff = total != null ? Math.round((total - rows.reduce((s, r) => s + r.v, 0)) * 100) / 100 : 0;
  if (Math.abs(diff) >= 0.5) rows.splice(pos.length, 0, { label: rest > 0 ? `${rest} autre${rest > 1 ? 's' : ''} ligne${rest > 1 ? 's' : ''}` : 'Autres lignes', v: diff });
  el.innerHTML = `<div class="w-h"><h2>Contributions · ${PSHORT[p]}</h2></div>${rows.length ? C.dbars(rows) : '<div class="empty">Pas assez de données sur la période.</div>'}
    <div class="w-f" style="border-top:1px solid var(--line);margin-top:auto;padding-top:10px"><span class="muted" style="font-size:12.5px">Total ${PLABEL[p]}</span><b style="margin-left:auto" class="${L.cls(total)}">${L.m(F.eurS(total))}</b></div>`;
  done(el);
}
/* ── C3 · Marchés ── */
function renderC3() {
  const el = document.getElementById('c3'); if (!el || !S.data.idx) return;
  const rows = S.data.idx.slice(0, 7);
  L.swap(el, `<div class="w-h"><h2>Marchés</h2><div class="r"><a class="lnk" href="#/veille/marches">Détail</a></div></div><div class="mkts-row">${rows.map((x, i) => `<div class="mkt"><div><div class="n">${L.esc(x.label)}</div><div class="p">${F.n(x.price, x.price < 10 ? 4 : x.price < 1000 ? 2 : 0)}</div></div>
    <span class="only-d">${C.spark(x.spark, { w: 56, h: 18 })}</span><span class="v ${L.cls(x.change_pct_day)}" data-k="mk${i}">${F.pct(x.change_pct_day, 1)}</span></div>`).join('')}</div>`);
  done(el);
}
/* ── D1 · Agenda ── */
const TYPE_LBL = { earnings: 'Résultats', ex_dividend: 'Détachement', dividend_pay: 'Versement' };
function renderD1() {
  const el = document.getElementById('d1'); const d = S.data.dash; if (!el || !d) return;
  const lim = Date.now() + 14 * 864e5;
  const ev = d.calendar || [];
  const soon = ev.filter(e => F.toDate(e.date) <= lim).slice(0, 5);
  const later = ev.filter(e => F.toDate(e.date) > lim).slice(0, Math.max(0, 5 - soon.length));
  const row = e => { const dt = F.toDate(e.date); return `<div class="li click" data-pos="${L.esc(e.isin || '')}" role="button" tabindex="0"><span class="datebox"><b>${dt.getDate()}</b><span>${F.months[dt.getMonth()]}</span></span>
      <div class="main"><div class="t1 ell">${L.esc(e.name)} · ${TYPE_LBL[e.type] || L.esc(e.label)}</div><div class="t2">${F.inDays(e.date)}${e.amount_eur ? ' · ≈ ' + L.m(F.eur(e.amount_eur)) + (e.amount_kind ? ' ' + e.amount_kind : '') : ''}${e.estimated ? ' · estimé' : ''}</div></div></div>`; };
  el.innerHTML = `<div class="w-h"><h2>Agenda · 14 jours</h2><div class="r"><a class="lnk" href="#/portefeuille/revenus">Calendrier</a></div></div>
    ${soon.length ? soon.map(row).join('') : '<div class="note" style="margin-bottom:6px">Aucun résultat ni dividende d\'ici 14 jours.</div>'}
    ${later.length ? `<div class="k-l" style="margin:10px 0 2px">Plus tard</div>${later.map(row).join('')}` : ''}
    ${!soon.length && !later.length ? '<div class="empty">Aucun événement connu sur vos positions.</div>' : ''}`;
  done(el);
}
/* ── D2 · Répartition ── */
function renderD2() {
  const el = document.getElementById('d2'); const d = S.data.dash; if (!el || !d) return;
  const dim = allocDim(); const lt = allocLt();
  const src = (lt ? d.allocation.lt : d.allocation.raw)[dim] || [];
  const top = src.slice(0, 6); const rest = src.slice(6);
  const rows = rest.length ? top.concat([{ label: `Autres (${rest.length})`, pct: rest.reduce((a, r) => a + r.pct, 0) }]) : top;
  const tick = dim === 'sector' ? 35 : dim === 'region' ? 80 : null;
  el.innerHTML = `<div class="w-h"><h2>Répartition</h2><div class="r"><div class="seg sm" role="group" aria-label="Répartition par"><button data-alloc="sector" class="${dim === 'sector' ? 'on' : ''}" aria-pressed="${dim === 'sector'}">Secteurs</button><button data-alloc="region" class="${dim === 'region' ? 'on' : ''}" aria-pressed="${dim === 'region'}">Régions</button><button data-alloc="currency" class="${dim === 'currency' ? 'on' : ''}" aria-pressed="${dim === 'currency'}">Devises</button></div></div></div>
    ${C.hbars(rows, { tick, max: 100 })}
    <div class="w-f"><button class="chip ${lt ? 'on' : ''}" id="ltToggle" aria-pressed="${lt}">ETF décomposés</button>${tick ? `<span class="note"><i style="display:inline-block;width:2px;height:10px;background:var(--ref);vertical-align:-1px;margin-right:5px"></i>seuil d'alerte ${tick} %</span>` : ''}</div>`;
  done(el);
}
/* ── D3 · Bilan de santé ── */
function renderD3() {
  const el = document.getElementById('d3'); const d = S.data.dash; if (!el || !d) return;
  const h = d.health || {}; const order = { alert: 0, warn: 1, ok: 2 };
  const rules = (h.rules || []).filter(r => r.id !== 'data').sort((a, b) => order[a.status] - order[b.status]).slice(0, 5);
  const ic = { ok: '✓', warn: '!', alert: '✕' };
  const short = r => r.id === 'single' ? F.pctU(r.value, 1) : r.id === 'losers' || r.id === 'correlation' ? String(r.value) : typeof r.value === 'number' ? F.pctU(r.value, r.value < 10 ? 2 : 1) : '';
  el.innerHTML = `<div class="w-h"><h2>Bilan de santé</h2><div class="r"><b style="font-size:20px">${h.score ?? '—'}</b><span class="muted">/100</span></div></div>${C.gauge(h.score)}
    <div style="margin-top:10px">${rules.map(r => `<div class="li"><span class="st ${r.status}" aria-label="${r.status === 'ok' ? 'conforme' : r.status === 'warn' ? 'à surveiller' : 'alerte'}">${ic[r.status]}</span><div class="main"><div class="t1 clamp2">${L.esc(r.label)}</div><div class="t2 clamp2">${L.mText(r.detail)}</div></div><span class="end">${short(r)}</span></div>`).join('')}</div>`;
  done(el);
}
/* ── E1 · Watchlist ── */
function renderE1() {
  const el = document.getElementById('e1'); const d = S.data.dash; if (!el || !d) return;
  const pa = S.data.palerts || [];
  const rows = (d.watchlist || []).slice(0, 5);
  const near = w => {
    const as = pa.filter(a => a.ticker === w.ticker && a.kind !== 'move' && w.price);
    if (!as.length) return '';
    const a = as.sort((x, y) => Math.abs(x.value / w.price - 1) - Math.abs(y.value / w.price - 1))[0];
    return `alerte ${F.cur(a.value, w.currency, 0)} · ${F.pct((a.value / w.price - 1) * 100, 1)}`;
  };
  el.innerHTML = `<div class="w-h"><h2>Watchlist</h2><div class="r"><a class="lnk" href="#/veille/watchlist">Gérer</a></div></div>
    ${rows.length ? rows.map(w => `<div class="li"><div class="main"><div class="t1 ell">${L.esc(w.name)}</div><div class="t2">${L.esc(w.ticker)}${near(w) ? ' · ' + near(w) : w.to_target_pct != null ? ' · cible ' + F.pct(w.to_target_pct, 1) : ''}</div></div>
      <span class="only-d">${C.spark(w.spark, { w: 56, h: 18 })}</span><div class="end"><div>${F.cur(w.price, w.currency)}</div><div class="${L.cls(w.change_pct_day)}" style="font-size:12px">${F.pct(w.change_pct_day, 1)}</div></div></div>`).join('')
      : '<div class="empty">Aucune valeur suivie.<br><a class="lnk" href="#/veille/watchlist">Ajouter une valeur</a></div>'}
    ${rows.length ? '<div class="w-f"><a class="lnk" href="#/veille/watchlist">' + L.icon('plus') + 'Ajouter une valeur</a></div>' : ''}`;
  done(el);
}
/* ── A6 · Comptes : où est l'argent, et l'état de chaque connexion ── */
function renderA6() {
  const el = document.getElementById('a6'); const p = L.data.portfolio; if (!el || !p || p.empty) return;
  const acc = {};
  (p.positions || []).forEach(x => { const a = acc[x.account] = acc[x.account] || { v: 0, n: 0 }; a.v += x.value; a.n += 1; });
  const tot = Object.values(acc).reduce((t, a) => t + a.v, 0) || 1;
  const rows = Object.entries(acc).sort((a, b) => b[1].v - a[1].v);
  const wl = S.data.dash && S.data.dash.patrimoine;
  el.innerHTML = `<div class="w-h"><h2>Comptes</h2><div class="r"><a class="lnk" href="#/reglages">Connexions</a></div></div>
    ${rows.map(([k, a]) => `<div class="acc-r"><div class="acc-n"><b>${L.esc(k)}</b><span class="note">${a.n} ligne${a.n > 1 ? 's' : ''}</span></div>
      <div class="acc-v"><span class="m">${L.m(F.eur(a.v, 0))}</span><span class="note">${F.n(a.v / tot * 100, 1)} %</span></div>
      <div class="acc-b" aria-hidden="true"><i style="width:${(a.v / tot * 100).toFixed(1)}%"></i></div></div>`).join('')}
    ${wl ? `<a class="acc-w" href="#/portefeuille/patrimoine"><span>Patrimoine net, tout compris</span><b class="m">${L.m(F.eur(wl.net, 0))}</b></a>`
      : rows.length < 2 ? '<p class="note" style="margin-top:auto;padding-top:8px">Un compte eToro ? Connectez-le dans Réglages, en lecture seule. Livrets, immobilier, crédits : <a class="lnk" href="#/portefeuille/patrimoine">Patrimoine</a>.</p>' : ''}`;
  done(el);
}

/* ── I1 · Initiés : grands fonds, dirigeants et élus sur vos valeurs ── */
function loadI1(force = false, n = 0) {
  L.get('/api/insiders', 60000, force).then(x => {
    S.data.ins = x; renderI1();
    if (x.pending && n < 40 && document.getElementById('i1')) setTimeout(() => { if (document.getElementById('i1')) loadI1(true, n + 1); }, 8000);
  }).catch(e => { const el = document.getElementById('i1'); if (el && el.querySelector('.sk')) { el.innerHTML = L.errBox(e, 'dash'); done(el); } });
}
function renderI1() {
  const el = document.getElementById('i1'); const d = S.data.ins; if (!el || !d || !L.insidersCard) return;
  el.innerHTML = `<div class="w-h"><h2>Initiés</h2><div class="r"><a class="lnk" href="#/inities/pistes">Ouvrir</a></div></div>${L.insidersCard(d)}
    <p class="note" style="margin-top:auto;padding-top:8px">Grands fonds, dirigeants, élus : déclarations officielles, publiées avec un délai légal.</p>`;
  done(el);
}
/* ── E2 · Veille ── */
function renderE2() {
  const el = document.getElementById('e2'); const d = S.data.dash; if (!el || !d) return;
  const sup = (d.entrees || []).filter(e => e.kind === 'supply').slice(0, 4);
  const rup = (d.entrees || []).filter(e => e.kind === 'rupture').slice(0, 3);
  const pol = (S.data.pol?.entries || []).filter(e => (e.held || []).length).slice(0, 3);
  const heldN = e => (e.candidats || []).filter(c => c.held).length;
  el.innerHTML = `<div class="w-h"><h2>Veille</h2><div class="r"><a class="lnk" href="#/veille/offre-demande">Ouvrir</a></div></div>
  <div class="three">
    <div><div class="k-l" style="margin-bottom:6px">Tensions offre / demande</div>${sup.map(e => `<a class="li click" href="#/veille/offre-demande"><div class="main"><div class="t1 ell">${L.esc(e.label)}${heldN(e) ? ' <span class="tag held">détenu</span>' : ''}</div>
      <div class="meter" style="margin-top:5px"><div class="gauge"><i style="width:${e.tension}%"></i></div><span style="font-size:12px;font-weight:700;color:var(--violet)">${e.tension}</span></div></div></a>`).join('') || '<div class="empty">—</div>'}</div>
    <div><div class="k-l" style="margin-bottom:6px">Ruptures proches</div>${rup.map(e => `<a class="li click" href="#/veille/ruptures"><div class="main"><div class="t1 ell">${L.esc(e.label)}</div><div class="t2">${L.esc(e.horizon)}${heldN(e) ? ` · ${heldN(e)} valeur${heldN(e) > 1 ? 's' : ''} détenue${heldN(e) > 1 ? 's' : ''}` : ''}</div></div></a>`).join('') || '<div class="empty">—</div>'}</div>
    <div><div class="k-l" style="margin-bottom:6px">Politique : vos lignes touchées</div>${pol.map(e => `<a class="li click" href="#/veille/politique"><div class="main"><div class="t1 ell">${L.esc(e.label)}</div><div class="t2 ell">${L.esc((e.held || []).slice(0, 3).join(', '))}</div></div></a>`).join('') || '<div class="empty">Aucun dossier ne touche vos lignes.</div>'}</div>
  </div>`;
  done(el);
}

document.addEventListener('lumio:stale', () => { if (document.getElementById('a1') && S.data.dash) renderA1(); });

/* « Suivre » une entrée possible (module ou tiroir) : ajoutée à la watchlist */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-sfollow]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try {
    await L.api('/api/watchlist', { method: 'POST', body: { ticker: b.dataset.sfollow, name: b.dataset.fname || '' } });
    L.toast('Ajoutée à la watchlist');
    b.replaceWith(Object.assign(document.createElement('span'), { className: 'tag', textContent: 'suivie' }));
    L.forget('/api/signals'); L.forget('/api/watchlist');
  } catch (err) { L.toast(err.message, true); }
});

/* ── Sections repliables : la synthèse à retenir quand la section est repliée ── */
function toggleSec(sec) {
  const cl = closedSecs(); cl[sec] = !cl[sec]; L.store.set('dash.closed', cl);
  const el = document.querySelector(`.dsec[data-sec="${sec}"]`); if (!el) return;
  el.classList.toggle('closed', !!cl[sec]);
  el.querySelector('.dsec-b')?.setAttribute('aria-expanded', String(!cl[sec]));
  const sum = document.getElementById('dsum-' + sec); if (sum) sum.hidden = !cl[sec];
  renderSums();
  if (!cl[sec]) {                       // dépliée : les graphiques reprennent leur vraie largeur
    if (sec === layoutSec('b1')) renderB1(false);
    if (sec === layoutSec('c1')) renderC1();
  }
}
const layoutSec = id => { const l = layout(); return Object.keys(l.order).find(k => l.order[k].includes(id)); };
const chip = (txt, cls = '') => `<span class="ds-c ${cls}">${txt}</span>`;
function sumOf(sec) {
  const d = S.data.dash; const k = d?.kpis || {}; const p = per(); const dl = periodDelta(); const out = [];
  if (sec === 'pf') {
    if (k.total_value != null) out.push(chip(`<b>${L.m(F.eur(k.total_value, 0))}</b>`));
    if (dl.ready) out.push(chip(`${L.delta(dl.eur, F.pct(dl.pct, p === '1d' ? 2 : 1))} ${PLABEL[p]}`));
    if (k.total_pnl != null) out.push(chip(`plus-value ${L.m(`<span class="${L.cls(k.total_pnl)}">${F.eurS(k.total_pnl, 0)}</span>`)}`));
    const pf = S.data.perf?.performance;
    if (pf?.available && pf.benchmark?.twr != null) out.push(chip(`vs ${L.esc(pf.benchmark.label)} <span class="${L.cls(pf.twr - pf.benchmark.twr)}">${F.pt((pf.twr - pf.benchmark.twr) * 100, 1)}</span>`));
  } else if (sec === 'matin') {
    const mt = L.matin?.data();
    if (mt && !mt.empty) {
      const n = (mt.queue || []).length;
      out.push(chip(n ? `<b>${n}</b> décision${n > 1 ? 's' : ''} à traiter` : 'rien à trancher', n ? 'warn' : ''));
      if (mt.cash?.known && mt.cash.to_place > 0) out.push(chip(`à placer ${L.m(F.eur(mt.cash.to_place, 0))}`));
      if (mt.know?.headline) out.push(chip(L.esc(mt.know.headline)));
    }
  } else if (sec === 'news') {
    const n = d?.decisions_urgent ?? (d?.decisions || []).filter(x => x.kind === 'alerte').length;
    if (d) out.push(chip(n ? `<b>${n}</b> à trancher` : 'rien à trancher', n ? 'warn' : ''));
    const sg = S.data.sig;
    if (sg) {
      if (sg.exits.length) out.push(chip(`<b>${sg.exits.length}</b> ligne${sg.exits.length > 1 ? 's' : ''} à réexaminer`, 'out'));
      const ne = sg.entries.filter(e => !e.held).length;
      if (ne) out.push(chip(`<b>${ne}</b> entrée${ne > 1 ? 's' : ''} à étudier`, 'in'));
    }
    const ev = (d?.calendar || [])[0];
    if (ev) out.push(chip(`prochain : ${L.esc(ev.name)}, ${L.esc((TYPE_LBL[ev.type] || ev.label || '').toLowerCase())} ${F.inDays(ev.date)}`));
  } else if (sec === 'perf') {
    const pf = S.data.perf?.performance; const h = S.data.hist;
    const r = pf?.available ? pf.twr * 100 : h?.change_pct;
    if (r != null) out.push(chip(`${PSHORT[p]} ${L.delta(r, F.pct(r, 1))}`));
    const mdd = pf?.max_drawdown ?? k.max_drawdown, vol = pf?.volatility ?? k.volatility;
    if (mdd != null) out.push(chip(`pire baisse <span class="dn">${F.fr(mdd, 1)}</span>`));
    if (vol != null) out.push(chip(`volatilité ${F.frU(vol, 1)}`));
  } else if (sec === 'state') {
    if (d?.health?.score != null) out.push(chip(`santé <b>${d.health.score}</b>/100`));
    const acc = new Set((L.data.portfolio?.positions || []).map(x => x.account));
    if (acc.size) out.push(chip(`${acc.size} compte${acc.size > 1 ? 's' : ''}`));
    if (k.dividends_ttm != null) out.push(chip(`dividendes 12 mois ${L.m(F.eur(k.dividends_ttm, 0))}`));
  }
  return out.join('');
}
function renderSums() {
  const cl = closedSecs();
  document.querySelectorAll('.dsec-sum').forEach(el => {
    const sec = el.id.replace('dsum-', '');
    if (!cl[sec]) return;
    el.innerHTML = sumOf(sec) || '<span class="ds-c">Section repliée</span>';
  });
}

/* ── S1 · Sortir ou entrer : vos lignes à réexaminer, les entrées possibles à étudier ── */
function loadSignals(force = false, n = 0) {
  L.get('/api/signals', 60000, force).then(x => {
    S.data.sig = x; renderS1(); renderSums();
    if (L.store.get('dash.c1sig', false)) renderC1();
    if (x.insiders_pending && n < 30 && document.getElementById('dash')) setTimeout(() => { if (document.getElementById('dash')) { L.forget('/api/signals'); loadSignals(true, n + 1); } }, 10000);
  }).catch(e => { const el = document.getElementById('s1'); if (el && el.querySelector('.sk')) { el.innerHTML = L.errBox(e, 'dash'); done(el); } });
}
const sigChips = (ss, side, max = 3) => (ss || []).slice(0, max).map(x => `<span class="tag sg-${side}" title="${L.esc(x.text)}">${L.mText(x.text)}</span>`).join('')
  + ((ss || []).length > max ? `<span class="tag">+${ss.length - max}</span>` : '');
const sigScore = (n, side) => `<span class="score sg-${side}${n >= 45 ? ' hi' : ''}" title="Force des signaux réunis, sur 100">${n}</span>`;
function renderS1() {
  const el = document.getElementById('s1'); const d = S.data.sig; if (!el || !d) return;
  const ex = d.exits || [], en = (d.entries || []).filter(e => !e.held), re = (d.entries || []).filter(e => e.held);
  const exRow = e => `<div class="li click sg-row" data-sig="${L.esc(e.uid)}" data-side="out" role="button" tabindex="0"><span class="st alert" aria-hidden="true">▼</span>
    <div class="main"><div class="t1 ell">${L.esc(e.name)} <span class="muted sg-w">${F.pctU(e.weight, 1)}</span></div><div class="sg-ch">${sigChips(e.signals, 'out')}</div></div>${sigScore(e.score, 'out')}</div>`;
  const enRow = e => `<div class="li click sg-row" data-sig="${L.esc(e.key)}" data-side="in" role="button" tabindex="0"><span class="st ok" aria-hidden="true">▲</span>
    <div class="main"><div class="t1 ell">${L.esc(e.name)}${e.ticker ? ` <span class="muted sg-w">${L.esc(e.ticker)}</span>` : ''}${e.held ? ' <span class="tag held">détenue</span>' : e.watch ? ' <span class="tag">suivie</span>' : e.ticker ? ` <button class="lnk sg-f" data-sfollow="${L.esc(e.ticker)}" data-fname="${L.esc(e.name)}" aria-label="Suivre ${L.esc(e.name)}">Suivre</button>` : ''}</div>
      <div class="sg-ch">${sigChips(e.signals, 'in')}${e.rupture ? `<span class="tag v">${L.esc(e.rupture)}</span>` : ''}</div></div>${sigScore(e.score, 'in')}</div>`;
  el.innerHTML = `<div class="w-h"><h2>Sortir ou entrer ?</h2><div class="r"><a class="lnk" href="#/decisions">Bureau de décision</a></div></div>
    <div class="sg-cols">
      <div class="sg-col"><div class="sg-h out"><b>À réexaminer</b><span>vos lignes, signaux de sortie</span></div>
        ${ex.length ? ex.slice(0, 5).map(exRow).join('') : '<div class="empty">Aucun signal de sortie sur vos lignes : ni seuil franchi, ni actualité défavorable importante.</div>'}</div>
      <div class="sg-col"><div class="sg-h in"><b>À étudier</b><span>entrées possibles, signaux d'entrée</span></div>
        ${en.length ? en.slice(0, 5).map(enRow).join('') : `<div class="empty">${d.insiders_pending ? 'Lecture des déclarations d\'initiés en cours…' : 'Aucun signal d\'entrée fort pour l\'instant. Fixez un prix visé dans la watchlist pour être prévenu.'}</div>`}
        ${re.length ? `<div class="k-l sg-sub">Renforcer ? <span class="muted">vos lignes avec des signaux d'entrée</span></div>${re.slice(0, 2).map(enRow).join('')}` : ''}</div>
    </div>
    <p class="note" style="margin-top:auto;padding-top:10px">Signaux datés et sourcés (vos règles, actualités, dirigeants, élus américains, grands fonds, prix visés de la watchlist, pépites des ruptures), à vérifier : ni un conseil, ni une recommandation. ${L.coarse ? 'Touchez' : 'Cliquez sur'} une ligne pour le détail ; la carte du portefeuille les montre avec « Signaux ».</p>`;
  done(el);
}
function openSignal(key, side) {
  const d = S.data.sig; if (!d) return;
  const e = side === 'out' ? (d.exits || []).find(x => x.uid === key) : (d.entries || []).find(x => x.key === key);
  if (!e) return;
  const rows = e.signals.map(x => `<li><span class="sg-dot ${side}"></span><div><div>${L.mText(x.text)}</div>${x.link ? `<a class="lnk" href="${x.link.startsWith('#') ? L.esc(x.link) : L.url(x.link)}"${x.link.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${x.link.startsWith('#') ? 'Voir la source dans LUMIO' : 'Lire la source'}</a>` : ''}</div></li>`).join('');
  const mo = e.momentum ? `<p class="note">Cours : ${F.pct(e.momentum.m3, 0)} sur 3 mois, ${F.pct(e.momentum.y1, 0)} sur 1 an.</p>` : '';
  L.drawer.open('detail', {
    narrow: true, title: L.esc(e.name),
    sub: `${side === 'out' ? 'À réexaminer' : e.held ? 'À renforcer ?' : 'Entrée possible à étudier'} · force ${e.score}/100${e.ticker ? ' · ' + L.esc(e.ticker) : ''}`,
    html: `<ul class="sg-list">${rows}</ul>${mo}${e.rupture ? `<p class="note">Rupture : ${L.esc(e.rupture)}.</p>` : ''}
      <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap">
        ${e.uid ? `<button class="btn p" data-pos="${L.esc(e.uid)}">Voir la fiche</button>` : ''}
        ${side === 'out' && e.uid ? `<button class="btn" data-sim="sell" data-sim-uid="${L.esc(e.uid)}">${L.icon('spark')}Simuler la vente</button>` : ''}
        ${side === 'in' && (e.uid || e.ticker) ? `<button class="btn" data-sim="buy" data-sim-uid="${L.esc(e.uid || '')}" data-sim-tk="${L.esc(e.ticker || '')}" data-sim-name="${L.esc(e.name)}">${L.icon('spark')}Simuler un achat</button>` : ''}
        ${side === 'out' ? '<a class="btn" href="#/decisions/dossiers">Trancher dans le bureau de décision</a>' : ''}
        ${side === 'in' && !e.held && !e.watch && e.ticker ? `<button class="btn" data-sfollow="${L.esc(e.ticker)}" data-fname="${L.esc(e.name)}">${L.icon('plus')}Suivre dans la watchlist</button>` : ''}
        ${side === 'in' ? '<a class="btn g" href="#/inities/pistes">Pistes des initiés</a>' : ''}</div>
      <p class="guard">Des faits à vérifier, pas un conseil : LUMIO ne passe aucun ordre.</p>`,
  });
}

L.views.accueil = {
  render(root) { S.root = root; S.data = {}; S.b2tab = 'todo'; shell(root); load(false); },
  refresh() { if (!document.getElementById('dash') || L.dashEdit?.on) return; return load(true); },
};
/* Pour le mode édition (dash-edit.js) : disposition, modules, rendu d'un module */
L.dash = {
  MODS, SECN, layout, szOf, leadOf,
  save(l) { L.store.set('dash.layout', l); },
  reset() { L.store.set('dash.layout', null); if (S.root && document.getElementById('dash')) { shell(S.root); load(false); } },
  rerender(id) { ({ b1: () => renderB1(false), c1: renderC1, d2: renderD2, s1: () => (S.data.sig ? renderS1() : loadSignals()), b2: renderB2, e2: renderE2 })[id]?.(); if (/^m\d$/.test(id) && L.matin) L.matin.render(id); },
  refill() { if (S.root && document.getElementById('dash')) { shell(S.root); load(false); } },
  customize: () => openCustomize(),
};
})();
