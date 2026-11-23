// Historik: spel man själv var med i (RLS), nyast först, med möjlighet att ta bort. Spel i offlinekön visas överst.
import { api, rpc, esc, fmt, proc, tid, ko, skickaKo } from './lib.js?v=0.8.0';
import { TYPER } from './spel.js?v=0.8.0';

export async function renderHistorik(el, alla) {
  const [x01, ovr] = await Promise.all([
    api('v_x01?select=spel_id,spelare_id,namn,start,kalla,startpoang,vinnare,mot,snitt,pilar,checkouts,pilar_dubbel&order=start.desc&limit=600'),
    api('v_resultat?select=spel_id,spelare_id,namn,typ,start,kalla,installningar,vinnare,pilar,traffar,poang,mpr&order=start.desc&limit=600'),
  ]);
  const spel = new Map();
  for (const r of [...x01.map((x) => ({ ...x, typ: 'x01' })), ...ovr]) {
    if (!spel.has(r.spel_id)) spel.set(r.spel_id, { id: r.spel_id, typ: r.typ, start: r.start, kalla: r.kalla, rader: [], r });
    spel.get(r.spel_id).rader.push(r);
  }
  const lista = [...spel.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
  const kon = ko();
  const namn = (id) => alla.find((s) => s.id === id)?.namn ?? '?';

  const resultat = (s, r) => {
    if (s.typ === 'x01') return `snitt ${fmt(r.snitt, 1)}${r.pilar_dubbel ? ` · ut ${proc(r.checkouts, r.pilar_dubbel)}` : ''}`;
    if (s.typ === 'cricket') return `MPR ${fmt(r.mpr, 2)}`;
    if (s.typ === 'dubbelrunda') return `${r.traffar} träff · ${proc(r.traffar, r.pilar)}`;
    return `${r.poang} p · ${proc(r.traffar, r.pilar)}`;
  };
  const rubrik = (s) => {
    const r = s.r;
    if (s.typ === 'x01') return `${r.startpoang}${r.mot ? ` mot ${esc(r.mot)}` : ''}`;
    if (s.typ === 'scoring') return `${TYPER.scoring.namn} ${r.installningar?.mal === '25' ? 'bull' : esc(r.installningar?.mal ?? '')}`;
    return esc(TYPER[s.typ]?.namn ?? s.typ);
  };

  el.innerHTML = `<div class="card"><h1>Historik</h1>
    <p class="forklaring">Spel du själv var med i.</p>
    ${kon.length ? `<div class="kolista"><h3>Väntar på att skickas (${kon.length})</h3>
      ${kon.map((s) => `<div class="hrad"><span class="tid">${tid(s.start)}</span> ${esc(TYPER[s.typ].namn)} – ${esc(s.spelare.map((x) => namn(x.spelare_id)).join(', '))}</div>`).join('')}
      <button class="btn liten" id="skicka" type="button">Skicka nu</button> <span id="skickamsg" class="msg"></span></div>` : ''}
    ${lista.length ? '' : '<p class="muted">Inga spel än.</p>'}
    ${lista.map((s) => `<details class="hrad">
      <summary><span class="tid">${tid(s.start)}</span> <b>${s.typ === 'x01' ? 'X01 ' : ''}${rubrik(s)}</b>${s.kalla === 'mdt' ? ' <span class="etikett">MDT</span>' : ''}
        <span class="hres">${s.rader.sort((a, b) => b.vinnare - a.vinnare).map((r) => `${r.vinnare && s.rader.length > 1 ? '🏆 ' : ''}${esc(r.namn)} ${resultat(s, r)}`).join(' · ')}</span></summary>
      <p><button class="btn liten fara" data-tabort="${s.id}" type="button">Ta bort spelet</button></p></details>`).join('')}
  </div>`;

  el.querySelector('#skicka')?.addEventListener('click', async () => {
    const m = el.querySelector('#skickamsg'); m.textContent = 'Skickar …';
    const r = await skickaKo();
    if (r.fel) m.textContent = `Kunde inte skicka: ${r.fel.message}`; else renderHistorik(el, alla);
  });
  el.querySelectorAll('[data-tabort]').forEach((b) => b.onclick = async () => {
    if (!confirm('Ta bort spelet för alla spelare? Det går inte att ångra.')) return;
    try { await rpc('ta_bort_spel', { sid: b.dataset.tabort }); renderHistorik(el, alla); } catch (e) { alert(`Kunde inte ta bort: ${e.message}`); }
  });
}
