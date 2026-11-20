/* LUMIO — « Actualiser » : un seul bouton en haut de l'écran, sur ordinateur comme sur téléphone.
   - Sur le PC (ou le téléphone sur le même Wi-Fi) : la feuille réunit la mise à jour Trade Republic
     (sync.js) et, ici, la relance de la veille et de l'analyse (POST /api/refresh).
   - Dans la version en ligne : le téléphone ne parle qu'à GitHub. Il prépare une demande chiffrée
     avec le mot de passe de la version en ligne, que vous validez sur GitHub (ticket du dépôt privé
     LUMIO) ; le PC la lit, la traite, répond sur le ticket et republie (core/relais.py). */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const esc = L.esc;
const btn = document.getElementById('syncBtn');

const when = (t) => {
  if (!t) return '';
  const d = new Date(t * 1000), now = new Date(), y = new Date(now.getTime() - 864e5);
  const day = d.toDateString() === now.toDateString() ? 'aujourd\'hui' : d.toDateString() === y.toDateString() ? 'hier' : 'le ' + F.dshort(t);
  return `${day} à ${F.time(t)}`;
};
const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60));
  if (m < 2) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} jours`;
};
const dur = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.max(1, Math.round(s))} s`);

/* ═══ Sur le PC : relancer la veille et l'analyse ═══ */
const R = { st: null, el: null, poll: null, skew: 0 };

const rfHtml = (st) => {
  const head = `<h3 class="ac-h">${L.icon('radar')}Veille et analyse</h3>`;
  if (!st) return head + L.skel(70);
  const what = `<p class="note rf-what">Actualités, résultats, agenda, analyse du portefeuille et file du matin, recalculés maintenant${st.publish_on ? ', puis version en ligne republiée' : ''}.</p>`;
  if (st.running) {
    const steps = (st.steps || []).filter(s => s.key !== 'publication' || st.publish_on);
    const at = steps.findIndex(s => s.key === st.step);
    return head + `<ol class="sy-steps rf-steps" aria-label="Étapes de la relance">${steps.map((s, i) => {
      const cls = i < at ? 'ok' : i === at ? 'cur' : 'todo';
      const mark = cls === 'ok' ? L.icon('check') : cls === 'cur' ? '<i class="sy-spin"></i>' : '';
      return `<li class="${cls}"><span class="sy-m" aria-hidden="true">${mark}</span><div class="sy-t"><span>${esc(s.label)}<span class="sr"> : ${cls === 'ok' ? 'terminé' : cls === 'cur' ? 'en cours' : 'à venir'}</span></span></div></li>`;
    }).join('')}</ol><p class="note">Vous pouvez fermer cette feuille : le calcul continue sur le PC.</p>`;
  }
  let last = `<p class="sy-last">${L.icon('clock')}Calculées au démarrage de LUMIO, puis au fil des consultations.</p>`;
  if (st.ended) {
    last = st.ok === false
      ? `<div class="callout warn rf-gap">Dernière relance ${when(st.ended)} : ${esc(st.error || 'incomplète')}. Les écrans concernés gardent leurs derniers chiffres.</div>`
      : `<p class="sy-last">${L.icon('clock')}Relancées ${when(st.ended)}${st.secs ? ` en ${dur(st.secs)}` : ''}${st.pub_ok === true ? ', version en ligne publiée' : st.pub_ok === false ? ', publication en échec (voir Réglages)' : ''}</p>`;
  }
  const busy = st.sync_running ? '<p class="note">Mise à jour Trade Republic en cours : tout sera recalculé à la fin.</p>' : '';
  return head + what + last + busy + `<button class="btn rf-go" data-rf="go"${st.sync_running ? ' disabled' : ''}>${L.icon('refresh')}Relancer la veille et l'analyse</button>`;
};

const rfPaint = () => {
  if (btn) btn.classList.toggle('rf-run', !!(R.st && R.st.running));
  if (R.el && R.el.isConnected) R.el.innerHTML = rfHtml(R.st);
};
const rfLoad = async () => { R.st = await L.api('/api/refresh'); R.skew = Date.now() / 1000 - (R.st.now || Date.now() / 1000); return R.st; };
const rfWatch = () => {
  if (R.poll) return;
  R.poll = setInterval(async () => {
    const was = !!(R.st && R.st.running);
    try { await rfLoad(); } catch (e) { return; }           // LUMIO occupé : seconde suivante
    rfPaint();
    if (was && !R.st.running) {
      clearInterval(R.poll); R.poll = null;
      const msg = R.st.ok === false ? 'Veille relancée, mais incomplète' : 'Veille et analyse à jour';
      if (L.drawer.current === 'sync') L.live(msg); else L.toast(msg, R.st.ok === false);
      if (L.reloadAll) L.reloadAll();
    }
    if (!R.st.running) { clearInterval(R.poll); R.poll = null; }
  }, 1500);
};
const mount = async (el) => {
  R.el = el; if (!el) return;
  rfPaint();
  L.on(el, 'click', '[data-rf="go"]', async (e, b) => {
    b.disabled = true;
    try { R.st = await L.api('/api/refresh', { method: 'POST' }); }
    catch (err) { L.toast(err.message, true); try { await rfLoad(); } catch (x) { /* hors ligne */ } }
    rfPaint(); if (R.st && R.st.running) rfWatch();
  });
  try { await rfLoad(); } catch (e) { if (el.isConnected) el.innerHTML = `<h3 class="ac-h">${L.icon('radar')}Veille et analyse</h3>` + L.errBox(e); return; }
  rfPaint(); if (R.st.running) rfWatch();
};
L.refresh = { mount, get state() { return R.st; } };

/* ═══ Version en ligne : demande au PC par un ticket GitHub ═══ */
const S = window.LUMIO_STATIC;
if (!L.statique || !S) return;

const Q = { ready: null, sent: null, pinOk: false };
const OLD_S = 3 * 3600;
const TITLES = { sync: 'LUMIO : mettre à jour Trade Republic', veille: 'LUMIO : relancer la veille et l\'analyse' };
const ghUrl = (repo, t, body) => `https://github.com/${repo}/issues/new?title=${encodeURIComponent(TITLES[t])}&body=${encodeURIComponent(body)}`;
const bodyText = (req) => `${req}\n\nDemande chiffrée préparée par la version en ligne de LUMIO. Validez ce ticket : votre PC le lit en moins d'une minute, efface ce texte et répond ici.`;

const freshHtml = () => {
  const t = S.asof, old = t && Date.now() / 1000 - t > OLD_S;
  return `<dl class="ac-fresh">
    <div><dt>Copie du PC</dt><dd class="${old ? 'old' : ''}">${t ? `${when(t)}<small>${ago(t)}</small>` : 'inconnue'}</dd></div>
    ${S.trTs ? `<div><dt>Trade Republic</dt><dd>${when(S.trTs)}<small>dernière mise à jour</small></dd></div>` : ''}
  </dl>`;
};
const howHtml = () => `<details class="ac-how"><summary>Comment ça marche</summary><ol class="sy-how">
    <li>LUMIO prépare ici un ticket chiffré pour votre dépôt privé ${esc((S.relais && S.relais.repo) || 'LUMIO')} sur GitHub.</li>
    <li>Vous le validez sur GitHub (bouton « Create »).</li>
    <li>Votre PC, allumé avec LUMIO ouvert, le lit en moins d'une minute, efface son contenu, répond sur le ticket puis republie : cette page se recharge toute seule.</li></ol>
    <p class="note">Le PIN est chiffré sur ce téléphone avec votre mot de passe : seul votre PC peut le lire. Une demande sert une fois et expire après 15 minutes.</p></details>`;

const relayState = () => {
  const r = S.relais;
  if (!r || !r.repo) return `<div class="callout warn">Votre PC ne reçoit pas encore de demandes : il le fera dès qu'il aura installé LUMIO 7.8 et republié. Mettez à jour depuis le PC en attendant.</div>`;
  if (r.on === false) return '<div class="callout warn">Demandes coupées sur le PC : Réglages › Version en ligne › « Accepter les demandes envoyées depuis le téléphone ».</div>';
  if (r.acces === false) return `<div class="callout warn">Votre PC n'a pas encore accès aux tickets GitHub : sur GitHub, donnez à la clé de publication le dépôt ${esc(r.repo)} et la permission « Issues : Read and write ».</div>`;
  return '';
};

const formsHtml = () => {
  if (!S.canSeal()) {
    return `<form id="rlKey" class="sy-form" autocomplete="off" novalidate>
      <p class="ink2">Pour envoyer une demande, saisissez une fois le mot de passe de la version en ligne : il prépare la clé de chiffrement sur ce téléphone.</p>
      <label>Mot de passe<input class="inp" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn p" type="submit">Continuer</button></form>`;
  }
  return `<section class="ac-card">
      <h3 class="ac-h">${L.icon('wallet')}Trade Republic</h3>
      <p class="note">Cours, positions et opérations du compte, lus par votre PC.</p>
      <form id="rlSync" class="sy-form" autocomplete="off" novalidate>
        <label>Code PIN Trade Republic<input class="inp sy-pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required></label>
        <button class="btn p" type="submit">${L.icon('send')}Préparer la demande</button>
      </form>
      <p class="note ac-pin">Chiffré sur ce téléphone avec votre mot de passe : seul votre PC peut le lire.</p>
    </section>
    <section class="ac-card">
      <h3 class="ac-h">${L.icon('radar')}Veille et analyse</h3>
      <p class="note">Actualités, résultats, agenda, analyse du portefeuille et file du matin, recalculés sur votre PC.</p>
      <button class="btn" data-rl="veille">${L.icon('send')}Préparer la demande</button>
    </section>`;
};

const readyHtml = (q) => `<div class="ac-ready" role="status">
    <b>${q.t === 'sync' ? 'Demande de mise à jour prête' : 'Demande de veille prête'} : validez-la sur GitHub</b>
    <span>GitHub s'ouvre avec le ticket déjà rempli, dans votre dépôt privé : appuyez sur « Create » (ou « Submit new issue »).</span>
    <a class="btn p" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer" data-rl="sent">${L.icon('ext')}Ouvrir GitHub</a>
    <button class="btn g sm" data-rl="copy">Copier le texte de la demande</button>
    <p class="note">Si GitHub s'ouvre sans le texte, collez-le dans la description du ticket. Valable 15 minutes.</p>
    ${q.t === 'sync' ? '<p class="note"><b>Ensuite</b> : validez la connexion dans l\'app Trade Republic. Si un code est demandé, répondez au ticket avec ce code.</p>' : ''}
    <button class="lnk" data-rl="back">Annuler</button>
  </div>`;

const sentHtml = (q) => `<div class="ac-ready ok" role="status">
    <b>Demande envoyée ${when(q.ts)}</b>
    <span>Votre PC répond sur le ticket GitHub en moins d'une minute s'il est allumé avec LUMIO ouvert. Cette page se recharge toute seule à la nouvelle publication (quelques minutes).</span>
    <a class="lnk" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">Rouvrir le ticket prérempli</a>
    <button class="btn g sm" data-rl="back">Nouvelle demande</button>
  </div>`;

const paint = () => {
  const b = L.drawer.body('relais'); if (!b) return;
  const top = freshHtml() + relayState();
  b.innerHTML = top + (Q.ready ? readyHtml(Q.ready) : Q.sent ? sentHtml(Q.sent) : formsHtml() + howHtml());
  const pin = b.querySelector('#rlSync input[name=pin]'); if (pin && !L.coarse) setTimeout(() => pin.focus(), 80);
};

const prepare = async (t, extra) => {
  const r = S.relais;
  if (!r || !r.repo) { L.toast('Votre PC ne reçoit pas encore de demandes : mettez-le à jour en LUMIO 7.8.', true); return; }
  try {
    const req = await S.request(t, extra);
    Q.ready = { t, url: ghUrl(r.repo, t, bodyText(req)), text: bodyText(req) };
  } catch (e) {
    if (e && e.code === 'cle') { paint(); return; }
    L.toast('Demande impossible à préparer : ' + (e && e.message ? e.message : 'erreur inconnue'), true); return;
  }
  paint();
};

const open = () => {
  const d = L.drawer.open('relais', { title: 'Actualiser', sub: 'Demandes transmises à votre PC par GitHub', narrow: true, html: '' });
  Q.ready = null;
  paint();
  if (d.dataset.bound) return;
  d.dataset.bound = '1';
  L.on(d, 'submit', '#rlKey', async (e, f) => {
    e.preventDefault();
    const pw = f.password.value; if (!pw) return;
    const go = f.querySelector('button'); go.disabled = true; go.textContent = 'Vérification…';
    try { await S.rekey(pw); f.password.value = ''; paint(); }
    catch (err) { go.disabled = false; go.textContent = 'Continuer'; L.toast(err && err.name === 'OperationError' ? 'Mot de passe incorrect.' : 'Vérification impossible : réessayez.', true); }
  });
  L.on(d, 'submit', '#rlSync', async (e, f) => {
    e.preventDefault();
    const pin = (f.pin.value || '').trim();
    if (!/^\d{4,8}$/.test(pin)) { L.toast('Saisissez votre code PIN Trade Republic (4 chiffres)', true); f.pin.focus(); return; }
    f.pin.value = '';
    await prepare('sync', { pin });
  });
  L.on(d, 'click', '[data-rl]', async (e, b) => {
    const a = b.dataset.rl;
    if (a === 'veille') { await prepare('veille'); return; }
    if (a === 'back') { Q.ready = null; Q.sent = null; paint(); return; }
    if (a === 'copy') {
      try { await navigator.clipboard.writeText(Q.ready ? Q.ready.text : ''); L.toast('Texte copié : collez-le dans la description du ticket'); }
      catch (err) { L.toast('Copie impossible : appuyez longuement sur le lien GitHub pour l\'ouvrir', true); }
      return;
    }
    if (a === 'sent' && Q.ready) {               // le lien s'ouvre dans un nouvel onglet ; ici, l'attente
      Q.sent = { t: Q.ready.t, ts: Date.now() / 1000, url: Q.ready.url, asof: S.asof };
      Q.ready = null;
      S.expect();
      setTimeout(paint, 300);
      paintBtn();
    }
  });
};

/* Bouton de la barre (masqué par défaut) : visible ici, ambre quand la copie a plus de 3 heures */
const paintBtn = () => {
  if (!btn) return;
  btn.hidden = false;
  const old = S.asof && Date.now() / 1000 - S.asof > OLD_S;
  btn.classList.toggle('old', !!old && !Q.sent);
  btn.classList.toggle('run', !!Q.sent);
  const label = Q.sent ? 'Demande envoyée au PC : en attente de la nouvelle publication'
    : `Actualiser : copie publiée ${S.asof ? when(S.asof) : ''}${old ? ' (ancienne)' : ''}`;
  btn.setAttribute('aria-label', label); btn.title = label;
  const t = btn.querySelector('.sy-lbl'); if (t) t.textContent = 'Actualiser';      // l'icône tourne pendant l'attente
};
if (btn) btn.onclick = (e) => { e.preventDefault(); open(); };
document.addEventListener('lumio:static', () => {
  if (Q.sent && S.asof && S.asof > Q.sent.ts - 60) {        // la publication demandée est arrivée
    Q.sent = null;
    L.toast(`Nouvelle copie publiée par votre PC ${when(S.asof)}`);
    if (L.drawer.current === 'relais') paint();
  }
  paintBtn();
});
setInterval(paintBtn, 60000);
if (S.asof) paintBtn();                 // copie déjà ouverte avant le chargement de ce fichier
L.relais = { open };
})();
