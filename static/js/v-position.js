/* LUMIO — fiche valeur : cours et courbe (PRU, achats/ventes), chiffres de la ligne,
   résultats publiés, fondamentaux, consensus, états financiers, concurrents, opérations, actus. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const RANGES = [['1d', '1J'], ['1w', '1S'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1A'], ['max', 'Max']];
const TABS = [['apercu', 'Aperçu'], ['analyse', 'Analyse'], ['ops', 'Opérations'], ['actus', 'Actus']];
const TX = { buy: 'Achat', sell: 'Vente', dividend: 'Dividende', split: 'Division', transfer_in: 'Transfert entrant', transfer_out: 'Transfert sortant', swap_in: 'Échange (entrée)', swap_out: 'Échange (sortie)', spinoff: 'Scission' };
const S = L.pos = { uid: null, data: null, range: L.store.get('pos.range', '1y'), tab: 'apercu', pv: L.store.get('pos.pv', 'px') };

L.openPosition = async (uid, fromRouter) => {
  S.uid = uid; S.tab = 'apercu'; S.peers = null; S.fin = null;
  const known = L.posByUid(uid);
  L.drawer.open('pos', { head: head(known), html: `<div class="sk-on">${L.skel(28, '50%')}<div style="height:12px"></div>${L.skel(220)}<div style="height:12px"></div>${L.skel(140)}</div>` });
  if (!fromRouter) L.router.setParam('p', uid);
  await load();
};
function head(p, q) {
  if (!p) return '<h2>Fiche valeur</h2>';
  return `<div style="display:flex;gap:12px;align-items:center">${L.avatar(p.name, p.isin)}<div style="min-width:0"><h2 class="ell">${L.esc(p.name)}</h2>
    <div class="note ell">${L.esc([p.ticker, p.isin, p.account !== 'Trade Republic' ? p.account : '', p.sector].filter(Boolean).join(' · '))}</div></div></div>`;
}
async function load(force = false) {
  const uid = S.uid;
  try {
    const d = await L.get(`/api/position/${encodeURIComponent(uid)}?range=${S.range}`, 50000, force);
    if (uid !== S.uid) return;
    S.data = d;
    const el = L.drawer.el('pos'); if (!el) return;
    el.querySelector('.dr-h .t').innerHTML = head(d.position);
    render();
  } catch (e) { const b = L.drawer.body('pos'); if (b) b.innerHTML = L.errBox(e); }
}
S.refresh = () => load(true);

function render() {
  const b = L.drawer.body('pos'); const d = S.data; if (!b || !d) return;
  b.innerHTML = `<nav class="subnav" style="margin:-6px -20px 16px;padding:0 14px" aria-label="Sections de la fiche">${TABS.map(([k, l]) => `<a href="#" data-ptab="${k}" class="${k === S.tab ? 'on' : ''}"${k === S.tab ? ' aria-current="true"' : ''}>${l}</a>`).join('')}</nav><div id="ptab"></div>`;
  L.on(b, 'click', '[data-ptab]', (e, a) => { e.preventDefault(); const prev = TABS.findIndex(t => t[0] === S.tab); S.tab = a.dataset.ptab; L.qsa('[data-ptab]', b).forEach(x => { x.classList.toggle('on', x === a); if (x === a) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); }); tab(TABS.findIndex(t => t[0] === S.tab) - prev); });
  tab(0);
}
function tab(dir) {
  const el = document.getElementById('ptab'); if (!el) return;
  el.className = dir ? (dir > 0 ? 'slide-r' : 'slide-l') : '';
  ({ apercu, analyse, ops, actus })[S.tab](el);
}

/* ── Aperçu ── */
function apercu(el) {
  const d = S.data, p = d.position, q = d.quote || {};
  const native = p.currency && p.currency !== 'EUR';
  const ra = p.year_low != null && p.year_high != null && p.year_high > p.year_low;
  const pos = ra ? Math.max(0, Math.min(100, ((p.live_price || p.tr_price) - p.year_low) / (p.year_high - p.year_low) * 100)) : 0;
  const rc = d.recap;
  el.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font:500 36px/1.05 var(--f-num);font-variation-settings:'opsz' 48;letter-spacing:-.01em;font-variant-numeric:tabular-nums">${F.cur(p.live_price || p.tr_price, p.currency)}</span>
      ${native ? `<span class="muted">${F.eur(p.price_eur)}</span>` : ''}<span class="${L.cls(p.change_pct_day)}" style="font-weight:600">${L.arrow(p.change_pct_day)} ${F.pct(p.change_pct_day)}</span>
      <span class="note">${q.market_state === 'REGULAR' ? 'séance en cours' : 'clôture'}${native ? ` · effet change inclus en € : ${F.pct(p.change_pct_day, 2)} (cours ${F.pct(p.change_pct_day_native, 2)})` : ''}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 6px">
      <div class="seg sm" role="group" aria-label="Période du cours">${RANGES.map(([k, l]) => `<button data-pr="${k}" class="${k === S.range ? 'on' : ''}" aria-pressed="${k === S.range}">${l}</button>`).join('')}</div>
      ${d.line ? `<div class="seg sm" role="group" aria-label="Courbe affichée"><button data-pv="px" class="${S.pv !== 'line' ? 'on' : ''}" aria-pressed="${S.pv !== 'line'}">Cours</button><button data-pv="line" class="${S.pv === 'line' ? 'on' : ''}" aria-pressed="${S.pv === 'line'}">Ma ligne (€)</button></div>` : ''}</div>
    <div id="pChart"></div>
    <div class="legend" id="pLeg" style="margin-top:4px"></div>
    ${d.price_source === 'tr' ? '<p class="note">Cours Trade Republic en euros (ceux de l\'app), dernière synchronisation comprise.</p>' : !(d.history || []).length ? '<p class="note">Aucun cours disponible pour cette période : relancez maj.bat pour rapatrier l\'historique Trade Republic.</p>' : ''}
    ${rc ? `<div class="sec"><h3>${L.icon('spark')} Résultats publiés ${rc.quarter ? '· ' + L.esc(rc.quarter) : ''} ${rc.ai ? '<span class="tag ai">IA</span>' : ''}</h3><div class="callout ai">${L.esc(rc.text)}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${rc.surprise_pct != null ? `<span class="tag ${rc.surprise_pct >= 0 ? 'up' : 'dn'}">BPA ${F.pct(rc.surprise_pct, 1)} vs consensus</span>` : ''}${rc.revenue_growth != null ? `<span class="tag ${rc.revenue_growth >= 0 ? 'up' : 'dn'}">Chiffre d'affaires ${F.pct(rc.revenue_growth, 1)} sur 1 an</span>` : ''}${rc.reaction_pct != null ? `<span class="tag ${rc.reaction_pct >= 0 ? 'up' : 'dn'}">Cours ${F.pct(rc.reaction_pct, 1)} depuis</span>` : ''}</div>
      <div style="margin-top:8px">${(rc.articles || []).map(a => `<a class="lnk" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer" style="display:flex;margin-top:4px">${L.esc(a.source)} · ${F.ago(a.age_h)}</a>`).join('')}</div></div></div>` : ''}
    <div class="sec"><h3>Ma ligne</h3><dl class="kv">
      <div><dt>Valeur</dt><dd>${L.m(F.eur(p.value))}</dd></div><div><dt>Poids</dt><dd>${F.pctU(p.weight, 1)}</dd></div>
      <div><dt>Quantité</dt><dd>${L.m(F.qty(p.quantity))}</dd></div><div><dt>PRU</dt><dd>${L.m(F.eur(p.avg_cost))}${native && d.pru_native ? ` <span class="muted" style="font-weight:500">(${F.cur(d.pru_native, p.currency)})</span>` : ''}</dd></div>
      <div><dt>+/− latente</dt><dd class="${L.cls(p.pnl)}">${L.m(F.eurS(p.pnl))} · ${F.pct(p.pnl_pct, 1)}</dd></div><div><dt>Gain du jour</dt><dd class="${L.cls(p.day_pnl)}">${L.m(F.eurS(p.day_pnl, 2))}</dd></div>
      <div><dt>Réalisé</dt><dd class="${L.cls(d.realized)}">${L.m(F.eurS(d.realized, 2))}</dd></div><div><dt>Dividendes reçus</dt><dd>${L.m(F.eur(d.dividends_total))}</dd></div>
      <div><dt>Frais payés</dt><dd>${L.m(F.eur(d.fees_total))}</dd></div><div><dt>Compte</dt><dd>${L.esc(d.account || p.account)} · ${L.esc(d.envelope || 'CTO')}</dd></div>
    </dl>
    ${ra ? `<div class="range" role="img" aria-label="Plage sur 52 semaines"><span class="lo">${F.cur(p.year_low, p.currency)}</span><span class="hi">${F.cur(p.year_high, p.currency)}</span><span class="band" style="left:0;width:100%"></span><span class="mk2" style="left:${pos}%"><span>cours</span></span></div><p class="note">Plage sur 52 semaines : le cours est à ${F.pctU(pos, 0)} entre le plus bas et le plus haut.</p>` : ''}</div>
    <div class="sec"><h3>${L.icon('cal')} À venir</h3>${(d.events || []).map(e => `<div class="li"><span class="datebox"><b>${F.toDate(e.date).getDate()}</b><span>${F.months[F.toDate(e.date).getMonth()]}</span></span><div class="main"><div class="t1">${L.esc(e.label)}</div><div class="t2">${F.inDays(e.date)}${e.amount_eur ? ' · ≈ ' + L.m(F.eur(e.amount_eur)) + (e.amount_kind ? ' ' + e.amount_kind : '') : ''}${e.source === 'saisie' ? ' · saisi' : ''}</div></div>${e.type === 'user_event' ? `<button class="ibtn" data-evdel="${L.esc(e.id)}" aria-label="Supprimer ${L.esc(e.label)}">${L.icon('trash')}</button>` : ''}</div>`).join('') || '<div class="note">Rien de connu dans les 120 prochains jours.</div>'}
      <details style="margin-top:8px"><summary class="lnk" style="cursor:pointer">Ajouter une assemblée générale, un split annoncé…</summary>
      <form id="evForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><select class="sel" name="kind" style="width:auto;height:36px" aria-label="Type d'événement"><option value="ag">Assemblée générale</option><option value="split">Split annoncé</option><option value="regroupement">Regroupement annoncé</option><option value="dividende">Dividende annoncé</option><option value="autre">Autre</option></select>
        <input class="inp" name="date" type="date" required style="width:auto;height:36px" aria-label="Date"><input class="inp" name="note" maxlength="200" placeholder="Précision (facultatif)" style="flex:1;min-width:140px;height:36px" aria-label="Précision">
        <button class="btn sm p" type="submit">Ajouter</button></form>
      <p class="note" style="margin-top:6px">Yahoo ne publie ni les assemblées générales ni les splits annoncés : saisis ici, ils apparaissent dans l'agenda et sont notifiés la veille.</p></details></div>
    <div class="sec"><h3>${L.icon('bell')} Alertes de cours</h3><div id="pAlerts"></div>
      <form id="paForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><select class="sel" name="kind" style="width:auto;height:36px"><option value="above">Cours au-dessus de</option><option value="below">Cours en dessous de</option><option value="move">Variation du jour ≥ (%)</option></select>
        <input class="inp" name="value" type="number" step="any" min="0" required style="width:110px;height:36px" placeholder="${F.n(p.live_price || p.tr_price, 2).replace(/ /g, '')}" aria-label="Seuil"><button class="btn sm p" type="submit">Créer</button></form>
      <p class="note" style="margin-top:6px">Seuil dans la devise de cotation (${L.esc(F.sym(p.currency))}). Vérifiée toutes les 5 minutes tant que LUMIO tourne sur le PC, même navigateur fermé : elle apparaît sous la cloche et dans « À traiter ».</p></div>
    <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-sim="sell" data-sim-uid="${L.esc(S.uid)}">${L.icon('spark')}Simuler une vente ou un renfort</button><button class="btn ia" data-ask="${L.esc(`Que dois-je savoir sur ${p.name} en ce moment ?`)}">${L.icon('spark')}Demander à l'IA sur ${L.esc(p.name)}</button></div>`;
  drawChart();
  drawAlerts();
  L.on(el, 'click', '[data-pv]', (e, b) => { S.pv = b.dataset.pv; L.store.set('pos.pv', S.pv); L.qsa('[data-pv]', el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); drawChart(); });
  L.on(el, 'click', '[data-pr]', (e, b) => { S.range = b.dataset.pr; L.store.set('pos.range', S.range); L.qsa('[data-pr]', el).forEach(x => x.classList.toggle('on', x === b)); load(); });
  const reloadPos = () => { L.forget('/api/calendar'); L.forget('/api/dashboard'); return S.refresh(); };
  const ev = document.getElementById('evForm');
  if (ev) ev.onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    try {
      await L.api('/api/events', { method: 'POST', body: { kind: fd.get('kind'), date: fd.get('date'), note: fd.get('note'), uid: S.uid, name: p.name } });
      L.toast('Événement ajouté à l\'agenda'); await reloadPos();
    } catch (err) { L.toast(err.message, true); }
  };
  L.on(document.getElementById('dr-pos') || document.body, 'click', '[data-evdel]', async (e, b) => {
    try { await L.api('/api/events/' + encodeURIComponent(b.dataset.evdel), { method: 'DELETE' }); L.toast('Événement supprimé'); await reloadPos(); } catch (err) { L.toast(err.message, true); }
  });
  document.getElementById('paForm').onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    try {
      await L.api('/api/price-alerts', { method: 'POST', body: { ticker: p.ticker || p.isin, isin: p.isin, name: p.name, currency: (p.quote_source === 'tr' ? 'EUR' : p.currency) || 'EUR', kind: fd.get('kind'), value: +fd.get('value') } });
      L.toast('Alerte créée'); L.forget(`/api/position/${encodeURIComponent(S.uid)}`); L.forget('/api/price-alerts'); S.data = await L.get(`/api/position/${encodeURIComponent(S.uid)}?range=${S.range}`, 0, true); drawAlerts(); e.target.reset();
    } catch (err) { L.toast(err.message, true); }
  };
}
function drawChart() {
  const d = S.data, box = document.getElementById('pChart'); if (!box) return;
  const leg = document.getElementById('pLeg');
  const intra = S.range === '1d' || S.range === '1w';
  if (S.pv === 'line' && d.line && !intra) {
    // Valeur de MA ligne (parts détenues × cours du jour) et son prix de revient, en €
    const pts = d.line.points; const t = pts.map(x => x.t), v = pts.map(x => x.v), cost = pts.map(x => x.cost);
    const gain = v[v.length - 1] - (cost[cost.length - 1] ?? v[0]);
    const col = gain >= 0 ? L.P.up : L.P.down;
    C.line(box, { t, h: 210, money: true, label: 'Valeur de ma ligne ' + d.position.name, series: [{ v, color: col, w: 2, area: true }, ...(cost.some(x => x != null) ? [{ v: cost, color: L.P.ref, w: 1.5, dash: '4 4' }] : [])],
      fmtY: x => F.k(x), fmtX: x => S.range === '1y' || S.range === 'max' ? F.mon(new Date(x * 1000).toISOString().slice(0, 7)) : F.dshort(x),
      tip: i => `<b>${F.date(t[i])}</b><div class="r"><span>Valeur</span><b>${L.m(F.eur(v[i], 0))}</b></div>${pts[i].qty != null ? `<div class="r"><span>Parts</span><span>${L.m(F.qty(pts[i].qty))}</span></div><div class="r"><span>Cours</span><span>${pts[i].qty ? F.eur(v[i] / pts[i].qty, 2) : '—'}</span></div>` : ''}${cost[i] != null ? `<div class="r"><span>Prix de revient</span><span>${L.m(F.eur(cost[i], 0))}</span></div><div class="r"><span>+/− latente</span><span class="${L.cls(v[i] - cost[i])}">${L.m(F.eurS(v[i] - cost[i]))}</span></div>` : ''}` });
    if (leg) leg.innerHTML = `<span><i style="background:${col}"></i>valeur de la ligne</span><span><i class="dash" style="border-color:${L.P.ref}"></i>prix de revient</span><span>Sur la période : <b class="${L.cls(d.line.end - d.line.start)}">${L.m(F.eurS(d.line.end - d.line.start))}</b> de variation de valeur (achats et ventes compris)</span>`;
    return;
  }
  const h = d.history || []; const t = h.map(x => x.t), v = h.map(x => x.c);
  const cur = d.chart_currency || d.position.currency;
  const marks = [];
  if (!intra) (d.trade_marks || []).forEach(m => {
    if (!t.length || m.t < t[0]) return;
    let i = t.findIndex(x => x >= m.t); if (i < 0) i = t.length - 1;
    marks.push({ i, kind: m.type, label: `${m.type === 'buy' ? 'Achat' : 'Vente'} de ${L.state.privacy ? '•••' : F.qty(m.shares)} à ${F.cur(m.price, cur)} le ${F.date(m.t)}` });
  });
  const ref = S.range === '1d' ? d.quote?.prev_close : d.pru_native;
  const first = S.range === '1d' ? d.quote?.prev_close : v[0];
  const col = (v[v.length - 1] ?? 0) >= (first ?? v[0]) ? L.P.up : L.P.down;
  if (!v.length) { box.innerHTML = '<div class="empty" style="height:210px;display:flex;align-items:center;justify-content:center">Pas de cours pour cette période</div>'; }
  else C.line(box, { t, h: 210, label: 'Cours de ' + d.position.name, series: [{ v, color: col, w: 2, area: true }], marks, ref: ref ? { v: ref, color: L.P.ref } : null,
    fmtY: x => F.n(x, x < 10 ? 2 : 0), fmtX: x => S.range === '1d' ? F.time(x) : S.range === '1y' || S.range === 'max' ? F.mon(new Date(x * 1000).toISOString().slice(0, 7)) : F.dshort(x),
    tip: i => `<b>${intra ? F.dshort(t[i]) + ' ' + F.time(t[i]) : F.date(t[i])}</b><div class="r"><span>Cours</span><b>${F.cur(v[i], cur)}</b></div>${ref ? `<div class="r muted"><span>vs ${S.range === '1d' ? 'veille' : 'PRU'}</span><span class="${L.cls(v[i] - ref)}">${F.pct((v[i] / ref - 1) * 100, 1)}</span></div>` : ''}` });
  if (leg) leg.innerHTML = `<span><i class="dash" style="border-color:${L.P.ref}"></i>${S.range === '1d' ? 'clôture veille' : 'prix de revient (PRU)'}</span>${marks.some(m => m.kind === 'buy') ? '<span><i style="background:${L.P.up};border-radius:50%"></i>achat</span>' : ''}${marks.some(m => m.kind === 'sell') ? '<span><i style="background:${L.P.down};border-radius:50%"></i>vente</span>' : ''}${d.range_change_pct != null ? `<span>Sur la période : <b class="${L.cls(d.range_change_pct)}">${F.pct(d.range_change_pct, 1)}</b></span>` : ''}`;
}
function drawAlerts() {
  const el = document.getElementById('pAlerts'); if (!el) return;
  const items = S.data.price_alerts || [];
  const lbl = a => a.kind === 'move' ? `Variation du jour ≥ ${F.n(a.value, 1)} %` : `${a.kind === 'above' ? 'Au-dessus de' : 'En dessous de'} ${F.cur(a.value, a.currency || S.data.position.currency)}`;
  el.innerHTML = items.length ? items.map(a => `<div class="li"><span class="st ${a.triggered_at ? 'warn' : 'info'}">${a.triggered_at ? '!' : '◷'}</span><div class="main"><div class="t1">${lbl(a)}</div><div class="t2">${a.triggered_at ? 'déclenchée le ' + F.date(a.triggered_at) : 'en attente'}</div></div><button class="ibtn" data-pad="${a.id}" title="Supprimer" aria-label="Supprimer l'alerte">${L.icon('trash')}</button></div>`).join('') : '<div class="note">Aucune alerte sur cette valeur.</div>';
  L.on(el, 'click', '[data-pad]', async (e, b) => {
    try { await L.api('/api/price-alerts/' + b.dataset.pad, { method: 'DELETE' }); S.data.price_alerts = S.data.price_alerts.filter(a => a.id !== b.dataset.pad); L.forget('/api/position/'); L.forget('/api/price-alerts'); drawAlerts(); } catch (err) { L.toast(err.message, true); }
  });
}

/* ── Analyse : fondamentaux, consensus, états financiers, concurrents ── */
function analyse(el) {
  const d = S.data, f = d.fundamentals, p = d.position;
  if (d.etf) { el.innerHTML = etf(d.etf, p); return; }
  if (!f) { el.innerHTML = '<div class="empty">Fondamentaux indisponibles pour cette ligne : Yahoo Finance ne répond pas et la fiche Trade Republic n\'est pas encore rapatriée (relancez maj.bat).</div>'; return; }
  const cur = f.currency || p.currency;
  const price = p.live_price || p.tr_price;
  const trNoCur = f.source === 'tr' && !f.currency;          // fiche TR sans devise : pas d'écart au cours
  const up = f.target_mean && price && !trNoCur ? (f.target_mean / price - 1) * 100 : null;
  const rmean = f.recommendation_mean;
  const RL = rmean == null ? '' : rmean <= 1.5 ? 'achat fort' : rmean <= 2.5 ? 'achat' : rmean <= 3.5 ? 'conserver' : rmean <= 4.5 ? 'vente' : 'vente forte';
  const rt = f.ratings; const tot = rt ? Object.values(rt).reduce((a, x) => a + (x || 0), 0) : 0;
  const pctOr = x => x == null ? '—' : F.pctU(x * 100, 1);
  const tr = f.target_low != null && f.target_high > f.target_low;
  const pos = x => Math.max(0, Math.min(100, (x - f.target_low) / (f.target_high - f.target_low) * 100));
  el.innerHTML = `<dl class="kv">
      <div><dt>PER</dt><dd>${f.pe != null ? F.n(f.pe, 1) : '—'}</dd></div><div><dt>PER prévisionnel</dt><dd>${f.forward_pe != null ? F.n(f.forward_pe, 1) : '—'}</dd></div>
      <div><dt>Rendement</dt><dd>${pctOr(f.dividend_yield)}</dd></div><div><dt>Bêta</dt><dd>${f.beta != null ? F.n(f.beta, 2) : '—'}</dd></div>
      <div><dt>Capitalisation</dt><dd>${F.big(f.market_cap, cur)}</dd></div><div><dt>Marge nette</dt><dd>${pctOr(f.profit_margin)}</dd></div>
      <div><dt>Croissance du CA</dt><dd class="${L.cls(f.revenue_growth)}">${f.revenue_growth != null ? F.pct(f.revenue_growth * 100, 1) : '—'}</dd></div><div><dt>Cours / actif net</dt><dd>${f.price_to_book != null ? F.n(f.price_to_book, 1) : '—'}</dd></div>
    </dl>
    ${f.analysts ? `<div class="sec"><h3>Consensus de ${f.analysts} analystes</h3>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div class="kpi"><span class="k-l">Recommandation moyenne</span><span class="k-v" style="font-size:20px">${F.n(rmean, 1)} <span class="muted" style="font-size:13px;font-weight:500">/ 5 · ${RL}</span></span></div>
        ${f.target_mean ? `<div class="kpi"><span class="k-l">Objectif moyen</span><span class="k-v" style="font-size:20px">${F.cur(f.target_mean, cur, 0)}</span>${up != null ? `<span class="k-s ${L.cls(up)}">${F.pct(up, 1)} vs cours</span>` : ''}</div>` : ''}</div>
      ${tot ? `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:12px" role="img" aria-label="Répartition des avis">${[['strongBuy', 'var(--q3)'], ['buy', 'var(--q2)'], ['hold', 'var(--q0)'], ['sell', 'var(--q-2)'], ['strongSell', 'var(--q-3)']].map(([k, c]) => rt[k] ? `<i style="width:${rt[k] / tot * 100}%;background:${c}" title="${k} : ${rt[k]}"></i>` : '').join('')}</div>
        <div class="legend" style="margin-top:6px"><span>${rt.strongBuy + rt.buy} à l'achat</span><span>${rt.hold} neutres</span><span>${(rt.sell || 0) + (rt.strongSell || 0)} à la vente</span></div>` : ''}
      ${tr ? `<div class="range" style="margin-top:48px"><span class="lo">${F.cur(f.target_low, cur, 0)}</span><span class="hi">${F.cur(f.target_high, cur, 0)}</span><span class="band" style="left:0;width:100%;background:rgba(138,108,255,.35)"></span>
        <span class="mk2" style="left:${pos(f.target_mean)}%;background:var(--violet)"><span>moyen</span></span>${price >= f.target_low && price <= f.target_high ? `<span class="mk2" style="left:${pos(price)}%"><span style="top:-36px">cours</span></span>` : ''}</div>` : ''}
      <p class="note">${f.source === 'tr' ? 'Avis d\'analystes repris de la fiche Trade Republic' + (trNoCur ? ' (objectif dans la devise de la fiche)' : '') : 'Avis d\'analystes agrégés par Yahoo Finance'} : une information, pas une recommandation de LUMIO.</p></div>` : ''}
    ${(d.earnings_history || []).length ? `<div class="sec"><h3>Bénéfice par action : publié contre attendu</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Trimestre</th><th>Publié</th><th>Attendu</th><th>Surprise</th></tr></thead><tbody>
      ${d.earnings_history.slice().reverse().map(e => `<tr><td>T${Math.floor(F.toDate(e.quarter_ts).getMonth() / 3) + 1} ${F.toDate(e.quarter_ts).getFullYear()}</td><td>${F.n(e.eps_actual, 2)}</td><td>${F.n(e.eps_estimate, 2)}</td><td class="${L.cls(e.surprise_pct)}">${F.pct(e.surprise_pct, 1)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="sec"><h3>États financiers</h3><div id="pFin">${L.skel(190)}</div></div>
    <div class="sec"><h3>Comparaison aux concurrents</h3><div id="pPeers">${L.skel(140)}</div></div>
    ${f.summary ? `<div class="sec"><h3>Activité</h3><p class="ink2" style="font-size:13px">${L.esc(f.summary)}</p></div>` : ''}`;
  loadFin(); loadPeers();
}
function etf(e, p) {
  return `<dl class="kv"><div><dt>Indice suivi</dt><dd>${L.esc(e.index || '—')}</dd></div><div><dt>Frais de gestion (TER)</dt><dd>${e.ter != null ? F.pctU(e.ter, 2) + ' / an' : '—'}</dd></div>
      <div><dt>Coût annuel pour vous</dt><dd>${e.ter != null ? L.m(F.eur(p.value * e.ter / 100)) : '—'}</dd></div><div><dt>Poids</dt><dd>${F.pctU(p.weight, 1)}</dd></div></dl>
    ${e.holdings.length ? `<div class="sec"><h3>Principales lignes de l'indice</h3>${C.hbars(e.holdings.map(h => ({ label: h.name, pct: h.weight })), { max: Math.max(...e.holdings.map(h => h.weight)) * 1.1, fmt: v => F.pctU(v, 1) })}</div>` : ''}
    ${e.sectors.length ? `<div class="sec"><h3>Secteurs</h3>${C.hbars(e.sectors, { max: 100 })}</div>` : ''}
    ${e.regions.length ? `<div class="sec"><h3>Régions</h3>${C.hbars(e.regions, { max: 100 })}</div>` : ''}
    <p class="note" style="margin-top:12px">${L.esc(e.source || '')} · pondérations arrondies, mises à jour une fois par an.</p>`;
}
async function loadFin() {
  const box = document.getElementById('pFin'); if (!box) return;
  try {
    const r = S.fin || await L.get(`/api/position/${encodeURIComponent(S.uid)}/financials`, 3600000); S.fin = r;
    const f = r.financials; if (!f) { box.innerHTML = '<div class="note">États financiers indisponibles pour cette valeur.</div>'; return; }
    const cur = f.currency; const big = x => F.big(x, cur);
    const years = f.years.concat(['12 m']);
    const rev = f.rows.TotalRevenue.concat([f.ttm.TotalRevenue]), ni = f.rows.NetIncome.concat([f.ttm.NetIncome]);
    box.innerHTML = `<div id="pFinC"></div><div class="legend" style="margin-top:4px"><span><i style="background:${L.P.acc}"></i>Chiffre d'affaires</span><span><i style="background:${L.P.vio}"></i>Résultat net</span></div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th></th>${years.map(y => `<th>${y}</th>`).join('')}</tr></thead><tbody>
      ${[['Chiffre d\'affaires', 'TotalRevenue'], ['Résultat d\'exploitation', 'OperatingIncome'], ['Résultat net', 'NetIncome'], ['Flux de trésorerie disponible', 'FreeCashFlow'], ['BPA dilué', 'DilutedEPS']].map(([l, k]) =>
        `<tr><td>${l}</td>${f.rows[k].concat([f.ttm[k]]).map(v => `<td class="${k === 'NetIncome' || k === 'FreeCashFlow' ? (v < 0 ? 'dn' : '') : ''}">${v == null ? '—' : k === 'DilutedEPS' ? F.n(v, 2) : big(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note" style="margin-top:6px">${L.esc(f.source)}.</p>`;
    C.groupCols(document.getElementById('pFinC'), years, [{ name: 'Chiffre d\'affaires', color: L.P.acc, v: rev }, { name: 'Résultat net', color: L.P.vio, v: ni }], big);
  } catch (e) { box.innerHTML = '<div class="note">États financiers indisponibles.</div>'; }
}
async function loadPeers() {
  const box = document.getElementById('pPeers'); if (!box) return;
  try {
    const r = S.peers || await L.get(`/api/position/${encodeURIComponent(S.uid)}/peers`, 3600000); S.peers = r;
    if (!(r.rows || []).length || r.rows.length < 2) { box.innerHTML = '<div class="note">Aucun concurrent coté identifié par Yahoo Finance.</div>'; return; }
    const pc = x => x == null ? '—' : F.pctU(x * 100, 1);
    box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Société</th><th>1 an</th><th>PER</th><th>PER prév.</th><th>Marge</th><th>Croiss.</th><th>Rdt</th><th>Capi.</th></tr></thead><tbody>
      ${r.rows.map((x, i) => `<tr style="${i === 0 ? 'background:var(--card2)' : ''}"><td><b>${L.esc(x.name)}</b>${x.held && i ? ' <span class="tag held">détenu</span>' : ''}<div class="sub">${L.esc(x.ticker)}</div></td><td class="${L.cls(x.change_1y)}">${F.pct(x.change_1y, 0)}</td><td>${x.pe != null ? F.n(x.pe, 1) : '—'}</td><td>${x.forward_pe != null ? F.n(x.forward_pe, 1) : '—'}</td><td>${pc(x.profit_margin)}</td><td class="${L.cls(x.revenue_growth)}">${x.revenue_growth != null ? F.pct(x.revenue_growth * 100, 0) : '—'}</td><td>${pc(x.dividend_yield)}</td><td>${F.big(x.market_cap, x.currency)}</td></tr>`).join('')}
      </tbody></table></div><p class="note" style="margin-top:6px">${L.esc(r.source || '')} · variation sur 1 an en devise de cotation.</p>`;
  } catch (e) { box.innerHTML = '<div class="note">Comparaison indisponible.</div>'; }
}

/* ── Opérations de la ligne ── */
function ops(el) {
  const d = S.data;
  el.innerHTML = `<div class="stat-row" style="margin-bottom:14px"><div class="kpi"><span class="k-l">Dividendes reçus</span><span class="k-v" style="font-size:19px">${L.m(F.eur(d.dividends_total))}</span></div>
      <div class="kpi"><span class="k-l">Plus-value réalisée</span><span class="k-v ${L.cls(d.realized)}" style="font-size:19px">${L.m(F.eurS(d.realized, 2))}</span></div><div class="kpi"><span class="k-l">Frais</span><span class="k-v" style="font-size:19px">${L.m(F.eur(d.fees_total))}</span></div></div>
    ${(d.transactions || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th class="l">Opération</th><th>Parts</th><th>Montant</th><th>Frais</th></tr></thead><tbody>
      ${d.transactions.map(t => `<tr><td>${F.date(t.t)}</td><td class="l">${TX[t.type] || L.esc(t.type)}</td><td>${t.shares ? L.m(F.qty(Math.abs(t.shares))) : '—'}</td><td class="${t.type === 'dividend' ? 'up' : ''}">${L.m(F.eur(t.value))}</td><td>${t.fees ? L.m(F.eur(t.fees)) : '—'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Aucune opération importée pour cette ligne (transfert entrant ? saisissez-la dans Portefeuille › Opérations).</div>'}`;
}

/* ── Actualités de la valeur ── */
function actus(el) {
  const d = S.data;
  const items = d.news || [];
  el.innerHTML = `${(d.alerts || []).length ? `<div class="sec" style="margin-top:0"><h3>Signalées par LUMIO</h3>${d.alerts.map(a => `<a class="art" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><div class="t1">${L.esc(a.title)}</div><div class="t2"><span class="score ${a.score >= 70 ? 'hi' : a.score >= 50 ? 'mid' : ''}">${a.score}</span>${L.esc(a.source)} · ${F.ago(a.age_h)}</div></a>`).join('')}</div>` : ''}
    <div class="sec"${(d.alerts || []).length ? '' : ' style="margin-top:0"'}><h3>Dernières actualités</h3>${items.length ? items.map(a => `<a class="art" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><div class="t1">${L.esc(a.title)}</div><div class="t2">${a.score != null ? `<span class="score ${a.score >= 70 ? 'hi' : a.score >= 50 ? 'mid' : ''}">${a.score}</span>` : ''}${L.esc(a.source || '')} · ${F.ago(a.age_h)}${a.lang === 'en' ? ' · en anglais' : ''}</div></a>`).join('') : '<div class="empty">Aucune actualité récente.</div>'}</div>
    <p class="note" style="margin-top:10px">Score d'importance : exposition (poids de la ligne) + gravité de l'événement + fraîcheur + fiabilité de la source.</p>`;
}
})();
