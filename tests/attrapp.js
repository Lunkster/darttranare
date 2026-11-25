// Attrapp för Supabase (PostgREST + auth) i minnet – testerna rör aldrig riktiga databasen.
// Ersätter window.fetch innan appen laddas. Påhittade spelare. Vyerna räknas med samma regler som i SQL.
import { ovningSumma, traff, mult, nummer, catchSumma } from '../spel.js?v=0.10.1';

export const KOD = 'kod123';
export const EPOST = 'anna@exempel.se';
const KONTON = { 'anna@exempel.se': { kod: KOD, sub: 'u-anna', admin: true }, 'bo@exempel.se': { kod: 'bo456', sub: 'u-bo' } };
export const db = {
  spelare: [{ id: 1, namn: 'Anna', aktiv: true, ordning: 1, anvandare: 'u-anna', mdt_namn: null }, { id: 2, namn: 'Bo', aktiv: true, ordning: 2, anvandare: 'u-bo', mdt_namn: null }],
  // Ett spel som Bo spelat själv – Anna ser det men får inte ta bort det
  spel: [{ id: 'bo-spel-1', typ: 'scoring', installningar: { mal: '20', pilar: 3 }, start: '2026-11-01T18:00:00Z', slut: '2026-11-01T18:05:00Z', match_id: null, kalla: 'app', skapad_av: 'u-bo',
    spelare: [{ spelare_id: 2, ordning: 1, vinnare: false }], rundor: [], pilar: [{ spelare_id: 2, runda: 1, nr: 1, mal: '20', segment: 'T20' }, { spelare_id: 2, runda: 1, nr: 2, mal: '20', segment: 'M' }, { spelare_id: 2, runda: 1, nr: 3, mal: '20', segment: 'S20' }] }],
  turnering: [], turnering_deltagare: [], turnering_match: [], live_match: [],
  nextId: 3, offline: false, logg: [], inloggad: null,
};
// Klubbappen (bdc-statistik) – eget projekt, påhittade spelare och tävlingar
export const klubb = {
  spelare: [{ id: 7, namn: 'Anna Andersson', aktiv: true }, { id: 8, namn: 'Bo Berg', aktiv: true }],
  turnering: Array.from({ length: 10 }, (_, i) => ({ tdid: `td${i}`, titel: `Bankeryd onsdag ${i + 1}`, datum: `2026-10-${String(i + 10).padStart(2, '0')}`, serie: 'onsdag', omgang: i + 1 })),
  v_turnering_statistik: Array.from({ length: 10 }, (_, i) => ({ tdid: `td${i}`, spelare_id: 7, placering: i === 3 ? 1 : 4, matcher: 4, vunna_matcher: 2, legs: 10, vunna_legs: 5,
    poang: 1500 + 10 * i, pilar: 90, snitt: Math.round((3 * (1500 + 10 * i) / 90) * 100) / 100, t180: i % 2, high_out: 80 + i })),
  v_ds_spelare: [{ tdid: 'ds1', spelare_id: 7, division: 'Division 2', lag: 'Bankeryd B', singlar: 6, singlar_vunna: 4, dubblar: 2, dubblar_vunna: 1, poang: 900, pilar: 60, snitt: 45 }],
  anrop: [],
};
// Samma regel som dart.far_andra: nytt spel, eget spel eller spel där man själv är med
const farAndra = (sid) => {
  const s = db.spel.find((x) => x.id === sid);
  if (!s) return true;
  const mig = db.spelare.find((p) => p.anvandare === db.inloggad)?.id;
  return s.skapad_av === db.inloggad || s.spelare.some((x) => x.spelare_id === mig);
};

// Samma regel som dart.ser_spel: spel man skapat eller är med i
const arAdminA = () => Object.values(KONTON).find((x) => x.sub === db.inloggad)?.admin === true;
const syns = (s) => arAdminA() || s.skapad_av === db.inloggad || s.spelare.some((x) => db.spelare.find((p) => p.id === x.spelare_id)?.anvandare === db.inloggad);
const jagId = () => db.spelare.find((p) => p.anvandare === db.inloggad)?.id;
const iTurnering = (tid) => db.turnering_deltagare.some((d) => d.turnering_id === tid && d.spelare_id === jagId());
const synligaTurneringar = () => db.turnering.filter((t) => iTurnering(t.id));
const synliga = () => db.spel.filter((s) => syns(s) || (s.turnering_match && iTurnering(db.turnering_match.find((m) => m.id === s.turnering_match)?.turnering_id)));
const v = {
  spelnamn: (id) => db.spelare.find((s) => s.id === id)?.namn,
  x01() {
    return synliga().filter((s) => s.typ === 'x01').flatMap((s) => s.spelare.map((sp) => {
      const r = s.rundor.filter((x) => x.spelare_id === sp.spelare_id), p = r.reduce((a, x) => a + x.poang, 0), n = r.reduce((a, x) => a + (x.pilar ?? 3), 0);
      const f9 = r.filter((x) => x.nr <= 3);
      return {
        spel_id: s.id, spelare_id: sp.spelare_id, namn: v.spelnamn(sp.spelare_id), start: s.start, slut: s.slut, match_id: s.match_id, kalla: s.kalla ?? 'app',
        startpoang: s.installningar.start, vinnare: sp.vinnare, mot: sp.resultat?.mot ?? null, poang: p, pilar: n,
        snitt: n ? Math.round((p * 300) / n) / 100 : null, snitt_forsta9: f9.length ? Math.round((f9.reduce((a, x) => a + x.poang, 0) * 300) / f9.reduce((a, x) => a + x.pilar, 0)) / 100 : null,
        pilar_dubbel: r.reduce((a, x) => a + (x.pilar_dubbel ?? 0), 0), checkouts: r.filter((x) => x.checkout).length,
        utgang: r.find((x) => x.checkout)?.poang ?? null, plus100: r.filter((x) => x.poang >= 100).length, plus140: r.filter((x) => x.poang >= 140).length,
        maxar: r.filter((x) => x.poang === 180).length, kvar: s.installningar.start - p,
      };
    }));
  },
  resultat() {
    return synliga().filter((s) => s.typ !== 'x01').flatMap((s) => s.spelare.map((sp) => {
      if (s.typ === 'catch40') {
        const cs = catchSumma(s.rundor.filter((x) => x.spelare_id === sp.spelare_id));
        return { spel_id: s.id, spelare_id: sp.spelare_id, namn: v.spelnamn(sp.spelare_id), typ: s.typ, start: s.start, slut: s.slut, match_id: s.match_id, kalla: s.kalla ?? 'app',
          installningar: s.installningar, vinnare: sp.vinnare, pilar: cs.pilar, singlar: 0, dubblar: 0, tripplar: 0, traffar: cs.utgangar, marks: 0, rundor: cs.rundor, poang: cs.poang, mpr: null };
      }
      const pil = s.pilar.filter((x) => x.spelare_id === sp.spelare_id), sm = ovningSumma(s.typ, pil);
      const rundor = new Set(pil.map((x) => x.runda)).size + (sp.resultat?.rundor ?? 0);
      const cm = pil.filter((x) => [15, 16, 17, 18, 19, 20, 25].includes(nummer(x.segment))).reduce((a, x) => a + mult(x.segment), 0) + (sp.resultat?.marks ?? 0);
      return {
        spel_id: s.id, spelare_id: sp.spelare_id, namn: v.spelnamn(sp.spelare_id), typ: s.typ, start: s.start, slut: s.slut, match_id: s.match_id, kalla: s.kalla ?? 'app',
        installningar: s.installningar, vinnare: sp.vinnare, pilar: sm.pilar, singlar: sm.singlar, dubblar: sm.dubblar, tripplar: sm.tripplar, traffar: s.typ === 'cricket' ? 0 : sm.traffar, marks: s.typ === 'cricket' ? 0 : sm.marks, rundor,
        poang: ['bobs27', 'jdc', 'scoring'].includes(s.typ) ? sm.poang : null, mpr: s.typ === 'cricket' ? Math.round((cm * 100) / rundor) / 100 : null,
      };
    }));
  },
  turneringLeg() {
    const ut = new Map();
    synliga().filter((s) => s.turnering_match && s.slut).forEach((s) => s.spelare.forEach((sp) => {
      const k = `${s.turnering_match}|${sp.spelare_id}`;
      if (!ut.has(k)) ut.set(k, { turnering_match: s.turnering_match, turnering_id: db.turnering_match.find((m) => m.id === s.turnering_match)?.turnering_id, spelare_id: sp.spelare_id, legs: 0, vunna: 0, poang: 0, pilar: 0, marks: 0, rundor: 0 });
      const r = ut.get(k); r.legs++; if (sp.vinnare) r.vunna++;
      s.rundor.filter((x) => x.spelare_id === sp.spelare_id).forEach((x) => { r.poang += x.poang; r.pilar += x.pilar ?? 3; });
    }));
    return [...ut.values()];
  },
  turneringLegvinst() {
    return synliga().filter((s) => s.turnering_match && s.slut).flatMap((s) => s.spelare.filter((sp) => sp.vinnare)
      .map((sp) => ({ turnering_match: s.turnering_match, spel_id: s.id, start: s.start, vinnare: sp.spelare_id })));
  },
  mal() {
    const m = new Map();
    synliga().forEach((s) => s.pilar.filter((p) => p.mal).forEach((p) => {
      const k = `${p.spelare_id}|${p.mal}|${s.typ}`;
      if (!m.has(k)) m.set(k, { spelare_id: p.spelare_id, namn: v.spelnamn(p.spelare_id), mal: p.mal, typ: s.typ, pilar: 0, traffar: 0 });
      m.get(k).pilar++; if (traff(p.mal, p.segment)) m.get(k).traffar++;
    }));
    return [...m.values()];
  },
};

function filtrera(rows, q) {
  let ut = rows;
  for (const [k, val] of q) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (val.startsWith('eq.')) ut = ut.filter((r) => String(r[k]) === val.slice(3));
  }
  const order = q.get('order');
  if (order) {
    const delar = order.split(',').map((o) => { const [f, dir] = o.split('.'); return [f, dir === 'desc' ? -1 : 1]; });
    ut = [...ut].sort((a, b) => { for (const [f, d] of delar) { if (a[f] < b[f]) return -d; if (a[f] > b[f]) return d; } return 0; });
  }
  if (q.get('limit')) ut = ut.slice(0, Number(q.get('limit')));
  return ut;
}

const svar = (b, status = 200) => new Response(b === null ? null : JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const riktig = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = new URL(url, location.href);
  if (!u.hostname.includes('supabase')) return riktig(url, init);
  if (db.offline) throw new TypeError('Failed to fetch');
  if (u.hostname.startsWith('xkfj')) {   // klubbappen
    klubb.anrop.push(u.pathname + u.search);
    if (!(init.headers?.Authorization ?? '').includes('klubbtoken')) return svar({ message: 'JWT' }, 401);
    const t = u.pathname.replace('/rest/v1/', '');
    return klubb[t] ? svar(filtrera(klubb[t], u.searchParams)) : svar({ message: `okänd ${t}` }, 404);
  }
  const h = init.headers ?? {}, m = init.method ?? 'GET', body = init.body ? JSON.parse(init.body) : null;
  if (u.pathname.includes('/auth/')) {
    const k = body.refresh_token ? { sub: db.inloggad ?? 'u-anna' } : KONTON[body.email];
    if (!k || (!body.refresh_token && k.kod !== body.password)) return svar({ error: 'bad' }, 400);
    db.inloggad = k.sub;
    const admin = Object.values(KONTON).find((x) => x.sub === k.sub)?.admin === true;
    return svar({ access_token: `x.${btoa(JSON.stringify({ sub: k.sub, app_metadata: { roll: 'dart', dart_admin: admin } }))}.y`, refresh_token: 'rt', expires_at: Date.now() / 1000 + 3600 });
  }
  if (h['Accept-Profile'] !== 'dart') return svar({ message: 'fel schema' }, 406);
  const t = u.pathname.replace('/rest/v1/', ''), q = u.searchParams;
  if (m === 'GET') {
    const kalla = { v_x01: v.x01, v_resultat: v.resultat, v_mal: v.mal, v_turnering_leg: v.turneringLeg, v_turnering_legvinst: v.turneringLegvinst,
      spel: () => synliga().map(({ spelare, rundor, pilar, ...x }) => ({ turnering_match: null, ...x })),
      runda: () => synliga().flatMap((x) => x.rundor.map((r) => ({ spel_id: x.id, pilar: 3, pilar_dubbel: 0, checkout: false, ...r }))),
      pil: () => synliga().flatMap((x) => x.pilar.map((p) => ({ spel_id: x.id, ...p }))),
      turnering: synligaTurneringar, turnering_deltagare: () => db.turnering_deltagare.filter((d) => iTurnering(d.turnering_id)),
      turnering_match: () => db.turnering_match.filter((m) => iTurnering(m.turnering_id)),
      live_match: () => structuredClone(db.live_match.filter((l) => iTurnering(db.turnering_match.find((m) => m.id === l.turnering_match)?.turnering_id))) }[t]?.() ?? db[t];
    return kalla ? svar(filtrera(kalla, q)) : svar({ message: `okänd ${t}` }, 404);
  }
  db.logg.push(`${m} ${t}`);
  if (h['Content-Profile'] !== 'dart') return svar({ message: 'fel schema' }, 406);
  if (t === 'spelare' && m === 'POST') {
    if (db.spelare.some((s) => s.namn.toLowerCase() === body.namn.toLowerCase())) return svar({ code: '23505', message: 'duplicate key' }, 409);
    if (body.anvandare && body.anvandare !== db.inloggad) return svar({ message: 'row-level security' }, 403);
    const s = { id: db.nextId++, aktiv: true, anvandare: null, ...body }; db.spelare.push(s); return svar([s], 201);
  }
  if (t === 'spelare' && m === 'PATCH') {
    const id = Number(q.get('id').slice(3)), rad = db.spelare.find((x) => x.id === id);
    if (Object.keys(body).some((k) => !['namn', 'aktiv', 'bdc_id'].includes(k))) return svar({ code: '42501', message: 'permission denied' }, 403);
    if (!rad || (rad.anvandare && rad.anvandare !== db.inloggad)) return svar(null, 204);   // RLS: inga rader ändras
    if (body.namn && db.spelare.some((x) => x.id !== id && x.namn.toLowerCase() === body.namn.toLowerCase())) return svar({ code: '23505', message: 'duplicate key' }, 409);
    Object.assign(rad, body); return svar(null, 204);
  }
  if (t === 'rpc/spara_spel') {
    const p = structuredClone(body.p);
    if (!farAndra(p.id)) return svar({ message: 'Ingen behörighet att ändra spelet' }, 400);
    p.skapad_av = db.spel.find((s) => s.id === p.id)?.skapad_av ?? db.inloggad;
    db.spel = db.spel.filter((s) => s.id !== p.id); db.spel.push(p); return svar(null, 200);
  }
  if (t === 'rpc/skapa_turnering') {
    const p = body.p, tid = `t-${db.turnering.length + 1}`;
    const egenLopande = p.format === 'lopande' && p.deltagare.length === 2 && p.deltagare.some((d) => d.spelare_id === jagId());
    if (!Object.values(KONTON).find((x) => x.sub === db.inloggad)?.admin && !egenLopande) return svar({ message: 'Bara admin kan skapa turneringar' }, 400);
    db.turnering.push({ id: tid, namn: p.namn, format: p.format, typ: p.typ, installningar: p.installningar, skapad: new Date().toISOString(), skapad_av: db.inloggad, avslutad: null });
    p.deltagare.forEach((d) => db.turnering_deltagare.push({ turnering_id: tid, ...d }));
    p.matcher.forEach((m) => db.turnering_match.push({ turnering_id: tid, spelare1: null, spelare2: null, fran1: null, fran2: null, ...m }));
    return svar(tid, 200);
  }
  if (t === 'rpc/ta_bort_turnering') {
    db.turnering = db.turnering.filter((x) => x.id !== body.tid);
    db.turnering_match = db.turnering_match.filter((x) => x.turnering_id !== body.tid);
    db.turnering_deltagare = db.turnering_deltagare.filter((x) => x.turnering_id !== body.tid);
    return svar(null, 204);
  }
  // Samma regler som dart.live_skicka / live_avsluta: ver 0 startar, annars måste versionen stämma
  if (t === 'rpc/live_skicka') {
    const m = db.turnering_match.find((x) => x.id === body.tm);
    if (!m || !iTurnering(m.turnering_id) || !body.lage.spelare.includes(jagId())) return svar({ message: 'Ingen behörighet' }, 400);
    const rad = db.live_match.find((l) => l.turnering_match === body.tm);
    if (body.ver === 0) {
      if (rad) return svar(null, 200);
      db.live_match.push({ turnering_match: body.tm, tillstand: structuredClone(body.lage), version: 1, andrad_av: db.inloggad });
      return svar(1, 200);
    }
    if (!rad || rad.version !== body.ver) return svar(null, 200);
    Object.assign(rad, { tillstand: structuredClone(body.lage), version: rad.version + 1, andrad_av: db.inloggad });
    return svar(rad.version, 200);
  }
  if (t === 'rpc/live_avsluta') { db.live_match = db.live_match.filter((l) => l.turnering_match !== body.tm); return svar(null, 204); }
  if (t === 'rpc/ta_bort_spel') {
    if (!farAndra(body.sid)) return svar({ message: 'Ingen behörighet att ta bort spelet' }, 400);
    db.spel = db.spel.filter((s) => s.id !== body.sid); return svar(null, 204);
  }
  return svar({ message: 'ej hanterat' }, 400);
};
window.attrapp = db;
