import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, X, Megaphone, Target, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_COM, ROLES_COM, peutVoir } from '../lib/acces.js';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { ChipsCanaux } from '../components/com/ChampsCom.jsx';
import { creerCampagne, listerCampagnes, majCampagne, supprimerCampagne } from '../api/ressources.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Campagnes — API réelle (SPEC §5.3 : canal, budget, objectifs, statut). */

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'terminee', label: 'Terminée' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { brouillon: 'neutre', en_cours: 'info', terminee: 'succes' };
const SUIVANT = { brouillon: 'en_cours', en_cours: 'terminee', terminee: 'terminee' };

function ModaleCampagne({ clients, onFermer, onCreer }) {
  const [form, setForm] = useState({ titre: '', client: clients[0]?.id ?? '', canaux: [], budget: '', objectif: '' });
  const [erreur, setErreur] = useState('');
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  const soumettre = (e) => {
    e.preventDefault();
    if (form.titre.trim().length < 3) {
      setErreur('Indiquez un nom de campagne d au moins 3 caractères.');
      return;
    }
    if (form.canaux.length === 0) {
      setErreur('Choisissez au moins un canal de diffusion.');
      return;
    }
    if (!(Number(form.budget) > 0)) {
      setErreur('Indiquez un budget valide en francs CFA.');
      return;
    }
    if (!form.client) {
      setErreur('Choisissez le client de la campagne.');
      return;
    }
    onCreer({ titre: form.titre.trim(), client: Number(form.client), canal: form.canaux.join(', '), budget: Number(form.budget), objectifs: form.objectif.trim() || 'À cadrer' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle campagne">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Communication</p>
            <h2 className="!text-[26px]">Nouvelle campagne</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="nc-nom">Nom</Label>
            <div className="mt-esp-2"><Input id="nc-nom" autoFocus {...champ('titre')} placeholder="Ex. Tabaski Connectée" /></div>
          </div>
          <div>
            <Label htmlFor="nc-client">Client</Label>
            <select id="nc-client" {...champ('client')} className={selectCls}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
            </select>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Canaux *</span>
            <div className="mt-esp-2">
              <ChipsCanaux selection={form.canaux} onToggle={(canaux) => { setForm((f) => ({ ...f, canaux })); setErreur(''); }} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nc-budget">Budget (F CFA)</Label>
              <div className="mt-esp-2"><Input id="nc-budget" inputMode="numeric" {...champ('budget')} placeholder="1500000" /></div>
            </div>
            <div>
              <Label htmlFor="nc-obj">Objectif</Label>
              <div className="mt-esp-2"><Input id="nc-obj" {...champ('objectif')} placeholder="Ex. 500 leads" /></div>
            </div>
          </div>
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

function CarteCampagne({ campagne, nomClient, onAvancer, onSupprimer, peutValider }) {
  const c = campagne;
  return (
    <Card survol={false}>
      <CardHeader>
        <div className="flex items-center justify-between gap-esp-3">
          <span className="flex min-w-0 items-center gap-esp-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
              <Megaphone size={20} aria-hidden="true" className="text-digi" />
            </span>
            <h2 className="truncate !text-[18px]">{c.titre}</h2>
          </span>
          <span className="flex items-center gap-esp-1">
            <Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{STATUT_LABEL[c.statut] ?? c.statut}</Badge>
            {peutValider && c.statut === 'brouillon' && (
              <BoutonSupprimer
                titre={`Supprimer ${c.titre}`}
                libelle={c.titre}
                texte="Supprimer définitivement la campagne brouillon"
                onConfirmer={() => onSupprimer(c)}
              />
            )}
          </span>
        </div>
        <p className="mt-esp-2 font-courant text-[15px] text-gris-600">{nomClient} · {c.canal || '—'}</p>
      </CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-x-esp-4 gap-y-esp-1 font-courant text-[15px] text-gris-600">
          <span className="dg-tnum">{fCFA(Number(c.budget ?? 0))}</span>
          <span className="inline-flex items-center gap-esp-2"><Target size={16} aria-hidden="true" />{c.objectifs || 'À cadrer'}</span>
        </div>
        {peutValider && c.statut !== 'terminee' && (
          <div className="mt-esp-3">
            <Button taille="sm" variante="secondaire" onClick={() => onAvancer(c)}>
              Passer à « {STATUT_LABEL[SUIVANT[c.statut]]} » <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function Campagnes() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('tous');
  const [modale, setModale] = useState(false);
  const [campagnes, setCampagnes] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', st = 'tous') => {
    try {
      const [cs, cls] = await Promise.all([
        listerCampagnes({ ...(q ? { search: q } : {}), ...(st !== 'tous' ? { statut: st } : {}) }),
        listerClients(),
      ]);
      const liste = cls.results ?? cls;
      setCampagnes(cs);
      setClients(liste);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des campagnes impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), statut), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, statut]);

  const creer = async (data) => {
    try {
      const c = await creerCampagne(data);
      setModale(false);
      notifier({ type: 'succes', titre: 'Campagne créée', texte: `${c.titre} — statut Brouillon.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const avancer = async (c) => {
    try {
      await majCampagne(c.id, { statut: SUIVANT[c.statut] });
      notifier({ type: 'succes', titre: 'Campagne actualisée', texte: `${c.titre} — ${STATUT_LABEL[SUIVANT[c.statut]]}.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Transition impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (c) => {
    try {
      await supprimerCampagne(c.id);
      notifier({ type: 'succes', titre: 'Campagne supprimée', texte: `${c.titre} — brouillon effacé.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_COM)) {
    return (
      <AccesRestreint
        titre="Campagnes réservées à la Communication"
        requis="Seuls les membres du département Communication suivent les campagnes."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Communication étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_COM);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Communication</p>
          <h1 className="mt-esp-2">Campagnes</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle campagne
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher une campagne" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {campagnes.map((c) => (
          <CarteCampagne key={c.id} campagne={c} nomClient={nomsClients[c.client] ?? ''} onAvancer={avancer} onSupprimer={supprimer} peutValider={peutValider} />
        ))}
      </div>
      )}
      {!chargement && !erreur && campagnes.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune campagne avec ces filtres.</p>
      )}

      {modale && <ModaleCampagne clients={clients} onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
