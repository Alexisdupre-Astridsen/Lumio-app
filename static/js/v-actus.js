/* LUMIO — Actus : ce qui touche vos lignes, trié par importance (score expliqué),
   résultats publiés, actualités par valeur, marchés et thèmes. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const S = { open: new Set() };
const scoreCls = s => s >= 70 ? 'hi' : s >= 50 ? 'mid' : '';
const BK = { exposition: 'exposition', evenement: 'événement', fraicheur: 'fraîcheur', source: 'source' };
const art = (a, extra = '') => `<div class="art"><a class="t1" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer">${L.esc(a.title)}</a>
  <div class="t2">${a.score != null ? `<span class="score ${scoreCls(a.score)}">${a.score}</span>` : ''}${L.esc([a.why, a.source, F.ago(a.age_h), a.lang === 'en' ? 'en anglais' : ''].filter(Boolean).join(' · '))}${(a.also || []).length ? ` · <span title="${L.esc(a.also.map(x => `${x.source || ''} : ${x.title}`).join('\n'))}">même événement : ${a.also.map(x => `<a class="lnk" style="font-size:12px" href="${L.url(x.link)}" target="_blank" rel="noopener noreferrer">${L.esc(x.source || 'autre source')}${x.lang === 'en' ? ' (EN)' : ''}</a>`).join(', ')}</span>` : ''}</div>${extra}</div>`;

async function render(root, r = {}) {
  root.innerHTML = `${r.embedded ? '<p class="note" id="acMeta" style="margin:0 0 10px"></p>' : '<div class="ph"><h1 class="title">Actus</h1><span class="note" id="acMeta"></span></div>'}
    <div class="cards">
      <section class="w c7" id="acTodo">${L.skel(220)}</section>
      <section class="w c5" id="acRes">${L.skel(220)}</section>
      <section class="w c7" id="acRead">${L.skel(200)}</section>
      <section class="w c5" id="acThemes">${L.skel(200)}</section>
      <section class="w c12" id="acPos">${L.skel(160)}</section>
    </div>`;
  const [al, dash, th] = await Promise.allSettled([L.get('/api/alerts', 60000), L.get('/api/dashboard', 50000), L.get('/api/news/market', 600000)]);
  if (!document.getElementById('acTodo')) return;          // vue quittée pendant le chargement
  const a = al.value || { alerts: [], digest: [] };
  document.getElementById('acMeta').textContent = al.value ? `${a.scanned || 0} articles analysés · alerte = score ≥ 70` : '';
  document.getElementById('acTodo').innerHTML = `<div class="w-h"><h2>À traiter · score ≥ 70</h2></div>${(a.alerts || []).length ? a.alerts.map(x => art(x, `<div class="bk">${Object.entries(x.breakdown || {}).map(([k, v]) => `<span>${BK[k] || k} ${F.n(v, 0)}</span>`).join('')}<span style="background:none;padding:0"><button class="lnk ia" data-ask="${L.esc(`Quel impact pour mon portefeuille : « ${x.title} » ?`)}">Analyser l'impact</button></span></div>`)).join('')
    : '<div class="empty">Aucune actualité critique sur vos lignes ni sur leurs secteurs.</div>'}`;
  const rc = dash.value?.recaps || [];
  document.getElementById('acRes').innerHTML = `<div class="w-h"><h2>Résultats publiés · 36 h</h2></div>${rc.length ? rc.map(r => `<div class="li click" data-pos="${L.esc(r.isin)}" role="button" tabindex="0" style="align-items:flex-start"><span class="st info">R</span><div class="main"><div class="t1">${L.esc(r.name)}${r.quarter ? ' · ' + L.esc(r.quarter) : ''} ${r.surprise_pct != null ? `<span class="tag ${r.surprise_pct >= 0 ? 'up' : 'dn'}">BPA ${F.pct(r.surprise_pct, 1)}</span>` : ''}</div><div class="t2" style="white-space:normal">${L.esc(r.text)}</div></div></div>`).join('')
    : '<div class="empty">Aucune société détenue n\'a publié de résultats dans les 36 dernières heures. Les prochaines dates sont dans l\'agenda du tableau de bord.</div>'}`;
  document.getElementById('acRead').innerHTML = `<div class="w-h"><h2>À lire</h2></div>${(a.digest || []).length ? a.digest.map(x => art(x)).join('') : '<div class="empty">Rien de notable.</div>'}`;
  const themes = th.value?.themes || [];
  const cur = S.theme && themes.find(t => t.id === S.theme) ? S.theme : themes[0]?.id;
  const thBox = document.getElementById('acThemes');
  const drawTh = (id) => {
    const t = themes.find(x => x.id === id);
    thBox.innerHTML = `<div class="w-h"><h2>Marchés et thèmes</h2></div><div class="chips" style="margin-bottom:8px">${themes.map(x => `<button class="chip ${x.id === id ? 'on' : ''}" data-th="${L.esc(x.id)}">${L.esc(x.label)}</button>`).join('')}</div>
      ${t ? (t.articles || []).slice(0, 6).map(x => art(x)).join('') || '<div class="empty">Aucun article récent.</div>' : '<div class="empty">Flux indisponible.</div>'}`;
  };
  drawTh(cur);
  L.on(thBox, 'click', '[data-th]', (e, b) => { S.theme = b.dataset.th; drawTh(S.theme); });
  await L.loadPortfolio();
  const ps = (L.data.portfolio?.positions || []).slice().sort((x, y) => y.weight - x.weight);
  const box = document.getElementById('acPos');
  box.innerHTML = `<div class="w-h"><h2>Par valeur</h2><div class="r note">par poids décroissant</div></div>${ps.map(p => `<details class="li" style="display:block" data-isin="${L.esc(p.isin)}" ${S.open.has(p.isin) ? 'open' : ''}>
    <summary style="display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none">${L.avatar(p.name, p.isin)}<div class="main"><div class="t1">${L.esc(p.name)}</div><div class="t2">${F.pctU(p.weight, 1)} du portefeuille · <span class="${L.cls(p.change_pct_day)}">${F.pct(p.change_pct_day)}</span></div></div>${L.icon('chev')}</summary>
    <div class="nbox" style="padding:6px 0 4px 44px">${L.skel(60)}</div></details>`).join('')}`;
  box.querySelectorAll('details').forEach(d => {
    const loadN = async () => {
      const nb = d.querySelector('.nbox');
      try { const r = await L.get('/api/news/position/' + encodeURIComponent(d.dataset.isin), 600000); nb.innerHTML = (r.articles || []).length ? r.articles.map(x => art(x)).join('') : '<div class="note">Aucune actualité récente.</div>'; }
      catch (e) { nb.innerHTML = L.errBox(e); }
    };
    d.addEventListener('toggle', () => { if (d.open) { S.open.add(d.dataset.isin); loadN(); } else S.open.delete(d.dataset.isin); });
    if (d.open) loadN();
  });
}
L.views.actus = { render, refresh() { /* les actualités se rafraîchissent à l'ouverture */ } };
})();
