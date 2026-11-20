/* LUMIO — rapport du portefeuille, à imprimer ou enregistrer en PDF pour un rendez-vous : valeur,
   performance comparée à l'indice choisi, risque, répartition (ETF décomposés), lignes, bilan de
   santé, points d'attention et agenda, méthodes et sources. Document d'information, sans
   recommandation personnalisée. */
(function () {
'use strict';
const L = window.L;
const F = L.fmt;
const PER = { '1w': '1w', '1m': '1m', '3m': '3m', 'ytd': 'ytd', '1y': '1y', '3y': '3y', 'max': 'max' };

const bars = (rows, n = 8) => {
  const top = rows.slice(0, n), rest = rows.slice(n);
  const all = rest.length ? top.concat([{ label: `Autres (${rest.length})`, pct: rest.reduce((t, r) => t + r.pct, 0) }]) : top;
  return `<table class="rp-t rp-bars"><tbody>${all.map(r => `<tr><td>${L.esc(r.label)}</td><td class="rp-bar"><i style="width:${Math.min(100, r.pct).toFixed(1)}%"></i></td><td class="num">${F.n(r.pct, 1)} %</td></tr>`).join('')}</tbody></table>`;
};

async function render(root) {
  const per = PER[L.period()] || 'ytd';                // 1 jour n'a pas de sens pour un rapport : depuis le 1er janvier
  root.innerHTML = `<div class="ph rp-ph no-print"><h1 class="title">Rapport du portefeuille</h1>
      <div class="ph-r">${L.perSeg('sm', 'rpPer')}<button type="button" class="btn p" id="rpPrint">${L.icon('download')}Imprimer ou PDF</button></div></div>
    <p class="note no-print" style="margin:-6px 0 16px">Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression. La période suit le sélecteur ; 1J est remplacé par l'année en cours.</p>
    <article class="rp" id="rp">${L.skel(420)}</article>`;
  document.getElementById('rpPrint').onclick = () => window.print();
  let p, d, pf, q;
  try {
    [p, d, pf, q] = await Promise.all([L.loadPortfolio(), L.get('/api/dashboard', 50000),
      L.get(`/api/performance?period=${per}&bench=${encodeURIComponent(L.bench())}`, 120000), L.get('/api/quality', 30000).catch(() => null)]);
  } catch (e) { const el = document.getElementById('rp'); if (el) el.innerHTML = L.errBox(e); return; }
  const el = document.getElementById('rp'); if (!el) return;
  if (!p || p.empty) { el.innerHTML = '<div class="empty">Portefeuille vide : rien à présenter.</div>'; return; }
  const k = d.kpis || {}, r = pf.performance || {}, b = r.benchmark || {};
  const pct = x => x == null ? '—' : F.pct(x * 100, 1);
  const abs = x => x == null ? '—' : F.n(x * 100, 1) + '\u00a0%';
  const lines = (p.positions || []).slice().sort((a, z) => z.value - a.value);
  const accounts = [...new Set(lines.map(x => x.account))];
  const alloc = d.allocation?.lt || d.allocation?.raw || {};
  const alerts = (d.decisions || []).filter(x => x.kind === 'alerte').slice(0, 5);
  const agenda = (d.calendar || []).filter(e => e.held).slice(0, 6);
  const now = Date.now() / 1000;
  el.innerHTML = `
    <header class="rp-h"><div><div class="rp-k">LUMIO · rapport du portefeuille</div><h2>${F.dlong(now).replace(/^./, c => c.toUpperCase())} ${new Date().getFullYear()}</h2>
      <div class="note">${accounts.map(L.esc).join(', ')} · ${lines.length} lignes · période : ${L.esc(r.label || L.PLABEL[per] || per)}</div></div>
      <div class="rp-tot"><span class="rp-k">Valeur</span><b class="m">${L.m(F.eur(p.total_value, 0))}</b></div></header>
    <section class="rp-s"><h3>Performance et risque</h3>
      <div class="rp-kpis">
        <div><span class="rp-k">Rendement de la période (TWR)</span><b>${pct(r.twr)}</b><span class="note">${r.gain_eur != null ? L.m(F.eurS(r.gain_eur)) + ' de gain' : ''}</span></div>
        <div><span class="rp-k">${L.esc(b.label || 'Indice')}</span><b>${pct(b.twr)}</b><span class="note">${b.excess != null ? 'écart : ' + F.pct(b.excess * 100, 1) : ''}</span></div>
        <div><span class="rp-k">Rendement annualisé (XIRR)</span><b>${pct(r.mwr)}</b><span class="note">versements compris</span></div>
        <div><span class="rp-k">Plus-value latente</span><b class="m">${L.m(F.eurS(p.total_pnl))}</b><span class="note">${F.pct(p.total_pnl_pct, 1)}</span></div>
        <div><span class="rp-k">Volatilité</span><b>${abs(r.volatility)}</b><span class="note">annualisée</span></div>
        <div><span class="rp-k">Baisse maximale</span><b>${pct(r.max_drawdown)}</b><span class="note">sur la période</span></div>
        <div><span class="rp-k">Sharpe · bêta</span><b>${r.sharpe != null ? F.n(r.sharpe, 2) : '—'} · ${b.beta != null ? F.n(b.beta, 2) : '—'}</b><span class="note">bêta à ${L.esc(b.label || 'l\'indice')}</span></div>
        <div><span class="rp-k">Dividendes 12 mois</span><b class="m">${L.m(F.eur(k.dividends_ttm, 0))}</b><span class="note">prévus : ${L.m(F.eur(k.forecast_12m, 0))}</span></div>
      </div></section>
    <section class="rp-s rp-3"><div><h3>Secteurs</h3>${bars(alloc.sector || [])}</div><div><h3>Régions</h3>${bars(alloc.region || [], 6)}</div><div><h3>Devises</h3>${bars(alloc.currency || [], 5)}</div>
      <p class="note rp-full">ETF décomposés selon leurs principales lignes : l'exposition réelle, pas l'étiquette du fonds.</p></section>
    <section class="rp-s"><h3>Lignes</h3><table class="rp-t"><thead><tr><th>Ligne</th><th>Compte</th><th class="num">Valeur</th><th class="num">Poids</th><th class="num">Plus-value</th><th class="num">${L.esc(L.PSHORT?.[per] || per.toUpperCase())}</th></tr></thead><tbody>
      ${lines.map(x => { const tm = (d.treemap || []).find(t => t.uid === x.uid); const pp = tm?.perf?.[per];
        return `<tr><td>${L.esc(x.name)}<div class="note">${L.esc(x.sector || '')}${x.asset_type ? ' · ' + L.esc(x.asset_type) : ''}</div></td><td>${L.esc(x.account)}</td>
          <td class="num m">${L.m(F.eur(x.value, 0))}</td><td class="num">${F.n(x.weight, 1)} %</td><td class="num">${F.pct(x.pnl_pct, 1)}</td><td class="num">${pp != null ? F.pct(pp, 1) : '—'}</td></tr>`; }).join('')}
      </tbody></table></section>
    <section class="rp-s rp-2"><div><h3>Bilan de santé · ${d.health?.score ?? '—'}/100</h3>
        ${(d.health?.rules || []).map(h => `<div class="rp-rule"><span class="rp-st ${h.status}">${h.status === 'ok' ? '✓' : h.status === 'warn' ? '!' : '✕'}</span><div><b>${L.esc(h.label)}</b><div class="note">${L.esc(h.detail || '')}</div></div></div>`).join('')}</div>
      <div><h3>Points d'attention</h3>${alerts.length ? alerts.map(a => `<div class="rp-rule"><span class="rp-st warn">!</span><div><b>${L.esc(a.titre)}</b><div class="note">${L.esc(a.source || '')}${a.detail ? ' · ' + L.esc(a.detail) : ''}</div></div></div>`).join('') : '<p class="note">Aucune alerte en cours.</p>'}
        <h3 style="margin-top:16px">Agenda des lignes détenues</h3>${agenda.length ? agenda.map(e => `<div class="rp-rule"><span class="rp-st">${F.dshort(e.date)}</span><div><b>${L.esc(e.name)}</b><div class="note">${L.esc(e.label)}${e.estimated ? ' (date estimée)' : ''}</div></div></div>`).join('') : '<p class="note">Rien dans les 14 prochains jours.</p>'}</div></section>
    <footer class="rp-f note">Méthodes : TWR, rendement pondéré par le temps (versements neutralisés), comparable à un indice ; XIRR, taux de rendement de vos flux datés. Volatilité et Sharpe sur les séances de la période (taux sans risque : €STR).
      Cours : ${p.quotes_src === 'tr' ? 'Trade Republic (synchronisation)' : p.quotes_src === 'demo' ? 'marché simulé (démo)' : 'Yahoo Finance et Trade Republic'}${q ? ` ; qualité des données ${q.score}/100` : ''}. Établi par LUMIO le ${F.date(now)} à ${F.time(now)}.
      Document d'information sur un portefeuille existant : il ne constitue ni un conseil en investissement, ni une recommandation personnalisée.</footer>`;
}

document.addEventListener('lumio:period', () => { const v = document.getElementById('view-rapport'); if (v) render(v); });
document.addEventListener('lumio:bench', () => { const v = document.getElementById('view-rapport'); if (v) render(v); });

L.views.rapport = { render(root) { render(root); }, refresh() { } };
})();
