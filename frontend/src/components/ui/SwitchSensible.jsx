/* Interrupteur pour permission sensible — la page affiche une modale
   de confirmation à la coche. Props : { code, libelle, checked, onDemande }. */

export default function SwitchSensible({ code, libelle, checked, onDemande }) {
  return (
    <div className="flex items-start gap-esp-3 rounded-lg border border-erreur/30 bg-erreur-fond p-esp-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${libelle} (sensible)`}
        onClick={onDemande}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-pilule transition-colors duration-rapide ${checked ? 'bg-erreur' : 'bg-gris-300'}`}
      >
        <span aria-hidden="true" className={`absolute top-1 h-5 w-5 rounded-pilule bg-blanc shadow-ombre-1 transition-all duration-rapide ${checked ? 'left-6' : 'left-1'}`} />
      </button>
      <span className="min-w-0">
        <span className="block font-courant text-[15px] font-semibold text-gris-900">{libelle}</span>
        <span className="block font-mono text-[13px] text-erreur">{code} · sensible</span>
      </span>
    </div>
  );
}
