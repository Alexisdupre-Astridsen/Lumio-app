/* LUMIO — Le matin : ce qu'il y a à trancher aujourd'hui (tableau de bord).
   m4 · Liquidités : espèces non placées sur Trade Republic, montant à placer.
   m1 · À traiter ce matin : sorties, allègements, renforcements à étudier, placement des liquidités.
   m2 · À savoir ce matin : actualités importantes sur vos lignes, résultats, rendez-vous, marchés.
   m3 · État de vos lignes : un état par ligne, décidé par des règles écrites, et sa raison.
   Panneau « Détail » : graphique (cours, moyennes 50 et 200 jours, prix de revient, vos seuils,
   vos achats), RSI, indicateurs, arguments pour et contre, montants, thèse, et votre décision.
   Aide à la décision : LUMIO ne recommande rien et ne passe aucun ordre. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const esc = L.esc;
const S = { m: null, tries: 0, timer: 0, rng: '1y', d: null, charts: [] };
const ST = { sortie: 'out', alleger: 'cut', surveiller: 'watch', renforcer: 'add', ok: 'ok', placer: 'cash' };
const KIND1 = { sortie: 'Sortie à étudier', alleger: 'Allègement à étudier', renforcer: 'Renforcement à étudier', placer: 'Placement' };
const KINDS = { sortie: 'sortie', alleger: 'allègement', renforcer: 'renforcement', placer: 'placement' };
const ACTS = {
  sortie: ['vendre', 'alleger', 'conserver', 'reporter'], alleger: ['alleger', 'conserver', 'reporter'],
  renforcer: ['renforcer', 'conserver', 'reporter'], placer: ['placer', 'reporter'],
  line: ['conserver', 'surveiller', 'alleger', 'vendre', 'renforcer'],
};
const ACT = { vendre: 'Je sors', alleger: "J'allège", conserver: 'Je garde', renforcer: 'Je renforce', placer: 'Je place',
  surveiller: 'Je surveille', reporter: 'Demain' };
const ACTDONE = { vendre: 'Sortie décidée', alleger: 'Allègement décidé', conserver: 'Gardée', renforcer: 'Renforcement décidé',
  placer: 'Placement décidé', surveiller: 'Sous surveillance', reporter: 'Reporté à demain' };
const TREND = { haussiere: 'Haussière', baissiere: 'Baissière', indecise: 'Indécise', indeterminee: 'Non calculable',
  haussiere_ct: 'Haussière (court terme)', baissiere_ct: 'Baissière (court terme)' };
const RNG = [['3m', '3M'], ['6m', '6M'], ['1y', '1A'], ['2y', '2A'], ['5y', '5A']];
const calc = '<span class="rv-calc" title="Chiffre calculé par LUMIO à partir des cours et de vos règles">calculé</span>';
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const chip = (st, label) => `<span class="mt-st ${ST[st] || 'ok'}">${esc(label)}</span>`;
const done = el => { if (el) { el.removeAttribute('aria-busy'); el.classList.remove('sk-on'); } };
const ago = h => h == null ? '' : h < 1 ? 'à l\'instant' : h < 24 ? `il y a ${Math.round(h)} h` : h < 48 ? 'hier' : `il y a ${Math.round(h / 24)} j`;
const cur = (x, c, d) => x == null ? '—' : F.cur(x, c || 'EUR', d ?? (Math.abs(x) < 100 ? 2 : 0));
/* Niveaux du graphique : prix de revient (gris), seuil de perte (orange), recul (orange pointillé), prise de bénéfices (violet) */
const LVC = () => ({ pru: L.P.ink2, stop: L.P.down, take_profit: L.P.vio, drawdown: L.P.down });
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/* ── Chargement ── */
L.matin = {
  async load(force) {
    clearTimeout(S.timer);
    let m;
    try { m = await L.get('/api/matin', 50000, !!force); } catch (e) {
      ['m1', 'm2', 'm3', 'm4'].forEach(id => { const el = document.getElementById(id); if (el && el.querySelector('.sk')) { el.innerHTML = L.errBox(e, 'dash'); done(el); } });
      return;
    }
    S.m = m;
    if (m.empty) return;
    L.matin.renderAll();
    if ((m.pending || []).length && S.tries < 8 && document.getElementById('dash')) {
      S.tries += 1;
      S.timer = setTimeout(() => { if (document.getElementById('dash')) { L.forget('/api/matin'); L.quietly(() => L.matin.load(true)); } }, 6000);
    } else if (!(m.pending || []).length) S.tries = 0;
  },
  renderAll() { ['m1', 'm2', 'm3', 'm4'].forEach(id => L.matin.render(id)); },
  render(id) { if (!S.m || S.m.empty) return; ({ m1: renderQueue, m2: renderKnow, m3: renderLines, m4: renderCash })[id]?.(); },
  data: () => S.m,
  openLine: uid => openLine(uid),
  openCash: () => openCash(),
};

/* ── m4 · Liquidités ── */
function cashSource(c) {
  if (!c || c.amount == null) return 'disponible après la prochaine mise à jour Trade Republic';
  const when = c.ts ? `${F.dshort(c.ts)} à ${F.time(c.ts)}` : '';
  return c.source === 'manuel' ? `saisi par vous${when ? ' le ' + when : ''}` : c.source === 'demo' ? `démonstration${when ? ', relevé du ' + when : ''}`
    : `relevé Trade Republic${when ? ' du ' + when : ''}`;
}
function cashShort(c) {
  const d = c.ts ? F.dshort(c.ts) : '';
  return c.source === 'manuel' ? `saisi${d ? ' le ' + d : ''}` : c.source === 'demo' ? `démo${d ? ' du ' + d : ''}` : `relevé${d ? ' du ' + d : ''}`;
}
function renderCash() {
  const el = document.getElementById('m4'); const c = S.m?.cash; if (!el || !c) return;
  el.classList.add('click');
  el.innerHTML = c.known ? `<div class="kpi"><span class="k-l">Liquidités ${L.tipTxt('Espèces non placées sur votre compte Trade Republic, relevées à chaque mise à jour. Vous pouvez garder une réserve : elle ne compte pas dans le montant à placer.')}</span>
      <span class="k-v m">${F.eur(c.amount, 0)}</span>
      <span class="k-d">${c.to_place > 0 ? `à placer : <b>${L.m(F.eur(c.to_place, 0))}</b>` : '<span class="muted">tout est en réserve</span>'}</span>
      <span class="k-s" title="${esc(cap1(cashSource(c)))}">${esc(cashShort(c))}</span></div>`
    : `<div class="kpi"><span class="k-l">Liquidités</span><span class="k-v muted">—</span>
      <span class="k-d muted" style="font-weight:500">non relevées</span><span class="k-s">${esc(cashSource(c))} ; ou saisissez-les</span></div>`;
  el.setAttribute('role', 'button'); el.tabIndex = 0;
  el.setAttribute('aria-label', 'Liquidités et placements : ouvrir le détail');
  done(el);
}

/* ── m1 · À traiter ce matin ── */
function calcLine(q) {
  const c = q.calc || {};
  if (c.sale) {
    const s = c.sale;
    const sh = s.shares != null ? ` (${shares(s.shares)})` : '';
    return `${q.kind === 'sortie' ? 'Sortie complète' : 'Vendre'} ≈ ${L.m(F.eur(s.amount, 0))}${sh}${s.why ? ' ' + esc(s.why) : ''} · ${s.envelope === 'PEA' ? 'dans le PEA : pas d\'impôt à la vente' : `impôt estimé ${L.m(F.eur(s.tax, 0))}`}`;
  }
  if (c.full) return `Sortie complète : ${L.m(F.eur(c.full.amount, 0))} · ${c.full.envelope === 'PEA' ? 'pas d\'impôt dans le PEA' : `impôt estimé ${L.m(F.eur(c.full.tax, 0))}`}`;
  if (c.buy) return `${esc(c.buy.plan.text)}${c.buy.cap != null ? ` · place sous vos limites : ${L.m(F.eur(c.buy.cap, 0))}` : ''}`;
  if (c.plan) return `${esc(c.plan.text)} (votre règle d'entrée)`;
  return '';
}
const actBtns = (id, kind) => (ACTS[kind] || []).map(a => `<button type="button" class="btn sm g" data-mtdo="${esc(id)}" data-act="${a}" title="${esc(actTitle(a))}">${ACT[a]}</button>`).join('');
const actTitle = a => { const d = (S.m?.actions || {})[a]; return a === 'reporter' ? 'Revient demain dans la liste' : d ? `Consigné dans le journal ; revient dans la liste dans ${d} jours, ou plus tôt si un fait nouveau tombe` : ''; };
const shares = x => F.n(x, Number.isInteger(+x) || x >= 10 ? 0 : 2) + ' ' + (x >= 2 ? 'parts' : 'part');
/* 7.5 : une ligne par décision, regroupées par type ; le détail (raisons, calculs, décision) s'ouvre
   au clic. Les 6 premières sont visibles, le reste se déplie. */
const QFIRST = 6;
const GROUP = { sortie: 'Sorties à étudier', alleger: 'Allègements à étudier', renforcer: 'Renforcements à étudier', placer: 'Placement des liquidités' };
function itemHtml(q, hide, rank) {
  const v = rank && q.enjeu ? `<span class="mt-qv mt-qe" title="Montant en jeu : ${esc(q.enjeu.pct != null ? F.pctU(q.enjeu.pct, 1) + ' du portefeuille' : '')}">${L.m(F.eur(q.enjeu.eur, 0))}<span>en jeu</span></span>`
    : q.kind === 'placer' ? `<span class="mt-qv">${S.m?.cash?.to_place != null ? L.m(F.eur(S.m.cash.to_place, 0)) : ''}</span>`
    : `<span class="mt-qv">${F.pctU(q.weight, 1)}<span class="${L.cls(q.pnl_pct)}">${F.pct(q.pnl_pct, 0)}</span></span>`;
  const open = q.kind === 'placer' ? 'data-mtcash' : `data-mtline="${esc(q.uid)}"`;
  const more = q.reasons.length > 1 ? `<span class="mt-qm" title="${esc(q.reasons.slice(1).map(r => r.replace(/\*\*/g, '')).join(' · '))}">+${q.reasons.length - 1}</span>` : '';
  const name = q.kind === 'placer' ? q.title : q.name;
  return `<button type="button" class="mt-qr ${ST[q.kind]}${rank ? ' mt-top' : ''}" ${open}${hide ? ' data-mtx hidden' : ''} aria-label="${rank ? `Priorité ${rank}, ` : ''}${esc(KIND1[q.kind])} : ${esc(name)}">
    ${rank ? `<span class="mt-rk" aria-hidden="true">${rank}</span>` : ''}<span class="mt-qn">${esc(name)}${rank ? `<small>${esc(KIND1[q.kind])}</small>` : ''}</span>
    <span class="mt-qw" title="${esc((q.reasons[0] || '').replace(/\*\*/g, ''))}">${L.mText(q.reasons[0] || '')}${more}</span>
    ${v}${L.icon('chev')}</button>`;
}
/* 8.1 : depuis votre dernière visite sur cet appareil : valeur, décisions apparues et sorties de la
   liste. Calculé une fois par chargement (stable pendant la session) ; la visite est notée quand la
   page passe en arrière-plan, ou au bout de 15 secondes. */
const VISIT = 'mt.visite';
let SINCE = null;
const keepVisit = () => { const m = S.m; if (m && !m.empty) L.store.set(VISIT, { ts: Date.now() / 1000, value: m.kpis?.total_value ?? null, ids: (m.queue || []).map(q => q.id) }); };
document.addEventListener('visibilitychange', () => { if (document.hidden) keepVisit(); });
const whenV = t => {
  const d = new Date(t * 1000), now = new Date(), y = new Date(now.getTime() - 864e5);
  return d.toDateString() === now.toDateString() ? `aujourd'hui à ${F.time(t)}` : d.toDateString() === y.toDateString() ? `hier à ${F.time(t)}` : `le ${F.dshort(t)}`;
};
function sinceLine(m) {
  if (SINCE === null) {
    const prev = L.store.get(VISIT, null);
    SINCE = prev && prev.ts && Date.now() / 1000 - prev.ts > 1800 ? prev : false;
    setTimeout(keepVisit, 15000);
  }
  if (!SINCE) return '';
  const ids = new Set(SINCE.ids || []), cur = m.queue || [];
  const fresh = cur.filter(q => !ids.has(q.id)).length, gone = [...ids].filter(id => !cur.some(q => q.id === id)).length;
  const dv = SINCE.value != null && m.kpis?.total_value != null ? m.kpis.total_value - SINCE.value : null;
  const parts = [];
  if (dv != null) parts.push(`valeur ${L.m(F.eurS(dv, 0))}`);
  parts.push(fresh ? `<b>${fresh} nouvelle${fresh > 1 ? 's' : ''} décision${fresh > 1 ? 's' : ''}</b>` : 'aucune nouvelle décision');
  if (gone) parts.push(`${gone} sortie${gone > 1 ? 's' : ''} de la liste`);
  return `<p class="mt-since">Depuis votre dernière visite (${whenV(SINCE.ts)}) : ${parts.join(', ')}.</p>`;
}
function renderQueue() {
  const el = document.getElementById('m1'); const m = S.m; if (!el || !m) return;
  const q = m.queue || [], dn = m.done || [];
  const cnt = Object.entries(m.counts || {}).filter(([, n]) => n).map(([k, n]) => `<span class="mt-cn ${ST[k]}">${n} ${k === 'placer' ? 'placement' : KINDS[k] + (n > 1 ? 's' : '')}</span>`).join('');
  const watch = (m.states || {}).surveiller || 0;
  const all = L.store.get('mt.qall', false);
  // 8.0 : les trois priorités du jour (montant en jeu × urgence), puis le reste, replié par défaut
  const tops = q.filter(x => x.top).sort((a, b) => a.top - b.top);
  const first = tops.length ? 0 : QFIRST;
  const others = tops.length ? q.filter(x => !x.top) : q;
  let i = 0;
  const groups = ['sortie', 'alleger', 'renforcer', 'placer'].map(k => {
    const items = others.filter(x => x.kind === k); if (!items.length) return '';
    const rows = items.map(x => itemHtml(x, !all && i++ >= first)).join('');
    const hiddenAll = !all && i - items.length >= first;
    return `<div class="mt-qg ${ST[k]}"${hiddenAll ? ' data-mtx hidden' : ''}><div class="mt-qh">${GROUP[k]}<span>${items.length}</span></div>${rows}</div>`;
  }).join('');
  const rest = Math.max(0, others.length - first);
  const topHtml = tops.length ? `<div class="mt-tops"><div class="mt-qh">${tops.length > 1 ? `Vos ${tops.length} priorités` : 'Votre priorité'}, par montant en jeu</div>${tops.map(x => itemHtml(x, false, x.top)).join('')}</div>` : '';
  el.innerHTML = `<div class="w-h"><h2>À traiter ce matin</h2><div class="r mt-cnts">${cnt || '<span class="mt-cn ok">rien à trancher</span>'}</div></div>
    ${sinceLine(m)}${q.length ? `${topHtml}<div class="mt-ql">${groups}</div>
      ${rest ? `<button type="button" class="lnk mt-qmore" data-mtmore aria-expanded="${all}">${all ? 'Afficher moins' : tops.length ? `Ensuite : ${rest} autre${rest > 1 ? 's' : ''} à étudier, moins urgente${rest > 1 ? 's' : ''}` : `Voir les ${rest} autres`}</button>` : ''}`
      : `<div class="mt-empty">${L.icon('check')}<div><b>Rien à trancher ce matin.</b> Aucune de vos règles n'est franchie, aucune thèse n'a changé${m.cash?.known ? ', et vos liquidités sont placées ou en réserve' : ''}.${watch ? ` <button type="button" class="lnk" data-mtjump="m3">${plural(watch, 'ligne', 'lignes')} à surveiller</button>` : ''}</div></div>`}
    ${dn.length ? `<details class="mt-done"><summary>Déjà traité (${dn.length})</summary>${dn.map(x => `<div class="li"><div class="main"><div class="t1">${esc(x.title)}</div>
        <div class="t2">${ACTDONE[x.decided.action] || esc(x.decided.action)} le ${F.dshort(x.decided.ts)} · réexamen ${F.inDays(new Date(x.decided.until * 1000).toISOString().slice(0, 10))}${x.decided.note ? ` · « ${esc(x.decided.note)} »` : ''}</div></div>
        <button type="button" class="lnk" data-mtundo="${esc(x.decided.id)}">Annuler</button></div>`).join('')}</details>` : ''}
    <p class="note mt-foot">${L.statique ? '<b>Version en ligne : vos décisions s\'enregistrent sur le PC.</b> ' : ''}${L.coarse ? 'Touchez' : 'Cliquez sur'} une ligne pour voir ses raisons, les montants et décider. <span title="Une ligne entre dans la liste quand une de vos règles est franchie, quand sa thèse change, ou quand un renforcement est justifié par votre allocation ou un signal daté. Une décision la retire jusqu'à sa date de réexamen, sauf fait nouveau. ${esc(m.note)}" class="mt-how">Pourquoi ces lignes ?</span></p>`;
  done(el);
}

/* ── m2 · À savoir ce matin ── */
function renderKnow() {
  const el = document.getElementById('m2'); const k = S.m?.know; if (!el || !k) return;
  const pol = p => p > 0 ? 'up' : p < 0 ? 'dn' : '';
  const who = n => n.lines?.length ? `concerne ${n.lines.map(l => `${esc(l.name)} (${F.pctU(l.weight, 0)})`).join(', ')}` : n.why ? esc(n.why) : '';
  const res = r => r.surprise_pct != null
    ? `BPA ${F.n(r.eps_actual, 2)} contre ${F.n(r.eps_estimate, 2)} attendu (${F.pct(r.surprise_pct, 1)})`
    : 'chiffres publiés';
  el.innerHTML = `<div class="w-h"><h2>À savoir ce matin</h2></div>
    <p class="mt-head">${esc(k.headline)}</p>
    ${k.news.length ? `<div class="mt-news">${k.news.map(n => `<a class="mt-n" href="${L.url(n.link)}" target="_blank" rel="noopener noreferrer">
        <span class="mt-pol ${pol(n.pol)}" aria-label="${n.pol > 0 ? 'plutôt favorable' : n.pol < 0 ? 'plutôt défavorable' : 'à lire'}"></span>
        <span class="mt-nt"><b>${esc(n.title)}</b><span class="note">${esc(n.source || '')} · ${ago(n.age_h)}${who(n) ? ' · ' + who(n) : ''}</span></span></a>`).join('')}</div>` : ''}
    ${k.results.length ? `<h3 class="mt-sh">Résultats publiés</h3>${k.results.map(r => `<div class="mt-row"><b>${esc(r.name)}</b>${r.quarter ? ` <span class="muted">${esc(r.quarter)}</span>` : ''} : ${res(r)}${r.reaction_pct != null ? `, cours <span class="${L.cls(r.reaction_pct)}">${F.pct(r.reaction_pct, 1)}</span>` : ''}</div>`).join('')}` : ''}
    ${k.agenda.length ? `<h3 class="mt-sh">Cette semaine</h3>${k.agenda.map(e => `<div class="mt-row"><span class="mt-when">${e.days === 0 ? 'Aujourd\'hui' : e.days === 1 ? 'Demain' : F.dshort(e.date)}</span> ${esc(e.name)} : ${esc((e.label || '').toLowerCase())}${e.estimated ? ' (estimé)' : ''}</div>`).join('')}` : ''}
    ${k.markets.length ? `<div class="mt-mk">${k.markets.map(x => `<span>${esc(x.label)} <b class="${L.cls(x.change_pct_day)}">${F.pct(x.change_pct_day, 1)}</b></span>`).join('')}</div>` : ''}
    <a class="lnk mt-more" href="#/veille/actus">Toute l'actualité</a>`;
  done(el);
}

/* ── m3 · État de vos lignes ── */
const stCount = (k, n) => ({ sortie: n > 1 ? 'sorties à étudier' : 'sortie à étudier', alleger: n > 1 ? 'allègements à étudier' : 'allègement à étudier',
  surveiller: 'à surveiller', renforcer: n > 1 ? 'renforcements à étudier' : 'renforcement à étudier', ok: 'sans alerte' })[k] || '';
function stopDist(l) {
  const s = l.tech?.levels?.stop;
  return s ? `${F.pct(s.dist_pct, 0)}` : '—';
}
function renderLines() {
  const el = document.getElementById('m3'); const m = S.m; if (!el || !m) return;
  const order = ['sortie', 'alleger', 'surveiller', 'renforcer', 'ok'];
  const f = order.includes(L.store.get('mt.lf', '')) && m.states[L.store.get('mt.lf', '')] ? L.store.get('mt.lf', '') : '';
  const sum = order.filter(k => m.states[k]).map(k => `<button type="button" class="mt-cn ${ST[k]}${f === k ? ' on' : ''}" data-mtlf="${k}" aria-pressed="${f === k}">${m.states[k]} ${esc(stCount(k, m.states[k]))}</button>`).join('');
  const LFIRST = 8;
  const rowsAll = f ? m.lines.filter(l => l.state === f) : m.lines;
  const open = f || L.store.get('mt.lall', false);
  const rows = open ? rowsAll : rowsAll.slice(0, LFIRST);
  const why = l => {
    const side = l.state === 'renforcer' || l.state === 'ok' ? 'in' : 'out';
    const r = l.reasons.find(x => x.side === side) || l.reasons[0];
    return r ? L.mText(r.text) : '';
  };
  const trend = l => { const t = l.tech; if (!t) return '<span class="muted">—</span>'; const ic = t.trend?.startsWith('hauss') ? '▲' : t.trend?.startsWith('baiss') ? '▼' : '◆';
    return `<span class="mt-tr ${t.trend?.startsWith('hauss') ? 'up' : t.trend?.startsWith('baiss') ? 'dn' : ''}" title="${esc(TREND[t.trend] || '')}">${ic}</span> ${t.vs_sma200_pct != null ? F.pct(t.vs_sma200_pct, 0) : esc(TREND[t.trend] || '—')}`; };
  el.innerHTML = `<div class="w-h"><h2>État de vos lignes</h2><div class="r"><button type="button" class="lnk" data-mtrules>Comment l'état est décidé</button></div></div>
    <div class="mt-cnts mt-sum">${sum}</div>
    <div class="tbl-wrap"><table class="tbl mt-t"><thead><tr><th class="l">Ligne</th><th class="l">État</th><th>Poids</th><th>Plus ou moins-value</th>
      <th title="Cours par rapport à la moyenne 200 jours">Tendance</th><th title="RSI 14 jours : au-dessus de 70, hausse rapide ; au-dessous de 30, baisse rapide">RSI</th>
      <th title="Écart entre le cours et le cours qui franchirait votre seuil de perte">Seuil de perte</th><th class="l">Raison principale</th><th><span class="sr">Détail</span></th></tr></thead><tbody>
    ${rows.map(l => `<tr class="click" data-mtline="${esc(l.uid)}" tabindex="0" aria-label="${esc(l.name)} : ${esc(l.state_label)}">
      <td class="l"><b>${esc(l.name)}</b><span class="sub">${esc(l.theme || l.sector || '')}</span><span class="sub only-m">${F.pctU(l.weight, 1)} · <span class="${L.cls(l.pnl)}">${L.m(F.eurS(l.pnl, 0))}</span></span></td>
      <td class="l">${chip(l.state, l.state_label)}${l.wait ? `<span class="mt-wt" title="${esc(l.wait.text)}">${L.icon('clock')}</span>` : ''}</td>
      <td>${F.pctU(l.weight, 1)}</td>
      <td class="${L.cls(l.pnl)}">${L.m(F.eurS(l.pnl, 0))}<span class="sub"> ${F.pct(l.pnl_pct, 0)}</span></td>
      <td>${trend(l)}</td><td class="${l.tech?.rsi_zone === 'haut' ? 'warn' : l.tech?.rsi_zone === 'bas' ? 'up' : ''}">${l.tech?.rsi ?? '—'}</td>
      <td>${stopDist(l)}</td><td class="l mt-why">${why(l)}</td><td>${L.icon('chev')}</td></tr>`).join('')}
    </tbody></table></div>
    ${!f && rowsAll.length > LFIRST ? `<button type="button" class="lnk mt-qmore" data-mtlall aria-expanded="${!!open}">${open ? 'Afficher moins' : `Afficher les ${rowsAll.length} lignes`}</button>` : ''}
    ${f ? `<button type="button" class="lnk mt-qmore" data-mtlf="">Toutes les lignes (${m.lines.length})</button>` : ''}
    <p class="note mt-foot">Tendance : écart entre le cours et sa moyenne 200 jours ${calc}. Seuil de perte : baisse du cours qui franchirait votre seuil (${F.pct(m.rules.stop, 0)} sur le prix de revient).</p>`;
  done(el);
}
function openRules() {
  const m = S.m; if (!m) return;
  L.drawer.open('detail', { narrow: true, title: 'Comment l\'état d\'une ligne est décidé',
    sub: 'Des règles écrites, appliquées dans cet ordre ; la première vraie l\'emporte',
    html: `<ol class="mt-rules">${m.state_rules.map(([k, t]) => `<li>${chip(k, m.state_labels[k])}<p>${esc(t)}</p></li>`).join('')}</ol>
      <div class="sec"><h3>Vos seuils</h3><div class="mt-kv">
        <span>Seuil de perte</span><b>${F.pct(m.rules.stop, 0)}</b><span>Recul depuis le plus haut d'un an</span><b>${F.pct(m.rules.drawdown, 0)}</b>
        <span>Poids maximum d'une ligne</span><b>${F.pctU(m.rules.max_line, 0)}</b><span>Poids maximum d'un secteur</span><b>${F.pctU(m.rules.max_sector, 0)}</b>
        <span>Plafond d'un pari spéculatif</span><b>${F.pctU(m.rules.max_spec, 1)}</b><span>Prise de bénéfices</span><b>${m.rules.take_profit ? F.pct(m.rules.take_profit, 0) : 'aucune'}</b>
        <span>Paliers pour une entrée</span><b>${m.rules.tranches}</b></div>
        <a class="btn sm" href="#/decisions/dossiers" style="margin-top:12px">${L.icon('sliders')}Régler mes seuils</a></div>
      <div class="sec"><h3>Tendance et RSI</h3><p class="note">Tendance haussière : cours et moyenne 50 jours au-dessus de la moyenne 200 jours ; baissière : les deux au-dessous ; indécise sinon. RSI 14 jours (Wilder) : rythme des hausses face aux baisses récentes. Ce sont des calculs sur les cours passés, pas des prévisions.</p></div>
      <p class="guard">${esc(m.note)}</p>` });
}

/* ── Panneau « Détail » d'une ligne ── */
async function openLine(uid, rng) {
  S.rng = rng || S.rng || '1y';
  const dr = L.drawer.open('detail', { wide: true, title: 'Chargement…', html: L.skel(260) });
  let d;
  try { d = await L.get(`/api/matin/line/${encodeURIComponent(uid)}?range=${S.rng}`, 60000); }
  catch (e) { const b = L.drawer.body('detail'); if (b) b.innerHTML = L.errBox(e); return; }
  if (!dr.isConnected) return;
  S.d = d;
  renderDetail(d);
}
function tile(label, val, sub = '', cls = '') {
  return `<div class="mt-tile"><span class="k-l">${label}</span><b class="${cls}">${val}</b>${sub ? `<span class="note">${sub}</span>` : ''}</div>`;
}
function detailTiles(t, c) {
  if (!t) return '<p class="note">Pas assez d\'historique de cours pour calculer les indicateurs (30 séances au moins).</p>';
  const p = t.perf || {}, rel = t.rel || {};
  const since = t.since ? `${t.since.dir === 'up' ? 'au-dessus' : 'au-dessous'} de la moyenne 200 jours depuis le ${F.date(t.since.date)}` : '';
  const cross = t.cross ? `croisement ${t.cross.dir === 'up' ? 'haussier' : 'baissier'} des moyennes le ${F.date(t.cross.date)}` : '';
  return `<div class="mt-g">
    ${tile('Tendance', esc(TREND[t.trend] || '—'), esc([since, cross].filter(Boolean).join(' ; ')), t.trend?.startsWith('hauss') ? 'up' : t.trend?.startsWith('baiss') ? 'dn' : '')}
    ${tile('Cours / moyenne 200 jours', t.vs_sma200_pct != null ? F.pct(t.vs_sma200_pct, 1) : '—', t.sma200 ? `moyenne : ${cur(t.sma200, c)}` : 'moins de 200 séances', L.cls(t.vs_sma200_pct))}
    ${tile('Cours / moyenne 50 jours', t.vs_sma50_pct != null ? F.pct(t.vs_sma50_pct, 1) : '—', t.sma50 ? `moyenne : ${cur(t.sma50, c)}` : '', L.cls(t.vs_sma50_pct))}
    ${tile('RSI 14 jours', t.rsi ?? '—', t.rsi_zone === 'haut' ? 'au-dessus de 70 : hausse rapide' : t.rsi_zone === 'bas' ? 'au-dessous de 30 : baisse rapide' : 'entre 30 et 70', t.rsi_zone === 'haut' ? 'warn' : t.rsi_zone === 'bas' ? 'up' : '')}
    ${tile('Élan', ['1m', '3m', '6m', '1y'].map(k => `<span class="mt-el"><i>${{ '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1A' }[k]}</i><span class="${L.cls(p[k])}">${p[k] != null ? F.pct(p[k], 0) : '—'}</span></span>`).join(''), 'variation du cours')}
    ${tile('Face à l\'indice mondial', ['3m', '1y'].map(k => `<span class="mt-el"><i>${k === '3m' ? '3M' : '1A'}</i><span class="${L.cls(rel[k])}">${rel[k] != null ? F.pt(rel[k], 0) : '—'}</span></span>`).join(''), 'écart de performance, en points')}
    ${tile('Volatilité 3 mois', t.vol_3m != null ? F.pctU(t.vol_3m, 0) + ' par an' : '—', t.day_move != null ? `amplitude moyenne d'une séance : ${F.pctU(t.day_move, 1)}` : '')}
    ${tile('Recul depuis le plus haut', F.pct(t.from_hi_pct, 0), `plus forte baisse sur 1 an : ${F.pct(t.max_dd_1y, 0)}`, L.cls(t.from_hi_pct))}
    ${tile('Plus bas · plus haut 1 an', `${cur(t.lo_1y, c)} · ${cur(t.hi_1y, c)}`, `cours ${F.pct(t.from_lo_pct, 0)} au-dessus du plus bas`)}
    ${tile('Plus bas · plus haut 3 mois', `${cur(t.lo_3m, c)} · ${cur(t.hi_3m, c)}`, 'zones de soutien et de résistance récentes')}
  </div>`;
}
function simsHtml(d) {
  const s = d.sims || {};
  const sale = (x, title, extra = '') => `<div class="mt-sim"><b>${title}</b><span>${L.m(F.eur(x.amount, 0))}${extra}${x.shares != null ? ` · ${shares(x.shares)}` : ''}</span>
    <span class="note">Plus ou moins-value réalisée : ${L.m(F.eurS(x.gain, 0))}. ${L.mText(x.tax_note)}.</span></div>`;
  return `<div class="mt-sims">
    ${s.sale_to_limit ? sale(s.sale_to_limit, `Revenir à votre limite de ${F.pctU(s.sale_to_limit.limit, s.sale_to_limit.limit < 5 ? 1 : 0)}`) : ''}
    ${s.sale_all ? sale(s.sale_all, 'Tout vendre', ' récupérés') : ''}
    ${s.buy ? `<div class="mt-sim in"><b>Renforcer</b><span>${esc(s.buy.plan.text)}</span><span class="note">Place sous vos limites : ${L.m(F.eur(s.buy.cap, 0))}. Votre règle : entrées en ${d.rules.tranches} paliers espacés ; pas de renfort à la baisse sur une société qui dépend de financements externes.</span></div>` : ''}
  </div><p class="note">Montants ${calc} au cours du jour ; l'impôt réel dépend de vos autres opérations de l'année.</p>`;
}
function argsHtml(d) {
  const li = r => `<li><span class="mt-ak">${esc({ regle: 'Votre règle', these: 'Thèse', tendance: 'Tendance', technique: 'Cours', signal: 'Signal daté', allocation: 'Allocation', agenda: 'Agenda' }[r.kind] || '')}</span>${r.link && !r.link.startsWith('#') ? `<a href="${L.url(r.link)}" target="_blank" rel="noopener noreferrer">${L.mText(r.text)}</a>` : L.mText(r.text)}${r.calc ? ' ' + calc : ''}</li>`;
  const a = d.args;
  return `<div class="mt-args">
    <div class="out"><h4>Pour sortir ou alléger</h4>${a.out.length ? `<ul>${a.out.map(li).join('')}</ul>` : '<p class="note">Aucun argument dans les règles et les faits suivis.</p>'}</div>
    <div class="in"><h4>Pour garder ou renforcer</h4>${a.in.length ? `<ul>${a.in.map(li).join('')}</ul>` : '<p class="note">Aucun argument dans les règles et les faits suivis.</p>'}</div></div>
    ${a.info.length ? `<div class="mt-infob"><h4>À noter aussi</h4><ul class="mt-info">${a.info.map(li).join('')}</ul></div>` : ''}`;
}
function theseHtml(d) {
  if (!d.these) return '<p class="note">La synthèse n\'a pas encore lu cette ligne.</p>';
  const lec = (d.lecture || []).map(q => `<div class="rv-q"><span class="st ${q.flag || 'info'}" aria-hidden="true">${{ ok: '✓', warn: '!', alert: '!' }[q.flag] || '·'}</span><div><b class="rv-ql">${esc(q.label)}.</b> ${L.mText(q.text)}${q.calc ? ' ' + calc : ''}</div></div>`).join('');
  const facts = (d.facts || []).map(f => `<div class="rv-f"><span class="rv-fd">${F.date(f.date)}</span><div class="rv-ft">${f.label ? `<span class="tag">${esc(f.label)}</span> ` : ''}${f.link && !f.calc ? `<a href="${L.url(f.link)}" target="_blank" rel="noopener noreferrer">${esc(f.text)}</a>` : esc(f.text)}<span class="rv-src">${esc(f.source || '')}${f.primary ? ' · <b>source primaire</b>' : ''}</span></div></div>`).join('');
  return `<p class="rv-why"><b>${esc(d.these.label)}</b> : ${L.mText(d.these.why)}.${d.piste ? ` <b>Piste de la synthèse</b> : ${esc(d.piste.label.toLowerCase())} (${L.mText(d.piste.why)}).` : ''}</p>
    ${lec ? `<details class="mt-lec"><summary>Les six questions de lecture</summary>${lec}</details>` : ''}
    ${facts ? `<h4 class="rv-h">Derniers faits publiés</h4>${facts}` : ''}`;
}
function renderDetail(d) {
  const l = d.line, t = d.tech, c = d.currency;
  const dr = L.drawer.open('detail', { wide: true, title: esc(l.name),
    sub: `${F.pctU(l.weight, 1)} du portefeuille · ${L.m(F.eur(l.value, 0))} · <span class="${L.cls(l.pnl)}">${L.m(F.eurS(l.pnl, 0))} (${F.pct(l.pnl_pct, 0)})</span>${l.envelope ? ' · ' + esc(l.envelope) : ''}` });
  const side = l.state === 'renforcer' || l.state === 'ok' ? 'in' : 'out';
  const top = l.reasons.filter(r => r.side === side).slice(0, 4);
  const rule = (d.state_rules.find(([k]) => k === l.state) || [])[1] || '';
  const item = d.item;
  const kind = item && !item.decided ? item.kind : 'line';
  const legend = [];
  const lv = (t && t.levels) || {};
  const lvColor = LVC();
  const ch = d.chart || {};
  const av = ch.available || [];
  const onR = av.includes(ch.range) ? ch.range : av[av.length - 1];   // historique plus court : toute la période
  const lo = Math.min(...(ch.c || []).filter(x => x != null)), hi = Math.max(...(ch.c || []).filter(x => x != null));
  Object.entries(lv).forEach(([k, x]) => {
    const inside = x.price >= lo * 0.85 && x.price <= hi * 1.15;
    legend.push(`<span class="mt-lg"><i style="border-color:${lvColor[k]};border-top-style:${k === 'pru' || k === 'drawdown' ? 'dotted' : 'dashed'}"></i>${esc(cap1(x.label))} : ${cur(x.price, c)} <span class="muted">(${F.pct(x.dist_pct, 0)})</span>${inside ? '' : ' <span class="muted">· hors du graphique</span>'}</span>`);
  });
  dr.querySelector('.dr-b').innerHTML = `<div class="mt-d">
    <div class="mt-verdict ${ST[l.state]}">
      <div class="mt-vh">${chip(l.state, l.state_label)}${l.wait ? `<span class="mt-wait">${L.icon('clock')}<span>${esc(l.wait.text)}</span></span>` : ''}</div>
      ${top.length ? `<ul>${top.map(r => `<li>${L.mText(r.text)}</li>`).join('')}</ul>` : ''}
      <p class="note">Règle appliquée : ${esc(rule)}</p></div>
    <section class="sec"><h3>Cours, moyennes et vos niveaux <span class="seg sm mt-rng" role="group" aria-label="Période">${RNG.filter(([k]) => av.includes(k)).map(([k, lb]) => `<button type="button" data-mtrng="${k}" data-uid="${esc(l.uid)}" class="${onR === k ? 'on' : ''}" aria-pressed="${onR === k}">${lb}</button>`).join('')}</span></h3>
      <div id="mtCh" class="mt-ch"></div>
      <div class="mt-legs"><span class="mt-lg"><i style="border-color:${L.P.acc}"></i>Cours (${esc(F.sym(c) || c)})</span><span class="mt-lg"><i style="border-color:${L.P.up};border-top-style:dashed"></i>Moyenne 50 jours</span><span class="mt-lg"><i style="border-color:${L.P.ref}"></i>Moyenne 200 jours</span>${(d.marks || []).length ? `<span class="mt-lg"><b class="mt-mk-b"></b>vos achats <b class="mt-mk-s"></b>vos ventes</span>` : ''}${legend.join('')}</div>
      <div class="k-l" style="margin-top:12px">RSI 14 jours</div><div id="mtRsi" class="mt-rsi"></div></section>
    <section class="sec"><h3>Indicateurs ${calc}</h3>${detailTiles(t, c)}</section>
    <section class="sec"><h3>Arguments</h3>${argsHtml(d)}</section>
    <section class="sec"><h3>Montants</h3>${simsHtml(d)}</section>
    <section class="sec"><h3>Thèse et faits publiés</h3>${theseHtml(d)}</section>
    <section class="sec mt-decide"><h3>Votre décision</h3>
      ${item && item.decided ? `<p class="note">${ACTDONE[item.decided.action] || ''} le ${F.dshort(item.decided.ts)} : la ligne revient dans la liste ${F.inDays(new Date(item.decided.until * 1000).toISOString().slice(0, 10))}, ou plus tôt si un fait nouveau tombe.</p>` : ''}
      <div class="mt-acts">${(ACTS[kind] || ACTS.line).map((a, i) => `<button type="button" class="btn sm${i === 0 ? ' p' : ''}" data-mtdo="${esc(item && !item.decided ? item.id : '')}" data-uid="${esc(l.uid)}" data-act="${a}">${ACT[a]}</button>`).join('')}</div>
      <label class="fld" style="margin-top:10px"><span>Note (facultatif) : pourquoi, et ce qui vous ferait changer d'avis</span><textarea class="inp rv-ta" id="mtNote" rows="2" maxlength="500"></textarea></label>
      <p class="note">LUMIO consigne votre décision dans le journal et la suit ; il ne passe aucun ordre. Vous agissez dans l'app Trade Republic.</p></section>
    <div class="mt-links"><button type="button" class="btn sm" data-pos="${esc(l.uid)}">Fiche complète de la valeur</button>
      <button type="button" class="btn sm" data-sim="${l.state === 'renforcer' ? 'buy' : 'sell'}" data-sim-uid="${esc(l.uid)}" data-sim-run="0">${L.icon('spark')}Simuler une opération</button>
      <button type="button" class="btn sm g" data-mtrules>Comment l'état est décidé</button></div>
    <p class="guard">${esc(d.note)}</p></div>`;
  drawCharts(d);
}
function drawCharts(d) {
  const ch = d.chart || {}, c = d.currency, t = d.tech;
  const el = document.getElementById('mtCh'), er = document.getElementById('mtRsi');
  if (!el || !(ch.t || []).length) { if (el) el.innerHTML = '<div class="empty">Pas d\'historique de cours.</div>'; return; }
  const ts = ch.t;
  const near = x => { let lo = 0, hi = ts.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (ts[mid] < x) lo = mid + 1; else hi = mid; } return lo; };
  const marks = (d.marks || []).map(mk => ({ i: near(mk.t), kind: mk.type, label: `${mk.type === 'buy' ? 'Achat' : 'Vente'} de ${F.n(mk.shares, mk.shares < 10 ? 2 : 0)} à ${cur(mk.price, c)} le ${F.date(mk.t)}` }));
  const lv = (t && t.levels) || {};
  const lvColor = LVC();
  const refs = Object.entries(lv).map(([k, x]) => ({ v: x.price, label: cap1(x.label.split(' (')[0]), color: lvColor[k], dash: k === 'pru' || k === 'drawdown' ? '2 3' : '6 4' }));
  const fmtY = v => F.n(v, Math.abs(v) < 20 ? 2 : 0);
  C.line(el, { t: ts, h: 260, label: `Cours de ${d.line.name} sur la période, avec moyennes 50 et 200 jours`, fmtY, refs, marks,
    series: [{ v: ch.c, color: L.P.acc, w: 2, area: true }, { v: ch.sma50, color: L.P.up, w: 1.5, dash: '5 4', noScale: true }, { v: ch.sma200, color: L.P.ref, w: 1.5, noScale: true }],
    tip: i => `<b>${F.date(ts[i])}</b><div class="r"><span>Cours</span><b>${cur(ch.c[i], c)}</b></div>${ch.sma50[i] != null ? `<div class="r"><span>Moyenne 50 j</span><b>${cur(ch.sma50[i], c)}</b></div>` : ''}${ch.sma200[i] != null ? `<div class="r"><span>Moyenne 200 j</span><b>${cur(ch.sma200[i], c)}</b></div>` : ''}${ch.rsi[i] != null ? `<div class="r"><span>RSI</span><b>${F.n(ch.rsi[i], 0)}</b></div>` : ''}` });
  if (er) C.line(er, { t: ts, h: 110, yMin: 0, yMax: 100, nTicks: 2, endDot: false, label: 'RSI 14 jours sur la période',
    refs: [{ v: 70, label: '70', color: L.P.down, dash: '3 4' }, { v: 30, label: '30', color: L.P.up, dash: '3 4' }],
    series: [{ v: ch.rsi, color: L.P.vio, w: 1.5 }], fmtY: v => F.n(v, 0),
    tip: i => `<b>${F.date(ts[i])}</b><div class="r"><span>RSI</span><b>${ch.rsi[i] != null ? F.n(ch.rsi[i], 0) : '—'}</b></div>` });
}

/* ── Panneau des liquidités et des placements ── */
function optHtml(o, c) {
  const plan = `<span class="mt-plan">${L.m(F.eur(o.amount, 0))} · ${esc(o.plan.text)}</span>`;
  const btn = o.uid ? `<button type="button" class="btn sm" data-mtline="${esc(o.uid)}">Détail${L.icon('chev')}</button>`
    : o.ticker ? `<button type="button" class="btn sm" data-sim="buy" data-sim-tk="${esc(o.ticker)}" data-sim-name="${esc(o.name || '')}" data-sim-run="0">${L.icon('spark')}Simuler un achat</button>` : '';
  const parts = (o.parts || []).map(p => `<div class="mt-part"><b>${esc(p.label)}</b><span>${L.m(F.eur(p.amount, 0))}</span>${p.lines.length ? `<span class="note">${p.lines.map(x => `${esc(x.name)} (${esc(x.state_label.toLowerCase())})`).join(', ')}</span>` : '<span class="note">aucune ligne détenue dans ce groupe</span>'}</div>`).join('');
  return `<div class="mt-opt ${o.kind}"><div class="mt-oh"><h4>${esc(o.title)}</h4>${plan}</div><p>${L.mText(o.why)}</p>${parts ? `<div class="mt-parts">${parts}</div>` : ''}
    ${o.spec_note ? `<p class="note">${L.mText(o.spec_note)}.</p>` : ''}${btn ? `<div class="mt-oa">${btn}</div>` : ''}</div>`;
}
function openCash() {
  const m = S.m; if (!m) return;
  const c = m.cash || {};
  const item = (m.queue || []).find(q => q.kind === 'placer');
  const dr = L.drawer.open('detail', { wide: true, title: 'Liquidités et placements', sub: esc(cap1(cashSource(c))),
    html: `<div class="mt-d">
      <div class="mt-cashh"><div><span class="k-l">Espèces non placées</span><b class="mt-big m">${c.amount == null ? '—' : F.eur(c.amount, 0)}</b></div>
        <div><span class="k-l">Réserve gardée</span><b class="m">${F.eur(c.reserve || 0, 0)}</b></div>
        <div><span class="k-l">À placer</span><b class="m">${c.to_place == null ? '—' : F.eur(c.to_place, 0)}</b></div>
        ${m.cash_etoro ? `<div><span class="k-l">Espèces eToro</span><b class="m">${F.eur(m.cash_etoro, 0)}</b></div>` : ''}</div>
      <form id="mtCashF" class="frm mt-cashf" autocomplete="off">
        <label class="fld"><span>Réserve à garder disponible (€)</span><input class="inp" name="reserve" inputmode="decimal" value="${esc(c.reserve ? String(c.reserve).replace('.', ',') : '')}" placeholder="0"></label>
        <label class="fld"><span>Montant saisi à la main (€), si le relevé n'est pas à jour</span><input class="inp" name="manual" inputmode="decimal" value="${esc(c.manual != null ? String(c.manual).replace('.', ',') : '')}" placeholder="relevé Trade Republic"></label>
        <div class="mt-cashb"><button class="btn sm p" type="submit">Enregistrer</button><span class="note" id="mtCashM" role="status"></span></div></form>
      <section class="sec"><h3>Pistes de placement ${c.to_place ? `pour ${L.m(F.eur(c.to_place, 0))}` : ''}</h3>
        ${(c.options || []).length ? c.options.map(o => optHtml(o, c)).join('') : `<p class="note">${c.known ? 'Rien à placer au-delà de votre réserve.' : 'Montant inconnu : lancez une mise à jour Trade Republic, ou saisissez-le ci-dessus.'}</p>`}
        <p class="note">${esc(c.rule || '')}. ${esc(c.reuse || '')}</p></section>
      ${item ? `<section class="sec mt-decide"><h3>Votre décision</h3><div class="mt-acts">${actBtns(item.id, 'placer')}</div>
        <label class="fld" style="margin-top:10px"><span>Note (facultatif)</span><textarea class="inp rv-ta" id="mtNote" rows="2" maxlength="500"></textarea></label></section>` : ''}
      <p class="guard">${esc(m.note)}</p></div>` });
  dr.querySelector('#mtCashF').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { reserve: String(fd.get('reserve') || '0').replace(',', '.'), manual: String(fd.get('manual') || '').trim().replace(',', '.') || null };
    try {
      await L.api('/api/cash', { method: 'PUT', body });
      L.toast('Liquidités enregistrées'); L.forget('/api/matin'); await L.matin.load(true); openCash();
    } catch (err) { L.put('mtCashM', `<span class="dn">${esc(err.message)}</span>`); }
  };
}

/* ── Décision consignée ── */
async function decide(id, act, uid) {
  const note = (document.getElementById('mtNote') || {}).value || '';
  try {
    if (id) await L.api('/api/matin/done', { method: 'POST', body: { id, action: act, note } });
    else await L.api('/api/decisions/journal', { method: 'POST', body: { uids: [uid], action: act, note, title: `${(S.m?.lines || []).find(l => l.uid === uid)?.name || ''} : décision du matin` } });
    const days = (S.m?.actions || {})[act];
    L.toast(`${ACTDONE[act]}${days ? ` : réexamen dans ${days} jour${days > 1 ? 's' : ''}` : ''}`);
    if (L.drawer.current === 'detail') L.drawer.close();
    L.forget('/api/matin'); L.forget('/api/decisions');
    await L.matin.load(true);
  } catch (err) { L.toast(err.message, true); }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-mtline],[data-mtcash],[data-mtdo],[data-mtundo],[data-mtrng],[data-mtrules],[data-mtjump],[data-mtmore],[data-mtlf],[data-mtlall],#m4');
  if (!b) return;
  if (b.id === 'm4') { if (!e.target.closest('.info,button,a')) openCash(); return; }
  const ds = b.dataset;
  if ('mtline' in ds) { e.preventDefault(); openLine(ds.mtline); }
  else if ('mtcash' in ds) { e.preventDefault(); openCash(); }
  else if ('mtdo' in ds) decide(ds.mtdo, ds.act, ds.uid);
  else if ('mtundo' in ds) {
    L.api('/api/decisions/journal/' + encodeURIComponent(ds.mtundo), { method: 'DELETE' })
      .then(() => { L.toast('Décision annulée'); L.forget('/api/matin'); L.matin.load(true); }).catch(err => L.toast(err.message, true));
  }
  else if ('mtrng' in ds) { openLine(ds.uid, ds.mtrng); }
  else if ('mtrules' in ds) openRules();
  else if ('mtmore' in ds) { L.store.set('mt.qall', !L.store.get('mt.qall', false)); renderQueue(); }
  else if ('mtlf' in ds) { L.store.set('mt.lf', L.store.get('mt.lf', '') === ds.mtlf ? '' : ds.mtlf); renderLines(); }
  else if ('mtlall' in ds) { L.store.set('mt.lall', !L.store.get('mt.lall', false)); renderLines(); }
  else if ('mtjump' in ds) { document.getElementById(ds.mtjump)?.scrollIntoView({ behavior: smooth(), block: 'start' }); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (t.matches && (t.matches('tr[data-mtline]') || t.id === 'm4')) { e.preventDefault(); t.id === 'm4' ? openCash() : openLine(t.dataset.mtline); }
});
})();
