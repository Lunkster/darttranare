// Attrapp för Supabase (PostgREST + auth) i minnet – testerna rör aldrig riktiga databasen.
// Ersätter window.fetch innan appen laddas. Påhittade spelare. Vyerna räknas med samma regler som i SQL.
import { ovningSumma, traff, mult, nummer } from '../spel.js?v=0.1.0';

export const db = { spelare: [{ id: 1, namn: 'Anna', aktiv: true, ordning: 1 }, { id: 2, namn: 'Bo', aktiv: true, ordning: 2 }], spel: [], nextId: 3, offline: false, logg: [] };
export const KOD = 'kod123';

const v = {
  spelnamn: (id) => db.spelare.find((s) => s.id === id)?.namn,
  x01() {
    return db.spel.filter((s) => s.typ === 'x01').flatMap((s) => s.spelare.map((sp) => {
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
    return db.spel.filter((s) => s.typ !== 'x01').flatMap((s) => s.spelare.map((sp) => {
      const pil = s.pilar.filter((x) => x.spelare_id === sp.spelare_id), sm = ovningSumma(s.typ, pil);
      const rundor = new Set(pil.map((x) => x.runda)).size + (sp.resultat?.rundor ?? 0);
      const cm = pil.filter((x) => [15, 16, 17, 18, 19, 20, 25].includes(nummer(x.segment))).reduce((a, x) => a + mult(x.segment), 0) + (sp.resultat?.marks ?? 0);
      return {
        spel_id: s.id, spelare_id: sp.spelare_id, namn: v.spelnamn(sp.spelare_id), typ: s.typ, start: s.start, slut: s.slut, match_id: s.match_id, kalla: s.kalla ?? 'app',
        installningar: s.installningar, vinnare: sp.vinnare, pilar: sm.pilar, traffar: s.typ === 'cricket' ? 0 : sm.traffar, marks: s.typ === 'cricket' ? 0 : sm.marks, rundor,
        poang: ['bobs27', 'jdc', 'scoring'].includes(s.typ) ? sm.poang : null, mpr: s.typ === 'cricket' ? Math.round((cm * 100) / rundor) / 100 : null,
      };
    }));
  },
  mal() {
    const m = new Map();
    db.spel.forEach((s) => s.pilar.filter((p) => p.mal).forEach((p) => {
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
  const h = init.headers ?? {}, m = init.method ?? 'GET', body = init.body ? JSON.parse(init.body) : null;
  if (u.pathname.includes('/auth/')) {
    return body.password === KOD || body.refresh_token ? svar({ access_token: 'x.e30.y', refresh_token: 'rt', expires_at: Date.now() / 1000 + 3600 }) : svar({ error: 'bad' }, 400);
  }
  if (h['Accept-Profile'] !== 'dart') return svar({ message: 'fel schema' }, 406);
  const t = u.pathname.replace('/rest/v1/', ''), q = u.searchParams;
  if (m === 'GET') {
    const kalla = { v_x01: v.x01, v_resultat: v.resultat, v_mal: v.mal }[t]?.() ?? db[t];
    return kalla ? svar(filtrera(kalla, q)) : svar({ message: `okänd ${t}` }, 404);
  }
  db.logg.push(`${m} ${t}`);
  if (h['Content-Profile'] !== 'dart') return svar({ message: 'fel schema' }, 406);
  if (t === 'spelare' && m === 'POST') {
    if (db.spelare.some((s) => s.namn === body.namn)) return svar({ code: '23505', message: 'duplicate key' }, 409);
    const s = { id: db.nextId++, aktiv: true, ...body }; db.spelare.push(s); return svar([s], 201);
  }
  if (t === 'rpc/spara_spel') {
    const p = structuredClone(body.p);
    db.spel = db.spel.filter((s) => s.id !== p.id); db.spel.push(p); return svar(null, 200);
  }
  if (t === 'rpc/ta_bort_spel') { db.spel = db.spel.filter((s) => s.id !== body.sid); return svar(null, 204); }
  return svar({ message: 'ej hanterat' }, 400);
};
window.attrapp = db;
