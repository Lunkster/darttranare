// Egna SVG-diagram utan bibliotek. Datum som ÅÅÅÅ-MM-DD, tal med decimalkomma.
import { esc, fmt, datum } from './lib.js?v=0.4.0';

const B = 340, H = 180, M = { v: 38, h: 10, o: 12, n: 26 };

function skala(min, max, steg = 4) {
  if (min === max) { min -= 1; max += 1; }
  const rå = (max - min) / steg, mag = 10 ** Math.floor(Math.log10(rå));
  const s = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((f) => f >= rå);
  const lo = Math.floor(min / s) * s, hi = Math.ceil(max / s) * s;
  const ut = []; for (let v = lo; v <= hi + s / 2; v += s) ut.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks: ut };
}

// punkter = [{x: Date|string, y: number, text?}] i tidsordning. Visar punkter, glidande medel och y-axel.
export function linje(punkter, { dec = 1, enhet = '', medel = 5 } = {}) {
  const p = punkter.filter((q) => q.y !== null && q.y !== undefined && !Number.isNaN(Number(q.y))).map((q) => ({ ...q, t: new Date(q.x).getTime(), y: Number(q.y) }));
  if (!p.length) return '<p class="muted">Inga spel än.</p>';
  const ys = skala(Math.min(...p.map((q) => q.y)), Math.max(...p.map((q) => q.y)));
  // x efter ordning (inte tid) så att täta kvällar inte klumpar ihop sig
  const X = (i) => M.v + (p.length === 1 ? (B - M.v - M.h) / 2 : (i * (B - M.v - M.h)) / (p.length - 1));
  const Y = (v) => M.o + ((ys.hi - v) * (H - M.o - M.n)) / (ys.hi - ys.lo);
  const glid = p.map((_, i) => { const f = p.slice(Math.max(0, i - medel + 1), i + 1); return f.reduce((a, q) => a + q.y, 0) / f.length; });
  const xEt = p.length > 1 ? [0, p.length - 1] : [0];
  return `<svg viewBox="0 0 ${B} ${H}" class="diagram" role="img">
    ${ys.ticks.map((v) => `<line x1="${M.v}" x2="${B - M.h}" y1="${Y(v)}" y2="${Y(v)}" class="rutnat"/><text x="${M.v - 5}" y="${Y(v) + 4}" class="axel" text-anchor="end">${fmt(v, Number.isInteger(v) ? 0 : 1)}</text>`).join('')}
    ${xEt.map((i) => `<text x="${X(i)}" y="${H - 8}" class="axel" text-anchor="${i === 0 && p.length > 1 ? 'start' : i === p.length - 1 && p.length > 1 ? 'end' : 'middle'}">${datum(p[i].t)}</text>`).join('')}
    ${p.length >= 3 ? `<polyline points="${glid.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" class="medel"/>` : ''}
    ${p.map((q, i) => `<circle cx="${X(i)}" cy="${Y(q.y)}" r="3.2" class="punkt"><title>${datum(q.t)}: ${fmt(q.y, dec)}${enhet}${q.text ? ` – ${esc(q.text)}` : ''}</title></circle>`).join('')}
  </svg>`;
}

// rader = [{text, varde (0–1), etikett}] – liggande staplar, t.ex. träff per dubbel
export function staplar(rader) {
  if (!rader.length) return '<p class="muted">Inga pilar än.</p>';
  const h = 20, b = 340, v = 52, hoger = 74;
  return `<svg viewBox="0 0 ${b} ${rader.length * h + 4}" class="diagram staplar" role="img">
    ${rader.map((r, i) => `<text x="${v - 6}" y="${i * h + 15}" class="axel" text-anchor="end">${esc(r.text)}</text>
      <rect x="${v}" y="${i * h + 4}" width="${b - v - hoger}" height="${h - 7}" class="spar" rx="3"/>
      <rect x="${v}" y="${i * h + 4}" width="${Math.max(0, (b - v - hoger) * r.varde)}" height="${h - 7}" class="stapel" rx="3"/>
      <text x="${b - hoger + 6}" y="${i * h + 15}" class="axel">${esc(r.etikett)}</text>`).join('')}
  </svg>`;
}
