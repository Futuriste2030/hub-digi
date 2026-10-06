import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import ModaleTache from '../components/ModaleTache.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_DEV, ROLES_DEV, peutVoir } from '../lib/acces.js';
import { PRIORITE_LABEL, PRIORITE_TON, estimationTexte } from '../lib/taches.js';
import { creerTache, listerProjets, listerTaches, majTache, supprimerTache } from '../api/projets.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { messageErreur } from '../api/client.js';

/* Kanban global Développement — API réelle, tous projets confondus. */

const COLONNES = [
  { id: 'a_faire', libelle: 'À faire' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'review', libelle: 'Review' },
  { id: 'done', libelle: 'Done' },
];
const ORDRE = COLONNES.map((s) => s.id);
const initiales = (email) => String(email ?? '').split(/[@.]/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

export default function Taches() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [projet, setProjet] = useState('tous');
  const [modale, setModale] = useState(false);
  const [taches, setTaches] = useState([]);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    try {
      const [ts, ps] = await Promise.all([listerTaches(), listerProjets()]);
      setTaches(ts);
      setProjets(ps);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des tâches impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const titresProjets = Object.fromEntries(projets.map((p) => [p.id, p.titre]));
  const q = recherche.trim().toLowerCase();
  const visibles = taches.filter(
    (t) =>
      (projet === 'tous' || String(t.project) === String(projet)) &&
      (q === '' || t.titre.toLowerCase().includes(q) || (t.reference ?? '').toLowerCase().includes(q) || (titresProjets[t.project] ?? '').toLowerCase().includes(q)),
  );

  const deplacer = async (tache, dir) => {
    const i = ORDRE.indexOf(tache.statut);
    const j = Math.max(0, Math.min(ORDRE.length - 1, i + dir));
    if (i === j) return;
    try {
      const maj = await majTache(tache.id, { statut: ORDRE[j] });
      setTaches((prev) => prev.map((t) => (t.id === tache.id ? maj : t)));
    } catch (e) {
      notifier({ type: 'info', titre: 'Déplacement impossible', texte: messageErreur(e) });
    }
  };

  const creer = async ({ projetId, titre, statut, priorite, estimation_points, estimation_heures }) => {
    try {
      const payload = { project: projetId, titre, statut };
      if (peutSupprimer) {
        if (priorite) payload.priorite = priorite;
        if (estimation_points !== undefined) payload.estimation_points = estimation_points;
        if (estimation_heures !== undefined) payload.estimation_heures = estimation_heures;
      }
      const t = await creerTache(payload);
      setTaches((prev) => [t, ...prev]);
      setModale(false);
      notifier({ type: 'succes', titre: 'Tâche créée', texte: `${t.titre}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (t) => {
    try {
      await supprimerTache(t.id);
      setTaches((prev) => prev.filter((x) => x.id !== t.id));
      notifier({ type: 'succes', titre: 'Tâche supprimée', texte: `${t.titre} — retirée du Kanban.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ROLES_CHEF_DEV);

  if (!peutVoir(session, ROLES_DEV)) {
    return (
      <AccesRestreint
        titre="Tâches réservées au Développement"
        requis="Seuls les membres du département Développement suivent le Kanban."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Développement étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Développement</p>
          <h1 className="mt-esp-2">Tâches Kanban</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle tâche
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une tâche…"
            aria-label="Rechercher une tâche"
            className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
          />
        </div>
        <select
          value={projet}
          onChange={(e) => setProjet(e.target.value)}
          aria-label="Filtrer par projet"
          className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi sm:max-w-96"
        >
          <option value="tous">Tous les projets</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
        </select>
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 md:grid-cols-2 xl:grid-cols-4">
        {COLONNES.map((col) => {
          const items = visibles.filter((t) => t.statut === col.id);
          return (
            <section key={col.id} aria-label={col.libelle} className="flex flex-col gap-esp-3 rounded-lg bg-gris-200/60 p-esp-3">
              <header className="flex items-center justify-between px-esp-1">
                <h2 className="font-titrage text-[13px] font-bold uppercase tracking-[0.06em] text-gris-700">{col.libelle}</h2>
                <Badge ton="neutre">{items.length}</Badge>
              </header>
              {items.map((t) => (
                <article key={t.id} className="rounded-lg border border-gris-300 bg-gris-0 p-esp-3 shadow-ombre-1">
                  <p className="font-mono text-[12px] text-gris-500">{t.reference}</p>
                  <p className="font-courant text-[15px] font-semibold text-gris-900">{t.titre}</p>
                  <p className="mt-esp-1 font-courant text-[13px] text-digi-texte">{titresProjets[t.project] ?? ''}</p>
                  <div className="mt-esp-1 flex flex-wrap gap-esp-1">
                    <Badge ton={PRIORITE_TON[t.priorite] ?? 'neutre'}>{PRIORITE_LABEL[t.priorite] ?? t.priorite}</Badge>
                    <Badge ton="neutre">{t.estimation_points ?? '—'} pts</Badge>
                  </div>
                  <p className="mt-esp-1 font-courant text-[13px] text-gris-600 dg-tnum">{estimationTexte(t)}</p>
                  <div className="mt-esp-2 flex items-center gap-esp-2">
                    <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-pilule bg-digi-voile font-courant text-[13px] font-bold text-digi">
                      {initiales(t.assigne_email)}
                    </span>
                    <span className="truncate font-courant text-[13px] text-gris-600">{t.assigne_email ?? 'Non assignée'}</span>
                  </div>
                  <div className="mt-esp-2 flex items-center justify-between border-t border-gris-200 pt-esp-2">
                    <button type="button" onClick={() => deplacer(t, -1)} disabled={col.id === ORDRE[0]} aria-label={`Reculer ${t.titre}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200 disabled:opacity-45">
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    {peutSupprimer && t.statut !== 'done' && (
                      <BoutonSupprimer
                        titre={`Supprimer ${t.titre}`}
                        libelle={t.titre}
                        texte="Supprimer définitivement la tâche"
                        onConfirmer={() => supprimer(t)}
                      />
                    )}
                    <button type="button" onClick={() => deplacer(t, 1)} disabled={col.id === ORDRE[ORDRE.length - 1]} aria-label={`Avancer ${t.titre}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200 disabled:opacity-45">
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-gris-300 px-esp-3 py-esp-4 text-center font-courant text-[13px] text-gris-500">Colonne vide</p>
              )}
            </section>
          );
        })}
      </div>
      )}

      {modale && <ModaleTache projets={projets.map((p) => ({ id: p.id, nom: p.titre, client: p.client_nom }))} colonnes={COLONNES} onFermer={() => setModale(false)} onCreer={creer} estimationLectureSeule={!peutSupprimer} />}
    </div>
  );
}
