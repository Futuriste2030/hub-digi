import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Search, ArrowRight, CalendarClock, Bug } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import NouveauProjetModal from '../components/NouveauProjetModal.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_DEV, ROLES_DEV, peutVoir } from '../lib/acces.js';
import { creerProjet, listerProjets, listerBugs, supprimerProjet } from '../api/projets.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';

/* Projets Développement — API réelle (SPEC §5.4). */

const TYPES_LABEL = { site_web: 'Site web', app_web: 'App web', app_mobile: 'App mobile', autre: 'Autre' };
const TYPES_VALEUR = { 'Site web': 'site_web', 'App web': 'app_web', 'App mobile': 'app_mobile', Autre: 'autre' };
const STATUTS_LABEL = { a_faire: 'À faire', en_cours: 'En cours', en_review: 'En review', termine: 'Terminé', en_pause: 'En pause' };
const STATUTS_TON = { a_faire: 'neutre', en_cours: 'info', en_review: 'alerte', termine: 'succes', en_pause: 'neutre' };

const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};

export default function Projets() {
  const { notifier, session } = useOutletContext();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [modale, setModale] = useState(false);
  const [projets, setProjets] = useState([]);
  const [bugsParProjet, setBugsParProjet] = useState({});
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '') => {
    try {
      setChargement(true);
      const [ps, bugs, cls] = await Promise.all([
        listerProjets(q ? { search: q } : {}),
        listerBugs(),
        listerClients(),
      ]);
      setProjets(ps);
      const compteur = {};
      bugs.forEach((b) => { compteur[b.project] = (compteur[b.project] ?? 0) + 1; });
      setBugsParProjet(compteur);
      setClients(cls.results ?? cls);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des projets impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => charger(recherche.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const creer = async ({ nom, client, type, deadline }) => {
    const trouve = clients.find((c) => c.nom_societe === client);
    if (!trouve) {
      notifier({ type: 'info', titre: 'Client introuvable', texte: 'Sélectionnez un client existant.' });
      return;
    }
    try {
      const p = await creerProjet({ client: trouve.id, titre: nom, type: TYPES_VALEUR[type] ?? 'autre', deadline });
      setModale(false);
      notifier({ type: 'succes', titre: 'Projet créé', texte: `${p.titre} — ${trouve.nom_societe}.` });
      charger(recherche.trim());
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (p) => {
    try {
      await supprimerProjet(p.id);
      notifier({ type: 'succes', titre: 'Projet supprimé', texte: `${p.titre} — brouillon effacé.` });
      charger(recherche.trim());
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_DEV)) {
    return (
      <AccesRestreint
        titre="Projets réservés au Développement"
        requis="Seuls les membres du département Développement suivent les projets."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Développement étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_DEV);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Développement</p>
          <h1 className="mt-esp-2">Projets</h1>
        </div>
        {peutValider && (
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouveau projet
        </Button>
        )}
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un projet…"
          aria-label="Rechercher un projet"
          className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
        />
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {projets.map((p) => (
          <Card key={p.id} survol={false}>
            <CardHeader>
              <div className="flex items-center justify-between gap-esp-3">
                <h2 className="!text-[18px]">{p.titre}</h2>
                <span className="flex items-center gap-esp-1">
                  <Badge ton={STATUTS_TON[p.statut] ?? 'neutre'}>{STATUTS_LABEL[p.statut] ?? p.statut}</Badge>
                  {peutValider && (p.statut === 'a_faire' || p.statut === 'en_pause') && (
                    <BoutonSupprimer
                      titre={`Supprimer ${p.titre}`}
                      libelle={p.titre}
                      texte="Supprimer définitivement le projet brouillon"
                      onConfirmer={() => supprimer(p)}
                    />
                  )}
                </span>
              </div>
              <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{p.client_nom} · {TYPES_LABEL[p.type] ?? p.type}</p>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-esp-2">
                <span className="h-2 flex-1 overflow-hidden rounded-pilule bg-gris-200" role="progressbar" aria-valuenow={p.progression} aria-valuemin="0" aria-valuemax="100" aria-label={`Avancement ${p.progression} pour cent`}>
                  <span className="block h-full rounded-pilule" style={{ width: `${p.progression}%`, background: 'var(--degrade-bleu)' }} />
                </span>
                <span className="font-mono text-[13px] text-gris-600 dg-tnum">{p.progression} %</span>
              </div>
              <div className="mt-esp-3 flex flex-wrap items-center gap-x-esp-4 gap-y-esp-2 font-courant text-[15px] text-gris-600">
                <span className="inline-flex items-center gap-esp-2"><CalendarClock size={16} aria-hidden="true" />{dateFr(p.deadline)}</span>
                <span className="inline-flex items-center gap-esp-2 dg-tnum"><Bug size={16} aria-hidden="true" />{bugsParProjet[p.id] ?? 0} bug{(bugsParProjet[p.id] ?? 0) > 1 ? 's' : ''}</span>
                <button type="button" onClick={() => naviguer(`/projets/${p.id}`)} className="ml-auto inline-flex min-h-[44px] items-center gap-esp-1 font-semibold text-digi-texte">
                  Ouvrir <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      )}
      {!chargement && !erreur && projets.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">
          Aucun projet trouvé. Vérifiez l orthographe, puis relancez la recherche.
        </p>
      )}

      {modale && (
        <NouveauProjetModal
          clients={clients.map((c) => c.nom_societe)}
          onFermer={() => setModale(false)}
          onCreer={creer}
        />
      )}
    </div>
  );
}
