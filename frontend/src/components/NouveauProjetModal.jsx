import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import Button from './ui/Button.jsx';
import { Label, Input } from './ui/Input.jsx';

/* Modale de création projet — rayon 14px, ombre-4, focus initial, Échap ferme.
   Types SPEC §5.4 (métiers Dév uniquement : pas de « Communication », gérée en campagnes). */
const TYPES = ['Site web', 'App web', 'App mobile', 'Autre'];

export default function NouveauProjetModal({ clients, onFermer, onCreer }) {
  const [client, setClient] = useState(clients[0] ?? '');
  const [nom, setNom] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [deadline, setDeadline] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const touche = (e) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  const soumettre = (e) => {
    e.preventDefault();
    if (nom.trim().length < 3) {
      setErreur('Indiquez un nom de projet d au moins 3 caractères.');
      return;
    }
    if (!deadline) {
      setErreur('Indiquez une deadline pour cadrer le périmètre.');
      return;
    }
    onCreer({ nom: nom.trim(), client, type, deadline });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau projet">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[560px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Développement</p>
            <h2 className="mt-esp-2 !text-[26px]">Nouveau projet</h2>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="np-client">Client</Label>
            <select
              id="np-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[17px] text-gris-700 focus:border-digi"
            >
              {clients.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="np-nom">Nom du projet</Label>
            <div className="mt-esp-2">
              <Input autoFocus id="np-nom" value={nom} onChange={(e) => { setNom(e.target.value); setErreur(''); }} placeholder="Ex. Site vitrine Sonatel" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="np-type">Type</Label>
              <select
                id="np-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[17px] text-gris-700 focus:border-digi"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="np-deadline">Deadline</Label>
              <div className="mt-esp-2">
                <Input id="np-deadline" type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); setErreur(''); }} />
              </div>
            </div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer le projet</Button>
        </div>
      </form>
    </div>
  );
}
