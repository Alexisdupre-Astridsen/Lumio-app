/* LUMIO — Réglages : qualité et sources des données, notifications, accès téléphone (2FA),
   IA, export, effacement, méthodes de calcul. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const sec = (title, body, cls = 'c6') => `<section class="w ${cls}"><div class="w-h"><h2>${title}</h2></div>${body}</section>`;

const displaySec = () => sec('Affichage', `<div class="seg" role="group" aria-label="Couleurs des hausses et des baisses"><button data-pal="obs" class="${L.store.get('palette', 'obs') !== 'classic' ? 'on' : ''}" aria-pressed="${L.store.get('palette', 'obs') !== 'classic'}"><span class="pal-sw" aria-hidden="true"><i style="background:#8FCBFF"></i><i style="background:#FF8F4A"></i></span>Observatoire · bleu / orange</button><button data-pal="classic" class="${L.store.get('palette', 'obs') === 'classic' ? 'on' : ''}" aria-pressed="${L.store.get('palette', 'obs') === 'classic'}"><span class="pal-sw" aria-hidden="true"><i style="background:#3BE8A0"></i><i style="background:#FF5E7A"></i></span>Classique · vert / rouge</button></div>
    <p class="note" style="margin-top:8px">Observatoire : hausse en bleu, baisse en orange, lisibles quelle que soit la perception des couleurs. Classique : les codes vert et rouge des courtiers. Les points d'actualité de la carte suivent la palette.</p>
    <div class="k-l" style="margin:16px 0 6px">Fond animé</div>
    <div class="seg" role="group" aria-label="Fond animé">${[['auto', 'Automatique'], ['on', 'Toujours animé'], ['off', 'Fixe']].map(([k, l]) => `<button data-bgm="${k}" class="${L.store.get('bg.mode', 'auto') === k ? 'on' : ''}" aria-pressed="${L.store.get('bg.mode', 'auto') === k}">${l}</button>`).join('')}</div>
    <p class="note" style="margin-top:8px">Ciel étoilé derrière les cartes : nébuleuses qui dérivent, étoiles qui scintillent, étoile filante de temps en temps. Automatique : immobile si Windows ou le téléphone demande de réduire les animations ; « Toujours animé » passe outre, pour le fond seulement.</p>`);
const bindDisplay = (root) => {
  L.on(root, 'click', '[data-bgm]', (e, b) => { L.store.set('bg.mode', b.dataset.bgm); L.applyBg && L.applyBg(); L.qsa('[data-bgm]', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); L.toast(b.dataset.bgm === 'off' ? 'Fond fixe' : b.dataset.bgm === 'on' ? 'Fond toujours animé' : 'Fond automatique'); });
  L.on(root, 'click', '[data-pal]', (e, b) => { L.setPalette(b.dataset.pal); L.qsa('[data-pal]', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); L.toast('Palette appliquée'); });
};

/* Version en ligne (copie publiée par le PC) : rien à régler ici, sauf l'affichage et le verrou */
function renderStatic(root) {
  const S = window.LUMIO_STATIC || {};
  const when = S.asof ? `${F.date(S.asof)} à ${F.time(S.asof)}` : '—';
  root.innerHTML = `<div class="ph"><h1 class="title">Réglages</h1></div><div class="cards" id="rg">
  ${sec('Version en ligne', `<dl class="kv" style="grid-template-columns:1fr"><div><dt>Données publiées</dt><dd>le ${when}, depuis votre PC</dd></div>
      <div><dt>Lignes</dt><dd>${S.lines != null ? S.lines : '—'}</dd></div></dl>
    <p class="ink2" style="font-size:13.5px;margin-top:10px">Copie en lecture seule : la mise à jour Trade Republic, vos décisions, vos notes et vos réglages se font sur le PC. Chaque publication du PC arrive ici toute seule.</p>
    <button class="btn sm" id="stLock" style="margin-top:12px">${L.icon('lock')}Verrouiller cet appareil</button>
    <p class="note" style="margin-top:8px">Verrouiller efface la clé gardée sur cet appareil : le mot de passe sera redemandé.</p>`)}
  ${displaySec()}</div>`;
  bindDisplay(root);
  const b = document.getElementById('stLock'); if (b) b.onclick = () => S.lock && S.lock();
}

async function render(root) {
  if (L.statique) { renderStatic(root); return; }
  root.innerHTML = `<div class="ph"><h1 class="title">Réglages et données</h1></div><div class="cards" id="rg">${L.skel(300)}</div>`;
  const [h, q, pr] = await Promise.all([L.get('/api/health', 60000, true).catch(() => ({})), L.get('/api/quality', 30000, true).catch(() => null),
    L.get('/api/settings', 0, true).catch(() => ({}))]);
  // Préférence du PC (vaut pour la synthèse) ; un mode discret choisi dans ce navigateur avant la 6.2 y est reporté
  if (pr.ai_private === false && L.store.get('ia.private', false)) { try { await L.api('/api/settings', { method: 'PUT', body: { ai_private: true } }); pr.ai_private = true; } catch (e) { /* hors ligne */ } }
  if (typeof pr.ai_private === 'boolean') L.store.set('ia.private', pr.ai_private);
  if (!root.isConnected || !document.getElementById('rg')) return;      // vue quittée pendant le chargement
  bindDisplay(root);
  const notifOn = L.store.get('notif', false);
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  document.getElementById('rg').innerHTML = `
  ${sec('Qualité des données', q ? `<div style="display:flex;gap:16px;align-items:center;margin-bottom:6px">${L.chart.ring(q.score, 76)}<div class="ink2" style="font-size:13.5px">${q.demo ? 'Mode démo : marché simulé et opérations fictives, tous les calculs sont réels.' : 'Score calculé sur la couverture des cours, l\'historique, le rapprochement, les actualités, la fraîcheur et le classement.'}</div></div>
    ${q.items.map(i => `<div class="li"><span class="st ${i.ok ? 'ok' : 'warn'}">${i.ok ? '✓' : '!'}</span><div class="main"><div class="t1">${L.esc(i.label)}</div><div class="t2">${L.esc(i.detail)}</div></div></div>`).join('')}
    ${linesTable(q.lines)}
    ${(q.issues || []).length ? `<div class="callout" style="margin-top:10px"><b>Écarts à corriger</b>${q.issues.map(i => `<div class="note q-iss">• ${L.esc(i.name)} : ${L.mText(i.detail)}${i.fix ? ` <button class="lnk" data-fixline="${L.esc(i.fix)}">Corriger la ligne</button>` : ''}</div>`).join('')}<a class="lnk" href="#/portefeuille/operations" style="margin-top:6px">Saisir l'opération manquante</a></div>` : ''}
    ${(q.unclassified || []).length ? `<div class="note" style="margin-top:8px">Secteur à préciser : ${q.unclassified.map(u => `<button class="lnk" data-fixline="${L.esc(u.key)}">${L.esc(u.name)}</button>`).join(', ')}</div>` : ''}
    ${(q.notes || []).length ? `<div style="margin-top:10px">${q.notes.map(i => `<div class="note">• ${L.esc(i.name)} : ${L.mText(i.detail)}</div>`).join('')}</div>` : ''}` : L.errBox({ message: 'Qualité indisponible' }))}
  ${sec('Comptes connectés', `<div id="cnBox">${L.skel(150)}</div>`)}
  ${h.online ? '' : sec('Version en ligne', `<div id="pubBox">${L.skel(150)}</div>`)}
  ${h.online ? '' : sec('Mises à jour', `<div id="majBox">${L.skel(120)}</div>`)}
  ${displaySec()}
  ${sec('Sources', `<div id="srcBox" class="src-box">${L.skel(120)}</div><dl class="kv" style="grid-template-columns:1fr;margin-top:12px"><div><dt>Mode</dt><dd>${h.demo ? 'Démo (aucun appel réseau)' : 'Direct'}</dd></div>
      <div><dt>Positions Trade Republic</dt><dd>${h.csv_found ? '✓ ' : '✕ '}${L.esc(h.portfolio_csv || 'data/portfolio.csv')}</dd></div>
      <div><dt>Opérations</dt><dd>${h.transactions_found ? '✓ transactions.csv importé' : '✕ bouton « Actualiser » (ou maj.bat)'}</dd></div>
      <div><dt>Cours et historiques</dt><dd>Trade Republic (bouton « Actualiser » ou maj.bat, mêmes prix que l'app) ; en direct : Yahoo Finance quand il répond</dd></div><div><dt>Fondamentaux</dt><dd>Yahoo Finance ; sans Yahoo : fiche Trade Republic (secteur, avis d'analystes, rendez-vous) ; exercices antérieurs des sociétés américaines : SEC EDGAR</dd></div><div><dt>Actualités</dt><dd>Google Actualités et actualités Trade Republic de chaque valeur (synchronisation)</dd></div><div><dt>Composition des ETF</dt><dd>Fichier de l'émetteur déposé dans data/etf/&lt;ISIN&gt;.csv (à remplacer chaque mois), sinon principales lignes de l'indice</dd></div><div><dt>Actualités</dt><dd>Google News, requêtes par valeur et par secteur</dd></div>
      <div><dt>Taux sans risque</dt><dd>€STR, Banque centrale européenne</dd></div></dl>
    <p class="note" style="margin-top:10px">Vos positions et opérations restent sur ce PC. Partent sur le réseau : les tickers (cours), les noms des sociétés (actualités) et, si une clé Anthropic est configurée, le contexte chiffré envoyé à Claude (sans montants en mode discret).</p>
    <div style="display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;margin-top:10px">${h.demo ? '' : `<button class="btn sm" data-syncopen>${L.icon('refresh')}Actualiser</button>`}<a class="lnk" href="#/portefeuille/operations">Journal d'import, saisie d'opérations, export</a></div>`)}
  ${sec('Notifications', `<p class="ink2" style="font-size:13.5px">Toutes les 5 minutes, LUMIO vérifie vos alertes de cours, les actualités critiques (note ≥ 80), les résultats publiés, les opérations sur titres et les événements du lendemain, <b>même navigateur fermé</b>, tant qu'il tourne sur le PC. Tout arrive sous la cloche, en haut à droite, et, si vous l'activez, sur le téléphone et sur le PC. La synthèse du jour, elle, reste consultable uniquement dans LUMIO.</p>
    <div id="nfSrv" style="margin-top:10px">${L.skel(60)}</div>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="nfOn" ${notifOn ? 'checked' : ''} ${perm === 'unsupported' ? 'disabled' : ''}> Notification du navigateur en plus (quand LUMIO est ouvert)</label>
    ${perm === 'denied' ? '<p class="note" style="margin-top:6px"><b>Le navigateur bloque les notifications pour ce site.</b></p>' : ''}
    <button class="btn sm" id="nfTest" style="margin-top:10px" ${notifOn && perm === 'granted' ? '' : 'disabled'}>Tester la notification du navigateur</button>`)}
  ${h.online ? sec('Connexion et appareils', `<div id="devBox">${L.skel(140)}</div>`) : ''}
  ${sec('Sur le téléphone', `<div id="phBox">${L.skel(150)}</div>
    ${h.online ? '' : `<details style="margin-top:14px"${h.remote ? ' open' : ''}><summary class="lnk" style="cursor:pointer">Hors de chez vous, et notifications appli fermée</summary><div class="note" style="margin:6px 0 0;color:var(--ink2);line-height:1.6">Installez <b>Tailscale</b> (gratuit) sur le PC et le téléphone : ils se voient comme sur le même Wi-Fi, chiffré de bout en bout, sans héberger LUMIO nulle part.
      <ol style="margin:6px 0 0 18px"><li>Sur le PC : <b>tailscale serve --bg 8742</b>. LUMIO répond alors à une adresse en https, du type https://nom-du-pc.votre-reseau.ts.net, visible de vos seuls appareils.</li>
      <li>Lancez LUMIO avec <b>LUMIO_ALLOWED_HOSTS=nom-du-pc.votre-reseau.ts.net</b> (et <b>LUMIO_2FA=1</b>) : le terminal affiche le lien « À distance ».</li>
      <li>Ouvrez ce lien sur le téléphone, installez LUMIO sur l'écran d'accueil, puis activez « Sur le téléphone, appli fermée » dans Notifications.</li></ol>
      Le code d'accès et la double authentification restent exigés, même relayés par Tailscale.</div></details>
    <p class="note" style="margin-top:8px">LUMIO est en lecture seule : il ne peut passer aucun ordre sur votre compte. Pour exiger en plus, sur le téléphone, un code à 6 chiffres (application d'authentification), lancez LUMIO avec <b>LUMIO_2FA=1</b>.${h.remote ? ' <b>Accès à distance (Tailscale) actif, protégé par code.</b>' : ''}</p>`}`)}
  ${sec('Intelligence artificielle', `<dl class="kv" style="grid-template-columns:1fr"><div><dt>Moteur</dt><dd>${h.ai_key ? 'Claude (clé ANTHROPIC_API_KEY détectée)' : 'Moteur de règles local — ajoutez ANTHROPIC_API_KEY pour les réponses rédigées par Claude'}</dd></div></dl>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="iaPrivDef" ${L.store.get('ia.private', false) ? 'checked' : ''}> Mode discret par défaut : aucun montant en euros envoyé à Claude, y compris pour la synthèse du jour rédigée sur le PC</label>
    <p class="note" style="margin-top:8px">Garde-fous : un chiffre absent de vos données ou une tournure de conseil (« achetez », « vendez ») entraîne une réécriture, puis le repli sur le moteur de règles. Les titres d'actualité sont traités comme des données, jamais comme des consignes.</p>`)}
  ${sec('Méthodes de calcul', `<details open><summary class="lnk" style="cursor:pointer">Performance</summary><p class="note" style="margin:6px 0 10px;color:var(--ink2)"><b>TWR</b> (rendement pondéré par le temps) : produit des rendements quotidiens r = (V − V<sub>veille</sub> − apports + dividendes) / (V<sub>veille</sub> + apports), neutralise vos versements ; comparable à un indice. <b>XIRR</b> : taux qui annule la valeur actuelle de vos flux datés (achats, ventes, dividendes, valeur finale). <b>Bêta</b> et corrélation : rendements hebdomadaires sur 1 an. <b>Sharpe</b> : (rendement annualisé − €STR) / volatilité, à partir de 3 mois de séances. <b>VaR 95 %</b> : 5e centile des rendements quotidiens. Un achat compte en début de séance, une vente en fin de séance (convention de Portfolio Performance). Chaque période part de la clôture du jour anniversaire (1 mois : même jour du mois précédent ; YTD : 31 décembre), la même pour la courbe, le pourcentage, les contributions et le pont. Données incomplètes : une ligne sans cours est valorisée à ses prix d'exécution, une ligne sans opération importée entre comme un apport de titres au jour de la première opération, et des titres achetés avant le premier cours disponible forment un solde d'ouverture ; Qualité des données signale chaque cas.</p></details>
    <details><summary class="lnk" style="cursor:pointer">Plus-values et fiscalité</summary><p class="note" style="margin:6px 0 10px;color:var(--ink2)">Prix de revient au <b>PMP</b> (prix moyen pondéré, frais d'achat inclus), splits et échanges de titres reportés. PFU de 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux) sur les plus-values dès les revenus 2025 et sur les dividendes et intérêts perçus à partir de 2026 (LFSS 2026), 30 % avant. Moins-values imputables 10 ans. Option barème : abattement de 40 % sur les dividendes. Estimation indicative : l'IFU fait foi.</p></details>
    <details><summary class="lnk" style="cursor:pointer">Bilan de santé</summary><p class="note" style="margin:6px 0 10px;color:var(--ink2)">Règles à seuils fixes : plus grosse action (15 / 25 %), secteur dominant après décomposition des ETF (35 / 50 %), région (80 / 90 %), hors euro (60 / 80 %), part spéculative (10 / 20 %), lignes à −25 %, frais (0,5 / 1 %), volatilité (20 / 30 %), 10 premières sociétés (45 / 70 %), paires corrélées > 0,8. ✓ = 1 point, ! = ½, ✕ = 0 ; score = moyenne × 100.</p></details>
    <details><summary class="lnk" style="cursor:pointer">Score des actualités</summary><p class="note" style="margin:6px 0 10px;color:var(--ink2)">Exposition (ligne détenue : 25 + poids, jusqu'à 40 ; secteur détenu : jusqu'à 30) + gravité de l'événement (enquête, avertissement sur résultats, résultats, contrat… jusqu'à 40, +5 si plusieurs) + fraîcheur (15 si moins de 6 h) + fiabilité de la source (5). Alerte rouge seulement si l'événement est grave et la ligne détenue (≥ 70).</p></details>
    <details><summary class="lnk" style="cursor:pointer">Scénarios et projection</summary><p class="note" style="margin:6px 0 10px;color:var(--ink2)">Choc = valeur de la ligne × bêta à l'indice × choc ; choc de change = part exposée au dollar après décomposition des ETF. Objectif : 2 000 trajectoires Monte-Carlo qui rééchantillonnent vos rendements mensuels réels, recentrés sur une hypothèse prudente de 6 %/an (volatilité et forme conservées), versements mensuels inclus.</p></details>`, 'c12')}
  ${h.demo ? '' : sec('Sauvegarde', `<p class="ink2" style="font-size:13.5px">Transférez vos données d'un LUMIO à l'autre, par exemple du PC vers la version en ligne : exportez la sauvegarde ici, importez-la là-bas.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="btn sm" href="/api/backup" download>${L.icon('download')}Exporter une sauvegarde</a><button class="btn sm" data-restore>${L.icon('upload')}Importer une sauvegarde</button></div>
    <p class="note" style="margin-top:8px">Contient vos exports Trade Republic, opérations saisies, décisions, règles, alertes, watchlists et synthèses ; jamais vos mots de passe, codes, appareils connectés ni votre compte eToro (à connecter sur chaque LUMIO). Gardez ce fichier pour vous.</p>`)}
  ${sec('Effacer les données LUMIO', `<p class="ink2" style="font-size:13.5px">Supprime watchlists, alertes, cibles, objectif, opérations saisies et caches. Vos exports Trade Republic (portfolio.csv, transactions.csv) ne sont jamais touchés.</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><input class="inp" id="wipeC" placeholder="Tapez EFFACER" style="max-width:180px" aria-label="Confirmation"><button class="btn danger" id="wipeGo">${L.icon('trash')}Effacer</button></div>`)}
  ${sec('Raccourcis et visite guidée', `<div class="note" style="line-height:2;color:var(--ink2)"><span class="kbd" style="background:var(--card3)">/</span> demander à l'IA · <span class="kbd" style="background:var(--card3)">M</span> masquer les montants · <span class="kbd" style="background:var(--card3)">1</span>–<span class="kbd" style="background:var(--card3)">4</span> sections · <span class="kbd" style="background:var(--card3)">Échap</span> fermer · double-clic sur la valeur : mode discret</div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="kbOn" ${L.store.get('shortcuts', true) ? 'checked' : ''}> Raccourcis à une touche activés</label>
    <button class="btn sm" data-tour-start style="margin-top:12px">${L.icon('help')}Visite guidée de LUMIO</button>
    <p class="note" style="margin-top:8px">LUMIO ${L.esc(h.version || '')} · application locale, données sous votre contrôle.</p>`)}`;
  const kb = document.getElementById('kbOn'); if (kb) kb.onchange = () => { L.store.set('shortcuts', kb.checked); L.toast(kb.checked ? 'Raccourcis activés' : 'Raccourcis désactivés'); };
  notifServer(); phoneBox(); connBox(); srcBox(); if (h.online) devBox(); else { pubBox(); majBox(); }
  const nf = document.getElementById('nfOn');
  if (nf) nf.onchange = async () => {
    if (nf.checked && 'Notification' in window && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission(); if (p !== 'granted') { nf.checked = false; L.toast('Notifications refusées par le navigateur', true); }
    }
    L.store.set('notif', nf.checked); render(root);
  };
  const nt = document.getElementById('nfTest');
  if (nt) nt.onclick = () => { try { new Notification('LUMIO', { body: 'Les notifications fonctionnent.', icon: 'static/icon-192.png' }); } catch (e) { L.toast('Notification impossible', true); } };
  document.getElementById('iaPrivDef').onchange = async (e) => {
    const on = e.target.checked;
    try { await L.api('/api/settings', { method: 'PUT', body: { ai_private: on } }); L.store.set('ia.private', on); L.toast(on ? 'Mode discret enregistré sur le PC' : 'Mode discret désactivé'); }
    catch (err) { e.target.checked = !on; L.toast(err.message, true); }
  };
  document.getElementById('wipeGo').onclick = async () => {
    const v = document.getElementById('wipeC').value.trim();
    if (v !== 'EFFACER') { L.toast('Tapez EFFACER pour confirmer', true); return; }
    try { const r = await L.api('/api/local-data/wipe', { method: 'POST', body: { confirm: 'EFFACER' } }); L.forget(); L.toast(`${r.removed.length} fichier(s) supprimé(s)`); render(root); } catch (e) { L.toast(e.message, true); }
  };
}
/* Corriger une ligne signalée par la qualité des données : ticker de cotation (essayé avant
   d'être retenu), secteur, type, pays. Enregistré dans overrides.json, appliqué partout. */
L.fixLine = async (key) => {
  let d;
  try { d = await L.api('/api/overrides/' + encodeURIComponent(key)); } catch (e) { L.toast(e.message, true); return; }
  const ov = d.override || {};
  const opt = (list, cur, auto) => `<option value="">${auto}</option>` + list.map(x => `<option${x === cur ? ' selected' : ''}>${L.esc(x)}</option>`).join('');
  const dr = L.drawer.open('fix', { title: 'Corriger la ligne', sub: `${L.esc(d.name)} · ${L.esc(d.key)} · ${L.esc(d.account)}`, html: `
    <form id="fixF" class="fix-f">
      <label class="fld"><span>Ticker de cotation (Yahoo Finance)</span>
        <div class="fix-tk"><input class="inp" name="ticker" value="${L.esc(ov.ticker || d.ticker || '')}" placeholder="ex. AIR.PA, NVDA, CW8.PA" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="fixTest">Essayer</button></div></label>
      <p class="note" id="fixOut">Place européenne de préférence (.PA Paris, .DE Xetra, .AS Amsterdam, .MI Milan) : même devise que votre courtier.</p>
      <div class="fix-g"><label class="fld"><span>Secteur</span><select class="sel" name="secteur">${opt(d.sectors, ov.secteur, `Automatique (${L.esc(d.sector)})`)}</select></label>
        <label class="fld"><span>Type</span><select class="sel" name="type">${opt(d.types, ov.type, `Automatique (${L.esc(d.asset_type)})`)}</select></label>
        <label class="fld"><span>Pays</span><select class="sel" name="pays">${opt(d.countries, ov.pays, `Automatique (${L.esc(d.country)})`)}</select></label></div>
      <div class="sec" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" type="submit">Enregistrer la correction</button>
        ${Object.keys(ov).length ? '<button type="button" class="btn g" id="fixReset">Revenir au classement automatique</button>' : ''}</div>
      <p class="note">Gardé dans data/overrides.json et appliqué partout (cours, courbe, répartition, bilan de santé).</p></form>` });
  const f = dr.querySelector('#fixF'); const out = dr.querySelector('#fixOut');
  dr.querySelector('#fixTest').onclick = async () => {
    const t = f.ticker.value.trim(); if (!t) return;
    out.textContent = 'Essai en cours…';
    try {
      const r = await L.api(`/api/overrides/${encodeURIComponent(d.key)}/test`, { method: 'POST', body: { ticker: t } });
      out.innerHTML = `${L.esc(r.ticker)} : ${F.n(r.price, 2)} ${L.esc(r.currency || '')}, la ligne vaudrait <b>${F.eur(r.value)}</b>${r.reference ? ` contre ${F.eur(r.reference)} chez Trade Republic (${r.gap_pct > 0 ? '+' : ''}${F.n(r.gap_pct, 1)} %)` : ''}.${r.gap_pct != null && Math.abs(r.gap_pct) > 3 ? ' <b>Écart important : autre place ou autre titre ?</b>' : ''}`;
    } catch (e) { out.textContent = e.message; }
  };
  const save = async body => {
    try { await L.api('/api/overrides/' + encodeURIComponent(d.key), { method: 'PUT', body }); L.forget(); L.drawer.close(); L.toast('Ligne corrigée : chiffres recalculés');
      if (document.getElementById('rg')) render(document.querySelector('#main .view')); }
    catch (e) { L.toast(e.message, true); }
  };
  f.onsubmit = e => { e.preventDefault(); save({ ticker: f.ticker.value.trim(), secteur: f.secteur.value, type: f.type.value, pays: f.pays.value }); };
  const rs = dr.querySelector('#fixReset'); if (rs) rs.onclick = () => save({ ticker: '', secteur: '', type: '', pays: '' });
};
document.addEventListener('click', e => { const b = e.target.closest('[data-fixline]'); if (b) { e.preventDefault(); L.fixLine(b.dataset.fixline); } });

/* Comptes connectés : Trade Republic (synchronisation) et eToro (API officielle, clé en lecture seule) */
async function connBox() {
  const box = document.getElementById('cnBox'); if (!box) return;
  let d;
  try { d = await L.api('/api/connectors'); } catch (e) { box.innerHTML = L.errBox(e); return; }
  const e = d.etoro || {}; const tr = d.tr || {};
  const when = ts => ts ? `${F.date(ts)} à ${F.time(ts)}` : 'jamais';
  const trOk = tr.demo || tr.synced;
  const trRow = `<div class="li cn-row"><span class="st ${trOk ? 'ok' : ''}" aria-hidden="true">${trOk ? '✓' : '·'}</span><div class="main"><div class="t1">Trade Republic</div>
      <div class="t2">${tr.demo ? 'Démo : opérations fictives' : `${tr.synced ? 'Synchronisé le ' + when(tr.synced) : 'Pas encore synchronisé'} · PIN demandé à chaque mise à jour, jamais enregistré`}</div></div>
      ${tr.demo ? '' : `<button class="btn sm" data-syncopen>${L.icon('refresh')}Mettre à jour</button>`}</div>`;
  let et;
  if (e.demo) et = `<div class="li cn-row"><span class="st" aria-hidden="true">·</span><div class="main"><div class="t1">eToro</div><div class="t2">À connecter sur votre LUMIO, avec vos données (pas en mode démo).</div></div></div>`;
  else if (e.connected) et = `<div class="li cn-row"><span class="st ${e.error ? 'warn' : 'ok'}" aria-hidden="true">${e.error ? '!' : '✓'}</span><div class="main"><div class="t1">eToro</div>
      <div class="t2">Synchronisé ${e.synced ? 'le ' + when(e.synced) : ': en cours'}${e.positions != null ? ` · ${e.positions} ligne${e.positions > 1 ? 's' : ''}${e.cfd ? ` dont ${e.cfd} CFD` : ''} · <span class="m">${F.cur(e.value || 0)}</span>` : ''} · clé ${L.esc(e.key || '')}, lecture seule</div>
      ${e.cash != null ? `<div class="t2">Espèces disponibles chez eToro : <span class="m">${F.cur(e.cash)}</span>, non comptées dans le portefeuille (comme chez Trade Republic).</div>` : ''}
      ${e.error ? `<div class="t2" style="color:var(--warn)">${L.esc(e.error)}</div>` : ''}${(e.notes || []).map(n => `<div class="t2">${L.esc(n)}</div>`).join('')}</div></div>
    <div class="cn-act"><button class="btn sm" data-etoro="sync">${L.icon('refresh')}Synchroniser</button><button class="btn sm g" data-etoro="off">Déconnecter</button></div>`;
  else et = `<div class="li cn-row"><span class="st" aria-hidden="true">+</span><div class="main"><div class="t1">eToro</div><div class="t2">Positions, gains latents et positions clôturées, relus toutes les 15 minutes par l'API officielle d'eToro.</div></div></div>
    <details class="cn-how"${L.store.get('cn.open', false) ? ' open' : ''}><summary class="lnk">Connecter mon compte eToro</summary>
      <ol class="tel-steps"><li>Dans eToro : Réglages, Trading, <b>Gestion des clés API</b>, puis « Créer une nouvelle clé ».</li>
        <li>Environnement <b>Réel</b>, droit <b>Lecture</b> seulement : LUMIO ne passe jamais d'ordre.</li>
        <li>Confirmez par le code reçu par SMS, puis copiez la clé publique et la clé utilisateur ci-dessous.</li></ol>
      <form id="etForm" class="cn-form" autocomplete="off"><label class="fld"><span>Clé publique (x-api-key)</span><input class="inp" type="password" name="api_key" autocomplete="off" spellcheck="false" required></label>
        <label class="fld"><span>Clé utilisateur (x-user-key)</span><input class="inp" type="password" name="user_key" autocomplete="off" spellcheck="false" required></label>
        <button class="btn p" type="submit">Connecter eToro</button></form>
      <p class="note">Les clés sont vérifiées auprès d'eToro, puis gardées dans vos données LUMIO : jamais réaffichées, ni incluses dans les sauvegardes. « Déconnecter » les efface ; vous pouvez aussi les révoquer dans eToro.</p></details>`;
  box.innerHTML = trRow + et;
  const how = box.querySelector('.cn-how'); if (how) how.ontoggle = () => L.store.set('cn.open', how.open);
  const f = document.getElementById('etForm');
  if (f) f.onsubmit = async ev => {
    ev.preventDefault();
    const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Vérification auprès d\'eToro…';
    try { await L.api('/api/connectors/etoro', { method: 'PUT', body: { api_key: f.api_key.value, user_key: f.user_key.value } }); f.reset(); L.forget(); L.toast('Compte eToro connecté'); connBox(); }
    catch (err) { L.toast(err.message, true); b.disabled = false; b.textContent = 'Connecter eToro'; }
  };
  L.qsa('[data-etoro]', box).forEach(b => b.onclick = async () => {
    if (b.dataset.etoro === 'off' && !(await L.confirmBox('Déconnecter eToro ? Les clés et les lignes eToro sont effacées de LUMIO (rien ne change chez eToro).', 'Déconnecter'))) return;
    b.disabled = true;
    try {
      await L.api(b.dataset.etoro === 'off' ? '/api/connectors/etoro' : '/api/connectors/etoro/sync', { method: b.dataset.etoro === 'off' ? 'DELETE' : 'POST' });
      L.forget(); L.toast(b.dataset.etoro === 'off' ? 'eToro déconnecté' : 'eToro synchronisé'); connBox();
    } catch (err) { L.toast(err.message, true); b.disabled = false; }
  });
}

/* Notifications du serveur : types notifiés, notification Windows, notifications sur le téléphone
   (Web Push chiffré de bout en bout, appli fermée) et dernières notifications */
const b64key = (s) => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const devLabel = () => {
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'PC Windows' : /Mac/.test(u) ? 'Mac' : 'Linux';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'navigateur';
  return os + ' · ' + br;
};
/* Accès depuis le téléphone : s'ouvre et se ferme sur le PC ; un QR code à scanner, rien sur internet */
let phIp = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function phoneBox(pre) {
  const box = document.getElementById('phBox'); if (!box) return;
  let d = pre;
  for (let i = 0; !d; i++) {          // le serveur se relance une seconde quand l'accès change : on patiente
    try { d = await L.api('/api/phone'); } catch (e) { if (i >= 12 || !box.isConnected) { if (box.isConnected) box.innerHTML = L.errBox(e); return; } await sleep(600); }
  }
  if (!box.isConnected) return;
  if (d.online) {                     // LUMIO en ligne : une adresse, rien à ouvrir ni à scanner à chaque fois
    box.innerHTML = `<div class="tel-on"><div class="tel-qr" role="img" aria-label="QR code de l'adresse de LUMIO">${d.qr}</div>
      <div class="tel-t"><div><span class="tag up">En ligne</span></div>
        <p style="margin:0">Votre LUMIO répond à cette adresse, partout et à toute heure :</p><div class="tel-url">${L.esc(d.url)}</div>
        <ol class="tel-steps"><li>Ouvrez l'adresse sur le téléphone (ou scannez ce code depuis l'écran du PC).</li><li>Connectez-vous : mot de passe et code à 6 chiffres, une fois tous les 90 jours.</li><li>Dans le navigateur du téléphone, choisissez « Ajouter à l'écran d'accueil ».</li></ol></div></div>
      <p class="note" style="margin-top:12px">Le QR code ne contient que l'adresse : sans votre mot de passe et votre code, il n'ouvre rien.</p>`;
    return;
  }
  if (!d.local) {
    box.innerHTML = `<p class="ink2" style="font-size:13.5px">${d.enabled ? 'Vous consultez LUMIO depuis le réseau local. ' : ''}L'accès depuis le téléphone s'ouvre et se ferme sur le PC, dans Réglages.</p>`;
    return;
  }
  if (d.enabled && d.links && d.links.length) {
    const i = Math.min(phIp, d.links.length - 1), k = d.links[i];
    box.innerHTML = `<div class="tel-on"><div class="tel-qr" role="img" aria-label="QR code : adresse de LUMIO sur votre réseau local">${k.qr}</div>
      <div class="tel-t"><div><span class="tag up">Accès ouvert</span></div>
        <ol class="tel-steps"><li>Le téléphone est sur le même Wi-Fi que ce PC.</li><li>Scannez ce code avec l'appareil photo du téléphone.</li><li>Dans le navigateur du téléphone, choisissez « Ajouter à l'écran d'accueil ».</li></ol>
        ${d.links.length > 1 ? `<div class="tel-ips" role="group" aria-label="Adresse du PC">${d.links.map((x, j) => `<button class="btn sm${j === i ? ' p' : ''}" data-phip="${j}" aria-pressed="${j === i}">${L.esc(x.ip)}</button>`).join('')}</div>
          <p class="note">La page ne s'ouvre pas ? Essayez l'autre adresse du PC.</p>` : ''}
        <details><summary class="lnk" style="cursor:pointer">Adresse à saisir à la main</summary><div class="tel-url">${L.esc(k.url)}</div></details></div></div>
      <p class="note" style="margin-top:12px">Ce code ouvre vos chiffres : ne le partagez pas. Il ne fonctionne que sur ce Wi-Fi ; sur un autre réseau, l'accès se suspend tout seul. Si la page ne s'ouvre pas sur le téléphone : autorisez Python quand Windows le demande (cochez <b>Réseaux privés</b>), vérifiez que ce Wi-Fi est un réseau privé dans Windows, et coupez un éventuel VPN.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${d.forced ? '' : '<button class="btn sm" data-ph="off">Fermer l\'accès</button>'}<button class="btn sm g" data-ph="renew">Changer le code d'accès</button></div>`;
  } else {
    const why = { 'other-network': 'Accès suspendu : le PC n\'est plus sur le Wi-Fi où vous l\'avez ouvert. Il se rouvre tout seul à votre retour sur ce réseau ; le bouton ci-dessous l\'ouvre pour le réseau actuel.',
      'no-network': 'Aucun réseau local détecté : connectez le PC au Wi-Fi, puis réessayez.' }[d.state] || '';
    box.innerHTML = `<p class="ink2" style="font-size:13.5px">Consultez LUMIO sur votre téléphone, sur le même Wi-Fi que ce PC : un QR code à scanner, protégé par un code d'accès personnel. LUMIO s'installe ensuite comme une application.</p>
      ${why ? `<div class="callout warn" style="margin-top:10px">${why}</div>` : ''}
      <button class="btn p" data-ph="on" style="margin-top:12px">${L.icon('phone')}Ouvrir l'accès depuis mon téléphone</button>
      <p class="note" style="margin-top:8px">Rien ne passe par internet : le téléphone parle directement au PC, sur votre réseau. Vous pouvez fermer l'accès à tout moment.</p>`;
  }
  L.on(box, 'click', '[data-phip]', (e, b) => { phIp = +b.dataset.phip; phoneBox(d); });
  L.on(box, 'click', '[data-ph]', async (e, b) => {
    const act = b.dataset.ph;
    if (act === 'renew' && !(await L.confirmBox('Changer le code d\'accès ? Les appareils déjà connectés devront scanner le nouveau QR code.', 'Changer le code', false))) return;
    b.disabled = true;
    try {
      const r = act === 'renew' ? await L.api('/api/phone/renew', { method: 'POST' }) : await L.api('/api/phone', { method: 'PUT', body: { enabled: act === 'on' } });
      L.toast(act === 'renew' ? 'Nouveau code d\'accès : scannez le nouveau QR code' : act === 'on' ? 'Accès depuis le téléphone ouvert' : 'Accès depuis le téléphone fermé');
      phoneBox(r);
      if (act !== 'renew') setTimeout(() => phoneBox(), 1600);     // après la relance du serveur sur la nouvelle adresse
    } catch (err) { L.toast(err.message, true); b.disabled = false; }
  });
}
/* Version en ligne (GitHub Pages) : le PC publie une copie chiffrée en lecture seule, ouverte par
   mot de passe sur le téléphone ou un autre ordinateur. Clé de publication et mot de passe ne
   reviennent jamais du serveur. */
let pubPoll = 0;
/* État de chaque source (8.1) : dernière réussite et panne en cours, rafraîchi à l'ouverture de Réglages */
async function srcBox() {
  const box = document.getElementById('srcBox'); if (!box) return;
  let d;
  try { d = await L.get('/api/sources', 20000, true); } catch (e) { box.innerHTML = ''; return; }
  const ago = t => { if (!t) return 'jamais'; const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60)); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 2880 ? `il y a ${Math.floor(m / 60)} h` : `le ${F.dshort(t)}`; };
  box.innerHTML = `<ul class="src-l">${(d.sources || []).map(x => `<li><span class="src-dot ${x.ok === true ? 'ok' : x.ok === false ? 'ko' : 'off'}" aria-hidden="true"></span>
      <div><b>${L.esc(x.label)}</b><span class="note"> · ${L.esc(x.feeds)}</span><div class="t2">${x.ok === false ? '<b>En panne</b> : ' : ''}${L.esc(x.detail || '')}${x.last ? ` · dernière réussite ${ago(x.last)}` : ''}</div></div></li>`).join('')}</ul>
    ${d.warm && d.warm.secs != null ? `<p class="note">Au démarrage, chiffres, veille et file du matin préparés en ${d.warm.secs < 1 ? "moins d'une seconde" : `${Math.round(d.warm.secs)} s`}.</p>` : ''}`;
}
/* Contrôle de chaque ligne (7.9) : source et heure du cours, lignes à vérifier en tête (ouvert d'office) */
function linesTable(lc) {
  if (!lc || !(lc.rows || []).length) return '';
  const esc = L.esc;
  const when = t => t ? `${F.dshort(t)} ${F.time(t)}` : '—';
  return `<details class="lc"${lc.ok < lc.n ? ' open' : ''}><summary>Source et heure du cours de chaque ligne</summary>
    <div class="tbl-wrap"><table class="tbl lc-t"><thead><tr><th>Ligne</th><th>Source du cours</th><th>Cours du</th><th>Contrôle</th></tr></thead><tbody>
    ${lc.rows.map(r => `<tr class="${r.ok ? '' : 'lc-bad'}"><td>${esc(r.name)}</td><td>${esc(r.source)}</td><td class="num">${when(r.ts)}</td>
      <td>${r.ok ? '<span class="lc-ok">cohérente</span>' : `${r.checks.map(c => esc(c.text)).join(' ; ')} <button class="lnk" data-fixline="${esc(r.key)}">Corriger la ligne</button>`}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="note">Contrôles : cours plus ancien que l'avant-dernière clôture ; cours Yahoo à plus de 15 % du dernier cours Trade Republic ; courbe dont le dernier point s'écarte de plus de 25 % de la valeur de la ligne.</p></details>`;
}
/* Demandes depuis la version en ligne (relais GitHub, core/relais.py) : état et interrupteur */
function relaisHtml(rl) {
  if (!rl) return '';
  const esc = L.esc;
  const tag = !rl.on ? '<span class="tag">Coupées</span>' : rl.acces === false || rl.ecriture === false ? '<span class="tag warn">Clé à compléter</span>'
    : rl.acces ? '<span class="tag up">Actives</span>' : '<span class="tag">Première lecture en attente</span>';
  const dl = rl.derniere;
  const last = dl && dl.ts ? `Dernière demande : ${dl.t === 'sync' ? 'mise à jour Trade Republic' : 'veille et analyse'}, le ${F.dshort(dl.ts)} à ${F.time(dl.ts)} (${dl.ok ? 'traitée' : 'non aboutie'}).` : '';
  const seen = rl.on && rl.vu ? `Tickets lus pour la dernière fois à ${F.time(rl.vu)}.` : '';
  return `<div class="relais-on">
    <label class="chk"><input type="checkbox" data-relais ${rl.on ? 'checked' : ''}> Accepter les demandes envoyées depuis le téléphone ${tag}</label>
    <p class="note">Le bouton « Actualiser » de la version en ligne prépare un ticket chiffré dans votre dépôt privé ${esc(rl.repo || '')} ; ce PC le lit toutes les 20 secondes, lance la mise à jour Trade Republic ou la veille, répond sur le ticket et republie. La clé de publication doit avoir accès à ce dépôt avec <b>Issues : Read and write</b>.</p>
    ${rl.on && rl.message ? `<div class="callout warn">${esc(rl.message)}</div>` : ''}
    ${seen || last ? `<p class="note">${[seen, last].filter(Boolean).join(' ')}</p>` : ''}
  </div>`;
}
async function pubBox(pre) {
  const box = document.getElementById('pubBox'); if (!box) return;
  let d = pre;
  if (!d) { try { d = await L.api('/api/publication'); } catch (e) { box.innerHTML = L.errBox(e); return; } }
  if (!box.isConnected) return;
  const esc = L.esc;
  const last = d.last || null;
  const days = d.expires ? Math.floor((d.expires - Date.now() / 1000) / 86400) : null;
  const form = (first) => `<form id="pubF" class="pub-f" autocomplete="off">
      <label class="fld"><span>Dépôt GitHub</span><input class="inp" name="repo" value="${esc(d.repo || '')}" placeholder="https://github.com/compte/Lumio-app" spellcheck="false" ${first ? 'required' : ''}></label>
      <label class="fld"><span>Clé de publication${d.token ? ` (enregistrée : ${esc(d.token)} ; laisser vide pour la garder)` : ''}</span><input class="inp" name="token" type="password" placeholder="github_pat_…" spellcheck="false" autocomplete="off" ${d.token ? '' : 'required'}></label>
      <label class="fld"><span>Mot de passe de la version en ligne${d.password ? ' (défini ; laisser vide pour le garder)' : ` (${d.min_password} caractères au moins)`}</span><input class="inp" name="password" type="password" autocomplete="new-password" ${d.password ? '' : 'required'}></label>
      <label class="fld"><span>Le même mot de passe, pour confirmer</span><input class="inp" name="password2" type="password" autocomplete="new-password"></label>
      <label class="chk"><input type="checkbox" name="auto" ${d.auto ? 'checked' : ''}> Publier après chaque mise à jour Trade Republic</label>
      <label class="chk"><input type="checkbox" name="hourly" ${d.hourly ? 'checked' : ''}> Puis toutes les heures tant que LUMIO est ouvert</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" type="submit">${first ? 'Enregistrer et publier' : 'Enregistrer'}</button><span class="note" id="pubM" role="status"></span></div>
    </form>`;
  const status = () => {
    if (d.running) return `<div class="callout" style="margin-top:12px"><b>Publication en cours</b> : ${esc(d.step || '')}${d.progress && d.progress[1] ? ` (${d.progress[0]} sur ${d.progress[1]})` : ''}…</div>`;
    if (!last) return '';
    if (!last.ok) return `<div class="callout warn" style="margin-top:12px"><b>Dernière publication échouée</b> le ${F.dshort(last.ts)} à ${F.time(last.ts)} : ${esc(last.error || '')}</div>`;
    const dur = typeof last.secs === 'number' ? ` en ${last.secs >= 60 ? `${Math.floor(last.secs / 60)} min ${String(Math.round(last.secs % 60)).padStart(2, '0')} s` : `${Math.max(1, Math.round(last.secs))} s`}` : '';
    const slow = (last.slow || []).filter(x => x.s >= 10).slice(0, 2).map(x => `${L.esc(x.url.split('?')[0])} (${Math.round(x.s)} s)`).join(', ');
    const ev = d.econome || {};
    const eco = [ev.series ? `${ev.series} série${ev.series > 1 ? 's' : ''} de cours Yahoo` : '', ev.actus ? `${ev.actus} flux d'actualités` : ''].filter(Boolean).join(' et ');
    return `<p class="ink2" style="font-size:13.5px;margin-top:12px">Publiée le ${F.dshort(last.ts)} à ${F.time(last.ts)}${dur} : ${last.lines} ligne${last.lines > 1 ? 's' : ''}, ${last.uploaded} fichier${last.uploaded > 1 ? 's' : ''} envoyé${last.uploaded > 1 ? 's' : ''} sur ${last.files}.</p>
      ${slow ? `<p class="note" style="margin-top:4px">Lectures les plus lentes : ${slow}.</p>` : ''}
      ${eco ? `<p class="note" style="margin-top:4px">Réseau épargné : ${eco}, repris du cache au lieu d'être redemandés.</p>` : ''}`;
  };
  if (!d.ready) {
    box.innerHTML = `<p class="ink2" style="font-size:13.5px">Consultez LUMIO sur votre téléphone ou un autre ordinateur, partout : ce PC publie une copie de vos écrans, chiffrée avec votre mot de passe, sur GitHub Pages. Elle s'ouvre avec ce mot de passe et reste en lecture seule.</p>
      <ol class="tel-steps pub-steps"><li>Sur GitHub : un dépôt <b>public</b> (par exemple Lumio-app), avec <i>Settings › Pages</i> sur la branche <i>main</i>.</li>
        <li>Une clé de publication (<i>fine-grained token</i>) limitée à ce dépôt et au dépôt du code <b>LUMIO</b> (mises à jour automatiques), avec <i>Contents</i> et <i>Issues</i> en <i>Read and write</i> (Issues : demandes envoyées depuis le téléphone).</li>
        <li>Ici : le dépôt, la clé et un mot de passe à vous.</li></ol>
      ${form(true)}${status()}
      <p class="note" style="margin-top:10px">Le dépôt public ne contient que l'appli et vos données chiffrées : sans le mot de passe, personne ne peut les lire. Le mot de passe ne quitte pas ce PC (seule la clé de chiffrement qu'on en tire y est gardée) ; la clé de publication non plus.</p>`;
  } else {
    box.innerHTML = `<div class="pub-on"><span class="tag up">Publiée</span> <a class="tel-url" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.url)}</a></div>
      ${status()}
      ${d.private ? '<div class="callout warn" style="margin-top:10px">Dépôt privé : avec un compte GitHub gratuit, la page ne se publie que depuis un dépôt public. Sur GitHub : <i>Settings › General › Change visibility</i>.</div>' : ''}
      ${days != null && days < 15 ? `<div class="callout warn" style="margin-top:10px">La clé de publication ${days < 0 ? 'a expiré' : `expire dans ${days} jour${days > 1 ? 's' : ''}`} : créez-en une nouvelle sur GitHub et collez-la ci-dessous.</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn p" data-pub="go" ${d.running ? 'disabled' : ''}>${L.icon('refresh')}Publier maintenant</button>
        <button class="btn sm g" data-pub="copy">Copier le lien</button></div>
      <p class="note" style="margin-top:10px">Sur le téléphone : ouvrez le lien, saisissez le mot de passe, puis « Sur l'écran d'accueil ». Clé de publication ${esc(d.token || '')}${d.expires ? `, valable jusqu'au ${F.date(d.expires)}` : ''}.</p>
      ${relaisHtml(d.relais)}
      <details style="margin-top:10px"><summary class="lnk" style="cursor:pointer">Modifier les réglages</summary><div style="margin-top:10px">${form(false)}
        <button class="btn sm g" data-pub="stop" style="margin-top:12px">Arrêter la publication</button>
        <p class="note" style="margin-top:6px">Efface la clé de publication et la clé de chiffrement de ce PC. La page déjà publiée reste en ligne tant que le dépôt existe : supprimez-le sur GitHub pour l'effacer.</p></div></details>`;
  }
  clearTimeout(pubPoll);
  if (d.running) pubPoll = setTimeout(() => pubBox(), 1500);
  const rcb = box.querySelector('[data-relais]');
  if (rcb) rcb.onchange = async () => {
    try { pubBox(await L.api('/api/publication', { method: 'PUT', body: { relais: rcb.checked } })); L.toast(rcb.checked ? 'Demandes depuis le téléphone acceptées' : 'Demandes depuis le téléphone coupées'); }
    catch (err) { L.toast(err.message, true); rcb.checked = !rcb.checked; }
  };
  const f = box.querySelector('#pubF');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const m = box.querySelector('#pubM');
    const pw = f.password.value, pw2 = f.password2.value;
    if (pw && pw !== pw2) { m.textContent = 'Les deux mots de passe diffèrent.'; return; }
    if (pw && pw.length < d.min_password) { m.textContent = `Mot de passe trop court : ${d.min_password} caractères au moins.`; return; }
    const body = { repo: f.repo.value.trim(), auto: f.auto.checked, hourly: f.hourly.checked };
    if (f.token.value.trim()) body.token = f.token.value.trim();
    if (pw) body.password = pw;
    m.textContent = body.token ? 'Vérification de la clé auprès de GitHub…' : 'Enregistrement…';
    try {
      let r = await L.api('/api/publication', { method: 'PUT', body });
      f.token.value = ''; f.password.value = ''; f.password2.value = '';
      if (r.ready && (!d.ready || body.password)) r = await L.api('/api/publication/publish', { method: 'POST' });
      L.toast(r.running ? 'Réglages enregistrés : publication lancée' : 'Réglages enregistrés');
      pubBox(r);
    } catch (err) { m.textContent = err.message; }
  };
  L.on(box, 'click', '[data-pub]', async (e, b) => {
    const a = b.dataset.pub;
    if (a === 'copy') { try { await navigator.clipboard.writeText(d.url); L.toast('Lien copié'); } catch (err) { L.toast(d.url); } return; }
    if (a === 'stop') {
      if (!(await L.confirmBox('Arrêter la publication ? La clé de publication et la clé de chiffrement seront effacées de ce PC.', 'Arrêter', true))) return;
      try { pubBox(await L.api('/api/publication', { method: 'DELETE' })); L.toast('Publication arrêtée'); } catch (err) { L.toast(err.message, true); }
      return;
    }
    b.disabled = true;
    try { pubBox(await L.api('/api/publication/publish', { method: 'POST' })); L.toast('Publication lancée'); } catch (err) { L.toast(err.message, true); b.disabled = false; }
  });
}
/* Mises à jour (PC) : après chaque fusion sur GitHub, LUMIO récupère la nouvelle version, redémarre
   à un moment calme et republie la version en ligne. La clé GitHub ne revient jamais du serveur. */
let majPoll = 0;
async function majBox(pre, quiet) {
  const box = document.getElementById('majBox'); if (!box) return;
  let d = pre;
  if (!d) {
    try { d = await L.api('/api/maj'); } catch (e) {
      if (quiet) { clearTimeout(majPoll); majPoll = setTimeout(() => majBox(null, true), 4000); return; }   // LUMIO redémarre
      box.innerHTML = L.errBox(e); return;
    }
  }
  if (!box.isConnected) return;
  const esc = L.esc;
  const at = (iso) => { const t = iso ? Date.parse(iso) / 1000 : NaN; return isFinite(t) ? `le ${F.dshort(t)} à ${F.time(t)}` : ''; };
  const label = (x) => esc(x.titre || (x.version ? `LUMIO ${x.version}` : x.commit || ''));
  const inst = d.installee, ready = d.prete, v = d.verif;
  const res = { a_jour: 'à jour', adoptee: 'à jour', prete: 'nouvelle version trouvée', ecartee: 'à jour (la toute dernière version est écartée)' };
  const rows = [];
  const wrap = 'style="white-space:normal"';
  if (inst) rows.push(`<div><dt>Installée</dt><dd ${wrap}>${label(inst)}${inst.date ? ` <span class="ink2" style="font-weight:400">fusionnée ${at(inst.date)}</span>` : ''}</dd></div>`);
  if (v && v.ts && d.possible) rows.push(`<div><dt>Dernière vérification</dt><dd ${wrap}>${F.dshort(v.ts)} à ${F.time(v.ts)} : ${v.ok ? (res[v.resultat] || 'faite') : 'impossible'}</dd></div>`);
  let call = '';
  if (!d.possible) call = `<div class="callout${d.raison && d.raison.startsWith('Dossier géré par git') ? '' : ' warn'}">${esc(d.raison || '')}</div>`;
  else if (ready) {
    const how = ready.lanceur_ancien ? 'Fermez la fenêtre de LUMIO puis relancez maj.bat pour l\'installer.'
      : !ready.installable ? 'Relancez LUMIO (maj.bat) pour l\'installer.'
      : d.auto ? 'LUMIO redémarre pour l\'installer dès qu\'aucune mise à jour Trade Republic ni publication n\'est en cours : quelques secondes, puis cette page se recharge.'
      : 'Mise à jour automatique coupée : installez-la quand vous voulez.';
    call = `<div class="callout"><b>Nouvelle version prête</b> : ${label(ready)}${ready.date ? `, fusionnée ${at(ready.date)}` : ''} (${ready.fichiers} fichier${ready.fichiers > 1 ? 's' : ''}). ${how}</div>`;
  } else if (v && v.ok === false && v.erreur) call = `<div class="callout warn"><b>Vérification impossible</b> : ${esc(v.erreur)}</div>`;
  const out = (d.ecartees || []).length && d.possible && v && v.resultat === 'ecartee'
    ? `<p class="note" style="margin-top:8px">Version ${esc(d.ecartees[d.ecartees.length - 1])} écartée : elle ne démarrait pas sur ce PC. LUMIO installera la suivante.</p>` : '';
  box.innerHTML = `${rows.length ? `<dl class="kv" style="grid-template-columns:1fr">${rows.join('')}</dl>` : ''}
    ${call ? `<div style="margin-top:10px">${call}</div>` : ''}${out}
    ${d.possible ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="majAuto" ${d.auto ? 'checked' : ''}> Installer automatiquement chaque nouvelle version publiée sur GitHub</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm g" data-maj="check" ${d.en_cours ? 'disabled' : ''}>${L.icon('refresh')}${d.en_cours ? 'Vérification…' : 'Vérifier maintenant'}</button>
      ${ready && ready.installable ? '<button class="btn p" data-maj="install">Installer maintenant</button>' : ''}</div>` : ''}
    <p class="note" style="margin-top:10px">Toutes les 10 minutes, LUMIO regarde la branche ${esc(d.branche || 'main')} de ${esc(d.depot || '')} : après chaque fusion, seuls les fichiers modifiés sont téléchargés et vérifiés. Si la nouvelle version ne démarre pas, l'ancienne revient d'elle-même. Vos données et maj.bat ne sont jamais touchés.</p>`;
  clearTimeout(majPoll);
  if (d.en_cours || (ready && ready.installable && d.auto)) majPoll = setTimeout(() => majBox(null, true), d.en_cours ? 1500 : 5000);
  const cb = box.querySelector('#majAuto');
  if (cb) cb.onchange = async () => {
    try { majBox(await L.api('/api/maj', { method: 'PUT', body: { auto: cb.checked } })); L.toast(cb.checked ? 'Mise à jour automatique activée' : 'Mise à jour automatique coupée'); }
    catch (err) { L.toast(err.message, true); cb.checked = !cb.checked; }
  };
  L.on(box, 'click', '[data-maj]', async (e, b) => {
    b.disabled = true;
    try {
      if (b.dataset.maj === 'check') majBox(await L.api('/api/maj/verifier', { method: 'POST' }));
      else { majBox(await L.api('/api/maj/installer', { method: 'POST' })); L.toast('Installation : LUMIO redémarre, la page se recharge'); }
    } catch (err) { L.toast(err.message, true); b.disabled = false; }
  });
}
/* LUMIO en ligne : appareils connectés (sessions), déconnexion de l'un ou de tous les autres */
async function devBox() {
  const box = document.getElementById('devBox'); if (!box) return;
  let d;
  try { d = await L.api('/api/auth/sessions'); } catch (e) { box.innerHTML = L.errBox(e); return; }
  if (!box.isConnected) return;
  const when = t => t ? `${F.dshort(t)} à ${F.time(t)}` : '—';
  box.innerHTML = `<p class="ink2" style="font-size:13.5px;margin:0 0 10px">Connexion par mot de passe et code à 6 chiffres${d.totp ? ' (double authentification active)' : ''}. Un appareil retenu le reste 90 jours ; vous pouvez le déconnecter ici à tout moment.</p>
    <div class="dev-list">${d.items.map(x => `<div class="dev"><div class="dev-t"><b>${L.esc(x.device || 'Appareil')}</b>${x.current ? '<span class="tag up">cet appareil</span>' : ''}
      <span class="note">Connecté le ${when(x.created)}, vu le ${when(x.seen)}, ${x.remember ? `jusqu'au ${F.dshort(x.until)}` : 'pour la journée'}</span></div>
      ${x.current ? '<button class="btn sm" data-dev="logout">Se déconnecter</button>' : `<button class="btn sm g" data-dev="${L.esc(x.id)}">Déconnecter</button>`}</div>`).join('')}</div>
    ${d.items.length > 1 ? '<button class="btn sm" data-dev="others" style="margin-top:10px">Déconnecter tous les autres appareils</button>' : ''}
    <p class="note" style="margin-top:10px">Téléphone perdu : déconnectez-le ici. Application d'authentification perdue : chez l'hébergeur, ajoutez la variable LUMIO_RESET_2FA=1, redémarrez, reconnectez-vous pour réactiver la double authentification, puis retirez la variable.</p>`;
  L.on(box, 'click', '[data-dev]', async (e, b) => {
    const a = b.dataset.dev;
    b.disabled = true;
    try {
      if (a === 'logout') { await L.api('/auth/logout', { method: 'POST' }); L.snap.clear(); location.replace('/login'); return; }
      if (a === 'others') { const r = await L.api('/api/auth/sessions/revoke-others', { method: 'POST' }); L.toast(`${r.revoked} appareil${r.revoked > 1 ? 's' : ''} déconnecté${r.revoked > 1 ? 's' : ''}`); }
      else { await L.api('/api/auth/sessions/' + encodeURIComponent(a), { method: 'DELETE' }); L.toast('Appareil déconnecté'); }
      devBox();
    } catch (err) { L.toast(err.message, true); b.disabled = false; }
  });
}
async function pushState(srv) {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!srv.available) return { why: 'Sur le PC, installez le module manquant : <b>pip install cryptography</b>, puis relancez LUMIO.' };
  if (!window.isSecureContext) return { why: 'Ce téléphone ouvre LUMIO en http : les notifications push exigent une adresse <b>https</b>. Passez par Tailscale (« Hors de chez vous », ci-dessous) : l\'adresse en https://….ts.net les active.' };
  if (ios && !standalone) return { why: 'Sur iPhone et iPad, installez d\'abord LUMIO : Partager, puis « Sur l\'écran d\'accueil ». Ouvrez-le depuis l\'icône et revenez ici (iOS 16.4 ou plus).' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { why: 'Ce navigateur ne gère pas les notifications push.' };
  if (Notification.permission === 'denied') return { why: 'Les notifications de LUMIO sont bloquées dans les réglages de ce navigateur ou de ce téléphone.' };
  let sub = null;
  try { const reg = await navigator.serviceWorker.getRegistration(); sub = reg ? await reg.pushManager.getSubscription() : null; } catch (e) { /* ignore */ }
  return { ok: true, sub };
}
async function notifServer() {
  const box = document.getElementById('nfSrv'); if (!box) return;
  let n, ps;
  try { [n, ps] = await Promise.all([L.get('/api/notifications', 0, true), L.get('/api/push', 0, true).catch(() => ({ available: false, devices: [] }))]); } catch (e) { box.innerHTML = L.errBox(e); return; }
  const st = n.settings || {};
  const here = await pushState(ps);
  const devs = ps.devices || [];
  box.innerHTML = `<div class="k-l">Types notifiés</div>
    <div class="chips" style="margin-top:6px" role="group" aria-label="Types notifiés sur le PC et le téléphone">${Object.entries(n.kinds || {}).map(([k, l]) => `<button class="chip ${(st.kinds || []).includes(k) ? 'on' : ''}" aria-pressed="${(st.kinds || []).includes(k)}" data-nk="${k}">${L.esc(l)}</button>`).join('')}</div>
    <div class="k-l" style="margin-top:14px">Sur le téléphone, appli fermée</div>
    ${here.ok ? `<p class="note" style="margin-top:4px">${here.sub ? '<b>Activées sur cet appareil.</b> ' : ''}Envoyées par le PC et chiffrées de bout en bout : le service de notification du téléphone (Apple, Google…) relaie un message qu'il ne peut pas lire. Aucun montant n'y figure.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${here.sub ? '<button class="btn sm" id="psTest">Envoyer un test</button><button class="btn sm" id="psOff">Désactiver sur cet appareil</button>' : '<button class="btn sm p" id="psOn">Activer sur cet appareil</button>'}</div>`
      : `<p class="note" style="margin-top:4px">${here.why}</p>`}
    ${devs.length ? `<div style="margin-top:8px">${devs.map(d => `<div class="li"><div class="main"><div class="t1">${L.esc(d.label)}</div><div class="t2">abonné ${L.esc(F.ago((Date.now() / 1000 - (d.since || 0)) / 3600))}${d.last_ok ? ' · dernière notification reçue par le service ' + L.esc(F.ago((Date.now() / 1000 - d.last_ok) / 3600)) : ''}${d.last_try && !d.last_code ? ' · service de notification injoignable : vérifiez la connexion du PC' : d.last_code && ![200, 201, 202].includes(d.last_code) ? ' · refusée par le service : désactivez puis réactivez les notifications sur cet appareil' : ''}${d.fails ? ` · ${d.fails} échec${d.fails > 1 ? 's' : ''}` : ''}</div></div><button class="btn sm" data-psdel="${L.esc(d.id)}" aria-label="Retirer ${L.esc(d.label)}">Retirer</button></div>`).join('')}</div>` : ''}
    <div class="k-l" style="margin-top:14px">Sur le PC</div>
    ${n.desktop_available ? `<label class="chk" style="margin-top:6px"><input type="checkbox" id="nfDesk" ${st.desktop ? 'checked' : ''}> Notification Windows (en bas à droite de l'écran)</label>
      <button class="btn sm" id="nfWin" style="margin:8px 0 0 28px" ${st.desktop ? '' : 'disabled'}>Tester la notification Windows</button>`
    : '<p class="note" style="margin-top:4px">Notification Windows : disponible quand LUMIO tourne sous Windows.</p>'}
    <div class="k-l" style="margin-top:14px">Dernières notifications</div>
    ${(n.items || []).slice(0, 5).map(x => `<div class="li"><div class="main"><div class="t1 ell">${L.mText(x.title)}</div><div class="t2">${L.esc(x.label)} · ${L.esc(F.ago((Date.now() / 1000 - x.t) / 3600))}</div></div></div>`).join('') || '<div class="note" style="margin-top:4px">Aucune pour l\'instant.</div>'}`;
  const save = async (body) => { try { await L.api('/api/notifications/settings', { method: 'PUT', body }); L.forget('/api/notifications'); notifServer(); } catch (e) { L.toast(e.message, true); } };
  const d = document.getElementById('nfDesk'); if (d) d.onchange = () => save({ desktop: d.checked });
  L.on(box, 'click', '[data-nk]', (e, b) => { const k = new Set(st.kinds || []); k.has(b.dataset.nk) ? k.delete(b.dataset.nk) : k.add(b.dataset.nk); save({ kinds: [...k] }); });
  const w = document.getElementById('nfWin');
  if (w) w.onclick = async () => { try { const r = await L.api('/api/notifications/test', { method: 'POST' }); L.toast(r.ok ? 'Notification envoyée' : r.detail, !r.ok); } catch (e) { L.toast(e.message, true); } };
  const on = document.getElementById('psOn');
  if (on) on.onclick = async () => {
    on.disabled = true;
    try {
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications refusées : autorisez-les pour LUMIO dans les réglages du téléphone');
      const reg = await navigator.serviceWorker.ready;
      const key = b64key(ps.public_key);
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();          // clé du PC changée : nouvel abonnement
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await L.api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), label: devLabel() } });
      L.toast('Notifications activées sur cet appareil'); L.forget('/api/push'); notifServer();
    } catch (e) { on.disabled = false; L.toast(e.message || 'Abonnement impossible', true); }
  };
  const off = document.getElementById('psOff');
  if (off) off.onclick = async () => {
    try { const ep = here.sub.endpoint; await here.sub.unsubscribe(); await L.api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: ep } }).catch(() => null); L.toast('Notifications désactivées sur cet appareil'); L.forget('/api/push'); notifServer(); } catch (e) { L.toast(e.message, true); }
  };
  const t = document.getElementById('psTest');
  if (t) t.onclick = async () => { try { const r = await L.api('/api/notifications/test', { method: 'POST', body: { channel: 'push' } }); L.toast(r.ok ? `Envoyée à ${r.push.sent} appareil${r.push.sent > 1 ? 's' : ''}` : r.detail, !r.ok); L.forget('/api/push'); } catch (e) { L.toast(e.message, true); } };
  L.on(box, 'click', '[data-psdel]', async (e, b) => { try { await L.api('/api/push/unsubscribe', { method: 'POST', body: { id: b.dataset.psdel } }); L.forget('/api/push'); notifServer(); } catch (err) { L.toast(err.message, true); } });
}
L.views.reglages = { render };
})();
