// Klubbappen för Bankeryds dartklubb (bdc-statistik): tävlingar på n01darts.com och distriktsserien.
// Inget kopieras hit – Darttränaren läser direkt med klubbappens inloggning, som ligger på samma
// webbadress (lunkster.github.io) under nyckeln bdc-session. Är man inte inloggad där visas en länk dit.
import { esc, fmt } from './lib.js?v=0.7.0';
import { linje } from './diagram.js?v=0.7.0';

export const KLUBB_APP = 'https://lunkster.github.io/bdc-statistik/';
const URL_ = 'https://xkfjbrkrtetkbjugresq.supabase.co';
const NYCKEL = 'sb_publishable_H5FSgAJa63PrDJ6Y6EMpZg_YlDjm5Mq';   // klubbappens publika nyckel, skyddet är RLS
const SESSION_KEY = 'bdc-session';                                  // klubbappens egen inloggning

const las = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
export const klubbInloggad = () => !!las()?.access_token;

async function session() {
  let s = las();
  if (!s) throw Object.assign(new Error('Inte inloggad i klubbappen'), { klubb: 'inloggning' });
  if (s.expires_at * 1000 < Date.now() + 60_000) {
    // Förnya och spara tillbaka – då fortsätter klubbappen med samma inloggning
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: NYCKEL, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) { localStorage.removeItem(SESSION_KEY); throw Object.assign(new Error('Inloggningen i klubbappen har gått ut'), { klubb: 'inloggning' }); }
    const j = await r.json();
    s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
  return s;
}

export async function klubbApi(path) {
  const s = await session();
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: NYCKEL, Authorization: `Bearer ${s.access_token}`, Accept: 'application/json' } });
  if (r.status === 401) { localStorage.removeItem(SESSION_KEY); throw Object.assign(new Error('Inloggningen i klubbappen har gått ut'), { klubb: 'inloggning' }); }
  if (!r.ok) throw new Error(`Klubbappen svarade ${r.status}`);
  return r.json();
}

export const klubbSpelare = () => klubbApi('spelare?select=id,namn&aktiv=eq.true&order=namn');

const lank = (hash, text, klass = '') => `<a href="${KLUBB_APP}#/${hash}" target="_blank" rel="noopener"${klass ? ` class="${klass}"` : ''}>${text}</a>`;
const nyckel = (v, t) => `<div class="nyckel"><div class="v">${v}</div><div class="t">${t}</div></div>`;
const plats = (p) => (p === 1 ? '🏆 1' : p ? String(p) : '–');
export const loggaInKlubb = `<p class="muted">Logga in i ${lank('', 'klubbappen')} i den här webbläsaren, så hämtas din tävlingsstatistik hit.</p>`;

// Kortet i statistiken: tävlingar och serien för en spelare, med länkar till rätt tävling i klubbappen.
// traning = Darttränarens X01-snitt för samma spelare (för jämförelsen), null om det saknas.
export async function klubbKort(bdcId, traning) {
  const [tavl, serie] = await Promise.all([
    klubbApi(`v_turnering_statistik?spelare_id=eq.${bdcId}&select=tdid,placering,matcher,vunna_matcher,legs,vunna_legs,poang,pilar,snitt,t180,high_out`),
    klubbApi(`v_ds_spelare?spelare_id=eq.${bdcId}&select=tdid,division,lag,singlar,singlar_vunna,dubblar,dubblar_vunna,poang,pilar,snitt`).catch(() => []),
  ]);
  const ids = [...new Set(tavl.map((r) => r.tdid))];
  const info = ids.length ? await klubbApi(`turnering?tdid=in.(${ids.map((t) => `"${t}"`).join(',')})&select=tdid,titel,datum,serie,omgang`) : [];
  const per = new Map(info.map((t) => [t.tdid, t]));
  const rader = tavl.map((r) => ({ ...r, t: per.get(r.tdid) ?? {} })).sort((a, b) => ((a.t.datum ?? '') < (b.t.datum ?? '') ? 1 : -1));

  const sum = (lista, f) => lista.reduce((a, r) => a + Number(r[f] ?? 0), 0);
  const snitt = sum(rader, 'pilar') ? (3 * sum(rader, 'poang')) / sum(rader, 'pilar') : null;
  const hogUt = Math.max(0, ...rader.map((r) => Number(r.high_out ?? 0)));
  const jamfor = snitt !== null && traning !== null && traning !== undefined
    ? `<p class="jamfor">Tävling <b>${fmt(snitt, 1)}</b> · träning <b>${fmt(traning, 1)}</b> <span class="muted">(X01-snitt)</span></p>` : '';

  const tavlingsrad = (r) => `<tr><td>${lank(`tavling/${encodeURIComponent(r.tdid)}`, esc(r.t.titel ?? r.tdid))}<small>${r.t.datum ?? ''}</small></td>
    <td>${plats(r.placering)}</td><td>${r.vunna_matcher}–${r.matcher - r.vunna_matcher}</td><td>${fmt(r.snitt, 1)}</td></tr>`;
  const VISA = 8;
  const tavlHtml = rader.length ? `
    <div class="tabellruta"><table class="tabell klubbtabell"><tr><th>Tävling</th><th>Plac.</th><th>V–F</th><th>Snitt</th></tr>
      ${rader.slice(0, VISA).map(tavlingsrad).join('')}
      ${rader.length > VISA ? `<tbody class="fler" hidden>${rader.slice(VISA).map(tavlingsrad).join('')}</tbody>` : ''}</table></div>
    ${rader.length > VISA ? `<p><button class="btn liten" type="button" data-fler>Visa alla ${rader.length} tävlingar</button></p>` : ''}
    <h3>Snitt per tävling</h3>${linje([...rader].reverse().map((r) => ({ x: r.t.datum, y: r.snitt, text: r.t.titel })))}` : '<p class="muted">Inga tävlingar kopplade till dig i klubbappen.</p>';

  const serieHtml = serie.length ? `<h3>Distriktsserien</h3>
    <div class="tabellruta"><table class="tabell klubbtabell"><tr><th>Division</th><th>Singlar</th><th>Dubblar</th><th>Snitt</th></tr>
    ${serie.map((r) => `<tr><td>${lank(`serien/${encodeURIComponent(r.tdid)}`, esc(r.division ?? 'Serien'))}<small>${esc(r.lag ?? '')}</small></td>
      <td>${r.singlar_vunna}–${r.singlar - r.singlar_vunna}</td><td>${r.dubblar_vunna}–${r.dubblar - r.dubblar_vunna}</td><td>${fmt(r.snitt, 1)}</td></tr>`).join('')}</table></div>` : '';

  return `<div class="nycklar">
      ${nyckel(rader.length, 'tävlingar')}
      ${nyckel(`${sum(rader, 'vunna_matcher')}–${sum(rader, 'matcher') - sum(rader, 'vunna_matcher')}`, 'matcher V–F')}
      ${nyckel(fmt(snitt, 1), 'snitt')}
      ${nyckel(rader.filter((r) => r.placering === 1).length, 'segrar')}
      ${nyckel(sum(rader, 't180'), '180')}
      ${nyckel(hogUt || '–', 'högsta utgång')}
    </div>${jamfor}${tavlHtml}${serieHtml}
    <p class="forklaring">Från ${lank(`spelare/${bdcId}`, 'klubbappen')} – klubbens tävlingar på n01darts.com, hämtas torsdag och söndag. Tryck på en tävling för att öppna den i klubbappen.</p>`;
}
export function kopplaKlubbKort(el) {
  el.querySelector('[data-fler]')?.addEventListener('click', (e) => { el.querySelector('.klubbtabell .fler').hidden = false; e.target.remove(); });
}
