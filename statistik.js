// Statistik per spelare: X01, cricket, övningarna och träff per dubbel. Allt räknas i vyerna.
import { api, esc, fmt, proc, minns, jag } from './lib.js?v=0.3.1';
import { linje, staplar } from './diagram.js?v=0.3.1';
import { malText } from './spel.js?v=0.3.1';

const summa = (rader, f) => rader.reduce((a, r) => a + Number(r[f] ?? 0), 0);
const max = (rader, f) => (rader.length ? Math.max(...rader.map((r) => Number(r[f] ?? -Infinity))) : null);
const nyckel = (v, t) => `<div class="nyckel"><div class="v">${v}</div><div class="t">${t}</div></div>`;

export async function renderStatistik(el, alla) {
  const aktiva = alla.filter((s) => s.aktiv);
  let vald = minns('statspelare') ?? jag(alla)?.id ?? aktiva[0]?.id;
  if (!alla.some((s) => s.id === vald)) vald = aktiva[0]?.id;
  const [x01, ovr, mal] = await Promise.all([
    api(`v_x01?spelare_id=eq.${vald}&order=start`),
    api(`v_resultat?spelare_id=eq.${vald}&order=start`),
    api(`v_mal?spelare_id=eq.${vald}`),
  ]);
  const typ = (t) => ovr.filter((r) => r.typ === t);

  // X01
  const pilarD = summa(x01, 'pilar_dubbel'), ut = summa(x01, 'checkouts');
  const x01html = x01.length ? `<div class="nycklar">
      ${nyckel(fmt((summa(x01, 'poang') * 3) / summa(x01, 'pilar'), 1), 'snitt')}
      ${nyckel(fmt(max(x01, 'snitt'), 1), 'bästa leg')}
      ${nyckel(proc(ut, pilarD, 0), `utgång (${ut}/${pilarD})`)}
      ${nyckel(max(x01, 'utgang') > 0 ? max(x01, 'utgang') : '–', 'högsta utgång')}
      ${nyckel(`${x01.filter((r) => r.vinnare).length}/${x01.length}`, 'vunna legs')}
      ${nyckel(`${summa(x01, 'plus100')} / ${summa(x01, 'plus140')} / ${summa(x01, 'maxar')}`, '100+ / 140+ / 180')}
    </div>
    <h3>Snitt per leg</h3>${linje(x01.map((r) => ({ x: r.start, y: r.snitt, text: `${r.startpoang}${r.mot ? ` mot ${r.mot}` : ''}` })))}
    <p class="forklaring">Linjen är medel av de fem senaste legen.</p>` : '<p class="muted">Inga X01-legs.</p>';

  // Cricket
  const cr = typ('cricket');
  const crhtml = cr.length ? `<div class="nycklar">
      ${nyckel(fmt(cr.reduce((a, r) => a + Number(r.mpr ?? 0) * Number(r.rundor), 0) / summa(cr, 'rundor'), 2), 'MPR')}
      ${nyckel(fmt(max(cr, 'mpr'), 2), 'bästa leg')}
      ${nyckel(`${cr.filter((r) => r.vinnare).length}/${cr.length}`, 'vunna legs')}
    </div><h3>MPR per leg</h3>${linje(cr.map((r) => ({ x: r.start, y: r.mpr })), { dec: 2 })}` : '<p class="muted">Inga cricketlegs.</p>';

  const ovning = (t, titel, dec = 0) => {
    const r = typ(t);
    if (!r.length) return '';
    return `<section class="card"><h2>${titel}</h2><div class="nycklar">
      ${nyckel(fmt(summa(r, 'poang') / r.length, 0), 'medel')}${nyckel(max(r, 'poang'), 'bästa')}
      ${nyckel(proc(summa(r, 'traffar'), summa(r, 'pilar'), 1), 'träff')}${nyckel(r.length, 'omgångar')}</div>
      ${linje(r.map((x) => ({ x: x.start, y: x.poang })), { dec })}</section>`;
  };

  // 100 pilar: per mål, poäng per pil så att olika antal pilar går att jämföra
  const sc = typ('scoring');
  const malLista = [...new Set(sc.map((r) => r.installningar?.mal))];
  const schtml = sc.length ? `<section class="card"><h2>Pilar mot ett mål</h2>${malLista.map((m) => {
    const r = sc.filter((x) => x.installningar?.mal === m);
    return `<h3>${esc(malText(m === '25' ? '25' : m))}</h3><div class="nycklar">
      ${nyckel(fmt((100 * summa(r, 'marks')) / summa(r, 'pilar'), 0), 'marks per 100 pilar')}
      ${nyckel(proc(summa(r, 'traffar'), summa(r, 'pilar'), 1), 'träff')}${nyckel(summa(r, 'pilar'), 'pilar')}</div>
      ${linje(r.map((x) => ({ x: x.start, y: (100 * x.marks) / x.pilar })), { dec: 0 })}`;
  }).join('')}</section>` : '';

  // Träff per dubbel, alla övningar
  const dub = new Map();
  mal.filter((r) => /^D/.test(r.mal)).forEach((r) => { const d = dub.get(r.mal) ?? { p: 0, t: 0 }; d.p += r.pilar; d.t += r.traffar; dub.set(r.mal, d); });
  const dubRader = [...dub].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([m, d]) => ({ text: malText(m), varde: d.p ? d.t / d.p : 0, etikett: `${proc(d.t, d.p)} (${d.t}/${d.p})` }));

  el.innerHTML = `
    <div class="card"><h1>Statistik</h1>
      <div class="val">${aktiva.map((s) => `<button type="button" class="chip${s.id === vald ? ' vald' : ''}" data-spelare="${s.id}">${esc(s.namn)}</button>`).join('')}</div>
    </div>
    <section class="card"><h2>X01</h2>${x01html}</section>
    <section class="card"><h2>Cricket</h2>${crhtml}</section>
    ${ovning('bobs27', "Bob's 27")}
    ${ovning('jdc', 'JDC Challenge')}
    ${typ('dubbelrunda').length ? `<section class="card"><h2>Runt dubblarna</h2><div class="nycklar">
      ${nyckel(proc(summa(typ('dubbelrunda'), 'traffar'), summa(typ('dubbelrunda'), 'pilar'), 1), 'träff')}${nyckel(typ('dubbelrunda').length, 'varv')}</div>
      ${linje(typ('dubbelrunda').map((x) => ({ x: x.start, y: (100 * x.traffar) / x.pilar })), { dec: 1, enhet: ' %' })}</section>` : ''}
    ${schtml}
    <section class="card"><h2>Träff per dubbel</h2><p class="forklaring">Alla pilar mot dubblar i övningarna (Bob's 27, runt dubblarna, JDC).</p>${staplar(dubRader)}</section>`;

  el.querySelectorAll('[data-spelare]').forEach((b) => b.onclick = () => { minns('statspelare', Number(b.dataset.spelare)); renderStatistik(el, alla); });
}
