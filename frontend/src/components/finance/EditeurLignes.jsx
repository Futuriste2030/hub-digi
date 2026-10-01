import { Plus, Trash2 } from 'lucide-react';
import { fCFA } from '../../utils/stats.js';

/* Éditeur de lignes de chiffrage — réutilisé par devis et facture manuelle. */

export default function EditeurLignes({ lignes, onChanger }) {
  const maj = (i, patch) => onChanger(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lignes.reduce((s, l) => s + (Number(l.montant) || 0) * (Number(l.quantite) || 0), 0);

  return (
    <div>
      <div className="flex flex-col gap-esp-2">
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_72px_120px_44px] items-center gap-esp-2">
            <input
              value={l.description}
              onChange={(e) => maj(i, { description: e.target.value })}
              placeholder={`Ligne ${i + 1} — description`}
              aria-label={`Ligne ${i + 1} description`}
              className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
            />
            <input
              type="number"
              min="1"
              value={l.quantite}
              onChange={(e) => maj(i, { quantite: e.target.value })}
              aria-label={`Ligne ${i + 1} quantité`}
              className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-2 font-courant text-[15px] text-gris-700 dg-tnum focus:border-digi"
            />
            <input
              type="number"
              min="0"
              value={l.montant}
              onChange={(e) => maj(i, { montant: e.target.value })}
              placeholder="Montant"
              aria-label={`Ligne ${i + 1} montant`}
              className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-2 font-courant text-[15px] text-gris-700 dg-tnum focus:border-digi"
            />
            <button
              type="button"
              onClick={() => onChanger(lignes.filter((_, j) => j !== i))}
              disabled={lignes.length === 1}
              aria-label={`Supprimer la ligne ${i + 1}`}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-erreur hover:bg-erreur-fond disabled:opacity-45"
            >
              <Trash2 size={20} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-esp-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChanger([...lignes, { description: '', quantite: 1, montant: '' }])}
          className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte"
        >
          <Plus size={16} aria-hidden="true" /> Ajouter une ligne
        </button>
        <p className="font-titrage text-[18px] font-bold text-gris-900 dg-tnum whitespace-nowrap">Total : {fCFA(total)}</p>
      </div>
    </div>
  );
}
