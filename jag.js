// Min sida: byta alias och välja vad som visas under spelet (sparas i den här enheten).
import { write, esc, jag, minns, val } from './lib.js?v=0.6.0';

const VAL = [
  ['forslag', 'Utgångsförslag i X01', 'Visar t.ex. T20 T19 D12 när du kan gå ut.'],
  ['detaljer', 'Snitt och pilar under spelet', 'Liten rad med snitt, antal pilar och senaste besök under varje spelare.'],
  ['dubbelfraga', 'Fråga om pilar på dubbel', 'Behövs för utgångsprocenten i statistiken. Utan frågan räknas bara utgångspilen.'],
];

export function renderJag(el, alla, nyttNamn) {
  const mig = jag(alla);
  el.innerHTML = `
    <form class="card" id="aliasform">
      <h1>Min sida</h1>
      ${mig ? `<label for="alias">Mitt namn i appen</label>
        <div class="rad"><input id="alias" name="alias" maxlength="40" required value="${esc(mig.namn)}" autocomplete="nickname">
        <button class="btn primar" type="submit">Spara</button></div>
        <p class="forklaring">Syns för alla i gruppen. Två spelare kan inte ha samma namn.</p>`
    : '<p class="muted">Ditt konto är inte kopplat till någon spelare än – säg till Henrik.</p>'}
      <p class="msg" id="aliasmsg"></p>
    </form>
    <div class="card">
      <h2>Under spelet</h2>
      <p class="forklaring">Gäller i den här telefonen eller surfplattan.</p>
      ${VAL.map(([k, t, f]) => `<label class="vaxel"><input type="checkbox" data-val="${k}"${val(k) ? ' checked' : ''}>
        <span><b>${t}</b><small>${f}</small></span></label>`).join('')}
      <p><button class="btn liten" id="standard" type="button">Återställ</button></p>
    </div>`;
  el.querySelectorAll('[data-val]').forEach((c) => c.onchange = () => {
    minns('installningar', { ...(minns('installningar') ?? {}), [c.dataset.val]: c.checked });
  });
  el.querySelector('#standard').onclick = () => { minns('installningar', null); renderJag(el, alla); };
  el.querySelector('#aliasform').onsubmit = async (e) => {
    e.preventDefault();
    const m = el.querySelector('#aliasmsg'), namn = el.querySelector('#alias').value.trim();
    if (!namn || namn === mig.namn) return;
    if (alla.some((s) => s.id !== mig.id && s.namn.toLowerCase() === namn.toLowerCase())) { m.textContent = `${namn} används redan.`; return; }
    try {
      await write('PATCH', `spelare?id=eq.${mig.id}`, { namn }, 'return=minimal');
      mig.namn = namn; minns('spelare', alla);
      nyttNamn?.(alla);
      m.classList.add('ok'); m.textContent = 'Sparat.';
    } catch (err) {
      m.classList.remove('ok');
      m.textContent = err.code === '23505' ? `${namn} används redan.` : err.natfel || err instanceof TypeError ? 'Namnbyte kräver nät.' : err.message;
    }
  };
}
