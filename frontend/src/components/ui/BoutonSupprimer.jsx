import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import Button from './Button.jsx';

/* Icône suppression + modale de confirmation + messages via notifier parent.
   Usage : <BoutonSupprimer libelle="Moussa Koné" titre="Supprimer…" texte="…" onConfirmer={fn} /> */

export default function BoutonSupprimer({ libelle, titre, texte, onConfirmer }) {
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const confirmer = async () => {
    setEnvoi(true);
    try {
      await onConfirmer();
    } finally {
      setEnvoi(false);
      setOuvert(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={titre}
        title={titre}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-erreur hover:bg-erreur-fond"
      >
        <Trash2 size={20} aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={titre}>
          <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={() => !envoi && setOuvert(false)} />
          <div className="dg-pop relative w-full max-w-[440px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
            <div className="flex items-start justify-between gap-esp-3">
              <div>
                <p className="dg-surtitre">Suppression définitive</p>
                <h2 className="!text-[22px]">{titre}</h2>
              </div>
              <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-esp-3 font-courant text-[15px] text-gris-600">
              {texte} <strong className="font-semibold text-gris-900">{libelle}</strong> ?
              Cette action est irréversible et tracée.
            </p>
            <div className="mt-esp-6 flex justify-end gap-esp-3">
              <Button variante="fantome" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button variante="primaire" chargement={envoi} onClick={confirmer}>
                <Trash2 size={20} aria-hidden="true" /> Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
