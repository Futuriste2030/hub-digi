import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { num1 } from '../../utils/stats.js';

/* Nombre animé (ease-out, 500ms max charte). */
export function AnimatedNumber({ value, format, duration = 500 }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      prev.current = to;
    };
  }, [value, duration]);
  return <>{format(display)}</>;
}

/* Variation vs période précédente. */
export function Delta({ v, className = '' }) {
  const up = v >= 0;
  const Icone = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-courant text-[13px] font-semibold dg-tnum ${up ? 'text-succes' : 'text-erreur'} ${className}`}>
      <Icone size={16} aria-hidden="true" />
      {num1.format(Math.abs(v))} %<span className="hidden font-normal text-gris-600 sm:inline">vs préc.</span>
    </span>
  );
}

/* Mini courbe lissée avec point final. */
export function Sparkline({ data, w = 84, h = 30, couleur = 'var(--bleu-digi)' }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => ({
    x: 1 + (i * (w - 2)) / (data.length - 1),
    y: h - 3 - (h - 6) * ((v - min) / (max - min || 1)),
  }));
  const d = pts.length > 1
    ? `M ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`
    : '';
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="square" opacity="0.9" />
      {last && <circle cx={last.x} cy={last.y} r="3" fill={couleur} />}
    </svg>
  );
}

/* Anneau de progression (transition 280ms charte). */
export function Ring({ pct, size = 56, sw = 6, couleur = 'var(--bleu-digi)' }) {
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gris-300)" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={couleur}
          strokeWidth={sw}
          strokeLinecap="butt"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 280ms cubic-bezier(0.2,0.6,0.2,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center gap-0.5 font-titrage text-[15px] font-extrabold text-gris-900 dg-tnum">
        {pct}<span className="text-[13px]">%</span>
      </span>
    </div>
  );
}
