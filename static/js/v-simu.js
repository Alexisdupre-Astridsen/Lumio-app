/* LUMIO — Simuler avant d'agir (« et si je vends, et si j'achète ») et profil de risque.
   La simulation chiffre l'effet d'opérations sur le portefeuille avant de passer l'ordre, comme les
   propositions des outils bancaires : répartition, volatilité, bêta, crise rejouée, bilan de santé,
   vos règles, impôt et frais. Lecture seule : aucun ordre, rien d'enregistré. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const ic = { ok: '✓', warn: '!', alert: '✕' };
let rows = [];          // opérations en cours de saisie : {uid, ticker, name, side, amount, all}

const lines = () => ((L.data.portfolio || {}).positions || []).slice().sort((a, b) => b.value - a.value);
const medianLine = () => { const v = lines().map(p => p.value).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 1000; };
const roundAmt = v => Math.max(100, Math.round(v / 100) * 100);

function rowHtml(r, i) {
  const ps = lines();
  const opts = ps.map(p => `<option value="${L.esc(p.uid)}" ${p.uid === r.uid ? 'selected' : ''}>${L.esc(p.name)} · ${F.eur(p.value, 0)}</option>`).join('');
  const isNew = !r.uid;
  return `<div class="wi-row" data-wi="${i}">
    <div class="wi-l"><select class="sel" data-wif="uid" aria-label="Ligne">${opts}<option value="" ${isNew ? 'selected' : ''}>Nouvelle valeur…</option></select>
      ${isNew ? `<div class="wi-new"><input class="inp" data-wif="ticker" placeholder="Ticker Yahoo (OKLO, AI.PA…)" value="${L.esc(r.ticker || '')}" maxlength="15" aria-label="Ticker">
        <input class="inp" data-wif="name" placeholder="Nom" value="${L.esc(r.name || '')}" maxlength="60" aria-label="Nom"></div>` : ''}</div>
    <div class="seg sm" role="group" aria-label="Sens">${isNew ? '' : `<button type="button" data-wis="sell" class="${r.side === 'sell' ? 'on' : ''}" aria-pressed="${r.side === 'sell'}">Vendre</button>`}<button type="button" data-wis="buy" class="${r.side === 'buy' || isNew ? 'on' : ''}" aria-pressed="${r.side === 'buy' || isNew}">Acheter</button></div>
    <div class="wi-a"><input class="inp" data-wif="amount" inputmode="decimal" value="${r.all ? '' : L.esc(r.amount ?? '')}" placeholder="${r.all ? 'toute la ligne' : 'montant'}" aria-label="Montant en euros"><span>€</span>
      ${r.side === 'sell' && !isNew ? `<button type="button" class="chip ${r.all ? 'on' : ''}" data-wiall aria-pressed="${!!r.all}">Tout</button>` : ''}</div>
    ${rows.length > 1 ? `<button type="button" class="ibtn" data-widel aria-label="Retirer l'opération">${L.icon('x')}</button>` : ''}</div>`;
}

function drawForm(d) {
  d.querySelector('#wiRows').innerHTML = rows.map(rowHtml).join('');
}

L.whatIf = {
  open(pre = {}) {
    const ps = lines();
    if (!ps.length) { L.toast('Portefeuille vide : rien à simuler', true); return; }
    const p = pre.uid ? ps.find(x => x.uid === pre.uid) : null;
    rows = [p ? { uid: p.uid, side: pre.side || 'sell', all: pre.side !== 'buy' && pre.all !== false && !pre.amount, amount: pre.amount || (pre.side === 'buy' || pre.all === false ? roundAmt(p.value * .25) : '') }
      : pre.ticker ? { uid: '', ticker: pre.ticker, name: pre.name || pre.ticker, side: 'buy', amount: pre.amount || roundAmt(medianLine()) }
      : { uid: ps[0].uid, side: 'sell', amount: roundAmt(ps[0].value * .25) }];
    const d = L.drawer.open('detail', { title: 'Simuler avant d\'agir', sub: 'Effet chiffré sur votre portefeuille ; aucun ordre passé', wide: true,
      html: `<form id="wiF" autocomplete="off"><div id="wiRows"></div>
        <div class="wi-act"><button type="button" class="btn sm g" id="wiAdd">${L.icon('plus')}Ajouter une opération</button><button type="submit" class="btn p">Simuler</button></div></form>
        <div id="wiRes" aria-live="polite"></div>` });
    drawForm(d);
    const f = d.querySelector('#wiF');
    const idx = el => +el.closest('[data-wi]').dataset.wi;
    f.addEventListener('change', e => {
      const k = e.target.dataset.wif; if (!k) return;
      const r = rows[idx(e.target)];
      if (k === 'uid') { r.uid = e.target.value; if (!r.uid) { r.side = 'buy'; r.all = false; } drawForm(d); }
    });
    f.addEventListener('input', e => {
      const k = e.target.dataset.wif; if (!k || k === 'uid') return;
      const r = rows[idx(e.target)];
      r[k] = e.target.value;
      if (k === 'amount' && r.all && e.target.value) { r.all = false; const b = e.target.closest('[data-wi]').querySelector('[data-wiall]'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } }
    });
    f.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !f.contains(b)) return;
      if (b.id === 'wiAdd') { if (rows.length < 6) { const used = new Set(rows.map(r => r.uid)); const nx = ps.find(x => !used.has(x.uid)) || ps[0]; rows.push({ uid: nx.uid, side: 'sell', amount: roundAmt(nx.value * .25) }); drawForm(d); } return; }
      if (!b.closest('[data-wi]')) return;
      const r = rows[idx(b)];
      if (b.dataset.wis) { r.side = b.dataset.wis; if (r.side === 'buy') r.all = false; drawForm(d); }
      else if (b.hasAttribute('data-wiall')) { r.all = !r.all; if (r.all) r.amount = ''; drawForm(d); }
      else if (b.hasAttribute('data-widel')) { rows.splice(idx(b), 1); drawForm(d); }
    });
    f.onsubmit = async e => { e.preventDefault(); await run(d); };
    if (pre.run !== false) run(d);
  },
};

const num = v => { const x = parseFloat(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };

async function run(d) {
  const res = d.querySelector('#wiRes');
  const trades = [];
  for (const r of rows) {
    const a = num(r.amount);
    if (r.uid) {
      if (r.side === 'sell' && r.all) { trades.push({ uid: r.uid, all: true, amount: -1 }); continue; }
      if (!(a > 0)) { res.innerHTML = '<p class="dn" style="margin-top:12px">Indiquez un montant pour chaque opération.</p>'; return; }
      trades.push({ uid: r.uid, amount: r.side === 'sell' ? -a : a });
    } else {
      if (!r.ticker || !(a > 0)) { res.innerHTML = '<p class="dn" style="margin-top:12px">Nouvelle valeur : indiquez son ticker et le montant de l\'achat.</p>'; return; }
      trades.push({ ticker: String(r.ticker).trim(), name: r.name || r.ticker, amount: a });
    }
  }
  res.innerHTML = `<div class="sk-on" style="margin-top:14px">${L.skel(220)}</div>`;
  let x;
  try { x = await L.api('/api/whatif', { method: 'POST', body: { trades } }); } catch (e) { res.innerHTML = L.errBox(e); return; }
  res.innerHTML = result(x);
}

const pct1 = v => v == null ? '—' : F.pctU(v, 1);
function cmp(lbl, b, a, fmt = pct1, tip = '') {
  const same = JSON.stringify(b) === JSON.stringify(a);
  return `<tr${same ? ' class="wi-same"' : ''}><td class="l">${lbl}${tip ? ' ' + L.tipTxt(tip) : ''}</td><td>${fmt(b)}</td><td><b>${fmt(a)}</b></td></tr>`;
}
function result(x) {
  const b = x.before, a = x.after;
  const de = n => (/^[aeiouyàâéèêëîïôöûüÿ]/i.test(n) ? 'd\'' : 'de ') + L.esc(n);
  const ops = x.ops.map(o => `${o.side === 'vente' ? (o.all ? 'Vente de toute la ligne' : 'Vente') : 'Achat'} ${de(o.name)} : ${L.m(F.eur(o.amount, 0))}${o.side === 'vente' ? ` <span class="${L.cls(o.gain)}">(${o.gain >= 0 ? 'plus-value' : 'moins-value'} ${L.m(F.eur(Math.abs(o.gain), 0))})</span>` : ''}${o.new ? ' <span class="tag v">nouvelle ligne</span>' : ''}`);
  const line = t => t ? `${L.esc(t.name)} ${F.pctU(t.pct, 1)}` : '—';
  const worst = w => w ? `${F.pct(w.impact_pct, 0)} <span class="muted m" style="font-size:11.5px">${F.eurS(w.impact_eur, 0)}</span>` : '—';
  const br = (list) => list.length ? list.map(t => `<div class="li"><span class="st alert">✕</span><div class="main"><div class="t2">${L.esc(t)}</div></div></div>`).join('') : '<div class="li"><span class="st ok">✓</span><div class="main"><div class="t2">Aucune limite dépassée</div></div></div>';
  return `<div class="wi-res">
    <ul class="wi-ops">${ops.map(o => `<li>${o}</li>`).join('')}${x.cash > 0 ? `<li class="muted">Liquidités dégagées : ${L.m(F.eur(x.cash, 0))}</li>` : x.cash < 0 ? `<li class="muted">Nouvel apport : ${L.m(F.eur(-x.cash, 0))}</li>` : ''}</ul>
    ${(x.no_history || []).length ? `<div class="callout" style="margin:10px 0">Historique introuvable pour ${L.esc(x.no_history.join(', '))} : volatilité, bêta et crises calculés sans cette ligne.</div>` : ''}
    <div class="tbl-wrap"><table class="tbl wi-t"><thead><tr><th class="l"></th><th>Avant</th><th>Après</th></tr></thead><tbody>
      ${cmp('Volatilité sur 1 an', b.vol, a.vol, pct1, 'Écart-type annualisé des rendements hebdomadaires sur un an, lignes pondérées par leur poids.')}
      ${cmp('Bêta (indice mondial)', b.beta, a.beta, v => v == null ? '—' : F.n(v, 2), 'Sensibilité à l\'indice mondial : 1 = suit l\'indice, 0,5 = deux fois moins.')}
      ${cmp('Plus grosse action', b.top_line, a.top_line, line)}
      ${cmp('Nombre effectif de lignes', b.effective_n, a.effective_n, v => v == null ? '—' : F.n(v, 1), 'Inverse de la somme des poids au carré : 10 lignes égales = 10, une ligne dominante tire le chiffre vers 1.')}
      ${cmp('Secteur dominant', b.sector_top, a.sector_top, t => t ? `${L.esc(t.label)} ${F.pctU(t.pct, 0)}` : '—')}
      ${cmp('Hors euro', b.non_eur_pct, a.non_eur_pct, v => F.pctU(v, 0))}
      ${cmp('Liquidités', b.cash_pct, a.cash_pct, v => F.pctU(v, 1))}
      ${cmp(`Pire crise rejouée${a.worst ? ` (${L.esc(a.worst.label)})` : ''}`, b.worst, a.worst, worst)}
      ${cmp('Bilan de santé', b.health, a.health, v => v == null ? '—' : `${v}/100`)}
      ${b.profile || a.profile ? cmp('Profil de risque', b.profile, a.profile, p => p ? `<span class="st ${p.status}" style="display:inline-grid;width:18px;height:18px;font-size:10px">${ic[p.status]}</span>` : '—') : ''}
    </tbody></table></div>
    <div class="wi-cols">
      <div><div class="k-l">Vos règles après l'opération</div>${br(a.breaches || [])}${(b.breaches || []).length && !(a.breaches || []).length ? '<p class="note">Avant : ' + L.esc(b.breaches.join(' ; ')) + '</p>' : ''}</div>
      <div><div class="k-l">Bilan de santé : ce qui change</div>${(x.changes || []).length ? x.changes.map(c => `<div class="li"><span class="st ${c.after}">${ic[c.after]}</span><div class="main"><div class="t1">${L.esc(c.label)}</div><div class="t2">${L.mText(c.detail)}${c.before ? ` <span class="muted">(avant : ${{ ok: 'correct', warn: 'à surveiller', alert: 'alerte' }[c.before]})</span>` : ''}</div></div></div>`).join('') : '<p class="note" style="margin-top:6px">Aucune règle ne change de statut.</p>'}</div>
      <div><div class="k-l">Qui porte le risque après</div>${(a.risk_top || []).map(r => `<div class="li"><div class="main"><div class="t1 ell">${L.esc(r.name)}</div></div><span class="end">${F.pctU(r.risk_pct, 0)} du risque</span></div>`).join('') || '<p class="note">Non mesuré.</p>'}</div>
    </div>
    <div class="callout" style="margin-top:12px">${(x.tax.notes || []).length ? x.tax.notes.map(n => `<div>${L.mText(n)}</div>`).join('') : '<div>Aucune plus-value réalisée.</div>'}<div class="note" style="margin-top:4px">Frais de courtage estimés : ${F.eur(x.fees_est, 0)} (moyenne de vos ordres passés).</div></div>
    <p class="guard">${L.esc(x.note)}</p></div>`;
}

/* Boutons « Simuler » posés ailleurs (signaux, fiche valeur, Analyse) */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sim]'); if (!b) return;
  e.preventDefault();
  L.whatIf.open({ uid: b.dataset.simUid || '', ticker: b.dataset.simTk || '', name: b.dataset.simName || '', side: b.dataset.sim || '',
    run: b.dataset.simRun !== '0', all: b.dataset.simRun === '0' ? false : undefined });
});

/* ── Profil de risque : six questions, comme le questionnaire MIF2 des banques ── */
L.riskProfile = {
  async open(onDone) {
    let p;
    try { p = await L.get('/api/profile', 0, true); } catch (e) { L.toast(e.message, true); return; }
    const ans = p.answers || {};
    const d = L.drawer.open('detail', { title: 'Votre profil de risque', sub: 'Six questions ; LUMIO compare ensuite le portefeuille à la fourchette du profil', narrow: true,
      html: `<form id="rpF" class="prf">${p.questions.map((q, i) => `<fieldset class="prf-q"><legend>${i + 1}. ${L.esc(q.q)}</legend>
          ${q.a.map((a, j) => `<label class="prf-a"><input type="radio" name="${q.id}" value="${j}" ${ans[q.id] === j ? 'checked' : ''} required><span>${L.esc(a)}</span></label>`).join('')}</fieldset>`).join('')}
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px"><button class="btn p" type="submit">Voir mon profil</button>${p.set ? '<button class="btn g" type="button" id="rpReset">Effacer</button>' : ''}<span class="note" id="rpMsg"></span></div>
        <p class="guard">Un repère, pas un test d'adéquation réglementaire : ni conseil, ni recommandation.</p></form>` });
    const f = d.querySelector('#rpF');
    f.onsubmit = async e => {
      e.preventDefault();
      const answers = {}; p.questions.forEach(q => { const v = f.querySelector(`input[name="${q.id}"]:checked`); if (v) answers[q.id] = +v.value; });
      try {
        const r = await L.api('/api/profile', { method: 'PUT', body: { answers } });
        L.toast(`Profil ${r.profile.label}`); L.drawer.close(); L.forget('/api/analytics'); L.forget('/api/profile'); onDone && onDone(r);
      } catch (err) { L.put('rpMsg', `<span class="dn">${L.esc(err.message)}</span>`); }
    };
    const rs = d.querySelector('#rpReset');
    if (rs) rs.onclick = async () => { try { await L.api('/api/profile', { method: 'DELETE' }); L.toast('Profil effacé'); L.drawer.close(); L.forget('/api/analytics'); onDone && onDone(null); } catch (err) { L.toast(err.message, true); } };
  },
};
})();
