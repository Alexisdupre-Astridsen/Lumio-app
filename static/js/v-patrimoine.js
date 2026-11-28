/* LUMIO — Portefeuille › Patrimoine : tout ce que vous possédez et devez, au-delà des comptes-titres
   suivis (livrets, assurance-vie, immobilier, crédits…), comme les outils de consolidation des
   banques privées : patrimoine net, classes d'actifs, liquidité, dettes, repères. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const C = L.chart;
const card = (cls, title, body, right = '') => `<section class="w ${cls}"><div class="w-h"><h2>${title}</h2>${right ? `<div class="r">${right}</div>` : ''}</div>${body}</section>`;
const stat = (lbl, val, sub = '') => `<div class="kpi stat"><span class="k-l">${lbl}</span><span class="k-v">${val}</span>${sub ? `<span class="k-s">${sub}</span>` : ''}</div>`;
const ic = { ok: '✓', warn: '!', alert: '✕' };
const rate = r => r == null ? '' : `${F.n(r, r % 1 ? 2 : 0)}${' '}%`;
let W = null;            // dernière réponse, pour le formulaire

function rowHtml(l) {
  const meta = l.auto ? `<span class="tag held">automatique</span> ${L.esc(l.detail || '')}`
    : `${L.esc(l.label)}${l.rate != null ? ' · ' + rate(l.rate) + (l.monthly ? '' : ' par an') : ''}${l.monthly ? ` · mensualité ${L.m(F.eur(l.monthly, 0))}` : ''} · ${l.stale ? `<span class="warn">valeur du ${F.date(l.asof)}, à actualiser</span>` : 'au ' + F.date(l.asof)}`;
  return `<div class="li${l.auto ? '' : ' click'}"${l.auto ? '' : ` data-wedit="${L.esc(l.id)}" tabindex="0" role="button" aria-label="Modifier ${L.esc(l.name)}"`}>
    <div class="main"><div class="t1 ell">${L.esc(l.name)}</div><div class="t2">${meta}</div></div>
    <div class="end"><div>${L.m(F.eur(l.value, 0))}</div>${l.auto ? '<a class="lnk" href="#/portefeuille/positions" style="font-size:12px">Voir</a>' : ''}</div></div>`;
}

L.pf.patrimoine = async (el, force = false) => {
  let w;
  try { w = await L.get('/api/patrimoine', 30000, force); } catch (e) { el.innerHTML = L.errBox(e); return; }
  W = w;
  const by = L.store.get('wl.by', 'group');
  const rows = by === 'liq' ? w.by_liq : w.by_group;
  const hist = (w.history || []).filter(h => h.net != null);
  el.innerHTML = `<div class="cards">
    ${card('c12', 'Patrimoine net', `<div class="wl-top">
        <div><div class="hero-v m" style="font-size:clamp(30px,6vw,44px)">${L.m(F.eur(w.net, 0))}</div>
          <div class="note" style="margin-top:4px">${L.m(F.eur(w.gross, 0))} d'actifs${w.debt ? ` − ${L.m(F.eur(w.debt, 0))} de dettes` : ''} · ${F.pctU(w.invested_pct, 0)} en bourse</div></div>
        <div class="stat-row wl-st">${stat('Revenus d\'épargne estimés', L.m(F.eur(w.income_est, 0)), 'par an, aux taux saisis')}${stat('Intérêts des crédits', L.m(F.eur(w.interest_est, 0)), w.monthly_debt ? `par an · ${L.m(F.eur(w.monthly_debt, 0))} de mensualités` : 'par an')}</div></div>
      ${hist.length >= 2 ? '<div id="wlC" style="margin-top:12px"></div>' : `<p class="note" style="margin-top:12px">${hist.length ? 'La courbe du patrimoine net se construit jour après jour (un relevé par jour d\'ouverture).' : ''}</p>`}
      ${w.has_items ? '' : `<div class="callout" style="margin-top:12px">Votre portefeuille suivi est compté automatiquement. Ajoutez vos livrets, assurance-vie, immobilier et crédits pour voir votre patrimoine complet : valeurs déclaratives, gardées sur votre LUMIO uniquement.</div>`}`,
      `<button class="btn sm p" data-wadd>${L.icon('plus')}Ajouter</button>`)}
    ${card('c7', 'Répartition', `${C.hbars(rows.map(r => ({ ...r })), { max: 100, fmt: (v, r) => `${v > 0 && v < .1 ? '&lt;\u202f0,1\u202f%' : F.pctU(v, v < 1 && v > 0 ? 1 : 0)} <span class="muted m" style="font-size:11.5px">${F.k(r.value)}</span>` })}
      <p class="note" style="margin-top:8px">${by === 'liq' ? 'Disponible tout de suite : comptes et livrets. Mobilisable : bourse, assurance-vie, crypto. Peu liquide : immobilier, épargne retraite, autres biens.' : 'Pourcentages du patrimoine brut (avant dettes).'}</p>`,
      `<div class="seg sm" role="group" aria-label="Répartition par"><button data-wby="group" class="${by !== 'liq' ? 'on' : ''}" aria-pressed="${by !== 'liq'}">Classes d'actifs</button><button data-wby="liq" class="${by === 'liq' ? 'on' : ''}" aria-pressed="${by === 'liq'}">Liquidité</button></div>`)}
    ${card('c5', 'Repères', `${(w.marks || []).length ? w.marks.map(m => `<div class="li"><span class="st ${m.status}">${ic[m.status]}</span><div class="main"><div class="t1">${L.esc(m.label)}</div><div class="t2">${L.esc(m.text)}</div></div></div>`).join('') : '<div class="empty">Ajoutez vos comptes et vos dépenses mensuelles pour voir les repères.</div>'}
      <form class="wl-sp" id="wlSpend"><label class="fld"><span>Dépenses mensuelles (facultatif)</span><input class="inp" name="monthly_spend" inputmode="decimal" value="${L.esc(w.monthly_spend ?? '')}" placeholder="2 000"></label><button class="btn sm" type="submit">Enregistrer</button></form>
      <p class="note" style="margin-top:6px">Sert à mesurer l'épargne de précaution, en mois de dépenses. Des repères chiffrés, pas un conseil.</p>`)}
    ${card('c7', 'Biens et comptes', (w.lines || []).map(rowHtml).join('') || '<div class="empty">Aucun avoir.</div>',
      `<button class="btn sm" data-wadd>${L.icon('plus')}Ajouter</button>`)}
    ${card('c5', 'Dettes', (w.debts || []).length ? w.debts.map(rowHtml).join('') + `<p class="note" style="margin-top:8px">Capital restant dû. Coût estimé : ${L.m(F.eur(w.interest_est, 0))} d'intérêts par an.</p>`
      : '<div class="empty">Aucune dette saisie.<br><button class="lnk" data-wadd="credit_immo">Ajouter un crédit</button></div>')}
  </div>`;
  if (hist.length >= 2) {
    C.line(document.getElementById('wlC'), { t: hist.map(h => F.toDate(h.d).getTime() / 1000), h: 150, money: true, label: 'Patrimoine net, un relevé par jour',
      series: [{ v: hist.map(h => h.net), color: L.P.acc, w: 2, area: true }], fmtY: x => F.k(x), nTicks: 2,
      tip: i => `<b>${F.date(hist[i].d)}</b><br>Net ${L.m(F.eur(hist[i].net, 0))}<br><span class="muted">Actifs ${L.m(F.eur(hist[i].gross, 0))} · dettes ${L.m(F.eur(hist[i].debt, 0))}</span>` });
  }
  L.on(el, 'click', '[data-wby]', (e, b) => { L.store.set('wl.by', b.dataset.wby); L.pf.patrimoine(el); });
  L.on(el, 'click', '[data-wadd]', (e, b) => itemForm(el, null, b.dataset.wadd || null));
  L.on(el, 'click', '[data-wedit]', (e, b) => itemForm(el, (W.lines || []).concat(W.debts || []).find(x => x.id === b.dataset.wedit)));
  L.on(el, 'keydown', '[data-wedit]', (e, b) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
  document.getElementById('wlSpend').onsubmit = async (e) => {
    e.preventDefault();
    try { await L.api('/api/patrimoine-reglages', { method: 'PUT', body: Object.fromEntries(new FormData(e.target).entries()) }); L.toast('Dépenses mensuelles enregistrées'); L.forget('/api/patrimoine'); L.pf.patrimoine(el, true); } catch (err) { L.toast(err.message, true); }
  };
};

/* Ajout ou modification d'un bien, d'un compte ou d'une dette (feuille du bas sur téléphone) */
function itemForm(el, it, kind0) {
  const kinds = (W && W.kinds) || [];
  const k = it ? it.kind : kind0 || 'livret';
  const isDebt = kk => !!(kinds.find(x => x.key === kk) || {}).debt;
  const opt = (debt) => kinds.filter(x => !!x.debt === debt).map(x => `<option value="${x.key}" ${x.key === k ? 'selected' : ''}>${L.esc(x.label)}</option>`).join('');
  const d = L.drawer.open('detail', { title: it ? `Modifier « ${L.esc(it.name)} »` : 'Ajouter au patrimoine', sub: 'Valeur déclarative, datée du jour de la saisie', narrow: true,
    html: `<form id="wlF" class="frm" style="grid-template-columns:1fr" autocomplete="off">
      <label class="fld"><span>Nature</span><select class="sel" name="kind"><optgroup label="Avoirs">${opt(false)}</optgroup><optgroup label="Dettes">${opt(true)}</optgroup></select></label>
      <label class="fld"><span>Nom</span><input class="inp" name="name" maxlength="60" required value="${L.esc(it ? it.name : '')}" placeholder="Livret A, maison, prêt auto…"></label>
      <label class="fld"><span id="wlVl">${isDebt(k) ? 'Capital restant dû (€)' : 'Valeur (€)'}</span><input class="inp" name="value" inputmode="decimal" required value="${L.esc(it ? it.value : '')}"></label>
      <label class="fld"><span id="wlRl">${isDebt(k) ? 'Taux du crédit (% par an, facultatif)' : 'Rendement (% par an, facultatif)'}</span><input class="inp" name="rate" inputmode="decimal" value="${L.esc(it && it.rate != null ? it.rate : '')}"></label>
      <label class="fld" id="wlM" ${isDebt(k) ? '' : 'hidden'}><span>Mensualité (€, facultatif)</span><input class="inp" name="monthly" inputmode="decimal" value="${L.esc(it && it.monthly ? it.monthly : '')}"></label>
      <label class="fld"><span>Note</span><input class="inp" name="note" maxlength="140" value="${L.esc(it && it.note ? it.note : '')}"></label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn p" type="submit">${it ? 'Enregistrer' : 'Ajouter'}</button>${it ? '<button class="btn danger" type="button" id="wlDel">Supprimer</button>' : ''}<span class="note" id="wlMsg"></span></div>
    </form>` });
  const f = d.querySelector('#wlF');
  f.kind.onchange = () => {
    const dt = isDebt(f.kind.value);
    d.querySelector('#wlVl').textContent = dt ? 'Capital restant dû (€)' : 'Valeur (€)';
    d.querySelector('#wlRl').textContent = dt ? 'Taux du crédit (% par an, facultatif)' : 'Rendement (% par an, facultatif)';
    d.querySelector('#wlM').hidden = !dt;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f).entries());
    if (!isDebt(body.kind)) delete body.monthly;
    try {
      await L.api(it ? '/api/patrimoine/' + encodeURIComponent(it.id) : '/api/patrimoine', { method: it ? 'PUT' : 'POST', body });
      L.toast(it ? 'Modification enregistrée' : 'Ajouté au patrimoine'); L.drawer.close(); L.forget('/api/patrimoine'); L.forget('/api/dashboard'); L.pf.patrimoine(el, true);
    } catch (err) { L.put('wlMsg', `<span class="dn">${L.esc(err.message)}</span>`); }
  };
  const del = d.querySelector('#wlDel');
  if (del) del.onclick = async () => {
    if (!(await L.confirmBox(`Supprimer « ${it.name} » du patrimoine ?`, 'Supprimer'))) return;
    try { await L.api('/api/patrimoine/' + encodeURIComponent(it.id), { method: 'DELETE' }); L.toast('Supprimé'); L.drawer.close(); L.forget('/api/patrimoine'); L.forget('/api/dashboard'); L.pf.patrimoine(el, true); } catch (err) { L.toast(err.message, true); }
  };
}
})();
