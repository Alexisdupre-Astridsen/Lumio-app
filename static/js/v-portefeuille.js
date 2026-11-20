/* LUMIO — Portefeuille, au format Trade Republic : grande valeur, courbe à balayer, périodes ;
   puis positions en liste triable ou en carte (treemap), performance, revenus, analyse, opérations. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const PERIODS = [['1d', '1J'], ['1w', '1S'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1A'], ['max', 'Max']];
const PLABEL = { '1d': "aujourd'hui", '1w': 'sur 1 semaine', '1m': 'sur 1 mois', ytd: 'depuis le 1er janvier', '1y': 'sur 1 an', max: 'depuis le début' };
const SUBS = [['positions', 'Positions'], ['performance', 'Performance'], ['revenus', 'Revenus'], ['analyse', 'Analyse'], ['patrimoine', 'Patrimoine'], ['operations', 'Opérations']];
const S = { chart: null, hist: null };
const hper = () => L.period();                 // période commune à toutes les vues
const view = () => L.store.get('pf.view', 'liste');
const metric = () => L.store.get('pf.metric', 'jour');
const sortK = () => L.store.get('pf.sort', ['value', -1]);
const groupBy = () => L.store.get('pf.group', 'none');
L.pf = L.pf || {};

document.addEventListener('lumio:period', () => {
  if (!document.getElementById('pfHead')) return;
  const p = L.data.portfolio; if (p && !p.empty) heroText(p);
  loadCurve(false, true);
});
function shell(root, sub) {
  root.innerHTML = `<section class="pf-head" id="pfHead">
      <h1 class="hero-l">Portefeuille<span class="hero-at" id="pfAt"></span></h1>
      <div class="hero-v m" id="pfVal" data-hero>${L.skel(48, '260px')}</div>
      <div class="hero-d" id="pfDelta">&nbsp;</div>
      <div class="pf-chart" id="pfChart" style="min-height:210px"></div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px" id="pfPerRow">
        ${L.perSeg('', 'pfPer')}
        <span class="note" id="pfPerTxt" style="font-size:13px"></span>
        <button class="lnk ia" id="pfExplain">${L.icon('spark')} Expliquer</button>
      </div>
    </section>
    <nav class="subnav" aria-label="Sections du portefeuille">${SUBS.map(([k, l]) => `<a href="#/portefeuille/${k}" data-sub="${k}" class="${k === sub ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="pfSub"></div>`;
  L.on(root, 'click', '#pfExplain', () => L.explainIA(hper()));
  L.on(root, 'dblclick', '#pfVal', () => L.togglePriv());
}

/* ── En-tête : valeur + courbe + balayage ── */
/* La vue a pu changer pendant un chargement (rafraîchissement de 60 s) : écriture seulement si
   l'élément existe encore */
const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; return el; };
/* Variation affichée sous la valeur : celle de la période choisie (1J, 1S, 1M…), comme dans l'app */
const pDelta = p => {
  const per = hper(), h = S.hist;
  if (per === '1d' || !h || h.range !== per) return per === '1d' || !h ? { eur: p.day_change_eur, pct: p.day_change_pct, lbl: "aujourd'hui", ready: per === '1d' } : { ready: false };
  const br = L.bridge(h, per, p.total_value);         // 7.9 : même pont que l'accueil
  if (br && br.pct != null) return { eur: br.gain, pct: br.pct, lbl: PLABEL[per], ready: true, br };
  return { eur: h.change_eur, pct: h.change_pct, lbl: PLABEL[per], ready: true };
};
L.pfMini = () => {
  const p = L.data.portfolio; if (!p || p.empty) return '';
  const d = pDelta(p);
  return `${L.m(F.eur(p.total_value, 0))} ${d.ready ? `<span class="${L.cls(d.eur)}">${L.arrow(d.eur)} ${F.pct(d.pct, hper() === '1d' ? 2 : 1)}</span>` : ''}<span class="muted">${PLABEL[hper()]}</span>`;
};
/* Grand chiffre : la valeur actuelle ; la valeur au début de la période, en information */
function heroText(p) {
  put('pfVal', L.heroVal(p.total_value));
  put('pfAt', '');
  const d = pDelta(p);
  put('pfDelta', `${d.ready ? `${L.delta(d.eur, `${L.m(F.eurS(d.eur, 2))} (${F.pct(d.pct, hper() === '1d' ? 2 : 1)})`)} <span class="muted">${d.lbl}</span>`
    : `<span class="muted">calcul ${PLABEL[hper()]}…</span>`}${d.br ? ` <span class="muted hero-was" title="${L.esc(L.BRIDGE_TIP)}"><span class="sep">· </span>${L.bridgeText(d.br, hper())}</span>` : ''}`);
}
async function loadHead(force) {
  try {
    const p = await L.loadPortfolio(force);
    if (p.empty) { put('pfHead', `<div class="callout">${L.esc(p.help)}</div>`); return; }
    heroText(p);
    const v = document.getElementById('pfVal'); if (v) L.watchHero(v, L.pfMini);
  } catch (e) { put('pfHead', L.errBox(e)); }
}
async function loadCurve(force = false, animate = true) {
  const per = hper();
  const box = document.getElementById('pfChart'); if (!box) return;
  if (S.hist) box.setAttribute('aria-busy', 'true');
  try {
    const h = await L.get(`/api/portfolio/history?range=${per}`, 50000, force);
    box.removeAttribute('aria-busy');
    if (per !== hper() || !box.isConnected) return;
    S.hist = h;
    const pts = h.points || [];
    const t = pts.map(x => x.t), v = pts.map(x => x.value), inv = pts.map(x => x.invested);
    const base = h.reference === 'prev_close' ? inv[0] : v[0];
    const col = (v[v.length - 1] ?? 0) >= base ? L.P.up : L.P.down;
    const intra = per === '1d' || per === '1w';
    const p0 = L.data.portfolio;
    if (p0 && !p0.empty) { heroText(p0); L.watchHero(document.getElementById('pfVal'), L.pfMini); }
    // Sous la courbe : la séance du jour (si une autre période est affichée) et la méthode de calcul
    put('pfPerTxt', [per !== '1d' && p0 && p0.day_change_eur != null ? `<span class="muted">Aujourd'hui</span> ${L.delta(p0.day_change_eur, `${L.m(F.eurS(p0.day_change_eur, 2))} (${F.pct(p0.day_change_pct)})`)}` : '',
      h.method === 'twr' ? 'variation hors versements' : '', h.mwr != null && per === 'max' ? `XIRR ${F.fr(h.mwr, 1)}/an` : '',
      h.approx ? '<span class="tag warn">estimée</span>' : ''].filter(Boolean).join(' · '));
    const p = L.data.portfolio;
    S.chart = C.line(box, {
      t, h: window.innerWidth < 720 ? 190 : 230, animate, money: true, label: 'Valeur du portefeuille ' + PLABEL[per],
      series: [{ v, color: col, w: 2, area: true }, ...(h.reference !== 'prev_close' ? [{ v: inv, color: L.P.ink2, w: 1.1, dash: '4 4', opacity: .55, noScale: per !== 'max' }] : [])],
      ref: h.reference === 'prev_close' ? { v: inv[0], label: 'clôture veille' } : null,
      fmtY: x => F.k(x), fmtX: t => per === '1d' ? F.time(t) : per === 'max' || per === '1y' ? F.mon(new Date(t * 1000).toISOString().slice(0, 7)) : F.dshort(t),
      onScrub: i => {
        if (i == null) { if (p) heroText(p); return; }
        // 1J : écart à la référence du moment (clôture de la veille + achats du jour)
        const ref = h.reference === 'prev_close' ? inv[i] : base;
        const dv = v[i] - ref;
        put('pfVal', L.heroVal(v[i]));
        put('pfDelta', `${L.delta(dv, `${L.m(F.eurS(dv, 2))} (${F.pct(ref ? dv / ref * 100 : null)})`)} <span class="muted">${intra ? F.dshort(t[i]) + ' ' + F.time(t[i]) : F.date(t[i])}</span>`);
      },
    });
  } catch (e) { box.removeAttribute('aria-busy'); box.innerHTML = L.errBox(e); }
}

/* ── Positions ── */
const COLS = {
  name: p => p.name.toLowerCase(), value: p => p.value, weight: p => p.weight, day: p => p.change_pct_day ?? -1e9,
  dayeur: p => p.day_pnl ?? -1e9, pv: p => p.pnl_pct, pveur: p => p.pnl, per: p => (p.perf || {})[L.perKey(hper())] ?? -1e9,
};
function filtered(p) {
  const q = (S.q || '').toLowerCase(); const ty = S.type || 'all'; const acc = S.acc || 'all';
  return p.positions.filter(x => (!q || (x.name + ' ' + (x.ticker || '') + ' ' + x.isin + ' ' + x.sector).toLowerCase().includes(q))
    && (ty === 'all' || x.asset_type === ty) && (acc === 'all' || x.account === acc));
}
function positionsTab(el) {
  const p = L.data.portfolio;
  if (!p || p.empty) { el.innerHTML = p ? `<div class="callout">${L.esc(p.help)}</div>` : L.skel(300); return; }
  const accounts = [...new Set(p.positions.map(x => x.account))];
  const types = [...new Set(p.positions.map(x => x.asset_type))];
  el.innerHTML = `<div class="toolbar">
      <label class="search">${L.icon('search')}<input class="inp" id="posQ" type="search" placeholder="Nom, ticker ou ISIN" value="${L.esc(S.q || '')}" aria-label="Rechercher"></label>
      <div class="chips" role="group" aria-label="Type d'actif"><button class="chip ${(S.type || 'all') === 'all' ? 'on' : ''}" data-ty="all">Tout</button>${types.map(t => `<button class="chip ${S.type === t ? 'on' : ''}" data-ty="${L.esc(t)}">${L.esc(t === 'Action' ? 'Actions' : t)}</button>`).join('')}</div>
      ${accounts.length > 1 ? `<select class="sel" id="posAcc" style="width:auto;height:36px" aria-label="Compte"><option value="all">Tous les comptes</option>${accounts.map(a => `<option ${S.acc === a ? 'selected' : ''}>${L.esc(a)}</option>`).join('')}</select>` : ''}
      <span class="grow"></span>
      <div class="seg" role="group" aria-label="Affichage"><button data-view="liste" class="${view() === 'liste' ? 'on' : ''}" aria-pressed="${view() === 'liste'}">${L.icon('list')} Liste</button><button data-view="carte" class="${view() === 'carte' ? 'on' : ''}" aria-pressed="${view() === 'carte'}">${L.icon('map')} Carte</button></div>
    </div>
    <div class="toolbar" style="margin-top:-4px">
      <div class="seg sm" role="group" aria-label="Variation affichée"><button data-metric="jour" class="${metric() === 'jour' ? 'on' : ''}" aria-pressed="${metric() === 'jour'}">Jour</button><button data-metric="per" class="${metric() === 'per' ? 'on' : ''}" aria-pressed="${metric() === 'per'}">${({ '1w': '1 semaine', '1m': '1 mois', ytd: 'Depuis janv.', '1y': '1 an' })[L.perKey(hper())]}</button><button data-metric="pv" class="${metric() === 'pv' ? 'on' : ''}" aria-pressed="${metric() === 'pv'}">Plus-value</button></div>
      ${view() === 'liste' ? `<label class="note only-d" style="display:flex;align-items:center;gap:8px">Regrouper <select class="sel" id="posGroup" style="width:auto;height:30px;font-size:12.5px"><option value="none">non</option><option value="sector" ${groupBy() === 'sector' ? 'selected' : ''}>par secteur</option><option value="asset_type" ${groupBy() === 'asset_type' ? 'selected' : ''}>par type</option><option value="account" ${groupBy() === 'account' ? 'selected' : ''}>par compte</option></select></label>` : ''}
      <span class="grow"></span><button class="btn sm g" data-goops>${L.icon('plus')}Ajouter une opération</button>
    </div>
    <div id="posBody"></div>`;
  const body = document.getElementById('posBody');
  const draw = () => view() === 'carte' ? drawMap(body, p) : drawList(body, p);
  draw();
  document.getElementById('posQ').addEventListener('input', L.debounce(e => { S.q = e.target.value; draw(); }, 120));
  L.on(el, 'click', '[data-ty]', (e, b) => { S.type = b.dataset.ty; positionsTab(el); });
  L.on(el, 'change', '#posAcc', (e, s) => { S.acc = s.value; draw(); });
  L.on(el, 'change', '#posGroup', (e, s) => { L.store.set('pf.group', s.value); draw(); });
  L.on(el, 'click', '[data-view]', (e, b) => { L.store.set('pf.view', b.dataset.view); compact(); positionsTab(el); });
  L.on(el, 'click', '[data-metric]', (e, b) => { L.store.set('pf.metric', b.dataset.metric); positionsTab(el); });
  L.on(el, 'click', 'th[data-sort]', (e, th) => { const [k, d] = sortK(); L.store.set('pf.sort', [th.dataset.sort, k === th.dataset.sort ? -d : (th.dataset.sort === 'name' ? 1 : -1)]); draw(); });
  L.on(el, 'click', '[data-goops]', () => L.router.go('portefeuille', 'operations'));
}
function drawMap(body, p) {
  const items = filtered(p).map(x => ({ ...x, short: x.name.replace(/\s*\(.*\)/, ''), tk: (x.ticker || '').split(/[.-]/)[0] }));
  const m = metric(); const pk = L.perKey(hper());
  const tmM = m === 'pv' ? 'pv' : m === 'per' ? 'per' : 'jour';
  const rk = tmM === 'jour' ? '1d' : tmM === 'pv' ? 'max' : pk;       // analyse de la carte (survol) sur la même période
  body.innerHTML = `<div class="w" style="padding:14px"><div id="pfMap"></div><div id="pfMapLeg"></div>
    <p class="note" style="margin-top:6px">Surface = poids dans le portefeuille (${items.length} lignes, ${L.m(F.eur(items.reduce((a, x) => a + x.value, 0), 0))}) ; couleur = ${tmM === 'pv' ? 'plus-value latente' : tmM === 'per' ? 'variation du cours sur la période' : 'variation du jour'}. ${L.coarse ? "Touchez une case pour voir pourquoi elle bouge et ce qu'elle vaut." : "Survolez une case pour voir pourquoi elle bouge et ce qu'elle vaut, cliquez pour ouvrir la fiche."}</p></div>`;
  if (S.map) S.map.destroy();
  const mob = window.innerWidth < 720;
  const draw = flags => {
    const nd = L.newsDots(flags);
    if (S.map) S.map.destroy();
    S.map = C.treemap(document.getElementById('pfMap'), items, { h: mob ? 440 : 560, group: 'sector', minShare: mob ? 0.025 : 0.012,
      color: x => L.tmColor(x, tmM, pk), tip: x => L.whyHtml(x, rk, { nd }), onClick: uid => L.router.setParam('p', uid),
      onPeek: uid => { const x = items.find(i => String(i.uid) === uid); if (x) L.openPeek(x, rk, nd); },
      dots: c => c.uid === c.isin ? nd.by[c.isin] : null, dotTip: (k, uid) => L.newsTip(nd, k, uid), onDot: k => L.openNews(nd, k, () => draw(flags)) });
    const unknown = items.some(x => L.tmColor(x, tmM, pk).cls === 'qna');
    document.getElementById('pfMapLeg').innerHTML = C.qLegend(L.tmQ(tmM, pk), '%',
      [C.treemap.enlarged ? `Lignes de moins de ${mob ? '2,5' : '1,2'} % agrandies pour rester lisibles` : '',
       unknown ? 'hachuré : variation inconnue (cours indisponible)' : ''].filter(Boolean).join(' · ')) + L.newsLegend(nd);
  };
  draw(S.newsFlags || []);
  if (L.loadMap) L.loadMap(rk).catch(() => {});
  const gen = S.mapGen = (S.mapGen || 0) + 1;       // filtre changé pendant la requête : on ne redessine pas l'ancienne carte
  L.get('/api/news/flags', 60000).then(r => {
    S.newsFlags = r.items || [];
    if (gen === S.mapGen && document.getElementById('pfMap')) draw(S.newsFlags);
  }).catch(() => { /* carte sans points : l'analyse des actualités reprendra au prochain affichage */ });
}
function drawList(body, p) {
  const [k, dir] = sortK(); const m = metric(); const pk = L.perKey(hper());
  const rows = filtered(p).sort((a, b) => { const x = COLS[k](a), y = COLS[k](b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  const total = rows.reduce((a, x) => a + x.value, 0), tdp = rows.reduce((a, x) => a + (x.day_pnl || 0), 0), tpnl = rows.reduce((a, x) => a + x.pnl, 0), tcost = rows.reduce((a, x) => a + x.cost, 0);
  const grp = groupBy();
  const th = (key, lbl, cls = '') => `<th class="sort ${cls} ${k === key ? 'on' + (dir > 0 ? ' asc' : '') : ''}" data-sort="${key}" aria-sort="${k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${lbl}</th>`;
  const perV = x => (x.perf || {})[pk];
  const line = x => `<tr class="click" data-pos="${L.esc(x.uid)}" tabindex="0">
      <td><div class="name">${L.avatar(x.name, x.isin)}<div><div style="font-weight:600">${L.esc(x.name)}</div><div class="sub">${L.esc([x.ticker, x.sector, x.account !== 'Trade Republic' ? x.account : ''].filter(Boolean).join(' · '))}</div></div></div></td>
      <td>${L.m(F.qty(x.quantity))}</td><td>${L.m(F.eur(x.avg_cost))}</td><td>${F.cur(x.live_price || x.tr_price, x.currency)}${x.currency !== 'EUR' ? `<div class="sub">${F.eur(x.price_eur)}</div>` : ''}</td>
      <td><b>${L.m(F.eur(x.value))}</b></td><td>${F.pctU(x.weight, 1)}</td>
      <td class="${L.cls(x.change_pct_day)}">${F.pct(x.change_pct_day)}<div class="sub ${L.cls(x.day_pnl)}">${L.m(F.eurS(x.day_pnl, 2))}</div></td>
      ${m === 'per' ? `<td class="${L.cls(perV(x))}">${F.pct(perV(x), 1)}</td>` : ''}
      <td class="${L.cls(x.pnl)}">${F.pct(x.pnl_pct, 1)}<div class="sub ${L.cls(x.pnl)}">${L.m(F.eurS(x.pnl))}</div></td></tr>`;
  let tb = '';
  if (grp !== 'none') {
    const groups = {}; rows.forEach(x => { (groups[x[grp] || 'Autre'] = groups[x[grp] || 'Autre'] || []).push(x); });
    Object.entries(groups).sort((a, b) => b[1].reduce((s, x) => s + x.value, 0) - a[1].reduce((s, x) => s + x.value, 0)).forEach(([g, xs]) => {
      const gv = xs.reduce((s, x) => s + x.value, 0);
      tb += `<tr class="grp"><td colspan="${m === 'per' ? 9 : 8}">${L.esc(g)} · ${L.m(F.eur(gv, 0))} · ${F.pctU(total ? gv / p.total_value * 100 : 0, 1)}</td></tr>` + xs.map(line).join('');
    });
  } else tb = rows.map(line).join('');
  const metricOf = x => m === 'pv' ? [x.pnl_pct, F.pct(x.pnl_pct, 1), L.m(F.eurS(x.pnl))] : m === 'per' ? [perV(x), F.pct(perV(x), 1), ''] : [x.change_pct_day, F.pct(x.change_pct_day), L.m(F.eurS(x.day_pnl, 2))];
  body.innerHTML = `<div class="w pos-d" style="padding:6px 18px"><div class="tbl-wrap"><table class="tbl"><thead><tr>${th('name', 'Valeur')}<th>Qté</th><th>PRU</th><th>Cours</th>${th('value', 'Montant')}${th('weight', 'Poids')}${th('day', 'Jour')}${m === 'per' ? th('per', ({ '1w': '1 sem.', '1m': '1 mois', ytd: 'YTD', '1y': '1 an' })[pk]) : ''}${th('pv', '+/− latente')}</tr></thead>
    <tbody>${tb}</tbody><tfoot><tr><td><b>Total</b> <span class="muted">· ${rows.length} ligne${rows.length > 1 ? 's' : ''}</span></td><td></td><td></td><td></td><td><b>${L.m(F.eur(total))}</b></td><td>${F.pctU(p.total_value ? total / p.total_value * 100 : 0, 1)}</td>
    <td class="${L.cls(tdp)}">${L.m(F.eurS(tdp, 2))}</td>${m === 'per' ? '<td></td>' : ''}<td class="${L.cls(tpnl)}">${F.pct(tcost ? tpnl / tcost * 100 : 0, 1)}<div class="sub">${L.m(F.eurS(tpnl))}</div></td></tr></tfoot></table></div></div>
    <div class="pos-m">${rows.map(x => { const [v, a, b] = metricOf(x); return `<div class="li click" data-pos="${L.esc(x.uid)}" role="button" tabindex="0">${L.avatar(x.name, x.isin)}
      <div class="main"><div class="t1 ell">${L.esc(x.name)}</div><div class="t2">${F.pctU(x.weight, 1)} · ${L.m(F.qty(x.quantity) + ' part' + (x.quantity > 1 ? 's' : ''))}${x.account !== 'Trade Republic' ? ' · ' + L.esc(x.account) : ''}</div></div>
      <div class="end"><div>${L.m(F.eur(x.value))}</div><div class="${L.cls(v)}" style="font-size:12.5px">${L.arrow(v)} ${a}</div></div></div>`; }).join('')}
      <div class="li"><div class="main"><div class="t1">Total · ${rows.length} lignes</div></div><div class="end">${L.m(F.eur(total))}</div></div></div>
    <div class="sort-m only-m" style="margin-top:8px"><label class="note" style="display:flex;gap:8px;align-items:center">Trier par <select class="sel" id="sortM" style="height:32px;width:auto"><option value="value">montant</option><option value="day">variation du jour</option><option value="pv">plus-value</option><option value="weight">poids</option><option value="name">nom</option></select></label></div>`;
  const sm = document.getElementById('sortM'); if (sm) { sm.value = k in COLS ? k : 'value'; sm.onchange = () => { L.store.set('pf.sort', [sm.value, sm.value === 'name' ? 1 : -1]); drawList(body, p); }; }
}

/* ── Sous-onglets : hors Positions (et en vue Carte), en-tête compact — la courbe et son sélecteur
   de période ne répètent pas (et ne contredisent pas) ceux de la section ── */
function compact() {
  const sub = L.router.last?.sub || 'positions';
  const h = document.getElementById('pfHead'); if (!h) return;
  h.classList.toggle('compact', sub !== 'positions');                       // sections : valeur seule
  h.classList.toggle('nochart', sub === 'positions' && view() === 'carte');  // carte : sans courbe, période gardée
}
function renderSub(sub, dir) {
  const el = document.getElementById('pfSub'); if (!el) return;
  el.className = dir && !document.documentElement.classList.contains('vt-sub') ? (dir > 0 ? 'slide-r' : 'slide-l') : '';
  L.qsa('.subnav a').forEach(a => { a.classList.toggle('on', a.dataset.sub === sub); if (a.dataset.sub === sub) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const nav = document.querySelector('#pfHead + .subnav'), on = nav && nav.querySelector('a.on');   // onglet choisi visible (téléphone)
  if (on && (on.offsetLeft < nav.scrollLeft || on.offsetLeft + on.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: dir ? 'smooth' : 'auto' });
  compact();
  if (sub === 'positions') positionsTab(el);
  else if (L.pf[sub]) { el.innerHTML = `<div class="sk-on">${L.skel(260)}</div>`; L.pf[sub](el); }
}
L.views.portefeuille = {
  render(root, r) {
    const sub = SUBS.some(s => s[0] === r.sub) ? r.sub : 'positions';
    shell(root, sub);
    loadHead(false).then(() => renderSub(sub));
    loadCurve(false);
  },
  sub(r, prev) {
    const order = SUBS.map(s => s[0]);
    const sub = order.includes(r.sub) ? r.sub : 'positions';
    renderSub(sub, order.indexOf(sub) - order.indexOf(prev.sub || 'positions'));
  },
  refresh() {
    const p = L.data.portfolio; if (!p || p.empty) return;
    if (!S.chart || document.getElementById('pfVal')?.dataset.scrub !== '1') heroText(p);
    const sub = L.router.last?.sub || 'positions';
    if (sub === 'positions' && !document.querySelector('#posQ:focus')) {
      const body = document.getElementById('posBody'); if (body && view() === 'liste') drawList(body, p);
    }
    if (hper() === '1d' || hper() === '1w') return loadCurve(true, false);
  },
};
})();
