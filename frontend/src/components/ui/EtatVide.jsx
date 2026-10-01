import { Inbox } from 'lucide-react';

/* État vide soigné — listes et onglets sans résultat. */

export default function EtatVide({ titre = 'Rien à afficher', texte = 'Aucun élément avec ces filtres.' }) {
  return (
    <div className="flex flex-col items-center px-esp-5 py-esp-9 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-pilule border border-gris-300 bg-gris-100 text-gris-500">
        <Inbox size={20} aria-hidden="true" />
      </span>
      <p className="mt-esp-3 font-courant text-[17px] font-semibold text-gris-900">{titre}</p>
      <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{texte}</p>
    </div>
  );
}
