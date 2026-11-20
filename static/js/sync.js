/* LUMIO — bouton « Mettre à jour » : lance la synchronisation Trade Republic (lecture seule) et en suit
   les étapes : confirmation dans l'app Trade Republic, portefeuille, opérations, cours et historiques.
   Le PIN est saisi à chaque fois : envoyé une fois au serveur pour cette connexion, jamais stocké (ni
   ici, ni sur le serveur). Le numéro peut être retenu par LUMIO ; il ne s'affiche que masqué. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const btn = document.getElementById('syncBtn');
// « Mettre à jour » proposé ailleurs (cours périmés sur le tableau de bord) : même action que le bouton
document.addEventListener('click', e => { if (e.target.closest('[data-sync-now]') && btn && !btn.hidden) { e.preventDefault(); btn.click(); } });
const S = { st: null, skew: 0, poll: null, clock: null, key: '', running: false, editPhone: false, form: false };
const SNOOZE = 'sync.snooze', STALE_S = 6 * 3600;
const STEPS = [
  ['confirm', 'Confirmer dans l\'app Trade Republic'],
  ['portfolio', 'Portefeuille'],
  ['transactions', 'Opérations'],
  ['extras', 'Cours et historiques'],
];
const RANK = { starting: 0, confirm: 0, code: 0, verify: 0, portfolio: 1, transactions: 2, extras: 3, done: 4 };
const R = 30, CIRC = 2 * Math.PI * R, FULL_S = 120;

const when = (t) => {
  if (!t) return '';
  const d = new Date(t * 1000), now = new Date(), y = new Date(now.getTime() - 864e5);
  const day = d.toDateString() === now.toDateString() ? 'aujourd\'hui' : d.toDateString() === y.toDateString() ? 'hier' : 'le ' + F.dshort(t);
  return `${day} à ${F.time(t)}`;
};
const load = async () => {
  const st = await L.api('/api/sync');
  S.skew = Date.now() / 1000 - st.now;    // l'heure du téléphone peut différer de celle du PC
  S.st = st;
  return st;
};
const left = (st) => (st && st.deadline ? Math.max(0, Math.round(st.deadline - (Date.now() / 1000 - S.skew))) : null);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pct = (st) => (st.total ? Math.round(100 * (st.done || 0) / st.total) : 0);
const busy = (st) => !!st && (st.running || st.phase === 'cancelling');
const sheetOpen = () => L.drawer.current === 'sync';
/* La feuille « Actualiser » : Trade Republic en haut (ce fichier), veille et analyse en dessous (actualiser.js) */
const pane = () => { const d = L.drawer.body('sync'); return d && (d.querySelector('#syPane') || d); };
const asking = (st) => st.phase === 'confirm' || st.phase === 'code';

/* ── Bouton de la barre : tourne pendant la mise à jour, passe à l'ambre quand l'app attend une validation ── */
const paintBtn = () => {
  const st = S.st; if (!btn || !st) return;
  btn.hidden = !!st.demo;
  document.documentElement.classList.toggle('has-sync', !st.demo);
  btn.classList.toggle('run', st.running && !asking(st));
  btn.classList.toggle('ask', st.running && asking(st));
  const label = st.phase === 'code' ? 'Code d\'authentification demandé' : st.phase === 'confirm' ? 'Confirmez dans l\'app Trade Republic'
    : st.running ? 'Mise à jour en cours' : 'Actualiser : Trade Republic, veille et analyse';
  btn.setAttribute('aria-label', label); btn.title = label;
  const t = btn.querySelector('.sy-lbl'); if (t) t.textContent = st.running ? 'Mise à jour…' : 'Actualiser';
};

/* ── Feuille de suivi ── */
const stepsHtml = (st) => {
  const at = RANK[st.phase] ?? 0;
  return `<ol class="sy-steps" aria-label="Étapes de la mise à jour">${STEPS.map(([k, label], i) => {
    const cls = st.phase === 'done' || i < at ? 'ok' : i === at ? 'cur' : 'todo';
    let extra = '';
    if (k === 'extras' && cls === 'cur' && st.total) {
      extra = `<div class="sy-bar" role="progressbar" aria-label="Cours et historiques" aria-valuemin="0" aria-valuemax="${st.total}" aria-valuenow="${st.done || 0}" id="syProg"><i id="syBar" style="width:${pct(st)}%"></i></div>
        <span class="sy-f" id="syPct">${st.done || 0} sur ${st.total}</span>`;
    } else if (k === 'transactions' && cls === 'cur') extra = '<span class="sy-f">Tout l\'historique : jusqu\'à une minute</span>';
    const mark = cls === 'ok' ? L.icon('check') : cls === 'cur' ? '<i class="sy-spin"></i>' : '';
    const sr = cls === 'ok' ? 'terminé' : cls === 'cur' ? 'en cours' : 'à venir';
    return `<li class="${cls}"><span class="sy-m" aria-hidden="true">${mark}</span><div class="sy-t"><span>${label}<span class="sr"> : ${sr}</span></span>${extra}</div></li>`;
  }).join('')}</ol>`;
};

const ring = (st) => {
  const s = left(st);
  const off = s == null ? 0 : CIRC * (1 - Math.min(1, s / FULL_S));
  return `<svg class="sy-ring" viewBox="0 0 72 72" aria-hidden="true"><circle class="bg" cx="36" cy="36" r="${R}"/>
    <circle class="fg" id="syArc" cx="36" cy="36" r="${R}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    <text x="36" y="41" id="syLeft">${s == null ? '' : mmss(s)}</text></svg>`;
};

const runningHtml = (st) => {
  let hero;
  if (st.phase === 'code') {
    hero = `<div class="sy-hero"><div class="sy-ht"><b>Code de votre application d'authentification</b>
      <span>Trade Republic demande le code à 6 chiffres que vous donne votre application d'authentification.</span>
      <form id="syCode" class="sy-code" autocomplete="off"><input class="inp" name="code" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8"
        autocomplete="one-time-code" aria-label="Code à 6 chiffres" required><button class="btn p" type="submit">Valider</button></form></div></div>`;
  } else if (st.phase === 'verify') {
    hero = `<div class="sy-hero quiet"><i class="sy-spin big" aria-hidden="true"></i><div class="sy-ht"><b>Code envoyé</b><span>Trade Republic le vérifie.</span></div></div>`;
  } else if (st.phase === 'confirm' || st.phase === 'starting') {
    hero = `<div class="sy-hero">${ring(st)}<div class="sy-ht"><b>Ouvrez l'app Trade Republic sur votre téléphone</b>
      <span>Une demande de connexion vient d'y arriver : validez-la. LUMIO continue tout seul ensuite.</span></div></div>`;
  } else {
    hero = `<div class="sy-hero quiet"><span class="sy-big">${L.icon('check')}</span><div class="sy-ht"><b>Connexion confirmée</b>
      <span>Vous pouvez fermer cette feuille : la mise à jour continue sur le PC.</span></div></div>`;
  }
  return `${hero}${stepsHtml(st)}<button class="btn g sm sy-cancel" data-sy="cancel">Annuler la mise à jour</button>`;
};

const doneHtml = (st) => {
  const r = st.report || {};
  const parts = [r.positions != null && `${r.positions} ligne${r.positions > 1 ? 's' : ''}`, r.quotes != null && `${r.quotes} cours`,
    r.histories != null && `${r.histories} historique${r.histories > 1 ? 's' : ''}`].filter(Boolean);
  return `<div class="sy-hero ok"><span class="sy-big">${L.icon('check')}</span><div class="sy-ht">
      <b>${st.partial ? 'Portefeuille et opérations à jour' : 'Chiffres à jour'}</b><span>${parts.join(', ')}${st.ended ? (parts.length ? ', ' : '') + when(st.ended) : ''}</span></div></div>
    ${st.partial ? '<div class="callout warn sy-gap">Quelques cours ou historiques n\'ont pas répondu : ces lignes gardent leurs derniers cours. Relancez plus tard pour compléter.</div>' : ''}
    ${r.incidents && !st.partial ? `<p class="note sy-gap">${r.incidents} incident${r.incidents > 1 ? 's' : ''} sans effet sur vos chiffres (détail dans data\\tr\\sync.json).</p>` : ''}
    <button class="btn p sy-go" data-close>Voir mes chiffres</button>
    <button class="btn g sm sy-again" data-sy="form">Relancer une mise à jour</button>`;
};

const idleHtml = (st) => {
  let html = '';
  if (st.phase === 'error') {
    html += `<div class="err-box" role="alert"><span>${L.esc(st.message || 'La mise à jour a échoué.')}${st.detail ? `<span class="sy-detail">${L.esc(st.detail)}</span>` : ''}</span></div>`;
  } else if (st.phase === 'cancelling') html += '<p class="note">Annulation…</p>';
  else if (st.message) html += `<p class="note">${L.esc(st.message)}</p>`;
  html += st.last && st.last.ts ? `<p class="sy-last">${L.icon('clock')}Dernière mise à jour ${when(st.last.ts)}</p>`
    : '<p class="sy-last">Aucune mise à jour Trade Republic pour l\'instant.</p>';
  const askPhone = !st.phone || S.editPhone;
  return html + `<form id="syGo" class="sy-form" autocomplete="off" novalidate>
      ${askPhone ? `<label>Numéro Trade Republic<input class="inp" name="phone" type="tel" inputmode="tel" placeholder="+33 6 12 34 56 78" autocomplete="tel" required></label>
        <label class="chk"><input type="checkbox" name="remember" checked> Retenir ce numéro dans LUMIO</label>`
      : `<div class="sy-ph"><span>Numéro</span><b>${L.esc(st.phone)}</b><button type="button" class="lnk" data-sy="phone">Modifier</button></div>`}
      <label>Code PIN Trade Republic<input class="inp sy-pin" name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" required aria-describedby="syPinN"></label>
      <p class="note" id="syPinN">Pour cette connexion seulement : LUMIO ne l'enregistre nulle part.</p>
      <button class="btn p sy-go" id="syGoB" type="submit"${btnOff(st) ? ' disabled' : ''}>${btnTxt(st)}</button>
      ${S.auto ? '<button type="button" class="btn g sm sy-later" data-sy="later">Plus tard</button>' : ''}
    </form>
    <ol class="sy-how"><li>LUMIO se connecte à Trade Republic avec votre numéro et ce PIN.</li><li>Vous validez la demande dans l'app Trade Republic, sur votre téléphone.</li></ol>
    <p class="note">Lecture seule : LUMIO ne peut passer aucun ordre.</p>`;
};
const btnOff = st => st.wait_s > 0 || st.phase === 'cancelling';
const btnTxt = st => `${L.icon('refresh')}${st.wait_s > 0 ? `Patientez ${st.wait_s > 90 ? Math.ceil(st.wait_s / 60) + ' min' : st.wait_s + ' s'}` : st.phase === 'error' ? 'Réessayer' : 'Mettre à jour maintenant'}`;

const body = (st) => {
  if (st.demo) return '<p class="note">Mode démo : les chiffres sont simulés, il n\'y a rien à mettre à jour.</p>';
  if (st.running) return runningHtml(st);
  // Résultat affiché un quart d'heure ; ensuite, la feuille repart de « Mettre à jour maintenant »
  if (!S.form && st.phase === 'done' && st.ended && Date.now() / 1000 - S.skew - st.ended < 900) return doneHtml(st);
  return idleHtml(st);
};

const paint = (force) => {
  paintBtn();
  if (!sheetOpen()) return;
  const b = pane(); const st = S.st; if (!b || !st) return;
  const fresh = !S.form && st.phase === 'done' && st.ended && Date.now() / 1000 - S.skew - st.ended < 900;
  // Le délai d'attente ne redessine pas le formulaire : il ne change que le bouton (saisie préservée)
  const key = [st.phase, fresh, st.ready, st.phone, S.editPhone, st.message, st.detail, st.demo, st.partial].join('|');
  if (force || key !== S.key) {
    S.key = key;
    const f0 = b.querySelector('#syGo'), keep = f0 ? { phone: f0.phone && f0.phone.value, pin: f0.pin && f0.pin.value } : null;
    b.innerHTML = body(st);
    const f1 = b.querySelector('#syGo');
    if (f1 && keep) { if (f1.phone && keep.phone) f1.phone.value = keep.phone; if (keep.pin) f1.pin.value = keep.pin; }
    if (f1) setTimeout(() => { const x = f1.phone && !f1.phone.value ? f1.phone : f1.pin; if (x && sheetOpen()) x.focus(); }, 80);
    const code = b.querySelector('#syCode input'); if (code) setTimeout(() => code.focus(), 80);
    return;
  }
  const gb = document.getElementById('syGoB'); if (gb) { gb.disabled = btnOff(st); gb.innerHTML = btnTxt(st); }
  const bar = document.getElementById('syBar'); if (bar) bar.style.width = pct(st) + '%';
  const prog = document.getElementById('syProg'); if (prog) prog.setAttribute('aria-valuenow', st.done || 0);
  const p = document.getElementById('syPct'); if (p && st.total) p.textContent = `${st.done || 0} sur ${st.total}`;
};

const tickClock = () => {
  if (!sheetOpen()) return;
  const s = left(S.st); if (s == null) return;
  const arc = document.getElementById('syArc'), t = document.getElementById('syLeft');
  if (arc) arc.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.min(1, s / FULL_S))).toFixed(1));
  if (t) t.textContent = mmss(s);
};

const finished = (st) => {
  if (st.phase === 'done') {
    const msg = st.partial ? 'Portefeuille et opérations à jour' : 'Chiffres à jour';
    if (!sheetOpen()) L.toast(msg); else L.live(msg);
    if (L.reloadAll) L.reloadAll();
  } else if (st.phase === 'error') {
    if (!sheetOpen()) L.toast(st.message || 'La mise à jour a échoué', true); else L.live(st.message || 'La mise à jour a échoué');
  }
};

/* Suivi : une lecture par seconde tant que la mise à jour tourne (ou qu'un délai est affiché) */
const watch = () => {
  if (!S.clock) S.clock = setInterval(tickClock, 1000);
  if (S.poll) return;
  S.poll = setInterval(async () => {
    let st;
    try { st = await load(); } catch (e) { return; }      // serveur occupé ou en redémarrage : prochaine seconde
    const was = S.running; S.running = busy(st);
    paint();
    if (was && !S.running) finished(st);
    if (!busy(st) && !(sheetOpen() && st.wait_s > 0)) {
      clearInterval(S.poll); S.poll = null; clearInterval(S.clock); S.clock = null;
    }
  }, 1000);
};

const open = async (auto) => {
  if (L.statique) { if (L.relais) L.relais.open(); return; }      // version en ligne : demande au PC par GitHub
  const d = L.drawer.open('sync', { title: auto === true ? 'Mettre à jour vos chiffres ?' : 'Actualiser', sub: 'Trade Republic, veille et analyse', narrow: true,
    html: `<h3 class="ac-h">${L.icon('wallet')}Trade Republic</h3><div id="syPane">${L.skel(180)}</div><section class="rf" id="rfPane" aria-label="Veille et analyse"></section>` });
  if (L.refresh) L.refresh.mount(d.querySelector('#rfPane'));
  S.auto = auto === true;
  S.key = '';
  L.on(d, 'submit', '#syGo', async (e, f) => {
    e.preventDefault();
    const pin = (f.pin.value || '').trim();
    if (!/^\d{4,8}$/.test(pin)) { L.toast('Saisissez votre code PIN Trade Republic (4 chiffres)', true); f.pin.focus(); return; }
    const body = { pin };
    if (f.phone) {
      const ph = (f.phone.value || '').trim();
      if (!ph) { L.toast('Saisissez votre numéro Trade Republic', true); f.phone.focus(); return; }
      body.phone = ph; body.remember_phone = !!(f.remember && f.remember.checked);
    }
    const go = f.querySelector('button[type=submit]'); go.disabled = true;
    try {
      S.st = await L.api('/api/sync/start', { method: 'POST', body });
      f.pin.value = '';
      S.skew = Date.now() / 1000 - S.st.now; S.running = true; S.editPhone = false; S.form = false;
      paint(true); watch();
    } catch (err) {
      f.pin.value = '';
      L.toast(err.message, true);
      try { await load(); } catch (x) { /* hors ligne */ }
      paint(true); if (S.st && S.st.wait_s > 0) watch();
    }
  });
  L.on(d, 'click', '[data-sy]', async (e, b) => {
    if (b.dataset.sy === 'phone') { S.editPhone = true; paint(true); return; }
    if (b.dataset.sy === 'later') { try { localStorage.setItem('lumio.' + SNOOZE, String(Date.now() + STALE_S * 1000)); } catch (x) { /* stockage indisponible */ } L.drawer.close(); return; }
    if (b.dataset.sy === 'form') { S.form = true; paint(true); if (S.st && S.st.wait_s > 0) watch(); return; }
    if (b.dataset.sy === 'cancel') {
      b.disabled = true;
      try { S.st = await L.api('/api/sync/cancel', { method: 'POST' }); } catch (err) { L.toast(err.message, true); }
      paint(true); watch();
    }
  });
  L.on(d, 'submit', '#syCode', async (e, f) => {
    e.preventDefault();
    const v = (f.code.value || '').trim();
    if (!/^\d{4,8}$/.test(v)) { L.toast('Code attendu : 4 à 8 chiffres', true); return; }
    const go = f.querySelector('button'); go.disabled = true;
    try { S.st = await L.api('/api/sync/code', { method: 'POST', body: { code: v } }); paint(true); }
    catch (err) { L.toast(err.message, true); go.disabled = false; }
  });
  try { await load(); } catch (e) { const b = pane(); if (b) b.innerHTML = L.errBox(e); return; }
  S.running = busy(S.st);
  paint(true);
  if (busy(S.st) || S.st.wait_s > 0) watch();
};

/* À l'ouverture de LUMIO : chiffres de plus de 6 heures -> la feuille s'ouvre et demande le PIN
   (une fois par visite ; « Plus tard » la fait patienter 6 heures) */
const stale = st => !st.demo && !st.running && (!st.last || !st.last.ts || Date.now() / 1000 - S.skew - st.last.ts > STALE_S);
const init = async () => {
  try { await load(); } catch (e) { return; }
  S.running = busy(S.st);
  paintBtn();
  if (S.running) { watch(); return; }
  let snooze = 0, seen = false;
  try { snooze = +localStorage.getItem('lumio.' + SNOOZE) || 0; seen = sessionStorage.getItem('lumio.sync.asked') === '1'; } catch (e) { /* stockage indisponible */ }
  if (stale(S.st) && !seen && Date.now() > snooze && !L.drawer.current) {
    try { sessionStorage.setItem('lumio.sync.asked', '1'); } catch (e) { /* idem */ }
    open(true);
  }
};

L.sync = { open, init, get state() { return S.st; } };
if (btn) btn.onclick = open;
document.addEventListener('click', (e) => { const b = e.target.closest('[data-syncopen]'); if (b) { e.preventDefault(); open(); } });
})();
