/* Graphiques SVG sans dépendance (recharts non installé) : burndown + vélocité. */

function echelle(valeurs, h, marge = 8) {
  const max = Math.max(1, ...valeurs);
  return (v) => h - marge - (v / max) * (h - marge * 2);
}

export function CourbeBurndown({ serie }) {
  const L = 560, H = 220;
  if (!serie?.length) return <p className="font-courant text-[15px] text-gris-600">Aucune donnée (sprint sans jours ouvrés passés).</p>;
  const y = echelle([...serie.map((s) => s.restant_ideal), ...serie.map((s) => s.restant_reel)], H);
  const x = (i) => 34 + (i / Math.max(1, serie.length - 1)) * (L - 44);
  const ligne = (cle) => serie.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s[cle]).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Burndown : ligne idéale vs réelle" className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="34" x2={L - 10} y1={H * f} y2={H * f} stroke="#e2e2e2" strokeWidth="1" />
        ))}
        <path d={ligne('restant_ideal')} fill="none" stroke="#9aa5b1" strokeWidth="2" strokeDasharray="6 4" />
        <path d={ligne('restant_reel')} fill="none" stroke="#0b5fff" strokeWidth="2.5" />
        {serie.map((s, i) => (
          <circle key={s.date} cx={x(i)} cy={y(s.restant_reel)} r="3" fill="#0b5fff">
            <title>{s.date} : {s.restant_reel} restants (idéal {s.restant_ideal})</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-esp-1 flex gap-esp-4 font-courant text-[13px] text-gris-600">
        <span><span aria-hidden="true" className="mr-1 inline-block h-0.5 w-6 bg-digi align-middle" />Réel</span>
        <span><span aria-hidden="true" className="mr-1 inline-block h-0 w-6 border-t-2 border-dashed border-gris-400 align-middle" />Idéal</span>
      </figcaption>
    </figure>
  );
}

export function BarresVelocite({ sprints }) {
  const L = 560, H = 180;
  if (!sprints?.length) return <p className="font-courant text-[15px] text-gris-600">Terminez un sprint pour voir la vélocité.</p>;
  const max = Math.max(1, ...sprints.map((s) => s.points_engages), ...sprints.map((s) => s.points_termines));
  const w = (L - 34) / sprints.length;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Vélocité des derniers sprints" className="w-full">
      {sprints.map((s, i) => {
        const hE = (s.points_engages / max) * (H - 40);
        const hT = (s.points_termines / max) * (H - 40);
        const bx = 34 + i * w;
        return (
          <g key={s.sprint}>
            <rect x={bx + w * 0.15} y={H - 24 - hE} width={w * 0.3} height={hE} fill="#c9d6ea">
              <title>{s.nom} : {s.points_engages} engagés</title>
            </rect>
            <rect x={bx + w * 0.5} y={H - 24 - hT} width={w * 0.3} height={hT} fill="#0b5fff">
              <title>{s.nom} : {s.points_termines} terminés</title>
            </rect>
            <text x={bx + w / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="#555">{s.nom.slice(0, 10)}</text>
          </g>
        );
      })}
    </svg>
  );
}
