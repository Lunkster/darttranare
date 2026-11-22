// Klubbappen för Bankeryds dartklubb (bdc-statistik): tävlingar på n01darts.com och distriktsserien.
// Inget kopieras hit – Darttränaren läser direkt med klubbappens inloggning, som ligger på samma
// webbadress (lunkster.github.io) under nyckeln bdc-session. Är man inte inloggad där visas en länk dit.
import { esc, fmt } from './lib.js?v=0.7.3';

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

// Hämta en spelares tävlingar (nyast först) och distriktsserien ur klubbappen
export async function hamtaKlubb(bdcId) {
  const [tavl, serie] = await Promise.all([
    klubbApi(`v_turnering_statistik?spelare_id=eq.${bdcId}&select=tdid,placering,matcher,vunna_matcher,legs,vunna_legs,poang,pilar,snitt,t180,high_out`),
    klubbApi(`v_ds_spelare?spelare_id=eq.${bdcId}&select=tdid,division,lag,singlar,singlar_vunna,dubblar,dubblar_vunna,poang,pilar,snitt`).catch(() => []),
  ]);
  const ids = [...new Set(tavl.map((r) => r.tdid))];
  const info = ids.length ? await klubbApi(`turnering?tdid=in.(${ids.map((t) => `"${t}"`).join(',')})&select=tdid,titel,datum,serie,omgang`) : [];
  const per = new Map(info.map((t) => [t.tdid, t]));
  const rader = tavl.map((r) => ({ ...r, t: per.get(r.tdid) ?? {} })).sort((a, b) => ((a.t.datum ?? '') < (b.t.datum ?? '') ? 1 : -1));
  return { bdcId, rader, serie };
}

const sum = (lista, f) => lista.reduce((a, r) => a + Number(r[f] ?? 0), 0);

// Nyckeltalen för tävlingarna – visas under träningens nyckeltal i X01-kortet
export function klubbNycklar({ rader }) {
  if (!rader.length) return '<p class="muted">Inga tävlingar kopplade till dig i klubbappen.</p>';
  const snitt = sum(rader, 'pilar') ? (3 * sum(rader, 'poang')) / sum(rader, 'pilar') : null;
  const hogUt = Math.max(0, ...rader.map((r) => Number(r.high_out ?? 0)));
  return `<div class="nycklar klubbnycklar">
      ${nyckel(fmt(snitt, 1), 'snitt')}
      ${nyckel(rader.length, 'tävlingar')}
      ${nyckel(`${sum(rader, 'vunna_matcher')}–${sum(rader, 'matcher') - sum(rader, 'vunna_matcher')}`, 'matcher V–F')}
      ${nyckel(rader.filter((r) => r.placering === 1).length, 'segrar')}
      ${nyckel(hogUt || '–', 'högsta utgång')}
      ${nyckel(sum(rader, 't180'), '180')}
    </div>`;
}

// Rosa punkter i X01-grafen: snittet för varje tävlingskväll
export const klubbPunkter = ({ rader }) => rader.filter((r) => r.t.datum && r.snitt !== null)
  .map((r) => ({ x: r.t.datum, y: r.snitt, text: `${r.t.titel ?? r.tdid} (tävling)`, klass: 'klubb' }));

// Tävlingslistan och serien med länkar till rätt tävling i klubbappen
export function klubbListor({ bdcId, rader, serie }) {
  const tavlingsrad = (r) => `<tr><td>${lank(`tavling/${encodeURIComponent(r.tdid)}`, esc(r.t.titel ?? r.tdid))}<small>${r.t.datum ?? ''}</small></td>
    <td>${plats(r.placering)}</td><td>${r.vunna_matcher}–${r.matcher - r.vunna_matcher}</td><td>${fmt(r.snitt, 1)}</td></tr>`;
  const VISA = 8;
  const tavlHtml = rader.length ? `<h3>Tävlingar <span class="kalla">Bankeryds dartklubb</span></h3>
    <div class="tabellruta"><table class="tabell klubbtabell"><tr><th>Tävling</th><th>Plac.</th><th>V–F</th><th>Snitt</th></tr>
      ${rader.slice(0, VISA).map(tavlingsrad).join('')}
      ${rader.length > VISA ? `<tbody class="fler" hidden>${rader.slice(VISA).map(tavlingsrad).join('')}</tbody>` : ''}</table></div>
    ${rader.length > VISA ? `<p><button class="btn liten" type="button" data-fler>Visa alla ${rader.length} tävlingar</button></p>` : ''}` : '';
  const serieHtml = serie.length ? `<h3>Distriktsserien <span class="kalla">Bankeryds dartklubb</span></h3>
    <div class="tabellruta"><table class="tabell klubbtabell"><tr><th>Division</th><th>Singlar</th><th>Dubblar</th><th>Snitt</th></tr>
    ${serie.map((r) => `<tr><td>${lank(`serien/${encodeURIComponent(r.tdid)}`, esc(r.division ?? 'Serien'))}<small>${esc(r.lag ?? '')}</small></td>
      <td>${r.singlar_vunna}–${r.singlar - r.singlar_vunna}</td><td>${r.dubblar_vunna}–${r.dubblar - r.dubblar_vunna}</td><td>${fmt(r.snitt, 1)}</td></tr>`).join('')}</table></div>` : '';
  return `${tavlHtml}${serieHtml}`;
}

// Var tävlingarna kommer ifrån – dolt bakom i-knappen vid rubriken Tävling
const I_IKON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/></svg>';
export const klubbInfoKnapp = `<button type="button" class="infoknapp" data-klubbinfo aria-expanded="false" aria-label="Var kommer tävlingarna ifrån?" title="Var kommer tävlingarna ifrån?">${I_IKON}</button>`;
export const klubbInfo = (bdcId) => `<p class="forklaring klubbinfo" hidden>Tävlingarna kommer från ${lank(`spelare/${bdcId}`, 'klubbappen')} för Bankeryds dartklubb (klubbens tävlingar på n01darts.com, hämtas dit torsdag och söndag). Tryck på en tävling för att öppna den där.</p>`;
export function kopplaKlubbInfo(el) {
  const b = el.querySelector('[data-klubbinfo]'), t = el.querySelector('.klubbinfo');
  if (b && t) b.onclick = () => { t.hidden = !t.hidden; b.setAttribute('aria-expanded', String(!t.hidden)); };
}
export function kopplaKlubbListor(el) {
  el.querySelector('[data-fler]')?.addEventListener('click', (e) => { el.querySelector('.klubbtabell .fler').hidden = false; e.target.remove(); });
}
