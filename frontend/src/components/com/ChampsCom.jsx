import { CANAUX, ESPACES, AGENCE } from '../../data/com.js';
import { CLIENTS } from '../../data/clients.js';

/* Contrôles partagés Communication : chips multi-canal, filtre d'espace, options clients. */

export function optionsClients() {
  return [...CLIENTS.map((c) => c.societe), AGENCE];
}

export function ChipsCanaux({ selection, onToggle }) {
  const basculer = (canal) => {
    onToggle(selection.includes(canal) ? selection.filter((c) => c !== canal) : [...selection, canal]);
  };
  return (
    <div className="flex flex-wrap gap-esp-2" role="group" aria-label="Canaux de diffusion">
      {CANAUX.map((canal) => {
        const actif = selection.includes(canal);
        return (
          <button
            key={canal}
            type="button"
            aria-pressed={actif}
            onClick={() => basculer(canal)}
            className={`min-h-[44px] rounded-pilule border px-esp-4 font-courant text-[15px] font-semibold transition-colors duration-rapide ${
              actif ? 'border-digi bg-digi text-blanc' : 'border-gris-300 text-gris-600 hover:text-gris-900'
            }`}
          >
            {canal}
          </button>
        );
      })}
    </div>
  );
}

export function FiltreEspace({ espace, onChanger }) {
  return (
    <div className="flex rounded-md border border-gris-300 bg-gris-100 p-0.5" role="group" aria-label="Espace de travail">
      {ESPACES.map((e) => (
        <button
          key={e}
          type="button"
          aria-pressed={espace === e}
          onClick={() => onChanger(e)}
          className={`min-h-[36px] flex-1 whitespace-nowrap rounded-sm px-esp-3 font-courant text-[15px] font-semibold transition-colors duration-rapide ${
            espace === e ? 'bg-marine-profond text-blanc' : 'text-gris-600 hover:text-gris-900'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
