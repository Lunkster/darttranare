// Spellogik utan sidan – regler, poäng och utgångar. Testas i tests/logik.html.
// Segment skrivs som i databasen: 'S20', 'D20', 'T20', 'S25' (25), 'D25' (bull), 'M' (miss).
// Mål: '20' (valfritt segment på 20), 'D8' (dubbel 8), 'D25' (bull), '25' (25 eller bull).

export const TYPER = {
  x01: { namn: 'X01', kort: 'X01' },
  cricket: { namn: 'Cricket', kort: 'Cricket' },
  bobs27: { namn: "Bob's 27", kort: "Bob's 27" },
  dubbelrunda: { namn: 'Runt dubblarna', kort: 'Dubblar' },
  jdc: { namn: 'JDC Challenge', kort: 'JDC' },
  scoring: { namn: 'Pilar mot ett mål', kort: 'Mål' },
};

export const nummer = (seg) => (seg === 'M' ? 0 : Number(seg.slice(1)));
export const mult = (seg) => ({ S: 1, D: 2, T: 3 }[seg[0]] ?? 0);
export const varde = (seg) => nummer(seg) * mult(seg);
export const malNummer = (mal) => Number(String(mal).replace(/^[DT]/, ''));
export const malMult = (mal) => ({ D: 2, T: 3 }[String(mal)[0]] ?? null);
export const traff = (mal, seg) => seg !== 'M' && nummer(seg) === malNummer(mal) && (malMult(mal) === null || mult(seg) === malMult(mal));
export const segText = (seg) => (seg === 'M' ? 'Miss' : seg === 'D25' ? 'Bull' : seg === 'S25' ? '25' : seg);
export const malText = (mal) => (mal === 'D25' ? 'Bull' : mal === '25' ? 'Bull/25' : String(mal));

// ---------- X01 ----------
const OMOJLIGA = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const EJ_UTGANG = new Set([159, 162, 163, 165, 166, 168, 169]);
export const giltigtBesok = (p) => Number.isInteger(p) && p >= 0 && p <= 180 && !OMOJLIGA.has(p);
export const kanGaUt = (kvar) => kvar >= 2 && kvar <= 170 && !EJ_UTGANG.has(kvar);

// Ett besök som totalsumma med dubbel ut. Returnerar {fel} eller {kvar, bust, ut}.
export function besok(kvar, poang) {
  if (!giltigtBesok(poang)) return { fel: `${poang} går inte att få med tre pilar.` };
  const ny = kvar - poang;
  if (ny === 0 && !kanGaUt(kvar)) return { fel: `${kvar} går inte att gå ut på.` };
  if (ny < 0 || ny === 1) return { kvar, bust: true, ut: false };
  return { kvar: ny, bust: false, ut: ny === 0 };
}

// Fråga om pilar på dubbel när besöket började på en utgång eller slutade nära en.
export const fragaDubbel = (kvarFore, res) => kvarFore <= 170 && (res.ut || res.bust || res.kvar <= 50);

// Föreslagen utgång (högst 3 pilar, sista på dubbel). null om det inte går.
const DUBBLAR = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'D25'];
const ALLA = [...Array.from({ length: 20 }, (_, i) => [`S${i + 1}`, `D${i + 1}`, `T${i + 1}`]).flat(), 'S25', 'D25'];
const DUBBEL_RANG = ['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D19', 'D14', 'D17', 'D15', 'D13', 'D11', 'D9', 'D6', 'D4', 'D7', 'D5', 'D3', 'D2', 'D1', 'D25'];
const kostnad = (seg) => (seg[0] === 'S' ? (seg === 'S25' ? 6 : 1) : seg[0] === 'T' ? 3 + (20 - nummer(seg)) / 10 : 5);
const utgangCache = new Map();
export function utgang(kvar, pilar = 3) {
  const nyckel = `${kvar}/${pilar}`;
  if (utgangCache.has(nyckel)) return utgangCache.get(nyckel);
  let bast = null, bastK = Infinity;
  const prova = (forst) => {
    const rest = kvar - forst.reduce((a, s) => a + varde(s), 0);
    const d = rest === 50 ? 'D25' : (rest % 2 === 0 && rest >= 2 && rest <= 40 ? `D${rest / 2}` : null);
    if (!d) return;
    const k = forst.length * 100 + DUBBEL_RANG.indexOf(d) + forst.reduce((a, s) => a + kostnad(s), 0);
    if (k < bastK) { bastK = k; bast = [...forst, d]; }
  };
  if (kvar <= 170 && kvar >= 2) {
    prova([]);
    if (!bast && pilar >= 2) ALLA.forEach((a) => prova([a]));
    if (!bast && pilar >= 3) ALLA.forEach((a) => ALLA.forEach((b) => { if (varde(a) >= varde(b)) prova([a, b]); }));
  }
  utgangCache.set(nyckel, bast);
  return bast;
}

// Statistik för en spelare i ett pågående eller färdigt X01-leg (rundor = [{poang, pilar}]).
export function x01Snitt(rundor) {
  const p = rundor.reduce((a, r) => a + r.poang, 0), n = rundor.reduce((a, r) => a + (r.pilar ?? 3), 0);
  return n ? (p * 3) / n : null;
}

// ---------- övningar med en rad per pil ----------
const DUBBELMAL = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'D25'];
const tre = (m) => [m, m, m];
const iTre = (lista) => lista.reduce((ut, m, i) => { if (i % 3 === 0) ut.push([]); ut[ut.length - 1].push(m); return ut; }, []);

// Spelplan: lista av rundor, varje runda = mål för pil 1–3.
export function plan(typ, inst = {}) {
  if (typ === 'bobs27' || typ === 'dubbelrunda') return DUBBELMAL.map(tre);
  if (typ === 'jdc') return [...[10, 11, 12, 13, 14, 15].map((n) => tre(String(n))), ...iTre(DUBBELMAL), ...[15, 16, 17, 18, 19, 20].map((n) => tre(String(n)))];
  if (typ === 'scoring') return iTre(Array(Number(inst.pilar) || 100).fill(String(inst.mal ?? '20')));
  return [];
}

// Knappar för en pil mot ett mål
export function knappar(mal) {
  mal = String(mal);
  if (/^[DT]/.test(mal)) return [{ seg: mal, text: 'Träff' }, { seg: 'M', text: 'Miss' }];
  if (mal === '25') return [{ seg: 'S25', text: '25' }, { seg: 'D25', text: 'Bull' }, { seg: 'M', text: 'Miss' }];
  return [{ seg: `S${mal}`, text: 'Singel' }, { seg: `D${mal}`, text: 'Dubbel' }, { seg: `T${mal}`, text: 'Trippel' }, { seg: 'M', text: 'Miss' }];
}

// Poäng per runda och totalt – samma regler som vyn dart.v_resultat.
export function rundPoang(typ, mal, segs) {
  const tr = segs.filter((s) => traff(mal, s));
  const n = malNummer(mal);
  if (typ === 'bobs27') return tr.length ? tr.length * 2 * n : -2 * n;
  if (typ === 'jdc') {
    if (String(mal).startsWith('D')) return 50 * tr.length;
    const shanghai = [1, 2, 3].every((m) => tr.some((s) => mult(s) === m));
    return n * tr.reduce((a, s) => a + mult(s), 0) + (shanghai ? 100 : 0);
  }
  if (typ === 'scoring') return tr.reduce((a, s) => a + varde(s), 0);
  return tr.length;
}

// pilar = [{runda, nr, mal, segment}] → {poang, traffar, pilar, marks}
export function ovningSumma(typ, pilar) {
  const rundor = new Map();
  pilar.forEach((p) => { if (!rundor.has(p.runda)) rundor.set(p.runda, []); rundor.get(p.runda).push(p); });
  let poang = typ === 'bobs27' ? 27 : 0;
  for (const r of rundor.values()) {
    if (typ === 'jdc' && String(r[0].mal).startsWith('D')) poang += 50 * r.filter((p) => traff(p.mal, p.segment)).length;
    else poang += rundPoang(typ, r[0].mal, r.map((p) => p.segment));
  }
  const tr = pilar.filter((p) => traff(p.mal, p.segment));
  return { poang: typ === 'dubbelrunda' ? null : poang, traffar: tr.length, pilar: pilar.length, marks: tr.reduce((a, p) => a + mult(p.segment), 0) };
}

// Bob's 27 tar slut när poängen når noll eller lägre
export const ovningSlut = (typ, summa) => typ === 'bobs27' && summa.poang <= 0;

// ---------- Cricket ----------
export const CRICKET = [20, 19, 18, 17, 16, 15, 25];

// spelare = [id, …], pilar = [{spelare_id, segment}] i kastordning → läge per spelare och ev. vinnare
export function cricketLage(spelare, pilar) {
  const lage = new Map(spelare.map((id) => [id, { marks: Object.fromEntries(CRICKET.map((n) => [n, 0])), poang: 0, allaMarks: 0 }]));
  let vinnare = null;
  for (const p of pilar) {
    if (vinnare !== null) break;
    const n = nummer(p.segment), m = mult(p.segment), l = lage.get(p.spelare_id);
    if (!CRICKET.includes(n)) continue;
    for (let i = 0; i < m; i++) {
      l.allaMarks++;
      if (l.marks[n] < 3) l.marks[n]++;
      else if (spelare.some((o) => o !== p.spelare_id && lage.get(o).marks[n] < 3)) l.poang += n;
    }
    const stangt = CRICKET.every((x) => l.marks[x] >= 3);
    if (stangt && spelare.every((o) => o === p.spelare_id || lage.get(o).poang <= l.poang)) vinnare = p.spelare_id;
  }
  return { lage, vinnare };
}
export const marksText = (m) => ['', '/', 'X', 'Ⓧ'][Math.min(3, m)];

// ---------- Turneringar ----------
// Spelschema för serie: alla möter alla (cirkelmetoden), ev. dubbelmöte med ombytta platser.
// spelare = [id, …] i seedordning, nyId = () => uuid. Returnerar [{id, runda, nr, spelare1, spelare2, fran1, fran2}].
export function serieSchema(spelare, dubbelmote = false, nyId) {
  const lista = spelare.length % 2 ? [...spelare, null] : [...spelare];
  const n = lista.length, ut = [];
  let rot = [...lista];
  for (let r = 0; r < n - 1; r++) {
    let nr = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i], b = rot[n - 1 - i];
      if (a === null || b === null) continue;   // fri omgång
      const [s1, s2] = r % 2 ? [b, a] : [a, b];
      ut.push({ id: nyId(), runda: r + 1, nr: ++nr, spelare1: s1, spelare2: s2, fran1: null, fran2: null });
    }
    rot = [rot[0], rot[n - 1], ...rot.slice(1, n - 1)];
  }
  if (dubbelmote) {
    const forsta = ut.length, rundor = n - 1;
    for (let i = 0; i < forsta; i++) {
      const m = ut[i];
      ut.push({ id: nyId(), runda: m.runda + rundor, nr: m.nr, spelare1: m.spelare2, spelare2: m.spelare1, fran1: null, fran2: null });
    }
  }
  return ut;
}

// Spelschema för utslag: seedning 1 mot sista, fria platser (walk over) till de högst seedade.
export function utslagSchema(spelare, nyId) {
  let storlek = 2; while (storlek < spelare.length) storlek *= 2;
  // seedordning i lottningen så att 1 och 2 bara kan mötas i finalen
  let ordning = [1];
  while (ordning.length < storlek) ordning = ordning.flatMap((s) => [s, ordning.length * 2 + 1 - s]);
  const plats = ordning.map((seed) => spelare[seed - 1] ?? null);
  const ut = [];
  let forra = [];
  for (let i = 0; i < storlek / 2; i++) {
    const m = { id: nyId(), runda: 1, nr: i + 1, spelare1: plats[2 * i], spelare2: plats[2 * i + 1], fran1: null, fran2: null };
    if (m.spelare1 === null) [m.spelare1, m.spelare2] = [m.spelare2, null];
    ut.push(m); forra.push(m);
  }
  for (let r = 2; forra.length > 1; r++) {
    const nya = [];
    for (let i = 0; i < forra.length / 2; i++) nya.push({ id: nyId(), runda: r, nr: i + 1, spelare1: null, spelare2: null, fran1: forra[2 * i].id, fran2: forra[2 * i + 1].id });
    ut.push(...nya); forra = nya;
  }
  return ut;
}

// Spelschema för löpande serie: två spelare, antal matcher i tur och ordning, den som börjar växlar.
export function lopandeSchema([a, b], antal, nyId) {
  return Array.from({ length: antal }, (_, i) => ({ id: nyId(), runda: i + 1, nr: 1, spelare1: i % 2 ? b : a, spelare2: i % 2 ? a : b, fran1: null, fran2: null }));
}

// Set: gå igenom legsens vinnare i tidsordning. forstTill = legs per set, set = set för att vinna matchen.
// Svar: {set: {id: vunna set}, legs: {id: legs i pågående set}, vinnare}
export function setLage(vinnare, spelare, forstTill, set) {
  const sv = Object.fromEntries(spelare.map((id) => [id, 0])), lv = { ...sv };
  let vann = null;
  for (const v of vinnare) {
    if (vann !== null || !(v in lv)) continue;
    lv[v]++;
    if (lv[v] >= forstTill) { sv[v]++; spelare.forEach((id) => { lv[id] = 0; }); if (sv[v] >= set) vann = v; }
  }
  return { set: sv, legs: lv, vinnare: vann };
}

// Läget i varje match: vilka som spelar (utslag: vinnaren från tidigare match), legs, vinnare.
// legs = [{turnering_match, spelare_id, legs, vunna, poang, pilar, marks, rundor}] (vyn v_turnering_leg)
// Med set (set > 1): legvinster = [{turnering_match, start, vinnare}] (vyn v_turnering_legvinst)
export function matchlagen(matcher, legs, forstTill, set = 1, legvinster = []) {
  const perId = new Map(matcher.map((m) => [m.id, m]));
  const lage = new Map();
  const los = (id) => {
    if (lage.has(id)) return lage.get(id);
    const m = perId.get(id);
    const spelare = (s, fran) => (s ?? (fran ? los(fran).vinnare : null));
    const p1 = spelare(m.spelare1, m.fran1), p2 = spelare(m.spelare2, m.fran2);
    const rad = (p) => legs.find((l) => l.turnering_match === id && l.spelare_id === p) ?? null;
    const l1 = rad(p1)?.vunna ?? 0, l2 = rad(p2)?.vunna ?? 0;
    const walkover = (p1 !== null && p2 === null && !m.fran2) ? p1 : (p2 !== null && p1 === null && !m.fran1) ? p2 : null;
    let vinnare = walkover ?? (l1 >= forstTill ? p1 : l2 >= forstTill ? p2 : null), sets = null;
    if (set > 1 && walkover === null && p1 !== null && p2 !== null) {
      const ordning = legvinster.filter((l) => l.turnering_match === id).sort((a, b) => (a.start < b.start ? -1 : 1)).map((l) => l.vinnare);
      sets = setLage(ordning, [p1, p2], forstTill, set);
      vinnare = sets.vinnare;
    }
    const res = { ...m, p1, p2, legs1: l1, legs2: l2, set1: sets?.set[p1] ?? null, set2: sets?.set[p2] ?? null,
      aktuella: sets ? sets.legs : { [p1]: l1, [p2]: l2 }, rad1: rad(p1), rad2: rad(p2), vinnare, walkover: walkover !== null,
      klar: vinnare !== null, spelbar: vinnare === null && p1 !== null && p2 !== null, pagar: vinnare === null && (l1 + l2) > 0 };
    lage.set(id, res);
    return res;
  };
  return matcher.map((m) => los(m.id)).sort((a, b) => a.runda - b.runda || a.nr - b.nr);
}

// Tabell: 2 poäng per vunnen match, sedan legsskillnad och snitt (X01) eller MPR (cricket).
export function turneringstabell(deltagare, lagen) {
  const t = new Map(deltagare.map((id) => [id, { spelare_id: id, matcher: 0, vunna: 0, forlorade: 0, legsFor: 0, legsMot: 0, poangX: 0, pilar: 0, marks: 0, rundor: 0 }]));
  for (const m of lagen) {
    for (const [p, rad, lf, lm] of [[m.p1, m.rad1, m.legs1, m.legs2], [m.p2, m.rad2, m.legs2, m.legs1]]) {
      const r = t.get(p);
      if (!r) continue;
      r.legsFor += lf; r.legsMot += lm;
      if (rad) { r.poangX += Number(rad.poang); r.pilar += Number(rad.pilar); r.marks += Number(rad.marks); r.rundor += Number(rad.rundor); }
      if (m.klar && !m.walkover) { r.matcher++; if (m.vinnare === p) r.vunna++; else r.forlorade++; }
    }
  }
  return [...t.values()].map((r) => ({ ...r, poang: 2 * r.vunna, diff: r.legsFor - r.legsMot,
    snitt: r.pilar ? (3 * r.poangX) / r.pilar : null, mpr: r.rundor ? r.marks / r.rundor : null }))
    .sort((a, b) => b.poang - a.poang || b.diff - a.diff || (b.snitt ?? b.mpr ?? 0) - (a.snitt ?? a.mpr ?? 0));
}
