#!/usr/bin/env python3
"""Import från My Dart Training (.mdt = SQLite-backup, user version 48) till schemat dart.

Varje spel får ett fast uuid (uuid5 av tabell + id i backupen), så att samma backup kan importeras
flera gånger – spara_spel skriver över i stället för att dubblera. Nya backuper kan alltså importeras
tills bytet till Darttränaren är klart.

Vad som importeras:
  - X01 solo och mot CPU (xGame + aufnahme), X01 flera spelare (xGameMp ... aufnahmeMp)
  - Cricket (bara summor: marks och rundor per spelare)
  - JDC Challenge, Bob's 27, 100 pilar (scoring)
  JDC, Bob's 27 och scoring sparar bara antal träffar per mål i backupen. Pilarna återskapas här,
  så ordningen mellan pilarna inom ett mål är påhittad (summor och träffprocent stämmer).
Hoppas över: poängträning (xGame med startScore 0), Halve-it, cricket scoring.

Användning:
  python3 import/mdt.py BACKUP.mdt --visa                      # sammanfattning, skriver inget
  DART_KOD=... python3 import/mdt.py BACKUP.mdt                # skickar till Supabase via spara_spel
  python3 import/mdt.py BACKUP.mdt --sql UT.sql --spelare ID.json   # SQL-fil; ID.json = {mdt_namn: spelare.id}
"""
import argparse, json, os, sqlite3, sys, urllib.request, uuid
from datetime import datetime
from zoneinfo import ZoneInfo

NS = uuid.UUID('6f1d7c1e-3b0a-4d2e-9a51-6d6172740001')   # fast namnrymd för importens uuid
TZ = ZoneInfo('Europe/Stockholm')
URL = 'https://nlvgisjssbjethumvgdz.supabase.co'
KEY = 'sb_publishable_3wzcVvDgcoupfWSqAis4eg_bz2e6jiG'
KONTO = os.environ.get('DART_EPOST', 'h.lundqvist+dart@gmail.com')   # Henriks konto – importen kopplas till honom
PROFIL = 'Henrik'   # Profile 1 i backupen = den som spelar soloövningarna
NOT = 'Import från My Dart Training'
NOT_REKO = NOT + ' – pilarnas ordning inom varje mål är återskapad'


def sid(*delar):
    return str(uuid.uuid5(NS, ':'.join(map(str, delar))))


def tid(txt):
    """created_at i backupen är lokal tid 'ÅÅÅÅ-MM-DD TT:MM:SS' (NUMERIC-affinitet, därför str())."""
    return datetime.strptime(str(txt)[:19], '%Y-%m-%d %H:%M:%S').replace(tzinfo=TZ).isoformat()


def mal_kod(t):
    """'D8' → 'D8', 'BULL' → 'D25' (dubbel-bull i dubbelövningar)."""
    t = str(t).upper()
    return 'D25' if t in ('BULL', 'DBULL', 'D25') else t


def sprid(traffar, antal):
    """Lägg träffarna jämnt utspridda bland antal pilar; resten är miss (None)."""
    ut = [None] * antal
    if not traffar: return ut
    steg = antal / len(traffar)
    for i, t in enumerate(traffar): ut[min(antal - 1, int(i * steg))] = t
    # krockar kan inte uppstå eftersom steg >= 1
    return ut


def spel(typ, start, spelare, installningar=None, rundor=(), pilar=(), match_id=None, anteckning=NOT, mdt=None):
    inst = dict(installningar or {})
    if mdt: inst['mdt'] = mdt
    return {'id': sid(mdt), 'typ': typ, 'installningar': inst, 'start': start, 'slut': start, 'match_id': match_id,
            'kalla': 'mdt', 'anteckning': anteckning, 'spelare': spelare, 'rundor': list(rundor), 'pilar': list(pilar)}


def las(fil):
    db = sqlite3.connect(f'file:{fil}?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    q = lambda s, *a: db.execute(s, a).fetchall()
    namn = {r['id']: r['name'].strip() for r in q('select id, name from Spieler')}
    namn[0] = PROFIL
    ut = []

    # --- X01 solo och mot CPU ---
    cpu = {r['xGameId']: r for r in q('select g.xGameId, g.win, c.cpuLevel from challengeGame g join challenge c on c.id = g.entityId')}
    for g in q('select * from xGame where startScore > 0'):
        rundor = [{'spelare_id': PROFIL, 'nr': a['round'], 'poang': a['score'], 'pilar': a['darts'],
                   'pilar_dubbel': a['dartsOnDouble'], 'checkout': bool(a['checkout'])}
                  for a in q("select * from aufnahme where entityName = 'XGame' and entityId = ? order by round", g['id'])]
        c = cpu.get(g['id'])
        sp = {'spelare_id': PROFIL, 'ordning': 1,
              'vinnare': bool(c['win']) if c else any(r['checkout'] for r in rundor),
              'resultat': {'mot': 'CPU', 'niva': c['cpuLevel']} if c else None}
        ut.append(spel('x01', tid(g['created_at']), [sp], {'start': g['startScore']}, rundor, mdt=f'xGame:{g["id"]}'))

    # --- X01 flera spelare: en leg = ett spel, legs i samma match delar match_id ---
    for m in q('select * from xGameMp'):
        mid = sid(f'xGameMp:{m["id"]}')
        for l in q('select l.*, s.setNummer from xGameMpLeg l join xGameMpSet s on s.id = l.setId where s.xGameMpId = ? order by s.setNummer, l.legNummer', m['id']):
            sp, rundor = [], []
            for x in q('select * from xGameSpieler where legId = ? order by startNrLastLeg, id', l['id']):
                sp.append({'spelare_id': namn[x['spielerId']], 'ordning': len(sp) + 1, 'vinnare': x['spielerId'] == l['siegerId'], 'resultat': None})
                rundor += [{'spelare_id': namn[x['spielerId']], 'nr': a['round'], 'poang': a['score'], 'pilar': a['darts'],
                            'pilar_dubbel': a['dartsOnDouble'], 'checkout': bool(a['checkout'])}
                           for a in q("select * from aufnahmeMp where entityName = 'XGame' and entityId = ? order by round", x['id'])]
            inst = {'start': m['startScore'], 'set': l['setNummer'], 'leg': l['legNummer'], 'bast_av_set': m['bestOfSets'], 'bast_av_legs': m['bestOfLegs']}
            ut.append(spel('x01', tid(l['created_at']), sp, inst, rundor, match_id=mid, mdt=f'xGameMpLeg:{l["id"]}'))

    # --- Cricket: bara summor ---
    for m in q('select * from cricketMp'):
        mid = sid(f'cricketMp:{m["id"]}')
        for l in q('select l.*, s.setNummer from cricketMpLeg l join cricketMpSet s on s.id = l.setId where s.cricketMpId = ? order by s.setNummer, l.legNummer', m['id']):
            sp = [{'spelare_id': namn[x['spielerId']], 'ordning': i + 1, 'vinnare': x['spielerId'] == l['siegerId'],
                   'resultat': {'marks': x['marks'], 'rundor': x['rounds'], 'pilar': x['gesamtDarts'], 'poang': x['punkte']}}
                  for i, x in enumerate(q('select * from cricketGameSpieler where legId = ? order by startNrLastSet, id', l['id']))]
            ut.append(spel('cricket', tid(l['created_at']), sp, {'set': l['setNummer'], 'leg': l['legNummer']},
                           match_id=mid, mdt=f'cricketMpLeg:{l["id"]}'))

    ensam = [{'spelare_id': PROFIL, 'ordning': 1, 'vinnare': False, 'resultat': None}]

    # --- JDC Challenge: 10–15, dubblar 1–20 + bull, 15–20 ---
    for j in q('select * from jdcChallenge'):
        pilar, runda = [], 0
        def mal_runda(t):
            nonlocal runda
            runda += 1
            segs = ['S'] * t['singles'] + ['D'] * t['doubles'] + ['T'] * t['triples'] + ['M'] * t['misses']
            for nr, s in enumerate(segs[:3], 1):
                pilar.append({'spelare_id': PROFIL, 'runda': runda, 'nr': nr, 'mal': str(t['target']), 'segment': 'M' if s == 'M' else f'{s}{t["target"]}'})
        for t in q('select * from jdcScoringTarget where jdcChallengeId = ? and part = 1 order by target', j['id']): mal_runda(t)
        dub = q("select * from dartTarget where entityName = 'JdcChallenge' and entityId = ? order by id", j['id'])
        for i, d in enumerate(dub):
            if i % 3 == 0: runda += 1
            m = mal_kod(d['target'])
            pilar.append({'spelare_id': PROFIL, 'runda': runda, 'nr': i % 3 + 1, 'mal': m, 'segment': m if d['hits'] else 'M'})
        for t in q('select * from jdcScoringTarget where jdcChallengeId = ? and part = 3 order by target', j['id']): mal_runda(t)
        ut.append(spel('jdc', tid(j['created_at']), ensam, {}, pilar=pilar, anteckning=NOT_REKO, mdt=f'jdcChallenge:{j["id"]}'))

    # --- Bob's 27: 3 pilar per dubbel ---
    for b in q('select * from Bob27'):
        pilar = []
        for r, d in enumerate(q("select * from dartTarget where entityName = 'Bob27' and entityId = ? order by id", b['id']), 1):
            m = mal_kod(d['target'])
            for nr in range(1, 4):
                pilar.append({'spelare_id': PROFIL, 'runda': r, 'nr': nr, 'mal': m, 'segment': m if nr <= d['hits'] else 'M'})
        ut.append(spel('bobs27', tid(b['created_at']), ensam, {}, pilar=pilar, anteckning=NOT_REKO, mdt=f'Bob27:{b["id"]}'))

    # --- 100 pilar mot ett mål (scoring): fördela så att marks första/andra 50 stämmer ---
    for s in q('select * from scoring'):
        n, mal = s['throws'], str(s['target'])
        forsta = min(50, n)
        delning = dela(s['singles'], s['doubles'], s['triples'], s['first50'], forsta, n - forsta)
        segs = []
        for (s1, d1, t1), antal in zip(delning, (forsta, n - forsta)):
            blandat = sorted([(i + 0.5) / n_, typ] for typ, n_ in (('S', s1), ('D', d1), ('T', t1)) for i in range(n_))
            segs += sprid([typ for _, typ in blandat], antal)
        pilar = [{'spelare_id': PROFIL, 'runda': i // 3 + 1, 'nr': i % 3 + 1, 'mal': mal,
                  'segment': 'M' if x is None else f'{x}{mal}'} for i, x in enumerate(segs)]
        ut.append(spel('scoring', tid(s['created_at']), ensam, {'mal': mal, 'pilar': n}, pilar=pilar, anteckning=NOT_REKO, mdt=f'scoring:{s["id"]}'))

    ut.sort(key=lambda x: x['start'])
    return ut, sorted({v for v in namn.values()} & {p['spelare_id'] for x in ut for p in x['spelare']})


def dela(s, d, t, marks1, plats1, plats2):
    """Dela singlar/dubblar/trippel i två halvor så att första halvan får marks1 marks och
    fördelningen mellan typerna blir så lik som möjligt i båda halvorna. Annars jämnt."""
    andel = marks1 / max(1, s + 2 * d + 3 * t)
    bast = None
    for t1 in range(t + 1):
        for d1 in range(d + 1):
            s1 = marks1 - 2 * d1 - 3 * t1
            if 0 <= s1 <= s and s1 + d1 + t1 <= plats1 and (s - s1) + (d - d1) + (t - t1) <= plats2:
                avvik = abs(t1 - t * andel) + abs(d1 - d * andel) + abs(s1 - s * andel)
                if bast is None or avvik < bast[0]: bast = (avvik, [(s1, d1, t1), (s - s1, d - d1, t - t1)])
    if bast: return bast[1]
    h = lambda x: x * plats1 // max(1, plats1 + plats2)
    return [(h(s), h(d), h(t)), (s - h(s), d - h(d), t - h(t))]


def med_id(spel_lista, ids):
    saknas = sorted({p['spelare_id'] for x in spel_lista for p in x['spelare']} - ids.keys())
    if saknas: sys.exit(f'Spelare saknas i dart.spelare: {saknas}')
    ut = json.loads(json.dumps(spel_lista))
    for x in ut:
        for k in ('spelare', 'rundor', 'pilar'):
            for r in x[k]: r['spelare_id'] = ids[r['spelare_id']]
    return ut


# ---------- Supabase via REST ----------
def rest(metod, vag, data=None, token=None, profil=True):
    h = {'apikey': KEY, 'Content-Type': 'application/json'}
    if token: h['Authorization'] = f'Bearer {token}'
    if profil: h.update({'Accept-Profile': 'dart', 'Content-Profile': 'dart'})
    req = urllib.request.Request(URL + vag, method=metod, headers=h, data=None if data is None else json.dumps(data).encode())
    with urllib.request.urlopen(req) as r:
        txt = r.read()
        return json.loads(txt) if txt else None


def skicka(spel_lista, namn):
    kod = os.environ.get('DART_KOD') or sys.exit('Sätt DART_KOD (lösenordet till Henriks konto, från lösenordshanteraren).')
    tok = rest('POST', '/auth/v1/token?grant_type=password', {'email': KONTO, 'password': kod}, profil=False)['access_token']
    # Spelarna hittas på namnet i My Dart Training (mdt_namn), så att alias kan bytas fritt i appen
    rader = rest('GET', '/rest/v1/spelare?select=id,namn,mdt_namn', token=tok)
    ids = {r['namn']: r['id'] for r in rader if not r['mdt_namn']} | {r['mdt_namn']: r['id'] for r in rader if r['mdt_namn']}
    nya = [n for n in namn if n not in ids]
    if nya:
        res = rest_prefer('POST', '/rest/v1/spelare', [{'namn': n, 'mdt_namn': n, 'ordning': 10} for n in nya], tok)
        ids.update({r['mdt_namn']: r['id'] for r in res})
    for x in med_id(spel_lista, ids):
        rest('POST', '/rest/v1/rpc/spara_spel', {'p': x}, token=tok)
    print(f'Skickade {len(spel_lista)} spel.')


def rest_prefer(metod, vag, data, tok):
    h = {'apikey': KEY, 'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json',
         'Accept-Profile': 'dart', 'Content-Profile': 'dart', 'Prefer': 'return=representation'}
    req = urllib.request.Request(URL + vag, method=metod, headers=h, data=json.dumps(data).encode())
    with urllib.request.urlopen(req) as r: return json.loads(r.read())


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('mdt')
    a.add_argument('--visa', action='store_true', help='bara sammanfattning')
    a.add_argument('--sql', help='skriv SQL-fil i stället för att skicka')
    a.add_argument('--spelare', help='JSON {namn: id} för --sql')
    a.add_argument('--json', help='skriv spelen som JSON (med namn i stället för id)')
    v = a.parse_args()
    spel_lista, namn = las(v.mdt)
    from collections import Counter
    print('Spel per typ:', dict(Counter(x['typ'] for x in spel_lista)), '· spelare:', ', '.join(namn), file=sys.stderr)
    if v.json:
        with open(v.json, 'w') as f: json.dump(spel_lista, f, ensure_ascii=False, indent=1)
    if v.visa or v.json: return
    if v.sql:
        ids = json.load(open(v.spelare)) if v.spelare else sys.exit('--sql kräver --spelare')
        with open(v.sql, 'w') as f:
            f.write("select set_config('request.jwt.claims', '{\"app_metadata\":{\"roll\":\"dart\"}}', true);\n")
            for x in med_id(spel_lista, ids):
                f.write("select dart.spara_spel($j$" + json.dumps(x, ensure_ascii=False) + "$j$::jsonb);\n")
        print('Skrev', v.sql, file=sys.stderr)
        return
    skicka(spel_lista, namn)


if __name__ == '__main__':
    main()
