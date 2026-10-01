/* Stepper — étapes numérotées, horizontal desktop / vertical mobile.
   Props : { etapes: [libellés], courant: index 0-based }. */

export default function Stepper({ etapes, courant }) {
  return (
    <ol className="flex flex-col gap-esp-2 sm:flex-row sm:items-center" aria-label="Progression">
      {etapes.map((lb, i) => {
        const etat = i < courant ? 'faite' : i === courant ? 'courante' : 'à venir';
        return (
          <li key={lb} className="flex flex-1 items-center gap-esp-2" aria-current={i === courant ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pilule font-titrage text-[15px] font-bold dg-tnum ${
                i < courant ? 'bg-succes text-blanc' : i === courant ? 'text-blanc' : 'bg-gris-200 text-gris-500'
              }`}
              style={i === courant ? { background: 'var(--degrade-bleu)' } : undefined}
            >
              {i < courant ? '✓' : i + 1}
            </span>
            <span className={`font-courant text-[15px] ${i === courant ? 'font-semibold text-gris-900' : 'text-gris-600'}`}>
              {lb}
              <span className="sr-only"> — {etat}</span>
            </span>
            {i < etapes.length - 1 && (
              <span aria-hidden="true" className="mx-esp-1 hidden h-px flex-1 bg-gris-300 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
