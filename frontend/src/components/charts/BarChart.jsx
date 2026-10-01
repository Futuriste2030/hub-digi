/* Bar chart SVG sans dépendance — tokens charte uniquement.
   data: [{ label, valeur }]. Hauteur 220px, grille gris-300, barres bleu Digi. */
export default function BarChart({ data, unite = 'M F' }) {
  const largeur = 560;
  const hauteur = 220;
  const margeBas = 32;
  const margeHaut = 12;
  const zone = hauteur - margeBas - margeHaut;
  const max = Math.max(...data.map((d) => d.valeur));
  const pas = largeur / data.length;
  const barre = Math.min(44, pas * 0.55);
  const paliers = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label="Chiffre d'affaires encaissé sur 6 mois" className="w-full">
      {paliers.map((p) => {
        const y = margeHaut + zone * (1 - p);
        return (
          <g key={p}>
            <line x1="0" y1={y} x2={largeur} y2={y} stroke="var(--gris-300)" strokeWidth="1" />
            <text x={largeur} y={y - 4} textAnchor="end" fontSize="13" fontFamily="Barlow, sans-serif" fill="var(--gris-500)">
              {(max * p).toFixed(1)} {unite}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = Math.max(4, (d.valeur / max) * zone);
        const x = i * pas + (pas - barre) / 2;
        const y = margeHaut + zone - h;
        return (
          <g key={d.label}>
            <title>{`${d.label} : ${d.valeur} ${unite}`}</title>
            <rect x={x} y={y} width={barre} height={h} rx="4" fill="var(--bleu-digi)" opacity={i === data.length - 1 ? 1 : 0.65} />
            <text x={x + barre / 2} y={hauteur - 8} textAnchor="middle" fontSize="13" fontFamily="Barlow, sans-serif" fill="var(--gris-600)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
