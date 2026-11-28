/* LUMIO en ligne (GitHub Pages) : copie en lecture seule, publiée par le PC.
   Les données arrivent chiffrées (AES-256-GCM) ; la clé est tirée du mot de passe sur cet appareil
   (PBKDF2-SHA256), jamais envoyée nulle part. Les appels /api/… de l'interface sont servis depuis
   ces données ; toute écriture répond « lecture seule ». Chargé avant core.js, seulement dans la
   version publiée.
   9.0 : LUMIO autonome (core/nuage.py) refait LUMIO Simple toutes les dix minutes, sans le PC, et le
   publie dans un morceau à part (donnees/nuage.bin, repère « nuage » de meta.json). Ses écrans passent
   avant ceux de la copie du PC ; le reste (version complète) reste la copie du PC. */
(function () {
'use strict';
const realFetch = window.fetch.bind(window);
const RO = 'En ligne, LUMIO est en lecture seule : faites-le sur le PC.';
const MISSING = "Absent de la version en ligne : à consulter sur le PC.";
const enc = new TextEncoder();
/* Version de l'interface chargée (?v=… de ce script) : comparée à celle de chaque publication */
const PAGE_BUILD = (() => {
  const s = document.currentScript;
  const m = s && /[?&]v=([^&#]+)/.exec(s.getAttribute('src') || '');
  return m ? decodeURIComponent(m[1]) : null;
})();
let unlock;
const S = window.LUMIO_STATIC = { on: true, asof: null, version: null, ready: new Promise(r => { unlock = r; }) };
document.documentElement.classList.add('statique');

/* Clé d'une réponse : chemin décodé + paramètres triés (même calcul que core/pages.py) */
const canon = (u) => {
  const x = new URL(u, 'https://lumio.invalid');
  const q = [...x.searchParams.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  let p = x.pathname; try { p = decodeURIComponent(p); } catch (e) { /* garde la forme encodée */ }
  return p + (q.length ? '?' + q.map(([k, v]) => k + '=' + v).join('&') : '');
};
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ── Mémoire de la clé sur cet appareil (IndexedDB, clé non exportable) ── */
const idb = (mode, fn) => new Promise((res, rej) => {
  let rq; try { rq = indexedDB.open('lumio-en-ligne', 1); } catch (e) { rej(e); return; }
  rq.onupgradeneeded = () => rq.result.createObjectStore('k');
  rq.onerror = () => rej(rq.error);
  rq.onsuccess = () => {
    const db = rq.result; let r;
    try { const tx = db.transaction('k', mode); r = fn(tx.objectStore('k')); tx.oncomplete = () => { db.close(); res(r && r.result); }; tx.onerror = () => { db.close(); rej(tx.error); }; }
    catch (e) { db.close(); rej(e); }
  };
});
const keyGet = () => idb('readonly', st => st.get('main')).catch(() => null);
const keyPut = v => idb('readwrite', st => st.put(v, 'main')).catch(() => null);
const keyDel = () => idb('readwrite', st => st.delete('main')).catch(() => null);

/* ── Déchiffrement (et chiffrement des demandes envoyées au PC, voir plus bas) ── */
const derive = async (pw, kdf) => {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(kdf.salt), iterations: kdf.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
const openBlob = async (key, name, buf) => {
  const u = new Uint8Array(buf);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12), additionalData: enc.encode('lumio:' + name) }, key, u.slice(12));
  const txt = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(txt);
};
const getFile = async (path) => {
  const r = await realFetch(path, { cache: 'no-store' });
  if (!r.ok) { const e = new Error(r.status === 404 ? 'absent' : 'Erreur ' + r.status); e.status = r.status; throw e; }
  return r;
};
let META = null, KEY = null, CORE = null, NUAGE = null;
const chunks = new Map();
const loadMeta = async () => (await getFile('donnees/meta.json?t=' + Date.now())).json();
const loadCore = async (key, meta) => openBlob(key, 'coeur', await (await getFile('donnees/coeur.bin?s=' + meta.stamp)).arrayBuffer());
/* Morceau du nuage : absent ou illisible, la copie du PC sert seule (jamais une erreur pour la page) */
const nuStamp = m => (m && m.nuage && m.nuage.stamp) || null;
const loadNuage = async (key, meta) => {
  if (!nuStamp(meta)) return null;
  try {
    const n = await openBlob(key, 'nuage', await (await getFile('donnees/nuage.bin?s=' + nuStamp(meta))).arrayBuffer());
    return n && n.routes ? n : null;
  } catch (e) { return null; }
};
const loadChunk = name => {
  if (!chunks.has(name)) {
    const p = getFile(`donnees/${name}.bin?s=${META.stamp}`).then(r => r.arrayBuffer()).then(b => openBlob(KEY, name, b));
    p.catch(() => chunks.delete(name));
    chunks.set(name, p);
  }
  return chunks.get(name);
};
const lookup = async (k) => {
  if (NUAGE && k in NUAGE.routes) return NUAGE.routes[k];
  if (k in CORE.routes) return CORE.routes[k];
  const name = CORE.index[k];
  if (name) { const c = await loadChunk(name); return c.routes[k]; }
  if (k.startsWith('/api/portfolio/at')) return { available: false };
  return undefined;
};

/* ── Les appels de l'interface : servis depuis les données publiées ── */
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (!(url.startsWith('/api/') || url.startsWith('/auth/'))) return realFetch(input, init);
  const method = ((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
  if (method !== 'GET' || url.startsWith('/auth/')) return json({ error: RO, readonly: true }, 403);
  await S.ready;
  try {
    const v = await lookup(canon(url));
    return v === undefined ? json({ error: MISSING }, 404) : json(v);
  } catch (e) { return json({ error: 'Données en ligne illisibles : rechargez la page.' }, 500); }
};

/* ── Écran de mot de passe ── */
const box = document.createElement('div');
box.className = 'lock'; box.id = 'lock';
box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'lockT');
box.innerHTML = `<form class="lock-f" id="lockF" novalidate>
  <img src="static/icon.svg" alt="" width="52" height="52">
  <h1 id="lockT">LUMIO</h1>
  <p class="lock-s">Version en ligne, en lecture seule</p>
  <label class="fld" for="lockP"><span>Mot de passe</span><input class="inp" id="lockP" name="password" type="password" autocomplete="current-password" required></label>
  <label class="chk"><input type="checkbox" id="lockR" checked> Rester connecté sur cet appareil</label>
  <button class="btn p" type="submit" id="lockB">Ouvrir</button>
  <p class="lock-e" id="lockE" role="alert" hidden></p>
  <p class="lock-n">Vos données sont chiffrées sur votre PC avant d'être publiées : elles ne s'ouvrent qu'avec ce mot de passe, sur cet appareil.</p>
</form>`;
const say = (t) => { const e = box.querySelector('#lockE'); e.textContent = t || ''; e.hidden = !t; };
const show = () => { if (!box.isConnected) document.body.appendChild(box); document.documentElement.classList.add('locked'); setTimeout(() => { const i = box.querySelector('#lockP'); if (i) i.focus(); }, 60); };
const hide = () => { document.documentElement.classList.remove('locked'); box.remove(); };
/* Nouvelle interface publiée (LUMIO mis à jour sur le PC) : la page se recharge une fois, si la clé
   est gardée sur cet appareil ; sinon seules les données changent, l'interface au prochain lancement */
const reloadFor = async (build) => {
  let done = null;
  try { done = sessionStorage.getItem('lumio.build'); } catch (e) { /* stockage indisponible */ }
  if (done === build) return false;
  const saved = await keyGet();
  if (!saved || !saved.key) return false;
  try { sessionStorage.setItem('lumio.build', build); } catch (e) { /* idem */ }
  location.replace(location.pathname + '?b=' + encodeURIComponent(build) + location.hash);
  return true;
};
const newer = core => !!(core && core.build && PAGE_BUILD && core.build !== PAGE_BUILD);
/* Ce que la page sait du nuage : heure de son dernier passage, cadence, socle du PC lu ou non */
const nuInfo = n => (n ? { asof: n.asof, build: n.build || null, socle: !!n.socle } : null);
const sansNuage = m => { const c = Object.assign({}, m); delete c.nuage; return c; };     // morceau illisible : redemandé au contrôle suivant
const opened = (key, meta, core, nuage) => {
  KEY = key; META = nuage ? meta : sansNuage(meta); CORE = core; NUAGE = nuage || null; chunks.clear();
  S.asof = core.asof; S.version = core.version; S.build = core.build || null; S.demo = !!core.demo; S.lines = core.lines;
  S.relais = core.relais || null; S.trTs = core.tr_ts || null; S.nuage = nuInfo(NUAGE);
  if (newer(core)) reloadFor(core.build);
  hide(); unlock();
  document.dispatchEvent(new CustomEvent('lumio:static'));
};
box.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = box.querySelector('#lockP').value;
  if (!pw) { say('Saisissez le mot de passe.'); return; }
  const btn = box.querySelector('#lockB'); btn.disabled = true; btn.textContent = 'Ouverture…'; say('');
  try {
    if (!META) META = await loadMeta();
    const key = await derive(pw, META.kdf);
    let core;
    try { core = await loadCore(key, META); } catch (err) { if (err && err.name === 'OperationError') { say('Mot de passe incorrect.'); return; } throw err; }
    if (box.querySelector('#lockR').checked) await keyPut({ salt: META.kdf.salt, key });
    opened(key, META, core, await loadNuage(key, META));
  } catch (err) {
    say(err && err.status === 404 ? "Rien n'est encore publié : lancez « Publier » dans Réglages, sur le PC." : 'Ouverture impossible : vérifiez la connexion, puis réessayez.');
  } finally { btn.disabled = false; btn.textContent = 'Ouvrir'; }
});

/* Verrouiller cet appareil : la clé gardée est effacée */
S.lock = async () => {
  await keyDel();
  try { Object.keys(localStorage).filter(k => k.startsWith('lumio.snap:')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* stockage indisponible */ }
  location.reload();
};

/* Nouvelle publication pendant que la page est ouverte : rechargée en place */
let checking = false;
S.check = async () => {
  if (checking || !KEY || document.hidden) return;
  checking = true;
  try {
    const m = await loadMeta();
    const pc = m.stamp !== META.stamp;                      // nouvelle copie du PC (ou reprise par le nuage)
    if (!pc && nuStamp(m) === nuStamp(META)) return;
    if (m.kdf.salt !== META.kdf.salt) { await keyDel(); location.reload(); return; }     // mot de passe changé
    let core = CORE;
    if (pc) {
      core = await loadCore(KEY, m);
      if (newer(core) && await reloadFor(core.build)) return;
    }
    const nuage = await loadNuage(KEY, m);
    if (!pc && nuStamp(m) && !nuage) return;                // morceau du nuage pas encore servi : au contrôle suivant
    META = nuage ? m : sansNuage(m); CORE = core; NUAGE = nuage; if (pc) chunks.clear();
    S.asof = core.asof; S.build = core.build || null;
    S.relais = core.relais || null; S.trTs = core.tr_ts || null; S.nuage = nuInfo(NUAGE);
    document.dispatchEvent(new CustomEvent('lumio:static'));
    if (pc && window.L && window.L.reloadAll) window.L.reloadAll();
  } catch (e) { /* hors ligne : on garde la copie déjà ouverte */ } finally { checking = false; }
};
/* Le repère (quelques octets) est relu toutes les 5 minutes ; chaque minute quand le nuage tient la page à jour */
let tic = 0;
setInterval(() => { tic += 1; if (NUAGE || tic % 5 === 0) S.check(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) S.check(); });

/* ── Demandes au PC (relais GitHub, core/relais.py) : chiffrées avec la clé de cet appareil ──
   Une clé gardée avant LUMIO 7.8 ne sert qu'à lire : le mot de passe est redemandé une fois. */
const hex = u => [...u].map(x => x.toString(16).padStart(2, '0')).join('');
S.canSeal = () => !!(KEY && KEY.usages && KEY.usages.includes('encrypt'));
S.rekey = async (pw) => {
  const key = await derive(pw, META.kdf);
  await loadCore(key, META);                       // mot de passe faux : OperationError
  KEY = key;
  const saved = await keyGet();
  if (saved && saved.key) await keyPut({ salt: META.kdf.salt, key });
  return true;
};
S.request = async (t, extra) => {
  if (!S.canSeal()) { const e = new Error('Mot de passe à saisir une fois pour envoyer une demande.'); e.code = 'cle'; throw e; }
  const obj = Object.assign({ v: 1, t, ts: Date.now() / 1000, n: hex(crypto.getRandomValues(new Uint8Array(16))) }, extra || {});
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('lumio:demande') }, KEY, enc.encode(JSON.stringify(obj))));
  const all = new Uint8Array(iv.length + ct.length); all.set(iv); all.set(ct, iv.length);
  let bin = ''; all.forEach(x => { bin += String.fromCharCode(x); });
  return 'lumio-demande:v1:' + btoa(bin);
};
/* Demande envoyée : la copie publiée est relue toutes les 20 s pendant un quart d'heure */
let fast = 0, fastEnd = 0;
S.expect = () => {
  fastEnd = Date.now() + 15 * 60000;
  if (!fast) fast = setInterval(() => { if (Date.now() > fastEnd) { clearInterval(fast); fast = 0; return; } S.check(); }, 20000);
};

/* ── Démarrage : clé gardée sur cet appareil, sinon le mot de passe ── */
(async () => {
  if (!window.crypto || !crypto.subtle || typeof DecompressionStream === 'undefined') {
    show(); say('Navigateur trop ancien pour ouvrir LUMIO en ligne : mettez-le à jour.');
    box.querySelector('#lockB').disabled = true; return;
  }
  try { META = await loadMeta(); } catch (e) { show(); if (e.status === 404) say("Rien n'est encore publié : lancez « Publier » dans Réglages, sur le PC."); return; }
  const saved = await keyGet();
  if (saved && saved.key && saved.salt === META.kdf.salt) {
    try { const core = await loadCore(saved.key, META); opened(saved.key, META, core, await loadNuage(saved.key, META)); return; } catch (e) { await keyDel(); }
  }
  show();
})();
})();
