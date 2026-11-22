// Startsidan: fortsätt spel, nästa turneringsmatch, snabbstart, form och senaste spel.
import { api, esc, fmt, jag, minns, tid } from './lib.js?v=0.7.0';
import { TYPER } from './spel.js?v=0.7.0';
import { hamtaTurneringar, minaMatcher, hamtaLive } from './turnering.js?v=0.7.0';
import { gaMed } from './spela.js?v=0.7.0';

const VECKODAG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const RUTOR = [
  ['x01', '501', 'Match eller solo'],
  ['cricket', '15–20', 'Stäng och ta poäng'],
  ['bobs27', '27', 'Dubblar från 27'],
  ['jdc', 'JDC', 'Poäng och dubblar'],
  ['dubbelrunda', 'D1–20', 'Runt dubblarna'],
  ['scoring', '◎', 'Pilar mot ett mål'],
];

export async function renderHem(el, alla) {
  const mig = jag(alla), p = minns('pagaende');
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const N = (id) => esc(alla.find((s) => s.id === id)?.namn ?? '?');
  const pagaendeKort = p && !p.klar ? `<a class="hemkort fortsatt" href="#/spel">
      <span class="hk-titel">Fortsätt ${esc(TYPER[p.typ].namn)}${p.turnering ? ` · ${esc(p.turnering.namn)}` : ''}</span>
      <span class="hk-info">${p.spelare.map((id) => esc(p.namn[id] ?? '?')).join(' – ')} · startat ${tid(p.leg.start)}</span></a>` : '';

  el.innerHTML = `
    <section class="hero">
      <img src="${new URL('ikon.svg', import.meta.url).href}" alt="" class="hero-tavla" aria-hidden="true">
      <p class="hero-dag">${VECKODAG[d.getDay()]} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}</p>
      <h1>Hej${mig ? `, ${esc(mig.namn)}` : ''}!</h1>
      <div id="form" class="hero-form"></div>
    </section>
    ${pagaendeKort}
    <div id="live"></div>
    <div id="turneringar"></div>
    <h2 class="hemrubrik">Spela</h2>
    <div class="rutor">${RUTOR.map(([typ, tecken, text]) => `<a class="ruta" href="#/ny/${typ}">
      <span class="ruta-tecken">${tecken}</span><span class="ruta-namn">${esc(TYPER[typ].namn)}</span><span class="ruta-text">${text}</span></a>`).join('')}</div>
    <div id="senaste"></div>`;

  if (!mig) return;
  // Det som kräver nät fylls på efteråt – startsidan syns direkt även utan nät
  try {
    const [x01, ovr, turneringar, live] = await Promise.all([
      api(`v_x01?spelare_id=eq.${mig.id}&select=spel_id,start,snitt,poang,pilar,vinnare,startpoang,mot&order=start.desc&limit=30`),
      api(`v_resultat?spelare_id=eq.${mig.id}&select=spel_id,typ,start,poang,traffar,pilar,mpr,rundor,vinnare,installningar&order=start.desc&limit=30`),
      hamtaTurneringar().catch(() => []), hamtaLive(),
    ]);
    // Form: snitt senaste 5 legs mot alla
    const snitt = (r) => { const p2 = r.reduce((a, x) => a + Number(x.poang), 0), n = r.reduce((a, x) => a + Number(x.pilar), 0); return n ? (3 * p2) / n : null; };
    const cr = ovr.filter((r) => r.typ === 'cricket');
    const mpr = (r) => { const m = r.reduce((a, x) => a + Number(x.mpr ?? 0) * Number(x.rundor), 0), n = r.reduce((a, x) => a + Number(x.rundor), 0); return n ? m / n : null; };
    const pil = (nu, forut) => (nu === null || forut === null ? '' : nu > forut + 0.05 ? '<span class="upp">▲</span>' : nu < forut - 0.05 ? '<span class="ner">▼</span>' : '');
    const formBit = [
      x01.length ? `<div><b>${fmt(snitt(x01.slice(0, 5)), 1)}</b>${pil(snitt(x01.slice(0, 5)), snitt(x01))}<small>X01-snitt, senaste 5</small></div>` : '',
      cr.length ? `<div><b>${fmt(mpr(cr.slice(0, 5)), 2)}</b>${pil(mpr(cr.slice(0, 5)), mpr(cr))}<small>MPR, senaste 5</small></div>` : '',
    ].join('');
    el.querySelector('#form').innerHTML = formBit;

    // Motspelaren har startat en match på distans som jag är med i
    const vantande = live.filter((l) => l.tillstand.spelare?.includes(mig.id) && p?.turnering?.match !== l.turnering_match);
    const liveEl = el.querySelector('#live');
    liveEl.innerHTML = vantande.map((l) => `<button class="hemkort fortsatt" data-gamed="${l.turnering_match}" type="button">
      <span class="hk-titel">Gå med i matchen · ${esc(l.tillstand.turnering?.namn ?? '')}</span>
      <span class="hk-info">mot ${N(l.tillstand.spelare.find((id) => id !== mig.id))} · på distans</span></button>`).join('');
    liveEl.querySelectorAll('[data-gamed]').forEach((b) => b.onclick = () => gaMed(b.dataset.gamed, mig.id).catch((e) => alert(e.message)));

    const aktiva = turneringar.filter((t) => !t.klar);
    el.querySelector('#turneringar').innerHTML = aktiva.length ? `<h2 class="hemrubrik">Turneringar</h2>${aktiva.map((t) => {
      const m = minaMatcher(t, mig.id)[0];
      return `<a class="hemkort" href="#/turnering/${t.id}"><span class="hk-titel">${esc(t.namn)}</span>
        <span class="hk-info">${m ? `Din nästa match: <b>mot ${N(m.p1 === mig.id ? m.p2 : m.p1)}</b>${m.pagar ? ` (${m.p1 === mig.id ? m.legs1 : m.legs2}–${m.p1 === mig.id ? m.legs2 : m.legs1})` : ''}` : 'Inga matcher att spela just nu'}</span></a>`;
    }).join('')}` : '';

    const senaste = [...x01.map((r) => ({ ...r, typ: 'x01' })), ...ovr].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, 4);
    const res = (r) => (r.typ === 'x01' ? `snitt ${fmt(r.snitt, 1)}` : r.typ === 'cricket' ? `MPR ${fmt(r.mpr, 2)}` : r.typ === 'dubbelrunda' ? `${r.traffar} träff` : `${r.poang} p`);
    el.querySelector('#senaste').innerHTML = senaste.length ? `<h2 class="hemrubrik">Senaste</h2><div class="card senaste">
      ${senaste.map((r) => `<div class="senrad"><span>${r.vinnare ? '🏆 ' : ''}${esc(r.typ === 'x01' ? `X01 ${r.startpoang}${r.mot ? ` mot ${r.mot}` : ''}` : TYPER[r.typ]?.namn ?? r.typ)}</span><span class="muted">${tid(r.start).slice(0, 10)}</span><b>${res(r)}</b></div>`).join('')}
      <p class="rad"><a href="#/historik">Alla spel</a> · <a href="#/statistik">Statistik</a></p></div>` : '';
  } catch { /* utan nät: bara snabbstart och pågående spel */ }
}
