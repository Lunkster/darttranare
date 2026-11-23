// Sidor för en match och ett leg – nås genom att klicka på resultat, rader och rubriker.
// Allt räknas ur vyerna (v_x01, v_resultat) och rundorna/pilarna – inget lagras.
import { api, rpc, esc, fmt, proc, tid, datum, spelarLank, legLank, matchLank, turneringLank } from './lib.js?v=0.9.2';
import { TYPER, setLage, ovningSumma, sdtText } from './spel.js?v=0.9.2';

const hamtaRader = (filter) => Promise.all([
  api(`v_x01?${filter}&select=spel_id,spelare_id,namn,start,match_id,startpoang,vinnare,mot,poang,pilar,snitt,snitt_forsta9,pilar_dubbel,checkouts,utgang,plus100,plus140,maxar`),
  api(`v_resultat?${filter}&select=spel_id,spelare_id,namn,typ,start,match_id,installningar,vinnare,pilar,traffar,marks,rundor,poang,mpr`),
]).then(([x, o]) => [...x.map((r) => ({ ...r, typ: 'x01' })), ...o]);

// Turneringen som ett spel hör till (namn och id), om någon
async function turneringFor(tm) {
  if (!tm) return null;
  const [m] = await api(`turnering_match?id=eq.${tm}&select=id,turnering_id,runda`);
  if (!m) return null;
  const [t] = await api(`turnering?id=eq.${m.turnering_id}&select=id,namn,format`);
  return t ? { ...t, runda: m.runda } : null;
}

const typNamn = (typ, inst) => (typ === 'x01' ? `X01 ${inst?.start ?? ''}` : typ === 'scoring' ? `${TYPER.scoring.namn} ${inst?.mal === '25' ? 'bull' : esc(inst?.mal ?? '')}` : esc(TYPER[typ]?.namn ?? typ));
const resultatText = (r) => (r.typ === 'x01' ? `snitt ${fmt(r.snitt, 1)}` : r.typ === 'cricket' ? `MPR ${fmt(r.mpr, 2)}` : r.typ === 'dubbelrunda' ? `${r.traffar} träff` : `${r.poang} p`);
const ingenAtkomst = (vad) => `<div class="card"><h1>${vad} finns inte</h1><p class="muted">Eller så var du inte med i den.</p><a class="btn" href="#/historik">Historik</a></div>`;

// ------------------------------------------------------------ match
export async function renderMatch(el, alla, mid) {
  const [spel, rader] = await Promise.all([
    api(`spel?match_id=eq.${mid}&slut=not.is.null&select=id,typ,start,installningar,turnering_match&order=start`),
    hamtaRader(`match_id=eq.${mid}`),
  ]);
  if (!spel.length) { el.innerHTML = ingenAtkomst('Matchen'); return; }
  const t = await turneringFor(spel[0].turnering_match);
  const typ = spel[0].typ, inst = spel[0].installningar ?? {};
  const spelare = [...new Set(rader.map((r) => r.spelare_id))];
  const namn = (id) => rader.find((r) => r.spelare_id === id)?.namn ?? alla.find((s) => s.id === id)?.namn ?? '?';
  const vinnareLeg = spel.map((s) => rader.find((r) => r.spel_id === s.id && r.vinnare)?.spelare_id ?? null);
  const legs = (id) => vinnareLeg.filter((v) => v === id).length;
  const set = (inst.set ?? 1) > 1 && spelare.length === 2 ? setLage(vinnareLeg.filter((v) => v !== null), spelare, inst.forst_till ?? 1, inst.set) : null;
  const tal = (id) => {
    const m = rader.filter((r) => r.spelare_id === id);
    if (typ === 'x01') { const p = m.reduce((a, r) => a + Number(r.poang), 0), n = m.reduce((a, r) => a + Number(r.pilar), 0); return `snitt ${fmt(n ? (3 * p) / n : null, 1)}`; }
    if (typ === 'cricket') { const mk = m.reduce((a, r) => a + Number(r.mpr ?? 0) * Number(r.rundor), 0), n = m.reduce((a, r) => a + Number(r.rundor), 0); return `MPR ${fmt(n ? mk / n : null, 2)}`; }
    return '';
  };
  const [a, b] = spelare, mest = Math.max(...spelare.map(legs));
  el.innerHTML = `<div class="card">
    <p class="tillbaka">${t ? `← ${turneringLank(t.id, t.namn)}` : '← <a class="lank" href="#/historik">Historik</a>'}</p>
    <h1>Match</h1>
    <p class="muted">${typNamn(typ, inst)} · ${datum(spel[0].start)}${t ? ` · ${turneringLank(t.id, t.namn)}${t.format === 'lopande' ? ` match ${t.runda}` : ''}` : ''}</p>
    ${spelare.length === 2 ? `<div class="lopstallning matchhuvud"><span class="${legs(a) === mest && legs(a) > legs(b) ? 'vann' : ''}">${spelarLank(a, namn(a))}</span>
      <b>${set ? `${set.set[a]}–${set.set[b]}` : `${legs(a)}–${legs(b)}`}</b><span class="${legs(b) > legs(a) ? 'vann' : ''}">${spelarLank(b, namn(b))}</span></div>
      ${set ? `<p class="forklaring mitt">set · legs ${legs(a)}–${legs(b)}</p>` : ''}` : `<p>${spelare.map((id) => spelarLank(id, namn(id))).join(', ')}</p>`}
    <table class="tabell"><tr><th></th>${spelare.map((id) => `<th>${spelarLank(id, namn(id))}</th>`).join('')}</tr>
      <tr><td>Vunna legs</td>${spelare.map((id) => `<td>${legs(id)}</td>`).join('')}</tr>
      ${typ === 'x01' || typ === 'cricket' ? `<tr><td>${typ === 'x01' ? 'Snitt' : 'MPR'}</td>${spelare.map((id) => `<td>${tal(id).split(' ')[1]}</td>`).join('')}</tr>` : ''}</table>
  </div>
  <div class="card"><h2>Legs</h2>
    ${spel.map((s, i) => { const v = vinnareLeg[i];
      return `<a class="legrad" href="#/leg/${s.id}"><span class="nr">${i + 1}</span><span>${v !== null ? `🏆 ${esc(namn(v))}` : '–'}</span>
        <span class="muted">${spelare.map((id) => { const r = rader.find((x) => x.spel_id === s.id && x.spelare_id === id); return r ? `${esc(namn(id))} ${resultatText(r).replace(/^snitt /, '')}` : ''; }).filter(Boolean).join(' · ')}</span></a>`; }).join('')}
  </div>`;
}

// ------------------------------------------------------------ leg
export async function renderLeg(el, alla, sid) {
  const [[spel], rader] = await Promise.all([
    api(`spel?id=eq.${sid}&select=id,typ,start,slut,match_id,installningar,turnering_match,kalla`),
    hamtaRader(`spel_id=eq.${sid}`),
  ]);
  if (!spel) { el.innerHTML = ingenAtkomst('Leget'); return; }
  const typ = spel.typ, inst = spel.installningar ?? {};
  const [t, rundor, pilar, legsIMatch] = await Promise.all([
    turneringFor(spel.turnering_match),
    typ === 'x01' ? api(`runda?spel_id=eq.${sid}&select=spelare_id,nr,poang,pilar,pilar_dubbel,checkout&order=nr`) : [],
    typ === 'x01' ? [] : api(`pil?spel_id=eq.${sid}&select=spelare_id,runda,nr,mal,segment&order=runda,nr`),
    spel.match_id ? api(`spel?match_id=eq.${spel.match_id}&slut=not.is.null&select=id,start&order=start`) : [],
  ]);
  const ordning = rader.map((r) => r.spelare_id);
  const namn = (id) => rader.find((r) => r.spelare_id === id)?.namn ?? alla.find((s) => s.id === id)?.namn ?? '?';
  const legNr = legsIMatch.findIndex((x) => x.id === sid) + 1;
  const iMatch = spel.match_id && legsIMatch.length > 1;
  const vinnare = rader.find((r) => r.vinnare && rader.length > 1);

  let stat = '', protokoll = '';
  if (typ === 'x01') {
    stat = `<table class="tabell"><tr><th></th><th>Snitt</th><th title="Snitt de första nio pilarna">F9</th><th>Pilar</th><th>Dubbel</th><th>Ut</th></tr>
      ${rader.map((r) => `<tr><td>${spelarLank(r.spelare_id, r.namn)}</td><td>${fmt(r.snitt, 1)}</td><td>${fmt(r.snitt_forsta9, 1)}</td>
        <td>${r.pilar}</td><td>${r.pilar_dubbel ? proc(r.checkouts, r.pilar_dubbel) : '–'}</td><td>${r.utgang ?? '–'}</td></tr>`).join('')}</table>`;
    const antal = Math.max(0, ...rundor.map((r) => r.nr));
    const kvar = Object.fromEntries(ordning.map((id) => [id, inst.start ?? 501]));
    const rad = [];
    for (let n = 1; n <= antal; n++) {
      rad.push(`<tr><td class="nr">${n}</td>${ordning.map((id) => { const r = rundor.find((x) => x.spelare_id === id && x.nr === n);
        if (!r) return '<td></td><td></td>';
        kvar[id] -= r.poang;
        return `<td class="${r.poang >= 100 ? 'hog' : ''}${r.checkout ? ' ut' : ''}">${r.poang}</td><td class="muted">${kvar[id]}</td>`; }).join('')}</tr>`);
    }
    protokoll = antal ? `<h2>Besök</h2><div class="tabellruta"><table class="tabell protokoll"><tr><th></th>${ordning.map((id) => `<th colspan="2">${esc(namn(id))}</th>`).join('')}</tr>${rad.join('')}</table></div>` : '';
  } else {
    stat = `<table class="tabell"><tr><th></th><th>Resultat</th><th>Pilar</th></tr>
      ${rader.map((r) => `<tr><td>${spelarLank(r.spelare_id, r.namn)}</td><td>${resultatText(r)}</td><td>${r.pilar}</td></tr>`).join('')}</table>
      ${typ === 'scoring' ? rader.map((r) => `<p class="sdt">${rader.length > 1 ? `${esc(r.namn)}: ` : ''}${sdtText(ovningSumma(typ, pilar.filter((p) => p.spelare_id === r.spelare_id)), inst.mal)}</p>`).join('') : ''}`;
    const antal = Math.max(0, ...pilar.map((p) => p.runda));
    const rad = [];
    for (let n = 1; n <= antal; n++) {
      rad.push(`<tr><td class="nr">${n}</td>${ordning.map((id) => { const p = pilar.filter((x) => x.spelare_id === id && x.runda === n);
        return `<td>${p.length ? `${p[0].mal ? `<span class="muted">${esc(p[0].mal)}:</span> ` : ''}${p.map((x) => (x.segment === 'M' ? '–' : esc(x.segment))).join(' ')}` : ''}</td>`; }).join('')}</tr>`);
    }
    protokoll = antal ? `<h2>Rundor</h2><div class="tabellruta"><table class="tabell protokoll"><tr><th></th>${ordning.map((id) => `<th>${esc(namn(id))}</th>`).join('')}</tr>${rad.join('')}</table></div>` : '';
  }

  el.innerHTML = `<div class="card">
    <p class="tillbaka">← ${iMatch ? matchLank(spel.match_id, 'Matchen') : t ? turneringLank(t.id, t.namn) : '<a class="lank" href="#/historik">Historik</a>'}</p>
    <h1>${typNamn(typ, inst)}${iMatch ? ` · leg ${legNr}` : ''}</h1>
    <p class="muted">${tid(spel.start)}${t ? ` · ${turneringLank(t.id, t.namn)}` : ''}${iMatch ? ` · ${matchLank(spel.match_id, `match, ${legsIMatch.length} legs`)}` : ''}${spel.kalla === 'mdt' ? ' · <span class="etikett">MDT</span>' : ''}</p>
    ${vinnare ? `<p class="vinnarrad">🏆 ${spelarLank(vinnare.spelare_id, vinnare.namn)}</p>` : ''}
    ${stat}
    ${iMatch ? `<p class="rad legnav">${legNr > 1 ? legLank(legsIMatch[legNr - 2].id, '← Leg ' + (legNr - 1)) : '<span></span>'}${legNr < legsIMatch.length ? legLank(legsIMatch[legNr].id, 'Leg ' + (legNr + 1) + ' →') : ''}</p>` : ''}
  </div>
  ${protokoll ? `<div class="card">${protokoll}</div>` : ''}
  <div class="card"><button class="btn liten fara" id="tabort" type="button">Ta bort spelet</button> <span class="forklaring">För alla spelare.</span></div>`;
  el.querySelector('#tabort').onclick = async () => {
    if (!confirm('Ta bort spelet för alla spelare? Det går inte att ångra.')) return;
    try { await rpc('ta_bort_spel', { sid }); location.hash = '#/historik'; } catch (e) { alert(`Kunde inte ta bort: ${e.message}`); }
  };
}
