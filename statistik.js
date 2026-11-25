// Statistik per spelare: X01, cricket, övningarna och träff per dubbel. Allt räknas i vyerna.
import { api, esc, fmt, proc, minns, jag, tid, arAdmin } from './lib.js?v=0.10.1';
import { linje, staplar } from './diagram.js?v=0.10.1';
import { malText, TYPER, sdtText } from './spel.js?v=0.10.1';
import { klubbInloggad, hamtaKlubb, klubbNycklar, klubbPunkter, klubbListor, kopplaKlubbListor, loggaInKlubb, klubbInfoKnapp, klubbInfo, kopplaKlubbInfo } from './klubb.js?v=0.10.1';

const summa = (rader, f) => rader.reduce((a, r) => a + Number(r[f] ?? 0), 0);
const max = (rader, f) => (rader.length ? Math.max(...rader.map((r) => Number(r[f] ?? -Infinity))) : null);
const nyckel = (v, t) => `<div class="nyckel"><div class="v">${v}</div><div class="t">${t}</div></div>`;

export async function renderStatistik(el, alla, spelareId = null) {
  // Bara registrerade spelare (med konto) i valet – gäster finns kvar i databasen men visas inte här.
  // #/spelare/<id> (länk från namn) visar vem som helst, även en gäst.
  const aktiva = alla.filter((s) => s.aktiv && s.anvandare);
  let vald = spelareId ?? minns('statspelare') ?? jag(alla)?.id ?? aktiva[0]?.id;
  if (spelareId === null && !aktiva.some((s) => s.id === vald)) vald = jag(alla)?.id ?? aktiva[0]?.id;
  const [x01, ovr, mal] = await Promise.all([
    api(`v_x01?spelare_id=eq.${vald}&order=start`),
    api(`v_resultat?spelare_id=eq.${vald}&order=start`),
    api(`v_mal?spelare_id=eq.${vald}`),
  ]);
  const typ = (t) => ovr.filter((r) => r.typ === t);

  // X01
  const pilarD = summa(x01, 'pilar_dubbel'), ut = summa(x01, 'checkouts');
  // Tävlingar från klubbappen (Bankeryds dartklubb) hör till X01: egna nyckeltal, rosa punkter i grafen, tävlingslista.
  // Läses direkt ur klubbappen och fylls på när de kommit.
  const spelaren = alla.find((s) => s.id === vald), egen = vald === jag(alla)?.id;
  const klubbBit = spelaren?.bdc_id ? (klubbInloggad() ? '<p class="muted">Hämtar tävlingarna från klubbappen …</p>' : loggaInKlubb)
    : egen ? '<p class="muted">Koppla dig till din spelare i klubbappen på <a href="#/jag">Min sida</a>, så syns dina tävlingar här.</p>' : '';
  const x01punkter = x01.map((r) => ({ x: r.start, y: r.snitt, text: `${r.startpoang}${r.mot ? ` mot ${r.mot}` : ''}` }));
  const graf = (klubbP = []) => `${linje([...x01punkter, ...klubbP])}
    <p class="forklaring"><span class="prick"></span> träning, ett leg · ${klubbP.length ? '<span class="prick klubb"></span> tävling, snitt för kvällen · ' : ''}linjen är medel av de fem senaste träningslegen.</p>`;
  const x01html = x01.length || spelaren?.bdc_id ? `<h3 class="delrubrik">Träning</h3>${x01.length ? `<div class="nycklar">
      ${nyckel(fmt((summa(x01, 'poang') * 3) / summa(x01, 'pilar'), 1), 'snitt')}
      ${nyckel(fmt(max(x01, 'snitt'), 1), 'bästa leg')}
      ${nyckel(proc(ut, pilarD, 0), `utgång (${ut}/${pilarD})`)}
      ${nyckel(max(x01, 'utgang') > 0 ? max(x01, 'utgang') : '–', 'högsta utgång')}
      ${nyckel(`${x01.filter((r) => r.vinnare).length}/${x01.length}`, 'vunna legs')}
      ${nyckel(`${summa(x01, 'plus100')} / ${summa(x01, 'plus140')} / ${summa(x01, 'maxar')}`, '100+ / 140+ / 180')}
    </div>` : '<p class="muted">Inga X01-legs.</p>'}
    ${klubbBit ? `<h3 class="delrubrik klubb">Tävling <span class="kalla">Bankeryds dartklubb</span>${spelaren?.bdc_id ? klubbInfoKnapp : ''}</h3>${spelaren?.bdc_id ? klubbInfo(spelaren.bdc_id) : ''}<div id="klubbnycklar">${klubbBit}</div>` : ''}
    <h3>Snitt</h3><div id="x01graf">${graf()}</div>
    <div id="klubblistor"></div>` : `<p class="muted">Inga X01-legs.</p>${klubbBit ? `<div id="klubbnycklar">${klubbBit}</div>` : ''}`;

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
      <p class="sdt">${sdtText({ singlar: summa(r, 'singlar'), dubblar: summa(r, 'dubblar'), tripplar: summa(r, 'tripplar') }, m)} <span class="muted">totalt</span></p>
      ${linje(r.map((x) => ({ x: x.start, y: (100 * x.marks) / x.pilar })), { dec: 0 })}`;
  }).join('')}</section>` : '';

  // Träff per dubbel, alla övningar
  const dub = new Map();
  mal.filter((r) => /^D/.test(r.mal)).forEach((r) => { const d = dub.get(r.mal) ?? { p: 0, t: 0 }; d.p += r.pilar; d.t += r.traffar; dub.set(r.mal, d); });
  const dubRader = [...dub].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    .map(([m, d]) => ({ text: malText(m), varde: d.p ? d.t / d.p : 0, etikett: `${proc(d.t, d.p)} (${d.t}/${d.p})` }));

  // De tio senaste spelen – varje rad leder till leget
  const senaste = [...x01.map((r) => ({ ...r, typ: 'x01' })), ...ovr].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, 10);
  el.innerHTML = `
    <div class="card"><h1>Statistik</h1>
      <div class="val">${aktiva.map((s) => `<button type="button" class="chip${s.id === vald ? ' vald' : ''}" data-spelare="${s.id}">${esc(s.namn)}</button>`).join('')}</div>
      ${aktiva.some((s) => s.id === vald) ? '' : `<p class="vald-gast"><b>${esc(spelaren?.namn ?? '?')}</b>${spelaren?.anvandare ? '' : ' <span class="gast">gäst</span>'}</p>`}
      ${vald !== jag(alla)?.id && !arAdmin() ? '<p class="forklaring">Visar bara spel där du själv var med.</p>' : ''}
    </div>
    <section class="card" id="x01kort"><h2>X01</h2>${x01html}</section>
    <section class="card"><h2>Cricket</h2>${crhtml}</section>
    ${ovning('bobs27', "Bob's 27")}
    ${ovning('jdc', 'JDC Challenge')}
    ${typ('catch40').length ? `<section class="card"><h2>Catch 40</h2><div class="nycklar">
      ${nyckel(fmt(summa(typ('catch40'), 'poang') / typ('catch40').length, 0), 'medel')}${nyckel(max(typ('catch40'), 'poang'), 'bästa')}
      ${nyckel(proc(summa(typ('catch40'), 'traffar'), summa(typ('catch40'), 'rundor'), 0), 'utgångar')}${nyckel(typ('catch40').length, 'omgångar')}</div>
      ${linje(typ('catch40').map((x) => ({ x: x.start, y: x.poang })), { dec: 0 })}</section>` : ''}
    ${typ('dubbelrunda').length ? `<section class="card"><h2>Runt dubblarna</h2><div class="nycklar">
      ${nyckel(proc(summa(typ('dubbelrunda'), 'traffar'), summa(typ('dubbelrunda'), 'pilar'), 1), 'träff')}${nyckel(typ('dubbelrunda').length, 'varv')}</div>
      ${linje(typ('dubbelrunda').map((x) => ({ x: x.start, y: (100 * x.traffar) / x.pilar })), { dec: 1, enhet: ' %' })}</section>` : ''}
    ${schtml}
    <section class="card"><h2>Träff per dubbel</h2><p class="forklaring">Alla pilar mot dubblar i övningarna (Bob's 27, runt dubblarna, JDC).</p>${staplar(dubRader)}</section>
    ${senaste.length ? `<section class="card"><h2>Senaste spel</h2>${senaste.map((r) => `<a class="legrad" href="#/leg/${r.spel_id}"><span class="muted">${tid(r.start).slice(0, 10)}</span>
      <span>${r.vinnare ? '🏆 ' : ''}${esc(r.typ === 'x01' ? `X01 ${r.startpoang ?? ''}` : TYPER[r.typ]?.namn ?? r.typ)}</span>
      <b>${r.typ === 'x01' ? fmt(r.snitt, 1) : r.typ === 'cricket' ? `MPR ${fmt(r.mpr, 2)}` : r.typ === 'dubbelrunda' ? `${r.traffar} träff` : `${r.poang} p`}</b></a>`).join('')}
      <p class="rad"><a class="lank" href="#/historik">Alla spel</a></p></section>` : ''}`;

  if (spelaren?.bdc_id && klubbInloggad()) {
    hamtaKlubb(spelaren.bdc_id).then((d) => {
      const n = el.querySelector('#klubbnycklar');
      if (!n) return;
      n.innerHTML = klubbNycklar(d);
      const g = el.querySelector('#x01graf'), l = el.querySelector('#klubblistor');
      if (g) g.innerHTML = graf(klubbPunkter(d));
      if (l) { l.innerHTML = klubbListor(d); kopplaKlubbListor(l); }
    }).catch((e) => {
      const n = el.querySelector('#klubbnycklar');
      if (n) n.innerHTML = e.klubb ? loggaInKlubb : `<p class="muted">Klubbappen svarar inte just nu (${esc(e.message)}).</p>`;
    });
  }
  kopplaKlubbInfo(el);
  el.querySelectorAll('[data-spelare]').forEach((b) => b.onclick = () => {
    minns('statspelare', Number(b.dataset.spelare));
    if (spelareId !== null) location.hash = '#/statistik'; else renderStatistik(el, alla);
  });
}
