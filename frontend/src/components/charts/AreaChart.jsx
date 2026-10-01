import { useEffect, useRef, useState } from 'react';
import { niceScale, smoothPath, cap } from '../../utils/stats.js';

/* Courbe de performance SVG : grille, comparatif pointillé, crosshair + tooltip.
   curr/prev: [{ d: Date|string, v: number }] (string = libellé déjà formaté, ex. séries API). */
export function useLargeur(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const maj = () => setW(el.clientWidth);
    maj();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(maj);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, [ref]);
  return w;
}

/* Libellé d'axe/tooltip : Date -> format FR, string -> tel quel (séries API). */
const libelleCourt = (d) => (d instanceof Date ? cap(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })) : String(d ?? ''));
const libelleLong = (d) => (d instanceof Date ? cap(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) : String(d ?? ''));

export default function AreaChart({ curr, prev, compare, format, formatAxe, animKey }) {
  const ref = useRef(null);
  const w = useLargeur(ref);
  const [survol, setSurvol] = useState(null);
  const H = 280;

  const P = { t: 16, r: 12, b: 30, l: 64 };
  const n = curr.length;
  const vals = compare ? curr.map((p) => p.v).concat(prev.map((p) => p.v)) : curr.map((p) => p.v);
  const { lo, hi, step } = niceScale(Math.min(...vals), Math.max(...vals), 4);
  const iw = Math.max(10, w - P.l - P.r);
  const ih = H - P.t - P.b;
  const X = (i) => P.l + (i * iw) / Math.max(1, n - 1);
  const Y = (v) => P.t + ih * (1 - (v - lo) / (hi - lo || 1));
  const ptsC = curr.map((p, i) => ({ x: X(i), y: Y(p.v) }));
  const ptsP = prev.map((p, i) => ({ x: X(i), y: Y(p.v) }));
  const dC = smoothPath(ptsC);
  const dP = smoothPath(ptsP);
  const zone = n > 0 ? `${dC} L ${ptsC[n - 1].x} ${P.t + ih} L ${ptsC[0].x} ${P.t + ih} Z` : '';

  const grille = [];
  for (let v = lo; v <= hi + 1e-9; v += step) grille.push(v);
  const nbTicks = Math.min(6, n);
  const ticks = [...new Set(Array.from({ length: nbTicks }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, nbTicks - 1))))];

  const bouger = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const i = Math.round((e.clientX - rect.left - P.l) / (iw / Math.max(1, n - 1)));
    setSurvol(Math.max(0, Math.min(n - 1, i)));
  };

  const hp = survol != null ? curr[survol] : null;
  const hPrev = survol != null ? prev[survol] : null;
  const delta = hp && hPrev ? ((hp.v - hPrev.v) / (hPrev.v || 1)) * 100 : null;

  return (
    <div ref={ref} className="relative mt-esp-2" onMouseLeave={() => setSurvol(null)}>
      {w > 0 && (
        <svg width={w} height={H} className="block" role="img" aria-label="Graphique de performance">
          {grille.map((v) => (
            <g key={v}>
              <line x1={P.l} x2={w - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--gris-300)" strokeWidth="1" strokeDasharray={v === lo ? 'none' : '3 5'} />
              <text x={P.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="13" fontFamily="Barlow, sans-serif" fill="var(--gris-500)">
                {formatAxe(v)}
              </text>
            </g>
          ))}
          {ticks.map((i) => (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="13" fontFamily="Barlow, sans-serif" fill="var(--gris-600)">
              {libelleCourt(curr[i].d)}
            </text>
          ))}
          <g key={animKey}>
            {compare && <path d={dP} fill="none" stroke="var(--gris-400)" strokeWidth="2" strokeDasharray="5 5" className="dg-fondu" />}
            <path d={zone} fill="var(--bleu-digi)" opacity="0.08" className="dg-fondu-tard" />
            <path d={dC} fill="none" stroke="var(--bleu-digi)" strokeWidth="2" strokeLinecap="square" pathLength="1" className="dg-trait" />
          </g>
          {survol != null && hp && (
            <g>
              <line x1={X(survol)} x2={X(survol)} y1={P.t} y2={P.t + ih} stroke="var(--gris-600)" strokeOpacity="0.4" strokeDasharray="3 3" />
              <circle cx={X(survol)} cy={Y(hp.v)} r="8" fill="var(--bleu-digi)" opacity="0.15" />
              <circle cx={X(survol)} cy={Y(hp.v)} r="4" fill="var(--bleu-digi)" stroke="var(--gris-000)" strokeWidth="2" />
            </g>
          )}
          <rect x={P.l} y={P.t} width={iw} height={ih} fill="transparent" style={{ cursor: 'crosshair' }} onMouseMove={bouger} />
        </svg>
      )}
      {survol != null && hp && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: Math.min(Math.max(X(survol), 96), w - 96), top: Y(hp.v) - 12, transform: 'translate(-50%,-100%)' }}
        >
          <div className="dg-pop min-w-36 rounded-lg bg-marine-profond px-esp-4 py-esp-3 shadow-ombre-4">
            <p className="font-titrage text-[12px] font-bold uppercase leading-[1.2] tracking-[0.16em] text-digi-brume">
              {libelleLong(hp.d)}
            </p>
            <p className="mt-esp-1 font-titrage text-[21px] font-bold text-blanc dg-tnum">{format(hp.v)}</p>
            {compare && delta != null && (
              <p className={`font-courant text-[13px] dg-tnum ${delta >= 0 ? 'text-succes-lumineux' : 'text-erreur-lumineux'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} % vs période précédente
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
