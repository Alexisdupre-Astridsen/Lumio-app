/* LUMIO — Veille : watchlists, marchés, ruptures technologiques, politique, tensions offre/demande. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const SUBS = [['watchlist', 'Watchlist'], ['marches', 'Marchés'], ['ruptures', 'Ruptures'], ['politique', 'Politique'], ['offre-demande', 'Offre / demande']];
const KIND = { ruptures: 'ruptures', politique: 'politique', 'offre-demande': 'supply' };
const S = { list: L.store.get('wl.list', 'Principale') };

function shell(root, sub) {
  root.innerHTML = `<div class="ph"><h1 class="title">Veille</h1></div>
    <nav class="subnav" style="margin-top:0" aria-label="Modules de veille">${SUBS.map(([k, l]) => `<a href="#/veille/${k}" data-sub="${k}" class="${k === sub ? 'on' : ''}">${l}</a>`).join('')}</nav><div id="vSub"></div>`;
}
function renderSub(sub, dir) {
  const el = document.getElementById('vSub'); if (!el) return;
  el.className = dir && !document.documentElement.classList.contains('vt-sub') ? (dir > 0 ? 'slide-r' : 'slide-l') : '';
  L.qsa('.subnav a').forEach(a => a.classList.toggle('on', a.dataset.sub === sub));
  el.innerHTML = `<div class="sk-on">${L.skel(300)}</div>`;
  if (sub === 'watchlist') watchlist(el); else if (sub === 'marches') markets(el); else module(el, sub);
}

/* ── Watchlists (plusieurs listes) ── */
async function watchlist(el, force = false) {
  let w, pa;
  try { [w, pa] = await Promise.all([L.get('/api/watchlist', 50000, force), L.get('/api/price-alerts', 30000, force)]); } catch (e) { el.innerHTML = L.errBox(e); return; }
  const lists = w.lists || ['Principale'];
  if (!lists.includes(S.list)) S.list = lists[0];
  const items = (w.items || []).filter(x => (x.list || 'Principale') === S.list);
  const alertsFor = tk => (pa.items || []).filter(a => a.ticker === tk);
  el.innerHTML = `<div class="toolbar"><div class="chips" role="group" aria-label="Listes">${lists.map(l => `<button class="chip ${l === S.list ? 'on' : ''}" aria-pressed="${l === S.list}" data-wl="${L.esc(l)}">${L.esc(l)} <span class="muted">${(w.items || []).filter(x => (x.list || 'Principale') === l).length}</span></button>`).join('')}
      <button class="chip" id="wlNew">${L.icon('plus')} Nouvelle liste</button></div></div>
    <section class="w wl-add" style="margin-bottom:16px"><div class="w-h"><h2>Ajouter une valeur à « ${L.esc(S.list)} »</h2></div>
      <div style="position:relative;max-width:560px"><label class="search" style="max-width:none">${L.icon('search')}<input class="inp" id="wlQ" type="search" placeholder="Nom, ticker ou ISIN (ex. Schneider, MU, FR0000121972)" autocomplete="off" aria-label="Rechercher une valeur"></label>
        <div id="wlRes" class="pop" style="position:absolute;top:44px;left:0;right:0;width:auto;padding:6px"></div></div></section>
    <section class="w"><div class="w-h"><h2>${L.esc(S.list)}</h2><div class="r note">${items.length} valeur${items.length > 1 ? 's' : ''}</div></div>
    ${items.length ? `<div class="only-m">${items.map(x => `<div class="li"><div class="main"><div class="t1 ell">${L.esc(x.name)}</div>
        <div class="t2">${L.esc(x.ticker)}${x.month_pct != null ? ` · 1 mois <span class="${L.cls(x.month_pct)}">${F.pct(x.month_pct, 1)}</span>` : ''}${x.target_price ? ` · cible ${F.cur(x.target_price, x.currency, 0)}` : ''}${alertsFor(x.ticker).length ? ` · ${alertsFor(x.ticker).length} alerte${alertsFor(x.ticker).length > 1 ? 's' : ''}` : ''}</div></div>
        <div class="end"><div>${x.price != null ? F.cur(x.price, x.currency) : '—'}</div><div class="${L.cls(x.change_pct_day)}" style="font-size:12.5px">${L.arrow(x.change_pct_day)} ${F.pct(x.change_pct_day, 1)}</div></div>
        <div class="acts"><button class="ibtn" data-wa="${L.esc(x.ticker)}" aria-label="Alerte de cours sur ${L.esc(x.name)}">${L.icon('bell')}</button><button class="ibtn" data-wd="${L.esc(x.ticker)}" aria-label="Retirer ${L.esc(x.name)}">${L.icon('trash')}</button></div></div>`).join('')}</div>
      <div class="tbl-wrap only-d"><table class="tbl"><thead><tr><th>Valeur</th><th>Cours</th><th>Jour</th><th>1 mois</th><th class="only-d"></th><th>Cible</th><th>Alertes</th><th></th></tr></thead><tbody>
      ${items.map(x => `<tr><td><div style="font-weight:600">${L.esc(x.name)}</div><div class="sub">${L.esc(x.ticker)}${x.note ? ' · ' + L.esc(x.note) : ''}</div></td><td>${x.price != null ? F.cur(x.price, x.currency) : '—'}</td>
        <td class="${L.cls(x.change_pct_day)}">${F.pct(x.change_pct_day, 1)}</td><td class="${L.cls(x.month_pct)}">${F.pct(x.month_pct, 1)}</td><td class="only-d">${C.spark(x.spark, { w: 72, h: 22 })}</td>
        <td>${x.target_price ? `${F.cur(x.target_price, x.currency, 0)}<div class="sub ${L.cls(x.to_target_pct)}">${F.pct(x.to_target_pct, 1)}</div>` : '—'}</td>
        <td>${alertsFor(x.ticker).map(a => `<span class="tag ${a.triggered_at ? 'warn' : ''}" title="${a.triggered_at ? 'déclenchée' : 'en attente'}">${a.kind === 'move' ? '±' + F.n(a.value, 1) + ' %' : (a.kind === 'above' ? '≥ ' : '≤ ') + F.n(a.value, 0)}</span>`).join(' ') || '—'}</td>
        <td><div class="acts"><button class="ibtn" data-wa="${L.esc(x.ticker)}" title="Alerte de cours" aria-label="Alerte de cours sur ${L.esc(x.name)}">${L.icon('bell')}</button><button class="ibtn" data-wt="${L.esc(x.ticker)}" title="Prix cible et note" aria-label="Prix cible et note">${L.icon('edit')}</button><button class="ibtn" data-wd="${L.esc(x.ticker)}" title="Retirer" aria-label="Retirer ${L.esc(x.name)}">${L.icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Liste vide : recherchez une valeur ci-dessus, ou ajoutez des candidats depuis les modules Ruptures et Offre / demande (bouton « Suivre »).</div>'}</section>`;
  const q = document.getElementById('wlQ'), res = document.getElementById('wlRes');
  q.addEventListener('input', L.debounce(async () => {
    const v = q.value.trim(); if (v.length < 2) { res.classList.remove('on'); return; }
    try {
      const r = await L.api('/api/search?q=' + encodeURIComponent(v));
      res.innerHTML = (r.results || []).slice(0, 8).map(x => `<button class="li click" style="width:100%;text-align:left" data-add="${L.esc(x.ticker || x.symbol)}" data-name="${L.esc(x.name || '')}"><div class="main"><div class="t1">${L.esc(x.name || x.ticker)}</div><div class="t2">${L.esc([x.ticker || x.symbol, x.exch, x.type].filter(Boolean).join(' · '))}</div></div>${L.icon('plus')}</button>`).join('') || '<div class="note" style="padding:8px">Aucun résultat.</div>';
      res.classList.add('on');
    } catch (e) { res.innerHTML = `<div class="note" style="padding:8px">${L.esc(e.message)}</div>`; res.classList.add('on'); }
  }, 250));
  L.on(el, 'click', '[data-add]', async (e, b) => { await add(b.dataset.add, b.dataset.name); res.classList.remove('on'); q.value = ''; watchlist(el, true); });
  L.on(el, 'click', '[data-wl]', (e, b) => { S.list = b.dataset.wl; L.store.set('wl.list', S.list); watchlist(el); });
  L.on(el, 'click', '#wlNew', async () => {
    const v = await L.form('Nouvelle liste', [{ label: 'Nom de la liste', placeholder: 'Semi-conducteurs, Nucléaire…', maxlength: 30 }], 'Créer', false);
    const n = v ? v[0].trim().slice(0, 30) : '';
    if (n) { S.list = n; L.store.set('wl.list', n); watchlist(el); setTimeout(() => document.getElementById('wlQ')?.focus(), 50); }
  });
  L.on(el, 'click', '[data-wd]', async (e, b) => { try { await L.api(`/api/watchlist/${encodeURIComponent(b.dataset.wd)}?list=${encodeURIComponent(S.list)}`, { method: 'DELETE' }); L.forget('/api/watchlist'); L.forget('/api/dashboard'); watchlist(el, true); } catch (err) { L.toast(err.message, true); } });
  L.on(el, 'click', '[data-wt]', async (e, b) => {
    const x = items.find(i => i.ticker === b.dataset.wt);
    const v = await L.form(x.name, [{ label: `Prix cible (${F.sym(x.currency)}), vide pour aucun`, value: x.target_price ?? '', inputmode: 'decimal' },
      { label: 'Note (raison du suivi)', value: x.note || '', maxlength: 200 }], 'Enregistrer', false);
    if (!v) return;
    const [tp, note] = [v[0].trim(), v[1]];
    try { await L.api('/api/watchlist', { method: 'POST', body: { ticker: x.ticker, name: x.name, note, target_price: tp === '' ? null : tp.replace(',', '.'), list: S.list } }); L.forget('/api/watchlist'); watchlist(el, true); } catch (err) { L.toast(err.message, true); }
  });
  L.on(el, 'click', '[data-wa]', (e, b) => alertForm(items.find(i => i.ticker === b.dataset.wa), () => watchlist(el, true)));
}
async function add(ticker, name, list = S.list) {
  try { await L.api('/api/watchlist', { method: 'POST', body: { ticker, name, list } }); L.forget('/api/watchlist'); L.forget('/api/dashboard'); L.toast(`${name || ticker} ajouté à « ${list} »`); }
  catch (e) { L.toast(e.message, true); }
}
L.follow = add;
function alertForm(x, done) {
  const d = L.drawer.open('detail', { narrow: true, title: `Alerte sur ${L.esc(x.name)}`, sub: `Cours actuel ${F.cur(x.price, x.currency)}`, html: `<form id="waF" class="frm" style="grid-template-columns:1fr">
    <label class="fld"><span>Condition</span><select class="sel" name="kind"><option value="above">Le cours passe au-dessus de</option><option value="below">Le cours passe en dessous de</option><option value="move">La variation du jour dépasse (± %)</option></select></label>
    <label class="fld"><span>Seuil (${L.esc(F.sym(x.currency))} ou %)</span><input class="inp" name="value" type="number" step="any" min="0" required></label><button class="btn p" type="submit">Créer l'alerte</button></form>
    <p class="note" style="margin-top:10px">L'alerte apparaît dans « À traiter » dès qu'elle se déclenche${L.store.get('notif', false) ? ', avec une notification du navigateur' : ''}.</p>` });
  d.querySelector('#waF').onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    try { await L.api('/api/price-alerts', { method: 'POST', body: { ticker: x.ticker, name: x.name, currency: x.currency, kind: fd.get('kind'), value: +fd.get('value') } }); L.forget('/api/price-alerts'); L.toast('Alerte créée'); L.drawer.close(); done && done(); }
    catch (err) { L.toast(err.message, true); }
  };
}

/* ── Marchés ── */
async function markets(el) {
  let r; try { r = await L.get('/api/indices', 50000); } catch (e) { el.innerHTML = L.errBox(e); return; }
  el.innerHTML = `<section class="w"><div class="w-h"><h2>Indices, devises, matières premières</h2><div class="r note">variation du jour · courbe sur 1 mois</div></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Marché</th><th>Dernier</th><th>Jour</th><th class="only-d">1 mois</th><th>État</th></tr></thead><tbody>
    ${(r.indices || []).map(x => `<tr><td><b>${L.esc(x.label)}</b><div class="sub">${L.esc(x.ticker)}</div></td><td>${F.n(x.price, x.price < 10 ? 4 : 2)}</td><td class="${L.cls(x.change_pct_day)}"><b>${L.arrow(x.change_pct_day)} ${F.pct(x.change_pct_day, 2)}</b></td>
      <td class="only-d">${C.spark(x.spark, { w: 120, h: 28 })}</td><td>${x.market_state === 'REGULAR' ? '<span class="tag up">ouvert</span>' : '<span class="tag">fermé</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/* ── Modules éditoriaux : ruptures, politique, offre/demande ── */
let followed = new Set();
const cand = (c) => `<span class="tag cand ${c.held ? 'held' : ''}">${L.esc(c.name)}${c.held ? ' · détenu' : c.ticker && followed.has(c.ticker) ? ' · suivi' : c.ticker ? ` <button class="lnk follow-b" data-follow="${L.esc(c.ticker)}" data-fname="${L.esc(c.name)}" title="Ajouter à la watchlist" aria-label="Suivre ${L.esc(c.name)}">Suivre</button>` : ''}</span>`;
const arts = (as) => (as || []).slice(0, 3).map(a => `<a class="art" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><div class="t1">${L.esc(a.title)}</div><div class="t2">${L.esc(a.source || '')} · ${F.ago(a.age_h)}</div></a>`).join('');
async function module(el, sub) {
  const kind = KIND[sub];
  let r; try { r = await L.get('/api/veille/' + kind, 600000); } catch (e) { el.innerHTML = L.errBox(e); return; }
  try { const w = await L.get('/api/watchlist', 50000); followed = new Set((w.items || []).map(x => x.ticker)); } catch (e) { followed = new Set(); }
  const es = (r.entries || []).slice();
  if (kind === 'supply') es.sort((a, b) => (b.tension || 0) - (a.tension || 0));
  const intro = { ruptures: 'Secteurs où une bascule technologique est datable : la thèse, les signaux à guetter, les sociétés cotées et les non cotées à surveiller avant leur introduction en bourse.',
    politique: 'Décisions publiques qui bougent les marchés, reliées aux secteurs et aux lignes que vous détenez.',
    supply: 'Marchés où la demande dépasse structurellement la production : une tension durable oblige le secteur à croître.' }[kind];
  el.innerHTML = `<p class="ink2" style="max-width:760px;margin-bottom:14px">${intro} <span class="note">Données éditoriales mises à jour le ${F.date(r.maj)} ; actualités en direct.</span></p>${kind === 'ruptures' ? '<section class="w pep-top" id="pepTop" aria-live="polite"><div class="sk-on">' + L.skel(120) + '</div></section>' : ''}<div class="cards">${es.map(e => `<section class="w c6 vcard" id="v-${L.esc(e.id)}">${
    kind === 'supply' ? `<div class="vc-h"><h3>${L.esc(e.label)}</h3><span class="tag v">${L.esc(e.statut || '')}</span></div>
      <div class="meter"><div class="gauge"><i style="width:${e.tension}%"></i></div><b style="color:var(--violet)">${e.tension}<span class="muted" style="font-weight:500">/100</span></b></div>
      <dl class="kv"><div><dt>Demande</dt><dd>${L.esc(e.demande?.chiffre || '')}</dd><div class="note" style="white-space:normal">${L.esc(e.demande?.detail || '')}</div></div><div><dt>Offre</dt><dd>${L.esc(e.offre?.chiffre || '')}</dd><div class="note" style="white-space:normal">${L.esc(e.offre?.detail || '')}</div></div></dl>
      <div class="chips">${(e.beneficiaires || []).map(cand).join('')}</div><p class="note">Source : ${L.esc(e.source || '')}</p>`
    : kind === 'ruptures' ? `<div class="vc-h"><h3>${L.esc(e.label)}</h3><span class="tag v">${L.esc(e.horizon)}</span></div>
      <p class="ink2" style="font-size:13.5px">${L.esc(e.these)}</p><p class="note">${L.esc(e.horizon_detail || '')}</p>
      ${(e.signaux || []).length ? `<div><div class="k-l" style="margin-bottom:4px">Signaux à guetter</div>${e.signaux.map(s => `<div class="note" style="color:var(--ink2)">• ${L.esc(s)}</div>`).join('')}</div>` : ''}
      <div><div class="k-l" style="margin-bottom:6px">Cotées</div><div class="chips" data-pep-cot="${L.esc(e.id)}">${(e.cotees || []).map(cand).join('')}</div></div>
      ${(e.pre_ipo || []).length ? `<div><div class="k-l" style="margin-bottom:6px">Non cotées à surveiller</div><div class="chips" data-pep-pre="${L.esc(e.id)}">${e.pre_ipo.map(n => `<span class="tag">${L.esc(n)}</span>`).join('')}</div></div>` : ''}
      <div data-pep-cand="${L.esc(e.id)}"></div>`
    : `<h3>${L.esc(e.label)}</h3><p class="ink2" style="font-size:13.5px">${L.esc(e.enjeu)}</p>
      <div class="chips">${(e.sector_labels || e.secteurs || []).map(s => `<span class="tag">${L.esc(s)}</span>`).join('')}</div>
      ${(e.held || []).length ? `<div class="callout" style="padding:8px 12px"><b style="font-weight:600">Vos lignes concernées :</b> ${e.held.map(L.esc).join(', ')}</div>` : '<p class="note">Aucune de vos lignes n\'est directement concernée.</p>'}`
    }<div>${arts(e.articles) || '<p class="note">Pas d\'article récent.</p>'}</div></section>`).join('')}</div>${kind === 'ruptures' ? '<p class="note pep-foot" id="pepFoot"></p>' : ''}`;
  L.on(el, 'click', '[data-follow]', async (ev, b) => {
    ev.preventDefault(); await add(b.dataset.follow, b.dataset.fname); followed.add(b.dataset.follow);
    b.replaceWith(b.closest('.pep-r') ? Object.assign(document.createElement('span'), { className: 'tag', textContent: 'suivi' }) : document.createTextNode(' · suivi'));
  });
  L.on(el, 'click', '[data-goto]', (ev, b) => { ev.preventDefault(); const c = document.getElementById('v-' + b.dataset.goto); if (c) c.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
  if (kind === 'ruptures') pepites();
}

/* ── Pépites des ruptures : élan des cours, signaux d'initiés datés, dossiers d'introduction SEC ── */
const PEP = { tries: 0, timer: null };
const mineTag = c => c.held ? '<span class="tag held">détenu</span>' : c.ticker && followed.has(c.ticker) ? '<span class="tag">suivi</span>'
  : c.ticker ? `<button class="lnk follow-b" data-follow="${L.esc(c.ticker)}" data-fname="${L.esc(c.name)}" title="Ajouter à la watchlist" aria-label="Suivre ${L.esc(c.name)}">Suivre</button>` : '';
const momo = m => m ? `<span class="pep-mo" title="Variation du cours, en devise de cotation"><span class="${L.cls(m.m3)}">3 mois ${F.pct(m.m3, 0)}</span><span class="${L.cls(m.y1)}">1 an ${F.pct(m.y1, 0)}</span></span>` : '';
const sigs = ss => (ss || []).map(x => `<a class="tag v pep-sig" href="${L.esc(x.link || '#/inities')}">${L.esc(x.text)}</a>`).join('');
const force = n => n ? `<span class="score ${n >= 45 ? 'hi' : ''}" title="Force des signaux réunis, sur 100">${n}</span>` : '';
const pepRow = (c, rup) => `<div class="pep-r"><div class="pep-n"><b>${L.esc(c.name)}</b>${c.ticker ? ` <span class="muted pep-tk">${L.esc(c.ticker)}</span>` : ''} ${mineTag(c)}${force(c.score)}</div>
  <div class="pep-d">${rup ? `<button class="tag pep-rup" data-goto="${L.esc(rup.id)}">${L.esc(rup.label)}</button>` : ''}${momo(c.momentum)}</div>${(c.signals || []).length ? `<div class="pep-ss">${sigs(c.signals)}</div>` : ''}</div>`;

async function pepites() {
  const top = document.getElementById('pepTop'); if (!top) return;
  clearTimeout(PEP.timer);
  let d; try { d = await L.get('/api/pepites', 60000, PEP.tries > 0); } catch (e) { top.innerHTML = L.errBox(e); return; }
  if (!document.getElementById('pepTop')) return;
  const wait = d.pending || d.insiders_pending;
  const list = d.top || [];
  top.innerHTML = `<div class="w-h"><h2>Pépites du moment</h2></div>
    <p class="pep-intro">Sociétés des ruptures où des initiés ont acheté ces 90 derniers jours : dirigeants, grands fonds, élus américains. Un point de départ pour vos recherches, pas une recommandation.</p>
    ${d.insiders_pending ? '' : list.length ? `<div class="pep-list">${list.map(x => pepRow(x, { id: x.rupture_id, label: x.rupture })).join('')}</div>`
      : '<p class="note">Aucun achat d\'initié sur ces sociétés ces 90 derniers jours. Les élans de cours et les dossiers d\'introduction restent visibles dans chaque rupture.</p>'}
    ${wait ? `<div class="ini-wait pep-wait"><span class="spin" aria-hidden="true"></span><div><b>${d.insiders_pending ? 'Lecture des déclarations d\'initiés…' : 'Lecture des cours et des dossiers SEC…'}</b>
      <p class="note">La première fois, quelques minutes ; ensuite, mise à jour plusieurs fois par jour.</p></div></div>` : ''}`;
  for (const r of d.ruptures || []) {
    const cot = document.querySelector(`[data-pep-cot="${CSS.escape(r.id)}"]`);
    if (cot && (r.cotees || []).length && !(d.pending && d.insiders_pending)) { cot.className = 'pep-rows'; cot.innerHTML = r.cotees.map(c => pepRow(c)).join(''); }
    const pre = document.querySelector(`[data-pep-pre="${CSS.escape(r.id)}"]`);
    if (pre) pre.innerHTML = (r.pre_ipo || []).map(x => x.filing
      ? `<a class="tag up pep-ipo" href="${L.url(x.filing.link)}" target="_blank" rel="noopener noreferrer" title="Dossier d'introduction en bourse déposé à la SEC">${L.esc(x.name)} · ${L.esc(x.filing.form || 'S-1')} déposé le ${F.date(x.filing.date)}</a>`
      : `<span class="tag">${L.esc(x.name)}</span>`).join('');
    const cd = document.querySelector(`[data-pep-cand="${CSS.escape(r.id)}"]`);
    if (cd) cd.innerHTML = (r.candidates || []).length ? `<div class="k-l" style="margin-bottom:6px">Candidates à la cotation <span class="note" style="font-weight:400">(SEC, 120 jours)</span></div>
      <ul class="pep-cands">${r.candidates.slice(0, 4).map(c => `<li><span class="ell">${L.esc(c.name)}</span><span class="note">${L.esc(c.form || '')} · ${F.dshort(c.date)}</span>${c.link ? `<a class="lnk" href="${L.url(c.link)}" target="_blank" rel="noopener noreferrer" aria-label="Dossier de ${L.esc(c.name)}">${L.icon('ext')}Dossier</a>` : ''}</li>`).join('')}</ul>` : '';
  }
  const foot = document.getElementById('pepFoot');
  if (foot) foot.innerHTML = `Pépites : ${(d.sources || []).map(x => `<a class="lnk" href="${L.url(x.url)}" target="_blank" rel="noopener noreferrer">${L.esc(x.label)}</a>`).join(' ; ')} ; cours Yahoo Finance.
    ${d.updated ? `Lu le ${F.date(d.updated)} à ${F.time(d.updated)}.` : ''} Signaux datés et sourcés, à vérifier : ni un conseil, ni une recommandation.${d.demo ? ' <b>Démo : cours simulés, initiés et candidates fictifs.</b>' : ''}
    ${(d.errors || []).length ? `<br>Non lus cette fois : ${L.esc(d.errors.slice(0, 5).join(' ; '))}.` : ''}`;
  if (wait && PEP.tries++ < 60) PEP.timer = setTimeout(() => { if (document.getElementById('pepTop')) { L.forget('/api/pepites'); pepites(); } }, 10000);
  else if (!wait) PEP.tries = 0;
}

L.views.veille = {
  render(root, r) { const sub = SUBS.some(s => s[0] === r.sub) ? r.sub : 'watchlist'; shell(root, sub); renderSub(sub); },
  sub(r, prev) { const o = SUBS.map(s => s[0]); const sub = o.includes(r.sub) ? r.sub : 'watchlist'; renderSub(sub, o.indexOf(sub) - o.indexOf(prev.sub || 'watchlist')); },
  refresh() { const sub = L.router.last?.sub || 'watchlist'; const el = document.getElementById('vSub'); if (el && sub === 'watchlist' && !document.querySelector('#wlQ:focus')) watchlist(el, true); },
};
})();
