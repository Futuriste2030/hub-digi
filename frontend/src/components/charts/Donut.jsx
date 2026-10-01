import { useState } from 'react';

/* Donut SVG interactif : survol = segment épaissi + centre détaillé.
   data: [{ label, valeur, couleur (var(--…)) }]. */
export default function Donut({ data, taille = 180, epaisseur = 26 }) {
  const [survol, setSurvol] = useState(null);
  const total = data.reduce((s, d) => s + d.valeur, 0);
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const actif = survol != null ? data[survol] : null;
  /* Offsets cumulés pré-calculés sans mutation (reduce pur). */
  const segments = data.map((d, i) => {
    const avant = data.slice(0, i).reduce((s, x) => s + x.valeur, 0);
    const part = total > 0 ? d.valeur / total : 0;
    return { ...d, part, offset: total > 0 ? avant / total : 0 };
  });

  return (
    <div className="flex flex-wrap items-center gap-esp-5">
      <div className="relative" onMouseLeave={() => setSurvol(null)}>
        <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label="Répartition des projets">
          <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke="var(--gris-200)" strokeWidth={epaisseur} />
          {segments.map((d, i) => {
            const el = (
              <circle
                key={d.label}
                cx={taille / 2}
                cy={taille / 2}
                r={rayon}
                fill="none"
                stroke={d.couleur}
                strokeWidth={survol === i ? epaisseur + 8 : epaisseur}
                strokeDasharray={`${Math.max(0, d.part * circonference - 3)} ${circonference}`}
                strokeDashoffset={-d.offset * circonference}
                transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
                strokeLinecap="butt"
                opacity={survol == null || survol === i ? 1 : 0.35}
                onMouseEnter={() => setSurvol(i)}
                style={{ transition: 'stroke-width 180ms cubic-bezier(0.2,0.6,0.2,1), opacity 180ms', cursor: 'pointer' }}
              >
                <title>{`${d.label} : ${d.valeur}`}</title>
              </circle>
            );
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          {actif ? (
            <div key={actif.label} className="dg-pop">
              <p className="font-titrage text-[26px] font-bold leading-none text-gris-900 dg-tnum">{actif.valeur}</p>
              <p className="mt-esp-1 px-esp-2 font-courant text-[13px] text-gris-600">{actif.label}</p>
            </div>
          ) : (
            <div>
              <p className="font-titrage text-[26px] font-bold leading-none text-gris-900 dg-tnum">{total}</p>
              <p className="mt-esp-1 font-courant text-[13px] text-gris-600">projets</p>
            </div>
          )}
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-esp-1" onMouseLeave={() => setSurvol(null)}>
        {data.map((d, i) => (
          <li key={d.label}>
            <button
              type="button"
              onMouseEnter={() => setSurvol(i)}
              onFocus={() => setSurvol(i)}
              className={`flex w-full items-center gap-esp-2 rounded-md px-esp-2 py-esp-2 text-left font-courant text-[15px] transition-colors duration-rapide ${survol === i ? 'bg-gris-100' : ''}`}
            >
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: d.couleur }} />
              <span className="text-gris-700">{d.label}</span>
              <span className="ml-auto font-mono text-[13px] text-gris-600 dg-tnum">{d.valeur}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
