import { Info, CircleCheck, TriangleAlert, CircleX } from 'lucide-react';

/* Alertes charte §6 : icône + titre coloré + texte courant, fonds fonctionnels. */
const CONFIG = {
  info: { Icone: Info, titre: 'text-info', fond: 'bg-info-fond' },
  succes: { Icone: CircleCheck, titre: 'text-succes', fond: 'bg-succes-fond' },
  alerte: { Icone: TriangleAlert, titre: 'text-alerte', fond: 'bg-alerte-fond' },
  erreur: { Icone: CircleX, titre: 'text-erreur', fond: 'bg-erreur-fond' },
};

export default function Alert({ ton = 'info', titre, children }) {
  const { Icone, ...c } = CONFIG[ton];
  return (
    <div role="alert" className={`flex gap-esp-3 rounded-lg p-esp-4 ${c.fond}`}>
      <Icone size={24} aria-hidden="true" className={c.titre} />
      <div>
        {titre && <p className={`font-courant text-[17px] font-semibold ${c.titre}`}>{titre}</p>}
        <div className="font-courant text-[17px] leading-[1.65] text-gris-700">{children}</div>
      </div>
    </div>
  );
}
