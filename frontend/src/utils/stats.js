/* Formats FR + montants F CFA (pas de décimales), nombres tabulaires via .dg-tnum. */
export const fcfa0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const fCFA = (v) => `${fcfa0.format(Math.round(v))} F`;
export const num0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const num1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Générateur pseudo-aléatoire seedé — séries de démo stables entre rendus. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Belles bornes d'axe Y. */
export function niceScale(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

/* Courbe lissée Catmull-Rom vers Bézier. */
export function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/* Séries de démo : encaissements (F CFA) + projets livrés, période vs précédente. */
export function buildSeries(days, seed = 20260910) {
  const rnd = mulberry32(seed);
  const today = new Date();
  const mk = (offset) => {
    const arr = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset - (days - 1 - i));
      const wd = d.getDay();
      const sem = wd === 0 ? 0.55 : wd === 6 ? 0.7 : 1;
      const t = 1 + 0.25 * (i / Math.max(1, days - 1));
      arr.push({
        d,
        enc: Math.round(320000 * t * sem * (0.8 + rnd() * 0.45)),
        liv: Math.round((1 + rnd() * 3) * sem),
      });
    }
    return arr;
  };
  return { curr: mk(0), prev: mk(days) };
}
