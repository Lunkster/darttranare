// Nytt i appen: punktlistan per dag från Obsidian-anteckningen "Darttränaren - Nyheter"
// (görs om till nyheter.json med ~/Dokument/Claude/Darttranare/skript/nyheter.py när anteckningen ändras).
import { esc, minns } from './lib.js?v=0.8.0';

// **fet** → <strong>, *kursiv* → <em>, versionen i slutet dämpas
const formatera = (t) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\s*\((v\d+\.\d+\.\d+(?:,\s*v\d+\.\d+\.\d+)*)\)\s*$/, ' <span class="ny-ver">($1)</span>');

async function hamta() {
  const r = await fetch(new URL('nyheter.json', import.meta.url), { cache: 'no-cache' });
  if (!r.ok) throw new Error('Kunde inte läsa nyheterna');
  return r.json();
}

// Prick på i-knappen när det finns nyheter man inte har sett
export async function markeraOsedda() {
  try {
    const dagar = await hamta();
    const senaste = dagar[0] ? `${dagar[0].datum}|${dagar[0].punkter.length}` : '';
    document.getElementById('info')?.classList.toggle('osedd', !!senaste && minns('settNyheter') !== senaste);
  } catch { /* utan nät: ingen prick */ }
}

export async function renderNyheter(el) {
  el.innerHTML = '<p class="muted center">Laddar …</p>';
  const dagar = await hamta();
  if (dagar[0]) minns('settNyheter', `${dagar[0].datum}|${dagar[0].punkter.length}`);
  document.getElementById('info')?.classList.remove('osedd');
  el.innerHTML = `<div class="card"><h1>Nytt i appen</h1>
    ${dagar.map((d) => `<section class="ny-dag"><h2>${esc(d.datum)}</h2>
      <ul class="ny-lista">${d.punkter.map((p) => `<li>${formatera(p)}</li>`).join('')}</ul></section>`).join('')}</div>`;
}
