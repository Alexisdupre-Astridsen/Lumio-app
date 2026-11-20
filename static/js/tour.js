/* LUMIO — visite guidée : seize étapes, d'onglet en onglet, chacune éclaire un élément de l'écran
   et dit à quoi il sert. Bouton « ? » de la barre (Réglages sur téléphone) ; Échap la quitte,
   flèches gauche et droite pour avancer ou revenir. */
(function () {
'use strict';
const L = window.L;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.matchMedia('(max-width: 719px)').matches;

const STEPS = [
  { v: 'accueil', g: true, t: ['.brand'], h: 'Bienvenue dans LUMIO',
    p: "Votre portefeuille, l'actualité qui le concerne et les décisions à prendre, au même endroit. Deux minutes pour faire le tour ; Échap pour quitter à tout moment." },
  { v: 'accueil', t: ['#a1'], h: 'La valeur du portefeuille',
    p: "Toujours la valeur actuelle. Dessous, le gain de la période choisie (versements exclus) et la valeur au début de cette période." },
  { v: 'accueil', t: ['#period .seg', '#period'], h: "Une période pour toute l'application",
    p: "1J, 1S, 1M, YTD, 1A ou Max : l'évolution et la comparaison à l'indice suivent ce choix sur tous les onglets. En faisant défiler, il reste dans la barre du haut." },
  { v: 'accueil', t: ['.dsec[data-sec="news"]'], h: 'Actualité et décisions',
    p: "« Sortir ou entrer ? » : vos lignes à réexaminer et les entrées possibles à étudier, signaux datés et sourcés. Puis bureau de décision, agenda, initiés, veille. Un clic sur le titre d'une section la replie et n'en garde que l'essentiel." },
  { v: 'accueil', t: ['.dsec[data-sec="state"]'], h: 'État du portefeuille',
    p: 'Bilan de santé (concentration, devises, frais, volatilité), répartition et alertes de cours.' },
  { v: 'accueil', t: ['#dashCfg'], h: 'Un tableau de bord à votre main',
    p: "Maintenez un module (ou touchez ce bouton) : glissez-le où vous voulez, changez sa largeur par le coin, masquez-le ou déposez-le dans la corbeille ; « Rétablir » revient à la disposition d'origine." },
  { v: 'accueil', t: ['#dashRep'], h: 'Rapport à imprimer',
    p: 'Valeur, performance comparée à l’indice, risque, répartition, lignes, bilan de santé et agenda sur deux pages, à imprimer ou enregistrer en PDF pour un rendez-vous.' },
  { v: 'portefeuille', t: ['#pfHead', '#pfChart'], h: 'Portefeuille',
    p: "Courbe, performance (TWR, XIRR) et comparaison à l'indice ou à l'ETF de votre choix ; plus bas, chaque ligne : touchez-en une pour sa fiche complète." },
  { v: 'portefeuille', t: ['#pfSub', '.subnav'], h: 'Analyses et opérations',
    p: 'Répartition, carte des mouvements, constellation, fiscalité, opérations et import : un sous-onglet par usage.' },
  { v: 'decisions', t: ['#dSub', '.subnav', '.ph'], h: 'Bureau de décision',
    p: 'Chaque signal (actualité, seuil franchi, résultat publié) avec son impact estimé sur vos lignes, et le journal de vos décisions. L’onglet Synthèse donne l’analyse complète : d’où vient la performance, les faits publiés sur chaque ligne, les décisions à étudier par priorité. Des pistes, jamais des ordres.' },
  { v: 'inities', t: ['.ini-ph', '.ph'], h: 'Initiés',
    p: 'Achats et ventes des grands investisseurs, des dirigeants et des élus américains, croisés avec vos lignes, avec leur délai de publication.' },
  { v: 'veille', t: ['#vSub', '.subnav', '.ph'], h: 'Veille',
    p: 'Watchlist, alertes de cours, secteurs et innovations de rupture à suivre avant d’investir.' },
  { v: null, t: ['#iaBtn', '.bn-ia'], h: "Demander à l'IA",
    p: 'Une question sur vos chiffres ? Touche / ou ce bouton : la réponse part de votre portefeuille réel, sans conseil d’achat ou de vente.' },
  { v: null, t: ['#qdot'], h: 'Qualité des données',
    p: 'Fraîcheur des cours et fiabilité des calculs ; un point orange signale ce qu’il faut corriger (opération manquante, ligne mal identifiée).' },
  { v: null, t: ['#privBtn'], h: 'Mode discret',
    p: 'Masque les montants (touche M) pour montrer l’écran sans dévoiler vos chiffres.' },
  { v: null, t: ['#gearBtn'], h: 'Réglages',
    p: 'Comptes connectés (Trade Republic, eToro), notifications, accès depuis le téléphone, sauvegarde. La visite se relance avec le bouton « ? » (sur téléphone : Réglages).' },
];

const S = { i: -1, el: null, hole: null, pop: null, raf: 0, token: 0, prevFocus: null };

const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
/* Cible cherchée dans la vue de l'étape (jamais dans la vue qu'on quitte), ou dans la barre */
const scope = st => st.v && !st.g ? document.getElementById('view-' + st.v) : document;
const pick = st => { const root = scope(st); if (!root) return null;
  for (const s of st.t) { const el = [...root.querySelectorAll(s)].find(visible); if (el) return el; } return null; };
const waitFor = (st, ms = 6000) => new Promise(res => {
  const t0 = performance.now();
  const tick = () => { const el = pick(st); if (el || performance.now() - t0 > ms) res(el); else setTimeout(tick, 120); };
  tick();
});

function build() {
  S.hole = document.createElement('div');
  S.hole.className = 'tour-hole';
  S.hole.setAttribute('aria-hidden', 'true');
  S.pop = document.createElement('div');
  S.pop.className = 'tour-pop';
  S.pop.setAttribute('role', 'dialog');
  S.pop.setAttribute('aria-modal', 'true');
  S.pop.setAttribute('aria-labelledby', 'tourH');
  S.pop.innerHTML = `<div class="tour-n" id="tourN"></div><h3 id="tourH"></h3><p id="tourP"></p>
    <div class="tour-act"><button class="lnk" data-tour="end">Quitter la visite</button><span class="tour-sp"></span>
      <button class="btn sm" data-tour="prev">Précédent</button><button class="btn sm p" data-tour="next">Suivant</button></div>`;
  const shield = document.createElement('div');
  shield.className = 'tour-shield';
  shield.addEventListener('click', e => e.stopPropagation());
  document.body.append(shield, S.hole, S.pop);
  S.shield = shield;
  S.pop.addEventListener('click', e => {
    const b = e.target.closest('[data-tour]'); if (!b) return;
    if (b.dataset.tour === 'next') go(S.i + 1); else if (b.dataset.tour === 'prev') go(S.i - 1); else end();
  });
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', track);
  window.addEventListener('scroll', track, true);
  document.documentElement.classList.add('touring');
}

function onKey(e) {
  if (!S.pop) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(S.i + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(S.i - 1); }
  else if (e.key === 'Tab') {                  // le focus reste dans la bulle
    const f = [...S.pop.querySelectorAll('button:not([disabled])')];
    const at = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  } else if (!e.metaKey && !e.ctrlKey && e.key.length === 1) e.stopPropagation();   // pas de raccourci à une touche pendant la visite
}

function track() { if (!S.raf) S.raf = requestAnimationFrame(layout); }

function layout() {
  S.raf = 0;
  if (!S.pop) return;
  if (S.el && !S.el.isConnected && S.i >= 0) S.el = pick(STEPS[S.i]);       // vue redessinée entre-temps
  if (!S.el) return;
  const vw = innerWidth, vh = innerHeight, pad = 6;
  const r = S.el.getBoundingClientRect();
  const top = Math.max(r.top - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4);
  const left = Math.max(r.left - pad, 4), right = Math.min(r.right + pad, vw - 4);
  Object.assign(S.hole.style, { transform: `translate(${left}px,${top}px)`, width: Math.max(right - left, 0) + 'px', height: Math.max(bottom - top, 0) + 'px' });
  const pw = S.pop.offsetWidth, ph = S.pop.offsetHeight;
  if (mobile()) {
    const lowHalf = (top + bottom) / 2 > vh * .5;
    S.pop.style.transform = `translate(12px,${lowHalf ? 68 : vh - ph - 84}px)`;
    return;
  }
  let y = bottom + 12;
  if (y + ph > vh - 12) y = top - ph - 12 >= 12 ? top - ph - 12 : Math.max(12, vh - ph - 12);
  y = Math.min(Math.max(y, 12), Math.max(12, vh - ph - 12));        // cible hors écran (défilement en cours) : bulle visible
  const x = Math.min(Math.max(left, 12), vw - pw - 12);
  S.pop.style.transform = `translate(${x}px,${y}px)`;
}

async function go(i) {
  if (i < 0) return;
  if (i >= STEPS.length) { end(true); return; }
  const token = ++S.token;
  const st = STEPS[i];
  S.i = i;
  if (L.drawer?.current) L.drawer.close(true);
  if (st.v && (L.router.last?.view || 'accueil') !== st.v && !(st.v === 'accueil' && !L.router.last?.view)) location.hash = '#/' + st.v;
  S.pop.classList.add('wait');
  const el = await waitFor(st);
  if (token !== S.token || !S.pop) return;
  S.el = el;
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - (mobile() ? 90 : 20)) {
      el.scrollIntoView({ block: r.height > innerHeight * .6 ? 'start' : 'center', behavior: reduce() ? 'auto' : 'smooth' });
      await new Promise(res => setTimeout(res, reduce() ? 30 : 380));
      if (token !== S.token || !S.pop) return;
    }
  }
  document.getElementById('tourN').textContent = `${i + 1} sur ${STEPS.length}`;
  document.getElementById('tourH').textContent = st.h;
  document.getElementById('tourP').textContent = st.p;
  S.pop.querySelector('[data-tour="prev"]').disabled = i === 0;
  S.pop.querySelector('[data-tour="next"]').textContent = i === STEPS.length - 1 ? 'Terminer' : 'Suivant';
  S.hole.classList.toggle('none', !el);
  S.pop.classList.remove('wait');
  layout();
  S.pop.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  L.live?.(`${st.h}. ${st.p}`);
}

function end(done) {
  S.token++;
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', track);
  window.removeEventListener('scroll', track, true);
  [S.hole, S.pop, S.shield].forEach(n => n && n.remove());
  S.hole = S.pop = S.shield = S.el = null;
  S.i = -1;
  document.documentElement.classList.remove('touring');
  L.store.set('tour.seen', true);
  if (done) L.toast('Visite terminée : relancez-la avec le bouton « ? »');
  S.prevFocus?.focus?.({ preventScroll: true });
}

L.tour = () => {
  if (S.pop) return;
  document.getElementById('tourInvite')?.remove();
  S.prevFocus = document.activeElement;
  build();
  go(0);
};

/* Bouton de la barre et liens « Visite guidée » (Réglages, personnalisation) */
const btn = document.getElementById('tourBtn');
if (btn) { btn.innerHTML = L.icon('help'); btn.onclick = () => L.tour(); }
document.addEventListener('click', e => { if (e.target.closest('[data-tour-start]')) { e.preventDefault(); L.tour(); } });

/* Première visite : une invitation discrète, une seule fois */
setTimeout(() => {
  if (L.store.get('tour.seen', false) || S.pop || document.getElementById('tourInvite')) return;
  if ((L.router.last?.view || 'accueil') !== 'accueil' || L.drawer?.current) return;
  const d = document.createElement('div');
  d.id = 'tourInvite'; d.className = 'tour-inv'; d.setAttribute('role', 'status');
  d.innerHTML = `<b>Première visite ?</b><span>Faites le tour de LUMIO en deux minutes.</span>
    <div class="tour-act"><button class="lnk" data-inv="later">Plus tard</button><button class="btn sm p" data-inv="go">Commencer la visite</button></div>`;
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-inv]'); if (!b) return;
    L.store.set('tour.seen', true); d.remove();
    if (b.dataset.inv === 'go') L.tour();
  });
  document.body.append(d);
}, 4000);
})();
