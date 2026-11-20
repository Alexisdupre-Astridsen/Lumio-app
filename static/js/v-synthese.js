/* LUMIO — Décisions › Synthèse : l'analyse complète du portefeuille, dans l'ordre de la méthode.
   1. constat et décisions à étudier ; 2. diagnostic chiffré ; 3. contexte de marché ; 4. une section
   par thème, un bloc par ligne (lecture, faits sourcés) ; 5. plan d'action et calendrier ; 6. sources.
   Trois niveaux séparés à l'écran : le fait (daté, lié à sa source), le calcul (étiquette « calculé »),
   la lecture (thèse et piste, par règles). Aide à la décision : LUMIO ne recommande rien. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const esc = L.esc;
const TH = { intacte: 'ok', surveiller: 'warn', modifiee: 'alert', speculatif: 'spec', speciale: 'offer', indiciel: 'idx', indeterminee: 'nd' };
const MARK = { ok: '✓', warn: '!', alert: '!', info: '·' };
const CTX_KIND = { marche: 'Marché', secteur: 'Secteur' };
const BARS_MAX = 14;          // au-delà : les 7 plus fortes pertes et les 7 plus forts gains, le reste sur demande
const SRC_MAX = 12;
const S = { timer: 0, tries: 0, a: null, day: null, barsAll: false };

const thChip = t => `<span class="rv-th ${TH[t.key] || 'nd'}" title="${esc(t.def || '')}">${esc(t.label)}</span>`;
const piChip = p => `<span class="rv-pi ${p.key === 'conserver' ? 'keep' : ''}">${esc(p.label)}</span>`;
L.rvChips = (these, piste) => thChip(these) + piChip(piste);          // repris par le panneau de l'analyste
const calc = '<span class="rv-calc" title="Chiffre calculé par LUMIO à partir des données affichées">calculé</span>';
const sec = (id, title, body, right = '') => `<section class="w c12 rv-sec" id="rv-${id}" aria-labelledby="rv-${id}-h"><div class="w-h"><h2 id="rv-${id}-h">${title}</h2>${right ? `<div class="r">${right}</div>` : ''}</div>${body}</section>`;
const stat = (lbl, val, sub = '') => `<div class="kpi stat"><span class="k-l">${lbl}</span><span class="k-v">${val}</span>${sub ? `<span class="k-s">${sub}</span>` : ''}</div>`;
const cur = (x, c) => x == null ? '—' : F.cur(x, c || 'EUR', 2);
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const names = (xs, n = 5) => esc(xs.slice(0, n).join(', ')) + (xs.length > n ? '…' : '');

/* ── 1. Décisions à étudier ── */
function decisionsHtml(a) {
  const ds = a.decisions || [];
  if (!ds.length) return '<div class="empty">Aucune décision à étudier aujourd\'hui : ni publication cette semaine, ni perte concentrée, ni limite dépassée.</div>';
  const defs = a.theses_def || {};
  return `<div class="rv-dec"><div class="rv-dh" aria-hidden="true"><span>Priorité</span><span>Ligne</span><span>Plus ou moins-value</span><span>Thèse et piste</span><span>Pourquoi</span></div>
    ${ds.map(d => `<button type="button" class="rv-d" data-rvline="${esc(d.uid)}" title="Voir la lecture et les faits de ${esc(d.name)}">
      <span class="rv-dp"><b aria-label="Priorité ${d.priority}">${d.priority}</b></span>
      <span class="rv-dn"><b>${esc(d.name)}</b><span class="note">${esc(d.theme)} · ${F.pctU(d.weight, 1)}</span></span>
      <span class="rv-dv"><b class="${L.cls(d.pnl)}">${L.m(F.eurS(d.pnl, 0))}</b><span class="note ${L.cls(d.pnl_pct)}">${F.pct(d.pnl_pct, 0)}</span></span>
      <span class="rv-dc">${thChip({ key: d.these, label: d.these_label, def: defs[d.these] })}${piChip({ key: d.piste, label: d.piste_label })}</span>
      <span class="rv-dw"><b>${esc(d.priority_label)}</b><span>${cap(L.mText(d.why))}.</span>${(d.also || []).length ? `<span class="note">Aussi : ${L.mText(d.also.join(' ; '))}.</span>` : ''}</span>
    </button>`).join('')}</div>
    <p class="note rv-foot">Ordre de la méthode : 1. événement daté de la semaine, 2. perte concentrée ou thèse à revoir, 3. gain plafonné, 4. corrélation et concentration, 5. règles d'entrée et de taille. Une piste est une question à étudier, jamais une consigne.</p>`;
}

/* ── 2. Diagnostic chiffré ── */
function diagnosticHtml(a) {
  const r = a.reconstitution, st = a.structure, ct = r.control, cr = st.common_risk, lt = st.loss_top5;
  const row = (label, val, detail, c = false) => `<div class="li rv-i"><div class="main"><div class="t1">${label}${c ? ' ' + calc : ''}</div>${detail ? `<div class="t2">${detail}</div>` : ''}</div><div class="end">${val}</div></div>`;
  const gapOk = Math.abs(ct.gap) < 0.5;
  const back = r.lines.filter(l => l.back_to_cost_pct != null);
  const many = r.lines.length > BARS_MAX && !S.barsAll;
  return `<div class="stat-row rv-kpis">${stat('Valorisation', L.m(F.eur(r.total, 0)), plural(ct.lines, 'ligne', 'lignes'))}
      ${stat('Prix de revient', L.m(F.eur(r.cost, 0)), 'exact : historique des opérations, frais inclus')}
      ${stat('Plus ou moins-value latente', `<span class="${L.cls(r.latent)}">${L.m(F.eurS(r.latent, 0))}</span>`, r.latent_pct != null ? F.pct(r.latent_pct, 1) + ' sur le prix de revient' : '')}
      ${stat(`Déjà réalisé en ${r.year}`, r.realized_year == null ? '—' : `<span class="${L.cls(r.realized_year)}">${L.m(F.eurS(r.realized_year, 0))}</span>`, r.realized_year == null ? 'non disponible' : 'plus ou moins-values encaissées, compte-titres')}</div>
    <div class="rv-2">
      <div><h3 class="rv-k">Structure</h3>
        ${row('Lignes gagnantes', `${st.winners.n} · <span class="up">${L.m(F.eurS(st.winners.eur, 0))}</span>`, '')}
        ${row('Lignes perdantes', `${st.losers.n} · <span class="${L.cls(st.losers.eur)}">${L.m(F.eurS(st.losers.eur, 0))}</span>`, '')}
        ${lt.names.length ? row('Concentration des pertes', lt.pct != null ? F.pctU(lt.pct, 0) : '—', `Part de la perte totale portée par ${lt.names.length > 1 ? `les ${lt.names.length} plus fortes pertes` : 'la seule ligne en perte'} : ${names(lt.names)}`, true) : ''}
        ${row('Socle diversifié', F.pctU(st.core.weight, 1), st.core.names.length ? 'Supports indiciels larges : ' + names(st.core.names, 3) : 'Aucun support indiciel large')}
        ${row('Paris spéculatifs', F.pctU(st.speculative.weight, 1), (st.speculative.names.length ? 'Sociétés en pertes ou dépendantes de financements externes : ' + names(st.speculative.names) : 'Aucune société en pertes repérée')
          + (st.speculative.unknown.length ? `. Résultats non disponibles : ${names(st.speculative.unknown, 4)}` : ''))}
        ${row('Facteur de risque commun', cr.themes.length ? F.pctU(cr.weight, 0) : '—', cr.themes.length
          ? `Thèmes en baisse sur ${esc(cr.window)} : ${cr.themes.map(t => `${esc(t.theme)} (${F.pct(t.m3_pct, 0)})`).join(', ')}${cr.corr != null && cr.themes.length > 1 ? ` ; corrélation moyenne de leurs lignes : ${F.n(cr.corr, 2)}` : ''}`
          : `Aucun thème en baisse de plus de ${F.n(-cr.threshold, 0)} % sur ${esc(cr.window)}`, true)}
        ${row('Pays de cotation', '', st.countries.map(c => `${esc(c.label)} ${F.pctU(c.weight, 0)}`).join(' · '))}
        ${row('Doublons avec vos ETF', String(st.duplicates.length), st.duplicates.length ? st.duplicates.map(d => `${esc(d.name)} (≈ ${L.m(F.eur(d.via_etf, 0))} via ${esc((d.etfs || [])[0] || 'un ETF')})`).join(', ') : 'Aucune ligne directe ne pèse dans les premières positions de vos ETF')}
        ${row('Contrôle', gapOk && !ct.stale_lines ? '<span class="up">✓</span>' : '<span class="warn">!</span>', (gapOk ? 'Somme des lignes = total affiché' : `Écart de ${L.m(F.eurS(ct.gap, 0))} entre la somme des lignes et le total affiché`)
          + (ct.stale_lines ? ` ; ${plural(ct.stale_lines, 'ligne au cours ancien', 'lignes au cours ancien')} : leur plus ou moins-value date du dernier cours reçu` : ''))}
      </div>
      <div><h3 class="rv-k">Par thème</h3>
        <div class="tbl-wrap"><table class="tbl rv-tt"><thead><tr><th class="l">Thème</th><th>Poids</th><th>Plus ou moins-value</th><th>3 mois</th></tr></thead><tbody>
        ${st.themes.map(t => `<tr><td class="l"><a href="#" data-rvtheme="${esc(t.theme)}">${esc(t.theme)}</a> <span class="muted">· ${t.lines}</span></td><td>${F.pctU(t.weight, 1)}</td>
          <td class="${L.cls(t.pnl)}">${L.m(F.eurS(t.pnl, 0))}<span class="sub"> ${t.pnl_pct != null ? F.pct(t.pnl_pct, 0) : ''}</span></td><td class="${L.cls(t.m3_pct)}">${t.m3_pct != null ? F.pct(t.m3_pct, 0) : '—'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="note rv-foot">Le chiffre après le thème est son nombre de lignes. 3 mois : variation des cours du thème, pondérée par la valeur des lignes ${calc}.</p>
      </div>
    </div>
    <h3 class="rv-k rv-kb">Plus et moins-values par ligne, de la plus forte perte au plus fort gain</h3>
    <div class="rv-bars${many ? ' cut' : ''}">${C.dbars(r.lines.map(l => ({ label: l.name, v: l.pnl })))}</div>
    ${many ? `<button class="btn sm no-print rv-more" data-rvbars>Afficher les ${r.lines.length} lignes</button>` : ''}
    ${back.length ? `<p class="note rv-foot">Hausse nécessaire pour revenir au prix de revient ${calc} : ${back.map(l => `${esc(l.name)} ${F.pct(l.back_to_cost_pct, 0)}`).join(' · ')}.</p>` : ''}`;
}

/* ── Un fait : sa date, sa nature, son texte lié à la source, et la source ── */
const ext = (f, txt) => `<a href="${L.url(f.link)}" target="_blank" rel="noopener noreferrer">${txt}</a>`;
const factRow = f => `<div class="rv-f"><span class="rv-fd">${F.date(f.date)}</span><div class="rv-ft">
    ${f.label ? `<span class="tag rv-kd ${f.pol > 0 ? 'up' : f.pol < 0 ? 'dn' : ''}">${esc(f.label)}</span> ` : ''}${f.link && !f.calc ? ext(f, esc(f.text)) : esc(f.text)}${f.tail ? ' : ' + esc(f.tail) + '.' : ''}
    <span class="rv-src">${f.link && f.calc ? ext(f, esc(f.source || 'source')) : esc(f.source || '')}${f.primary ? ' · <b>source primaire</b>' : ''}${f.link ? '' : ' · sans lien public'}${f.calc ? ' · ' + calc : ''}</span></div></div>`;

/* ── 3. Contexte de marché ── */
function contextHtml(a) {
  const fs = (a.context || []).map(f => ({ ...f, label: CTX_KIND[f.kind] || '' }));
  return fs.length ? fs.map(factRow).join('') + '<p class="note rv-foot">Un fait n\'est retenu que s\'il touche au moins un thème du portefeuille. Variations sur 30 jours, entre deux cours de clôture.</p>'
    : '<div class="empty">Aucun mouvement de marché marquant sur 30 jours pour vos thèmes, ou cours des indices indisponibles.</div>';
}

/* ── 4. Une section par thème, un bloc par ligne ── */
function priceHtml(l) {
  const p = l.price || {};
  if (p.last == null) return '';
  const pos = p.pos52_pct == null ? null : Math.max(0, Math.min(100, p.pos52_pct));
  const range = p.hi52 != null ? `<span class="rv-pr"><span class="note">Sur 1 an</span> ${cur(p.lo52, p.currency)}
      <span class="rv-rg" role="img" aria-label="Cours à ${pos} % de l'écart entre le plus bas et le plus haut d'un an"><i style="left:${pos}%"></i></span> ${cur(p.hi52, p.currency)}${p.from_hi_pct != null ? ` <span class="muted">(${F.pct(p.from_hi_pct, 0)} sous le plus haut)</span>` : ''}</span>` : '';
  const ratio = p.ratio ? (p.ratio.value != null ? `${esc(p.ratio.label)} : <b>${F.n(p.ratio.value, 1)}</b>${p.ratio.calc ? ' ' + calc : ''}` : esc(p.ratio.label)) : (l.asset_type === 'Action' ? 'Ratio de valorisation non disponible' : '');
  const more = [l.m3_pct != null ? `3 mois : <span class="${L.cls(l.m3_pct)}">${F.pct(l.m3_pct, 0)}</span>` : '',
    l.back_to_cost_pct != null ? `retour au prix de revient : ${F.pct(l.back_to_cost_pct, 0)} ${calc}` : ''].filter(Boolean).join(' · ');
  return `<div class="rv-px"><span>Cours <b>${cur(p.last, p.currency)}</b></span>${range}${ratio ? `<span>${ratio}</span>` : ''}${more ? `<span>${more}</span>` : ''}</div>`;
}
function specialHtml(l) {
  const s = l.special; if (!s || l.these.key !== 'speciale') return '';
  const c = s.currency;
  return `<div class="callout rv-sp"><b>Offre publique</b>${s.since ? ` repérée le ${F.date(s.since)}` : ''}.
    ${s.offer_price != null ? ` Prix d'offre : ${cur(s.offer_price, c)} (${esc(s.offer_src)})${s.gain_pct != null ? `. Gain restant = prix d'offre / cours − 1 = <b>${F.pct(s.gain_pct, 1)}</b> ${calc}` : ''}.` : ' Prix d\'offre non renseigné : indiquez-le pour chiffrer le gain restant.'}
    ${s.pre_price != null ? ` Cours d'avant l'annonce : ${cur(s.pre_price, c)} (${esc(s.pre_src)})${s.fail_pct != null ? `. Risque d'échec = cours d'avant l'annonce / cours − 1 = <b>${F.pct(s.fail_pct, 0)}</b> ${calc}` : ''}.` : ''}
    <div class="note" style="margin-top:6px">Si la société est l'initiatrice de l'offre et non sa cible, fixez vous-même le classement de la thèse.</div></div>`;
}
function lineHtml(l, open) {
  const stock = l.asset_type === 'Action';
  const lec = (l.lecture || []).map(q => `<div class="rv-q"><span class="st ${q.flag || 'info'}" aria-hidden="true">${MARK[q.flag] || '·'}</span><div><b class="rv-ql">${esc(q.label)}.</b> ${L.mText(q.text)}${q.calc ? ' ' + calc : ''}</div></div>`).join('');
  const sig = (l.signals || []).map(s => `<span class="tag ${s.pol > 0 ? 'up' : s.pol < 0 ? 'dn' : ''}">${esc(s.text)}</span>`).join(' ');
  const facts = l.facts || [];
  const prim = facts.filter(f => f.primary).length;
  const note = l.note || {};
  const px = priceHtml(l);
  return `<details class="rv-l" id="rvl-${esc(l.uid)}" data-uid="${esc(l.uid)}" ${open ? 'open' : ''}>
    <summary><span class="rv-ln"><b>${esc(l.name)}</b><span class="note">${F.pctU(l.weight, 1)} · ${L.m(F.eur(l.value, 0))} · <span class="${L.cls(l.pnl)}">${L.m(F.eurS(l.pnl, 0))} (${F.pct(l.pnl_pct, 0)})</span></span></span>
      <span class="rv-lc">${thChip(l.these)}${piChip(l.piste)}</span>${L.icon('chev')}</summary>
    <div class="rv-lb">
      <p class="rv-why"><b>${esc(l.these.label)}</b> : ${L.mText(l.these.why)}. <b>Piste à étudier</b> : ${esc(l.piste.label.toLowerCase())} (${L.mText(l.piste.why)}).</p>
      ${sig ? `<div class="rv-sig">${sig}</div>` : ''}
      ${specialHtml(l)}
      ${S.a.compact ? '' : `<h4 class="rv-h">Lecture</h4>${lec}`}
      ${px ? `<h4 class="rv-h">Cours et valorisation</h4>${px}` : ''}
      ${stock && !S.a.compact ? `<h4 class="rv-h">Faits sourcés${facts.length ? ` <span class="note">${plural(facts.length, 'fait', 'faits')}${prim ? `, dont ${prim} de source primaire, en tête` : ', presse et consensus'}</span>` : ''}</h4>
        ${facts.length ? facts.map(factRow).join('') : '<p class="note">Aucun fait daté et sourcé dans les sources suivies. Ce qui n\'est pas publié n\'est pas supposé.</p>'}
        ${prim ? '' : '<p class="note rv-foot">Pas de source primaire suivie pour cette société : les dépôts réglementaires sont lus pour les sociétés cotées aux États-Unis (SEC) et à Paris (info-financiere.gouv.fr).</p>'}` : ''}
      <div class="rv-act no-print"><button class="btn sm" data-pos="${esc(l.uid)}">Fiche de la valeur</button>
        ${S.day ? '' : `<button class="btn sm" data-sim="sell" data-sim-uid="${esc(l.uid)}" data-sim-run="0">${L.icon('spark')}Simuler une opération</button>
        <button class="btn sm" data-rvnote="${esc(l.uid)}">${L.icon('edit')}${note.criterion || note.these || note.theme || note.offer_price ? 'Modifier ma thèse' : 'Fixer mon critère d\'invalidation'}</button>`}</div>
    </div></details>`;
}
function themesHtml(a) {
  const want = new Set((a.decisions || []).map(d => d.uid));
  return (a.themes || []).map(t => `<div class="rv-t" data-theme="${esc(t.theme)}">
      <div class="rv-tt-h"><h3>${esc(t.theme)}</h3><span class="note">${F.pctU(t.weight, 1)} du portefeuille · <span class="${L.cls(t.pnl)}">${L.m(F.eurS(t.pnl, 0))}</span>${t.m3_pct != null ? ` · ${F.pct(t.m3_pct, 0)} en 3 mois` : ''}</span></div>
      ${t.lines.map(l => lineHtml(l, want.has(l.uid))).join('')}</div>`).join('');
}

/* ── 5. Plan d'action et calendrier ── */
function planHtml(a) {
  const p = a.plan, t = p.tax;
  const steps = p.steps.map(s => `<li class="rv-step${s.items.length ? '' : ' none'}"><span class="rv-rk" aria-hidden="true">${s.rank}</span><div><div class="t1">${esc(s.title)}</div>
      ${s.items.length ? `<ul>${s.items.map(i => `<li>${L.mText(i)}</li>`).join('')}</ul>` : `<div class="note">${esc(s.empty)}</div>`}${s.note ? `<div class="note">${L.mText(s.note)} ${calc}</div>` : ''}</div></li>`).join('');
  const cal = (p.calendar || []).map(e => `<div class="li"><div class="main"><div class="t1">${esc(e.name || '')}</div><div class="t2">${esc((e.label || '').replace(' (estimé)', ''))}${e.estimated ? ' · date estimée' : ''}</div></div><div class="end">${F.dshort(e.date)}<div class="note">${F.inDays(e.date)}</div></div></div>`).join('');
  const taxTxt = t.losses_realizable > 0
    ? `Moins-values réalisables : ${L.m(F.eur(t.losses_realizable, 0))} × ${F.frU(t.rate, 1)} = <b>${L.m(F.eur(t.saving_max, 0))}</b> d'impôt évité au maximum ${calc}. `
      + (t.realized_year > 0 ? `Plus-values déjà réalisées en ${t.year} : ${L.m(F.eurS(t.realized_year, 0))}, soit jusqu'à ${L.m(F.eur(t.usable_now, 0))} d'impôt évité dès cette année ; le reste se reporte.`
        : `Aucune plus-value nette réalisée en ${t.year} à ce jour : une moins-value réalisée serait reportée sur les années suivantes.`)
    : 'Aucune moins-value latente sur le compte-titres.';
  return `<ol class="rv-steps">${steps}</ol>
    <div class="rv-2 rv-2b">
      <div><h3 class="rv-k">Fiscalité du compte-titres</h3>
        <div class="callout">${taxTxt}<div class="note" style="margin-top:6px">${esc(t.note)} Taux du prélèvement forfaitaire : ${F.frU(t.rate, 1)}, paramètre.</div></div>
        <h3 class="rv-k rv-kb">Réemploi</h3>
        <p class="rv-p">${esc(p.reuse.rule)} Options : ${esc(p.reuse.options.join(', '))}.</p>
        <h3 class="rv-k rv-kb">Règles, seuils réglables</h3>
        ${p.rules.map(r => `<div class="li rv-i"><div class="main"><div class="t1">${L.mText(r.label)}</div>${r.detail ? `<div class="t2">${esc(r.detail)}</div>` : ''}</div></div>`).join('')}
        ${S.day ? '' : `<button class="btn sm no-print rv-more" data-rvrules>${L.icon('sliders')}Régler mes seuils</button>`}
      </div>
      <div><h3 class="rv-k">Calendrier, 45 jours</h3>${cal || '<div class="empty">Aucun événement daté connu sur vos lignes : les prochaines publications ne sont pas encore annoncées.</div>'}</div>
    </div>`;
}

/* ── 6. Sources ── */
function sourcesHtml(a) {
  const ss = a.sources || [];
  if (a.compact) return '<div class="empty">Archive allégée : la lecture, les faits ligne par ligne et la liste des sources sont gardés 60 jours.</div>';
  if (!ss.length) return '<div class="empty">Aucune source liée pour l\'instant.</div>';
  const li = s => `<li>${s.name ? `<b>${esc(s.name)}</b> · ` : ''}<a href="${L.url(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a> <span class="note">${esc(s.source || '')} · ${F.date(s.date)}${s.primary ? ' · source primaire' : ''}</span></li>`;
  const rest = ss.slice(SRC_MAX);
  return `<ol class="rv-srcs">${ss.slice(0, SRC_MAX).map(li).join('')}</ol>
    ${rest.length ? `<details class="rv-srcm"><summary class="lnk">Afficher les ${rest.length} autres liens</summary><ol class="rv-srcs" start="${SRC_MAX + 1}">${rest.map(li).join('')}</ol></details>` : ''}`;
}

function render(el, s) {
  const a = s.analysis, day = S.day;
  S.a = a;
  if (!a) {
    el.innerHTML = `<div class="empty">${day ? `Pas d'analyse complète archivée pour le ${F.date(day)} : elle est archivée depuis la version 7.1.` : 'Analyse complète indisponible pour l\'instant.'}<br><a class="lnk" href="#/decisions/synthese">Voir la synthèse du jour</a></div>`;
    return;
  }
  const pend = (a.pending || []).length;
  const jump = [['dec', 'Décisions'], ['diag', 'Diagnostic'], ['ctx', 'Contexte'], ['lignes', 'Lignes'], ['plan', 'Plan d\'action'], ['src', 'Sources']];
  const nd = (a.decisions || []).length;
  el.innerHTML = `<div class="rv">
    <header class="rv-top">
      <h2 class="rv-pt">LUMIO · Synthèse du portefeuille</h2>
      <p class="rv-lead">${L.mText(a.constat[0])}</p><p class="rv-lead2">${L.mText(a.constat[1])}</p>
      ${s.ai_commentary ? `<div class="callout ai rv-ai">${L.mText(s.ai_commentary)}<div class="note" style="margin-top:6px">Rédigé par Claude · chiffres vérifiés</div></div>` : ''}
      <div class="rv-meta"><span class="note">${day ? 'Archive du ' + F.date(day) : 'Analyse du ' + F.date(a.asof) + ' à ' + F.time(a.asof)}${a.quotes_ts ? ' · cours du ' + F.dshort(a.quotes_ts) : ''}${a.demo ? ' · données de démonstration' : ''}</span>
        <span class="rv-btns no-print">${day ? '<a class="btn sm" href="#/decisions/synthese">Synthèse du jour</a>' : `<button class="btn sm" data-rvrefresh>${L.icon('refresh')}Actualiser</button>`}<button class="btn sm" data-rvprint>${L.icon('dl')}Imprimer ou PDF</button></span></div>
      ${pend ? '<div class="callout rv-wait" role="status">Lecture des dépôts réglementaires et de la presse sur 90 jours en cours : l\'analyse se complète toute seule dans quelques secondes.</div>' : ''}
      ${(a.unreachable || []).length && !day ? `<div class="callout warn rv-wait" role="status"><b>Sources primaires injoignables pour l'instant</b> : ${a.unreachable.map(k => ({ sec: 'dépôts à la SEC', regulated: 'information réglementée de Paris' })[k] || esc(k)).join(', ')}. Nouvel essai dans 10 minutes ; d'ici là, les faits viennent de la presse et du consensus.</div>` : ''}
      <ul class="rv-lv" aria-label="Les trois niveaux de l'analyse"><li><b>Fait</b> daté, lié à sa source</li><li>${calc} chiffre obtenu par LUMIO</li><li><b>Lecture</b> thèse et piste, par règles</li></ul>
      <nav class="rv-jump no-print" aria-label="Parties de la synthèse">${jump.map(([k, l]) => `<a class="chip" href="#" data-rvjump="${k}">${l}</a>`).join('')}</nav>
    </header>
    <div class="cards">
      ${sec('dec', 'Décisions à étudier', decisionsHtml(a), nd ? `<span class="note">${plural(nd, 'ligne', 'lignes')}, par priorité</span>` : '')}
      ${sec('diag', 'Diagnostic chiffré', diagnosticHtml(a))}
      ${sec('ctx', 'Contexte de marché', contextHtml(a))}
      ${sec('lignes', 'Revue ligne par ligne', themesHtml(a), a.compact ? '<span class="note">archive allégée : thèse, piste et cours</span>' : '<button class="btn sm no-print" data-rvall>Tout déplier</button>')}
      ${sec('plan', 'Plan d\'action et calendrier', planHtml(a))}
      ${sec('src', 'Sources', sourcesHtml(a), `<span class="note">${plural((a.sources || []).length, 'lien', 'liens')}, sources primaires d'abord</span>`)}
    </div>
    <p class="guard">${esc(a.note)} Chaque fait porte sa date et son lien ; un chiffre calculé est étiqueté « calculé » ; ce qui n'est pas publié est écrit comme tel.</p></div>`;
}

const here = () => { const r = L.router.parse(); return r.view === 'decisions' && r.sub === 'synthese'; };
const dayOf = () => { const j = L.router.parse().q.jour || ''; return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : null; };
L.synthese = async (el, force) => {
  clearTimeout(S.timer);
  const day = S.day = dayOf();
  let s;
  try { s = await L.get(day ? '/api/synthese/' + day : '/api/synthese/today', 60000, !!force); }
  catch (e) { if (here() && document.body.contains(el)) el.innerHTML = L.errBox(e); return; }
  if (!here() || !document.body.contains(el) || dayOf() !== day) return;
  // Relecture en place : les blocs dépliés et la position de lecture sont gardés
  const had = !!el.querySelector('.rv'), y = window.scrollY;
  const opened = new Set(L.qsa('.rv-l[open]', el).map(d => d.dataset.uid));
  const closed = new Set(L.qsa('.rv-l:not([open])', el).map(d => d.dataset.uid));
  render(el, s);
  if (had) { L.qsa('.rv-l', el).forEach(d => { if (opened.has(d.dataset.uid)) d.open = true; else if (closed.has(d.dataset.uid)) d.open = false; }); window.scrollTo(0, y); }
  const meta = document.getElementById('decMeta');
  if (meta) meta.textContent = s.analysis ? plural((s.analysis.decisions || []).length, 'décision à étudier', 'décisions à étudier') : '';
  // Sources lentes encore en lecture : nouvelle lecture toute seule (quelques essais, puis on s'arrête)
  const waiting = !day && s.analysis && (s.analysis.pending || []).length;
  if (waiting && S.tries < 8) { S.tries += 1; S.timer = setTimeout(() => { if (here()) L.synthese(el, true); }, 5000); }
  else if (!waiting) S.tries = 0;
};
/* Même page, autre jour (archive) : le routeur ne redessine que si la vue change */
window.addEventListener('hashchange', () => setTimeout(() => {
  const el = document.getElementById('dSub');
  if (el && here() && el.querySelector('.rv, .empty') && dayOf() !== S.day) L.synthese(el);
}, 0));

const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const scrollTo = n => { if (n) n.scrollIntoView({ behavior: smooth(), block: 'start' }); };
function openLine(uid) {
  const d = document.getElementById('rvl-' + uid); if (!d) return;
  d.open = true; scrollTo(d);
  d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
}
const lineOf = uid => ((S.a || {}).themes || []).flatMap(t => t.lines).find(l => l.uid === uid);
const root = () => document.getElementById('dSub');

/* Une seule écoute pour toute la page : elle survit aux relectures */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rvline],[data-rvtheme],[data-rvjump],[data-rvall],[data-rvbars],[data-rvrefresh],[data-rvprint],[data-rvnote],[data-rvrules]');
  const el = root();
  if (!b || !el || !el.contains(b)) return;
  const ds = b.dataset;
  if ('rvline' in ds) { e.preventDefault(); openLine(ds.rvline); }
  else if ('rvtheme' in ds) { e.preventDefault(); scrollTo(L.qsa('.rv-t', el).find(x => x.dataset.theme === ds.rvtheme)); }
  else if ('rvjump' in ds) { e.preventDefault(); scrollTo(document.getElementById('rv-' + ds.rvjump)); }
  else if ('rvall' in ds) { const all = L.qsa('.rv-l', el); const open = all.some(d => !d.open); all.forEach(d => { d.open = open; }); b.textContent = open ? 'Tout replier' : 'Tout déplier'; }
  else if ('rvbars' in ds) { S.barsAll = true; const box = el.querySelector('.rv-bars'); if (box) box.classList.remove('cut'); b.remove(); }
  else if ('rvrefresh' in ds) { S.tries = 0; L.forget('/api/synthese'); L.synthese(el, true).then(() => L.toast('Synthèse relue')); }
  else if ('rvprint' in ds) { L.qsa('.rv details', el).forEach(d => { d.open = true; }); const box = el.querySelector('.rv-bars'); if (box) box.classList.remove('cut'); setTimeout(() => window.print(), 80); }
  else if ('rvnote' in ds) noteForm(ds.rvnote);
  else if ('rvrules' in ds) rulesForm();
});

/* Ma thèse sur une ligne : critère d'invalidation, thème, classement, offre publique */
function noteForm(uid) {
  const l = lineOf(uid); if (!l) return;
  const n = l.note || {}, th = (S.a || {}).theses || {}, defs = (S.a || {}).theses_def || {};
  const keys = ['intacte', 'surveiller', 'modifiee', 'speculatif', 'speciale'];
  const stock = l.asset_type === 'Action';
  const d = L.drawer.open('detail', { title: `Ma thèse sur ${esc(l.name)}`, sub: 'Ces notes restent dans votre LUMIO et entrent dans la synthèse', narrow: true,
    html: `<form id="rvF" class="frm" style="grid-template-columns:minmax(0,1fr)" autocomplete="off">
      <label class="fld"><span>Critère d'invalidation : le fait qui vous ferait sortir (résultat, contrat, financement)</span>
        <textarea class="inp rv-ta" name="criterion" rows="3" maxlength="300" placeholder="Exemple : chiffre d'affaires en baisse deux trimestres de suite">${esc(n.criterion || '')}</textarea></label>
      <label class="fld"><span>Thème (vide : choisi par LUMIO, aujourd'hui « ${esc(l.theme)} »)</span><input class="inp" name="theme" maxlength="40" value="${esc(n.theme || '')}"></label>
      <label class="fld"><span>Classement de la thèse</span><select class="sel" name="these"><option value="auto">Par les règles de LUMIO${l.these.auto ? ` (aujourd'hui : ${esc(l.these.label.toLowerCase())})` : ''}</option>
        ${keys.map(k => `<option value="${k}" ${n.these === k ? 'selected' : ''}>${esc(th[k] || k)} : ${esc(defs[k] || '')}</option>`).join('')}</select></label>
      ${stock ? `<fieldset class="rv-fs"><legend>Offre publique en cours (facultatif)</legend>
        <label class="fld"><span>Prix d'offre par action (${esc(F.sym((l.price || {}).currency))})</span><input class="inp" name="offer_price" inputmode="decimal" value="${esc(n.offer_price ?? '')}"></label>
        <label class="fld"><span>Cours d'avant la rumeur (${esc(F.sym((l.price || {}).currency))})</span><input class="inp" name="pre_price" inputmode="decimal" value="${esc(n.pre_price ?? '')}"></label>
        <p class="note">Gain restant = prix d'offre / cours − 1. Risque d'échec = cours d'avant la rumeur / cours − 1.</p></fieldset>` : ''}
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn p" type="submit">Enregistrer</button><span class="note" id="rvMsg" role="status"></span></div>
    </form>` });
  d.querySelector('#rvF').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await L.api('/api/theses/' + encodeURIComponent(uid), { method: 'PUT', body });
      L.toast('Thèse enregistrée'); L.drawer.close(); L.forget('/api/synthese');
      const el = root(); if (el && here()) { await L.synthese(el, true); openLine(uid); }
    } catch (err) { L.put('rvMsg', `<span class="dn">${esc(err.message)}</span>`); }
  };
}
/* Seuils propres à la synthèse : plafond d'un pari spéculatif, nombre de paliers d'une entrée */
function rulesForm() {
  const r = (S.a || {}).rules || {};
  const d = L.drawer.open('detail', { title: 'Seuils de la synthèse', sub: 'Les autres règles se règlent dans « À décider », sous « Vos règles »', narrow: true,
    html: `<form id="rvR" class="frm" style="grid-template-columns:minmax(0,1fr)" autocomplete="off">
      <label class="fld"><span>Part du portefeuille au plus par pari spéculatif (%)</span><input class="inp" name="max_spec" inputmode="decimal" value="${esc(r.max_spec ?? 2)}"></label>
      <label class="fld"><span>Nombre de paliers pour une entrée</span><input class="inp" name="tranches" inputmode="numeric" value="${esc(r.tranches ?? 3)}"></label>
      <p class="note">Pari spéculatif : société en pertes ou dépendante de financements externes, ou actif sans revenus (crypto). Limite d'une ligne : ${F.n(r.max_line, 0)} % ; seuil de perte : ${F.n(r.stop, 0)} %.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn p" type="submit">Enregistrer</button><span class="note" id="rvRM" role="status"></span></div></form>` });
  d.querySelector('#rvR').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { max_spec: +String(fd.get('max_spec')).replace(',', '.'), tranches: +String(fd.get('tranches')).replace(',', '.') };
    try {
      await L.api('/api/rules', { method: 'PUT', body });
      L.toast('Seuils enregistrés'); L.drawer.close(); L.forget('/api/synthese'); L.forget('/api/decisions');
      const el = root(); if (el && here()) L.synthese(el, true);
    } catch (err) { L.put('rvRM', `<span class="dn">${esc(String(err.message).replace('max_spec', 'Plafond d\'un pari spéculatif').replace('tranches', 'Nombre de paliers').replace('0.5', '0,5'))}</span>`); }
  };
}
})();
