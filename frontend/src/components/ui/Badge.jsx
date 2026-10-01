/* Badges charte §6 : pilule UNIQUEMENT pour badges/tags. */
const TONS = {
  info: 'bg-info-fond text-info',
  succes: 'bg-succes-fond text-succes',
  alerte: 'bg-alerte-fond text-alerte',
  erreur: 'bg-erreur-fond text-erreur',
  neutre: 'bg-gris-200 text-gris-700',
  marine: 'bg-marine text-blanc',
};

export default function Badge({ children, ton = 'neutre', className = '' }) {
  return (
    <span
      className={`inline-flex min-h-[24px] items-center rounded-pilule px-esp-3 py-esp-1 font-courant text-[13px] font-semibold tracking-[0.04em] ${TONS[ton]} ${className}`}
    >
      {children}
    </span>
  );
}
