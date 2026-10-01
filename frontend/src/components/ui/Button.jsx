import { Loader2 } from 'lucide-react';

/* Boutons charte §6 : capitales Montserrat 15/700/0.06em, rayon 4px,
   cibles 44px min, survol assombrit 6-10 %, actif bleu profond + translate 1px.
   UN seul primaire par écran — à l'usage, pas forcé ici. */
const TAILLES = {
  sm: 'h-9 min-h-[36px] px-esp-4',
  md: 'h-11 min-h-[44px] px-esp-5',
  lg: 'h-[52px] min-h-[52px] px-esp-6',
};

const VARIANTES = {
  primaire:
    'bg-digi text-blanc shadow-ombre-1 hover:brightness-90 hover:shadow-ombre-bleue active:bg-digi-profond active:translate-y-px active:shadow-none',
  secondaire:
    'border border-digi text-digi bg-transparent hover:bg-digi-voile active:bg-digi-voile active:translate-y-px',
  fantome:
    'text-gris-700 bg-transparent hover:bg-gris-200 active:bg-gris-300 active:translate-y-px',
};

export default function Button({
  children,
  variante = 'primaire',
  taille = 'md',
  chargement = false,
  desactive = false,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      disabled={desactive || chargement}
      aria-busy={chargement}
      className={`inline-flex items-center justify-center gap-esp-2 rounded-md font-titrage text-[15px] font-bold uppercase leading-none tracking-[0.06em] transition-all duration-standard ease-[cubic-bezier(0.2,0.6,0.2,1)] disabled:cursor-not-allowed disabled:opacity-45 ${TAILLES[taille]} ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {chargement && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
      {chargement ? 'Envoi…' : children}
    </button>
  );
}
