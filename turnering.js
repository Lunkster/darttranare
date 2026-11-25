// Turneringar: lista, skapa (bara admin), tabell eller utslagsträd, matcher att spela.
// Matchresultat och tabell räknas i spel.js ur vyn v_turnering_leg – inget lagras.
import { api, rpc, fraga, varna, esc, fmt, jag, arAdmin, anvandarId, minns, uuid, datum, spelarLank, matchLank } from './lib.js?v=0.10.0';
import { serieSchema, utslagSchema, lopandeSchema, matchlagen, turneringstabell } from './spel.js?v=0.10.0';
import { startaTurneringsmatch, startaDistans, gaMed } from './spela.js?v=0.10.0';

const FORMAT = { serie: 'Serie', utslag: 'Utslag', lopande: 'Löpande serie' };
const antalSet = (t) => t.installningar?.set ?? 1;
const formText = (t) => [t.format === 'serie' && t.installningar?.dubbelmote ? 'Serie, dubbelmöte' : FORMAT[t.format] + (t.format === 'lopande' ? `, ${t.lagen?.length ?? ''} matcher` : ''),
  t.typ === 'x01' ? t.installningar?.start ?? 501 : 'Cricket',
  antalSet(t) > 1 ? `först till ${antalSet(t)} set à ${t.installningar?.forst_till > 1 ? `${t.installningar.forst_till} legs` : '1 leg'}` : `först till ${t.installningar?.forst_till ?? 1}`].join(' · ');
// Resultat i en match: set när matchen spelas i set, annars legs
const resultat = (t, m) => (antalSet(t) > 1 ? `${m.set1 ?? 0}–${m.set2 ?? 0}` : `${m.legs1}–${m.legs2}`);
const rundnamn = (r, antal) => ({ 0: 'Final', 1: 'Semifinal', 2: 'Kvartsfinal' }[antal - r] ?? `Runda ${r}`);

// Alla turneringar man ser, med matchlägen – används också av startsidan
export async function hamtaTurneringar() {
  const [turneringar, deltagare, matcher, legs, legvinster] = await Promise.all([
    api('turnering?select=*&order=skapad.desc'), api('turnering_deltagare?select=*'),
    api('turnering_match?select=*'), api('v_turnering_leg?select=*'),
    api('v_turnering_legvinst?select=turnering_match,start,vinnare').catch(() => []),
  ]);
  return turneringar.map((t) => {
    const lagen = matchlagen(matcher.filter((m) => m.turnering_id === t.id), legs, t.installningar?.forst_till ?? 1, antalSet(t), legvinster);
    // Löpande serie: matcherna spelas i tur och ordning – bara nästa ospelade går att spela
    if (t.format === 'lopande') { const nasta = lagen.find((m) => !m.klar); lagen.forEach((m) => { m.spelbar = m === nasta; }); }
    const d = deltagare.filter((x) => x.turnering_id === t.id).sort((a, b) => a.seed - b.seed).map((x) => x.spelare_id);
    const klar = lagen.length > 0 && lagen.every((m) => m.klar);
    return { ...t, deltagare: d, lagen, klar };
  });
}

export const minaMatcher = (t, mig) => t.lagen.filter((m) => m.spelbar && (m.p1 === mig || m.p2 === mig));
// Matcher som spelas på distans just nu (läget ligger i live_match tills matchen är slut)
export const hamtaLive = () => api('live_match?select=turnering_match,version,tillstand').catch(() => []);

// hur = 'har' (en skärm) eller 'distans' (var sin telefon)
async function starta(t, m, alla, hur) {
  const namn = Object.fromEntries(alla.map((s) => [s.id, s.namn]));
  const p = minns('pagaende');
  if (p?.turnering?.match === m.id && !p.klar) { location.hash = '#/spel'; return; }
  if (p && !p.klar && !(await fraga('Det finns ett pågående spel. Avbryta det och starta matchen?', { ok: 'Starta matchen', avbryt: 'Behåll', fara: true }))) return;
  const inst = { ...(t.typ === 'x01' ? { start: t.installningar?.start ?? 501 } : {}), forst_till: t.installningar?.forst_till ?? 1, ...(antalSet(t) > 1 ? { set: antalSet(t) } : {}) };
  const turnering = { match: m.id, id: t.id, namn: t.namn, ...(t.format === 'lopande' ? { omgang: `match ${m.runda}/${t.lagen.length}` } : {}),
    vunna: m.aktuella, set: { [m.p1]: m.set1 ?? 0, [m.p2]: m.set2 ?? 0 }, spelade: m.legs1 + m.legs2 };
  if (hur === 'distans') return startaDistans(t.typ, inst, [m.p1, m.p2], namn, turnering, jag(alla).id);
  startaTurneringsmatch(t.typ, inst, [m.p1, m.p2], namn, turnering);
}

export async function renderTurneringar(el, alla) {
  const lista = await hamtaTurneringar();
  const mig = jag(alla)?.id, N = (id) => esc(alla.find((s) => s.id === id)?.namn ?? '?');
  el.innerHTML = `<div class="card"><div class="rubrikrad"><h1>Turneringar</h1>
      ${jag(alla) ? '<a class="btn primar" href="#/turnering/ny">Ny turnering</a>' : ''}</div>
    ${lista.length ? '' : '<p class="muted">Inga turneringar än.</p>'}
    ${lista.map((t) => {
      const nasta = minaMatcher(t, mig)[0];
      return `<a class="turneringskort${t.klar ? ' klar' : ''}" href="#/turnering/${t.id}">
        <span class="tk-namn">${esc(t.namn)}</span>
        <span class="tk-info">${formText(t)} · ${t.deltagare.length} spelare</span>
        <span class="tk-status">${t.format === 'lopande' ? lopandeStatus(t, N)
          : t.klar ? `Klar – vinnare ${N(t.format === 'utslag' ? t.lagen.at(-1)?.vinnare : turneringstabell(t.deltagare, t.lagen)[0]?.spelare_id)}`
          : nasta ? `Din nästa match: mot ${N(nasta.p1 === mig ? nasta.p2 : nasta.p1)}` : `${t.lagen.filter((m) => m.klar && !m.walkover).length} av ${t.lagen.filter((m) => !m.walkover).length} matcher spelade`}</span>
      </a>`;
    }).join('')}</div>`;
}

// Löpande serie: ställningen i matcher, t.ex. "Anna 7 – 5 Bo · 12 av 20 matcher"
function lopandeStatus(t, N) {
  const [a, b] = t.deltagare, klara = t.lagen.filter((m) => m.klar);
  const v = (p) => klara.filter((m) => m.vinnare === p).length;
  return `${N(a)} ${v(a)} – ${v(b)} ${N(b)} · ${klara.length} av ${t.lagen.length} matcher${t.klar ? ` · ${v(a) === v(b) ? 'oavgjort' : `${N(v(a) > v(b) ? a : b)} vann`}` : ''}`;
}

export async function renderTurnering(el, alla, id) {
  const [lista, live] = await Promise.all([hamtaTurneringar(), hamtaLive()]);
  const t = lista.find((x) => x.id === id);
  if (!t) { el.innerHTML = '<div class="card"><h1>Turneringen finns inte</h1><p class="muted">Eller så är du inte med i den.</p><a class="btn" href="#/turneringar">Alla turneringar</a></div>'; return; }
  const mig = jag(alla)?.id, N = (pid) => (pid === null || pid === undefined ? '–' : esc(alla.find((s) => s.id === pid)?.namn ?? '?'));
  const NL = (pid) => (pid === null || pid === undefined ? '–' : spelarLank(pid, alla.find((s) => s.id === pid)?.namn ?? '?'));   // namn som länk
  const mina = minaMatcher(t, mig);
  const kanSpela = (m) => m.spelbar && (m.p1 === mig || m.p2 === mig || t.deltagare.includes(mig) || arAdmin());
  const harKonto = (pid) => !!alla.find((s) => s.id === pid)?.anvandare;
  // På distans: båda har konto och jag är en av dem
  const kanDistans = (m) => (m.p1 === mig || m.p2 === mig) && harKonto(m.p1) && harKonto(m.p2);
  const liveFor = (m) => live.find((l) => l.turnering_match === m.id);
  const lokal = minns('pagaende');
  const knapp = (m) => {
    if (!kanSpela(m)) return '<span></span>';
    if (lokal?.turnering?.match === m.id && !lokal.klar) return `<a class="btn liten primar" href="#/spel">Fortsätt</a>`;
    if (liveFor(m)) return kanDistans(m) ? `<button class="btn liten primar" data-gamed="${m.id}" type="button">Gå med</button>` : '<span class="livemarke">pågår</span>';
    return `<button class="btn liten${m.p1 === mig || m.p2 === mig ? ' primar' : ''}" data-spela="${m.id}" type="button">${m.pagar ? 'Fortsätt' : 'Spela'}</button>`;
  };
  const matchrad = (m) => `<div class="matchrad${m.klar ? ' klar' : ''}">
      <span class="${m.vinnare === m.p1 && m.p1 !== null ? 'vann' : ''}">${NL(m.p1)}</span>
      <span class="res">${m.walkover ? 'w.o.' : m.klar || m.pagar ? matchLank(m.id, resultat(t, m)) : 'mot'}</span>
      <span class="${m.vinnare === m.p2 && m.p2 !== null ? 'vann' : ''}">${NL(m.p2)}</span>
      ${knapp(m)}
    </div>`;
  const rundor = [...new Set(t.lagen.map((m) => m.runda))];
  const tabell = turneringstabell(t.deltagare, t.lagen);
  const lop = t.format === 'lopande', egen = t.skapad_av && t.skapad_av === anvandarId();
  // Löpande serie: ställning, spelade matcher (senaste först) och nästa match – inte hela listan med ospelade
  const lopHtml = () => {
    const [a, b] = t.deltagare, klara = t.lagen.filter((m) => m.klar), v = (p) => klara.filter((m) => m.vinnare === p).length;
    const r = (p) => tabell.find((x) => x.spelare_id === p);
    const tal = (p) => (t.typ === 'x01' ? fmt(r(p)?.snitt, 1) : fmt(r(p)?.mpr, 2));
    const nasta = t.lagen.find((m) => !m.klar);
    return `<div class="card"><h2>Ställning</h2>
      <div class="lopstallning"><span class="${v(a) > v(b) ? 'vann' : ''}">${NL(a)}</span><b>${v(a)}–${v(b)}</b><span class="${v(b) > v(a) ? 'vann' : ''}">${NL(b)}</span></div>
      <table class="tabell turneringstabell"><tr><th></th><th>${NL(a)}</th><th>${NL(b)}</th></tr>
        <tr><td>Matcher</td><td>${v(a)}</td><td>${v(b)}</td></tr>
        ${antalSet(t) > 1 ? `<tr><td>Set</td><td>${klara.reduce((x, m) => x + (m.p1 === a ? m.set1 : m.set2), 0)}</td><td>${klara.reduce((x, m) => x + (m.p1 === b ? m.set1 : m.set2), 0)}</td></tr>` : ''}
        <tr><td>Legs</td><td>${r(a)?.legsFor ?? 0}</td><td>${r(b)?.legsFor ?? 0}</td></tr>
        <tr><td>${t.typ === 'x01' ? 'Snitt' : 'MPR'}</td><td>${tal(a)}</td><td>${tal(b)}</td></tr></table>
      <p class="forklaring">${klara.length} av ${t.lagen.length} matcher spelade. Matcherna spelas i tur och ordning, den som börjar växlar.</p></div>
    <div class="card"><h2>Matcher</h2>
      ${nasta && !mina.includes(nasta) ? `<h3>Match ${nasta.runda} av ${t.lagen.length}</h3>${matchrad(nasta)}` : ''}
      ${klara.length ? `<h3>Spelade</h3>${[...klara].reverse().map(matchrad).join('')}` : ''}
    </div>`;
  };
  el.innerHTML = `
    <div class="card">
      <h1>${esc(t.namn)}</h1>
      <p class="muted">${formText(t)} · skapad ${datum(t.skapad)}</p>
      ${t.klar && !lop ? `<p class="vinnarrad">🏆 ${NL(t.format === 'utslag' ? t.lagen.at(-1)?.vinnare : tabell[0]?.spelare_id)}</p>` : ''}
      ${lop && t.klar ? `<p class="vinnarrad">${lopandeStatus(t, N)}</p>` : ''}
      ${mina.length && !lop ? `<h3>Dina matcher</h3>${mina.map(matchrad).join('')}` : ''}
      ${lop && mina.length ? `<h3>Match ${mina[0].runda} av ${t.lagen.length}</h3>${mina.map(matchrad).join('')}` : ''}
      <div id="hurspela"></div>
    </div>
    ${lop ? lopHtml() : ''}
    ${t.format === 'serie' ? `<div class="card"><h2>Tabell</h2>
      <table class="tabell turneringstabell"><tr><th></th><th>M</th><th>V</th><th>F</th><th>Legs</th><th>P</th><th>${t.typ === 'x01' ? 'Snitt' : 'MPR'}</th></tr>
      ${tabell.map((r, i) => `<tr class="${r.spelare_id === mig ? 'jag' : ''}"><td>${i + 1}. ${NL(r.spelare_id)}</td><td>${r.matcher}</td><td>${r.vunna}</td><td>${r.forlorade}</td>
        <td>${r.legsFor}–${r.legsMot}</td><td><b>${r.poang}</b></td><td>${t.typ === 'x01' ? fmt(r.snitt, 1) : fmt(r.mpr, 2)}</td></tr>`).join('')}</table>
      <p class="forklaring">2 poäng per vunnen match, sedan legsskillnad och ${t.typ === 'x01' ? 'snitt' : 'MPR'}.</p></div>` : ''}
    ${lop ? '' : `<div class="card"><h2>${t.format === 'serie' ? 'Matcher' : 'Lottning'}</h2>
      ${rundor.map((r) => `<h3>${t.format === 'utslag' ? rundnamn(r, rundor.length) : `Omgång ${r}`}</h3>${t.lagen.filter((m) => m.runda === r).map(matchrad).join('')}`).join('')}
      <p class="forklaring">Matcherna kan spelas i vilken ordning som helst och samtidigt på olika ställen.</p>
    </div>`}
    ${arAdmin() || egen ? '<div class="card"><button class="btn liten fara" id="tabort" type="button">Ta bort turneringen</button> <span class="forklaring">Spelade legs finns kvar som vanliga spel.</span></div>' : ''}`;
  const fel = (e) => varna(e.natfel || e instanceof TypeError ? 'Spel på distans kräver nät.' : e.message);
  el.querySelectorAll('[data-spela]').forEach((b) => b.onclick = () => {
    const m = t.lagen.find((x) => x.id === b.dataset.spela);
    if (!kanDistans(m)) return starta(t, m, alla, 'har');
    // Båda har konto: fråga hur matchen spelas
    const ruta = el.querySelector('#hurspela');
    ruta.innerHTML = `<div class="hurspela"><h3>${N(m.p1)} mot ${N(m.p2)} – hur spelar ni?</h3>
      <button class="btn primar stor" data-hur="har" type="button">På den här skärmen</button>
      <button class="btn stor" data-hur="distans" type="button">På distans – var sin telefon</button>
      <p class="forklaring">På distans skriver var och en in sina egna kast, och båda ser ställningen direkt.</p></div>`;
    ruta.querySelectorAll('[data-hur]').forEach((h) => h.onclick = () => starta(t, m, alla, h.dataset.hur).catch(fel));
    ruta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  el.querySelectorAll('[data-gamed]').forEach((b) => b.onclick = () => gaMed(b.dataset.gamed, mig).catch(fel));
  el.querySelector('#tabort')?.addEventListener('click', async () => {
    if (!(await fraga(`Ta bort turneringen ${t.namn}? Det går inte att ångra.`, { ok: 'Ta bort', fara: true }))) return;
    try { await rpc('ta_bort_turnering', { tid: t.id }); location.hash = '#/turneringar'; } catch (e) { varna(e.message); }
  });
}

export function renderNyTurnering(el, alla) {
  const mig = jag(alla)?.id, admin = arAdmin();
  if (!mig && !admin) { el.innerHTML = '<div class="card"><h1>Ny turnering</h1><p class="muted">Du behöver vara kopplad till en spelare.</p></div>'; return; }
  const v = { namn: '', format: admin ? 'serie' : 'lopande', dubbelmote: false, typ: 'x01', start: 501, forst_till: 3, set: 1, antal: 10, deltagare: [], ...minns('nyturnering') };
  if (!admin) v.format = 'lopande';   // andra än admin skapar bara löpande serier där de själva är med
  const lop = v.format === 'lopande';
  if (lop && !admin && mig && !v.deltagare.includes(mig)) v.deltagare.unshift(mig);
  if (lop) v.deltagare = v.deltagare.slice(0, 2);
  const aktiva = alla.filter((s) => s.aktiv);
  const chips = (namn, alt, varde) => `<div class="val" data-falt="${namn}">${alt.map(([x, txt]) => `<button type="button" class="chip${String(x) === String(varde) ? ' vald' : ''}" data-v="${x}">${txt}</button>`).join('')}</div>`;
  el.innerHTML = `<form class="card" id="nyform">
    <h1>Ny turnering</h1>
    <label for="tnamn">Namn</label><input id="tnamn" maxlength="60" required value="${esc(v.namn)}" placeholder="t.ex. Vinterserien">
    <h3>Format</h3>${chips('format', [...(admin ? [['serie', 'Serie – alla möter alla'], ['utslag', 'Utslag']] : []), ['lopande', 'Löpande – två spelare']], v.format)}
    ${lop ? `<p class="forklaring">Två spelare möts i ett antal matcher i tur och ordning, den som börjar växlar.</p>
      <h3>Antal matcher</h3>${chips('antal', [[10, '10'], [20, '20'], [30, '30']], v.antal)}` : ''}
    ${v.format === 'serie' ? `<label class="vaxel"><input type="checkbox" id="dubbelmote"${v.dubbelmote ? ' checked' : ''}><span><b>Dubbelmöte</b><small>Alla möter alla två gånger.</small></span></label>` : ''}
    <h3>Spel</h3>${chips('typ', [['x01', 'X01'], ['cricket', 'Cricket']], v.typ)}
    ${v.typ === 'x01' ? chips('start', [[301, '301'], [501, '501'], [701, '701']], v.start) : ''}
    <h3>Set</h3>${chips('set', [[1, 'Inga set'], [2, 'Först till 2 set'], [3, 'Först till 3 set']], v.set)}
    <h3>${v.set > 1 ? 'Legs per set' : 'Legs per match'}</h3>${chips('forst_till', [[1, '1 leg'], [2, 'Först till 2'], [3, 'Först till 3'], [4, 'Först till 4'], [5, 'Först till 5']], v.forst_till)}
    <h3>${lop ? 'Spelare <span class="muted liten">välj två</span>' : 'Deltagare <span class="muted liten">i seedordning – bäst först</span>'}</h3>
    <div class="val" id="deltagarval">${aktiva.map((s) => { const i = v.deltagare.indexOf(s.id);
      return `<button type="button" class="chip${i >= 0 ? ' vald' : ''}" data-spelare="${s.id}">${i >= 0 ? `<b>${i + 1}</b> ` : ''}${esc(s.namn)}${s.anvandare ? '' : ' <span class="gast">gäst</span>'}</button>`; }).join('')}</div>
    <p class="forklaring">Deltagare med konto ser alla matcher i turneringen. Gäster spelas in av någon annan.</p>
    <p class="msg" id="nymsg"></p>
    <button class="btn primar stor" type="submit"${(lop ? v.deltagare.length === 2 : v.deltagare.length >= 2) ? '' : ' disabled'}>Skapa ${lop ? 'serien' : 'turneringen'}</button>
  </form>`;
  const spara = () => { v.namn = el.querySelector('#tnamn').value; minns('nyturnering', v); renderNyTurnering(el, alla); };
  el.querySelectorAll('[data-falt]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.onclick = () => {
    const x = b.dataset.v; v[g.dataset.falt] = /^\d+$/.test(x) ? Number(x) : x; spara();
  }));
  el.querySelector('#dubbelmote')?.addEventListener('change', (e) => { v.dubbelmote = e.target.checked; spara(); });
  el.querySelectorAll('[data-spelare]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.spelare), i = v.deltagare.indexOf(id);
    if (i >= 0) { if (!(lop && !admin && id === mig)) v.deltagare.splice(i, 1); }
    else if (lop && v.deltagare.length >= 2) v.deltagare.splice(admin ? 0 : 1, 1, id);   // byt ut motspelaren
    else v.deltagare.push(id);
    spara();
  });
  el.querySelector('#nyform').onsubmit = async (e) => {
    e.preventDefault();
    const namn = el.querySelector('#tnamn').value.trim(), m = el.querySelector('#nymsg');
    if (!namn) { m.textContent = 'Ge turneringen ett namn.'; return; }
    const matcher = lop ? lopandeSchema(v.deltagare, v.antal, uuid) : v.format === 'serie' ? serieSchema(v.deltagare, v.dubbelmote, uuid) : utslagSchema(v.deltagare, uuid);
    const installningar = { forst_till: v.forst_till, ...(v.set > 1 ? { set: v.set } : {}), ...(v.typ === 'x01' ? { start: v.start } : {}),
      ...(v.format === 'serie' ? { dubbelmote: v.dubbelmote } : {}), ...(lop ? { antal: v.antal } : {}) };
    try {
      m.textContent = 'Skapar …';
      const tid = await rpc('skapa_turnering', { p: { namn, format: v.format, typ: v.typ, installningar,
        deltagare: v.deltagare.map((id, i) => ({ spelare_id: id, seed: i + 1 })), matcher } }, true);
      minns('nyturnering', null);
      location.hash = `#/turnering/${tid}`;
    } catch (err) { m.textContent = err.natfel || err instanceof TypeError ? 'Att skapa en turnering kräver nät.' : err.message; }
  };
}
