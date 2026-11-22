// Router, inloggning, spelarlistan och offlinekön.
import { api, login, logout, isLoggedIn, esc, minns, ko, skickaKo } from './lib.js?v=0.1.0';
import { renderStart, renderSpel } from './spela.js?v=0.1.0';
import { renderHistorik } from './historik.js?v=0.1.0';
import { renderStatistik } from './statistik.js?v=0.1.0';

const app = document.getElementById('app');

// Spelarna sparas lokalt så att ett spel kan startas utan nät.
export async function spelare(fresh = false) {
  const sparade = minns('spelare');
  if (sparade && !fresh) { hamtaSpelare().catch(() => {}); return sparade; }
  try { return await hamtaSpelare(); } catch (e) { if (sparade && (e.natfel || e instanceof TypeError)) return sparade; throw e; }
}
async function hamtaSpelare() {
  const s = await api('spelare?select=*&order=ordning,namn');
  minns('spelare', s);
  return s;
}

function visaKo() {
  const n = ko().length;
  document.getElementById('kostatus').textContent = n ? `${n} spel väntar på att skickas · ` : '';
}

async function route() {
  const [vy] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === (vy === 'spel' ? 'spela' : (vy || 'spela'))));
  document.getElementById('loggaut').hidden = !isLoggedIn();
  visaKo();
  if (vy === 'loggaut') { logout(); location.hash = '#/'; return; }
  if (!isLoggedIn()) return renderLogin();
  try {
    if (vy === 'spel') return renderSpel(app);
    if (vy === 'historik') return await renderHistorik(app, await spelare());
    if (vy === 'statistik') return await renderStatistik(app, await spelare());
    return renderStart(app, await spelare());
  } catch (e) {
    if (e.status === 401) return renderLogin('Logga in igen.');
    const natfel = e.natfel || e instanceof TypeError;
    app.innerHTML = `<div class="card fel"><h2>${natfel ? 'Inget nät' : 'Något gick fel'}</h2>
      <p>${natfel ? 'Statistik och historik kräver nät. Spel kan spelas offline och skickas när nätet är tillbaka.' : esc(e.message)}</p>
      <p><button class="btn" onclick="location.reload()">Ladda om</button></p></div>`;
  }
}

function renderLogin(msg = '') {
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('active'));
  app.innerHTML = `
    <form class="card login" id="loginform">
      <h1>Logga in</h1>
      <p class="muted">Koden till Darttränaren.</p>
      <label for="kod">Kod</label>
      <input id="kod" type="password" autocomplete="current-password" required>
      <button class="btn primar" type="submit">Logga in</button>
      <p id="loginmsg" class="msg">${esc(msg)}</p>
    </form>`;
  const f = document.getElementById('loginform');
  f.kod.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('loginmsg');
    m.textContent = 'Loggar in …';
    let ok = false;
    try { ok = await login(f.kod.value); } catch { m.textContent = 'Inget nät – försök igen.'; return; }
    if (ok) { skickaKo(); route(); } else m.textContent = 'Fel kod – försök igen.';
  });
}

window.addEventListener('hashchange', route);
window.addEventListener('online', () => skickaKo());
window.addEventListener('dart-ko', visaKo);
route();
if (isLoggedIn() && ko().length) skickaKo();
