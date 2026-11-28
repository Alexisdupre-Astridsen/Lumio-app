/* LUMIO Simple (9.0) — trois onglets, scénarios, comptes, faits marquants et leurs suites, bas et haut à un an.
   Portefeuille : toutes vos lignes, leur évolution (jour, mois, un an, depuis l'achat) et leur prévision
   (écart habituel de la prochaine séance, puis médianes à un mois, un an, cinq ans), en % ou en euros ;
   « En bref », scénarios (deux prévisions quand un événement peut tout changer), répartition par thème,
   alerte marché (grisée quand la page n'est plus à jour), ce qu'il ne faut pas manquer ; une ligne
   s'ouvre sur le pourquoi, les comptes de la société et ses faits marquants sur 90 jours.
   Opportunités : sociétés à étudier, hors vos lignes, classées par le rendement médian estimé (à un an
   ou à cinq ans) et montrées seulement au-dessus du marché mondial, avec volatilité et risque de perte.
   Journal (discret) : activité, évolution du portefeuille, prévisions passées contre la réalité, leçons,
   réglages appris et leur progrès.
   Sur le PC, « Actualiser » relit cours et actualités ; en ligne, la demande part au PC par un ticket
   GitHub chiffré (statique.js). LUMIO ne passe aucun ordre et ne dit pas quoi faire.
   Les calculs purs (formats, scénarios, risque) sont exposés dans LUMIO_SIMPLE.calc pour les tests. */
(function () {
'use strict';
const ST = window.LUMIO_STATIC || null;          // version en ligne (GitHub Pages), lecture seule
const $ = s => document.querySelector(s);
const NB = ' ', MI = '−';
const TABS = ['portefeuille', 'opportunites', 'journal'];
let stockOK = true;                              // faux dès qu'une écriture échoue : dit une seule fois
// Lecture d'un choix enregistré : une valeur absente, illisible ou d'une forme inattendue rend la valeur par défaut
function store(k, def, ok) { try { const v = localStorage.getItem('lumio.' + k); if (v === null) return def; const x = JSON.parse(v); return !ok || ok(x) ? x : def; } catch (e) { return def; } }
function keep(k, v) {
  try { localStorage.setItem('lumio.' + k, JSON.stringify(v)); }
  catch (e) { if (stockOK) { stockOK = false; setTimeout(() => toast('Vos choix ne seront pas gardés sur cet appareil : stockage indisponible.'), 0); } }
}
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const S = { d: null, unit: store('simple.unit', 'pct', v => v === 'pct' || v === 'eur'), vue: store('simple.vue', 'ev', v => v === 'ev' || v === 'pv'),
  sort: store('simple.sort', ['value', -1], v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && (v[1] === 1 || v[1] === -1)),
  open: null, opener: null, busy: false, iaT: 0, sync: null, tab: 'portefeuille',
  scen: store('simple.scen', {}, v => isObj(v) && Object.values(v).every(x => typeof x === 'string')),
  ohz: store('simple.ohz', 'an', v => v === 'an' || v === 'cinq'),
  vus: store('simple.vus', {}, isObj), vuDirty: false,           // alertes durables déjà lues (fiche ouverte)
  det: store('simple.det', {}, isObj),                           // volets ouverts ou fermés
  hist: false, skipPop: false,
  opp: null, oppT: 0, jou: null };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const grp = (x, d) => { const s = Math.abs(x).toFixed(d).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.join(','); };
const num = (x, d = 0) => x == null || isNaN(x) ? '—' : (x < 0 && +Math.abs(x).toFixed(d) !== 0 ? MI : '') + grp(x, d);
const sgn = (x, d = 0) => x == null || isNaN(x) ? '—' : (+Math.abs(x).toFixed(d) === 0 ? '' : x > 0 ? '+' : MI) + grp(x, d);
const eur = (x, d = 0) => x == null || isNaN(x) ? '—' : num(x, d) + NB + '€';
const eurS = (x, d = 0) => x == null || isNaN(x) ? '—' : sgn(x, d) + NB + '€';
const pct = (x, d = 1) => x == null || isNaN(x) ? '—' : sgn(x, d) + NB + '%';
const fr = (f, d = 1) => f == null || isNaN(f) ? '—' : pct(f * 100, d);              // fraction -> %
const pm = (f, d = 1) => f == null || isNaN(f) ? '—' : '±' + grp(f * 100, d) + NB + '%';
// Écart entre deux pourcentages, en toutes lettres : « +1,3 point », « −2,0 points »
const pts = (x, d = 1) => x == null || isNaN(x) ? '—' : sgn(x, d) + NB + 'point' + (Math.abs(+x.toFixed(d)) >= 2 ? 's' : '');
const cls = x => x == null || isNaN(x) || Math.abs(x) < 1e-9 ? '' : x > 0 ? 'up' : 'dn';
const clsD = (x, d) => x == null || isNaN(x) ? '' : cls(+x.toFixed(d));                 // selon le chiffre affiché
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const heure = t => { const d = new Date(t * 1000); return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`; };
const when = t => { if (!t) return '—'; const d = new Date(t * 1000), n = new Date();
  return d.toDateString() === n.toDateString() ? `aujourd'hui à ${heure(t)}` : `le ${d.getDate()} ${MOIS[d.getMonth()]} à ${heure(t)}`; };
const jour = t => { if (!t) return '—'; const d = new Date(t * 1000); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
/* Heure de ce qui est affiché en ligne : celle du dernier passage du nuage (9.0, sans le PC) quand LUMIO Simple
   vient de lui, sinon celle de la copie publiée par le PC */
const asofPub = () => (ST && S.d && S.d.nuage && S.d.asof) || (ST && ST.asof) || null;
const asofRef = () => asofPub() || (S.d && S.d.asof) || Date.now() / 1000;
// Cours ancien : dernière cotation plus de 30 h avant le relevé de la page, un jour de semaine (Yahoo muet, place fermée…)
const vieux = (t, ref) => { if (!t) return false; const r = ref || Date.now() / 1000, h = (r - t) / 3600, wd = new Date(r * 1000).getDay(); return h > (wd === 1 ? 78 : wd === 0 || wd === 6 ? 999 : 30); };
// Minutes de séance (lundi au vendredi, de 9 h à 22 h à l'heure de l'appareil) écoulées depuis t :
// au-delà de 90, une page qui n'a pas été recalculée ne peut plus dire « Marchés calmes ».
const seanceDepuis = t => { if (!t) return 0; let m = 0; const end = Date.now(); for (let x = t * 1000; x < end && m < 600; x += 900000) { const d = new Date(x), h = d.getHours(), w = d.getDay(); if (w > 0 && w < 6 && h >= 9 && h < 22) m += 15; } return m; };
const ago = t => { if (!t) return 'jamais'; const m = Math.round((Date.now() / 1000 - t) / 60); return m < 2 ? 'à l\'instant' : m < 120 ? `il y a ${m} min` : m < 2880 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} jours`; };
const SIG = { positifs: ['f', 'Positifs'], mitiges: ['n', 'Mitigés'], negatifs: ['d', 'Négatifs'] };
const sigOf = k => SIG[k] || ['', '—'];
const HZ = [['jour', 'Jour', 'Prochaine séance'], ['mois', 'Mois', 'Dans un mois'], ['an', '1 an', 'Dans un an'], ['cinq', '5 ans', 'Dans cinq ans']];
const EV0 = [['jour', 'Jour'], ['mois', 'Mois'], ['an', '1 an'], ['debut', 'Depuis l\'achat']];
let EV = EV0;
const FULL = ST ? 'complet.html' : '/?complet=1';
const jourIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${+m[3]} ${MOIS[+m[2] - 1]}` : String(s || ''); };
const jourCourt = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}/${m[2]}` : ''; };
const lien = a => a && a.url && /^https:\/\//.test(a.url) ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.source || 'source')}</a>` : esc((a && a.source) || '');
const plur = (n, s = 's') => n > 1 ? s : '';
const illisible = () => { const e = new Error('Réponse illisible'); e.illisible = true; return e; };

/* ── Scénarios : deux prévisions quand un événement peut tout changer ── */
const scenEvs = () => { const a = (S.d && S.d.scenarios && S.d.scenarios.evenements) || [], b = (S.opp && S.opp.scenarios) || [];
  return a.concat(b.filter(e => !a.some(x => x.id === e.id))); };
const scenEv = id => scenEvs().find(e => e.id === id);
const scenCur = ev => { const c = S.scen[ev.id]; return c && (ev.cas || []).some(x => x.id === c) ? c : ''; };   // issue retenue, si elle existe encore
function scenClean() {                   // un choix enregistré dont l'issue n'existe plus est oublié
  let ch = false;
  scenEvs().forEach(e => { if (S.scen[e.id] && !scenCur(e)) { delete S.scen[e.id]; ch = true; } });
  if (ch) keep('simple.scen', S.scen);
}
function scenF(x, skip) {                // multiplicateurs du choix courant (sauf l'événement « skip »)
  const f = { an: 1, cinq: 1 };
  (x.scen || []).forEach(s => { const c = s.ev !== skip && S.scen[s.ev]; if (c && s.f[c]) { f.an *= s.f[c].an; f.cinq *= s.f[c].cinq; } });
  return f;
}
function hx(x, val) {                    // prévision de la ligne ou de la société selon les scénarios choisis
  const h = x.prev.h, f = scenF(x);
  if (f.an === 1 && f.cinq === 1) return h;
  const out = { ...h };
  ['an', 'cinq'].forEach(k => { const o = { ...h[k] }, m = f[k];
    ['c', 'moy', 'esp', 'bas', 'haut'].forEach(q => { if (o[q] != null) o[q] = (1 + o[q]) * m - 1; });
    if (val != null) o.eur = val * o.c; out[k] = o; });
  return out;
}
const hL = l => hx(l, l.value);
// Bas et haut à un an (8.7) : la fourchette du modèle (une chance sur six de finir plus bas, une sur six plus haut),
// suivant les scénarios choisis, ou le chiffre écrit à la main. La cause vient du fichier des bornes ; à défaut,
// des deux issues du scénario non choisi qui pèse le plus sur la ligne. Une cause échue n'est plus appliquée.
function bhScen(l) {
  let best = null;
  (l.scen || []).forEach(s => { const e = scenEv(s.ev); if (!e || S.scen[s.ev] || !s.f || (e.cas || []).length !== 2) return;
    const [a, b] = e.cas, fa = s.f[a.id] && s.f[a.id].an, fb = s.f[b.id] && s.f[b.id].an; if (!fa || !fb) return;
    const w = Math.abs(Math.log(fa / fb)); if (w < .02) return;
    if (!best || w > best.w) best = { w, e, lo: fa < fb ? a : b, hi: fa < fb ? b : a }; });
  if (!best) return null;
  const t = c => ({ court: `${c.nom.charAt(0).toLowerCase()}${c.nom.slice(1)}`, si: `si l'issue « ${c.nom} » l'emporte (scénario « ${best.e.titre} »)`, auto: 1 });
  return { bas: t(best.lo), haut: t(best.hi), titre: best.e.titre };
}
function bh(l) {
  const a = (hL(l) || {}).an || {}, b = l.bornes && !l.bornes.echue ? l.bornes : {}, sc = bhScen(l);
  // La cause : celle écrite à la main, sinon les deux issues du scénario de référence qui pèse sur la ligne, sinon (9.0)
  // les deux scénarios écrits automatiquement
  const one = k => { const x = b[k] || {}, main = x.pct != null, v = main ? x.pct : a[k], c = x.court && !(b.auto && sc && sc[k]) ? x : sc && sc[k];
    return { v, main, modele: a[k], eur: v == null || l.value == null ? null : l.value * v, court: c ? c.court : '', si: c ? c.si : '', auto: !!(c && c.auto) }; };
  const o = { bas: one('bas'), haut: one('haut'), titre: null };
  if (o.bas.auto && o.haut.auto) o.titre = sc.titre;                 // les deux issues d'un même scénario : son nom une fois
  else ['bas', 'haut'].forEach(k => { if (o[k].auto) o[k].court = `${sc.titre} : ${o[k].court}`; });
  return o;
}
const scKey = (evs, ch) => evs.map(e => `${e.id}:${(ch || S.scen)[e.id] || ''}`).join('|');
function scTot(d, ch) { const sc = d && d.scenarios; return sc && sc.totaux ? sc.totaux[scKey(sc.evenements || [], ch)] || null : null; }
function totPrev(d) { const t = scTot(d), p = d.totaux.prev; return t ? { ...p, an: { ...p.an, ...(t.an || {}) }, cinq: { ...p.cinq, ...(t.cinq || {}) } } : p; }
function sumPv(d, k) {                   // somme des prévisions affichées des lignes (sans l'effet de la diversification)
  let e = 0, n = 0;
  (d.lignes || []).forEach(l => { const h = hL(l)[k]; if (l.value > 0 && h && h.eur != null) { e += h.eur; n += 1; } });
  return n ? { eur: e, pct: d.totaux.valeur ? e / d.totaux.valeur * 100 : null } : null;
}
function scCas(x, ev, c) {               // une issue pour cette ligne, les autres choix gardés
  const s = (x.scen || []).find(y => y.ev === ev.id), fo = scenF(x, ev.id);
  return { an: (1 + x.prev.h.an.c) * fo.an * s.f[c.id].an - 1, cinq: (1 + x.prev.h.cinq.c) * fo.cinq * s.f[c.id].cinq - 1 };
}
function scMark(x, dit) {                // ◇ deux scénarios, ◆ issue choisie ; « dit » : texte pour lecteur d'écran (une fois par ligne)
  if (!(x.scen || []).length) return '';
  const on = x.scen.some(s => S.scen[s.ev] && s.f[S.scen[s.ev]]);
  const t = x.scen.map(s => { const e = scenEv(s.ev); if (!e) return ''; const c = e.cas.find(y => y.id === S.scen[s.ev]); return `${e.titre} : ${c ? c.nom.toLowerCase() : 'deux scénarios, sans choix'}`; }).filter(Boolean).join(' ; ');
  return `<span class="sc${on ? ' on' : ''}" title="${esc(t)}"><span aria-hidden="true">${on ? '◆' : '◇'}</span>${dit ? `<span class="sr"> (${on ? 'scénario choisi' : 'deux scénarios'}) </span>` : ''}</span>`;
}
// Groupe de choix d'une issue (boutons radio : un seul arrêt de tabulation, flèches pour changer). tot : prévision du
// portefeuille entier selon le choix, affichée en petit ; g : repère du groupe quand le même événement paraît plusieurs fois.
function choixBtns(ev, tot, g) {
  const cur = scenCur(ev);
  const opt = (id, nom) => { const t = tot ? tot({ ...S.scen, [ev.id]: id || undefined }) : null; const a = t && t.an;
    const chif = a && a.pct != null ? pct(a.pct, 1) : '';
    return `<button type="button" role="radio" aria-checked="${cur === id}" tabindex="${cur === id ? 0 : -1}" data-scen="${esc(ev.id)}" data-cas="${esc(id)}" data-g="${esc(g || '')}"${chif ? ` aria-label="${esc(nom)} : portefeuille ${esc(chif)} à un an"` : ''}>${esc(nom)}${chif ? ` <small class="${clsD(a.pct, 1)}">${chif}</small>` : ''}</button>`; };
  return `<div class="ev-ch" role="radiogroup" aria-label="${esc(ev.titre)} : l'issue que vous jugez la plus probable">${ev.cas.map(c => opt(c.id, c.nom)).join('')}${opt('', 'Sans choix')}</div>`;
}
// Risque : probabilité de finir en perte sur la période (loi log-normale du modèle) ; volatilité : celle que le
// modèle retient à un an, la même que pour la fourchette
const PHI = z => { const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + .3275911 * x);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return z >= 0 ? (1 + e) / 2 : (1 - e) / 2; };
function risque(h, k) {
  const x = h && h[k], a = h && h.an; if (!x || x.c == null || x.haut == null) return null;
  const s = Math.log((1 + x.haut) / (1 + x.c)); if (!(s > 0)) return null;
  const sa = a && a.c != null && a.haut != null ? Math.log((1 + a.haut) / (1 + a.c)) : NaN;
  const v = sa > 0 ? sa : k === 'cinq' ? s / Math.sqrt(5) : s, n = v < .2 ? 1 : v < .3 ? 2 : v < .45 ? 3 : 4;
  return { n, s: v, p: PHI(-Math.log(1 + x.c) / s), label: ['', 'faible', 'modérée', 'élevée', 'très élevée'][n] };
}
// Valeur très agitée : médiane négative alors que la moyenne attendue ne l'est pas (quelques très fortes hausses la tirent)
const agite = h => !!h && h.c != null && h.esp != null && h.c < 0 && h.esp >= 0;

let toastT = 0;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, err ? 6000 : 3200); }

const lc = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
function msgErr(e) {                     // message d'une erreur pour l'écran : jamais le texte brut d'une exception JavaScript
  if (!e) return 'Erreur inconnue';
  if (e.status != null || e.lent || e.illisible) return String(e.message || '').replace(/[\s.:;]+$/, '');
  return 'Erreur inattendue de la page : rechargez-la';
}
function errTxt(msg, status) {           // message du PC en français, sans ponctuation finale (l'appelant ajoute la suite)
  const m = typeof msg === 'string' ? msg.trim().replace(/[\s.:;!]+$/, '') : '';
  if (!m || /^(not found|internal server error|method not allowed|bad request)$/i.test(m))
    return status === 404 ? 'Page introuvable sur le PC' : status >= 500 ? 'Erreur interne de LUMIO' : `Demande refusée (erreur ${status})`;
  return /^erreur interne$/i.test(m) ? 'Erreur interne de LUMIO' : m.charAt(0).toUpperCase() + m.slice(1);
}
async function api(url, opts = {}) {
  const init = { method: opts.method || 'GET', headers: { Accept: 'application/json' } };
  if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
  if (init.method !== 'GET') init.headers['X-LUMIO'] = '1';
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeout || 25000) : 0;      // pas d'attente sans fin
  if (ctl) init.signal = ctl.signal;
  let r, d, lu = true;
  try { r = await fetch(url, init); try { d = await r.json(); } catch (e) { if (e && e.name === 'AbortError') throw e; d = null; lu = false; } }
  catch (e) {
    const lent = !!e && e.name === 'AbortError';
    const er = new Error(lent ? `${ST ? 'La page' : 'Le PC'} met trop de temps à répondre` : 'Connexion impossible : réseau coupé ou PC injoignable'); er.status = 0; er.lent = lent; throw er;
  } finally { clearTimeout(timer); }
  if (r.status === 401 && isObj(d) && d.login) {           // LUMIO en ligne : session expirée, comme la version complète
    location.replace('/login' + (location.hash || ''));
    const e = new Error('Connexion requise : vous allez être redirigé vers la page de connexion'); e.status = 401; throw e;
  }
  if (!r.ok) { const e = new Error(errTxt(isObj(d) ? d.error || d.detail : null, r.status)); e.status = r.status; e.readonly = isObj(d) && d.readonly; throw e; }
  if (!lu || !isObj(d)) throw illisible();                 // réponse 200 qui n'est pas du JSON : ni texte d'exception ni faux état vide
  return d;
}

/* ── Onglets ── */
function hist(push, url) {
  try { if (push) history.pushState(null, '', url); else history.replaceState(null, '', url); } catch (e) { /* page intégrée sans historique */ }
}
function paintGo() {                     // bouton du haut : « Relire » au journal, grisé pendant le calcul de la veille
  const go = $('#go'), lab = $('#goL'); if (!go || S.busy) return;
  const calc = S.tab === 'opportunites' && !!(S.opp && S.opp.en_cours);
  go.disabled = calc; go.classList.toggle('run', calc);
  lab.textContent = calc ? 'Calcul en cours…' : S.tab === 'journal' ? 'Relire' : 'Actualiser';
}
function setTab(name, focus, push) {
  if (!TABS.includes(name)) name = 'portefeuille';
  const perime = !$('#panel').hidden && !!S.hist;  // l'entrée d'historique de la fiche ouverte est remplacée par l'onglet
  if (!$('#panel').hidden) closePanel(true);       // sans toucher à l'historique : l'onglet change
  S.tab = name;
  document.title = name === 'portefeuille' ? 'LUMIO Simple' : `${name === 'journal' ? 'Journal' : 'Opportunités'} · LUMIO Simple`;
  TABS.forEach(t => {
    const b = $(`#t-${t}`), v = $(`#v-${t}`), on = t === name;
    b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; v.hidden = !on;
  });
  if (focus) $(`#t-${name}`).focus();
  if (perime && push !== 'none') hist(false, name === 'portefeuille' ? location.pathname + location.search : '#' + name);
  else if (location.hash.slice(1) !== (name === 'portefeuille' ? '' : name) && push !== 'none') hist(!!push, name === 'portefeuille' ? location.pathname + location.search : '#' + name);
  paintGo();
  if (name === 'opportunites') loadOpp(); else if (name === 'journal') loadJou();
  paintFresh();
  window.scrollTo(0, 0);
  apres(document);
}

/* ── Chargement ── */
function recu(d) {                       // réponse de /api/simple : forme attendue, choix périmés oubliés
  if (!d.empty && (!isObj(d.totaux) || !Array.isArray(d.lignes))) throw illisible();
  S.d = d; scenClean(); vusClean();
}
async function load(silent) {
  try {
    recu(await api('/api/simple')); render();
    if (S.d.ia && S.d.ia.en_cours) pollIa();
  } catch (e) {
    if (silent) return;
    const why = e.illisible ? `La réponse reçue est illisible : rechargez la page ; si cela persiste, ${ST ? 'attendez la prochaine publication de votre PC' : 'redémarrez LUMIO sur le PC'}.`
      : ST ? (e.status === 404 ? 'Cette publication de votre PC ne contient pas LUMIO Simple (calcul trop long ou en erreur sur le PC). Touchez « Actualiser » pour en demander une nouvelle ; si cela se répète, ouvrez LUMIO Simple sur le PC pour voir l\'erreur.' : `${esc(e.message)} : rechargez la page.`)
      : e.lent ? `${esc(e.message)} : patientez un instant, puis rechargez la page.`
      : `${esc(e.message)} : vérifiez que LUMIO tourne sur le PC, puis rechargez la page.`;
    $('#app').innerHTML = `<div class="band l1" role="alert"><span class="lv"><i></i>Données indisponibles</span><span class="why">${why}</span></div>`;
    $('#v-portefeuille').removeAttribute('aria-busy');
    const f = $('#fresh'); if (f) f.textContent = 'Données indisponibles';
  }
}
function pollIa() {
  clearTimeout(S.iaT);
  let n = 0;
  const tick = async () => {
    n += 1;
    try { recu(await api('/api/simple')); render(); const d = S.d; if (d.ia && d.ia.en_cours && n < 36) S.iaT = setTimeout(tick, 5000); else if (!(d.ia && d.ia.en_cours)) toast('Lecture des actualités par Claude terminée'); }
    catch (e) { /* réessai au prochain chargement */ }
  };
  S.iaT = setTimeout(tick, 5000);
}

/* ── Portefeuille ── */
function focusKey(root) {                // de quoi retrouver l'élément actif après un nouveau rendu
  const a = document.activeElement; if (!a || !root || !root.contains(a)) return null;
  const tr = a.closest('tr[data-uid]'); if (tr && a.classList.contains('ln')) return `tr[data-uid="${CSS.escape(tr.dataset.uid)}"] .ln`;
  const to = a.closest('tr[data-tk]'); if (to && a.classList.contains('ln')) return `tr[data-tk="${CSS.escape(to.dataset.tk)}"] .ln`;
  if (a.hasAttribute('data-scen')) return `[data-scen="${CSS.escape(a.dataset.scen)}"][data-cas="${CSS.escape(a.dataset.cas)}"][data-g="${CSS.escape(a.dataset.g || '')}"]`;
  for (const k of ['data-sort', 'data-unit', 'data-vue', 'data-ohz']) if (a.hasAttribute(k)) return `[${k}="${CSS.escape(a.getAttribute(k))}"]`;
  const dt = a.tagName === 'SUMMARY' && a.parentElement && a.parentElement.dataset.det; if (dt) return `details[data-det="${CSS.escape(dt)}"] > summary`;
  return null;
}
function mesure() {                      // hauteur de l'en-tête fixe : une ligne ciblée au clavier ne passe plus dessous
  const t = $('.top'), ti = $('.top-in'); if (!t) return;
  const r = document.documentElement.style;
  r.setProperty('--top-h', t.offsetHeight + 'px');
  if (ti) r.setProperty('--topin-h', ti.offsetHeight + 'px');
}
function apres(root) {                   // après un rendu : indice de défilement sur les tableaux plus larges que l'écran
  (root.querySelectorAll ? root : document).querySelectorAll('.tw').forEach(tw => {
    const f = () => tw.toggleAttribute('data-more', tw.scrollWidth - tw.clientWidth - tw.scrollLeft > 4);
    f(); tw.onscroll = f;
  });
}
function render() {
  const d = S.d, app = $('#app');
  const fk = focusKey(app), sy = window.scrollY;
  EV = EV0.map(([k, l]) => [k, (d && d.libelles && d.libelles[k]) || l]);
  $('#v-portefeuille').removeAttribute('aria-busy');
  paintFresh();
  renderAccueil();
  if (!d || d.empty) { app.innerHTML = '<div class="band"><span class="lv"><i></i>Aucune ligne</span><span class="why">Mettez à jour vos positions Trade Republic (onglet Journal, Outils), puis revenez ici.</span></div>'; return; }
  app.innerHTML = band(d.marche) + kpis(d) + bref(brefItems(d)) + scenBox(d) + `<div class="duo">${repart(d.repartition)}${savoir(d.a_savoir)}</div>` + table(d) + foot(d);
  apres(app);
  const open = S.open;                         // fiche d'une ligne restée ouverte : remise à jour, au même endroit
  if (open && open.startsWith('L:') && !$('#panel').hidden) openLine(open.slice(2), true);
  if (fk && $('#panel').hidden) { const el = app.querySelector(fk); if (el) el.focus({ preventScroll: true }); }
  if (S.tab === 'portefeuille' && Math.abs(window.scrollY - sy) > 1) window.scrollTo(0, sy);     // la page ne saute pas
}
function paintFresh() {
  const el = $('#fresh'); if (!el) return;
  const parts = [];
  if (S.tab === 'opportunites') {
    const o = S.opp;
    parts.push(o && o.asof ? `Veille calculée ${ago(o.asof)}` : 'Veille de marché');
    if (o && o.en_cours) parts.push('calcul en cours');
  } else if (S.tab === 'journal') {
    const j = S.jou;
    parts.push(j && j.debut ? `Journal tenu depuis le ${jour(j.debut)} · ${j.n_maj} actualisations` : 'Journal des prévisions');
  } else {
    const d = S.d;
    if (!d) { el.textContent = 'Chargement…'; return; }
    if (ST && d.reprise) parts.push(`Copie du PC ${when(d.reprise)} (la dernière publication n'a pas pu recalculer LUMIO Simple)`);
    else if (ST && d.nuage) parts.push(`Tenu à jour sans votre PC · cours ${when(d.asof)}`);
    else if (ST && ST.asof) parts.push(`Copie du PC ${when(ST.asof)}`);
    else parts.push(`Cours ${when(d.asof)}`);
    const ls = d.lignes || [], ref = asofRef(), dates = ls.filter(l => l.cours_ts), sans = ls.length - dates.length;
    const frais = dates.filter(l => !vieux(l.cours_ts, ref)).length;
    if (dates.length && frais < dates.length) parts.push(`${frais}/${dates.length} cours à jour${frais < .8 * dates.length ? ' : données partielles' : ''}`);
    if (ls.length && sans) parts.push(sans === ls.length ? 'heure des cours inconnue' : `${sans} cours sans heure connue`);
    const so = d.sources;                    // une source muette n'est pas une absence d'information
    if (so && !so.ok) {
      if (so.actus && so.actus.ko) parts.push(`actualités indisponibles pour ${so.actus.ko} ligne${plur(so.actus.ko)} sur ${so.actus.n}`);
      if (so.fiche && so.fiche.ko) parts.push(`comptes indisponibles pour ${so.fiche.ko} action${plur(so.fiche.ko)}`);
      if (so.faits && so.faits.ko) parts.push(`faits marquants non vérifiés pour ${so.faits.ko} action${plur(so.faits.ko)}`);
      const part = Math.max((so.actus && so.actus.partiel) || 0, (so.faits && so.faits.partiel) || 0);      // une partie des lectures a échoué
      if (part) parts.push(`recherche d'actualité incomplète pour ${part} ligne${plur(part)}`);
    }
    if (d.tr_ts) parts.push(`positions Trade Republic ${when(d.tr_ts)}`);
    // 9.0 : la clé GitHub du nuage a une date de fin ; prévenir deux semaines avant qu'il ne s'arrête
    const ce = d.nuage && d.nuage.cle_expire;
    if (ce && ce - Date.now() / 1000 < 14 * 86400) parts.push(`clé GitHub du nuage à renouveler avant le ${jour(ce)}`);
    if (d.ia && d.ia.en_cours) parts.push('lecture IA des actualités en cours');
  }
  const txt = parts.join(' · ');
  if (el.textContent !== txt) el.textContent = txt;
  mesure();
}
function band(m) {
  if (!m) return '';
  const ix = (m.indices || []).map(i => i.niv != null ? `<span>${esc(i.label)} <b>${num(i.niv, 0)}</b> <span class="muted">(indice de la peur : inquiétude à partir de 30)</span></span>`
    : `<span>${esc(i.label)} <b class="${cls(i.pct)}">${pct(i.pct, 1)}</b></span>`).join('');
  const asof = asofPub() || (S.d && S.d.asof);
  if (seanceDepuis(asof) >= 90) {
    return `<section class="band stale" aria-label="Alerte marché"><span class="lv"><i aria-hidden="true"></i>Alerte non vérifiée</span>
      <span class="why">Dernier relevé ${esc(when(asof))} : les marchés ont bougé depuis sans que LUMIO les relise (PC éteint ou copie ancienne). À ce moment-là : ${esc(m.label.toLowerCase())}${(m.pourquoi || []).length ? ` (${m.pourquoi.slice(0, 2).map(esc).join(' ; ')})` : ''}. <a href="https://www.google.com/finance/markets/indexes" target="_blank" rel="noopener noreferrer">Indices en direct</a></span><span class="ix">${ix}</span></section>`;
  }
  const W = m.pourquoi || [];                  // l'essentiel : trois raisons, les trois plus fortes baisses
  const why = W.length ? W.slice(0, 3).map(esc).join(' ; ') : 'Aucune baisse forte des marchés ni de votre portefeuille aujourd\'hui.';
  const cs = (m.chutes || []).slice().sort((a, b) => a.pct - b.pct), nx = cs.length - 3;
  const ch = cs.length ? ` ${cs.length > 1 ? 'Baisses anormales ou fortes' : 'Baisse anormale ou forte'} : ${cs.slice(0, 3).map(c => `${esc(c.name)} <b class="${clsD(c.pct, 1)}">${pct(c.pct, 1)}</b>`).join(', ')}${nx > 0 ? ` et ${nx} autre${plur(nx)}` : ''}${cs.length > 1 ? ' (lignes teintées dans le tableau)' : ''}.` : '';
  return `<section class="band l${m.niveau}" aria-label="Alerte marché"><span class="lv"><i aria-hidden="true"></i>${esc(m.label)}</span>
    <span class="why">${why.charAt(0).toUpperCase() + why.slice(1)}${/[.!?]$/.test(why) ? '' : '.'}${W.length > 3 ? ` Et ${W.length - 3} autre${plur(W.length - 3)} raison${plur(W.length - 3)} : ${W.slice(3).map(esc).join(' ; ')}.` : ''}${ch}</span><span class="ix">${ix}</span>${m.note ? `<span class="bn">${esc(m.note)}</span>` : ''}</section>`;
}
function kpis(d) {
  const t = d.totaux, a = totPrev(d).an, u = S.unit;
  const pair = (o, d1 = 1) => u === 'eur' ? `<span class="${clsD(o.eur, 0)}">${eurS(o.eur)}</span> <span class="muted">${pct(o.pct, d1)}</span>` : `<span class="${clsD(o.pct, d1)}">${pct(o.pct, d1)}</span> <span class="muted">${eurS(o.eur)}</span>`;
  return `<section class="kpis" aria-label="Chiffres clés">
    <div class="kpi big"><span class="l">Valeur du portefeuille</span><span class="v">${eur(t.valeur)}</span><span class="s">${pair(t.jour, 2)} ${esc(t.jour.note || 'aujourd\'hui')}</span></div>
    <div class="kpi"><span class="l">Depuis l'achat</span><span class="v ${cls(t.debut.eur)}">${u === 'eur' ? eurS(t.debut.eur) : pct(t.debut.pct)}</span><span class="s muted">${u === 'eur' ? pct(t.debut.pct) : eurS(t.debut.eur)}</span></div>
    ${t.cash != null && t.an.pct == null ? `<div class="kpi"><span class="l">Liquidités</span><span class="v">${eur(t.cash)}</span><span class="s muted">${esc(t.cash_note || 'disponibles')}</span></div>`
      : `<div class="kpi"><span class="l">Sur un an</span><span class="v ${cls(t.an.eur)}">${u === 'eur' ? eurS(t.an.eur) : pct(t.an.pct)}</span><span class="s muted">${u === 'eur' ? pct(t.an.pct) : eurS(t.an.eur)} · hors versements</span></div>`}
    <div class="kpi"><span class="l">Prévision à un an</span><span class="v ${u === 'eur' ? clsD(a.eur, 0) : clsD(a.pct, 1)}">${u === 'eur' ? eurS(a.eur) : pct(a.pct)}</span><span class="s muted">${u === 'eur' ? pct(a.pct) : eurS(a.eur)} · médiane du portefeuille</span></div>
  </section>`;
}
function bref(items) {
  if (!(items || []).length) return '';
  const seg = x => typeof x === 'string' ? esc(x).replace(/[^\s,;()]+-[^\s,;()]+/g, w => `<span class="nw">${w}</span>`)   // « D-Wave » d'un bloc
    : `<span class="${x[1] > 0 ? 'up' : x[1] < 0 ? 'dn' : ''}">${esc(x[0])}</span>`;
  const li = x => {
    const chif = x.pct != null ? `<b class="${clsD(x.pct, 1)}">${pct(x.pct, 1)}${x.eur != null ? ` (${eurS(x.eur)})` : ''}</b>` : '';
    const suite = (x.suite || []).map(seg).join('');
    return `<li><span class="k">${esc(x.titre)}</span><span class="t">${chif}${chif && suite ? ', ' : ''}${suite}.</span></li>`;
  };
  return `<section class="box bref" aria-labelledby="hBref"><h2 id="hBref">En bref</h2><ul>${items.map(li).join('')}</ul></section>`;
}
function brefItems(d) {                  // la phrase « Prévision à un an » suit les scénarios choisis
  const t = scTot(d); if (!t || !(d.scenarios.evenements || []).some(e => scenCur(e))) return d.synthese;
  const pv = (d.lignes || []).filter(l => l.value > 0).map(l => [l.name, hL(l).an.c]).filter(x => x[1] != null).sort((a, b) => a[1] - b[1]);
  const sg = c => [fr(c, 0), c > 0 ? 1 : c < 0 ? -1 : 0];
  const suite = ['médiane selon vos choix de scénario'];
  const sm = sumPv(d, 'an');
  if (t.an && sm && sm.pct != null && Math.abs(t.an.pct - sm.pct) >= 1)
    suite.push(' ; l\'addition des lignes donne ', [fr(sm.pct / 100, 1), sm.pct > 0 ? 1 : sm.pct < 0 ? -1 : 0], ', l\'écart venant de la diversification (toutes les lignes ne déçoivent pas ensemble)');
  if (pv.length >= 2) suite.push(' ; selon les lignes, de ', sg(pv[0][1]), ` pour ${pv[0][0]} à `, sg(pv[pv.length - 1][1]), ` pour ${pv[pv.length - 1][0]}`);
  return (d.synthese || []).map(x => x.k === 'prevision' && t.an ? { ...x, pct: t.an.pct, eur: t.an.eur, suite } : x);
}
const detOpen = (k, def) => (S.det[k] != null ? !!S.det[k] : !!def);
function scenBox(d) {
  const sc = d.scenarios; if (!sc || !(sc.evenements || []).length) return '';
  const evs = sc.evenements, nch = evs.filter(e => scenCur(e)).length;
  const card = ev => {
    const ls = (d.lignes || []).filter(l => (l.scen || []).some(s => s.ev === ev.id));
    const rows = ls.map(l => `<tr><td class="nm"><b>${esc(l.name)}</b></td>${ev.cas.map(c => { const v = scCas(l, ev, c);
      return `<td class="${clsD(v.an * 100, 0)}">${fr(v.an, 0)}</td><td class="o-x ${clsD(v.cinq * 100, 0)}">${fr(v.cinq, 0)}</td>`; }).join('')}</tr>`).join('');
    const pf = ev.cas.map(c => { const t = scTot(d, { ...S.scen, [ev.id]: c.id }); const a = t && t.an, b = t && t.cinq;
      return `<td class="${a ? clsD(a.pct, 1) : ''}">${a ? pct(a.pct, 1) : '—'}</td><td class="o-x ${b ? clsD(b.pct, 0) : ''}">${b ? pct(b.pct, 0) : '—'}</td>`; }).join('');
    const dep = (ev.depuis || []).length ? `<p class="ev-new"><b>Depuis le ${esc(jourIso(sc.maj))} :</b> ${ev.depuis.map(x => `${esc(x.ligne)}, ${esc(String(x.label || '').toLowerCase())} le ${esc(jourCourt(x.jour))}`).join(' ; ')}. À relire avant de vous y fier.</p>` : '';
    const k = 'ev:' + ev.id;
    return `<article class="ev"><h3>${esc(ev.titre)} <span class="q">${esc(ev.question || '')}</span></h3>${dep}
      ${choixBtns(ev, ch => scTot(d, ch), 'b')}
      <details data-det="${esc(k)}"${detOpen(k) ? ' open' : ''}><summary>Lignes concernées et dernières nouvelles</summary>
        <div class="tw"><table class="mini ev-t" aria-label="${esc(ev.titre)} : prévision de chaque ligne selon l'issue"><thead><tr><th scope="col">Prévision</th>${ev.cas.map(c => `<th scope="col">${esc(c.nom)}<small>1 an</small></th><th scope="col" class="o-x">${esc(c.nom)}<small>5 ans</small></th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody><tfoot><tr><td class="nm"><b>Portefeuille</b></td>${pf}</tr></tfoot></table></div>
        <ul class="ev-act">${(ev.actus || []).map(a => `<li><b>${esc(jourIso(a.date))}</b> ${esc(a.txt)} <span class="src">${lien(a)}</span></li>`).join('')}</ul>
        <p class="guard">${esc(ev.p_txt || '')}${ev.repere ? ` ${esc(ev.repere.txt)} <span class="src">${lien(ev.repere)}</span>` : ''}</p>
      </details></article>`;
  };
  // Les deux événements les plus lourds d'abord ; les autres repliés, sauf s'ils portent un choix ou du nouveau
  const tete = evs.filter((e, i) => i < 2 || scenCur(e) || (e.depuis || []).length), reste = evs.filter(e => !tete.includes(e));
  const petit = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  const etat = nch ? `${nch} choix fait${plur(nch)}` : 'à vous de choisir l\'issue la plus probable';
  return `<section class="box scen" aria-labelledby="hScen"><details class="sc-tout" data-det="scen"${detOpen('scen', !petit) ? ' open' : ''}>
    <summary><h2 id="hScen">Scénarios <small>${evs.length} événement${plur(evs.length)} qui peu${evs.length > 1 ? 'vent' : 't'} tout changer · ${etat}</small></h2></summary>
    <p class="ev-cap">Deux prévisions par événement. En petit sur chaque bouton : la prévision à un an du portefeuille entier si cette issue se réalise.</p>
    ${tete.map(card).join('')}
    ${reste.length ? `<details class="ev-plus" data-det="scen-plus"${detOpen('scen-plus') ? ' open' : ''}><summary>${reste.length} autre${plur(reste.length)} événement${plur(reste.length)}, moins lourd${plur(reste.length)} pour votre portefeuille</summary>${reste.map(card).join('')}</details>` : ''}
    <p class="note">${esc(sc.note || '')}${sc.maj ? ` Établis le ${esc(jourIso(sc.maj))}${sc.auteur ? ` par ${esc(sc.auteur)}` : ''}.` : ''}${sc.a_revoir ? ` <b class="wa">${(sc.age_jours || 0) > 7 ? 'Plus d\'une semaine' : 'Du nouveau depuis'} : à relire avant de vous y fier.</b>` : ''}</p>
  </details></section>`;
}
function scenDetail(x, val) {
  const blocks = (x.scen || []).map(s => { const ev = scenEv(s.ev); if (!ev) return '';
    const cells = ev.cas.map(c => { const v = scCas(x, ev, c);
      return `<div class="cell sc-c${S.scen[ev.id] === c.id ? ' on' : ''}"><span class="l">${esc(c.nom)}</span><span class="v ${clsD(v.an * 100, 0)}">${fr(v.an, 0)}<small> à un an</small></span>
        <span class="s"><span class="${clsD(v.cinq * 100, 0)}">${fr(v.cinq, 0)}</span> à cinq ans${val != null ? ` · <span class="${clsD(v.an * val, 0)}">${eurS(v.an * val)}</span> sur un an` : ''}</span>
        <span class="s muted">${esc((s.pourquoi || {})[c.id] || '')}</span></div>`; }).join('');
    return `<h4>${esc(ev.titre)} <span class="muted">· ${esc(ev.question || '')}</span></h4><div class="grid2">${cells}</div>
      ${choixBtns(ev, null, 'p')}`; }).join('');
  return blocks ? `<section class="scd"><h3>Scénarios <small>prévision médiane de cette ligne selon l'issue ; le chiffre retenu suit votre choix</small></h3>${blocks}</section>` : '';
}
function repart(r) {
  const all = r || [];
  // les lignes de chaque thème sont écrites (quatre au plus, puis leur nombre) : lisibles sans survol
  const nomsTxt = ns => ns.length <= 4 ? ns.join(', ') : `${ns.slice(0, 4).join(', ')} et ${ns.length - 4} autre${plur(ns.length - 4)}`;
  const via = all.some(x => (x.names || []).some(n => / \(part du fonds\)$/.test(n)));
  return `<section class="box" aria-labelledby="hRep"><h2 id="hRep">Répartition par thème <small>${all.length} thème${plur(all.length)}${via ? ' · fonds indiciels répartis selon leur indice' : ''}</small></h2>
    <ul class="rep">${all.map(x => `<li title="${esc(x.names.join(', '))}"><span class="t">${esc(x.label)}</span><span class="p">${num(x.pct, x.pct < 10 ? 1 : 0)}${NB}%</span>
      <span class="bar" aria-hidden="true"><i style="width:${Math.max(1.5, x.pct)}%"></i></span><span class="e">${eur(x.value)} · <span class="noms">${esc(nomsTxt(x.names))}</span></span></li>`).join('')}</ul></section>`;
}
function savoir(items) {
  const K = { fait: ['fait', 'Fait grave'], actu: ['actu', 'Actualité'], resultats: ['res', 'Résultats'], agenda: ['', 'Agenda'] };
  // Un fait grave reste ici tant que la fiche de sa ligne n'a pas été ouverte ; cinq entrées au plus
  items = (items || []).filter(x => !(x.kind === 'fait' && x.cle && S.vus[x.cle])).slice(0, 5);
  const li = x => {
    const [c, l] = K[x.kind] || ['', ''];
    const sub = x.kind === 'agenda' ? `${x.jours === 0 ? "aujourd'hui" : x.jours === 1 ? 'demain' : `dans ${x.jours} jours`}${x.estime ? ' (date estimée)' : ''}`
      : x.kind === 'fait' ? `${esc(x.label || '')}${x.source ? ` · ${esc(x.source)}` : ''}${x.jour ? ` · le ${esc(x.jour.slice(8, 10))}/${esc(x.jour.slice(5, 7))}` : ''}`
      : `${esc(x.source || '')}${x.quand ? ` · ${esc(x.quand)}` : x.age_h != null ? ` · il y a ${x.age_h < 1 ? 'moins d\'une heure' : Math.round(x.age_h) + ' h'}` : ''}`;
    const title = x.link && /^https:\/\//.test(x.link) ? `<a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.titre)}</a>` : esc(x.titre);
    const dup = String(x.titre || '').toLowerCase().startsWith(String(x.ligne || '').toLowerCase());
    return `<li><span class="k ${c}">${l}</span><span>${dup ? '' : `<b>${esc(x.ligne)}</b> : `}${title}<span class="src"> ${sub}</span></span></li>`;
  };
  return `<section class="box" aria-labelledby="hSav"><h2 id="hSav">À ne pas manquer <small>faits graves non lus, 48 dernières heures, 7 prochains jours</small></h2>
    ${items.length ? `<ul class="sav">${items.map(li).join('')}</ul>` : '<p class="empty">Rien d\'important sur vos lignes : ni fait grave non lu, ni actualité majeure, ni résultats, ni rendez-vous cette semaine.</p>'}</section>`;
}
const SIGV = { positifs: 1, mitiges: 0, negatifs: -1 };
const VAL = {
  value: l => l.value, name: l => l.name.toLowerCase(),
  jour: l => S.unit === 'eur' ? l.jour.eur : l.jour.pct, mois: l => S.unit === 'eur' ? l.mois.eur : l.mois.pct,
  an: l => S.unit === 'eur' ? l.an.eur : l.an.pct, debut: l => S.unit === 'eur' ? l.debut.eur : l.debut.pct,
  pjour: l => S.unit === 'eur' ? l.prev.h.jour.ecart_eur : l.prev.h.jour.ecart, pmois: l => l.prev.h.mois[S.unit === 'eur' ? 'eur' : 'c'],
  pan: l => hL(l).an[S.unit === 'eur' ? 'eur' : 'c'], pcinq: l => hL(l).cinq[S.unit === 'eur' ? 'eur' : 'c'],
  pbas: l => bh(l).bas[S.unit === 'eur' ? 'eur' : 'v'], phaut: l => bh(l).haut[S.unit === 'eur' ? 'eur' : 'v'],
  sig: l => SIGV[l.prev.signaux],
};
function sortBy(ls, sort, vals) {
  const [k, dir] = sort; const f = vals[k] || (() => 0);
  return ls.slice().sort((a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; });
}
function sb(k, label, sort, attr, dit) {
  const on = sort[0] === k;
  return `<button type="button" ${attr}="${k}"${dit ? ` aria-label="${esc(dit)}"` : ''}${on ? ` class="on ${sort[1] < 0 ? 'desc' : 'asc'}"` : ''}>${label}</button>`;
}
function th(k, label, extra = '', dit = '', tip = '') {
  const on = S.sort[0] === k;
  return `<th scope="col" class="${extra}"${on ? ` aria-sort="${S.sort[1] < 0 ? 'descending' : 'ascending'}"` : ''}${tip ? ` title="${esc(tip)}"` : ''}>${sb(k, label, S.sort, 'data-sort', dit)}</th>`;
}
function cellEv(o, first) {
  const v = S.unit === 'eur' ? o.eur : o.pct;
  return `<td class="ge${first ? ' sep' : ''} ${clsD(v, S.unit === 'eur' ? 0 : 1)}">${S.unit === 'eur' ? eurS(v) : pct(v, 1)}</td>`;
}
function cellPv(h, k, rv, mk) {
  if (k === 'jour') {                       // prochaine séance : l'écart habituel, plus parlant qu'un centre proche de zéro
    return `<td class="gp pvs muted" title="Deux fois sur trois, la prochaine séance reste dans cet écart">${S.unit === 'eur' ? '±' + num(h.ecart_eur) + NB + '€' : pm(h.ecart, 1)}</td>`;
  }
  const v = S.unit === 'eur' ? h.eur : h.c;
  const arrow = rv && rv.sens ? `<span class="rv ${rv.sens > 0 ? 'up' : 'dn'}" title="Revue ${rv.sens > 0 ? 'à la hausse' : 'à la baisse'} depuis la veille, hors effet du cours (${pts(rv.delta * 100)})${rv.serie >= 2 ? ', deux jours de suite' : ''}"><span aria-hidden="true">${rv.sens > 0 ? '▲' : '▼'}${rv.serie >= 2 ? '²' : ''}</span><span class="sr">revue ${rv.sens > 0 ? 'à la hausse' : 'à la baisse'}</span></span>` : '';
  const dd = S.unit === 'eur' ? 0 : Math.abs(v) < .01 ? 2 : 1;
  const ag = agite(h) ? `<span class="tl" title="Valeur très agitée : médiane ${fr(h.c, 0)}, moyenne attendue ${fr(h.esp, 0)}"><span aria-hidden="true">~</span><span class="sr">valeur très agitée, médiane </span></span>` : '';
  return `<td class="gp${k === 'mois' ? ' pm' : ''} ${S.unit === 'eur' ? clsD(v, 0) : clsD(v * 100, dd)}">${ag}${S.unit === 'eur' ? eurS(v) : fr(v, dd)}${arrow}${mk || ''}</td>`;
}
function cellB(o, k) {                  // Bas ou Haut à un an
  const v = S.unit === 'eur' ? o.eur : o.v;
  const mn = o.main ? `<span class="mn" aria-hidden="true">✎</span><span class="sr"> (votre chiffre)</span>` : '';
  return `<td class="gp pb ${S.unit === 'eur' ? clsD(v, 0) : clsD(v * 100, 0)}"${o.main ? ` title="Votre chiffre ; modèle : ${fr(o.modele, 0)}"` : ''}>${S.unit === 'eur' ? eurS(v) : fr(v, 0)}${mn}</td>`;
}
function bhRow(l, B, chute) {            // sous la ligne : ce qui mènerait au bas et au haut (et, sur téléphone, les deux chiffres)
  const it = (o, k) => { const v = S.unit === 'eur' ? o.eur : o.v, up = k === 'haut';
    return `<span class="bh"><span class="ar ${up ? 'up' : 'dn'}" aria-hidden="true">${up ? '▲' : '▼'}</span><span class="bhv ${S.unit === 'eur' ? clsD(v, 0) : clsD(v * 100, 0)}">${up ? 'Haut' : 'Bas'} ${S.unit === 'eur' ? eurS(v) : fr(v, 0)}${o.main ? '<span class="mn" aria-hidden="true">✎</span><span class="sr"> (votre chiffre)</span>' : ''}</span>${o.court ? `<span class="bhc"><span class="sr">${up ? 'Vers le haut' : 'Vers le bas'} : </span>${esc(o.court)}</span>` : ''}</span>`; };
  // Sur ordinateur, sous les colonnes Prévision ; quand Évolution et le nom passent au-dessus, sur toute la largeur
  return `<tr class="bhr${B.bas.court || B.haut.court ? '' : ' vide'}${chute ? ' chute' : ''}" data-uid="${esc(l.uid)}"><td class="bh0"></td><td class="ge bh0" colspan="4"></td><td class="gp bhc" colspan="7">${B.titre ? `<span class="bht">${esc(B.titre)} :</span>` : ''}${it(B.bas, 'bas')}${it(B.haut, 'haut')}</td></tr>`;
}
function sigCell(k, extra = '') {
  const [c, l] = sigOf(k);
  return `<td class="gp lec ${extra}"><span class="dot ${c}">${l}</span></td>`;
}
// Ce qui est à lire sur une ligne (« ! ») : fait grave, comptes fragiles, actualité importante, prévision revue à la
// baisse. Un fait ou des comptes déjà lus (fiche ouverte) ne comptent plus. Le mouvement du jour teinte la ligne, sans « ! ».
const COURS_RE = /^(Baisse anormale|Forte baisse)/;
function vives(l) {
  if (Array.isArray(l.motifs)) return l.motifs.filter(m => !m.k || !S.vus[l.uid + '|' + m.k]);
  const lu = new Set((l.durables || []).filter(x => S.vus[l.uid + '|' + x.k]).map(x => x.txt));      // données d'avant la 8.6
  return (l.alertes || []).filter(a => !lu.has(a) && !COURS_RE.test(a)).map(a => ({ t: '', court: a.replace(/ :.*$/, ''), txt: a }));
}
function chuteDe(l) { return l.cours_alerte || (l.alertes || []).find(a => COURS_RE.test(a)) || ''; }
function vusClean() {                    // on ne garde que les alertes encore d'actualité
  const d = S.d; if (!d || !Array.isArray(d.lignes)) return;
  const ok = new Set(); d.lignes.forEach(l => (l.durables || []).forEach(x => ok.add(l.uid + '|' + x.k)));
  const ks = Object.keys(S.vus), garde = ks.filter(k => ok.has(k));
  if (garde.length !== ks.length) { S.vus = Object.fromEntries(garde.map(k => [k, 1])); keep('simple.vus', S.vus); }
}
function corTxt(d) {
  const c = d.correlation; if (!c || c.rho == null) return '';
  const fin = ' : plus ce chiffre est haut, moins la diversification joue.';
  if (c.mesuree && c.borne && c.brut != null)       // la mesure sort des bornes du modèle : dire la mesure, et la valeur retenue
    return ` Corrélation de vos lignes mesurée à ${num(Math.max(0, c.brut) * 100)}${NB}% sur trois mois ; LUMIO retient ${num(c.rho * 100)}${NB}%, sa borne ${c.borne} (${c.borne === 'basse' ? 'au moins' : 'au plus'} ${num(c.rho * 100)}${NB}% : une mesure sur trois mois est bruitée, et les lignes chutent davantage ensemble quand les marchés décrochent)${fin}`;
  return c.mesuree ? ` Vos lignes ont bougé ensemble à ${num(c.rho * 100)}${NB}% ces trois derniers mois (corrélation mesurée)${fin}`
    : ` Faute d'historique, LUMIO suppose que vos lignes bougent ensemble à ${num(c.rho * 100)}${NB}% (corrélation${c.techno ? ', relevée parce que plus de 40' + NB + '% du portefeuille est dans des thèmes technologiques' : ''})${fin}`;
}
function table(d) {
  if (!Object.prototype.hasOwnProperty.call(VAL, S.sort[0])) S.sort = ['value', -1];   // tri enregistré sur une colonne inconnue (ou réservée : « __proto__ »)
  const ls = sortBy(d.lignes || [], S.sort, VAL);
  const vue = S.vue, ref = asofRef();
  const t = d.totaux;
  const m = d.marche || {}, chutes = Array.isArray(m.chutes) && m.chutes.every(c => c.uid) ? new Set(m.chutes.map(c => c.uid)) : null;
  const totEv = k => { const o = t[k]; const v = S.unit === 'eur' ? o.eur : o.pct; const dd = S.unit === 'eur' ? 0 : k === 'jour' ? 2 : 1;
    return `<td class="ge ${k === 'jour' ? 'sep' : ''} ${clsD(v, dd)}">${S.unit === 'eur' ? eurS(v) : pct(v, dd)}</td>`; };
  const cellTot = (o, tip, k) => { const v = S.unit === 'eur' ? o.eur : o.pct; const dd = S.unit === 'eur' ? 0 : Math.abs(v) < 1 ? 2 : 1;
    return `<td class="gp${k === 'mois' ? ' pm' : ''} ${clsD(v, dd)}"${tip ? ` title="${tip}"` : ''}>${S.unit === 'eur' ? eurS(v) : pct(v, dd)}</td>`; };
  const totPv = k => k === 'jour' ? '<td class="gp pvs muted">—</td>' : cellTot(totPrev(d)[k], 'Médiane du portefeuille entier', k);
  const totB = k => {                    // bas et haut du portefeuille entier, déplacés comme sa médiane par les scénarios choisis
    const p = t.prev && t.prev.an, q = totPrev(d).an, b = p && p[k + '_pct'];
    if (b == null) return '<td class="gp pb muted">—</td>';
    const v = b + ((q.pct || 0) - (p.pct || 0)), e = t.valeur ? t.valeur * v / 100 : null, dd = S.unit === 'eur' ? 0 : 1;
    return `<td class="gp pb ${S.unit === 'eur' ? clsD(e, 0) : clsD(v, dd)}" title="Portefeuille entier : une chance sur six de finir ${k === 'bas' ? 'plus bas' : 'plus haut'}">${S.unit === 'eur' ? eurS(e) : pct(v, dd)}</td>`; };
  const somPv = k => { if (k === 'jour') return '<td class="gp pvs"></td>'; const o = sumPv(d, k); return o ? cellTot(o, 'Somme des prévisions des lignes', k) : `<td class="gp${k === 'mois' ? ' pm' : ''} muted">—</td>`; };
  const row = l => {
    const [sc, sl] = sigOf(l.prev.signaux), al = vives(l), cp = l.comptes && (l.comptes.etat === 'fragile' || l.comptes.etat === 'critique') ? l.comptes : null;
    const dit = al.map(m => m.txt).join(' ; ');
    const fl = al.length ? `<span class="fl${al.every(m => m.t === 'info') ? ' info' : ''}" role="img" aria-label="À lire : ${esc(dit)}.">!</span>` : '';
    // Le motif du « ! » est écrit sous le nom : lisible au doigt et au clavier, sans survol ; sur ordinateur, les comptes
    // fragiles sont déjà écrits à côté de la valeur : le motif montré est alors le suivant
    const m0 = al.find(m => m.t !== 'comptes') || al[0];
    const mt = al.length ? `<span class="mt ${esc(m0.t || '')}" aria-hidden="true">${esc(m0.court)}${al.length > 1 ? ` <span class="plus">+${al.length - 1}</span>` : ''}</span>` : '';
    const cd = chuteDe(l), chute = chutes && chutes.has(l.uid) ? (cd || 'Forte baisse du jour') : cd, B = bh(l);
    return `<tr data-uid="${esc(l.uid)}"${chute ? ' class="chute"' : ''}>
      <td class="nm"><b><button type="button" class="ln" aria-haspopup="dialog">${esc(l.name)}</button>${fl}</b><small><span class="vl">${eur(l.value)}</span><span class="wt"> · ${num(l.weight, 1)}${NB}%${vieux(l.cours_ts, ref) ? ` · <span class="wa" title="Dernière cotation reçue">cours du ${jour(l.cours_ts)}</span>` : ''}</span>${cp ? `<span class="cpm"> · <span class="${cp.etat === 'critique' ? 'dn' : 'wa'}">comptes ${cp.etat === 'critique' ? 'critiques' : 'fragiles'}</span></span>` : ''}<span class="lsm"><span class="dot ${sc}" title="Signaux ${sl.toLowerCase()}">${sl}</span></span></small>${mt}${chute ? `<span class="sr">${esc(chute)}</span>` : ''}</td>
      ${EV.map(([k], i) => cellEv(l[k], i === 0)).join('')}
      ${(H => HZ.map(([k]) => cellPv(H[k], k, k === 'an' ? l.revision : null, k === 'an' ? scMark(l, true) : k === 'cinq' ? scMark(l) : '')
        + (k === 'an' ? cellB(B.bas, 'bas') + cellB(B.haut, 'haut') : '')).join(''))(hL(l))}
      ${sigCell(l.prev.signaux)}</tr>${bhRow(l, B, chute)}`;
  };
  const lire = [
    ['Évolution', d.legende || 'variation de votre ligne, cours et change compris, hors achats et ventes de la période.'],
    ['Prévision', 'la médiane : une chance sur deux de faire mieux. La fourchette et la moyenne attendue sont dans la fiche de la ligne.'],
    ['Bas, Haut', 'la fourchette à un an : une chance sur six de finir plus bas que Bas, une sur six plus haut que Haut ; ils suivent les scénarios choisis. Sous la ligne, ce qui y mènerait le plus probablement ; la fiche le date et donne sa source.'],
    ['✎', 'votre chiffre, à la place de celui du modèle ; la fiche donne les deux.'],
    ['Jour (prévision)', 'l\'écart habituel : deux fois sur trois, la prochaine séance reste dedans.'],
    ['▲ ▼', 'prévision revue depuis la veille pour une raison de fond (objectifs d\'analystes, signaux), pas à cause du cours ; ² deux jours de suite.'],
    ['~', 'valeur très agitée : sa médiane est négative alors que sa moyenne attendue ne l\'est pas ; quelques très fortes hausses tirent la moyenne, les à-coups tirent la médiane vers le bas.'],
    ...(d.scenarios ? [['◇ ◆', 'deux scénarios selon un événement à venir (bloc « Scénarios ») ; ◆ quand vous avez choisi une issue.']] : []),
    ['!', 'à lire : fait grave récent (production arrêtée, augmentation de capital, enquête, départ du dirigeant…), comptes fragiles, actualité importante, prévision revue à la baisse, ou baisse marquée du cours sans fait reconnu dans les titres lus (la cause a pu échapper à la lecture). En violet, à lire sans inquiéter : un fait majeur qui n\'est pas défavorable (retour d\'un dirigeant, reprise de la production…) ou une forte hausse sans fait reconnu. Le motif est écrit sous le nom ; un fait ou des comptes déjà lus (fiche ouverte) ne sont plus signalés. Un fait grave défait depuis (le dirigeant parti revient) ne signale plus la ligne : la fiche écrit sa suite.'],
    ['Ligne teintée', 'baisse anormale ou forte de la séance : un mouvement de cours, qui n\'est pas forcément une nouvelle.'],
    ['Signaux', 'ce que disent actualités, tendance, résultats et qualité de la société, sans l\'objectif des analystes.'],
    ['Somme des lignes', 'l\'addition des prévisions de chaque ligne. Le portefeuille entier est attendu plus haut : une ligne très agitée a une médiane basse, mais toutes ne déçoivent pas en même temps.'],
    ['Point', 'un point de pourcentage : passer de 5 % à 6 %, c\'est gagner un point.'],
  ];
  const totBh = () => {                   // téléphone : le bas et le haut du portefeuille, sous sa ligne
    const p = t.prev && t.prev.an, q = totPrev(d).an; if (!p || p.bas_pct == null || p.haut_pct == null) return '';
    const sh = (q.pct || 0) - (p.pct || 0), v = k => p[k + '_pct'] + sh, e = k => t.valeur ? t.valeur * v(k) / 100 : null;
    const it = (k, up) => `<span class="bh"><span class="ar ${up ? 'up' : 'dn'}" aria-hidden="true">${up ? '▲' : '▼'}</span><span class="bhv ${S.unit === 'eur' ? clsD(e(k), 0) : clsD(v(k), 1)}">${up ? 'Haut' : 'Bas'} ${S.unit === 'eur' ? eurS(e(k)) : pct(v(k), 1)}</span></span>`;
    return `<tr class="bhr vide"><td class="bh0"></td><td class="ge bh0" colspan="4"></td><td class="gp bhc" colspan="7">${it('bas', false)}${it('haut', true)}</td></tr>`; };
  return `<div class="bar2"><h2 id="hTab">Vos lignes</h2><div class="segs">
      <div class="seg" role="group" aria-label="Unité"><button type="button" data-unit="pct" aria-pressed="${S.unit === 'pct'}" aria-label="En pourcentage">%</button><button type="button" data-unit="eur" aria-pressed="${S.unit === 'eur'}" aria-label="En euros">€</button></div>
      <div class="seg vue" role="group" aria-label="Colonnes affichées"><button type="button" data-vue="ev" aria-pressed="${vue === 'ev'}">Évolution</button><button type="button" data-vue="pv" aria-pressed="${vue === 'pv'}">Prévision</button></div></div></div>
    <div class="tw"><table id="tab" class="${vue}" aria-labelledby="hTab">
      <thead><tr class="grp"><td></td><th colspan="4" scope="colgroup" class="ev ge">Évolution</th><th colspan="7" scope="colgroup" class="pv gp">Prévision</th></tr>
      <tr><th scope="col"${['name', 'value'].includes(S.sort[0]) ? ` aria-sort="${S.sort[1] < 0 ? 'descending' : 'ascending'}"` : ''}>${sb('name', 'Action', S.sort, 'data-sort', 'Trier par nom')} <span class="muted" aria-hidden="true">·</span> ${sb('value', 'valeur', S.sort, 'data-sort', 'Trier par valeur')}</th>${EV.map(([k, l], i) => th(k, l, i ? 'ge' : 'ge sep', `Évolution, ${l.toLowerCase()}`)).join('')}
        ${th('pjour', 'Jour', 'gp pvs', 'Prévision, jour : écart habituel', 'Écart habituel de la prochaine séance')}${th('pmois', 'Mois', 'gp pm', 'Prévision, mois')}${th('pan', '1 an', 'gp', 'Prévision, 1 an')}${th('pbas', 'Bas', 'gp pb', 'Prévision, bas à un an', 'Une chance sur six de finir plus bas')}${th('phaut', 'Haut', 'gp pb', 'Prévision, haut à un an', 'Une chance sur six de finir plus haut')}${th('pcinq', '5 ans', 'gp', 'Prévision, 5 ans')}${th('sig', 'Signaux', 'gp lec', 'Signaux', 'Actualités, tendance, résultats et qualité, sans l\'objectif des analystes')}</tr></thead>
      <tbody>${ls.map(row).join('')}</tbody>
      <tfoot><tr><td class="nm"><b>Portefeuille</b><small>${eur(t.valeur)}</small></td>${['jour', 'mois', 'an', 'debut'].map(totEv).join('')}${['jour', 'mois', 'an'].map(totPv).join('')}${totB('bas')}${totB('haut')}${totPv('cinq')}<td class="gp lec"></td></tr>${totBh()}
        <tr class="som"><td class="nm"><b>Somme des lignes</b><small>sans la diversification</small></td><td class="ge sep" colspan="4"></td>${['jour', 'mois', 'an'].map(somPv).join('')}<td class="gp pb"></td><td class="gp pb"></td>${somPv('cinq')}<td class="gp lec"></td></tr></tfoot>
    </table></div>
    <p class="legend">La prévision du portefeuille n'est pas la somme de celles des lignes : une ligne très agitée a une médiane basse, mais toutes ne déçoivent pas en même temps.${corTxt(d)} Ouvrez une ligne pour le pourquoi, les comptes de la société et ses faits marquants.</p>
    <details class="lire" data-det="legend"${detOpen('legend') ? ' open' : ''}><summary>Comment lire ce tableau</summary><dl>${lire.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v.charAt(0).toUpperCase() + v.slice(1))}</dd>`).join('')}</dl></details>`;
}
function foot(d) {
  const fia = d.fiabilite || {};
  return `<section class="foot">
    <div class="box"><h2>Fiabilité des prévisions</h2><p>${esc(fia.texte || '')}</p>
      <p class="note">Part retenue de l'écart des objectifs d'analystes au-delà de leur optimisme habituel : ${num((fia.lam || .5) * 100)}${NB}%. Elle ne bouge qu'avec plusieurs mois de recul ; le détail est dans l'onglet Journal.${d.ia && d.ia.cle ? ' Les titres d\'actualité sont lus par Claude à chaque actualisation.' : ''}</p></div>
    <div class="box"><h2>À savoir</h2><p>${esc(d.note || '')}</p>
      <div class="choix"><button class="btn g sm" type="button" data-sync>Mettre à jour mes positions Trade Republic</button></div></div>
  </section>`;
}
function renderAccueil() {
  const el = $('#accueil'); if (!el) return;
  if (ST || !S.d) { el.innerHTML = ''; return; }
  const acc = S.d.accueil || 'simple';
  el.setAttribute('role', 'radiogroup'); el.setAttribute('aria-label', 'Page d\'ouverture de LUMIO');
  el.innerHTML = `<span class="muted">LUMIO s'ouvre sur :</span>
    <label><input type="radio" name="acc" value="simple" ${acc === 'simple' ? 'checked' : ''}> LUMIO Simple</label>
    <label><input type="radio" name="acc" value="complet" ${acc === 'complet' ? 'checked' : ''}> la version complète</label>`;
}

/* ── Détail d'une ligne ── */
function spark(suivi) {
  const pts_ = (suivi || []).filter(x => x.a != null);
  if (pts_.length < 2) return '';
  const W = 520, H = 56, lo = Math.min(...pts_.map(x => x.a)), hi = Math.max(...pts_.map(x => x.a)), span = hi - lo || .01;
  const X = i => 4 + i * (W - 8) / (pts_.length - 1), Y = v => H - 6 - (v - lo) / span * (H - 12);
  const path = pts_.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.a).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Prévision à un an aux ${pts_.length} dernières actualisations, de ${fr(pts_[0].a)} à ${fr(pts_[pts_.length - 1].a)}">
    <path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${X(pts_.length - 1)}" cy="${Y(pts_[pts_.length - 1].a)}" r="3.5" fill="var(--acc)"/></svg>`;
}
const POL = { 1: ['up', '▲', 'favorable'], '-1': ['dn', '▼', 'défavorable'], 0: ['muted', '•', 'neutre'] };
function newsList(items) {
  return (items || []).map(a => { const [c, s, t] = POL[a.pol] || POL[0];
    const title = a.link && /^https:\/\//.test(a.link) ? `<a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : esc(a.title);
    const age = a.quand ? ` · ${esc(a.quand)}` : a.age_h != null ? ` · il y a ${a.age_h < 1 ? 'moins d\'une heure' : a.age_h < 48 ? Math.round(a.age_h) + ' h' : Math.round(a.age_h / 24) + ' jours'}` : '';
    return `<li><span class="pol ${c}" role="img" title="Titre ${t}" aria-label="${t}">${s}</span><span>${title}<span class="src">${esc(a.source || '')}${age}${a.score ? ` · importance ${a.score}/100` : ''}</span></span></li>`; }).join('');
}
function prevCells(h, withEur) {
  return HZ.map(([k, , lab]) => { const x = h[k];
    if (k === 'jour') return `<div class="cell"><span class="l">${lab}</span><span class="v">${pm(x.ecart, 1)}</span><span class="s">écart habituel${withEur && x.ecart_eur != null ? ` · ±${num(x.ecart_eur)}${NB}€` : ''}</span><span class="s muted">médiane ${fr(x.c, 2)}</span></div>`;
    const dd = Math.abs(x.c) < .01 ? 2 : 1;
    return `<div class="cell"><span class="l">${lab}</span><span class="v ${clsD(x.c * 100, dd)}">${fr(x.c, dd)}</span>${withEur ? `<span class="s ${clsD(x.eur, 0)}">${eurS(x.eur)}</span>` : ''}<span class="s muted">de ${fr(x.bas, 0)} à ${fr(x.haut, 0)}</span>${x.esp != null && k !== 'mois' ? `<span class="s muted">moyenne ${fr(x.esp, 0)}</span>` : ''}</div>`; }).join('');
}
function bhBox(l) {                      // fiche : bas et haut à un an, leur cause, sa date et sa source
  const B = bh(l), b = l.bornes || {}, dt = x => String(x).slice(0, 10).split('-').reverse().join('/');
  const li = (o, k) => { const up = k === 'haut';
    return `<li><span class="pol ${up ? 'up' : 'dn'}" role="img" aria-label="${up ? 'vers le haut' : 'vers le bas'}">${up ? '▲' : '▼'}</span><span><b class="${clsD(o.v * 100, 0)}">${up ? 'Haut' : 'Bas'} ${fr(o.v, 0)}</b>${o.eur != null ? ` (<span class="${clsD(o.eur, 0)}">${eurS(o.eur)}</span>)` : ''}${o.main ? ` : votre chiffre ; modèle ${fr(o.modele, 0)}` : ''}${o.si ? `, ${esc(o.si)}` : ''}.</span></li>`; };
  const g = [];
  if (b.echue && b.echeance) g.push(`Échéance du ${dt(b.echeance)} passée : vos causes${b.bas && b.bas.pct != null || b.haut && b.haut.pct != null ? ' et vos chiffres' : ''} ne sont plus appliqués, à relire.`);
  else if (b.vieux && b.date) g.push(`Causes écrites le ${dt(b.date)}, il y a plus de six semaines : à relire.`);
  // 9.0 : sans cause écrite à la main, deux scénarios écrits automatiquement autour de la principale incertitude de la ligne
  const deRef = B.bas.auto || B.haut.auto;                  // cause tirée des deux issues d'un scénario de référence
  if (b.auto && !deRef) g.push(`Scénarios écrits automatiquement${b.date ? ` le ${dt(b.date)}` : ''} (${esc(b.source || 'LUMIO')}) : deux issues de la principale incertitude du moment, pas une prévision ni un conseil. Les chiffres Bas et Haut restent ceux du modèle.`);
  else if (!b.auto && !b.echue && (b.date || b.source)) g.push(`${b.date ? `Causes écrites le ${dt(b.date)}` : 'Causes'}${b.source ? ` · ${lien({ url: b.url, source: b.source })}` : ''}${b.echeance ? ` · à revoir après le ${dt(b.echeance)}` : ''}.`);
  if (!B.bas.court && !B.haut.court) g.push('Aucune cause écrite pour cette ligne : les deux chiffres sont ceux du modèle.');
  else if (deRef) g.push('Cause tirée des deux issues du scénario qui pèse le plus sur la ligne.');
  return `<section><h3>Bas et haut à un an <small>une chance sur six de finir plus bas, une sur six plus haut</small></h3>
    <ul class="news bhf">${li(B.bas, 'bas')}${li(B.haut, 'haut')}</ul>${g.map(x => `<p class="guard">${x}</p>`).join('')}</section>`;
}
const ETAT = { solide: ['f', 'Solides'], correcte: ['n', 'Corrects'], fragile: ['w', 'Fragiles'], critique: ['d', 'Critiques'] };
function comptesBox(c) {                 // état financier de la société : ce qui est vérifié, ce qui manque
  if (!c) return '';
  const [k, lab] = ETAT[c.etat] || ['', ''];
  const li = (c.points || []).map(p => `<li><span class="pol ${p.sens > 0 ? 'up' : p.sens < 0 ? 'dn' : 'muted'}" role="img" aria-label="${p.sens > 0 ? 'favorable' : p.sens < 0 ? 'défavorable' : 'neutre'}">${p.sens > 0 ? '▲' : p.sens < 0 ? '▼' : '•'}</span><span>${esc(p.txt)}${/[.!?]$/.test(p.txt) ? '' : '.'}${p.source ? `<span class="src">${lien({ url: p.url, source: p.source })}</span>` : ''}</span></li>`).join('');
  return `<section><h3>Comptes <small>${c.etat ? `<span class="etat e-${k}">${lab}</span>` : c.indispo ? 'indisponibles' : 'non établis'}</small></h3>
    ${c.resume ? `<p class="cpt-r">${esc(c.resume)}</p>` : ''}${li ? `<ul class="news cpt">${li}</ul>` : ''}
    ${(c.manque || []).length && !c.indispo ? `<p class="guard">Non trouvé : ${esc(c.manque.join(', '))}.</p>` : ''}
    ${c.source ? `<p class="guard">Source : ${esc(c.source)}${c.date ? ` · ${esc(c.date)}` : ''}.</p>` : ''}</section>`;
}
function faitsBox(fs, ok, lus) {         // faits majeurs des 90 derniers jours, même anciens de plusieurs semaines
  if (!fs) return '';
  const tete = '<h3>Faits marquants <small>90 derniers jours</small></h3>';
  // La reconnaissance se fait sur les mots des titres : on dit ce qui a été lu, pas « il ne s'est rien passé »
  const parmi = lus === 1 ? ' dans le seul titre lu' : lus ? ` parmi les ${num(lus)} titres lus` : '';
  const limite = ' Les faits sont reconnus aux mots des titres (capital, cotation, prévisions, enquête, rachat, dirigeant…) : une tournure inhabituelle peut échapper.';
  if (!fs.length) return `<section>${tete}<p class="empty">${ok === false ? 'Recherche indisponible : la source n\'a pas répondu à la dernière lecture. Rien n\'a pu être vérifié sur 90 jours.'
    : ok == null ? 'Recherche sur 90 jours pas encore faite pour cette société : seuls les titres de la semaine ont été lus, sans fait majeur reconnu.'
    : ok === 'partiel' ? `Aucun fait majeur reconnu${parmi}, mais la recherche est incomplète : une partie des sources n\'a pas répondu.`
    : `Aucun fait majeur reconnu${parmi} sur 90 jours.${limite}`}</p></section>`;
  const li = fs.map(x => { const [c, s, t] = POL[x.sens] || POL[0];
    const title = x.link && /^https:\/\//.test(x.link) ? `<a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.titre)}</a>` : esc(x.titre);
    const quand = x.date ? `le ${esc(x.date)}` : x.jour ? `le ${esc(jourIso(x.jour))}` : x.age_j != null ? (x.age_j < 1 ? 'aujourd\'hui' : `il y a ${Math.round(x.age_j)} jour${plur(Math.round(x.age_j))}`) : '';
    // 8.8 : un fait défait depuis (« suite ») le dit ; un fait ouvert montre les titres parus depuis sur son sujet
    const lien = (y, txt) => y.link && /^https:\/\//.test(y.link) ? `<a href="${esc(y.link)}" target="_blank" rel="noopener noreferrer">${esc(txt)}</a>` : esc(txt);
    const suite = x.suite ? `<span class="fm-suite">Depuis : ${esc(String(x.suite.label || '').toLowerCase())} le ${esc(jourIso(x.suite.jour))} (plus haut)</span>` : '';
    const sv = x.suivi && (x.suivi.titres || []).length ? `<span class="fm-suivi">Suites (${esc(x.suivi.sujet)}) :</span><ul class="fm-suites">${x.suivi.titres.map(y => `<li>${esc(jourIso(y.jour))} · ${lien(y, y.titre)}${y.source ? ` <span class="src">${esc(y.source)}</span>` : ''}</li>`).join('')}</ul>` : '';
    return `<li><span class="pol ${c}" role="img" title="Fait ${t}" aria-label="${t}">${s}</span><span><b class="fm-l">${esc(x.label)}</b> · ${title}<span class="src">${esc(x.source || '')}${quand ? `${x.source ? ' · ' : ''}${quand}` : ''}</span>${suite}${sv}</span></li>`; }).join('');
  const avert = ok === false ? 'Recherche sur 90 jours sans réponse à la dernière lecture : ces faits viennent d\'une lecture précédente ou des titres de la semaine.'
    : ok === 'partiel' ? 'Recherche incomplète : une partie des sources n\'a pas répondu.' : '';
  return `<section>${tete}<ul class="news">${li}</ul>${avert ? `<p class="guard">${avert}</p>` : ''}</section>`;
}
function whyList(raisons, avant) {
  return (avant || '') + (raisons || []).map(r => `<li><span>${esc(r.txt)}</span><span class="ef ${cls(r.effet)}">${r.effet != null && Math.abs(r.effet) >= .0005 ? pts(r.effet * 100) : ''}</span></li>`).join('');
}
// Scénario retenu : ce qu'il change à la prévision du modèle, dit en tête du « pourquoi »
function whyScen(x, H) {
  if (H === x.prev.h) return '';
  const noms = (x.scen || []).map(s => { const e = scenEv(s.ev), c = e && e.cas.find(y => y.id === S.scen[s.ev]); return c && s.f[c.id] ? `« ${c.nom} » (${e.titre})` : ''; }).filter(Boolean);
  const b = x.prev.h.an.c, a = H.an.c;
  return `<li class="w-sc"><span>Scénario retenu : ${esc(noms.join(' et '))}. La prévision du modèle, ${fr(b)} à un an, passe à ${fr(a)}. Les lignes suivantes expliquent la prévision du modèle, avant ce choix.</span><span class="ef ${cls(a - b)}">${pts((a - b) * 100)}</span></li>`;
}
function openLine(uid, keepScroll) {
  const l = ((S.d && S.d.lignes) || []).find(x => x.uid === uid); if (!l) return;
  S.open = 'L:' + uid;
  const b = $('#pB');
  const top = keepScroll ? b.scrollTop : 0;
  const nv = (l.durables || []).filter(x => !S.vus[l.uid + '|' + x.k]);       // lues : le « ! » de la ligne s'éteindra
  if (nv.length) { nv.forEach(x => { S.vus[l.uid + '|' + x.k] = 1; }); keep('simple.vus', S.vus); S.vuDirty = true; }
  $('#pT').textContent = l.name;
  $('#pS').innerHTML = `${eur(l.value)} · ${num(l.weight, 1)}${NB}% du portefeuille · <span class="${cls(l.debut.eur)}">${eurS(l.debut.eur)} (${pct(l.debut.pct)})</span> depuis l'achat`;
  const [sc, sl] = sigOf(l.prev.signaux);
  const H = hL(l);
  const rv = l.revision;
  const rvTxt = rv && rv.sens ? `Revue ${rv.sens > 0 ? 'à la hausse' : 'à la baisse'} depuis la veille, hors effet du cours : ${pts(rv.delta * 100)} (objectifs d'analystes ou signaux)${rv.serie >= 2 ? ', deux jours de suite' : ''}${rv.cumul != null && Math.abs(rv.cumul) >= .01 ? ` ; ${pts(rv.cumul * 100)} sur la semaine` : ''}.`
    : rv ? 'Pas de révision depuis la veille, hors effet du cours.' : 'Les révisions apparaîtront après une journée de suivi.';
  // La médiane affichée, comparée à celle du marché mondial : le même repère que pour les opportunités
  const mm = S.d.marche_an == null ? .07 : S.d.marche_an, ec = H.an.c - mm;
  const vmTxt = ` · ${ec >= .03 ? 'au-dessus du' : ec <= -.03 ? 'sous le' : 'proche du'} marché mondial (${fr(mm, 0)} attendu)`;
  const agTxt = agite(H.an) || agite(H.cinq) ? ` · valeur très agitée : médiane sous la moyenne attendue (${fr(H.an.esp, 0)} à un an)` : '';
  const evo = EV.map(([k, lab]) => `<div class="cell"><span class="l">${lab}</span><span class="v ${cls(l[k].pct)}">${pct(l[k].pct, 1)}</span><span class="s ${cls(l[k].eur)}">${eurS(l[k].eur)}</span></div>`).join('');
  const tn = l.ton || {};
  const cons = l.cons, so = l.sources || {};
  b.innerHTML = `
    ${(l.alertes || []).length ? `<div>${(Array.isArray(l.motifs) ? [...(l.cours_alerte ? [{ t: 'chute', txt: l.cours_alerte }] : []), ...l.motifs] : l.alertes.map(x => ({ t: '', txt: x })))
      .map(m => `<span class="tag ${esc(m.t || '')}">${esc(m.txt)}</span>`).join('')}</div>` : ''}
    <div class="lect ${sc}">Prévision à un an, médiane <b class="${clsD(H.an.c * 100, 1)}">${fr(H.an.c)}</b> (<span class="${clsD(H.an.eur, 0)}">${eurS(H.an.eur)}</span>)${H !== l.prev.h ? ' selon le scénario choisi' : (l.scen || []).length ? ' du modèle, avant tout choix de scénario' : ''}${vmTxt}${agTxt} · signaux <b>${esc(sl.toLowerCase())}</b>${l.prev.retard ? ' · objectifs d\'analystes probablement en retard sur la baisse' : ''}. ${esc(rvTxt)}</div>
    <section><h3>Évolution <small>votre ligne</small></h3><div class="grid4">${evo}</div></section>
    <section><h3>Prévision <small>médiane · fourchette où le cours finit deux fois sur trois</small></h3><div class="grid4">${prevCells(H, true)}</div>
      ${spark(l.suivi)}${(l.suivi || []).length > 1 ? `<p class="guard">Prévision à un an du modèle aux ${l.suivi.length} dernières actualisations.</p>` : ''}</section>
    ${bhBox(l)}${scenDetail(l, l.value)}
    <section><h3>Pourquoi cette prévision <small>effet sur un an</small></h3><ul class="why">${whyList(l.raisons, whyScen(l, H))}</ul></section>
    ${comptesBox(l.comptes)}${faitsBox(l.faits, so.faits, l.faits_lus)}
    <section><h3>Actualités <small>${tn.n ? `${tn.pos} favorable${plur(tn.pos)} · ${tn.neg} défavorable${plur(tn.neg)} · ${tn.neu} neutre${plur(tn.neu)}` : '7 derniers jours'}</small></h3>
      ${l.ia && l.ia.resume ? `<div class="ia"><b>Lecture de Claude</b> · ${esc(l.ia.resume)}</div>` : ''}
      ${(l.actus || []).length ? `<ul class="news">${newsList(l.actus)}</ul>` : `<p class="empty">${so.actus === false ? 'Actualités indisponibles : la source n\'a pas répondu à la dernière lecture.' : so.actus === 'partiel' ? 'Aucune actualité repérée sur 7 jours, mais la recherche est incomplète : une partie des sources n\'a pas répondu.' : 'Aucune actualité repérée sur 7 jours.'}</p>`}</section>
    <section><h3>La ligne</h3><div class="rows">
      <div><span>Cours</span><span>${l.cours_txt ? esc(l.cours_txt) : l.cours != null ? `${num(l.cours, 2)} ${esc(l.devise === 'EUR' ? '€' : l.devise || '')}` : '—'}${!l.cours_txt && l.devise && l.devise !== 'EUR' && l.prix ? ` · ${num(l.prix, 2)}${NB}€` : ''}${!l.cours_txt && l.cours_ts ? ` · ${when(l.cours_ts)}${l.cours_src === 'tr' ? ' (Trade Republic)' : ''}` : ''}</span></div>
      ${l.quantity != null ? `<div><span>Quantité</span><span>${num(l.quantity, l.quantity % 1 ? 3 : 0)}</span></div>` : ''}
      ${l.investi != null ? `<div><span>Montant investi</span><span>${eur(l.investi)}</span></div>` : ''}
      ${l.source ? `<div><span>Sources</span><span>${esc(l.source)}</span></div>` : ''}
      ${l.veille ? `<div><span>À surveiller</span><span>${esc(l.veille)}</span></div>` : ''}
      ${cons ? `<div><span>Objectif moyen des analystes</span><span>${num(cons.cible, 2)} ${esc(cons.ccy === 'EUR' ? '€' : cons.ccy)} (${fr(cons.g)}) · ${cons.n} analystes</span></div>` : ''}
      <div><span>Thème</span><span><select class="sel" id="thSel" aria-label="Thème de ${esc(l.name)}" ${ST ? 'disabled title="À changer sur le PC"' : ''}>
        <option value="auto">Automatique</option>${(S.d.themes || []).map(t => `<option value="${t.k}" ${!l.theme_auto && t.k === l.theme ? 'selected' : ''}>${esc(t.label)}${l.theme_auto && t.k === l.theme ? ' (automatique)' : ''}</option>`).join('')}</select></span></div>
    </div></section>
    <a class="btn g sm" href="${FULL}#/accueil?p=${encodeURIComponent(l.uid)}">Fiche complète dans LUMIO</a>
    <p class="guard">Une prévision est une estimation, pas une promesse : LUMIO ne passe aucun ordre et ne dit pas quoi acheter ni vendre.</p>`;
  const sel = $('#thSel');
  if (sel) { if (l.theme_auto) sel.value = 'auto'; sel.onchange = () => setTheme(l.uid, sel.value); }
  showPanel();
  b.scrollTop = top;
}
function showPanel(sel) {                // sel : élément à cibler à l'ouverture (sinon le bouton Fermer)
  const pn = $('#panel');
  if (!pn.hidden) return;
  S.opener = document.activeElement; pn.hidden = false; $('#scrim').hidden = false; document.body.style.overflow = 'hidden';
  try { history.pushState({ lumioPanneau: 1 }, ''); S.hist = true; } catch (e) { S.hist = false; }    // « Précédent » ferme le panneau
  setTimeout(() => { const i = sel && pn.querySelector(sel); (i || $('#pX')).focus(); }, 30);
}
function closePanel(parRetour) {
  const pn = $('#panel'); if (pn.hidden) return;
  pn.hidden = true; $('#scrim').hidden = true; document.body.style.overflow = '';
  if (S.hist && !parRetour) { S.skipPop = true; try { history.back(); } catch (e) { S.skipPop = false; } }
  S.hist = false;
  const o = S.open, op = S.opener; S.open = null; S.opener = null;
  if (S.vuDirty) { S.vuDirty = false; if (S.d && !S.d.empty) render(); }
  // visible : affiché, et pas dans un volet replié (son contenu garde un offsetParent dans Chrome)
  const visible = el => !!el && el !== document.body && document.contains(el) && el.offsetParent !== null
    && !(el.closest('details:not([open])') && !el.closest('summary')) && (!el.checkVisibility || el.checkVisibility());
  const row = o && o.startsWith('L:') ? document.querySelector(`#tab tr[data-uid="${CSS.escape(o.slice(2))}"] .ln`)
    : o && o.startsWith('O:') ? [...document.querySelectorAll(`.otab tr[data-tk="${CSS.escape(o.slice(2))}"] .ln`)].find(visible) : null;
  const cible = (visible(row) ? row : null) || (visible(op) ? op : null) || (o && o.startsWith('O:') && visible($('#hOpp')) ? $('#hOpp') : null) || $(`#t-${S.tab}`);
  if (cible) cible.focus();
}
async function setTheme(uid, k) {
  try { await api('/api/simple/theme', { method: 'PUT', body: { uid, theme: k } }); toast('Thème enregistré'); S.open = 'L:' + uid; await load(true); openLine(uid, true); const s = $('#thSel'); if (s) s.focus(); }
  catch (e) {
    const l = ((S.d && S.d.lignes) || []).find(x => x.uid === uid), s = $('#thSel');
    if (l && s) s.value = l.theme_auto ? 'auto' : l.theme;
    toast(e.readonly ? 'En ligne, LUMIO est en lecture seule : changez le thème sur le PC.' : `Thème non enregistré : ${lc(msgErr(e))}.`, true);
  }
}

/* ── Opportunités ── */
const ORIG = { liste: 'suivie par LUMIO', ruptures: 'veille Ruptures', watchlist: 'votre watchlist' };
const caTxt = o => o.croissance == null ? '—' : o.croissance_type === 'attendue'
  ? `${fr(o.croissance, 0)} attendu sur l'exercice en cours${o.croissance_suivante != null ? `, ${fr(o.croissance_suivante, 0)} sur le suivant` : ''} (analystes)`
  : `${fr(o.croissance, 0)} sur un an au dernier trimestre`;
const ATTENTE = quoi => `<div class="box wait" role="status"><span class="ico-r" aria-hidden="true"></span>Chargement ${quoi}…</div>`;
async function loadOpp(force) {
  clearTimeout(S.oppT);
  const v = $('#v-opportunites');
  if (!S.opp) { v.innerHTML = ATTENTE('des opportunités'); v.setAttribute('aria-busy', 'true'); }
  try {
    const d = await api('/api/simple/opportunites');
    if (!Array.isArray(d.items)) throw illisible();
    S.opp = d; scenClean(); renderOpp();
    if (d.en_cours) S.oppT = setTimeout(() => loadOpp(), 6000);
  } catch (e) {
    if (S.opp) toast(`Veille non relue : ${lc(msgErr(e))}. Les chiffres affichés sont ceux de la lecture précédente.`, true);
    else v.innerHTML = `<div class="band l1" role="alert"><span class="lv"><i></i>Veille indisponible</span><span class="why">${e.illisible ? 'La réponse reçue est illisible' : esc(msgErr(e))} : rechargez la page.</span></div>`;
  }
  v.removeAttribute('aria-busy');
  if (force) paintFresh();
}
function renderOpp() {
  const d = S.opp, v = $('#v-opportunites');
  if (S.tab === 'opportunites') paintFresh();
  paintGo();
  if (!d) return;
  const fk = focusKey(v);
  const hz = S.ohz === 'cinq' ? 'cinq' : 'an', n = d.top_n || 5, pl = (d.plancher || {})[hz];
  const ranked = (d.items || []).map(o => ({ o, h: hx(o) })).filter(x => x.h[hz] && x.h[hz].c != null).sort((a, b) => b.h[hz].c - a.h[hz].c);
  const top = (pl == null ? ranked : ranked.filter(x => x.h[hz].c > pl)).slice(0, n);      // au-dessus du marché mondial seulement
  const sous = pl == null ? [] : ranked.filter(x => x.h[hz].c <= pl);                    // les suivantes, repliées
  const ex = d.exclues || {};
  const nd = (d.n_au_dessus || {})[hz];
  const exTxt = [['detenue', 'déjà en portefeuille'], ['analystes', 'moins de 5 analystes'], ['taille', 'capitalisation sous 2 milliards d\'euros'], ['cours', 'sans cours'], ['donnees', 'données insuffisantes']]
    .filter(([k]) => ex[k]).map(([k, l]) => `${ex[k]} ${l}`).join(', ');
  const hzTxt = hz === 'an' ? 'à un an' : 'à cinq ans';
  const plTxt = pl == null ? '' : hz === 'an' ? `${fr(pl, 0)} à un an` : `${fr(pl, 0)} à cinq ans, soit ${fr(Math.pow(1 + pl, .2) - 1, 0)} par an`;
  const titre = !ranked.length ? 'Sociétés à étudier' : top.length >= n ? `Les ${n} sociétés au meilleur rendement estimé ${hzTxt}`
    : top.length > 1 ? `Les ${top.length} seules sociétés attendues au-dessus du marché mondial ${hzTxt}`
    : top.length ? `La seule société attendue au-dessus du marché mondial ${hzTxt}` : `Aucune société attendue au-dessus du marché mondial ${hzTxt}`;
  const head = `<div class="o-head"><div><h2 id="hOpp" tabindex="-1">Opportunités</h2><p>${titre}, hors vos lignes · ni recommandation ni conseil${d.asof ? ` · calculé ${ago(d.asof)}` : ''}</p></div>
    <div class="seg" role="group" aria-label="Horizon du rendement"><button type="button" data-ohz="an" aria-pressed="${hz === 'an'}">À un an</button><button type="button" data-ohz="cinq" aria-pressed="${hz === 'cinq'}">À cinq ans</button></div></div>`;
  const fin = () => { apres(v); if (fk && $('#panel').hidden) { const el = v.querySelector(fk); if (el) el.focus({ preventScroll: true }); } };
  if (!ranked.length) {
    v.innerHTML = head + (d.en_cours ? '<div class="box wait"><span class="ico-r" aria-hidden="true"></span>Calcul de la veille en cours : chaque société est relue (cours, objectifs d\'analystes, actualités). Une à deux minutes.</div>'
      : `<div class="box"><p class="empty">${d.erreur ? `La veille n'a pas pu être calculée (${esc(d.erreur)}).` : 'Aucune société classée pour l\'instant.'} Utilisez « Actualiser » pour relancer le calcul.</p></div>`)
      + `<p class="o-meth">${esc(d.methode || '')}</p>`;
    fin(); return;
  }
  const cpm = c => c && (c.etat === 'fragile' || c.etat === 'critique') ? ` · <span class="${c.etat === 'critique' ? 'dn' : 'wa'}">comptes ${c.etat === 'critique' ? 'critiques' : 'fragiles'}</span>` : '';
  const row = ({ o, h }, i) => { const x = h[hz], r = risque(h, hz);
    return `<tr data-tk="${esc(o.ticker)}">
      <td class="nm"><b><span class="rang" aria-hidden="true">${i + 1}</span><button type="button" class="ln" aria-haspopup="dialog" aria-label="${i + 1}. ${esc(o.name)}">${esc(o.name)}</button>${scMark(o, true)}</b><small>${esc(o.theme_label || '')}${cpm(o.comptes)}</small></td>
      <td class="${clsD(x.c * 100, 0)}"><b>${agite(x) ? '<span class="tl" title="Valeur très agitée : médiane négative, moyenne attendue positive"><span aria-hidden="true">~</span><span class="sr">valeur très agitée, médiane </span></span>' : ''}${fr(x.c, pl != null && Math.abs(x.c - pl) < .01 ? 1 : 0)}</b>${hz === 'cinq' ? `<small class="th">${fr(Math.pow(1 + x.c, .2) - 1, 1)} par an</small>` : ''}</td>
      <td class="o-x">de <span class="${clsD(x.bas * 100, 0)}">${fr(x.bas, 0)}</span> à <span class="${clsD(x.haut * 100, 0)}">${fr(x.haut, 0)}</span></td>
      <td class="rq">${r ? `<span class="rk r${r.n}">${r.label.charAt(0).toUpperCase() + r.label.slice(1)}</span><small class="th">${num(r.p * 100, 0)}${NB}% de risque de perte</small>` : '—'}</td>
      <td class="o-x">${o.cons ? `<span class="${clsD(o.cons.g * 100, 0)}">${fr(o.cons.g, 0)}</span><small class="th">${o.cons.n} analystes</small>` : '—'}</td></tr>`; };
  const tab = (rows, i0, lab) => `<div class="tw"><table class="otab" aria-label="${esc(lab)}">
      <thead><tr><th scope="col">Société</th><th scope="col" title="Une chance sur deux de faire mieux">Rendement estimé<small class="th">médiane ${hzTxt}</small></th><th scope="col" class="o-x">Fourchette<small class="th">deux fois sur trois</small></th>
        <th scope="col" class="rq" title="Volatilité retenue par le modèle à un an, et probabilité de finir sous le cours actuel ${hzTxt}">Volatilité<small class="th">et risque de perte</small></th><th scope="col" class="o-x" title="Écart entre l'objectif moyen des analystes et le cours">Objectif des analystes<small class="th">écart au cours, souvent optimiste</small></th></tr></thead>
      <tbody>${rows.map((x, i) => row(x, i0 + i)).join('')}</tbody></table></div>`;
  let g = 0;
  const scs = ranked.filter(({ o }) => (o.scen || []).length).map(({ o }) => o.scen.map(s => { const ev = scenEv(s.ev); if (!ev) return '';
    const rg = top.findIndex(x => x.o === o) + 1, rs = sous.findIndex(x => x.o === o) + 1; g += 1;
    return `<li><b>${esc(o.name)}</b> <span class="muted">(${rg ? `n°${NB}${rg} du classement` : rs ? `n°${NB}${top.length + rs}, sous le marché mondial` : `au-delà des ${n} premières`})</span> · ${esc(ev.titre)} : ${ev.cas.map(c => { const v2 = scCas(o, ev, c); return `${esc(c.nom.toLowerCase())} <span class="${clsD(v2[hz] * 100, 0)}">${fr(v2[hz], 0)}</span>`; }).join(' ; ')} ${hzTxt}.${choixBtns(ev, null, 'o' + g)}</li>`; }).join('')).join('');
  const vide = top.length ? '' : `<div class="box"><p class="empty">Aucune des ${d.n_classees != null ? d.n_classees : ranked.length} sociétés classées n'est attendue au-dessus du marché mondial (${plTxt})${hz === 'cinq' ? ' : sur une longue durée, les à-coups d\'une action seule pèsent sur son rendement médian' : ''}. Les mieux classées restent listées ci-dessous, pour information.</p></div>`;
  v.innerHTML = head + `${d.en_cours ? '<div class="wait"><span class="ico-r" aria-hidden="true"></span>Nouveau calcul en cours…</div>' : ''}
    ${vide}${top.length ? tab(top, 0, `Opportunités : rendement estimé ${hzTxt}`) : ''}
    ${sous.length ? `<details class="o-sous" data-det="opp-sous-${hz}${top.length ? '' : '-seules'}"${detOpen(`opp-sous-${hz}${top.length ? '' : '-seules'}`, !top.length) ? ' open' : ''}><summary>${(() => { const tot = d.n_classees != null && nd != null ? Math.max(sous.length, d.n_classees - nd) : sous.length; return `${top.length ? `${tot} autre${plur(tot)}` : tot} société${plur(tot)} classée${plur(tot)}, attendue${plur(tot)} sous le marché mondial (${plTxt})` + (tot > sous.length ? ` : les ${sous.length} mieux classées` : ''); })()}</summary>${tab(sous, top.length, `Sociétés attendues sous le marché mondial ${hzTxt}`)}</details>` : ''}
    ${scs ? `<section class="box o-sc"><h3>Deux scénarios <small>selon l'issue choisie, le classement change ; ce choix vaut aussi pour vos lignes</small></h3><ul>${scs}</ul></section>` : ''}
    <p class="legend">${esc(d.methode || '')} ${d.n_classees != null ? `Sur ${d.n_univers} sociétés suivies : ${d.n_classees} classées${nd != null && pl != null ? `, dont ${nd} attendue${plur(nd)} au-dessus du marché mondial ${hzTxt} avant tout scénario` : ''}${exTxt ? ` ; écartées : ${exTxt}` : ''}.` : ''} ${esc(d.note || '')}</p>`;
  fin();
}
function openOpp(tk, keepScroll) {
  const o = ((S.opp && S.opp.items) || []).find(x => x.ticker === tk); if (!o) return;
  S.open = 'O:' + tk;
  const b = $('#pB'), top0 = keepScroll ? b.scrollTop : 0;
  const H = hx(o), ra = risque(H, 'an'), r5 = risque(H, 'cinq');
  $('#pT').textContent = o.name;
  $('#pS').textContent = `${o.theme_label || ''} · ${o.ticker} · ${num(o.cours, o.cours >= 1000 ? 0 : 2)} ${o.devise === 'EUR' ? '€' : o.devise || ''}`;
  const [sc, sl] = sigOf(o.prev.signaux);
  const perf = [['jour', 'Jour', o.jour], ['1m', '1 mois', (o.perf || {})['1m']], ['3m', '3 mois', (o.perf || {})['3m']], ['1y', '1 an', (o.perf || {})['1y']]]
    .map(([, lab, x]) => `<div class="cell"><span class="l">${lab}</span><span class="v ${cls(x)}">${pct(x, 1)}</span></div>`).join('');
  const c = o.cons;
  const tn = o.ton || {}, so = o.sources || {};
  b.innerHTML = `
    ${o.prev.retard ? '<div><span class="tag">Objectifs d\'analystes probablement en retard sur la baisse : part réduite de moitié</span></div>' : ''}
    <div class="lect ${sc}">Rendement estimé (médiane) : à un an <b class="${clsD(H.an.c * 100, 1)}">${fr(H.an.c)}</b>, à cinq ans <b class="${clsD(H.cinq.c * 100, 0)}">${fr(H.cinq.c, 0)}</b>
      (<span class="${clsD((Math.pow(1 + H.cinq.c, .2) - 1) * 100, 1)}">${fr(Math.pow(1 + H.cinq.c, .2) - 1, 1)}</span> par an)${H !== o.prev.h ? ' selon le scénario choisi' : ''}
      ${ra ? ` · volatilité <b>${ra.label}</b> · ${num(ra.p * 100, 0)}${NB}% de risque de perte à un an${r5 ? `, ${num(r5.p * 100, 0)}${NB}% à cinq ans` : ''}` : ''} · signaux <b>${esc(sl.toLowerCase())}</b>.</div>
    ${scenDetail(o, null)}
    <section><h3>Prévision <small>médiane · fourchette où le cours finit deux fois sur trois</small></h3><div class="grid4">${prevCells(H, false)}</div></section>
    <section><h3>Pourquoi cette prévision <small>effet sur un an</small></h3><ul class="why">${whyList(o.raisons, whyScen(o, H))}</ul></section>
    ${comptesBox(o.comptes)}${faitsBox(o.faits, so.faits, o.faits_lus)}
    <section><h3>Évolution du cours</h3><div class="grid4">${perf}</div>${o.sous_haut != null && Math.abs(o.sous_haut) >= 1 ? `<p class="guard">${num(Math.abs(o.sous_haut), 0)}${NB}% sous son plus haut sur un an.</p>` : o.sous_haut != null ? '<p class="guard">Au plus haut de l\'année.</p>' : ''}</section>
    ${(o.notes || []).length ? `<section><h3>À savoir</h3><ul class="why">${o.notes.map(n => `<li><span>${esc(n)}</span></li>`).join('')}</ul></section>` : ''}
    <section><h3>Actualités <small>${tn.n ? `${tn.pos} favorable${plur(tn.pos)} · ${tn.neg} défavorable${plur(tn.neg)} · ${tn.neu} neutre${plur(tn.neu)}` : '7 derniers jours'}</small></h3>
      ${(o.actus || []).length ? `<ul class="news">${newsList(o.actus)}</ul>` : so.actus === false ? '<p class="empty">Actualités indisponibles : la source n\'a pas répondu à la dernière lecture.</p>' : o.ton ? '<p class="empty">Aucune actualité repérée sur 7 jours.</p>' : '<p class="empty">Seules les sociétés les mieux classées sont relues à chaque calcul.</p>'}</section>
    <section><h3>La société</h3><div class="rows">
      <div><span>Capitalisation</span><span>${o.capi_eur ? `${num(o.capi_eur / 1e9, o.capi_eur >= 1e11 ? 0 : 1)} milliard${o.capi_eur >= 2e9 ? 's' : ''} d'euros` : o.capi ? `${num(o.capi / 1e9, o.capi >= 1e11 ? 0 : 1)} milliard${o.capi >= 2e9 ? 's' : ''} ${esc(o.capi_ccy || o.devise || '')}` : '—'}</span></div>
      <div><span>Chiffre d'affaires</span><span>${caTxt(o)}</span></div>
      <div><span>Marge nette</span><span>${o.marge != null ? pct(o.marge * 100, 0).replace('+', '') : '—'}</span></div>
      <div><span>Valorisation</span><span>${o.pe ? `${num(o.pe, 0)} fois les bénéfices attendus` : '—'}</span></div>
      ${c ? `<div><span>Objectif moyen des analystes</span><span>${num(c.cible, 2)} ${esc(c.ccy === 'EUR' ? '€' : c.ccy)} (${fr(c.g)}) · ${c.n} analystes${c.bas && c.haut ? ` · de ${num(c.bas, 0)} à ${num(c.haut, 0)}` : ''}</span></div>` : ''}
      <div><span>Origine</span><span>${esc(ORIG[o.origine] || o.origine || '—')}</span></div>
    </div></section>
    <p class="guard">Une société à étudier, ni recommandation ni conseil : des estimations d'un modèle qui se trompe aussi. LUMIO ne passe aucun ordre.</p>`;
  showPanel();
  b.scrollTop = top0;
}

/* ── Journal ── */
async function loadJou() {
  if (!S.jou) { $('#jou').innerHTML = ATTENTE('du journal'); $('#jou').setAttribute('aria-busy', 'true'); }
  try {
    const j = await api('/api/simple/journal');
    if (!('n_maj' in j) && !isObj(j.bilan) && !Array.isArray(j.serie)) throw illisible();
    S.jou = j; $('#jou').removeAttribute('aria-busy'); renderJou(); return true;
  } catch (e) {
    $('#jou').removeAttribute('aria-busy');
    if (S.jou) { toast(`Journal non relu : ${lc(msgErr(e))}.`, true); return false; }
    $('#jou').innerHTML = `<div class="band l1" role="alert"><span class="lv"><i></i>Journal indisponible</span><span class="why">${e.illisible ? 'La réponse reçue est illisible' : esc(e.message)} : rechargez la page${ST ? '' : ' ; si cela persiste, redémarrez LUMIO sur le PC'}.</span></div>`; return false; }
}
function chart(serie) {
  const pts_ = (serie || []).filter(p => p.v);
  if (pts_.length < 2) return '<p class="empty">La courbe apparaît après deux actualisations.</p>';
  const box = $('#jou'), cw = box && box.clientWidth ? box.clientWidth : 0;
  const W = Math.round(Math.max(220, Math.min(640, cw > 860 ? cw / 2 - 40 : cw - 34))) || 640, H = 160, L = 6, R = 6, T = 16, B = 22;   // à l'échelle 1 : texte des axes lisible
  const lo = Math.min(...pts_.map(p => p.v)), hi = Math.max(...pts_.map(p => p.v)), span = hi - lo || 1;
  const t0 = pts_[0].t, t1 = pts_[pts_.length - 1].t, ts = t1 - t0 || 1;
  const X = t => L + (t - t0) / ts * (W - L - R), Y = v => T + (1 - (v - lo) / span) * (H - T - B);
  const path = pts_.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const meme = new Date(t0 * 1000).toDateString() === new Date(t1 * 1000).toDateString();      // relevés d'une même journée : l'heure
  const dt = t => meme ? `${jour(t)}, ${heure(t)}` : jour(t);
  const dots = pts_.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="6" fill="transparent"><title>${dt(p.t)} : ${eur(p.v)}${p.pa != null ? ` · prévision à un an ${pct(p.pa, 1)}` : ''}</title></circle>`).join('');
  const last = pts_[pts_.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="Valeur du portefeuille à chaque actualisation, de ${eur(pts_[0].v)} le ${dt(t0)} à ${eur(last.v)} le ${dt(t1)}">
    <path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="3.5" fill="var(--acc)"/>${dots}
    <text class="ax" x="${L}" y="${H - 5}">${dt(t0)}</text><text class="ax" x="${W - R}" y="${H - 5}" text-anchor="end">${dt(t1)}</text>
    <text class="ax" x="${W - R}" y="${T - 4}" text-anchor="end">plus haut ${eur(hi)}</text><text class="ax" x="${W - R}" y="${H - B - 4}" text-anchor="end">plus bas ${eur(lo)}</text></svg>`;
}
function apprend(a) {
  if (!a) return '';
  const row = (lab, n, mo) => { const ok = a.n >= n && a.mois >= mo; return `<li><span>${lab}</span><span class="${ok ? 'ok' : 'muted'}">${ok ? 'actif' : `${num(Math.min(a.n, n))}/${n} vérifications${mo ? ` · ${num(Math.min(a.mois, mo))}/${mo} mois` : ''}`}</span></li>`; };
  return `<h3 class="sous">Recul nécessaire avant chaque réglage</h3><ul class="prog">${row('Fourchettes', a.fourch, 0)}${row('Objectifs d\'analystes', a.lam[0], a.lam[1])}${row('Biais', a.biais[0], a.biais[1])}${row('Signaux', a.signal[0], a.signal[1])}</ul>`;
}
const LK = { biais: 'Biais', sens: 'Sens', fourchette: 'Fourchettes', marche: 'Marché', signal: 'Signaux', analystes: 'Analystes', ecart: 'Écart' };
function renderJou() {
  const j = S.jou, el = $('#jou');
  if (S.tab === 'journal') paintFresh();
  if (!j) return;
  const b = j.bilan || {}, m = b.mois || {}, r = j.reg || {};
  const tile = (l, v, s) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s muted">${s}</span></div>`;
  const tiles = `<section class="j-grid" aria-label="Bilan des prévisions">
    ${tile('Prévisions vérifiées', num(m.n || 0), 'à un mois')}
    ${tile('Sens juste', m.sens_pct != null ? num(m.sens_pct) + NB + '%' : '—', 'hausse ou baisse bien annoncée')}
    ${tile('Biais moyen', m.biais != null ? pts(m.biais * 100) : '—', m.biais == null ? 'pas encore mesuré' : m.biais < 0 ? 'trop optimiste' : 'trop prudent')}
    ${tile('Dans la fourchette', m.fourchette_pct != null ? num(m.fourchette_pct) + NB + '%' : '—', '68 % visés')}
  </section>`;
  const lec = (j.lecons || []).length ? `<ul class="lecons">${j.lecons.map(x => `<li><span class="k">${esc(LK[x.k] || 'Leçon')}</span><span>${esc(x.txt)}</span></li>`).join('')}</ul>`
    : `<p class="empty">${esc(b.texte || 'Les leçons apparaissent quand les premières prévisions arrivent à échéance (un mois).')}</p>`;
  const pw = r.poids || {};
  const regs = `<div class="rows">
      <div><span>Part retenue des objectifs d'analystes</span><span>${num((r.lam || .5) * 100)}${NB}%</span></div>
      <div><span>Correction des prévisions</span><span>${r.corr_m ? pts(r.corr_m * 100) + ' par mois' : 'aucune'}</span></div>
      <div><span>Poids des actualités · de la tendance</span><span>×${num(pw.news || 1, 2)} · ×${num(pw.tend || 1, 2)}</span></div>
      <div><span>Largeur des fourchettes</span><span>×${num(r.k_sig || 1, 2)}</span></div></div>
    ${apprend(b.apprend)}
    ${(j.reglages || []).length ? `<ul class="act">${j.reglages.map(x => `<li><span>${when(x.ts)}</span><span>${esc(x.changes.join(' ; '))}</span><span class="muted">${esc(x.pourquoi || '')}</span></li>`).join('')}</ul>` : '<p class="guard sous">Aucun réglage pour l\'instant : LUMIO attend d\'avoir assez de recul.</p>'}`;
  const pas = (j.passees || []).slice(0, 40);
  const passTab = pas.length ? `<div class="tw"><table class="mini" aria-label="Prévisions passées à un mois, contre la réalité"><thead><tr><th scope="col">Ligne</th><th scope="col" class="o-x">Période</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Sens</th><th scope="col" class="o-x">Fourchette</th><th scope="col" class="o-x">Écart venu</th></tr></thead>
      <tbody>${pas.map(p => `<tr><td class="nm"><b>${esc(p.ligne)}</b><small class="per">${jour(p.t0)} → ${jour(p.t1)}</small></td><td class="o-x muted">${jour(p.t0)} → ${jour(p.t1)}</td><td class="${cls(p.prevu)}">${fr(p.prevu)}</td><td class="${cls(p.reel)}">${fr(p.reel)}</td>
        <td>${p.juste == null ? '<span class="muted" role="img" aria-label="prévision quasi nulle">·</span>' : p.juste ? '<span class="ok" role="img" aria-label="sens juste">✓</span>' : '<span class="ko" role="img" aria-label="sens faux">✗</span>'}</td><td class="o-x">${p.dans == null ? '—' : p.dans ? '<span class="ok">dedans</span>' : '<span class="ko">dehors</span>'}</td><td class="o-x muted">${esc(p.cause === 'marché' ? 'du marché' : p.cause === 'société' ? 'de la société' : '—')}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="empty">Aucune prévision à un mois arrivée à échéance pour l\'instant.</p>';
  const NV = ['calme', 'vigilance', 'alerte'];
  const act = (j.activite || []).slice(0, 30);
  el.innerHTML = `<div class="o-head"><div><h2>Journal</h2><p>${j.debut ? `Tenu depuis le ${jour(j.debut)} · ${j.n_maj} actualisations` : 'Le journal commence à la première actualisation.'}</p></div></div>
    ${tiles}
    <div class="duo"><section class="box" aria-labelledby="hLec"><h2 id="hLec">Leçons tirées <small>ce que LUMIO en fait</small></h2>${lec}</section>
      <section class="box" aria-labelledby="hEvo"><h2 id="hEvo">Évolution du portefeuille <small>à chaque actualisation</small></h2>${chart(j.serie)}</section></div>
    <div class="stack">
      <section class="box" aria-labelledby="hReg"><h2 id="hReg">Réglages appris <small>bornés ; fourchettes chaque semaine au plus, le reste chaque mois</small></h2>${regs}</section>
      <section class="box" aria-labelledby="hPas"><h2 id="hPas">Prévisions passées <small>à un mois, contre la réalité</small></h2>${passTab}</section>
      <section class="box" aria-labelledby="hAct"><h2 id="hAct">Activité</h2>${act.length ? `<ul class="act">${act.map(a => `<li><span>${when(a.ts)}</span><span>${esc(a.raison || '')}${a.v ? ` · ${eur(a.v)}` : ''}${a.vj != null ? ` <span class="${cls(a.vj)}">${pct(a.vj, 1)}</span>` : ''}</span><span class="muted">${a.pa != null ? `prévision <span class="${clsD(a.pa, 1)}">${pct(a.pa, 1)}</span>` : ''}${a.nv ? ` · ${NV[a.nv]}` : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Aucune actualisation notée.</p>'}</section>
    </div>`;
  apres(el);
}

/* ── Actualiser ── */
async function refresh() {
  if (S.tab === 'journal') { if (await loadJou()) toast('Journal relu'); else toast('Journal indisponible : rechargez la page.', true); return; }
  if (S.tab === 'opportunites') {
    if (ST) { relayOpen('veille'); return; }
    if (S.opp && S.opp.en_cours) return;
    try { await api('/api/simple/opportunites/actualiser', { method: 'POST', body: {} }); if (S.opp) S.opp.en_cours = true; paintGo(); toast('Veille relancée : une à deux minutes.'); loadOpp(); }
    catch (e) { toast(`Veille impossible à relancer : ${lc(msgErr(e))}.`, true); }
    return;
  }
  if (ST) { relayOpen('veille'); return; }
  if (S.busy) return;
  S.busy = true;
  const go = $('#go'), lab = $('#goL'); go.disabled = true; go.classList.add('run');
  const t0 = Date.now(); const tick = setInterval(() => { lab.textContent = `Lecture des actualités… ${Math.round((Date.now() - t0) / 1000)} s`; }, 500);
  try {
    recu(await api('/api/simple/actualiser', { method: 'POST', body: {}, timeout: 240000 })); render();
    const d = S.d, rev = (d.lignes || []).filter(l => l.revision && l.revision.sens);
    toast(`Actualisé en ${num(d.actualise && d.actualise.secs, 1)} s${rev.length ? ` · ${rev.length} prévision${plur(rev.length)} revue${plur(rev.length)}` : ''}${d.ia && d.ia.en_cours ? ' · lecture IA en cours' : ''}`);
    if (d.ia && d.ia.en_cours) pollIa();
    S.jou = null;
  } catch (e) { toast(e.status === 409 ? 'Actualisation déjà en cours.' : e.illisible ? 'Actualisation impossible : réponse illisible du PC.' : `Actualisation impossible : ${lc(msgErr(e))}.`, true); }
  finally { clearInterval(tick); go.disabled = false; go.classList.remove('run'); S.busy = false; paintGo(); }
}

/* ── Positions Trade Republic (PC) ── */
const PH = { starting: 'Connexion à Trade Republic…', confirm: 'Validez la connexion dans l\'app Trade Republic sur votre téléphone.',
  code: 'Saisissez le code reçu de Trade Republic.', verify: 'Vérification du code…', portfolio: 'Lecture du portefeuille…',
  transactions: 'Lecture des opérations…', extras: 'Cours et fiches des valeurs…' };
function syncOpen() {
  if (ST) { relayOpen('sync'); return; }
  panelForm('Positions Trade Republic', 'Le PIN est transmis au script de mise à jour sur ce PC, jamais enregistré.',
    `<form class="form" id="syF" autocomplete="off"><label>Code PIN Trade Republic<input class="inp" name="pin" type="password" inputmode="numeric" maxlength="8" required></label>
      <button class="btn p" type="submit">Mettre à jour mes positions</button></form><div id="syM"></div>`);
  $('#syF').onsubmit = async (e) => {
    e.preventDefault();
    const pin = (e.target.pin.value || '').trim(); e.target.pin.value = '';
    if (!/^\d{4,8}$/.test(pin)) { toast('Saisissez votre code PIN Trade Republic (4 à 8 chiffres).', true); return; }
    try { await api('/api/sync/start', { method: 'POST', body: { pin } }); syncWatch(); }
    catch (err) { $('#syM').innerHTML = `<p class="msg err">${esc(err.message)}</p>`; }
  };
}
function syncWatch() {
  clearTimeout(S.sync);
  const step = async () => {
    let st; try { st = await api('/api/sync'); } catch (e) { S.sync = setTimeout(step, 3000); return; }
    const m = $('#syM'); if (!m) return;
    if (st.phase === 'done') { m.innerHTML = '<p class="msg ok">Positions à jour. Relecture des cours et des actualités…</p>'; await load(true); setTab('portefeuille'); refresh(); return; }
    if (st.phase === 'error') { m.innerHTML = `<p class="msg err">${esc(st.message || 'La mise à jour a échoué : réessayez.')}</p>`; return; }
    m.innerHTML = `<p class="msg">${esc(PH[st.phase] || 'Mise à jour en cours…')}</p>${st.phase === 'code' ? `<form class="form" id="syC" autocomplete="off"><label>Code<input class="inp" name="code" inputmode="numeric" maxlength="8" required></label><button class="btn p" type="submit">Envoyer le code</button></form>` : ''}
      <button class="btn g sm" type="button" id="syX">Annuler</button>`;
    const c = $('#syC'); if (c) c.onsubmit = async (e) => { e.preventDefault(); try { await api('/api/sync/code', { method: 'POST', body: { code: e.target.code.value.trim() } }); } catch (err) { toast(err.message, true); } };
    $('#syX').onclick = async () => { try { await api('/api/sync/cancel', { method: 'POST', body: {} }); } catch (e) { /* déjà arrêtée */ } closePanel(); };
    if (st.running) S.sync = setTimeout(step, st.phase === 'code' ? 4000 : 1500);
  };
  step();
}
function panelForm(title, sub, html) {
  S.open = null;
  $('#pT').textContent = title; $('#pS').textContent = sub; $('#pB').innerHTML = html;
  const pn = $('#panel');
  if (pn.hidden) showPanel('input'); else setTimeout(() => { const i = pn.querySelector('input'); if (i) i.focus(); }, 40);
}

/* ── Version en ligne : demande au PC par un ticket GitHub (relais chiffré) ── */
const TITLES = { sync: 'LUMIO : mettre à jour Trade Republic', veille: 'LUMIO : relancer la veille et l\'analyse' };
function relayOpen(t) {
  const r = ST.relais, nu = !!(S.d && S.d.nuage);          // 9.0 : LUMIO Simple tenu à jour par GitHub, sans le PC
  const intro = t === 'sync' ? 'Votre PC met à jour vos positions Trade Republic, puis republie cette page.'
    : nu ? `LUMIO relit déjà les cours et les actualités tout seul, sans votre PC, toutes les ${S.d.nuage.cadence_min || 15} minutes environ en semaine. Cette demande le fait tout de suite, tous les flux d'actualités relus (deux à trois minutes).`
    : 'Votre PC relit les cours, les actualités et la veille de marché, recalcule les prévisions, puis republie cette page.';
  if (!r || !r.repo) { panelForm('Actualiser', intro, '<p class="msg err">Votre PC ne reçoit pas encore de demandes : mettez LUMIO à jour sur le PC.</p>'); return; }
  if (!ST.canSeal()) {
    panelForm('Actualiser', intro, `<form class="form" id="rlK"><label>Mot de passe de la version en ligne (une fois)<input class="inp" name="password" type="password" autocomplete="current-password" required></label><button class="btn p" type="submit">Continuer</button></form>`);
    $('#rlK').onsubmit = async (e) => { e.preventDefault(); try { await ST.rekey(e.target.password.value); relayOpen(t); } catch (err) { toast('Mot de passe incorrect.', true); } };
    return;
  }
  const form = t === 'sync' ? `<form class="form" id="rlS" autocomplete="off"><label>Code PIN Trade Republic<input class="inp" name="pin" type="password" inputmode="numeric" maxlength="8" required></label><button class="btn p" type="submit">Préparer la demande</button></form>`
    : '<button class="btn p" type="button" id="rlV">Préparer la demande</button>';
  const garde = nu && t === 'veille' ? 'GitHub s\'ouvre avec un ticket chiffré dans votre dépôt privé : appuyez sur « Create ». LUMIO le traite sur GitHub en deux à trois minutes, PC éteint ou non ; cette page se recharge seule.'
    : `GitHub s'ouvre avec un ticket chiffré dans votre dépôt privé : appuyez sur « Create ». Votre PC, allumé avec LUMIO ouvert, le traite en moins d'une minute ; cette page se recharge seule à la nouvelle publication (quelques minutes).${nu ? ' Vos positions ne se mettent à jour que depuis le PC : Trade Republic demande votre PIN et une confirmation dans son application.' : ''}`;
  panelForm('Actualiser', intro, `${form}<div id="rlM"></div><p class="guard">${garde}</p>
    ${t === 'veille' ? '<button class="btn g sm" type="button" id="rlT">Mettre aussi à jour mes positions Trade Republic</button>' : ''}`);
  const prep = async (extra) => {
    try {
      const req = await ST.request(t, extra);
      const body = `${req}\n\nDemande chiffrée préparée par LUMIO Simple. Validez ce ticket : ${nu && t === 'veille' ? 'LUMIO le lit en une minute environ' : 'votre PC le lit en moins d\'une minute'}, efface ce texte et répond ici.`;
      const url = `https://github.com/${r.repo}/issues/new?title=${encodeURIComponent(TITLES[t])}&body=${encodeURIComponent(body)}`;
      $('#rlM').innerHTML = `<p class="msg ok">Demande prête : validez-la sur GitHub.</p><a class="btn p" id="rlGo" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir GitHub</a>`;
      $('#rlGo').onclick = () => { ST.expect(); toast('Demande envoyée : la page se rechargera à la nouvelle publication.'); };
    } catch (e) { toast('Demande impossible à préparer : ' + (e.message || 'erreur'), true); }
  };
  const s = $('#rlS'); if (s) s.onsubmit = (e) => { e.preventDefault(); const pin = (e.target.pin.value || '').trim(); e.target.pin.value = ''; if (!/^\d{4,8}$/.test(pin)) { toast('Saisissez votre code PIN (4 à 8 chiffres).', true); return; } prep({ pin }); };
  const v = $('#rlV'); if (v) v.onclick = () => prep();
  const tt = $('#rlT'); if (tt) tt.onclick = () => relayOpen('sync');
}

/* ── Choix d'un scénario : toutes les prévisions, le total et En bref suivent ── */
function setScen(ev, cas, g) {
  const ch = { ...S.scen }; if (cas) ch[ev] = cas; else delete ch[ev];
  S.scen = ch; keep('simple.scen', ch);
  const o = S.open, inPanel = !$('#panel').hidden;
  const cible = `[data-scen="${CSS.escape(ev)}"][data-cas="${CSS.escape(cas || '')}"][data-g="${CSS.escape(g || '')}"]`;
  const zone = inPanel ? '#pB' : S.tab === 'opportunites' ? '#v-opportunites' : '#app';
  if (S.d && !S.d.empty) render();
  if (S.opp) renderOpp();
  if (inPanel && o && o.startsWith('O:')) openOpp(o.slice(2), true);
  const bt = document.querySelector(`${zone} ${cible}`); if (bt) bt.focus({ preventScroll: true });
  const e = scenEv(ev), c = e && e.cas.find(x => x.id === cas);
  toast(c ? `${e.titre} : « ${c.nom} » retenu, prévisions recalculées` : `${e ? e.titre + ' : ' : ''}sans choix, prévisions du modèle`);
}

/* ── Évènements ── */
document.addEventListener('click', (e) => {
  const t = e.target;
  const tb = t.closest('[role="tab"][data-tab]'); if (tb) { if (tb.dataset.tab !== S.tab) setTab(tb.dataset.tab, false, true); return; }
  const br = t.closest('a.brand'); if (br) { e.preventDefault(); if (S.tab !== 'portefeuille') setTab('portefeuille', false, false); else window.scrollTo(0, 0); return; }
  const su = t.closest('[data-sort]'); if (su) { const k = su.dataset.sort; S.sort = S.sort[0] === k ? [k, -S.sort[1]] : [k, k === 'name' ? 1 : -1]; keep('simple.sort', S.sort); render(); return; }
  const scn = t.closest('[data-scen]'); if (scn) { setScen(scn.dataset.scen, scn.dataset.cas, scn.dataset.g); return; }
  const oh = t.closest('[data-ohz]'); if (oh) { S.ohz = oh.dataset.ohz === 'cinq' ? 'cinq' : 'an'; keep('simple.ohz', S.ohz); renderOpp(); return; }
  const un = t.closest('[data-unit]'); if (un && !un.disabled) { S.unit = un.dataset.unit; keep('simple.unit', S.unit); render(); return; }
  const vu = t.closest('[data-vue]'); if (vu) { S.vue = vu.dataset.vue; keep('simple.vue', S.vue); render(); return; }
  if (t.closest('[data-sync]')) { syncOpen(); return; }
  const tr = t.closest('#tab tbody tr[data-uid]'); if (tr && !t.closest('a')) { openLine(tr.dataset.uid); return; }
  const to = t.closest('.otab tbody tr[data-tk]'); if (to && !t.closest('a')) { openOpp(to.dataset.tk); return; }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePanel();
  const pn = $('#panel');
  if (e.key === 'Tab' && !pn.hidden) {                // fenêtre modale : le focus reste dedans
    const f = [...pn.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null && x.tabIndex !== -1);
    if (f.length) { const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); } }
  }
  const tg = e.target;
  if (!tg.matches) return;
  // Groupe de choix d'un scénario : les flèches passent d'une issue à l'autre et la retiennent
  if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key) && tg.matches('[role="radio"][data-scen]')) {
    const bs = [...tg.parentElement.querySelectorAll('[role="radio"]')], i = bs.indexOf(tg);
    const nx = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
    e.preventDefault(); setScen(nx.dataset.scen, nx.dataset.cas, nx.dataset.g);
    return;
  }
  if (tg.matches('[role="tab"]') && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
    const i = TABS.indexOf(tg.dataset.tab);
    const n = e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    e.preventDefault(); setTab(n, true, true);
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.name === 'acc') {
    const v = e.target.value;
    try { await api('/api/simple/accueil', { method: 'PUT', body: { accueil: v } }); if (S.d) S.d.accueil = v; toast(v === 'simple' ? 'LUMIO s\'ouvrira sur LUMIO Simple' : 'LUMIO s\'ouvrira sur la version complète'); }
    catch (err) {
      const avant = (S.d && S.d.accueil) || 'simple';
      document.querySelectorAll('input[name="acc"]').forEach(r => { r.checked = r.value === avant; });
      toast(err.readonly ? 'En ligne, LUMIO est en lecture seule : choisissez la page d\'ouverture sur le PC.' : `Page d'ouverture non enregistrée : ${lc(msgErr(err))}.`, true);
    }
  }
});
// Volets : leur état survit aux nouveaux rendus (tri, unité, choix d'un scénario, actualisation toutes les deux minutes)
document.addEventListener('toggle', (e) => {
  const el = e.target, k = el && el.dataset && el.dataset.det; if (!k) return;
  if (!!S.det[k] === el.open && S.det[k] != null) return;
  S.det[k] = el.open;
  keep('simple.det', { scen: S.det.scen, legend: S.det.legend, 'scen-plus': S.det['scen-plus'] });     // les autres ne valent que pour la session
  apres(el);
}, true);
const suivreAncre = () => { const h = location.hash.slice(1) || 'portefeuille'; if (TABS.includes(h) && h !== S.tab) setTab(h, false, 'none'); };
window.addEventListener('hashchange', suivreAncre);
window.addEventListener('popstate', () => {
  if (S.skipPop) { S.skipPop = false; return; }       // retour déclenché par la fermeture du panneau
  if (!$('#panel').hidden) { closePanel(true); return; }
  suivreAncre();
});
window.addEventListener('resize', () => { mesure(); apres(document); });
$('#pX').onclick = () => closePanel();
$('#scrim').onclick = () => closePanel();
$('#go').onclick = refresh;
const full = $('#full'); if (full) full.setAttribute('href', FULL);
const start = () => { try { if (history.state && history.state.lumioPanneau) history.replaceState(null, ''); } catch (e) { /* sans historique */ }
  mesure(); load(); const h = location.hash.slice(1); if (TABS.includes(h) && h !== 'portefeuille') setTab(h); };
if (ST) {
  document.addEventListener('lumio:static', () => { load(true); if (S.tab === 'opportunites') loadOpp(); if (S.tab === 'journal') loadJou(); });
  ST.ready.then(start);
} else {
  start();
  setInterval(() => { if (!document.hidden && !S.busy) { load(true); if (S.tab === 'opportunites' && S.opp && S.opp.en_cours) loadOpp(); } }, 120000);   // cours relus toutes les 2 minutes
}
window.LUMIO_SIMPLE = { openLine, openOpp, syncOpen, refresh, setTab, showPanel, closePanel,
  calc: { etat: S, num, sgn, eur, eurS, pct, fr, pm, pts, clsD, PHI, risque, agite, vieux, scenCur, scenClean, scenF, hx, hL, scKey, scTot, totPrev, sumPv, scCas, vives, store, bh, bhScen } };
})();
