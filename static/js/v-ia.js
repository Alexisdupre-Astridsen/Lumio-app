/* LUMIO — panneau IA : questions sur VOTRE portefeuille (chiffres vérifiés, sources), explication
   d'un mouvement, synthèse du jour et archives. Mode discret : aucun montant envoyé. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const S = { tab: 'ask', hist: [], busy: false, sugg: null };
try { S.hist = JSON.parse(sessionStorage.getItem('lumio.chat') || '[]'); } catch (e) { S.hist = []; }
const save = () => { try { sessionStorage.setItem('lumio.chat', JSON.stringify(S.hist.slice(-30))); } catch (e) { /* ignore */ } };
const DEFAULT_SUGG = ["Pourquoi mon portefeuille bouge aujourd'hui ?", 'Quelles décisions étudier cette semaine ?', 'Quels sont mes principaux risques ?', 'Quels résultats ont été publiés ?', 'Quelle est mon exposition au dollar ?', 'Est-ce que je bats le MSCI World ?', 'Et si le Nasdaq perd 20 % ?'];

L.openIA = (fromRouter) => {
  const d = L.drawer.open('ia', {
    narrow: true,
    head: `<div style="display:flex;align-items:center;gap:10px"><span class="av" style="background:var(--aurora)">${L.icon('spark')}</span><div><h2>Analyste LUMIO</h2><div class="note">${L.data.health?.ai_key ? 'Claude, à partir de vos chiffres' : 'Moteur de règles local (ajoutez une clé API pour Claude)'}</div></div></div>`,
    html: '',
  });
  if (!fromRouter && !L.router.parse().q.ia) L.router.setParam('ia', '1');
  const body = d.querySelector('.dr-b');
  body.style.padding = '0';
  body.style.display = 'flex'; body.style.flexDirection = 'column';
  const TABS = [['ask', 'Demander'], ['syn', 'Synthèse du jour'], ['arc', 'Archives']];
  body.innerHTML = `<div class="ia-tabs" role="tablist" aria-label="Analyste LUMIO">${TABS.map(([k, l]) => `<button role="tab" id="iat-${k}" data-iat="${k}" aria-controls="iaBody" aria-selected="${S.tab === k}" tabindex="${S.tab === k ? 0 : -1}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="iaBody" role="tabpanel" aria-labelledby="iat-${S.tab}" style="flex:1;overflow-y:auto;padding:16px 20px 20px"></div><div id="iaComp"></div>`;
  const select = (b, focus) => {
    S.tab = b.dataset.iat;
    L.qsa('[data-iat]', body).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    document.getElementById('iaBody').setAttribute('aria-labelledby', b.id);
    if (focus) b.focus(); tab();
  };
  L.on(body, 'click', '[data-iat]', (e, b) => select(b));
  // Motif d'onglets : flèches gauche/droite, Début/Fin
  L.on(body, 'keydown', '[data-iat]', (e, b) => {
    const all = L.qsa('[data-iat]', body); const i = all.indexOf(b);
    const j = e.key === 'ArrowRight' ? (i + 1) % all.length : e.key === 'ArrowLeft' ? (i - 1 + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
    if (j >= 0) { e.preventDefault(); select(all[j], true); }
  });
  tab();
  return d;
};
function tab() {
  const comp = document.getElementById('iaComp');
  if (S.tab === 'ask') { chat(); comp.innerHTML = composer(); bindComposer(); }
  else { comp.innerHTML = ''; S.tab === 'syn' ? synthese() : archives(); }
}
const composer = () => `<form class="composer" id="iaForm"><textarea class="inp" id="iaQ" rows="1" placeholder="Votre question…" aria-label="Question sur votre portefeuille"></textarea><button class="btn ia" type="submit" aria-label="Envoyer" style="height:44px;width:48px;padding:0">${L.icon('send')}</button></form>
  <label class="chk" style="padding:0 16px 12px;font-size:12.5px"><input type="checkbox" id="iaPriv" ${L.store.get('ia.private', false) ? 'checked' : ''}> Mode discret : n'envoyer aucun montant en euros (seulement des % et des poids)</label>`;
function bindComposer() {
  const f = document.getElementById('iaForm'), q = document.getElementById('iaQ');
  f.onsubmit = (e) => { e.preventDefault(); const v = q.value.trim(); if (v) { q.value = ''; send(v); } };
  q.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
  q.oninput = () => { q.style.height = 'auto'; q.style.height = Math.min(140, q.scrollHeight) + 'px'; };
  document.getElementById('iaPriv').onchange = (e) => L.store.set('ia.private', e.target.checked);
  setTimeout(() => q.focus({ preventScroll: true }), 80);
}
function msgHtml(m) {
  if (m.role === 'user') return `<div class="msg u">${L.esc(m.content)}</div>`;
  const src = (m.sources || []).length ? `<span class="src">Sources : ${m.sources.map(s => `<a href="${L.url(s.link)}" target="_blank" rel="noopener noreferrer">${L.esc(s.source || 'article')}</a>${s.age_h != null ? ' (' + F.ago(s.age_h) + ')' : ''}`).join(' · ')}</span>` : '';
  return `<div class="msg a">${L.mText(m.content)}${src}<span class="via">${m.via === 'claude' ? 'Rédigé par Claude à partir de vos chiffres · chiffres vérifiés' : m.via === 'regles' ? 'Moteur de règles LUMIO · calculs exacts sur vos données' : ''}${m.private ? ' · mode discret' : ''}</span></div>`;
}
function chat() {
  const b = document.getElementById('iaBody'); if (!b) return;
  const sugg = S.sugg || DEFAULT_SUGG;
  b.innerHTML = `<div class="chat" id="iaChat">${S.hist.length ? S.hist.map(msgHtml).join('') : `<div class="msg a">Je réponds à partir de vos positions, opérations, risques, revenus et de la veille. Chaque chiffre vient de vos données.</div>`}
    ${S.busy ? '<div class="msg a"><span class="typing"><i></i><i></i><i></i></span></div>' : ''}</div>
    <div class="sugg" style="margin-top:14px">${sugg.slice(0, 6).map(s => `<button data-sg="${L.esc(s)}">${L.esc(s)}</button>`).join('')}</div>
    <p class="guard">LUMIO ne passe aucun ordre et ne donne pas de conseil en investissement personnalisé : il expose les faits, les risques et les questions à trancher.${S.hist.length ? ' <button class="lnk" id="iaClear" style="font-size:11.5px">Effacer la conversation</button>' : ''}</p>`;
  L.on(b, 'click', '[data-sg]', (e, x) => send(x.dataset.sg));
  const c = document.getElementById('iaClear'); if (c) c.onclick = () => { S.hist = []; save(); chat(); };
  b.scrollTop = b.scrollHeight;
}
async function send(q) {
  if (S.busy) return;
  S.hist.push({ role: 'user', content: q }); S.busy = true; chat();
  try {
    const r = await L.api('/api/ai/ask', { method: 'POST', body: { question: q, history: S.hist.slice(-7, -1).map(m => ({ role: m.role, content: m.content })), private: L.store.get('ia.private', false) || L.state.privacy } });
    S.hist.push({ role: 'assistant', content: r.answer, sources: r.sources, via: r.source, private: r.private });
    if (r.suggestions && r.suggestions.length) S.sugg = r.suggestions;
  } catch (e) { S.hist.push({ role: 'assistant', content: 'Réponse impossible : ' + e.message }); }
  S.busy = false; save(); if (S.tab === 'ask') chat();
}
L.askIA = (q) => { S.tab = 'ask'; if (L.drawer.current !== 'ia') L.openIA(false); else tab(); setTimeout(() => send(q), 30); };
L.explainIA = async (range) => {
  S.tab = 'ask';
  if (L.drawer.current !== 'ia') L.openIA(false); else tab();
  const lbl = { '1d': "aujourd'hui", '1w': 'sur 1 semaine', '1m': 'sur 1 mois', ytd: 'depuis le 1er janvier', '1y': 'sur 1 an', max: 'depuis le début' }[range] || '';
  S.hist.push({ role: 'user', content: `Explique le mouvement du portefeuille ${lbl}.` }); S.busy = true; chat();
  try {
    // Mode discret (case de l'IA ou œil de la barre) : aucun montant envoyé à Claude
    const priv = L.store.get('ia.private', false) || L.state.privacy;
    const r = await L.api('/api/ai/explain?range=' + range + (priv ? '&private=true' : ''));
    const top = (r.contributors || []).slice(0, 5).map(c => `• ${c.name} : ${F.eurS(c.delta_eur)}${c.held === false ? ' (soldée)' : ''}`).join('\n');
    S.hist.push({ role: 'assistant', content: r.text + (top ? '\n\nContributions :\n' + top : ''), sources: r.sources, via: r.ai ? 'claude' : 'regles', private: r.private });
  } catch (e) { S.hist.push({ role: 'assistant', content: 'Explication indisponible : ' + e.message }); }
  S.busy = false; save(); chat();
};

/* ── Synthèse du jour ── */
async function synthese(day) {
  const b = document.getElementById('iaBody'); b.innerHTML = L.skel(300);
  try {
    const s = await L.get(day ? '/api/synthese/' + day : '/api/synthese/today', 300000);
    const k = s.kpis || {};
    // Analyse complète (7.1) : le constat et les décisions à étudier, la page entière est dans Décisions › Synthèse
    const a = s.analysis, ds = a ? (a.decisions || []) : [];
    const full = a ? `<div class="rv-mini"><div class="k-l">Analyse complète</div><p>${L.mText(a.constat[0])} ${L.mText(a.constat[1])}</p>
        ${ds.slice(0, 5).map(d => `<div class="rv-mi"><span class="rv-rk" aria-label="Priorité ${d.priority}">${d.priority}</span><div><span><b>${L.esc(d.name)}</b> · ${L.esc(String(d.priority_label).toLowerCase())}</span>
          <span class="rv-dc">${L.rvChips ? L.rvChips({ key: d.these, label: d.these_label }, { key: d.piste, label: d.piste_label }) : ''}</span></div></div>`).join('')}
        ${ds.length > 5 ? `<div class="note">Et ${ds.length - 5} autre${ds.length - 5 > 1 ? 's' : ''} dans l'analyse complète.</div>` : ''}
        <a class="btn sm" href="#/decisions/synthese${day ? '?jour=' + encodeURIComponent(day) : ''}">Ouvrir l'analyse complète${L.icon('chev')}</a></div>` : '';
    b.innerHTML = `<div class="note">${day ? 'Archive du ' + F.date(day) : 'Générée à ' + F.time(s.generated_at)} · consultable uniquement dans LUMIO</div>
      <h3 style="font:500 19px/1.35 var(--f-num);font-variation-settings:'opsz' 24;margin:8px 0 10px">${L.esc(s.headline)}</h3>
      ${s.ai_commentary ? `<div class="callout ai" style="white-space:pre-wrap">${L.esc(s.ai_commentary)}<div class="via" style="margin-top:6px;font-size:11px;color:var(--ink4)">Rédigé par Claude · chiffres vérifiés</div></div>` : ''}
      ${full}
      <div class="stat-row" style="margin:14px 0">${[['Valeur', L.m(F.eur(k.total_value, 0))], ['Jour', `<span class="${L.cls(k.day_change_pct)}">${F.pct(k.day_change_pct)}</span>`], ['Depuis l\'achat', `<span class="${L.cls(k.total_pnl_pct)}">${F.pct(k.total_pnl_pct, 1)}</span>`]].map(([l, v]) => `<div class="kpi"><span class="k-l">${l}</span><span class="k-v" style="font-size:18px">${v}</span></div>`).join('')}</div>
      <div class="cards" style="gap:12px"><div class="c6"><div class="k-l">En hausse</div>${(s.top || []).map(x => `<div class="li"><div class="main t1">${L.esc(x.name)}</div><span class="end up">${F.pct(x.change_pct_day)}</span></div>`).join('')}</div>
        <div class="c6"><div class="k-l">En baisse</div>${(s.flop || []).map(x => `<div class="li"><div class="main t1">${L.esc(x.name)}</div><span class="end dn">${F.pct(x.change_pct_day)}</span></div>`).join('')}</div></div>
      ${(s.alerts || []).length ? `<div class="sec"><h3 style="font-size:13px;color:var(--ink2);margin:16px 0 6px">Points de vigilance</h3>${s.alerts.map(a => `<a class="art" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><div class="t1">${L.mText(a.detail)}</div><div class="t2">${L.esc(a.name || '')}</div></a>`).join('')}</div>` : ''}
      <div class="sec"><h3 style="font-size:13px;color:var(--ink2);margin:16px 0 6px">Actualités des lignes</h3>${(s.news || []).slice(0, 8).map(a => `<a class="art" href="${L.url(a.link)}" target="_blank" rel="noopener noreferrer"><div class="t1">${L.esc(a.title)}</div><div class="t2">${L.esc(a.position || '')} · ${L.esc(a.source || '')} · ${F.ago(a.age_h)}</div></a>`).join('')}</div>`;
  } catch (e) { b.innerHTML = L.errBox(e); }
}
async function archives() {
  const b = document.getElementById('iaBody'); b.innerHTML = L.skel(200);
  try {
    const r = await L.get('/api/synthese/archive', 300000);
    b.innerHTML = (r.dates || []).length ? `<div class="note" style="margin-bottom:8px">Une synthèse archivée par jour d'ouverture.</div>${r.dates.map(d => `<button class="li click" style="width:100%;text-align:left" data-day="${L.esc(d)}"><div class="main"><div class="t1">${F.dlong(d)} ${d.slice(0, 4)}</div></div>${L.icon('chev')}</button>`).join('')}`
      : `<div class="empty">Aucune archive pour l'instant${L.state.demo ? ' (désactivé en mode démo)' : ''}. La synthèse du jour est archivée automatiquement à la première ouverture de chaque journée.</div>`;
    L.on(b, 'click', '[data-day]', (e, x) => { S.tab = 'syn'; synthese(x.dataset.day); });
  } catch (e) { b.innerHTML = L.errBox(e); }
}
})();
