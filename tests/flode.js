// Hela flödet mot attrappen: inloggning, X01 med bust och utgång, ogiltig poäng, Bob's 27, solocricket med ångra,
// offline-kö, historik med ta bort och statistik. Kör: tests/attrapp.html?flode – slutar med "fel: 0".
import { db, KOD, EPOST } from './attrapp.js?v=0.6.0';
import { ko } from '../lib.js?v=0.6.0';

const ut = document.getElementById('testut');
let fel = 0;
const kolla = (namn, ok, extra = '') => { if (!ok) fel++; ut.innerHTML += `<span class="${ok ? 'ok' : 'fel'}">${ok ? 'OK ' : 'FEL'}</span> ${namn} ${extra}\n`; ut.scrollTop = 1e9; };
const vanta = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const text = (s) => $(s)?.textContent ?? '';
async function klick(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) { kolla(`hittar ${sel}`, false); return; }
  el.click(); await vanta();
}
const knapp = (t, inom = '#app') => [...document.querySelectorAll(`${inom} button, ${inom} a.btn`)].find((b) => b.textContent.trim() === t);
async function poang(n) { for (const c of String(n)) await klick(`[data-siffra="${c}"]`); await klick('[data-siffra="ok"]'); }
async function ga(hash) { location.hash = hash; await vanta(300); }
window.confirm = () => true;

try {
  await vanta(300);
  // Inloggning
  $('#epost').value = EPOST; $('#kod').value = 'fel'; $('#loginform').requestSubmit(); await vanta(200);
  kolla('fel lösenord', text('#loginmsg').includes('Fel e-post eller lösenord'));
  $('#kod').value = KOD; $('#loginform').requestSubmit(); await vanta(400);
  kolla('startsidan hälsar', text('h1') === 'Hej, Anna!' && document.querySelectorAll('.ruta').length === 6, text('h1'));
  await klick('a.ruta[href="#/ny/x01"]'); await vanta(300);
  kolla('snabbstart öppnar X01', text('h1') === 'Spela' && $('[data-typ="x01"]').classList.contains('vald'));
  kolla('inloggad som Anna', text('#inloggad').includes('Anna'), text('#inloggad'));
  kolla('Anna förvald, Bo har konto', knapp('1 Anna') !== undefined && !knapp('Bo')?.textContent.includes('gäst'));

  // Ny spelare
  $('#nyspelare input').value = 'Cia'; $('#nyspelare').requestSubmit(); await vanta(300);
  kolla('ny gäst', db.spelare.some((s) => s.namn === 'Cia' && s.anvandare === null) && knapp('2 Cia gäst') !== undefined, [...document.querySelectorAll('[data-spelare]')].map((b) => b.textContent).join('|'));
  await klick(knapp('2 Cia gäst'));   // av igen

  // X01 501, Anna mot Bo
  await klick('[data-typ="x01"]'); await klick('#app [data-inst="start"] [data-v="501"]');
  await klick(knapp('Bo'));
  kolla('två spelare i ordning', knapp('1 Anna') && knapp('2 Bo'));
  await klick('#starta');
  kolla('X01 startat', $('.display') !== null && text('.tur-text').includes('Anna'));
  const ingenScroll = () => document.body.classList.contains('spelar') && document.documentElement.scrollHeight <= innerHeight + 1;
  kolla('X01 fyller skärmen utan scroll', ingenScroll(), `${document.documentElement.scrollHeight}/${innerHeight}`);
  await poang(179);
  kolla('179 avvisas', text('#msg').includes('179'), text('#msg'));
  await poang(100); await poang(60); await poang(180); await poang(26); await poang(180);
  kolla('Anna 41 kvar med förslag', text('.spelarkort.tur .kvar') === '' || text('.spelarkort .kvar') === '41', text('.tavla'));
  kolla('utgångsförslag visas för 41', [...document.querySelectorAll('.forslag')].some((f) => f.textContent.trim() === 'S1 D20' || f.textContent.includes('D20')), text('.tavla'));
  await poang(140);   // Bo
  await poang(45);    // Anna bust
  kolla('bust frågar dubbelpilar', text('.fraga').includes('Bust'));
  await klick('[data-dubbel="1"]');
  await poang(100);   // Bo
  await poang(41);    // Anna utgång
  kolla('utgång frågar pil', text('.fraga').includes('Utgång på 41'));
  kolla('1 pil omöjlig på 41', $('[data-ut="1"]').disabled && !$('[data-ut="2"]').disabled);
  await klick('[data-ut="2"]');
  kolla('dubbel 0 spärrad vid utgång', $('[data-dubbel="0"]').disabled && $('[data-dubbel="3"]').disabled);
  await klick('[data-dubbel="1"]'); await vanta(300);
  kolla('Anna vann', text('h1').includes('Anna vann'));
  const x = db.spel.find((s) => s.typ === 'x01');
  kolla('leget sparat', x && x.rundor.length === 9 && x.spelare.find((s) => s.spelare_id === 1).vinnare, JSON.stringify(x?.rundor.filter((r) => r.spelare_id === 1)));
  const a = x.rundor.filter((r) => r.spelare_id === 1);
  kolla('bust = 0 poäng, 1 dubbelpil', a[3].poang === 0 && a[3].pilar_dubbel === 1 && a[3].pilar === 3);
  kolla('utgång 2 pilar, checkout', a[4].poang === 41 && a[4].pilar === 2 && a[4].checkout && a[4].pilar_dubbel === 1);
  kolla('match_id satt', !!x.match_id);
  await klick(knapp('Ångra sista besöket'));
  kolla('ångra utgång', text('.tur-text').includes('Anna') && text('.tur-text').includes('41'));
  await poang(41); await klick('[data-ut="3"]'); await klick('[data-dubbel="2"]'); await vanta(300);
  const x2 = db.spel.find((s) => s.typ === 'x01');
  kolla('samma leg sparas om (idempotent)', db.spel.filter((s) => s.typ === 'x01').length === 1 && x2.rundor.at(-1).pilar === 3 && x2.rundor.at(-1).pilar_dubbel === 2);
  await klick(knapp('Till start')); await vanta(300); await ga('#/ny');

  // Bob's 27 – alla miss tills det tar slut
  await klick(knapp('2 Bo'));   // bara Anna
  await klick('[data-typ="bobs27"]'); await klick('#starta');
  kolla("Bob's 27 startat", text('.malvy .mal') === 'D1');
  for (let i = 0; i < 15; i++) await klick('[data-seg="M"]');
  await vanta(200);
  const b = db.spel.find((s) => s.typ === 'bobs27');
  kolla("Bob's 27 slut vid minus", b && b.pilar.length === 15 && text('h2').includes('-3 p'), text('h2'));

  // Solocricket med ångra
  await klick(knapp('Till start')); await ga('#/ny'); await klick('[data-typ="cricket"]'); await klick('#starta');
  for (const s of ['T20', 'T19', 'M', 'M']) await klick(`[data-seg="${s}"]`);
  kolla('cricket fyller skärmen utan scroll', ingenScroll(), `${document.documentElement.scrollHeight}/${innerHeight}`);
  await klick('#angra');
  kolla('ångra pil i cricket', text('.tur-text').includes('pil 1'), text('.tur-text'));
  for (const s of ['T18', 'T17', 'T16', 'T15', 'D25', 'S25']) await klick(`[data-seg="${s}"]`);
  await vanta(200);
  const c = db.spel.find((s) => s.typ === 'cricket');
  kolla('alla stängda', text('h1').includes('Alla stängda') && c?.pilar.length === 9, `${c?.pilar.length} pilar`);
  kolla('cricket-pilar har runda och nr', c.pilar[3].runda === 2 && c.pilar[3].nr === 1);

  // Offline: spel hamnar i kön och skickas när nätet kommer tillbaka
  await klick(knapp('Till start')); await ga('#/ny'); await klick('[data-typ="dubbelrunda"]'); await klick('#starta');
  db.offline = true;
  for (let i = 0; i < 63; i++) await klick(`[data-seg="${i % 3 === 0 ? $('[data-seg]:not([data-seg="M"])')?.dataset.seg : 'M'}"]`);
  await vanta(300);
  kolla('offline: spelet ligger i kön', ko().length === 1 && text('#kostatus').includes('1 spel väntar'), text('#kostatus'));
  db.offline = false; window.dispatchEvent(new Event('online')); await vanta(400);
  const d = db.spel.find((s) => s.typ === 'dubbelrunda');
  kolla('kön skickad när nätet kom', ko().length === 0 && d?.pilar.length === 63 && d.pilar.filter((p) => p.segment !== 'M').length === 21);

  // Historik och ta bort
  await ga('#/historik');
  kolla('historiken listar Annas 4 spel – inte Bos', document.querySelectorAll('details.hrad').length === 4 && !$('[data-tabort="bo-spel-1"]'), String(document.querySelectorAll('details.hrad').length));
  kolla('historik visar snitt', text('#app').includes('snitt'));
  await klick(`[data-tabort="${b.id}"]`); await vanta(300);
  kolla('ta bort eget spel', !db.spel.some((s) => s.id === b.id) && document.querySelectorAll('details.hrad').length === 3);
  const { rpc } = await import('../lib.js?v=0.6.0');
  let nekad = false; try { await rpc('ta_bort_spel', { sid: 'bo-spel-1' }); } catch { nekad = true; }
  kolla('servern nekar att ta bort Bos spel', nekad && db.spel.some((s) => s.id === 'bo-spel-1'));
  kolla('Annas spel är skapade av Anna', db.spel.filter((s) => s.id !== 'bo-spel-1').every((s) => s.skapad_av === 'u-anna'));

  // Statistik
  await ga('#/statistik');
  kolla('statistiken visar Anna som förval', $('[data-spelare].vald')?.textContent === 'Anna');
  await klick(knapp('Bo')); await vanta(300);
  kolla('Bos statistik utan Bos egna spel', !text('#app').includes('Pilar mot ett mål') && text('#app').includes('bara spel där du själv var med'));
  await klick(knapp('Anna')); await vanta(300);
  kolla('statistik X01', text('#app').includes('X01') && document.querySelectorAll('svg.diagram').length >= 2, String(document.querySelectorAll('svg.diagram').length));
  kolla('cricket-MPR 7', text('#app').includes('7,00'));
  kolla('träff per dubbel', text('#app').includes('Bull') && text('#app').includes('33 %'));
  kolla('inget amerikanskt format', !/\b(AM|PM)\b|\d{1,2}\/\d{1,2}\/\d{4}/.test(document.body.innerText));

  // Turnering: Anna (admin) skapar en serie med Bo och gästen Cia, spelar sin match mot Bo
  await ga('#/turneringar');
  await klick(knapp('Ny turnering')); await vanta(200);
  $('#tnamn').value = 'Testcupen';
  for (const x of ['[data-falt="format"] [data-v="serie"]', '[data-falt="typ"] [data-v="x01"]', '[data-falt="start"] [data-v="501"]', '[data-falt="forst_till"] [data-v="1"]']) await klick(x);
  for (const namn of ['Anna', 'Bo', 'Cia gäst']) await klick([...document.querySelectorAll('#deltagarval button')].find((b) => b.textContent.trim().endsWith(namn)));
  kolla('seedordning', [...document.querySelectorAll('#deltagarval .vald')].map((b) => b.textContent.trim()).join('|') === '1 Anna|2 Bo|3 Cia gäst');
  $('#nyform').requestSubmit(); await vanta(500);
  kolla('turneringen skapad', text('h1') === 'Testcupen' && db.turnering_match.length === 3 && document.querySelectorAll('.turneringstabell tr').length === 4, location.hash);
  kolla('dina två matcher', document.querySelectorAll('.card:first-child .matchrad').length === 2);
  await klick([...document.querySelectorAll('.card:first-child .matchrad')].find((r) => r.textContent.includes('Bo')).querySelector('[data-spela]')); await vanta(100);
  kolla('båda har konto: fråga hur ni spelar', !!knapp('På distans – var sin telefon'));
  await klick(knapp('På den här skärmen')); await vanta(300);
  kolla('turneringsmatch startad', location.hash === '#/spel' && text('.spelhuvud').includes('Testcupen'), text('.spelhuvud'));
  const motst = text('.spelarkort:nth-child(2) .namn');
  const annas = [180, 180, 141];
  for (let i = 0; i < 8 && annas.length; i++) await poang(text('.tur-text').startsWith('Anna') ? annas.shift() : 0);
  await klick('[data-ut="3"]'); await klick('[data-dubbel="1"]'); await vanta(400);
  const leg = db.spel.find((x) => x.turnering_match);
  kolla('legget sparat i turneringen', leg && leg.match_id === leg.turnering_match && leg.spelare.find((x) => x.spelare_id === 1).vinnare, motst);
  await klick(knapp('Till Testcupen')); await vanta(500);
  kolla('tabellen räknar: Anna etta med 2 p', text('.turneringstabell tr:nth-child(2) td:first-child').includes('Anna') && text('.turneringstabell tr:nth-child(2) td:nth-child(6)') === '2', text('.turneringstabell tr:nth-child(2)'));
  kolla('matchen klar med Anna som vinnare', [...document.querySelectorAll('.matchrad.klar')].some((r) => ['1–0', '0–1'].includes(r.querySelector('.res').textContent) && r.querySelector('.vann')?.textContent === 'Anna'));
  await ga('#/');
  kolla('startsidan visar turneringen', text('#turneringar').includes('Testcupen') && text('#turneringar').includes('Din nästa match'), text('#turneringar'));
  kolla('startsidan visar formen', text('#form').includes('X01-snitt'), text('#form'));

  // Spel på distans: Anna och Bo på var sin telefon. Bo:s telefon spelas genom att ändra attrappens live_match.
  await ga('#/turnering/ny');
  $('#tnamn').value = 'Distanscupen';
  for (const x of ['[data-falt="format"] [data-v="serie"]', '[data-falt="typ"] [data-v="x01"]', '[data-falt="start"] [data-v="501"]', '[data-falt="forst_till"] [data-v="1"]']) await klick(x);
  for (const b of [...document.querySelectorAll('#deltagarval .vald')]) await klick(b);
  for (const namn of ['Anna', 'Bo']) await klick([...document.querySelectorAll('#deltagarval button')].find((b) => b.textContent.trim().endsWith(namn)));
  $('#nyform').requestSubmit(); await vanta(500);
  await klick('.card:first-child [data-spela]'); await klick(knapp('På distans – var sin telefon')); await vanta(400);
  const live = () => db.live_match[0];
  kolla('distansmatch startad', location.hash === '#/spel' && db.live_match.length === 1 && live().version === 1 && text('.spelhuvud').includes('på distans'), JSON.stringify(db.live_match.map((l) => l.version)));
  const boKastar = (poang) => { const l = live(); const nr = l.tillstand.leg.rundor.filter((x) => x.spelare_id === 2).length + 1;
    l.tillstand.leg.rundor.push({ spelare_id: 2, nr, poang, pilar: 3, pilar_dubbel: 0, checkout: false }); l.version++; };
  if (text('.tur-text').startsWith('Bo')) {
    kolla('väntar på Bo', text('.vantar').includes('Väntar på Bo') && !$('[data-siffra]'));
    boKastar(60); await vanta(1800);
    kolla('Bo:s kast syns live', [...document.querySelectorAll('.spelarkort .kvar')].some((k) => k.textContent === '441') && !!$('[data-siffra]'), text('.tavla'));
  }
  await poang(180); await vanta(300);
  kolla('Annas kast skickat', live().tillstand.leg.rundor.some((x) => x.spelare_id === 1 && x.poang === 180) && !live().tillstand.distans, `v${live().version}`);
  kolla('nu väntar Anna på Bo', text('.vantar').includes('Väntar på Bo') && !$('#angra').disabled);
  boKastar(100); await vanta(1800);
  kolla('Annas tur igen efter Bo', !!$('[data-siffra]') && $('#angra').disabled, text('.tur-text'));
  // Gå med från startsidan (t.ex. från en annan telefon eller efter omstart)
  localStorage.removeItem('dart-pagaende');
  await ga('#/'); await vanta(300);
  kolla('startsidan: gå med i matchen', text('#live').includes('Gå med i matchen') && text('#live').includes('mot Bo'), text('#live'));
  await klick('#live [data-gamed]'); await vanta(300);
  kolla('med i matchen igen', location.hash === '#/spel' && [...document.querySelectorAll('.spelarkort .kvar')].some((k) => k.textContent === '321'), text('.tavla'));
  // Motspelaren hann före: Annas besök kommer inte med, Bo:s ändring vinner
  live().version += 5;
  await poang(60); await vanta(1800);
  kolla('konflikt: motspelarens läge vinner', live().tillstand.leg.rundor.every((x) => x.poang !== 60) && JSON.parse(localStorage.getItem('dart-pagaende')).distans.version === live().version);
  db.live_match = []; await vanta(1800);
  kolla('motspelaren avbröt', text('h1') === 'Matchen avbröts' && !localStorage.getItem('dart-pagaende'), text('h1'));

  // Min sida: alias och val under spelet
  await klick('#minsida'); await vanta(300);
  kolla('min sida via knappen i menyn', text('h1') === 'Min sida' && $('#alias').value === 'Anna' && $('#minsida').classList.contains('active'));
  $('#alias').value = 'bo'; $('#aliasform').requestSubmit(); await vanta(300);
  kolla('alias som används nekas', text('#aliasmsg').includes('används redan') && db.spelare[0].namn === 'Anna', text('#aliasmsg'));
  $('#alias').value = 'Annie'; $('#aliasform').requestSubmit(); await vanta(300);
  kolla('nytt alias sparat', db.spelare[0].namn === 'Annie' && text('#inloggad').includes('Annie'), text('#inloggad'));
  for (const k of ['forslag', 'dubbelfraga']) { const c = $(`[data-val="${k}"]`); c.checked = false; c.dispatchEvent(new Event('change')); }
  kolla('val sparade', JSON.stringify(JSON.parse(localStorage.getItem('dart-installningar'))) === '{"forslag":false,"dubbelfraga":false}');
  await ga('#/ny'); await klick('[data-typ="x01"]'); await klick('#app [data-inst="start"] [data-v="501"]');
  await klick('#starta');
  await poang(180); await poang(180); await poang(100);
  kolla('inga utgångsförslag när de är avstängda', !$('.forslag') && text('.spelarkort .kvar') === '41');
  kolla('ingen snittrad som standard', !text('.spelarkort').includes('snitt'));
  await poang(45);
  kolla('bust utan dubbelfråga', !$('.fraga') && text('.spelarkort .kvar') === '41');
  await poang(41);
  kolla('utgång frågar bara pil', text('.fraga').includes('Med vilken pil'));
  await klick('[data-ut="2"]'); await vanta(300);
  const ny = db.spel.filter((x) => x.typ === 'x01').sort((a2, b2) => (a2.start < b2.start ? 1 : -1))[0];
  kolla('utgång utan dubbelfråga sparad', text('h1').includes('vann') && ny.rundor.at(-1).pilar === 2 && ny.rundor.at(-1).pilar_dubbel === 1 && ny.rundor[3].pilar_dubbel === 0, JSON.stringify(ny.rundor.slice(-2)));

  // Nytt i appen (i-knappen) – går också utan inloggning
  await klick('#info'); await vanta(400);
  kolla('nytt i appen', text('h1') === 'Nytt i appen' && document.querySelectorAll('.ny-lista li').length > 0 && !!$('.ny-lista strong') && !!$('.ny-ver'), String(document.querySelectorAll('.ny-lista li').length));
  kolla('ingen prick efter läsning', !$('#info').classList.contains('osedd'));
  await ga('#/loggaut'); await ga('#/nyheter');
  kolla('nyheterna syns utloggad', text('h1') === 'Nytt i appen');
} catch (e) { kolla('undantag', false, e.stack); }

ut.innerHTML += `\n<b class="${fel ? 'fel' : 'ok'}">fel: ${fel}</b>\n`;
document.title = `fel: ${fel}`;
