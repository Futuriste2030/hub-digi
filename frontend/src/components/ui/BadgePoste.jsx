import Badge from './Badge.jsx';

/* Badge de poste — catalogue (plein) vs personnalisé (outline + pastille + tooltip).
   Libellés toujours issus de src/data (postes.js ou posteLibre). */

export default function BadgePoste({ libelle, personnalise = false }) {
  if (!personnalise) return <Badge ton="neutre">{libelle}</Badge>;
  return (
    <span className="inline-flex items-center gap-esp-2">
      <span
        title="Poste personnalisé"
        className="inline-flex min-h-[24px] items-center rounded-pilule border border-digi px-esp-3 py-esp-1 font-courant text-[13px] font-semibold tracking-[0.04em] text-digi"
      >
        {libelle}
      </span>
      <span title="Poste personnalisé" aria-label="Poste personnalisé" className="h-2 w-2 rounded-pilule bg-digi" />
    </span>
  );
}
