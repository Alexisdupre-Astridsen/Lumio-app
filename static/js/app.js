/* LUMIO — démarrage : navigation, rafraîchissement 60 s en place, mode discret, qualité,
   notifications du navigateur (optionnelles), écran d'ouverture. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const main = document.getElementById('main');
L.data = { portfolio: null, health: null };

/* Icônes de la coque */
document.querySelectorAll('[data-ico]').forEach(n => { n.outerHTML = L.icon(n.dataset.ico); });
document.getElementById('gearBtn').innerHTML = L.icon('gear');
document.getElementById('iaIco').outerHTML = L.icon('spark');

/* ── Écran d'ouverture : une fois par session ; il s'efface dès que la valeur est prête
   (au moins le temps de l'animation du logo, 0,7 s, au plus 1,25 s) ; un toucher le passe ── */
const splash = document.getElementById('splash');
let seen = false; try { seen = sessionStorage.getItem('lumio.splash') === '1'; sessionStorage.setItem('lumio.splash', '1'); } catch (e) { /* ignore */ }
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const t0 = performance.now();
let splashGone = false;
const hideSplash = () => {
  if (splashGone || !splash) return; splashGone = true;
  splash.classList.add('off'); setTimeout(() => splash.remove(), 450);
};
L.ready = () => { const wait = seen || reduce ? 0 : Math.max(0, 700 - (performance.now() - t0)); setTimeout(hideSplash, wait); };
if (splash) { splash.addEventListener('pointerdown', hideSplash); setTimeout(hideSplash, seen || reduce ? 0 : 1250); }
/* Rafraîchissement silencieux : rien ne se rejoue pendant la mise à jour (seuls les chiffres changés s'illuminent) */
/* Rafraîchissement silencieux : seuls les éléments insérés pendant le rafraîchissement perdent leur
   animation d'entrée, et pour toujours (classe .na posée avant le premier rendu, par un observateur
   de mutations). Rien n'est retiré ensuite : aucune animation ne redémarre, pas de clignotement. */
L.quietly = (fn) => {
  const html = document.documentElement;
  const mark = (n) => { if (n.nodeType !== 1) return; n.classList.add('na'); n.querySelectorAll('*').forEach(x => x.classList.add('na')); };
  const mo = new MutationObserver(recs => recs.forEach(r => r.addedNodes.forEach(mark)));
  mo.observe(document.body, { childList: true, subtree: true });
  html.classList.add('quiet');
  return Promise.resolve().then(fn).catch(() => {}).finally(() => {
    mo.takeRecords().forEach(r => r.addedNodes.forEach(mark)); mo.disconnect();
    requestAnimationFrame(() => html.classList.remove('quiet'));
  });
};

/* ── Mode discret ── */
const privBtn = document.getElementById('privBtn');
const setPriv = (on) => {
  L.state.privacy = on; L.store.set('privacy', on);
  document.body.classList.toggle('priv', on);
  privBtn.innerHTML = L.icon(on ? 'eyeoff' : 'eye'); privBtn.classList.toggle('on', on);
  privBtn.setAttribute('aria-pressed', String(on));
};
L.togglePriv = () => { setPriv(!L.state.privacy); L.toast(L.state.privacy ? 'Montants masqués' : 'Montants affichés'); };
privBtn.onclick = L.togglePriv;
setPriv(L.state.privacy);

/* ── Rendu des vues ── */
const ORDER = ['accueil', 'portefeuille', 'decisions', 'actus', 'inities', 'veille', 'reglages', 'rapport'];
let renderSeq = 0;
L.render = (r, prev) => {
  const v = L.views[r.view] ? r.view : 'accueil';
  const navV = v === 'actus' ? 'decisions' : v;        // les actualités vivent dans le bureau de décision
  document.querySelectorAll('.nav a, .bn a').forEach(a => {
    const on = a.dataset.v === navV; a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (prev && prev.view === v && L.views[v].sub) {
    // Sous-onglet : même glissement que les vues, avec sortie de l'ancien contenu (transition de vue
    // limitée au bloc du sous-onglet ; l'en-tête et la courbe ne bougent pas)
    const html = document.documentElement;
    if (document.startViewTransition && !reduce && document.querySelector('#pfSub,#vSub,#dSub')) {
      const subs = [...document.querySelectorAll('.subnav a[data-sub]')].map(a => a.dataset.sub);
      html.classList.toggle('vt-back', subs.indexOf(r.sub || subs[0]) < subs.indexOf(prev.sub || subs[0]));
      html.classList.add('vt-sub');
      const t = document.startViewTransition(() => L.views[v].sub(r, prev));
      t.finished.finally(() => html.classList.remove('vt-sub'));
    } else L.views[v].sub(r, prev);
    return;
  }
  const back = prev && ORDER.indexOf(v) < ORDER.indexOf(prev.view);
  // Changement de vue : une feuille ouverte (sauf la fiche d'une valeur, portée par l'adresse) se ferme
  if (prev && L.drawer.current && L.drawer.current !== 'pos') L.drawer.close(true);
  const token = ++renderSeq;
  const swap = (vt) => {
    if (token !== renderSeq) return;          // navigation plus récente : ce rendu est périmé
    L.watchHero(null);   // la valeur compacte de la barre ne survit pas à un changement de vue (chaque héros se réinscrit)
    main.innerHTML = `<div class="view${back ? ' back' : ''}${vt ? ' vt' : ''}" id="view-${v}"></div>`;
    window.scrollTo({ top: 0 });
    document.title = ({ accueil: 'Tableau de bord', portefeuille: 'Portefeuille', decisions: 'Décisions', actus: 'Actus', inities: 'Initiés', veille: 'Veille', reglages: 'Réglages', rapport: 'Rapport' }[v] || '') + ' · LUMIO';
    try { L.views[v].render(main.firstChild, r); } catch (e) { console.error(e); main.firstChild.innerHTML = L.errBox(e); }
  };
  // Même transition partout : glissement horizontal dans le sens de la navigation, avec sortie de l'ancienne vue
  if (prev && document.startViewTransition && !reduce) {
    document.documentElement.classList.toggle('vt-back', !!back);
    document.startViewTransition(() => swap(true));
  } else swap(false);
};
window.addEventListener('hashchange', () => L.router.apply(true));
window.addEventListener('popstate', () => L.router.apply(true));

/* ── Données partagées ── */
L.loadPortfolio = async (force = false) => {
  const p = await L.get('/api/portfolio', 50000, force);
  L.data.portfolio = p;
  return p;
};
L.posByUid = (uid) => (L.data.portfolio?.positions || []).find(p => p.uid === uid || p.isin === uid);

/* En-tête compact : quand le héros sort de l'écran, une bande sous la barre (sans toucher aux
   onglets) garde la valeur, sa variation sur la période et le choix de la période */
const sub = document.getElementById('tbsub');
let io = null, heroEl = null, miniFn = null, miniOn = false;
const paintMini = () => {
  if (!miniOn) return;
  const p = L.data.portfolio;
  const txt = miniFn ? miniFn() : (p && !p.empty ? `${L.m(F.eur(p.total_value, 0))} <span class="${L.cls(p.day_change_pct)}">${L.arrow(p.day_change_pct)} ${F.pct(p.day_change_pct)}</span>` : '');
  document.getElementById('tbsv').innerHTML = txt;
  const per = document.getElementById('tbper');
  if (!per.firstChild) per.innerHTML = L.perSeg('xs');
};
const setMini = on => {
  miniOn = on;
  sub.classList.toggle('on', on);
  sub.setAttribute('aria-hidden', on ? 'false' : 'true');
  sub.inert = !on;
  document.getElementById('tb').classList.toggle('mini-on', on);
  paintMini();
};
L.watchHero = (el, fn = null) => {
  miniFn = fn;
  if (el && el === heroEl && io) { paintMini(); return; }      // même héros redessiné : on met à jour le texte
  if (io) io.disconnect();
  heroEl = el;
  if (!el) { setMini(false); return; }
  io = new IntersectionObserver(([e]) => {
    const p = L.data.portfolio; if (!p || p.empty) return;
    setMini(!e.isIntersecting);
  }, { rootMargin: '-56px 0px 0px 0px' });
  io.observe(el);
};
document.addEventListener('lumio:period', () => setTimeout(paintMini, 0));

/* ── Qualité des données (point de la barre supérieure, détail façon RADAR) ── */
const qdot = document.getElementById('qdot');
const loadQuality = async () => {
  try {
    const q = await L.get('/api/quality', 30000, true);
    qdot.classList.toggle('w', q.score < 85 && q.score >= 60); qdot.classList.toggle('a', q.score < 60); qdot.classList.remove('off');
    const p = L.data.portfolio;
    // Âge réel des cours (le plus ancien), pas l'heure du recalcul ; cours TR = différés.
    // Plus vieux que l'avant-dernière clôture (17 h 30, jours ouvrés) : périmés, point orange et date
    const at = p && (p.quotes_ts || p.refreshed_at);
    const when = t => new Date(t * 1000).toDateString() === new Date().toDateString() ? F.time(t) : F.dshort(t) + ' ' + F.time(t);
    const stale = !!at && !L.state.demo && at < L.prevClose();
    const was = L.state.quotesStale || null;
    L.state.quotesStale = stale ? at : null;
    // Une ligne peu cotée (cours rare) suffit à vieillir « le plus ancien » : on la nomme, les autres sont à jour
    const olds = stale ? (p.positions || []).filter(x => x.session_ts > 0 && x.session_ts < L.prevClose()) : [];
    const wOld = olds.reduce((s, x) => s + (x.weight || 0), 0);
    L.state.staleLines = olds.length && wOld < 50 ? olds.sort((a, b) => (b.weight || 0) - (a.weight || 0)).map(x => ({ name: x.name, w: x.weight || 0 })) : null;
    if (was !== L.state.quotesStale) document.dispatchEvent(new CustomEvent('lumio:stale'));
    const part = L.state.staleLines;
    document.getElementById('qtime').textContent = !at ? 'qualité ' + q.score : stale ? (part ? `${part.length} ligne${part.length > 1 ? 's' : ''} au ` : 'cours du ') + F.dshort(at) : (p.quotes_src === 'tr' ? 'TR ' : 'cours ') + when(at);
    if (stale) qdot.classList.add('w');
    qdot.title = !at ? '' : stale ? `Cours du ${when(at)}${p.quotes_src === 'tr' ? ' (dernière mise à jour Trade Republic)' : ''} : mettez à jour pour des cours récents` : `Cours de ${when(at)}`;
    const m = document.getElementById('mode');
    if (m && p && !L.state.demo && p.quotes_src && !L.statique) {
      const delayed = p.quotes_src === 'tr' || p.quotes_src === 'mixte';
      m.textContent = delayed ? 'Différé' : 'Direct'; m.classList.toggle('live', !delayed);
      const sync = p.market_status && p.market_status.quotes_tr_ts;
      m.title = delayed ? `Cours Trade Republic synchronisés${sync ? ' le ' + when(sync) : ''} ; cours le plus ancien : ${when(at)}. Bouton « Mettre à jour » pour les actualiser` : 'Cours en direct (Yahoo Finance)';
    }
    qdot.setAttribute('aria-label', `Qualité des données : ${q.score} sur 100`);
    L.state.quality = q;
  } catch (e) {   // serveur injoignable : le point passe au rouge, les dernières valeurs restent affichées
    qdot.classList.add('a'); qdot.classList.remove('w');
    document.getElementById('qtime').textContent = 'hors ligne';
    qdot.setAttribute('aria-label', 'Données hors ligne : dernières valeurs connues');
    L.state.quality = { score: 0, demo: false, items: [{ ok: false, label: 'Connexion', detail: 'LUMIO ne répond pas : relancez maj.bat (ou python app.py) sur le PC.' }], issues: [] };
  }
};
qdot.onclick = () => {
  const q = L.state.quality; if (!q) return;
  L.pop(qdot, `<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">${L.chart.ring(q.score)}<div><b style="font-size:15px">Qualité des données</b><div class="note">${q.demo ? 'Mode démo : marché simulé' : 'Fiabilité des chiffres affichés'}</div></div></div>
    ${q.items.map(i => `<div class="li"><span class="st ${i.ok ? 'ok' : 'warn'}">${i.ok ? '✓' : '!'}</span><div class="main"><div class="t1">${L.esc(i.label)}</div><div class="t2">${L.esc(i.detail)}</div></div></div>`).join('')}
    ${q.issues && q.issues.length ? `<div class="note" style="margin-top:8px">${q.issues.slice(0, 4).map(i => `• ${L.esc(i.name)} : ${L.esc(i.detail)}${i.fix ? ` <button class="lnk" data-fixline="${L.esc(i.fix)}">Corriger</button>` : ''}`).join('<br>')}</div>` : ''}
    <a class="lnk" href="#/reglages" style="margin-top:10px">Journal d'import et réglages</a>`);
};

/* ── Mode (démo / direct) et clé IA ── */
const loadHealth = async () => {
  try {
    const h = await L.get('/api/health', 600000);
    L.data.health = h; L.state.demo = h.demo;
    const m = document.getElementById('mode');
    if (L.statique) { staticPill(); return; }
    const src = L.data.portfolio && L.data.portfolio.quotes_src;
    if (h.demo || !src) {   // sinon : déjà posé par la qualité (Direct / Différé selon l'âge des cours)
      m.textContent = h.demo ? 'Démo' : 'Direct'; m.classList.toggle('live', !h.demo);
      m.title = h.demo ? 'Données simulées : aucun appel réseau' : 'Cours en direct (Yahoo Finance)';
    }
  } catch (e) {
    const m = document.getElementById('mode');
    if (m && m.textContent === '…') { m.textContent = 'Hors ligne'; m.title = 'LUMIO ne répond pas : vérifiez qu\'il tourne sur le PC'; }
    setTimeout(loadHealth, 15000);
  }
};

/* Version en ligne : « En ligne » et l'heure de la copie publiée par le PC (ambre après 3 heures,
   rouge après une journée) ; le bouton Actualiser, juste à côté, en demande une nouvelle */
const staticPill = () => {
  const m = document.getElementById('mode'); const S = window.LUMIO_STATIC || {};
  if (!m || !S.asof) return;
  const t = S.asof, age = Date.now() / 1000 - t;
  const today = new Date(t * 1000).toDateString() === new Date().toDateString();
  m.innerHTML = `<span class="mp-l">En ligne · </span>${today ? F.time(t) : F.dshort(t)}`;
  m.classList.remove('live'); m.classList.toggle('old', age > 3 * 3600 && age <= 86400); m.classList.toggle('vold', age > 86400);
  m.title = `Copie publiée depuis votre PC le ${F.date(t)} à ${F.time(t)}, en lecture seule : « Actualiser » en demande une nouvelle`;
};
document.addEventListener('lumio:static', staticPill);
if (L.statique) setInterval(staticPill, 60000);

/* ── Badge Actus : alertes d'actualité ≥ 70 non lues ── */
L.setBadge = (n) => {
  document.querySelectorAll('[data-v="decisions"] .badge-dot').forEach(b => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); b.title = `${n} dossier${n > 1 ? 's' : ''} à trancher`; });
};

/* ── Notifications : détectées par le serveur toutes les 5 min (même navigateur fermé), listées sous
   la cloche ; notification du navigateur en plus si l'utilisateur l'a activée. Jamais la synthèse. ── */
L.notify = (items) => {
  if (!L.store.get('notif', false) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const seenN = new Set(L.store.get('notif.seen', []));
  items.forEach(it => {
    if (seenN.has(it.key)) return;
    seenN.add(it.key);
    try { new Notification('LUMIO : ' + (it.label || 'notification').toLowerCase(), { body: it.title + (it.body ? '. ' + it.body : ''), icon: 'static/icon-192.png', tag: it.key }); } catch (e) { /* ignore */ }
  });
  L.store.set('notif.seen', [...seenN].slice(-200));
};
const bell = document.getElementById('bellBtn'), bellN = document.getElementById('bellN');
L.loadNotifs = async () => {
  try {
    const n = await L.get('/api/notifications', 20000, true);
    L.data.notifs = n;
    bellN.hidden = !n.unseen; bellN.textContent = n.unseen > 9 ? '9+' : String(n.unseen);
    bell.setAttribute('aria-label', n.unseen ? `Notifications : ${n.unseen} non lue${n.unseen > 1 ? 's' : ''}` : 'Notifications');
    L.notify((n.items || []).filter(x => !x.seen));
  } catch (e) { /* hors ligne */ }
};
const NICON = { prix: 'bell', actualite: 'news', resultats: 'dash', agenda: 'cal', operation: 'refresh' };
bell.onclick = async () => {
  const n = L.data.notifs || { items: [] };
  const items = (n.items || []).slice(0, 12);
  L.pop(bell, `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:15px">Notifications</b>
    <a class="lnk" href="#/reglages" style="margin-left:auto;font-size:12px">Réglages</a></div>
    ${items.length ? items.map(x => `<div class="nt${x.seen ? '' : ' new'}"><span class="st info">${L.icon(NICON[x.kind] || 'bell')}</span><div class="main">
      <div class="t1" style="font-size:13px;font-weight:600">${x.isin ? `<a href="#" data-pos="${L.esc(x.isin)}">${L.mText(x.title)}</a>` : x.link ? `<a href="${L.url(x.link)}" target="_blank" rel="noopener noreferrer">${L.mText(x.title)}</a>` : L.mText(x.title)}</div>
      <div class="t2" style="font-size:12px;color:var(--ink3)">${L.esc(x.label)}${x.body ? ', ' + L.mText(x.body) : ''} · ${L.esc(F.ago((Date.now() / 1000 - x.t) / 3600))}</div></div></div>`).join('')
      : '<div class="empty" style="padding:8px 0">Rien pour l\'instant. Les alertes de cours, actualités critiques, résultats publiés et événements du lendemain apparaissent ici.</div>'}`);
  if (n.unseen) { try { await L.api('/api/notifications/seen', { method: 'POST' }); } catch (e) { /* ignore */ } bellN.hidden = true; n.unseen = 0; (n.items || []).forEach(x => { x.seen = true; }); }
};

/* ── Rafraîchissement : 60 s, en place, jamais de squelette ── */
let lastRefresh = Date.now();
const tick = async () => {
  if (document.hidden) return;
  lastRefresh = Date.now();
  try {
    await L.loadPortfolio(true);
    L.forget('/api/dashboard'); L.forget('/api/portfolio/history?range=1d'); L.forget('/api/indices'); L.forget('/api/watchlist');
    const v = L.views[L.router.last?.view];
    if (v && v.refresh) L.quietly(() => v.refresh());
    if (L.drawer.current === 'pos' && L.pos && L.pos.refresh) L.quietly(() => L.pos.refresh());
    loadQuality(); L.loadNotifs();
  } catch (e) { /* hors ligne : on garde les dernières valeurs */ }
};
setInterval(() => { staleN = 0; tick(); }, 60000);
/* Réponse servie pendant un recalcul du serveur : relecture en place dans 4 s, puis 10 s et 25 s au plus */
let staleT = 0, staleN = 0;
L.staleSoon = () => {
  if (staleT || staleN >= 3) return;
  staleT = setTimeout(() => { staleT = 0; tick(); }, [4000, 10000, 25000][staleN++]);
};
/* Après une mise à jour Trade Republic (bouton « Mettre à jour ») : tout est relu, la vue se redessine */
L.reloadAll = async () => {
  L.forget();
  try { await L.loadPortfolio(true); } catch (e) { /* hors ligne : la vue affichera l'erreur */ }
  if (L.router.last) L.render(L.router.last);
  loadQuality(); L.loadNotifs();
  try { const d = await L.get('/api/decisions', 45000, true); L.setBadge(d.urgent || 0); } catch (e) { /* badge facultatif */ }
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRefresh > 60000) tick(); });

/* ── Raccourcis clavier ── */
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (e.key === 'Escape') { if (document.getElementById('pop').classList.contains('on')) document.getElementById('pop').classList.remove('on'); else if (L.drawer.current) L.drawer.close(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || !L.store.get('shortcuts', true)) return;
  if (e.key === '/' && !L.statique) { e.preventDefault(); L.router.setParam('ia', '1'); }
  else if (e.key === 'm' || e.key === 'M') L.togglePriv();
  else if (e.key === '1') L.router.go('accueil'); else if (e.key === '2') L.router.go('portefeuille');
  else if (e.key === '3') L.router.go('decisions'); else if (e.key === '4') L.router.go('veille');
});
document.getElementById('scrim').onclick = () => L.drawer.close();
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]'); if (c) { L.drawer.close(); return; }
  const pos = e.target.closest('[data-pos]'); if (pos && !e.target.closest('a[href^="http"]')) { e.preventDefault(); L.router.setParam('p', pos.dataset.pos); return; }
  const ia = e.target.closest('[data-ask]'); if (ia) { e.preventDefault(); L.askIA(ia.dataset.ask); }
});
/* Éléments non-bouton jouant un rôle de bouton ou de lien : Entrée et Espace les activent */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (t.matches('[data-pos][tabindex]')) { e.preventDefault(); L.router.setParam('p', t.dataset.pos); return; }
  if (t.matches('[role=button][tabindex]:not(button),[role=link][tabindex]:not(a)')) { e.preventDefault(); t.click(); }
});
document.getElementById('iaBtn').onclick = () => L.router.setParam('ia', '1');
/* Téléphone : l'IA est un onglet de la barre du bas (plus de bouton flottant qui masque la courbe ou des montants) */
document.querySelectorAll('[data-iaopen]').forEach(b => { b.onclick = () => L.router.setParam('ia', '1'); });
/* Sous-navigation qui défile (téléphone) : le fondu de droite disparaît en fin de course */
document.addEventListener('scroll', (e) => {
  const n = e.target; if (!(n instanceof Element) || !n.classList.contains('subnav')) return;
  n.classList.toggle('end', n.scrollLeft + n.clientWidth >= n.scrollWidth - 4);
}, { capture: true, passive: true });

/* ── Nouvelle version installée sur le PC (mise à jour automatique) : la page se recharge d'elle-même,
   jamais pendant une saisie (nouvel essai à la minute suivante) ── */
const PAGE_BUILD = (() => {
  const s = document.querySelector('script[src*="js/app.js"]');
  const m = s && /[?&]v=([^&#]+)/.exec(s.getAttribute('src') || '');
  return m ? decodeURIComponent(m[1]) : null;
})();
const watchBuild = async () => {
  if (L.statique || !PAGE_BUILD) return;
  let h;
  try { h = await L.api('/api/health'); } catch (e) { return; }          // LUMIO redémarre : essai suivant
  if (!h || !h.build || h.build === PAGE_BUILD) return;
  const a = document.activeElement;
  if (!document.hidden && a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  if (!document.hidden) L.toast('LUMIO a été mis à jour : rechargement de la page');
  setTimeout(() => location.reload(), document.hidden ? 0 : 1500);
};
if (!L.statique && PAGE_BUILD) {
  setInterval(watchBuild, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watchBuild(); });
}

/* ── Application installable : interface disponible hors ligne (contexte sécurisé uniquement) ── */
if (!L.statique && 'serviceWorker' in navigator && window.isSecureContext && location.protocol.startsWith('http')) {
  try {          // un cadre isolé (sandbox) interdit l'accès même à navigator.serviceWorker
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js').then(r => r.update()).catch(() => { /* facultatif */ });
    // Nouvelle version installée : un seul rechargement pour quitter l'ancienne interface en cache
    let swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadSW || swReloaded) return; swReloaded = true; location.reload();
    });
    // Toucher une notification push : ouvre la fiche ou l'onglet visé dans la fenêtre déjà ouverte
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'lumio-open' || typeof d.url !== 'string') return;
      try { const u = new URL(d.url, location.origin); if (u.origin === location.origin && u.hash) location.hash = u.hash; } catch (err) { /* ignore */ }
      L.loadNotifs();
    });
  } catch (e) { /* pas de service worker ici : l'appli fonctionne sans */ }
}

/* ── Démarrage ── */
(async () => {
  loadHealth();
  // Dernière valeur connue sur cet appareil : la vue s'affiche sans attendre le réseau, puis se met à jour
  const snap = L.snap.get('/api/portfolio');
  if (snap && !snap.empty) L.data.portfolio = snap;
  const fresh = L.loadPortfolio().catch(() => { /* la vue affichera l'erreur */ });
  if (!L.data.portfolio) await fresh;
  if (!location.hash) history.replaceState(null, '', '#/accueil');
  L.router.apply(true);
  L.ready();
  loadQuality(); L.loadNotifs();
  if (L.sync && !L.statique) L.sync.init();
  try { const d = await L.get('/api/decisions', 45000); L.setBadge(d.urgent || 0); } catch (e) { /* badge facultatif */ }   // même chiffre partout : dossiers urgents ouverts
})();
})();
