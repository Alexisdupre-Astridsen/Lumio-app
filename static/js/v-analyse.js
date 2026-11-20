/* LUMIO — Portefeuille > Performance, Revenus, Analyse (risque, exposition, rééquilibrage,
   objectif, fiscalité, frais) et Opérations (saisie, journal d'import, export). */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const APER = [['1d', '1J'], ['1w', '1S'], ['1m', '1M'], ['3m', '3M'], ['ytd', 'YTD'], ['1y', '1A'], ['3y', '3A'], ['max', 'Max'], ['custom', 'Dates']];
const EXTRA = ['3m', '3y', 'custom'];            // périodes propres à cette page ; les autres sont communes à LUMIO
const aper = () => { const o = L.store.get('pf.pover', null); return EXTRA.includes(o) ? o : L.period(); };
const abench = () => L.bench();
let perfEl = null;
const rerender = () => { if (perfEl && perfEl.isConnected) L.pf.performance(perfEl); };
document.addEventListener('lumio:period', () => { L.store.set('pf.pover', null); rerender(); });
document.addEventListener('lumio:bench', rerender);
const anaUrl = () => {
  const p = aper(); let u = `/api/analytics?period=${p}&bench=${encodeURIComponent(abench())}`;
  if (p === 'custom') u += `&start=${L.store.get('pf.start', '')}&end=${L.store.get('pf.end', '')}`;
  const tmi = L.store.get('pf.tmi', null); if (tmi != null) u += `&tmi=${tmi}`;
  return u;
};
const getAna = (force) => L.get(anaUrl(), 120000, force);
const kv = (k, v, cls = '') => `<div><dt>${k}</dt><dd class="${cls}">${v}</dd></div>`;
const stat = (lbl, val, sub = '', tip = '') => `<div class="kpi stat"><span class="k-l">${lbl}${tip ? ' ' + L.tipTxt(tip) : ''}</span><span class="k-v">${val}</span>${sub ? `<span class="k-s">${sub}</span>` : ''}</div>`;
const card = (cls, title, body, right = '') => `<section class="w ${cls}"><div class="w-h"><h2>${title}</h2>${right ? `<div class="r">${right}</div>` : ''}</div>${body}</section>`;

/* ══════════ Performance ══════════ */
/* Pont de la période, ligne par ligne : valeur au début, achats nets, dividendes, valeur à la fin */
async function linesCard(period) {
  const box = document.getElementById('apLines'); if (!box) return;
  let r;
  try { r = await L.get('/api/portfolio/lines?period=' + encodeURIComponent(period), 120000); } catch (e) { box.innerHTML = L.errBox(e); return; }
  if (!document.getElementById('apLines')) return;
  if (!r.available || !r.lines.length) { box.innerHTML = '<div class="w-h"><h2>Ligne par ligne</h2></div><div class="empty">Pas d\'historique sur cette période.</div>'; return; }
  const T = r.total;
  box.innerHTML = `<div class="w-h"><h2>Ligne par ligne · du ${F.date(r.start)} au ${F.date(r.end)}</h2><div class="r note">gain = valeur fin − valeur début − achats nets + dividendes</div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ligne</th><th class="num">Valeur au début</th><th class="num">Achats nets</th><th class="num">Dividendes</th><th class="num">Valeur à la fin</th><th class="num">Gain</th><th class="num">Gain %</th><th class="num">Cours seul</th></tr></thead><tbody>
    ${r.lines.map(x => `<tr class="click" data-pos="${L.esc(x.uid)}" tabindex="0"><td><b>${L.esc(x.name)}</b>${x.held ? '' : ' <span class="tag">soldée</span>'}${x.estimated ? ' <span class="tag warn" title="Sans historique de cours : prix d\'exécution interpolés">≈ estimée</span>' : ''}</td>
      <td class="num">${L.m(F.eur(x.value_start, 0))}</td><td class="num">${x.flows ? L.m(F.eurS(x.flows)) : '—'}</td><td class="num">${x.dividends ? L.m(F.eur(x.dividends, x.dividends < 10 ? 2 : 0)) : '—'}</td>
      <td class="num">${L.m(F.eur(x.value_end, 0))}</td><td class="num ${L.cls(x.gain)}"><b>${L.m(F.eurS(x.gain))}</b></td>
      <td class="num ${L.cls(x.gain_pct)}">${x.gain_pct != null ? F.pct(x.gain_pct, 1) : '—'}</td><td class="num ${L.cls(x.price_change_pct)}">${x.price_change_pct != null ? F.pct(x.price_change_pct, 1) : '—'}</td></tr>`).join('')}
    </tbody><tfoot><tr><td><b>Total</b></td><td class="num">${L.m(F.eur(T.value_start, 0))}</td><td class="num">${L.m(F.eurS(T.flows))}</td><td class="num">${L.m(F.eur(T.dividends, 0))}</td><td class="num">${L.m(F.eur(T.value_end, 0))}</td><td class="num ${L.cls(T.gain)}"><b>${L.m(F.eurS(T.gain))}</b></td><td></td><td></td></tr></tfoot></table></div>
    <p class="note" style="margin-top:8px">« Cours seul » : variation du cours entre les deux dates, sans l'effet de vos achats et ventes. ${L.tapW()} une ligne pour ouvrir sa fiche.</p>`;
}

L.pf.performance = async (el, force = false) => {
  perfEl = el;
  let a;
  try { a = await getAna(force); } catch (e) { el.innerHTML = L.errBox(e); return; }
  if (a.empty) { el.innerHTML = '<div class="empty">Aucune position.</div>'; return; }
  const p = a.performance || {};
  const imp = (p.implicit || []).filter(k => !(p.gifts || []).includes(k));   // hors cadeaux d'actions (expliqués à part)
  const b = p.benchmark || {};
  const benches = a.benchmarks || [];
  el.innerHTML = `<div class="toolbar">
      <div class="seg" role="group" aria-label="Période">${APER.map(([k, l]) => `<button data-ap="${k}" class="${k === aper() ? 'on' : ''}" aria-pressed="${k === aper()}">${l}</button>`).join('')}</div>
      ${aper() === 'custom' ? `<input class="inp" type="date" id="apS" value="${L.esc(L.store.get('pf.start', ''))}" style="width:auto;height:36px" aria-label="Début"><input class="inp" type="date" id="apE" value="${L.esc(L.store.get('pf.end', ''))}" style="width:auto;height:36px" aria-label="Fin"><button class="btn sm" id="apGo">Calculer</button>` : ''}
      <span class="grow"></span>
      <span class="note" style="display:flex;gap:8px;align-items:center">Comparer à ${L.benchSelect(benches, b.label || '', 'apB')}</span>
    </div>
    ${!p.available ? `<div class="callout">${L.esc(p.reason || 'Pas assez d\'historique pour cette période.')}</div>` : `
    ${(a.estimated_names || []).length ? `<div class="callout warn" style="margin-bottom:12px"><b>Chiffres approchés (≈)</b> : ${a.estimated_names.map(L.esc).join(', ')} ${a.estimated_names.length > 1 ? 'sont valorisées' : 'est valorisée'} sans historique de cours (prix d'exécution interpolés). Rendement, gain et risque de la période en dépendent${p.twr_ex_estimated != null ? ` ; sans ${a.estimated_names.length > 1 ? 'ces lignes' : 'cette ligne'}, le reste du portefeuille fait exactement <b class="${L.cls(p.twr_ex_estimated)}">${F.fr(p.twr_ex_estimated, 2)}</b> (TWR)` : ''}. Relancez maj.bat pour récupérer l'historique Trade Republic.</div>` : ''}
    <div class="cards">
      <section class="w c12"><div class="stat-row">
        ${stat('Performance (TWR)', `<span class="${L.cls(p.twr)}">${(a.estimated_names || []).length ? '≈ ' : ''}${F.fr(p.twr, 2)}</span>`, p.label, 'Rendement pondéré par le temps : neutralise vos versements, comparable à un indice.')}
        ${stat('Annualisée', p.annualized_ok ? `<span class="${L.cls(p.twr_annualized)}">${F.fr(p.twr_annualized, 1)}</span>` : '—', p.annualized_ok ? 'par an' : 'période < 1 an')}
        ${stat('XIRR', p.mwr != null ? `<span class="${L.cls(p.mwr)}">${F.fr(p.mwr, 1)}</span>` : '—', 'votre argent, par an', 'Taux de rendement interne : tient compte de la date et du montant de chaque versement.')}
        ${stat('Gain', `<span class="${L.cls(p.gain_eur)}">${L.m(F.eurS(p.gain_eur))}</span>`, 'hors versements')}
        ${stat('vs ' + L.esc(b.label || 'indice'), b.twr != null ? `<span class="${L.cls(p.twr - b.twr)}">${F.pt((p.twr - b.twr) * 100, 1)}</span>` : '—', b.twr != null ? 'indice ' + F.fr(b.twr, 1) : '')}
        ${stat('Bêta', b.beta != null ? F.n(b.beta, 2) : '—', b.correlation != null ? 'corrélation ' + F.n(b.correlation, 2) : b.beta == null ? 'à partir de 10 semaines' : '', 'Bêta 1,2 : quand l\'indice fait ±1 %, le portefeuille fait en moyenne ±1,2 %.')}
      </div>${p.truncated ? `<p class="note" style="margin-top:10px">Historique de cours disponible depuis le ${F.date(p.start)} : la période part de cette date.</p>` : ''}${p.opening_eur > 0 ? `<p class="note" style="margin-top:10px">La période part du premier cours disponible (${F.date(p.start)}) : ${L.m(F.eur(p.opening_eur, 0))} de titres déjà détenus forment le solde d'ouverture, exclu du gain ; le XIRR garde vos vrais flux depuis le premier achat.</p>` : ''}${(p.gifts || []).length ? `<p class="note" style="margin-top:10px">Titres reçus gratuitement (${L.esc(p.gifts.map(k => (L.posByUid(k) || {}).name || k).join(', '))}) : comptés comme une entrée de titres à leur valeur du jour de réception, pas comme un gain.</p>` : ''}${imp.length ? `<p class="note" style="margin-top:10px">${imp.length} ligne${imp.length > 1 ? 's' : ''} sans opération importée (${L.esc(imp.map(k => (L.posByUid(k) || {}).name || k).join(', '))}) ${p.implicit_entry ? `${imp.length > 1 ? 'sont comptées' : 'est comptée'} comme une entrée de titres le ${F.date(p.implicit_since)}, à sa valeur de marché` : `${imp.length > 1 ? 'sont supposées détenues' : 'est supposée détenue'} sur toute la période`} : saisissez l'achat réel dans Opérations pour une performance exacte.</p>` : ''}</section>
      <section class="w c8"><div class="w-h"><h2>Portefeuille contre ${L.esc(b.label || 'indice')}</h2><div class="r"><span class="legend"><span><i class="ln" style="background:${L.P.acc}"></i>Portefeuille</span><span><i class="ln" style="background:${L.P.bench}"></i>${L.esc(b.label || 'Indice')}</span></span></div></div><div id="apC"></div>
        <div class="w-h" style="margin:16px 0 6px"><h2>Baisses depuis un plus-haut</h2></div><div id="apDD"></div></section>
      <section class="w c4"><div class="w-h"><h2>Risque</h2></div><dl class="kv">
        ${kv('Volatilité', F.frU(p.volatility, 1))}${p.sharpe == null && p.var95 == null ? '' : `${kv('Sharpe', p.sharpe == null ? '—' : F.n(p.sharpe, 2))}${kv('Sortino', p.sortino == null ? '—' : F.n(p.sortino, 2))}${kv('Calmar', F.n(p.calmar, 2))}
        ${kv('VaR 95 % (1 jour)', F.fr(p.var95, 2), 'dn')}${kv('CVaR 95 %', F.fr(p.cvar95, 2), 'dn')}`}
        ${kv('Pire baisse', F.fr(p.max_drawdown, 1), 'dn')}${kv('Baisse actuelle', F.fr(p.current_drawdown, 1), L.cls(p.current_drawdown))}
        ${kv('Meilleur jour', p.best_day ? `${F.fr(p.best_day.r, 2)} · ${F.dshort(p.best_day.t)}` : '—', 'up')}${kv('Pire jour', p.worst_day ? `${F.fr(p.worst_day.r, 2)} · ${F.dshort(p.worst_day.t)}` : '—', 'dn')}
        ${p.fx_effect == null ? kv('Effet change', '<span class="muted" title="Cours Trade Republic en euros : la part due au change n\'est pas séparable">dans les cours</span>') : kv('Effet change', L.m(F.eurS(p.fx_effect)), L.cls(p.fx_effect))}${kv('Taux sans risque', F.frU(p.risk_free, 2))}
      </dl>${p.sharpe == null && p.var95 == null ? '<p class="note" style="margin-top:10px">Sharpe, Sortino, Calmar et VaR : à partir de 3 mois de séances (choisissez 3M ou plus).</p>' : ''}<p class="note" style="margin-top:12px">${p.mdd_peak ? `Pire baisse : du ${F.date(p.mdd_peak)} au ${F.date(p.mdd_trough)}${p.mdd_recovered ? `, effacée le ${F.date(p.mdd_recovered)}` : ', pas encore effacée'}.` : ''} VaR : perte journalière dépassée 1 jour sur 20.</p></section>
      ${bridgeCard(a.bridge)}
      ${card('c6', 'Contributions par ligne · ' + L.esc(p.label || ''), (a.attribution || []).length ? C.dbars(contribRows(a.attribution)) + `<p class="note" style="margin-top:8px">Somme des contributions = gain de la période (${L.m(F.eurS(p.gain_eur))}), lignes soldées comprises.</p>` : '<div class="empty">—</div>')}
      ${shadowCard(a.shadow)}
      ${realizedCard(a.realized)}
      <section class="w c12" id="apLines"><div class="w-h"><h2>Ligne par ligne · ${L.esc(p.label || '')}</h2></div>${L.skel(160)}</section>
      ${card('c12', 'Rendements mensuels', C.heat(a.monthly?.years || []) + '<p class="note" style="margin-top:6px">Rendement pondéré par le temps de chaque mois ; la dernière colonne compose l\'année.</p>')}
    </div>`}`;
  if (p.available && p.chart) {
    const ch = p.chart, t = ch.map(c => c.t), axX0 = (t.length && t[t.length - 1] - t[0] <= 92 * 86400) ? (x => F.dshort(x)) : (x => F.mon(new Date(x * 1000).toISOString().slice(0, 7))), axX = x => (p.period === 'ytd' && x === t[0] ? '1er janv.' : axX0(x)), sp = ch.map(c => c.p - 100), sb = ch.map(c => c.b == null ? null : c.b - 100), dd = ch.map(c => c.dd || 0);
    C.line(document.getElementById('apC'), { t, h: 250, label: 'Performance comparée ; cliquez un jour pour voir le portefeuille à cette date', fmtX: axX, series: [{ v: sp, color: L.P.acc, w: 2.2 }, { v: sb, color: L.P.bench, w: 1.5 }], ref: { v: 0 },
      onPick: i => L.openAtDate(t[i]),
      fmtY: v => F.s(v, 0) + ' %', tip: i => `<b>${F.date(t[i])}</b><div class="r"><span>Portefeuille</span><b>${F.pct(sp[i], 2)}</b></div><div class="r"><span>${L.esc(b.label || 'Indice')}</span><b>${F.pct(sb[i], 2)}</b></div><div class="r muted"><span>Valeur</span><span>${L.m(F.eur(ch[i].v, 0))}</span></div>` });
    C.line(document.getElementById('apDD'), { t, h: 120, label: 'Baisses depuis un plus-haut', fmtX: axX, series: [{ v: dd, color: L.P.down, w: 1.5, area: true }], yMax: 0, nTicks: 2, endDot: false,
      fmtY: v => F.s(v, 0) + ' %', tip: i => `<b>${F.date(t[i])}</b><div class="r"><span>Sous le plus-haut</span><b class="dn">${F.pct(dd[i], 1)}</b></div>` });
  }
  if (p.available && aper() !== 'custom') linesCard(aper());
  L.on(el, 'click', '[data-ap]', (e, x) => {
    const k = x.dataset.ap;
    if (EXTRA.includes(k)) { L.store.set('pf.pover', k); L.pf.performance(el); return; }
    const same = k === L.period();
    L.setPeriod(k);                                     // 1J à Max : la période de tout LUMIO
    if (same) { L.store.set('pf.pover', null); L.pf.performance(el); }
  });
  const go = document.getElementById('apGo');
  if (go) go.onclick = () => { L.store.set('pf.start', document.getElementById('apS').value); L.store.set('pf.end', document.getElementById('apE').value); L.pf.performance(el); };
};
/* 9 premières contributions + le reste regroupé : la somme affichée reste celle du gain */
function contribRows(at) {
  const rows = at.slice(0, at.length > 10 ? 9 : 10).map(x => ({ label: x.name + (x.held ? '' : ' (soldée)') + (x.estimated ? ' ≈' : ''), v: x.gain_eur }));
  if (at.length > 10) rows.push({ label: `${at.length - 9} autres lignes`, v: Math.round(at.slice(9).reduce((s, x) => s + x.gain_eur, 0) * 100) / 100 });
  return rows;
}
function bridgeCard(br) {
  if (!br || br.start_value == null) return '';
  // Valeur de départ + versements + cours (avant frais) + change + frais = valeur de fin ; dividendes en plus
  const rows = [['Valeur de départ', br.start_value, true], ['Versements nets', br.net_flows], ['Effet des cours (avant frais)', br.market_effect], ...(br.fx_effect == null ? [] : [['Effet du change', br.fx_effect]]), ['Frais d\'ordres', br.fees]];
  const mx = Math.max(...rows.slice(1).map(r => Math.abs(r[1] || 0)), Math.abs(br.dividends || 0), 1);
  const line = ([l, v, base]) => `<div class="db"><span class="lbl">${l}</span>${base ? '<span></span>' : `<span class="trk"><span class="fil ${v >= 0 ? 'p' : 'n'}" style="width:${Math.abs(v || 0) / mx * 50}%"></span></span>`}<span class="val ${base ? '' : L.cls(v)}">${L.m(base ? F.eur(v, 0) : F.eurS(v))}</span></div>`;
  return card('c6', 'D\'où vient le résultat', rows.map(line).join('')
    + `<div class="db" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px"><span class="lbl"><b style="color:var(--ink)">Valeur de fin</b></span><span></span><span class="val"><b>${L.m(F.eur(br.end_value, 0))}</b></span></div>
    ${line(['Dividendes encaissés', br.dividends])}
    <p class="note" style="margin-top:8px">Gain de la période : ${L.m(F.eurS(br.total_gain))} = effet des cours + change + frais + dividendes${br.fx_effect == null ? ' (cours en euros de Trade Republic : le change est compris dans l\'effet des cours)' : ''}. Les frais sont comptés une fois (ils sont compris dans le montant des achats).</p>`);
}
function shadowCard(s) {
  if (!s) return '';
  const better = s.difference >= 0;
  return card('c6', 'Et si tout avait été investi dans un ETF Monde ?', `<p class="ink2" style="font-size:13.5px">Chaque achat et chaque vente rejoués à la même date sur ${L.esc(s.label)} :</p>
    <div class="stat-row" style="margin-top:12px">${stat('Votre portefeuille', L.m(F.eur(s.real_value, 0)))}${stat('Portefeuille fantôme', L.m(F.eur(s.value, 0)), s.xirr != null ? 'XIRR ' + F.fr(s.xirr, 1) + '/an' : '')}${stat('Différence', `<span class="${L.cls(s.difference)}">${L.m(F.eurS(s.difference))}</span>`, better ? 'en faveur de vos choix' : 'en faveur de l\'ETF')}</div>
    <p class="note" style="margin-top:10px">Depuis le ${F.date(s.since)}. Répond à la question : mes choix de valeurs ont-ils rapporté plus qu'un ETF indiciel ?</p>`);
}
function realizedCard(r) {
  if (!r) return '';
  const years = Object.entries(r.by_year || {});
  return card('c6', 'Plus-values réalisées', `<div class="stat-row">${stat('Total réalisé', `<span class="${L.cls(r.total)}">${L.m(F.eurS(r.total))}</span>`)}${years.map(([y, v]) => stat(y, `<span class="${L.cls(v)}">${L.m(F.eurS(v))}</span>`)).join('')}</div>
    ${(r.sells || []).length ? `<div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Date</th><th class="l">Valeur</th><th>Parts</th><th>Produit</th><th>Prix de revient</th><th>Plus-value</th></tr></thead><tbody>
    ${r.sells.map(s => `<tr><td>${F.date(s.t)}</td><td class="l">${L.esc(s.name)}</td><td>${L.m(F.qty(s.shares))}</td><td>${L.m(F.eur(s.proceeds))}</td><td>${L.m(F.eur(s.cost))}</td><td class="${L.cls(s.gain)}"><b>${L.m(F.eurS(s.gain, 2))}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune vente.</div>'}
    <p class="note" style="margin-top:8px">Méthode : ${L.esc(r.method || '')}.${(r.warnings || []).length ? ' ⚠ ' + r.warnings.map(L.esc).join(' · ') : ''}</p>`);
}

/* ══════════ Revenus ══════════ */
L.pf.revenus = async (el, force = false) => {
  let a, cal;
  try { [a, cal] = await Promise.all([getAna(force), L.get('/api/calendar', 300000, force)]); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const inc = a.income || {}, fc = a.forecast || {};
  const years = Object.entries(inc.by_year || {}).reverse();
  const evs = (cal.events || []).filter(e => e.type !== 'earnings').slice(0, 8);
  const fcRows = fc.by_position || [];
  const rec = Object.fromEntries((inc.by_isin || []).map(x => [x.isin, x]));
  const fcBy = Object.fromEntries(fcRows.map(r => [r.uid || r.isin, r]));
  const lines = [...new Set([...fcRows.map(r => r.uid || r.isin), ...(inc.by_isin || []).map(x => x.isin)])];
  const NB = '\u00a0';
  el.innerHTML = `<div class="cards">
    <section class="w c12"><div class="stat-row">
      ${stat('Dividendes · 12 mois', L.m(F.eur(inc.dividends_ttm)), 'nets reçus')}
      ${stat('Intérêts · 12 mois', L.m(F.eur(inc.interest_ttm)), 'sur les espèces')}
      ${stat('Prévus · 12 mois', L.m(F.eur(fc.next_12m)), `bruts ; ≈${NB}${L.m(F.eur(fc.next_12m_net, 0))} nets`, 'Dividendes par action des 12 derniers mois × quantité détenue × change, versements exceptionnels exclus. Net estimé avec la retenue à la source déjà subie sur chaque ligne (sinon le taux usuel du pays), avant impôt français.')}
      ${stat('Rendement', F.pctU(fc.yield, 2), 'brut, sur la valeur actuelle')}
      ${stat('Rendement sur coût', F.pctU(fc.yield_on_cost, 2), 'sur le prix de revient')}
      ${stat('Retenues à la source', L.m(F.eur(inc.withheld_total)), 'depuis le début')}
    </div></section>
    <section class="w c8"><div class="w-h"><h2>Reçus par mois (nets)</h2><div class="r legend"><span><i style="background:${L.P.acc}"></i>Dividendes</span><span><i style="background:${L.P.vio}"></i>Intérêts</span><button class="ibtn" id="rvTbl" aria-label="Voir en tableau" aria-pressed="${!!el._rvTbl}" title="Voir en tableau">${L.icon('list')}</button></div></div><div id="rvM"></div>
      <div class="w-h" style="margin-top:14px"><h2>Prévus par mois de versement</h2><div class="r legend"><span><i style="background:${L.P.accSoft}"></i>Bruts</span><span><i style="background:${L.P.acc}"></i>Nets estimés</span></div></div><div id="rvF"></div></section>
    <section class="w c4"><div class="w-h"><h2>Prochains détachements et versements</h2></div>${evs.length ? evs.map(e => { const d = F.toDate(e.date); return `<div class="li click" data-pos="${L.esc(e.isin)}" role="button" tabindex="0"><span class="datebox"><b>${d.getDate()}</b><span>${F.months[d.getMonth()]}</span></span><div class="main"><div class="t1 ell">${L.esc(e.name)}</div><div class="t2">${L.esc(e.label)} · ${F.inDays(e.date)}</div></div>${e.amount_eur ? `<span class="end">${L.m(F.eur(e.amount_eur))}${e.amount_kind ? `<small class="ink3" style="display:block;font-size:11px;text-align:right">${e.amount_kind}</small>` : ''}</span>` : ''}</div>`; }).join('') : '<div class="empty">Aucun détachement connu dans les 120 prochains jours.</div>'}</section>
    ${card('c12', 'Par ligne', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Valeur</th><th>Reçu brut</th><th>Retenue</th><th>Reçu net</th><th>Prévu 12 mois (brut)</th><th>Net estimé</th><th>Rendement</th><th>Sur coût</th><th>Prochain</th></tr></thead><tbody>
      ${lines.map(k => { const r = fcBy[k] || {}, x = rec[k] || {}; return `<tr class="click" data-pos="${L.esc(k)}" tabindex="0"><td>${L.esc(r.name || x.name || k)}</td><td>${x.gross ? L.m(F.eur(x.gross)) : '—'}</td><td>${x.withheld ? `${L.m(F.eur(x.withheld))} <span class="sub">${F.pctU(x.rate, 1)}</span>` : '—'}</td><td>${x.net ? L.m(F.eur(x.net)) : '—'}</td><td>${r.annual ? L.m(F.eur(r.annual)) : '—'}</td><td>${r.annual_net ? L.m(F.eur(r.annual_net)) : '—'}</td><td>${r.yield != null ? F.pctU(r.yield, 2) : '—'}</td><td>${r.yield_on_cost != null ? F.pctU(r.yield_on_cost, 2) : '—'}</td><td>${r.next_ex ? F.dshort(r.next_ex) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="9" class="l muted">Aucune ligne ne verse de dividende.</td></tr>'}</tbody></table></div>
      <p class="note" style="margin-top:8px">Reçu : depuis le début, d'après vos opérations. Prévu : aux quantités actuelles ; le net estimé applique la retenue déjà subie sur la ligne.</p>`)}
    ${card('c5', 'Retenues à la source par pays', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pays</th><th>Brut</th><th>Retenu</th><th>Taux</th><th>Net</th></tr></thead><tbody>
      ${(inc.by_country || []).map(c => `<tr><td>${L.esc(c.country)}</td><td>${L.m(F.eur(c.gross))}</td><td>${L.m(F.eur(c.withheld))}</td><td>${F.pctU(c.rate, 1)}</td><td>${L.m(F.eur(c.net))}</td></tr>`).join('')}</tbody></table></div>
      <p class="note" style="margin-top:8px">D'après vos opérations. La retenue étrangère s'impute sur l'impôt français dans la limite du taux conventionnel (15 % pour les États-Unis avec le formulaire W-8BEN), versement par versement.</p>`)}
    ${card('c7', 'Par année', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Année</th><th>Dividendes bruts</th><th>Retenus</th><th>Dividendes nets</th><th>Intérêts</th></tr></thead><tbody>
      ${years.map(([y, v]) => `<tr><td>${y}</td><td>${L.m(F.eur(v.gross))}</td><td>${L.m(F.eur(v.withheld))}</td><td>${L.m(F.eur(v.dividends))}</td><td>${L.m(F.eur(v.interest))}</td></tr>`).join('')}</tbody></table></div>`)}
    ${card('c12', 'Derniers versements', (inc.payments || []).slice(0, 8).map(x => `<div class="li click" data-pos="${L.esc(x.isin)}" role="button" tabindex="0"><div class="main"><div class="t1">${L.esc(x.name)}</div><div class="t2">${F.date(x.t)}${x.withheld ? `, brut ${L.m(F.eur(x.gross))}, retenue ${L.m(F.eur(x.withheld))}` : ''}</div></div><span class="end up">${L.m(F.eurS(x.amount, 2))}</span></div>`).join('') || '<div class="empty">Aucun dividende reçu.</div>')}
  </div>`;
  const bm = inc.by_month || [];
  const drawM = () => {
    const box = document.getElementById('rvM'); if (!box) return;
    if (el._rvTbl) {
      box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mois</th><th>Dividendes bruts</th><th>Retenues</th><th>Dividendes nets</th><th>Intérêts</th></tr></thead><tbody>${bm.slice().reverse().map(m => `<tr><td>${F.mon(m.month)}</td><td>${L.m(F.eur(m.gross))}</td><td>${L.m(F.eur(m.withheld))}</td><td>${L.m(F.eur(m.dividends))}</td><td>${L.m(F.eur(m.interest))}</td></tr>`).join('')}</tbody></table></div>`;
      return;
    }
    C.groupCols(box, bm.map(m => F.mon(m.month).split(' ')[0]), [{ name: 'Dividendes', color: L.P.acc, v: bm.map(m => m.dividends) }, { name: 'Intérêts', color: L.P.vio, v: bm.map(m => m.interest) }], v => F.n(v, 0) + NB + '€');
    box.querySelectorAll('.ax').forEach(n => n.classList.add('m-ax'));
  };
  drawM();
  document.getElementById('rvTbl').onclick = (e) => { el._rvTbl = !el._rvTbl; e.currentTarget.setAttribute('aria-pressed', !!el._rvTbl); drawM(); };
  const fm = fc.by_month || [];
  C.groupCols(document.getElementById('rvF'), fm.map(m => F.mon(m.month).split(' ')[0]), [{ name: 'Bruts', color: L.P.accSoft, v: fm.map(m => m.amount) }, { name: 'Nets estimés', color: L.P.acc, v: fm.map(m => m.net) }], v => F.n(v, 0) + NB + '€');
  document.getElementById('rvF').querySelectorAll('.ax').forEach(n => n.classList.add('m-ax'));
};

/* ══════════ Analyse ══════════ */
const DIMS = [['sector', 'Secteurs'], ['region', 'Régions'], ['country', 'Pays'], ['currency', 'Devises'], ['type', 'Type']];
L.pf.analyse = async (el, force = false) => {
  let a, rb, goal;
  try { [a, rb, goal] = await Promise.all([getAna(force), L.get('/api/rebalance?contribution=' + (L.store.get('rb.amount', 500) || 0), 60000, force), L.get('/api/goal', 120000, force)]); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const dim = L.store.get('an.dim', 'sector'), lt = L.store.get('an.lt', true);
  const al = (lt ? a.allocation_lt : a.allocation)[dim] || [];
  const ex = a.exposure || {}; const h = a.health || {}; const st = (a.stress || {}).scenarios || [];
  const order = { alert: 0, warn: 1, ok: 2 }; const ic = { ok: '✓', warn: '!', alert: '✕' };
  el.innerHTML = `<div class="cards">
    ${card('c6', 'Répartition', `${C.hbars(al.slice(0, 10), { max: 100 })}${al.length > 10 ? `<p class="note">+ ${al.length - 10} autres</p>` : ''}`,
      `<div class="seg sm" role="group" aria-label="Répartition par">${DIMS.map(([k, l]) => `<button data-dim="${k}" class="${k === dim ? 'on' : ''}" aria-pressed="${k === dim}">${l}</button>`).join('')}</div><button class="chip ${lt ? 'on' : ''}" id="anLt" aria-pressed="${lt}">ETF décomposés</button>`)}
    ${card('c6', 'Exposition réelle par société', `<div class="stat-row" style="margin-bottom:10px">${stat('5 premières', F.pctU(ex.top5_pct, 1), 'du portefeuille')}${stat('10 premières', F.pctU(ex.top10_pct, 1), 'du portefeuille')}${stat('Doublons', String((ex.overlaps || []).length), 'en direct et via ETF')}</div>
      <div class="tbl-wrap" style="max-height:290px;overflow:auto"><table class="tbl"><thead><tr><th>Société</th><th>En direct</th><th>Via ETF</th><th>Total</th><th>Poids</th></tr></thead><tbody>
      ${(ex.companies || []).slice(0, 15).map(c => `<tr><td>${L.esc(c.name)} ${c.overlap ? '<span class="tag warn">doublon</span>' : ''}</td><td>${c.direct ? L.m(F.eur(c.direct, 0)) : '—'}</td><td>${c.via_etf ? L.m(F.eur(c.via_etf, 0)) : '—'}</td><td><b>${L.m(F.eur(c.total, 0))}</b></td><td>${F.pctU(c.pct, 2)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note" style="margin-top:8px">${L.esc(ex.note || '')}</p>`)}
    <section class="w c12"><div class="w-h"><h2>Bilan de santé</h2><div class="r"><a class="lnk" href="#/reglages" title="Méthode">Méthode</a></div></div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:8px">${C.ring(h.score, 80)}<p class="ink2" style="flex:1;min-width:220px;font-size:13.5px">Score = moyenne des règles (✓ 1 point, ! ½ point, ✕ 0). Chaque règle est vérifiable : seuil, valeur, raison. Rien n'est noté sur une impression.</p></div>
      <div class="cards" style="gap:0 24px">${(h.rules || []).slice().sort((x, y) => order[x.status] - order[y.status]).map(r => `<div class="li c6"><span class="st ${r.status}">${ic[r.status]}</span><div class="main"><div class="t1">${L.esc(r.label)}</div><div class="t2">${L.mText(r.detail)}${r.advice && r.status !== 'ok' ? '. ' + L.esc(r.advice) : ''}</div></div></div>`).join('')}</div></section>
    ${riskCard(a.risk)}
    ${profileCard(a.profile)}
    ${card('c7', 'Scénarios de crise', st.length ? scenGroup('Chocs de marché', st.filter(s => !s.historical)) + scenGroup('Crises rejouées sur vos lignes d\'aujourd\'hui', st.filter(s => s.historical)) : '<div class="empty">Pas assez d\'historique pour estimer les chocs.</div>',
      `<button class="btn sm ia" data-ask="Et si le Nasdaq perd 20 % ?">${L.icon('spark')}Demander</button>`)}
    ${card('c5', 'Lignes qui bougent ensemble', `${(a.correlations || []).length ? `<div class="callout" style="margin-bottom:10px">${a.correlations.length} paire(s) au-delà de 0,8 : elles comptent presque comme un seul pari.</div>` : '<p class="ink2" style="font-size:13.5px;margin-bottom:8px">Aucune paire au-delà de 0,8 : vos paris individuels sont distincts.</p>'}
      ${(a.correlations_top || []).map(c => `<div class="li"><div class="main"><div class="t1">${L.esc(c.a)} / ${L.esc(c.b)}</div></div><div class="meter" style="width:120px"><div class="gauge"><i style="width:${Math.max(0, c.corr) * 100}%;background:${c.corr >= .8 ? 'var(--warn)' : 'var(--cyan)'}"></i></div><b class="num" style="font-size:12.5px">${F.n(c.corr, 2)}</b></div></div>`).join('')}
      <p class="note" style="margin-top:8px">Corrélation des rendements hebdomadaires sur 1 an (actions et crypto en direct) : 1 = mouvements identiques, 0 = indépendants.</p>`)}
    ${rebalanceCard(rb, a.targets)}
    ${goalCard(goal)}
    ${taxCard(a.tax)}
    ${feesCard(a.fees, a.etf_costs)}
  </div>`;
  if (goal.projection) C.fan(document.getElementById('goalFan'), goal.projection);
  L.on(el, 'click', '[data-dim]', (e, b) => { L.store.set('an.dim', b.dataset.dim); L.pf.analyse(el); });
  L.on(el, 'click', '#anLt', () => { L.store.set('an.lt', !lt); L.pf.analyse(el); });
  bindRebalance(el); bindGoal(el); bindTax(el, a.tax);
  L.on(el, 'click', '[data-rp]', () => L.riskProfile.open(() => { L.forget('/api/analytics'); L.pf.analyse(el, true); }));
};
/* Scénarios : chocs hypothétiques, puis crises passées rejouées sur les lignes d'aujourd'hui */
function scenGroup(title, list) {
  if (!list.length) return '';
  return `<div class="k-l" style="margin:${title.startsWith('Chocs') ? '0' : '14px'} 0 2px">${title}</div>` + list.map(s => `<details class="li" style="display:block"><summary style="display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none">
        <div class="main"><div class="t1">${L.esc(s.label)}${s.period ? ` <span class="muted" style="font-weight:400">· ${L.esc(s.period)}</span>` : ''}</div><div class="t2">${s.what ? L.esc(s.what[0].toUpperCase() + s.what.slice(1)) + ' ; ' : ''}${L.esc(s.method)}</div></div><div class="end"><div class="dn">${L.m(F.eurS(s.impact_eur))}</div><div class="dn" style="font-size:12px">${F.pct(s.impact_pct, 1)}</div></div></summary>
        ${(s.lines || []).length ? `<div style="padding:8px 0 4px 0">${C.dbars(s.lines.map(l => ({ label: `${l.name} (bêta ${F.n(l.beta, 2)})`, v: l.impact_eur })))}</div>` : ''}</details>`).join('');
}
/* Qui porte le risque : poids de chaque ligne face à sa part de la volatilité du portefeuille */
function riskCard(r) {
  if (!r || !r.available) return '';
  const mx = Math.max(...r.lines.map(l => Math.max(l.weight_pct, l.risk_pct)), 1);
  return card('c7', 'Qui porte le risque', `<div class="stat-row" style="margin-bottom:12px">${stat('Volatilité', F.pctU(r.vol, 1), 'sur 1 an', 'Écart-type annualisé des variations de la valeur du portefeuille sur un an (même mesure que le bilan de santé). Les parts du risque viennent des rendements hebdomadaires de chaque ligne.')}${stat('3 premières lignes', F.pctU(r.top3_risk_pct, 0), 'du risque total')}${r.div_ratio ? stat('Diversification', '×' + F.n(r.div_ratio, 2), 'risque évité par les écarts entre lignes', 'Somme des volatilités pondérées divisée par la volatilité du portefeuille : 1 = aucune diversification.') : ''}</div>
    ${r.lines.map(l => `<div class="rk"><span class="lbl" title="${L.esc(l.name)}">${L.esc(l.name)}</span><span class="bars" aria-hidden="true"><i class="rk-w" style="width:${Math.max(1.5, l.weight_pct / mx * 100)}%"></i><i class="rk-r" style="width:${Math.max(1.5, l.risk_pct / mx * 100)}%"></i></span>
      <span class="v">${F.pctU(l.weight_pct, 0)} → <b>${F.pctU(l.risk_pct, 0)}</b></span></div>`).join('')}
    <div class="legend" style="margin-top:8px"><span><i style="background:var(--ink3)"></i>poids dans le portefeuille</span><span><i style="background:var(--violet)"></i>part du risque</span></div>
    <p class="note" style="margin-top:6px">Part du risque = poids × lien de la ligne avec l'ensemble du portefeuille (covariance), en devise de cotation.${r.coverage_pct < 99.5 ? ` Lignes mesurées : ${F.pctU(r.coverage_pct, 0)} de la valeur ; sans historique : ${L.esc(r.unmeasured.join(', '))}.` : ''}</p>`,
    `<button class="btn sm p" data-sim="sell" data-sim-uid="${L.esc((r.lines.find(l => l.uid) || {}).uid || '')}" data-sim-run="0">${L.icon('spark')}Simuler une opération</button>`);
}
/* Profil de risque : fourchette de volatilité du questionnaire face au portefeuille */
function profileCard(p) {
  if (!p) return '';
  if (!p.set) return card('c5', 'Profil de risque', `<p class="ink2" style="font-size:13.5px">Six questions (horizon, réaction à une baisse, perte supportable…) donnent un profil et une fourchette de volatilité, comme le questionnaire MIF2 des banques. LUMIO situe ensuite votre portefeuille dans cette fourchette.</p>
    <button class="btn p sm" data-rp style="margin-top:12px">Définir mon profil</button>`);
  const P = p.profiles, cur = p.profile.index;
  let pos = null;
  if (p.vol != null) {
    let i = P.findIndex(x => p.vol < x.vol_max); if (i < 0) i = P.length - 1;
    const seg = P[i];
    const hi = Math.min(seg.vol_max, 35);
    pos = Math.min(99, ((i + Math.min(1, (p.vol - seg.vol_min) / Math.max(1, hi - seg.vol_min))) / P.length) * 100);
  }
  return card('c5', 'Profil de risque', `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><b style="font-size:20px;font-weight:600">${L.esc(p.profile.label)}</b><span class="note">volatilité de ${p.profile.vol_max < 100 ? `${p.profile.vol_min} à ${p.profile.vol_max} %` : `plus de ${p.profile.vol_min} %`} · questionnaire du ${F.date(p.date)}</span></div>
    <div class="prf-band" role="img" aria-label="Profil ${L.esc(p.profile.label)}${p.vol != null ? ', portefeuille à ' + F.pctU(p.vol, 1) : ''}">${P.map((x, i) => `<i class="${i === cur ? 'on' : ''}" title="${L.esc(x.label)}"></i>`).join('')}
      ${P.map((x, i) => i && (pos == null || Math.abs(i / P.length * 100 - pos) > 7) ? `<span class="prf-t" style="left:${i / P.length * 100}%">${x.vol_min} %</span>` : '').join('')}
      ${pos != null ? `<span class="prf-mk" style="left:${pos}%"><b>${F.pctU(p.vol, 1)}</b></span>` : ''}</div>
    ${p.status ? `<div class="li"><span class="st ${p.status}">${{ ok: '✓', warn: '!', alert: '✕' }[p.status]}</span><div class="main"><div class="t2">${L.esc(p.text)}</div></div></div>` : '<p class="note">Volatilité du portefeuille pas encore mesurable (moins d\'un an d\'historique).</p>'}
    ${p.loss_text ? `<div class="li"><span class="st ${p.loss_status}">${p.loss_status === 'ok' ? '✓' : '!'}</span><div class="main"><div class="t2">${L.esc(p.loss_text)}</div></div></div>` : ''}
    ${p.capped_by ? `<p class="note" style="margin-top:6px">Profil plafonné par ${L.esc(p.capped_by)}, comme dans les questionnaires bancaires.</p>` : ''}`,
    '<button class="btn sm" data-rp>Refaire le questionnaire</button>');
}
function rebalanceCard(rb, targets) {
  const rows = rb.rows || [];
  return `<section class="w c7" id="rbCard"><div class="w-h"><h2>Allocation cible et rééquilibrage</h2><div class="r"><button class="btn sm" id="rbEdit">${L.icon('edit')}Modifier les cibles</button></div></div>
    ${rows.length ? C.hbars(rows.map(r => ({ ...r })), { max: Math.max(60, ...rows.map(r => Math.max(r.pct, r.target_pct || 0))), target: true, fmt: (v, r) => `${F.pctU(v, 1)}${r.target_pct ? ` <span class="${Math.abs(r.drift_pct) > 5 ? 'warn' : 'muted'}" style="font-size:11.5px">${F.pt(r.drift_pct, 1)}</span>` : ''}` }) : ''}
    <p class="note" style="margin:6px 0 12px"><i style="display:inline-block;width:2px;height:10px;background:var(--ink);vertical-align:-1px;margin-right:5px"></i>cible · écart en points. Somme des cibles : ${F.pctU(rb.sum_targets, 0)}.</p>
    <div class="callout"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-weight:600">Répartir un apport sans rien vendre</b><input class="inp" id="rbAmt" type="number" min="0" step="50" value="${L.esc(rb.contribution || 500)}" style="width:120px;height:34px" aria-label="Montant de l'apport"><span>€</span><button class="btn sm p" id="rbGo">Calculer</button></div>
      ${(rb.contribution_plan || []).length ? `<div style="margin-top:10px">${rb.contribution_plan.map(x => `<div class="li"><div class="main"><div class="t1">${L.esc(x.label)}</div></div><span class="end">${L.m(F.eur(x.amount, 0))}</span></div>`).join('')}</div>` : '<div class="note" style="margin-top:8px">Aucune catégorie sous sa cible.</div>'}
      <p class="note" style="margin-top:6px">Aucune vente : aucune plus-value imposable déclenchée.</p></div>
    <div id="rbForm" hidden></div></section>`;
}
function bindRebalance(el) {
  const go = document.getElementById('rbGo');
  if (go) go.onclick = async () => { L.store.set('rb.amount', +document.getElementById('rbAmt').value || 0); L.forget('/api/rebalance'); L.pf.analyse(el); };
  const ed = document.getElementById('rbEdit');
  if (ed) ed.onclick = async () => {
    const t = await L.get('/api/targets', 0, true); const a = await getAna();
    const labels = [...new Set([...(a.allocation.sector || []).map(r => r.label), ...Object.keys(t.weights || {})])];
    const f = document.getElementById('rbForm'); f.hidden = false;
    f.innerHTML = `<div class="sec" style="margin-top:14px"><div class="frm">${labels.map(l => `<label class="fld"><span>${L.esc(l)}</span><input class="inp" type="number" min="0" max="100" step="1" data-tw="${L.esc(l)}" value="${L.esc(t.weights?.[l] ?? 0)}"></label>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><button class="btn p" id="rbSave">Enregistrer</button><span class="note" id="rbSum"></span></div></div>`;
    const sum = () => { const s = L.qsa('[data-tw]', f).reduce((x, i) => x + (+i.value || 0), 0); document.getElementById('rbSum').textContent = `Total : ${F.n(s, 0)} % ${Math.abs(s - 100) <= 1 ? '✓' : '(doit faire 100 %)'}`; return s; };
    f.oninput = sum; sum();
    document.getElementById('rbSave').onclick = async () => {
      const w = {}; L.qsa('[data-tw]', f).forEach(i => { if (+i.value > 0) w[i.dataset.tw] = +i.value; });
      try { await L.api('/api/targets', { method: 'PUT', body: { by: 'sector', weights: w } }); L.toast('Cibles enregistrées'); L.forget('/api/rebalance'); L.forget('/api/analytics'); L.pf.analyse(el); } catch (e) { L.toast(e.message, true); }
    };
  };
}
function goalCard(g) {
  const s = g.settings || {}, p = g.projection || {};
  return `<section class="w c5"><div class="w-h"><h2>Objectif patrimonial</h2></div>
    <div class="frm" style="grid-template-columns:repeat(3,1fr)"><label class="fld"><span>Objectif (€)</span><input class="inp" id="gT" type="number" min="1000" step="1000" value="${L.esc(s.target)}"></label>
      <label class="fld"><span>Versement / mois</span><input class="inp" id="gM" type="number" min="0" step="50" value="${L.esc(s.monthly)}"></label>
      <label class="fld"><span>Horizon (ans)</span><input class="inp" id="gY" type="number" min="1" max="50" value="${L.esc(s.years)}"></label></div>
    <button class="btn sm" id="gSave" style="margin-top:10px">Mettre à jour</button>
    <div class="stat-row" style="margin-top:14px">${stat('Probabilité d\'atteinte', `<span class="${p.probability >= 60 ? 'up' : p.probability >= 40 ? 'warn' : 'dn'}">${F.pctU(p.probability, 0)}</span>`, `en ${s.years} ans`)}${stat('Médiane', L.m(F.k(p.p50 || 0)))}${stat('Scénario prudent', L.m(F.k(p.p10 || 0)), '9 chances sur 10 au-dessus')}</div>
    <div id="goalFan" style="margin-top:10px"></div>
    <div class="legend" style="margin-top:4px"><span><i class="ln" style="background:${L.P.acc}"></i>médiane</span><span><i style="background:rgba(167,139,250,.35)"></i>8 scénarios sur 10</span><span><i class="dash"></i>versements cumulés</span></div>
    ${p.real ? `<div class="callout" style="margin-top:10px">En euros d'aujourd'hui (inflation de ${F.frU(p.assumption?.inflation, 0)} par an) : médiane ${L.m(F.k(p.real.p50))}, scénario prudent ${L.m(F.k(p.real.p10))} ; objectif atteint en pouvoir d'achat dans ${F.pctU(p.real.probability, 0)} des scénarios.</div>` : ''}
    <p class="note" style="margin-top:6px">Monte-Carlo : ${F.frU(p.assumption?.expected_return, 1)}/an attendu (prudent), volatilité ${F.frU(p.assumption?.volatility, 1)} mesurée sur vos ${p.history_months || 0} derniers mois. Projection, pas une promesse.</p></section>`;
}
function bindGoal(el) {
  const b = document.getElementById('gSave'); if (!b) return;
  b.onclick = async () => {
    try { await L.api('/api/goal', { method: 'PUT', body: { target: +document.getElementById('gT').value, monthly: +document.getElementById('gM').value, years: +document.getElementById('gY').value } }); L.forget('/api/goal'); L.forget('/api/analytics'); L.toast('Objectif mis à jour'); L.pf.analyse(el); } catch (e) { L.toast(e.message, true); }
  };
}
function taxCard(t) {
  if (!t) return '';
  const yr = L.store.get('tax.year', t.year);
  const tmi = L.store.get('pf.tmi', null);
  const ba = t.bareme;
  const lossY = Object.entries(t.losses_left || {});
  return `<section class="w c7" id="taxCard"><div class="w-h"><h2>Fiscalité ${yr} (compte-titres)</h2><div class="r">
      <select class="sel" id="taxY" style="width:auto;height:30px">${[t.year, t.year - 1, t.year - 2].map(y => `<option ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <label class="note" style="display:flex;gap:6px;align-items:center">TMI <select class="sel" id="taxTmi" style="width:auto;height:30px"><option value="">—</option>${[0, 11, 30, 41, 45].map(v => `<option value="${v}" ${tmi === v ? 'selected' : ''}>${v} %</option>`).join('')}</select></label></div></div>
    <div id="taxBody">${taxBody(t)}</div>
    <details style="margin-top:14px"><summary class="lnk" style="cursor:pointer">Contrôler l'IFU de Trade Republic</summary>
      <p class="note" style="margin:8px 0">Saisissez les montants de l'IFU (imprimé fiscal unique) de l'année choisie : LUMIO signale les écarts avec ses calculs.</p>
      <div class="frm"><label class="fld"><span>Plus-values de cession (case 3VG/3VH)</span><input class="inp" type="number" step="0.01" id="ifuG"></label><label class="fld"><span>Dividendes bruts (2DC + 2TS)</span><input class="inp" type="number" step="0.01" id="ifuD"></label>
        <label class="fld"><span>Intérêts (2TR)</span><input class="inp" type="number" step="0.01" id="ifuI"></label><label class="fld"><span>Crédit d'impôt (2AB)</span><input class="inp" type="number" step="0.01" id="ifuC"></label></div>
      <button class="btn sm" id="ifuGo" style="margin-top:10px">Comparer</button><div id="ifuRes" style="margin-top:10px"></div></details>
    ${lossY.length ? `<p class="note" style="margin-top:10px">Moins-values reportables : ${lossY.map(([y, v]) => `${L.m(F.eur(v))} (${y}, utilisable jusqu'en ${t.losses_expiry?.[y] || +y + 10})`).join(' · ')}.</p>` : ''}
    ${ba ? '' : ''}<p class="note" style="margin-top:8px">${L.esc(t.note || '')}</p></section>`;
}
function taxBody(t) {
  const row = (l, base, tax) => `<tr><td class="l">${l}</td><td>${L.m(F.eur(base))}</td><td><b>${L.m(F.eur(tax))}</b></td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Revenu</th><th>Montant</th><th>Impôt estimé</th></tr></thead><tbody>
    ${row(`Plus-values (PFU ${F.frU(t.rate_gains, 1)})${t.realized_gain !== t.taxable_gain ? ' · après moins-values' : ''}`, t.taxable_gain, t.pfu_on_gains)}
    ${row(`Dividendes bruts (PFU ${F.frU(t.rate, 1)}, crédit d'impôt de ${L.m(F.eur(t.tax_credit))} déduit${t.withheld_france ? `, acompte français de ${L.m(F.eur(t.withheld_france))} déduit` : ''})`, t.dividends_gross, t.pfu_on_dividends)}
    ${row(`Intérêts bruts (PFU ${F.frU(t.rate, 1)}${t.interest_withheld ? `, ${L.m(F.eur(t.interest_withheld))} déjà prélevés` : ''})`, t.interest, t.pfu_on_interest)}
    </tbody><tfoot><tr><td class="l"><b>Total au PFU</b></td><td></td><td><b>${L.m(F.eur(t.total))}</b></td></tr></tfoot></table></div>
    <p class="note" style="margin-top:6px">Crédit d'impôt calculé versement par versement : retenue étrangère imputable dans la limite de 15 % du brut et de l'impôt français sur ce dividende (12,8 % au PFU).</p>
    ${t.bareme ? `<div class="callout" style="margin-top:10px">Option barème à ${F.pctU(t.bareme.tmi, 0)} : <b>${L.m(F.eur(t.bareme.total))}</b> → <b class="${t.bareme.better === 'PFU' ? '' : 'up'}">${t.bareme.better === 'PFU' ? 'le PFU reste plus avantageux' : 'le barème serait plus avantageux'}</b> (abattement de 40 % sur les dividendes ; l'option vaut pour tous les revenus du foyer de l'année).</div>` : '<p class="note" style="margin-top:8px">Indiquez votre tranche marginale (TMI) pour comparer avec l\'option pour le barème.</p>'}
    ${(t.envelopes?.pea_excluded || []).length ? `<p class="note" style="margin-top:8px">PEA exclus (imposés à la sortie) : ${t.envelopes.pea_excluded.map(L.esc).join(', ')}.</p>` : ''}`;
}
function bindTax(el, t0) {
  const y = document.getElementById('taxY'), m = document.getElementById('taxTmi'); if (!y) return;
  const reload = async () => {
    L.store.set('tax.year', +y.value); L.store.set('pf.tmi', m.value === '' ? null : +m.value);
    try { const t = await L.api(`/api/tax?year=${y.value}${m.value !== '' ? '&tmi=' + m.value : ''}`); L.put('taxBody', taxBody(t)); el._tax = t; document.querySelector('#taxCard h2').textContent = `Fiscalité ${y.value} (compte-titres)`; } catch (e) { L.toast(e.message, true); }
  };
  y.onchange = reload; m.onchange = reload;
  if (L.store.get('tax.year', t0.year) !== t0.year) reload();
  document.getElementById('ifuGo').onclick = async () => {
    const t = el._tax || await L.api(`/api/tax?year=${y.value}`);
    const cmp = [['Plus-values', +document.getElementById('ifuG').value, t.realized_gain], ['Dividendes bruts', +document.getElementById('ifuD').value, t.dividends_gross], ['Intérêts', +document.getElementById('ifuI').value, t.interest], ['Crédit d\'impôt', +document.getElementById('ifuC').value, t.tax_credit]];
    if (!document.getElementById('ifuRes')) return;
    document.getElementById('ifuRes').innerHTML = `<table class="tbl"><thead><tr><th class="l">Rubrique</th><th>IFU</th><th>LUMIO</th><th>Écart</th></tr></thead><tbody>${cmp.map(([l, ifu, lu]) => {
      const d = ifu - lu; const ok = Math.abs(d) <= 1;
      return `<tr><td class="l">${l}</td><td>${L.m(F.eur(ifu))}</td><td>${L.m(F.eur(lu))}</td><td class="${ok ? 'up' : 'warn'}">${ok ? '✓' : L.m(F.eurS(d, 2))}</td></tr>`;
    }).join('')}</tbody></table><p class="note" style="margin-top:6px">Un écart vient le plus souvent d'une opération absente de l'export (transfert, opération sur titres) : voyez le journal d'import.</p>`;
  };
}
function feesCard(f, ec) {
  if (!f) return '';
  return card('c5', 'Frais', `<div class="stat-row">${stat('Frais d\'ordres', L.m(F.eur(f.total)), `${f.orders} ordres, ${L.m(F.eur(f.per_order))} par ordre`)}${stat('Poids des frais', F.pctU(f.pct_of_invested, 2), 'des montants achetés')}${stat('Gestion des ETF', L.m(F.eur(ec?.annual_total || 0)), 'par an (TER, dans le cours)')}</div>
    <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Année</th><th>Frais d'ordres</th></tr></thead><tbody>${Object.entries(f.by_year || {}).reverse().map(([y, v]) => `<tr><td>${y}</td><td>${L.m(F.eur(v))}</td></tr>`).join('')}</tbody></table></div>
    ${(ec?.rows || []).length ? `<div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>ETF / ETP</th><th>TER</th><th>Coût annuel</th></tr></thead><tbody>${ec.rows.map(r => `<tr><td>${L.esc(r.name)}</td><td>${F.pctU(r.ter, 2)}</td><td>${L.m(F.eur(r.annual_cost))}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
}

/* ══════════ Opérations ══════════ */
const FIELDS = {
  buy: ['isin', 'ticker', 'name', 'shares', 'price', 'fees'], sell: ['isin', 'ticker', 'name', 'shares', 'price', 'fees', 'taxes'],
  dividend: ['isin', 'name', 'amount', 'taxes'], interest: ['amount'], deposit: ['amount'], withdrawal: ['amount'], fee: ['amount'], tax: ['amount'],
  split: ['isin', 'name', 'ratio'], transfer_in: ['isin', 'ticker', 'name', 'shares', 'price'], transfer_out: ['isin', 'name', 'shares'],
};
const FLBL = { isin: 'ISIN', ticker: 'Ticker Yahoo (facultatif)', name: 'Nom', shares: 'Nombre de parts', price: 'Prix unitaire (€)', fees: 'Frais (€)', taxes: 'Impôts (€)', amount: 'Montant (€)', ratio: 'Ratio (ex. 10:1)' };
L.pf.operations = async (el, force = false, editId = null) => {
  let ops, acc, log;
  try { [ops, acc, log] = await Promise.all([L.get('/api/operations', 0, true), L.get('/api/accounts', 30000, force), L.get('/api/import-log', 60000, force)]); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const lab = ops.labels || {};
  const ed = editId ? ops.items.find(o => o.id === editId) : null;
  const typ = ed ? ed.type : (el._typ || 'buy');
  const today = new Date().toISOString().slice(0, 10);
  // Prix unitaire : celui saisi (le montant d'un achat inclut les frais, celui d'une vente les retranche)
  const unit = (o) => o.price != null ? o.price : !o.shares ? '' : o.type === 'buy' ? (o.value_eur - (o.fees || 0)) / Math.abs(o.shares)
    : o.type === 'sell' ? (o.value_eur + (o.fees || 0) + (o.taxes || 0)) / Math.abs(o.shares) : o.value_eur / Math.abs(o.shares);
  const val = (k) => ed ? (k === 'date' ? new Date(ed.ts * 1000).toISOString().slice(0, 10) : k === 'shares' ? Math.abs(ed.shares) : k === 'price' ? unit(ed) : k === 'amount' ? ed.value_eur : ed[k] ?? '') : '';
  el.innerHTML = `<div class="cards">
    ${card('c4', 'Comptes', (acc.accounts || []).map(a => `<div class="li"><div class="main"><div class="t1">${L.esc(a.account)}</div><div class="t2">${a.count} ligne${a.count > 1 ? 's' : ''}${/pea/i.test(a.account) ? ' · PEA' : ' · compte-titres'}</div></div><span class="end">${L.m(F.eur(a.value, 0))}</span></div>`).join('') + '<p class="note" style="margin-top:8px">Trade Republic est importé par pytr. Les autres comptes (PEA, autre courtier, wallet) se saisissent ici ; un nom contenant « PEA » est exclu de l\'estimation fiscale annuelle.</p>')}
    <section class="w c8"><div class="w-h"><h2>${ed ? 'Modifier l\'opération' : 'Saisir une opération'}</h2>${ed ? '<div class="r"><button class="btn sm g" id="opCancel">Annuler</button></div>' : ''}</div>
      <form id="opForm" class="frm" autocomplete="off">
        <label class="fld"><span>Type</span><select class="sel" name="type" id="opType">${(ops.types || []).map(t => `<option value="${t}" ${t === typ ? 'selected' : ''}>${L.esc(lab[t] || t)}</option>`).join('')}</select></label>
        <label class="fld"><span>Date</span><input class="inp" type="date" name="date" max="${today}" value="${L.esc(val('date') || today)}" required></label>
        <label class="fld"><span>Compte</span><input class="inp" name="account" list="accList" value="${L.esc(ed ? ed.account : 'Trade Republic')}" required><datalist id="accList">${(ops.accounts || []).map(a => `<option value="${L.esc(a)}">`).join('')}<option value="PEA"></datalist></label>
        ${(FIELDS[typ] || []).map(k => `<label class="fld"><span>${FLBL[k]}</span><input class="inp" name="${k}" ${['shares', 'price', 'fees', 'taxes', 'amount'].includes(k) ? 'inputmode="decimal"' : ''} value="${L.esc(val(k))}" ${['isin', 'shares', 'price', 'amount', 'ratio'].includes(k) && !(k === 'price' && typ === 'transfer_in') ? 'required' : ''} ${k === 'isin' ? 'maxlength="12" pattern="[A-Za-z]{2}[A-Za-z0-9]{10}" placeholder="FR0000121014"' : ''}></label>`).join('')}
        <label class="fld" style="grid-column:1/-1"><span>Note</span><input class="inp" name="note" value="${L.esc(val('note'))}" maxlength="200"></label>
        <div style="grid-column:1/-1;display:flex;gap:10px;align-items:center"><button class="btn p" type="submit">${ed ? 'Enregistrer' : 'Ajouter'}</button><span class="note" id="opMsg"></span></div>
      </form></section>
    ${card('c12', `Opérations saisies (${ops.items.length})`, ops.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th class="l">Type</th><th class="l">Compte</th><th class="l">Valeur</th><th>Parts</th><th>Montant</th><th></th></tr></thead><tbody>
      ${ops.items.map(o => `<tr><td>${F.date(o.ts)}</td><td class="l">${L.esc(lab[o.type] || o.type)}${o.ratio ? ' ' + F.n(o.ratio, o.ratio % 1 ? 2 : 0) + ':1' : ''}${o.invalid ? ' <span class="tag dn" title="Nombre illisible : opération exclue des calculs">illisible</span>' : ''}</td><td class="l">${L.esc(o.account)}</td><td class="l">${L.esc(o.name)}</td><td>${o.shares ? L.m(F.qty(o.shares)) : '—'}</td><td>${L.m(F.eur(o.value_eur))}</td>
        <td><button class="ibtn" data-ope="${o.id}" title="Modifier" aria-label="Modifier l'opération">${L.icon('edit')}</button><button class="ibtn" data-opd="${o.id}" title="Supprimer" aria-label="Supprimer l'opération">${L.icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune opération saisie. Les opérations Trade Republic arrivent de l\'export pytr.</div>')}
    ${card('c6', 'Journal d\'import', `<div class="stat-row">${Object.entries(log.imported || {}).map(([k, v]) => stat(L.esc(lab[k] || k), String(v))).join('')}</div>
      <p class="note" style="margin-top:10px">Sources : export pytr ${log.sources?.pytr ? '✓' : '✕ (lancez maj.bat)'} · dossier data/import : ${(log.sources?.import_dir || []).length} fichier(s) · saisies : ${log.sources?.manual || 0}.</p>
      ${log.skipped_count ? `<div class="callout" style="margin-top:10px"><b>${log.skipped_count} ligne(s) d'opérations écartée(s)</b>${log.skipped.slice(0, 10).map(s => `<div class="note">${L.esc(typeof s === 'string' ? s : `${s.file || ''}${s.line ? ', ligne ' + s.line : ''} : ${s.reason || ''}${s.label ? ' (' + s.label + ')' : ''}`)}</div>`).join('')}</div>` : '<p class="note" style="margin-top:6px">Aucune ligne d\'opération écartée.</p>'}
      ${(log.portfolio_skipped || []).length ? `<div class="callout" style="margin-top:10px"><b>${log.portfolio_skipped.length} ligne(s) du portefeuille écartée(s)</b>${log.portfolio_skipped.slice(0, 8).map(s => `<div class="note">${L.esc(`${s.file}, ligne ${s.line} : ${s.reason}${s.label ? ' (' + s.label + ')' : ''}`)}</div>`).join('')}</div>` : ''}`)}
    ${card('c6', 'Exporter mes données', `<p class="ink2" style="font-size:13.5px">Fichiers lisibles dans Excel (séparateur « ; », virgule décimale) ou JSON complet.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><a class="btn" href="/api/export?format=csv&what=positions" download>${L.icon('dl')}Positions (CSV)</a><a class="btn" href="/api/export?format=csv&what=transactions" download>${L.icon('dl')}Opérations (CSV)</a><a class="btn" href="/api/export?format=json" download>${L.icon('dl')}Tout (JSON)</a></div>`)}
  </div>`;
  const form = document.getElementById('opForm');
  document.getElementById('opType').onchange = (e) => { el._typ = e.target.value; L.pf.operations(el, false, editId && ed && ed.type === e.target.value ? editId : null); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      if (ed) await L.api('/api/operations/' + ed.id, { method: 'PUT', body }); else await L.api('/api/operations', { method: 'POST', body });
      L.toast(ed ? 'Opération modifiée' : 'Opération ajoutée'); L.forget(); await L.loadPortfolio(true); L.pf.operations(el, true);
    } catch (err) { L.put('opMsg', `<span class="dn">${L.esc(err.message)}</span>`); }
  };
  const cancel = document.getElementById('opCancel'); if (cancel) cancel.onclick = () => L.pf.operations(el);
  L.on(el, 'click', '[data-ope]', (e, b) => { L.pf.operations(el, false, b.dataset.ope); window.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' }); });
  L.on(el, 'click', '[data-opd]', async (e, b) => {
    if (!(await L.confirmBox('Supprimer cette opération ?', 'Supprimer'))) return;
    try { await L.api('/api/operations/' + b.dataset.opd, { method: 'DELETE' }); L.toast('Opération supprimée'); L.forget(); await L.loadPortfolio(true); L.pf.operations(el, true); } catch (err) { L.toast(err.message, true); }
  });
};
})();
