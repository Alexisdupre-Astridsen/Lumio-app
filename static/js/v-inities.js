/* LUMIO — Initiés : ce qu'achètent et vendent les grands investisseurs (13F), les dirigeants des
   sociétés suivies (formulaires 4) et les élus américains (STOCK Act). Sources officielles, délais
   légaux affichés ; les pistes croisent ces signaux avec vos lignes, jamais un conseil. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const SUBS = [['pistes', 'Pistes'], ['fonds', 'Grands investisseurs'], ['dirigeants', 'Dirigeants'], ['elus', 'Élus']];
const MOVE = { new: ['Nouvelle ligne', 'up'], add: ['Renforcée', 'up'], trim: ['Allégée', 'dn'], exit: ['Soldée', 'dn'] };
const S = { tries: 0, timer: null };
const mine = () => L.store.get('ini.mine', true);
const buys = () => L.store.get('ini.buys', false);
const tags = x => `${x.held ? ' <span class="tag held">détenu</span>' : ''}${x.watch ? ' <span class="tag">suivi</span>' : ''}`;
const usd = (v, d = 0) => v == null ? '—' : v >= 1e9 ? `${F.n(v / 1e9, 1)} Md$` : v >= 1e6 ? `${F.n(v / 1e6, 1)} M$` : F.cur(v, 'USD', d);
const rng = t => t.amount_lo && t.amount_hi ? `${F.n(t.amount_lo, 0)} à ${F.n(t.amount_hi, 0)} $` : t.amount_lo ? `plus de ${F.n(t.amount_lo, 0)} $` : (t.amount || '—');
const who = n => (n || '').toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const quarter = iso => { const d = F.toDate(iso); return d && !isNaN(d) ? `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` : '—'; };
const posOf = x => (L.data.portfolio?.positions || []).find(p => (x.ticker && (p.ticker || '').split('.')[0].toUpperCase() === x.ticker) || p.name === x.name);
const src = url => url ? `<a class="lnk" href="${L.url(url)}" target="_blank" rel="noopener noreferrer">${L.icon('ext')}Source</a>` : '';

function shell(root, sub) {
  root.innerHTML = `<div class="ph ini-ph"><h1 class="title">Initiés</h1>
      <p class="ini-sub">Ce qu'achètent et vendent les grands investisseurs, les dirigeants de vos sociétés et les élus américains, d'après leurs déclarations officielles.</p></div>
    <nav class="subnav" style="margin-top:0" aria-label="Sources">${SUBS.map(([k, l]) => `<a href="#/inities/${k}" data-sub="${k}" class="${k === sub ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="iSub"></div>`;
}
const pending = () => `<section class="w"><div class="ini-wait"><span class="spin" aria-hidden="true"></span><div><b>Lecture des déclarations officielles…</b>
  <p class="note">SEC (grands fonds, dirigeants) et Chambre des représentants (élus) : la première fois, quelques minutes ; ensuite, mise à jour toutes les 6 heures.</p></div></div></section>`;
const footer = d => `<p class="note ini-foot">Sources : ${(d.sources || []).map(s => `<a class="lnk" href="${L.url(s.url)}" target="_blank" rel="noopener noreferrer">${L.esc(s.label)}</a>`).join(' ; ')}.
  Délais légaux : grands fonds, ${L.esc(d.delays?.fund || '')} ; dirigeants, ${L.esc(d.delays?.insider || '')} ; élus, ${L.esc(d.delays?.politician || '')}.
  ${d.updated ? `Lu le ${F.date(d.updated)} à ${F.time(d.updated)}.` : ''}${d.demo ? ' <b>Démo : fonds, dirigeants et élus fictifs.</b>' : ''}
  ${(d.errors || []).length ? `<br>Non lus cette fois : ${L.esc(d.errors.slice(0, 6).join(' ; '))}.` : ''}</p>`;

async function renderSub(sub, dir) {
  const el = document.getElementById('iSub'); if (!el) return;
  el.className = dir && !document.documentElement.classList.contains('vt-sub') ? (dir > 0 ? 'slide-r' : 'slide-l') : '';
  L.qsa('.subnav a').forEach(a => a.classList.toggle('on', a.dataset.sub === sub));
  if (!el.firstChild) el.innerHTML = `<div class="sk-on">${L.skel(300)}</div>`;
  let d;
  try { d = await L.get('/api/insiders', 60000, S.tries > 0); } catch (e) { el.innerHTML = L.errBox(e); return; }
  if (!document.getElementById('iSub')) return;
  clearTimeout(S.timer);
  if (d.pending && !(d.funds || []).length && !(d.leads || []).length) {
    el.innerHTML = pending();
    if (S.tries++ < 60) S.timer = setTimeout(() => renderSub(L.router.last?.sub || sub), 5000);
    return;
  }
  S.tries = 0;
  S.last = d;
  if (d.pending) S.timer = setTimeout(() => { L.forget('/api/insiders'); renderSub(L.router.last?.sub || sub); }, 20000);
  el.innerHTML = (sub === 'fonds' ? fundsView(d) : sub === 'dirigeants' ? insidersView(d) : sub === 'elus' ? politiciansView(d) : leadsView(d)) + footer(d);
}

/* ── Pistes : plusieurs signaux qui convergent sur une même société ── */
function leadsView(d) {
  const ls = d.leads || [];
  const grp = (t, xs) => xs.length ? `<div class="ini-g"><span class="k-l">${t}</span><ul>${xs.map(x => `<li>${L.esc(x)}</li>`).join('')}</ul></div>` : '';
  return `<div class="callout ini-call">Une piste réunit plusieurs signaux sur une même société : achats de grands investisseurs, de dirigeants, d'élus. C'est un point de départ pour vos recherches (actualité, valorisation, poids dans votre portefeuille), pas une recommandation.</div>
  ${ls.length ? `<div class="ini-leads">${ls.map(x => {
    const p = posOf(x);
    return `<section class="w ini-lead"><div class="w-h"><h2>${L.esc(x.name)}${x.ticker ? ` <span class="muted ini-tk">${L.esc(x.ticker)}</span>` : ''}</h2>${tags(x)}
        <div class="r"><span class="score ${x.score >= 60 ? 'hi' : x.score >= 35 ? 'mid' : ''}" title="Force des signaux réunis, sur 100">${x.score}</span></div></div>
      <p class="ini-why">${L.esc(x.reasons.join(' ; '))}.</p>
      <div class="ini-gs">${grp('Grands investisseurs', x.funds)}${grp('Dirigeants (30 jours)', x.insiders)}${grp('Élus (60 jours)', x.politicians)}</div>
      <div class="w-f">${p ? `<button class="btn sm" data-pos="${L.esc(p.uid)}">Voir la fiche</button>` : ''}
        <button class="btn sm ia" data-ask="${L.esc(`${x.name} : ${x.reasons.join(', ')}. Qu'en dit l'actualité récente et comment cela s'inscrit-il dans mon portefeuille ?`)}">${L.icon('spark')}Analyser avec l'IA</button></div></section>`;
  }).join('')}</div>` : '<section class="w"><div class="empty">Aucune convergence de signaux pour l\'instant : les pistes apparaissent quand plusieurs grands fonds, dirigeants ou élus achètent la même société.</div></section>'}`;
}

/* ── Grands investisseurs : dernier portefeuille 13F et mouvements du trimestre ── */
function fundsView(d) {
  const fs = d.funds || [];
  if (!fs.length) return '<section class="w"><div class="empty">Aucune déclaration 13F lue pour l\'instant.</div></section>';
  const count = f => ['new', 'add', 'trim', 'exit'].map(k => [k, (f.moves || []).filter(m => m.move === k).length]).filter(([, n]) => n);
  return `<div class="ini-funds">${fs.map(f => {
    const mineIn = (f.top || []).concat(f.moves || []).filter(r => r.held || r.watch);
    return `<section class="w click ini-fund" data-fund="${f.cik}" role="button" tabindex="0" aria-label="${L.esc(`Portefeuille de ${f.manager}`)}">
      <div class="w-h"><h2>${L.esc(f.manager)}</h2><div class="r note">${quarter(f.period)}</div></div>
      <div class="ini-firm">${L.esc(f.firm)} · ${L.esc(f.style)} · ${usd(f.value)} déclarés</div>
      <ol class="ini-top">${(f.top || []).slice(0, 5).map(r => `<li><span class="ell">${L.esc(r.name)}</span>${tags(r)}<b>${F.n(r.weight, 1)} %</b></li>`).join('')}</ol>
      <div class="ini-mvs">${count(f).map(([k, n]) => `<span class="ini-mv ${MOVE[k][1]}">${n} ${MOVE[k][0].toLowerCase()}${n > 1 ? 's' : ''}</span>`).join('') || '<span class="note">Pas de trimestre précédent pour comparer</span>'}</div>
      ${mineIn.length ? `<p class="ini-mine">Vos valeurs : ${L.esc([...new Set(mineIn.map(r => r.name))].slice(0, 4).join(', '))}</p>` : ''}</section>`;
  }).join('')}</div>`;
}
function openFund(cik) {
  const f = (S.last?.funds || []).find(x => x.cik === cik);
  const go = async () => {
    let x = f;
    if (!x) { try { x = await L.get('/api/insiders/fund/' + cik, 60000); } catch (e) { L.toast(e.message, true); return; } }
    const row = r => `<tr><td><b>${L.esc(r.name)}</b>${tags(r)}${r.put_call ? ` <span class="tag">${r.put_call === 'CALL' ? 'option d\'achat' : 'option de vente'}</span>` : ''}</td>
      <td class="num">${usd(r.value)}</td><td class="num">${F.n(r.weight, 1)} %</td></tr>`;
    const mv = r => `<tr><td><b>${L.esc(r.name)}</b>${tags(r)}</td><td><span class="ini-mv ${MOVE[r.move][1]}">${MOVE[r.move][0]}</span></td>
      <td class="num">${r.change_pct != null && r.move !== 'exit' ? F.pct(r.change_pct, 0) + ' de parts' : ''}</td><td class="num">${r.move === 'exit' ? '—' : F.n(r.weight, 1) + ' %'}</td></tr>`;
    L.drawer.open('detail', {
      wide: true, title: `${L.esc(x.manager)} · ${L.esc(x.firm)}`,
      sub: `Portefeuille déclaré au ${F.date(x.period)} (publié le ${F.date(x.filed)}) · ${usd(x.value)} · ${x.count} lignes`,
      html: `<p class="note" style="margin-top:0">Déclaration 13F à la SEC : actions cotées aux États-Unis détenues en fin de trimestre, publiées jusqu'à 45 jours après. Les positions ont pu changer depuis.</p>
        ${(x.moves || []).length ? `<div class="sec"><h3>Mouvements du trimestre</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Société</th><th>Mouvement</th><th class="num">Variation</th><th class="num">Poids</th></tr></thead><tbody>${x.moves.map(mv).join('')}</tbody></table></div></div>` : ''}
        <div class="sec"><h3>Principales lignes</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Société</th><th class="num">Valeur</th><th class="num">Poids</th></tr></thead><tbody>${(x.top || []).map(row).join('')}</tbody></table></div></div>
        <div class="sec">${src(x.link)}</div>`,
    });
  };
  go();
}

/* ── Dirigeants : formulaires 4 (achats et ventes sur le marché) ── */
const WHY = { rupture: 'rupture', elus: 'achetée par des élus' };
const whyTags = t => (t.why || []).map(w => ` <span class="tag v">${WHY[w] || L.esc(w)}</span>`).join('');
function insidersView(d) {
  const own = d.insiders || [], xtra = d.extra_insiders || [];
  // « Vos valeurs » vide (sociétés surtout européennes) : on montre tout, en le disant
  const scope = mine() && own.some(t => !buys() || t.side === 'buy') ? 'mine' : 'all';
  const base = scope === 'mine' ? own : own.concat(xtra).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const rows = base.filter(t => !buys() || t.side === 'buy');
  const chips = `<div class="toolbar"><div class="chips" role="group" aria-label="Sociétés"><button class="chip ${scope === 'mine' ? 'on' : ''}" aria-pressed="${scope === 'mine'}" data-imine="1">Vos valeurs</button><button class="chip ${scope === 'all' ? 'on' : ''}" aria-pressed="${scope === 'all'}" data-imine="0">Toutes${xtra.length ? ` (+${new Set(xtra.map(t => t.ticker)).size} sociétés)` : ''}</button></div>
    <div class="chips" role="group" aria-label="Opérations"><button class="chip ${!buys() ? 'on' : ''}" aria-pressed="${!buys()}" data-ibuys="0">Achats et ventes</button><button class="chip ${buys() ? 'on' : ''}" aria-pressed="${buys()}" data-ibuys="1">Achats seulement</button></div></div>`;
  const note = mine() && scope === 'all' ? `<p class="note" style="margin:-4px 0 10px">Aucune opération de dirigeant sur vos valeurs américaines ces 4 derniers mois : voici celles des sociétés des ruptures et des sociétés que des élus achètent.</p>` : '';
  return `<div class="callout ini-call">Dirigeants, administrateurs et grands actionnaires des sociétés américaines que vous détenez ou suivez, de celles des ruptures et de celles que des élus achètent. Un achat sur le marché avec son propre argent est un signal plus parlant qu'une vente (souvent fiscale ou programmée).</div>${chips}${note}
    ${rows.length ? `<section class="w"><div class="tbl-wrap"><table class="tbl ini-tbl"><thead><tr><th>Date</th><th>Société</th><th>Qui</th><th>Opération</th><th class="num">Montant</th><th></th></tr></thead><tbody>
      ${rows.slice(0, 250).map(t => `<tr><td class="c-date">${F.dshort(t.date)}</td><td class="c-what"><b>${L.esc(t.name)}</b> <span class="muted">${L.esc(t.ticker)}</span>${tags(t)}${whyTags(t)}</td>
        <td class="c-who">${L.esc(who(t.who))}<div class="note">${L.esc(t.role || '')}</div></td>
        <td class="c-op"><span class="ini-mv ${t.side === 'buy' ? 'up' : 'dn'}">${t.side === 'buy' ? 'Achat' : 'Vente'}</span><div class="note">${F.n(t.shares, 0)} actions${t.price ? ' à ' + F.cur(t.price, 'USD') : ''}</div></td>
        <td class="num c-amt">${usd(t.amount_usd)}</td><td class="c-src">${src(t.link)}</td></tr>`).join('')}</tbody></table></div></section>`
      : `<section class="w"><div class="empty">${d.pending ? 'Lecture des déclarations en cours…' : 'Aucun achat ni vente de dirigeant lu ces 4 derniers mois.'}</div></section>`}`;
}

/* ── Élus : déclarations de transactions de la Chambre des représentants ── */
const asset = t => (t.asset || t.ticker || '').replace(/\s*-\s*(Class [A-C] )?Common Stock.*$/i, '').replace(/\s*\([A-Z.]{1,6}\)\s*$/, '');
const OWN = { SP: 'conjoint', JT: 'compte joint', DC: 'enfant', '': '' };
const TXL = { P: ['Achat', 'up'], S: ['Vente', 'dn'], 'S (partial)': ['Vente partielle', 'dn'], E: ['Échange', ''] };
function politiciansView(d) {
  const all = (d.politicians || []).filter(t => !buys() || t.tx === 'P');
  const minev = all.filter(t => t.held || t.watch);
  const fall = mine() && !minev.length && all.length;            // rien sur vos valeurs : tout, en le disant
  const rows = mine() && !fall ? minev : all;
  const on = mine() && !fall;
  const chips = `<div class="toolbar"><div class="chips" role="group" aria-label="Valeurs"><button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-imine="1">Vos valeurs${minev.length ? ` (${minev.length})` : ''}</button><button class="chip ${!on ? 'on' : ''}" aria-pressed="${!on}" data-imine="0">Toutes</button></div>
    <div class="chips" role="group" aria-label="Opérations"><button class="chip ${!buys() ? 'on' : ''}" aria-pressed="${!buys()}" data-ibuys="0">Achats et ventes</button><button class="chip ${buys() ? 'on' : ''}" aria-pressed="${buys()}" data-ibuys="1">Achats seulement</button></div></div>`;
  return `<div class="callout ini-call">Membres de la Chambre des représentants des États-Unis (STOCK Act) : chaque opération est déclarée jusqu'à 45 jours après, avec un montant par tranche. Les sénateurs ne sont pas encore couverts ; les élus français ne publient pas leurs opérations (seulement des déclarations de patrimoine).</div>${chips}${fall ? '<p class="note" style="margin:-4px 0 10px">Aucune opération d\'élu sur vos valeurs ces 4 derniers mois : voici toutes les opérations récentes.</p>' : ''}
    ${rows.length ? `<section class="w"><div class="tbl-wrap"><table class="tbl ini-tbl"><thead><tr><th>Date</th><th>Élu</th><th>Titre</th><th>Opération</th><th class="num">Montant</th><th></th></tr></thead><tbody>
      ${rows.slice(0, 200).map(t => `<tr><td class="c-date">${F.dshort(t.date)}<div class="note">déclaré le ${F.dshort(t.filed)}</div></td><td class="c-who"><b>${L.esc(t.who)}</b><div class="note">${L.esc(t.district || '')}${OWN[t.owner] ? ' · ' + OWN[t.owner] : ''}</div></td>
        <td class="c-what">${L.esc(asset(t))} <span class="muted">${L.esc(t.ticker)}</span>${t.asset_type === 'OP' ? ' <span class="tag">options</span>' : ''}${tags(t)}</td>
        <td class="c-op"><span class="ini-mv ${(TXL[t.tx] || ['', ''])[1]}">${(TXL[t.tx] || [t.tx])[0]}</span></td><td class="num c-amt">${L.esc(rng(t))}</td><td class="c-src">${src(t.link)}</td></tr>`).join('')}</tbody></table></div></section>`
      : `<section class="w"><div class="empty">${mine() ? 'Aucune opération d\'élu sur vos valeurs ces 4 derniers mois.' : 'Aucune opération lue.'}</div></section>`}`;
}

/* Résumé pour le tableau de bord (module « Initiés ») */
L.insidersCard = d => {
  if (d.pending && !(d.leads || []).length) return '<div class="empty">Lecture des déclarations officielles en cours…</div>';
  const li = (t1, t2, href) => `<a class="li click" href="${href}"><div class="main"><div class="t1 ell">${t1}</div><div class="t2 ell">${t2}</div></div></a>`;
  const blk = (k, rows, href) => rows.length ? `<div class="ini-blk"><div class="k-l"><a href="${href}">${k}</a></div>${rows.join('')}</div>` : '';
  const ls = (d.leads || []).slice(0, 2);
  const seen = new Set(ls.map(x => x.ticker).filter(Boolean));
  // dirigeants : vos valeurs d'abord, puis les sociétés des ruptures et celles que les élus achètent
  const buysI = (d.insiders || []).filter(t => t.side === 'buy').concat((d.extra_insiders || []).filter(t => t.side === 'buy'))
    .sort((a, b) => (b.held || b.watch) - (a.held || a.watch) || (b.date || '').localeCompare(a.date || ''));
  const insRows = []; const insSeen = new Set();
  buysI.forEach(t => { if (insRows.length < 2 && !insSeen.has(t.ticker)) { insSeen.add(t.ticker); insRows.push(li(`${L.esc(t.name)} : achat d'un dirigeant${tags(t)}`, `${L.esc(who(t.who))} · ${usd(t.amount_usd)} · ${F.dshort(t.date)}`, '#/inities/dirigeants')); } });
  // élus : vos valeurs d'abord, sinon les achats les plus importants des 30 derniers jours
  const cut = Date.now() - 30 * 864e5;
  const polB = (d.politicians || []).filter(t => t.tx === 'P' && t.asset_type !== 'OP' && F.toDate(t.date) >= cut)
    .sort((a, b) => (b.held || b.watch) - (a.held || a.watch) || (b.amount_hi || b.amount_lo || 0) - (a.amount_hi || a.amount_lo || 0));
  const polRows = []; const polSeen = new Set();
  polB.forEach(t => { if (polRows.length < 2 && !polSeen.has(t.ticker)) { polSeen.add(t.ticker); polRows.push(li(`${L.esc(asset(t))} : achat d'un élu${tags(t)}`, `${L.esc(t.who)} · ${L.esc(rng(t))} · ${F.dshort(t.date)}`, '#/inities/elus')); } });
  // grands fonds : nouvelles lignes les plus lourdes du dernier trimestre
  const fm = (d.funds || []).flatMap(f => (f.moves || []).filter(m => m.move === 'new' && !m.put_call).map(m => ({ ...m, manager: f.manager })))
    .sort((a, b) => (b.held || b.watch) - (a.held || a.watch) || (b.weight || 0) - (a.weight || 0)).slice(0, 2);
  const fRows = fm.map(m => li(`${L.esc(m.manager)} ouvre une ligne${tags(m)}`, `${L.esc(m.name)} · ${F.n(m.weight, 1)} % de son portefeuille`, '#/inities/fonds'));
  const out = blk('Pistes', ls.map(x => li(`${L.esc(x.name)}${tags(x)}`, L.esc(x.reasons.join(' ; ')), '#/inities/pistes')), '#/inities/pistes')
    + blk('Dirigeants', insRows, '#/inities/dirigeants') + blk('Élus américains', polRows, '#/inities/elus') + blk('Grands investisseurs', fRows, '#/inities/fonds');
  return out || `<div class="empty">${d.pending ? 'Lecture des déclarations officielles en cours…' : 'Rien de notable pour l\'instant.'}</div>`;
};

document.addEventListener('click', e => {
  const f = e.target.closest('[data-fund]'); if (f && document.getElementById('iSub')) { openFund(+f.dataset.fund); return; }
  const m = e.target.closest('[data-imine]'); if (m) { L.store.set('ini.mine', m.dataset.imine === '1'); renderSub(L.router.last?.sub || 'elus'); return; }
  const bb = e.target.closest('[data-ibuys]'); if (bb) { L.store.set('ini.buys', bb.dataset.ibuys === '1'); renderSub(L.router.last?.sub || 'dirigeants'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-fund]')) openFund(+e.target.dataset.fund); });

L.views.inities = {
  render(root, r) { const sub = SUBS.some(s => s[0] === r.sub) ? r.sub : 'pistes'; shell(root, sub); renderSub(sub); },
  sub(r, prev) { const o = SUBS.map(s => s[0]); const sub = o.includes(r.sub) ? r.sub : 'pistes'; renderSub(sub, o.indexOf(sub) - o.indexOf(prev.sub || 'pistes')); },
  refresh() { },
};
})();
