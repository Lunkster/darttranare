// Gemensamt: Supabase-anrop mot schemat dart, inloggning, offlinekö och hjälpfunktioner.

export const SUPABASE_URL = 'https://nlvgisjssbjethumvgdz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3wzcVvDgcoupfWSqAis4eg_bz2e6jiG'; // publik nyckel, skyddet är RLS
// Var och en har ett eget konto (e-post och lösenord). Rollen 'dart' i kontots app_metadata släpper in i gruppen.
const SCHEMA = 'dart';
const SESSION_KEY = 'dart-session';   // samma webbadress (lunkster.github.io) som THT och skytte – egen nyckel

// ---------- lokalt sparat ----------
export function minns(nyckel, varde) {
  const k = `dart-${nyckel}`;
  try {
    if (varde === undefined) return JSON.parse(localStorage.getItem(k));
    if (varde === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(varde));
  } catch { /* privat läge */ }
  return varde;
}

// Val för vad som visas under spelet – det fiffiga runtomkring ska gå att stänga av (Sten 2026-11-22)
export const STANDARD = { forslag: true, detaljer: false, dubbelfraga: true };
export const val = (k) => ({ ...STANDARD, ...(minns('installningar') ?? {}) })[k];

// ---------- läsa och skriva ----------
export async function api(path) {
  const s = await session(true);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, Accept: 'application/json', 'Accept-Profile': SCHEMA },
  });
  if (!r.ok) throw await fel(r);
  return r.json();
}

export async function write(method, path, body, prefer = 'return=representation') {
  const s = await session(true);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json', 'Content-Profile': SCHEMA, 'Accept-Profile': SCHEMA, Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw await fel(r);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

export const rpc = (namn, args, medSvar = false) => write('POST', `rpc/${namn}`, args, medSvar ? 'return=representation' : 'return=minimal');

async function fel(r) {
  const t = await r.text();
  let msg = t, code = null;
  try { const j = JSON.parse(t); msg = j.message || t; code = j.code; } catch { /* text */ }
  if (r.status === 401) logout();
  return Object.assign(new Error(msg), { status: r.status, code });
}

// ---------- inloggning ----------
function load() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function save(s) { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* privat läge */ } }
let current = load();

async function auth(grant, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
}

export async function login(epost, losen) {
  current = await auth('password', { email: epost.trim(), password: losen });
  save(current);
  if (current) minns('epost', epost.trim());
  return !!current;
}
export function logout() { current = null; save(null); }
export const isLoggedIn = () => !!current;

// Den inloggades konto-id (sub i JWT) och spelaren som hör till kontot
export function anvandarId() {
  try { return JSON.parse(atob(current.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? null; } catch { return null; }
}
export function arAdmin() {   // får skapa turneringar (app_metadata.dart_admin – kontrolleras också i databasen)
  try { return JSON.parse(atob(current.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).app_metadata?.dart_admin === true; } catch { return false; }
}
export const jag = (alla) => alla.find((s) => s.anvandare && s.anvandare === anvandarId()) ?? null;

async function session(required) {
  if (!current) { if (required) throw Object.assign(new Error('Inte inloggad'), { status: 401 }); return null; }
  if (current.expires_at * 1000 < Date.now() + 60_000) {
    let s = null;
    try { s = await auth('refresh_token', { refresh_token: current.refresh_token }); } catch { throw Object.assign(new Error('Inget nät'), { natfel: true }); }
    if (!s) { logout(); if (required) throw Object.assign(new Error('Inloggningen har gått ut'), { status: 401 }); return null; }
    current = s; save(s);
  }
  return current;
}

// ---------- offlinekö: färdiga spel skickas med spara_spel när nät finns ----------
export const ko = () => minns('ko') ?? [];
export function laggIKo(spel) {
  const k = ko().filter((x) => x.id !== spel.id);
  k.push(spel);
  minns('ko', k);
}
let skickar = null;
export function skickaKo() {
  if (!skickar) skickar = (async () => {
    let skickade = 0, fel = null;
    for (const spel of ko()) {
      try {
        await rpc('spara_spel', { p: spel });
        minns('ko', ko().filter((x) => x.id !== spel.id));
        skickade++;
      } catch (e) { fel = e; break; }
    }
    window.dispatchEvent(new CustomEvent('dart-ko'));
    return { skickade, kvar: ko().length, fel };
  })().finally(() => { skickar = null; });
  return skickar;
}

// ---------- hjälp ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Länkar till spelare, match, leg och turnering – används i tabeller, rubriker och listor
export const spelarLank = (id, namn) => (id === null || id === undefined ? esc(namn ?? '–') : `<a class="lank" href="#/spelare/${id}">${esc(namn ?? '?')}</a>`);
export const legLank = (id, text) => `<a class="lank" href="#/leg/${id}">${text}</a>`;
export const matchLank = (id, text) => `<a class="lank" href="#/match/${id}">${text}</a>`;
export const turneringLank = (id, namn) => `<a class="lank" href="#/turnering/${id}">${esc(namn)}</a>`;
export const fmt = (v, d = 1) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) ? '–'
  : Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const proc = (a, b, d = 0) => (b ? `${fmt((100 * a) / b, d)} %` : '–');
const t2 = (n) => String(n).padStart(2, '0');
// Datum och tid formateras själva – aldrig efter webbläsarens språk.
export const datum = (d) => { d = new Date(d); return `${d.getFullYear()}-${t2(d.getMonth() + 1)}-${t2(d.getDate())}`; };
export const tid = (d) => { d = new Date(d); return `${datum(d)} ${t2(d.getHours())}:${t2(d.getMinutes())}`; };
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// Egen fråga och varning i stället för webbläsarens confirm/alert, som visar webbadressen överst (Henrik 2026-11-25).
// Svarar med ett löfte: true = OK. Esc eller Avbryt = false. Flödestestet svarar via window.testSvar.
export function fraga(text, { ok = 'OK', avbryt = 'Avbryt', fara = false, titel = 'Pilgrym' } = {}) {
  if (window.testSvar) return Promise.resolve(window.testSvar(text));
  return new Promise((svar) => {
    const d = document.createElement('dialog');
    d.className = 'appdialog';
    d.innerHTML = `<form method="dialog">
      <div class="dialoghuvud"><img src="${new URL('ikon.svg?v=0.10.1', import.meta.url).href}" alt="" aria-hidden="true"><span>${esc(titel)}</span></div>
      <p>${esc(text)}</p>
      <div class="dialogknappar">${avbryt ? `<button class="btn" value="nej">${esc(avbryt)}</button>` : ''}<button class="btn ${fara ? 'fara' : 'primar'}" value="ja" autofocus>${esc(ok)}</button></div></form>`;
    document.body.append(d);
    d.addEventListener('close', () => { svar(d.returnValue === 'ja'); d.remove(); });
    d.showModal();
  });
}
export const varna = (text) => fraga(text, { avbryt: null, titel: 'Obs!' });
