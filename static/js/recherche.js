/* LUMIO — Rechercher (8.1) : une ligne du portefeuille ou un écran, au clavier (Ctrl+K ou ⌘K) ou
   par la loupe de la barre du haut. Flèches pour choisir, Entrée pour ouvrir. Sans accents ni
   majuscules : « lvmh », « bilan », « operations » trouvent ce qu'il faut. */
(function () {
'use strict';
const L = window.L;
const esc = L.esc;
const SCREENS = [
  ['Tableau de bord', '#/accueil', 'accueil'], ['Positions', '#/portefeuille/positions', 'Portefeuille'],
  ['Performance', '#/portefeuille/performance', 'Portefeuille'], ['Revenus et dividendes', '#/portefeuille/revenus', 'Portefeuille'],
  ['Analyse et risques', '#/portefeuille/analyse', 'Portefeuille'], ['Patrimoine', '#/portefeuille/patrimoine', 'Portefeuille'],
  ['Opérations et import', '#/portefeuille/operations', 'Portefeuille'], ['À décider (dossiers)', '#/decisions/dossiers', 'Décisions'],
  ['Synthèse', '#/decisions/synthese', 'Décisions'], ['Marché', '#/decisions/marche', 'Décisions'],
  ['Actualités', '#/decisions/actus', 'Décisions'], ['Journal des décisions', '#/decisions/journal', 'Décisions'],
  ['Bilan des signaux et des seuils', '#/decisions/bilan', 'Décisions'], ['Pistes', '#/inities/pistes', 'Initiés'],
  ['Grands investisseurs (13F)', '#/inities/fonds', 'Initiés'], ['Dirigeants (formulaires 4)', '#/inities/dirigeants', 'Initiés'],
  ['Élus américains', '#/inities/elus', 'Initiés'], ['Watchlist', '#/veille/watchlist', 'Veille'], ['Marchés', '#/veille/marches', 'Veille'],
  ['Ruptures', '#/veille/ruptures', 'Veille'], ['Politique', '#/veille/politique', 'Veille'], ['Offre et demande', '#/veille/offre-demande', 'Veille'],
  ['Rapport imprimable', '#/rapport', 'Rapport'], ['Réglages et qualité des données', '#/reglages', 'Réglages'],
];
const ACTIONS = [['Actualiser : Trade Republic, veille et analyse', () => { const b = document.getElementById('syncBtn'); if (b && !b.hidden) b.click(); else L.toast('Actualiser n\'est pas disponible ici', true); }]];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const R = { items: [], sel: 0 };

function results(q) {
  const n = norm(q).trim();
  const lines = ((L.data.portfolio || {}).positions || []).map(p => ({ kind: 'ligne', label: p.name, hint: [p.ticker, p.isin].filter(Boolean).join(' · '),
    go: () => L.openPosition && L.openPosition(p.uid), keys: norm(`${p.name} ${p.ticker || ''} ${p.isin}`), w: p.weight || 0 }));
  const screens = SCREENS.map(([label, href, sec]) => ({ kind: 'ecran', label, hint: sec === 'accueil' ? '' : sec, go: () => { location.hash = href; }, keys: norm(`${label} ${sec}`) }));
  const acts = ACTIONS.map(([label, go]) => ({ kind: 'action', label, hint: 'action', go, keys: norm(label) }));
  if (!n) return [...lines.sort((a, b) => b.w - a.w).slice(0, 5), ...screens.slice(0, 6), ...acts];
  const score = x => { const i = x.keys.indexOf(n); return i < 0 ? -1 : (i === 0 ? 3 : x.keys.includes(' ' + n) ? 2 : 1); };
  return [...lines, ...screens, ...acts].map(x => ({ x, s: score(x) })).filter(o => o.s >= 0)
    .sort((a, b) => b.s - a.s || (a.x.kind === 'ligne' ? -1 : 1)).slice(0, 12).map(o => o.x);
}
function paint(list) {
  const ul = document.getElementById('fdL'); if (!ul) return;
  R.items = list; R.sel = Math.min(R.sel, Math.max(0, list.length - 1));
  if (!list.length) { ul.innerHTML = '<li class="fd-none">Rien de ce nom. Essayez un ticker, un ISIN ou un écran (bilan, opérations…).</li>'; return; }
  let last = '';
  ul.innerHTML = list.map((x, i) => {
    const h = x.kind !== last ? `<li class="fd-h">${x.kind === 'ligne' ? 'Lignes' : x.kind === 'ecran' ? 'Écrans' : 'Actions'}</li>` : '';
    last = x.kind;
    return `${h}<li><button type="button" role="option" data-fd="${i}" aria-selected="${i === R.sel}">${L.icon(x.kind === 'ligne' ? 'wallet' : x.kind === 'action' ? 'refresh' : 'ext')}<span>${esc(x.label)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ''}</button></li>`;
  }).join('');
}
function choose(i) {
  const x = R.items[i]; if (!x) return;
  L.drawer.close();
  setTimeout(() => x.go(), 30);
}
function open() {
  const d = L.drawer.open('recherche', { title: 'Rechercher', sub: 'Une ligne, un écran ou une action', narrow: true,
    html: `<input class="inp fd-in" id="fdQ" type="search" placeholder="Nom, ticker, ISIN ou écran" autocomplete="off" spellcheck="false" aria-controls="fdL" aria-label="Rechercher">
      <ul class="fd-l" id="fdL" role="listbox" aria-label="Résultats"></ul>` });
  const inp = d.querySelector('#fdQ');
  R.sel = 0; paint(results(''));
  setTimeout(() => inp.focus(), 60);
  inp.oninput = () => { R.sel = 0; paint(results(inp.value)); };
  inp.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      R.sel = (R.sel + (e.key === 'ArrowDown' ? 1 : -1) + R.items.length) % Math.max(1, R.items.length);
      paint(R.items);
    } else if (e.key === 'Enter') { e.preventDefault(); choose(R.sel); }
  };
  L.on(d, 'click', '[data-fd]', (e, b) => choose(+b.dataset.fd));
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open(); }
});
const btn = document.getElementById('findBtn');
if (btn) btn.onclick = open;
L.find = { open, results };
})();
