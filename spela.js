// Starta och spela: X01, cricket och övningar. Pågående spel sparas lokalt efter varje kast,
// färdiga legs/övningar läggs i offlinekön och skickas med spara_spel.
import { esc, fmt, proc, minns, uuid, write, laggIKo, skickaKo, tid, jag, val } from './lib.js?v=0.4.0';
import {
  TYPER, besok, fragaDubbel, utgang, kanGaUt, x01Snitt, plan, knappar, ovningSumma, ovningSlut,
  cricketLage, CRICKET, marksText, segText, malText, traff,
} from './spel.js?v=0.4.0';

let app = null;
let inmatning = '';      // X01: siffror som skrivits in
let fraga = null;        // X01: fråga om utgång/dubbelpilar efter ett besök
let tangent = null;      // aktiv tangentbordshanterare
let meddelande = '';
document.addEventListener('keydown', (e) => { if (tangent && !e.target.closest?.('input, textarea, select')) tangent(e); });

const pagaende = (v) => minns('pagaende', v);
const nu = () => new Date().toISOString();

// ============================================================ start
export function renderStart(el, alla) {
  app = el; tangent = null;
  const aktiva = alla.filter((s) => s.aktiv);
  const forst = jag(alla) ?? aktiva[0];
  const val = minns('val') ?? { typ: 'x01', spelare: forst ? [forst.id] : [], inst: {} };
  val.spelare = val.spelare.filter((id) => aktiva.some((s) => s.id === id));
  const p = pagaende();
  const namnPa = (ids) => ids.map((id) => alla.find((s) => s.id === id)?.namn ?? '?').join(', ');

  const inst = val.inst[val.typ] ?? {};
  const radio = (namn, alt, varde) => `<div class="val" data-inst="${namn}">${alt.map(([v, t]) =>
    `<button type="button" class="chip${String(v) === String(varde) ? ' vald' : ''}" data-v="${v}">${t}</button>`).join('')}</div>`;
  let installningar = '';
  if (val.typ === 'x01') installningar = `<h3>Start</h3>${radio('start', [[301, '301'], [501, '501']], inst.start ?? 501)}
      <h3>Först till</h3>${radio('forst_till', [[1, '1 leg'], [2, '2 legs'], [3, '3 legs'], [5, '5 legs']], inst.forst_till ?? 1)}`;
  if (val.typ === 'cricket') installningar = `<h3>Först till</h3>${radio('forst_till', [[1, '1 leg'], [2, '2 legs'], [3, '3 legs']], inst.forst_till ?? 1)}`;
  if (val.typ === 'scoring') installningar = `<h3>Mål</h3>${radio('mal', [...Array.from({ length: 20 }, (_, i) => [20 - i, String(20 - i)]), [25, 'Bull']], inst.mal ?? 20)}
      <h3>Antal pilar</h3>${radio('pilar', [[30, '30'], [60, '60'], [99, '99'], [100, '100']], inst.pilar ?? 100)}`;
  const beskr = {
    x01: 'Besöket skrivs in som summa. Dubbel ut. Nära utgång frågar appen hur många pilar som kastades på dubbel.',
    cricket: '15–20 och bull. Stäng med tre träffar, ta poäng på det som motståndaren inte stängt. MPR = marks per runda.',
    bobs27: 'Börja på 27. Tre pilar på varje dubbel D1–D20 och bull: träff ger dubbelns värde, alla miss drar av det. Slut vid 0.',
    dubbelrunda: 'Tre pilar på varje dubbel D1–D20 och bull. Träffprocent per dubbel.',
    jdc: '10–15 (3 pilar, shanghai +100), en pil per dubbel D1–D20 och bull (50 per träff), sedan 15–20.',
    scoring: 'Pilar mot ett mål. Singel, dubbel, trippel eller miss för varje pil.',
  }[val.typ];

  el.innerHTML = `
    ${p ? `<div class="card pagaende"><h2>Pågående: ${esc(TYPER[p.typ].namn)}${p.inst.start ? ` ${p.inst.start}` : ''}</h2>
      <p class="muted">${esc(namnPa(p.spelare))} · startat ${tid(p.leg.start)}</p>
      <p class="rad"><a class="btn primar" href="#/spel">Fortsätt</a> <button class="btn" id="slangpag" type="button">Avbryt spelet</button></p></div>` : ''}
    <div class="card">
      <h1>Spela</h1>
      <div class="val typval">${Object.entries(TYPER).map(([k, t]) => `<button type="button" class="chip${k === val.typ ? ' vald' : ''}" data-typ="${k}">${esc(t.namn)}</button>`).join('')}</div>
      <p class="muted">${esc(beskr)}</p>
      <h3>Spelare <span class="muted liten">i kastordning</span></h3>
      <div class="val" id="spelarval">${aktiva.map((s) => { const i = val.spelare.indexOf(s.id);
        return `<button type="button" class="chip${i >= 0 ? ' vald' : ''}" data-spelare="${s.id}">${i >= 0 ? `<b>${i + 1}</b> ` : ''}${esc(s.namn)}${s.anvandare ? '' : ' <span class="gast">gäst</span>'}</button>`; }).join('')}</div>
      <p class="forklaring">Spelare med eget konto ser spelet i sin statistik. Gäster är bara namn.</p>
      <form id="nyspelare" class="rad"><input name="namn" placeholder="Ny gäst" maxlength="40" autocomplete="off"><button class="btn" type="submit">Lägg till</button></form>
      ${installningar}
      <p class="msg" id="startmsg">${esc(meddelande)}</p>
      <button class="btn primar stor" id="starta" type="button"${val.spelare.length ? '' : ' disabled'}>Starta</button>
    </div>`;
  meddelande = '';

  const spara = () => { minns('val', val); renderStart(el, alla); };
  el.querySelectorAll('[data-typ]').forEach((b) => b.onclick = () => { val.typ = b.dataset.typ; spara(); });
  el.querySelectorAll('[data-spelare]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.spelare), i = val.spelare.indexOf(id);
    if (i >= 0) val.spelare.splice(i, 1); else val.spelare.push(id);
    spara();
  });
  el.querySelectorAll('[data-inst]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.onclick = () => {
    val.inst[val.typ] = { ...(val.inst[val.typ] ?? {}), [g.dataset.inst]: Number(b.dataset.v) };
    spara();
  }));
  el.querySelector('#nyspelare').onsubmit = async (e) => {
    e.preventDefault();
    const namn = e.target.namn.value.trim();
    if (!namn) return;
    try {
      const [s] = await write('POST', 'spelare', { namn, ordning: 10 });
      alla.push(s); minns('spelare', alla); val.spelare.push(s.id); spara();
    } catch (err) {
      el.querySelector('#startmsg').textContent = err.code === '23505' ? 'Det namnet finns redan.' : 'Ny spelare kräver nät.';
    }
  };
  el.querySelector('#slangpag')?.addEventListener('click', () => {
    if (confirm('Avbryta det pågående spelet? Det som inte är färdigspelat sparas inte.')) { pagaende(null); renderStart(el, alla); }
  });
  el.querySelector('#starta').onclick = () => {
    if (p && !confirm('Det finns ett pågående spel. Avbryta det och starta ett nytt?')) return;
    const i = val.inst[val.typ] ?? {};
    const installningar = val.typ === 'x01' ? { start: i.start ?? 501, forst_till: i.forst_till ?? 1 }
      : val.typ === 'cricket' ? { forst_till: i.forst_till ?? 1 }
        : val.typ === 'scoring' ? { mal: String(i.mal ?? 20), pilar: i.pilar ?? 100 } : {};
    nyttSpel(val.typ, installningar, val.spelare, Object.fromEntries(alla.map((s) => [s.id, s.namn])));
    location.hash = '#/spel';
  };
}

function nyttSpel(typ, inst, spelare, namn) {
  inmatning = ''; fraga = null;
  pagaende({
    typ, inst, spelare: [...spelare], namn, match_id: spelare.length > 1 || inst.forst_till > 1 ? uuid() : null,
    vunna: Object.fromEntries(spelare.map((id) => [id, 0])), legNr: 1,
    leg: { id: uuid(), start: nu(), rundor: [], pilar: [] }, klar: null,
  });
}

// ============================================================ spela
export function renderSpel(el) {
  app = el ?? app;
  const s = pagaende();
  if (!s) { location.hash = '#/'; return; }
  if (s.typ === 'x01') x01Vy(s);
  else if (s.typ === 'cricket') cricketVy(s);
  else ovningVy(s);
  // Pågående spel fyller skärmen utan scroll (Henrik 2026-11-22); resultatsidan scrollar som vanligt
  document.body.classList.toggle('spelar', !pagaende()?.klar);
}
const rita = () => renderSpel(app);
const ordning = (s) => { const k = (s.legNr - 1) % s.spelare.length; return [...s.spelare.slice(k), ...s.spelare.slice(0, k)]; };
const N = (s, id) => esc(s.namn[id] ?? '?');
const legInfo = (s) => (s.inst.forst_till > 1 ? `Leg ${s.legNr} · först till ${s.inst.forst_till}` : '');
const avbrytKnapp = `<button class="btn liten" id="avbryt" type="button">Avbryt</button>`;
const huvudKnappar = (kanAngra) => `<span class="huvudknappar"><button class="btn liten" id="angra" type="button"${kanAngra ? '' : ' disabled'}>Ångra</button>${avbrytKnapp}</span>`;
function kopplaAvbryt() {
  app.querySelector('#avbryt')?.addEventListener('click', () => {
    if (!confirm('Avbryta spelet? Det pågående leget/övningen sparas inte.')) return;
    pagaende(null); tangent = null; location.hash = '#/';
  });
}

// Färdigt leg/övning → offlinekön
function sparaLeg(s, spelarRader) {
  const inst = { ...s.inst };
  if (s.match_id) inst.leg = s.legNr;
  laggIKo({
    id: s.leg.id, typ: s.typ, installningar: inst, start: s.leg.start, slut: nu(), match_id: s.match_id, kalla: 'app', anteckning: null,
    spelare: spelarRader, rundor: s.leg.rundor, pilar: s.leg.pilar,
  });
  skickaKo();
}

function legSlut(s, vinnare) {
  s.vunna[vinnare]++;
  const matchKlar = s.vunna[vinnare] >= (s.inst.forst_till ?? 1);
  s.klar = { vinnare, match: matchKlar };
  sparaLeg(s, ordning(s).map((id, i) => ({ spelare_id: id, ordning: i + 1, vinnare: id === vinnare, resultat: null })));
}
function nastaLeg(s) {
  s.legNr++; s.klar = null; s.leg = { id: uuid(), start: nu(), rundor: [], pilar: [] };
}
function igen(s) { nyttSpel(s.typ, s.inst, s.spelare, s.namn); }

function slutKnappar(s, angraText) {
  const match = !s.klar || s.klar.match || s.klar.ovning;
  return `<p class="rad">
    ${match ? '<button class="btn primar" id="igen" type="button">Spela igen</button>' : '<button class="btn primar" id="nasta" type="button">Nästa leg</button>'}
    <button class="btn" id="angra" type="button">${angraText}</button>
    ${match ? '<a class="btn" href="#/" id="tillstart">Till start</a>' : ''}</p>`;
}
function kopplaSlut(s, angra) {
  app.querySelector('#nasta')?.addEventListener('click', () => { nastaLeg(s); pagaende(s); rita(); });
  app.querySelector('#igen')?.addEventListener('click', () => { igen(s); rita(); });
  app.querySelector('#tillstart')?.addEventListener('click', () => pagaende(null));
  app.querySelector('#angra')?.addEventListener('click', () => {
    if (s.klar.vinnare !== undefined && s.klar.vinnare !== null) s.vunna[s.klar.vinnare]--;
    s.klar = null; angra(s); pagaende(s); rita();
  });
}
const stallning = (s) => (s.spelare.length > 1 && s.inst.forst_till > 1
  ? `<p class="stallning">${ordning(s).map((id) => `${N(s, id)} <b>${s.vunna[id]}</b>`).join(' – ')}</p>` : '');

// ------------------------------------------------------------ X01
function x01Vy(s) {
  const ord = ordning(s), r = s.leg.rundor, start = s.inst.start;
  const kvar = (id) => start - r.filter((x) => x.spelare_id === id).reduce((a, x) => a + x.poang, 0);
  const tur = ord[r.length % ord.length];

  const kort = ord.map((id) => {
    const mina = r.filter((x) => x.spelare_id === id), k = kvar(id), forslag = val('forslag') && kanGaUt(k) ? utgang(k) : null;
    const senaste = mina.at(-1);
    return `<div class="spelarkort${id === tur && !s.klar ? ' tur' : ''}${s.klar?.vinnare === id ? ' vann' : ''}">
      <div class="namn">${N(s, id)}${s.spelare.length > 1 && s.inst.forst_till > 1 ? ` <span class="legs">${s.vunna[id]}</span>` : ''}</div>
      <div class="kvar">${k}</div>
      ${val('detaljer') || s.klar ? `<div class="liten">snitt ${fmt(x01Snitt(mina), 1)} · ${mina.reduce((a, x) => a + x.pilar, 0)} pilar${senaste ? ` · senast ${senaste.poang}` : ''}</div>` : ''}
      ${forslag && !s.klar ? `<div class="forslag">${forslag.map(segText).join(' ')}</div>` : ''}
    </div>`;
  }).join('');

  if (s.klar) {
    tangent = null;
    const rad = (id) => { const m = r.filter((x) => x.spelare_id === id), d = m.reduce((a, x) => a + x.pilar_dubbel, 0);
      return `<tr><td>${N(s, id)}</td><td>${fmt(x01Snitt(m), 1)}</td><td>${fmt(x01Snitt(m.filter((x) => x.nr <= 3)), 1)}</td><td>${m.reduce((a, x) => a + x.pilar, 0)}</td><td>${d ? proc(m.filter((x) => x.checkout).length, d) : '–'}</td></tr>`; };
    app.innerHTML = `<div class="card">
      <h1>${N(s, s.klar.vinnare)} vann ${s.klar.match && s.inst.forst_till > 1 ? 'matchen' : 'leget'}!</h1>
      ${stallning(s)}
      <div class="tavla">${kort}</div>
      <table class="tabell"><tr><th></th><th>Snitt</th><th>Första 9</th><th>Pilar</th><th>Dubbel</th></tr>${ord.map(rad).join('')}</table>
      ${slutKnappar(s, 'Ångra sista besöket')}</div>`;
    return kopplaSlut(s, (x) => x.leg.rundor.pop());
  }

  const k = kvar(tur);
  let panel;
  if (fraga?.steg === 'ut') {
    panel = `<p class="fraga">Utgång på ${fraga.kvar}! Med vilken pil?</p><div class="knappar tre">${[1, 2, 3].map((n) =>
      `<button class="btn stor" data-ut="${n}" type="button"${utgang(fraga.kvar, n) ? '' : ' disabled'}>${n}</button>`).join('')}</div>`;
  } else if (fraga?.steg === 'dubbel') {
    const min = fraga.res.ut ? 1 : 0;
    panel = `<p class="fraga">${fraga.res.bust ? 'Bust. ' : ''}Hur många pilar på dubbel?</p><div class="knappar fyra">${[0, 1, 2, 3].map((n) =>
      `<button class="btn stor" data-dubbel="${n}" type="button"${n < min || n > fraga.pilar ? ' disabled' : ''}>${n}</button>`).join('')}</div>`;
  } else {
    panel = `<div class="display${inmatning ? '' : ' tom'}">${inmatning || 'Poäng'}</div>
      <div class="knappar knappsats">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="btn" data-siffra="${n}" type="button">${n}</button>`).join('')}
        <button class="btn" data-siffra="radera" type="button" aria-label="Radera">⌫</button>
        <button class="btn" data-siffra="0" type="button">0</button>
        <button class="btn primar" data-siffra="ok" type="button">OK</button></div>`;
  }
  app.innerHTML = `<div class="spelyta">
    <div class="spelhuvud"><span>${start} · ${legInfo(s) || 'dubbel ut'}</span>${huvudKnappar(r.length || fraga)}</div>
    <div class="tavla">${kort}</div>
    <p class="tur-text">${N(s, tur)} kastar – ${k} kvar</p>
    ${panel}
    <p class="msg" id="msg">${esc(meddelande)}</p>
    
  </div>`;
  meddelande = '';
  kopplaAvbryt();

  const registrera = (poang, pilar, dubbel, ut) => {
    const mina = r.filter((x) => x.spelare_id === tur);
    r.push({ spelare_id: tur, nr: mina.length + 1, poang, pilar, pilar_dubbel: dubbel, checkout: ut });
    inmatning = ''; fraga = null;
    if (ut) legSlut(s, tur);
    pagaende(s); rita();
  };
  const ok = () => {
    if (!inmatning) return;
    const poang = Number(inmatning), res = besok(k, poang);
    if (res.fel) { meddelande = res.fel; inmatning = ''; return rita(); }
    if (fragaDubbel(k, res) && val('dubbelfraga')) { fraga = { poang, res, kvar: k, steg: res.ut ? 'ut' : 'dubbel', pilar: 3 }; return rita(); }
    if (res.ut) { fraga = { poang, res, kvar: k, steg: 'ut', pilar: 3, utanDubbel: true }; return rita(); }   // pilarna räknas i snittet
    registrera(res.bust ? 0 : poang, 3, 0, false);
  };
  const siffra = (v) => {
    if (v === 'ok') return ok();
    if (v === 'radera') inmatning = inmatning.slice(0, -1);
    else if (inmatning.length < 3) inmatning = (inmatning + v).replace(/^0(?=\d)/, '');
    rita();
  };
  app.querySelectorAll('[data-siffra]').forEach((b) => b.onclick = () => siffra(b.dataset.siffra));
  app.querySelectorAll('[data-ut]').forEach((b) => b.onclick = () => {
    fraga.pilar = Number(b.dataset.ut);
    if (fraga.utanDubbel) return registrera(fraga.poang, fraga.pilar, 1, true);
    fraga.steg = 'dubbel'; rita();
  });
  app.querySelectorAll('[data-dubbel]').forEach((b) => b.onclick = () => {
    const d = Number(b.dataset.dubbel);
    registrera(fraga.res.bust ? 0 : fraga.poang, fraga.pilar, d, fraga.res.ut);
  });
  app.querySelector('#angra').onclick = () => { if (fraga) fraga = null; else { r.pop(); } inmatning = ''; pagaende(s); rita(); };
  tangent = fraga ? (e) => {
    const n = Number(e.key);
    const b = app.querySelector(`[data-${fraga.steg === 'ut' ? 'ut' : 'dubbel'}="${n}"]`);
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
    if (e.key === 'Escape') { fraga = null; rita(); }
  } : (e) => {
    if (/^\d$/.test(e.key)) { e.preventDefault(); siffra(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); siffra('radera'); }
    else if (e.key === 'Enter') { e.preventDefault(); siffra('ok'); }
  };
}

// ------------------------------------------------------------ Cricket
function cricketVy(s) {
  tangent = null;
  const ord = ordning(s), p = s.leg.pilar;
  const { lage, vinnare } = cricketLage(ord, p);
  const tur = ord[Math.floor(p.length / 3) % ord.length];
  const iRundan = p.length % 3;
  const rundaPilar = p.slice(p.length - iRundan);
  const mpr = (id) => { const mina = p.filter((x) => x.spelare_id === id); return mina.length ? lage.get(id).allaMarks / Math.ceil(mina.length / 3) : null; };

  const tabell = `<table class="cricket"><tr><th></th>${ord.map((id) => `<th class="${id === tur && !s.klar ? 'tur' : ''}">${N(s, id)}${s.inst.forst_till > 1 && ord.length > 1 ? ` <span class="legs">${s.vunna[id]}</span>` : ''}</th>`).join('')}</tr>
    ${CRICKET.map((n) => `<tr><th>${n === 25 ? 'Bull' : n}</th>${ord.map((id) => `<td class="m${Math.min(3, lage.get(id).marks[n])}">${marksText(lage.get(id).marks[n])}</td>`).join('')}</tr>`).join('')}
    ${ord.length > 1 ? `<tr class="poang"><th>Poäng</th>${ord.map((id) => `<td>${lage.get(id).poang}</td>`).join('')}</tr>` : ''}
    <tr><th>MPR</th>${ord.map((id) => `<td>${fmt(mpr(id), 2)}</td>`).join('')}</tr></table>`;

  if (s.klar) {
    app.innerHTML = `<div class="card"><h1>${ord.length > 1 ? `${N(s, s.klar.vinnare)} vann ${s.klar.match && s.inst.forst_till > 1 ? 'matchen' : 'leget'}!` : 'Alla stängda!'}</h1>
      ${stallning(s)}${tabell}${slutKnappar(s, 'Ångra sista pilen')}</div>`;
    return kopplaSlut(s, (x) => x.leg.pilar.pop());
  }

  app.innerHTML = `<div class="spelyta">
    <div class="spelhuvud"><span>Cricket${legInfo(s) ? ` · ${legInfo(s)}` : ''}</span>${huvudKnappar(p.length)}</div>
    ${tabell}
    <p class="tur-text">${N(s, tur)} – pil ${iRundan + 1}<span class="rundpilar">${[0, 1, 2].map((i) => `<span class="pil">${rundaPilar[i] ? segText(rundaPilar[i].segment) : '·'}</span>`).join('')}</span></p>
    <div class="knappar cricketknappar">${CRICKET.map((n) => (n === 25
      ? `<button class="btn" data-seg="S25" type="button">25</button><button class="btn" data-seg="D25" type="button">Bull</button><button class="btn miss" data-seg="M" type="button">Miss</button>`
      : ['S', 'D', 'T'].map((m) => `<button class="btn${m === 'T' ? ' trippel' : m === 'D' ? ' dubbel' : ''}" data-seg="${m}${n}" type="button">${m === 'S' ? n : `${m}${n}`}</button>`).join(''))).join('')}
</div>
    
  </div>`;
  kopplaAvbryt();
  app.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => {
    const mina = p.filter((x) => x.spelare_id === tur).length;
    p.push({ spelare_id: tur, runda: Math.floor(mina / 3) + 1, nr: (mina % 3) + 1, mal: null, segment: b.dataset.seg });
    const v = cricketLage(ord, p).vinnare;
    if (v !== null) legSlut(s, v);
    pagaende(s); rita();
  });
  app.querySelector('#angra').onclick = () => { p.pop(); pagaende(s); rita(); };
  if (vinnare !== null && !s.klar) { legSlut(s, vinnare); pagaende(s); rita(); }
}

// ------------------------------------------------------------ Övningar (en rad per pil)
export function ovningLage(s) {
  const pl = plan(s.typ, s.inst), ord = s.spelare;
  const per = new Map(ord.map((id) => {
    const mina = s.leg.pilar.filter((x) => x.spelare_id === id);
    let k = mina.length, r = 0;
    while (r < pl.length && k >= pl[r].length) { k -= pl[r].length; r++; }
    const summa = ovningSumma(s.typ, mina);
    // färdiga rundor räknas för Bob's 27-slut: bara när rundan är klar (k === 0)
    const klar = r >= pl.length || (k === 0 && r > 0 && ovningSlut(s.typ, summa));
    return [id, { mina, runda: r, iRundan: k, summa, klar }];
  }));
  const kvar = ord.filter((id) => !per.get(id).klar);
  const tur = kvar.length ? kvar.reduce((a, id) => (per.get(id).runda < per.get(a).runda ? id : a), kvar[0]) : null;
  return { pl, per, tur };
}

function ovningVy(s) {
  tangent = null;
  const { pl, per, tur } = ovningLage(s);
  const resultatText = (sm) => (s.typ === 'dubbelrunda' ? `${sm.traffar} träff · ${proc(sm.traffar, sm.pilar)}` : `${sm.poang} p · ${proc(sm.traffar, sm.pilar)}`);
  const titel = `${TYPER[s.typ].namn}${s.typ === 'scoring' ? ` – ${malText(s.inst.mal === '25' ? '25' : s.inst.mal)}, ${s.inst.pilar} pilar` : ''}`;

  if (s.klar || tur === null) {
    if (!s.klar) {
      const ord = s.spelare, best = s.typ === 'dubbelrunda' ? (id) => per.get(id).summa.traffar : (id) => per.get(id).summa.poang;
      const topp = Math.max(...ord.map(best));
      s.klar = { ovning: true, vinnare: null };
      sparaLeg(s, ord.map((id, i) => ({ spelare_id: id, ordning: i + 1, vinnare: ord.length > 1 && best(id) === topp, resultat: null })));
      pagaende(s);
    }
    const malTabell = (id) => {
      const m = new Map();
      per.get(id).mina.forEach((x) => { const t = m.get(x.mal) ?? [0, 0]; t[0] += traff(x.mal, x.segment) ? 1 : 0; t[1]++; m.set(x.mal, t); });
      return [...m].map(([mal, [t, n]]) => `<span class="malcell${t ? ' traff' : ''}" title="${t} av ${n}">${esc(malText(mal))}<small>${t}/${n}</small></span>`).join('');
    };
    app.innerHTML = `<div class="card"><h1>${esc(titel)}</h1>
      ${s.spelare.map((id) => `<div class="resultat"><h2>${N(s, id)}: ${resultatText(per.get(id).summa)}</h2>
        ${s.typ === 'scoring' ? `<p class="muted">${per.get(id).summa.marks} marks på ${per.get(id).summa.pilar} pilar</p>` : `<div class="malrutor">${malTabell(id)}</div>`}</div>`).join('')}
      ${slutKnappar(s, 'Ångra sista pilen')}</div>`;
    return kopplaSlut(s, (x) => x.leg.pilar.pop());
  }

  const mig = per.get(tur), mal = pl[mig.runda][mig.iRundan];
  const rundaPilar = mig.mina.slice(mig.mina.length - mig.iRundan);
  app.innerHTML = `<div class="spelyta">
    <div class="spelhuvud"><span>${esc(titel)}</span>${huvudKnappar(s.leg.pilar.length)}</div>
    ${s.spelare.length > 1 ? `<div class="tavla">${s.spelare.map((id) => `<div class="spelarkort liten${id === tur ? ' tur' : ''}"><div class="namn">${N(s, id)}</div><div class="liten">${resultatText(per.get(id).summa)}</div></div>`).join('')}</div>` : ''}
    <div class="malvy">
      <div class="liten muted">Runda ${mig.runda + 1} av ${pl.length}${s.spelare.length > 1 ? ` · ${N(s, tur)}` : ''}</div>
      <div class="mal">${esc(malText(mal))}</div>
      <div class="summa">${s.typ === 'dubbelrunda' ? `${mig.summa.traffar} träffar` : `${mig.summa.poang} poäng`} · ${proc(mig.summa.traffar, mig.summa.pilar)}</div>
    </div>
    <div class="pilrad">${pl[mig.runda].map((m, i) => `<span class="pil${rundaPilar[i] && traff(rundaPilar[i].mal, rundaPilar[i].segment) ? ' traff' : ''}">${rundaPilar[i] ? segText(rundaPilar[i].segment) : (m !== mal || i > mig.iRundan ? esc(malText(m)) : '')}</span>`).join('')}</div>
    <div class="knappar ${knappar(mal).length === 2 ? 'tva' : knappar(mal).length === 3 ? 'tre' : 'fyra'}">${knappar(mal).map((k) =>
      `<button class="btn stor${k.seg === 'M' ? ' miss' : ' traffknapp'}" data-seg="${k.seg}" type="button">${k.text}</button>`).join('')}</div>
    
  </div>`;
  kopplaAvbryt();
  app.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => {
    s.leg.pilar.push({ spelare_id: tur, runda: mig.runda + 1, nr: mig.iRundan + 1, mal, segment: b.dataset.seg });
    pagaende(s); rita();
  });
  app.querySelector('#angra').onclick = () => { s.leg.pilar.pop(); pagaende(s); rita(); };
}
