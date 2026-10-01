import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { compteurModule } from '../../lib/permissions.js';

/* Accordéon de permissions par module — compteur « 6/9 » en en-tête,
   point coloré + tooltip sur toute case modifiée à la main (« ajusté »).
   Props : { modules, codesParModule: {module: [codes]},
             meta: {code: permission}, effectives: Set|[],
             ajuste: (code) => bool, onToggle: (code) => void } */

export default function AccordeonPermissions({ modules, codesParModule, meta, effectives, ajuste, onToggle }) {
  const set = new Set(effectives);
  const [ouverts, setOuverts] = useState(() => (modules[0] ? [modules[0].id] : []));

  const basculer = (id) => setOuverts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="flex flex-col gap-esp-2">
      {modules.map((m) => {
        const codes = codesParModule[m.id] ?? [];
        const ouvert = ouverts.includes(m.id);
        return (
          <div key={m.id} className="overflow-hidden rounded-lg border border-gris-300 bg-gris-0">
            <button
              type="button"
              onClick={() => basculer(m.id)}
              aria-expanded={ouvert}
              className="flex min-h-[44px] w-full items-center gap-esp-3 px-esp-4 py-esp-3 text-left hover:bg-gris-100"
            >
              <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-gris-500 transition-transform duration-standard ${ouvert ? 'rotate-180' : ''}`} />
              <span className="flex-1 font-courant text-[17px] font-semibold text-gris-900">{m.libelle}</span>
              <span className="font-mono text-[13px] text-gris-600 dg-tnum">{compteurModule(codes, set)}</span>
            </button>
            {ouvert && (
              <ul className="flex flex-col gap-esp-1 border-t border-gris-200 p-esp-3">
                {codes.map((code) => {
                  const p = meta[code];
                  const coche = set.has(code);
                  const marque = ajuste(code);
                  return (
                    <li key={code}>
                      <label className="flex cursor-pointer items-start gap-esp-3 rounded-md px-esp-2 py-esp-2 hover:bg-gris-100">
                        <input
                          type="checkbox"
                          checked={coche}
                          onChange={() => onToggle(code)}
                          className="mt-1 h-5 w-5 shrink-0 accent-[#2F7CBE]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-esp-2 font-courant text-[15px] font-semibold text-gris-900">
                            {p?.libelle ?? code}
                            {marque && (
                              <span title="Ajusté manuellement (écart au niveau)" aria-label="Ajusté manuellement" className="h-2 w-2 shrink-0 rounded-pilule bg-alerte" />
                            )}
                          </span>
                          <span className="block font-mono text-[13px] text-gris-500">{code}</span>
                          {p?.description && <span className="block font-courant text-[14px] text-gris-600">{p.description}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
