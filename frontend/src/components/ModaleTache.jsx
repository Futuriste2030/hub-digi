import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Button from './ui/Button.jsx';
import { Label, Input } from './ui/Input.jsx';

export const PRIORITES_TACHE = [
  { id: 'basse', label: 'Basse' },
  { id: 'normale', label: 'Normale' },
  { id: 'haute', label: 'Haute' },
  { id: 'critique', label: 'Critique' },
];

/* Modale de création de tâche — projet imposé (projetFixe) ou sélectionnable.
   Estimation + priorité désactivées pour membre_dev (lecture seule, 403 API). */
export default function ModaleTache({ projets, projetFixe, colonnes, onFermer, onCreer, estimationLectureSeule }) {
  const [projetId, setProjetId] = useState(projetFixe ?? projets[0]?.id ?? '');
  const [titre, setTitre] = useState('');
  const [colonne, setColonne] = useState(colonnes[0].id);
  const [priorite, setPriorite] = useState('normale');
  const [points, setPoints] = useState('');
  const [heures, setHeures] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (titre.trim().length < 3) {
      setErreur('Indiquez un titre d au moins 3 caractères.');
      return;
    }
    if (!projetId) {
      setErreur('Choisissez le projet de la tâche.');
      return;
    }
    const payload = { projetId, titre: titre.trim(), statut: colonne };
    if (!estimationLectureSeule) {
      payload.priorite = priorite;
      if (points !== '') payload.estimation_points = Number(points);
      if (heures !== '') payload.estimation_heures = Number(heures);
    }
    onCreer(payload);
  };

  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle tâche">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Kanban</p>
            <h2 className="!text-[26px]">Nouvelle tâche</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          {!projetFixe && (
            <div>
              <Label htmlFor="nt-projet">Projet</Label>
              <select id="nt-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} className={selectCls}>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.nom} · {p.client}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="nt-titre">Titre</Label>
            <div className="mt-esp-2"><Input id="nt-titre" autoFocus value={titre} onChange={(e) => { setTitre(e.target.value); setErreur(''); }} placeholder="Ex. Corriger le tunnel de devis" /></div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nt-colonne">Colonne</Label>
              <select id="nt-colonne" value={colonne} onChange={(e) => setColonne(e.target.value)} className={selectCls}>
                {colonnes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="nt-prio">Priorité</Label>
              <select id="nt-prio" value={priorite} onChange={(e) => setPriorite(e.target.value)} className={selectCls} disabled={estimationLectureSeule} title={estimationLectureSeule ? 'Réservé au Chef Développement' : undefined}>
                {PRIORITES_TACHE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="nt-points">Estimation (points : 1, 2, 3, 5, 8, 13)</Label>
              <div className="mt-esp-2"><Input id="nt-points" type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Ex. 5" disabled={estimationLectureSeule} /></div>
            </div>
            <div>
              <Label htmlFor="nt-heures">Estimation (heures)</Label>
              <div className="mt-esp-2"><Input id="nt-heures" type="number" min="0" step="0.5" value={heures} onChange={(e) => setHeures(e.target.value)} placeholder="Ex. 4" disabled={estimationLectureSeule} /></div>
            </div>
          </div>
          {estimationLectureSeule && <p className="font-courant text-[13px] text-gris-600">Estimation et priorité : réservées au Chef Développement.</p>}
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer</Button>
        </div>
      </form>
    </div>
  );
}
