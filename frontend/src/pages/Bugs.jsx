import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Bug, ArrowRight, Wrench, Plus, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_DEV, peutVoir } from '../lib/acces.js';
import { Label, Input } from '../components/ui/Input.jsx';
import { convertirBug, creerBug, listerBugs, listerProjets, majBug } from '../api/bugs.js';
import { messageErreur } from '../api/client.js';

/* Bugs Développement — API réelle (tracker.js + manuel) + conversion Kanban. */

const GRAVITES = [
  { id: 'toutes', label: 'Toutes' },
  { id: 'critique', label: 'Critique' },
  { id: 'haute', label: 'Haute' },
  { id: 'moyenne', label: 'Moyenne' },
  { id: 'basse', label: 'Basse' },
];
const GRAVITE_LABEL = { critique: 'Critique', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };
const GRAVITE_TON = { critique: 'erreur', haute: 'alerte', moyenne: 'info', basse: 'neutre' };
const STATUTS = [
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'confirme', label: 'Confirmé' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'corrige', label: 'Corrigé' },
  { id: 'rejete', label: 'Rejeté' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const SOURCES = ['Toutes', 'Tracker auto', 'Manuel'];

function ModaleBug({ projets, onFermer, onCreer }) {
  const [projetId, setProjetId] = useState(projets[0]?.id ?? '');
  const [titre, setTitre] = useState('');
  const [gravite, setGravite] = useState('moyenne');
  const [erreur, setErreur] = useState('');
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  const soumettre = (e) => {
    e.preventDefault();
    if (titre.trim().length < 5) {
      setErreur('Décrivez le bug en au moins 5 caractères.');
      return;
    }
    onCreer({ projetId, titre: titre.trim(), gravite });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Signaler un bug">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Développement · source Manuelle</p>
            <h2 className="!text-[26px]">Signaler un bug</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="bg-projet">Projet</Label>
            <select id="bg-projet" value={projetId} onChange={(e) => setProjetId(e.target.value)} className={selectCls}>
              {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="bg-titre">Description</Label>
            <div className="mt-esp-2"><Input id="bg-titre" autoFocus value={titre} onChange={(e) => { setTitre(e.target.value); setErreur(''); }} placeholder="Ex. Erreur 500 page paiement" /></div>
          </div>
          <div>
            <Label htmlFor="bg-grav">Gravité</Label>
            <select id="bg-grav" value={gravite} onChange={(e) => setGravite(e.target.value)} className={selectCls}>
              {GRAVITES.filter((g) => g.id !== 'toutes').map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Signaler</Button>
        </div>
      </form>
    </div>
  );
}

const sourceDe = (b) => (b.meta?.url ? 'Tracker auto' : 'Manuel');

export default function Bugs() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [gravite, setGravite] = useState('toutes');
  const [statut, setStatut] = useState('tous');
  const [source, setSource] = useState('Toutes');
  const [modale, setModale] = useState(false);
  const [bugs, setBugs] = useState([]);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    try {
      const [bs, ps] = await Promise.all([listerBugs(), listerProjets()]);
      setBugs(bs);
      setProjets(ps);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des bugs impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const titresProjets = Object.fromEntries(projets.map((p) => [p.id, p.titre]));
  const q = recherche.trim().toLowerCase();
  const visibles = bugs.filter(
    (b) =>
      (gravite === 'toutes' || b.gravite === gravite) &&
      (statut === 'tous' || b.statut === statut) &&
      (source === 'Toutes' || sourceDe(b) === source) &&
      (q === '' || b.titre.toLowerCase().includes(q) || b.numero.toLowerCase().includes(q)),
  );

  const signaler = async ({ projetId, titre, gravite: g }) => {
    try {
      const b = await creerBug({ project: projetId, titre, gravite: g, description: '' });
      setBugs((prev) => [b, ...prev]);
      setModale(false);
      notifier({ type: 'succes', titre: 'Bug signalé', texte: `${b.numero} — source Manuelle.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Signalement impossible', texte: messageErreur(e) });
    }
  };

  const avancer = async (b) => {
    const ids = STATUTS.map((s) => s.id);
    const suivant = ids[Math.min(ids.length - 1, ids.indexOf(b.statut) + 1)];
    if (suivant === b.statut) return;
    try {
      const maj = await majBug(b.id, { statut: suivant });
      setBugs((prev) => prev.map((x) => (x.id === b.id ? maj : x)));
      notifier({ type: 'info', titre: 'Bug mis à jour', texte: `${b.numero} passe au statut ${STATUT_LABEL[suivant]}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Mise à jour impossible', texte: messageErreur(e) });
    }
  };

  const convertir = async (b) => {
    try {
      const maj = await convertirBug(b.id);
      setBugs((prev) => prev.map((x) => (x.id === b.id ? maj : x)));
      notifier({ type: 'succes', titre: 'Converti en tâche', texte: `${b.numero} rejoint le Kanban.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Conversion impossible', texte: messageErreur(e) });
    }
  };

  const selectCls = 'h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  if (!peutVoir(session, ROLES_DEV)) {
    return (
      <AccesRestreint
        titre="Bugs réservés au Développement"
        requis="Seuls les membres du département Développement suivent les bugs."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Développement étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-esp-4">
          <div>
            <p className="dg-surtitre">Développement</p>
            <h1 className="mt-esp-2">Bugs</h1>
            <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
              « Tracker auto » = remontée du tracker.js posé sur le site client (erreur JS captée).
              « Manuel » = signalé par le widget du site, l équipe ou le client. Convertissez en tâche Kanban d un clic.
            </p>
          </div>
          <Button onClick={() => setModale(true)}>
            <Plus size={20} aria-hidden="true" /> Signaler un bug
          </Button>
        </div>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un bug…"
            aria-label="Rechercher un bug"
            className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
          />
        </div>
        <select value={gravite} onChange={(e) => setGravite(e.target.value)} aria-label="Filtrer par gravité" className={selectCls}>
          {GRAVITES.map((g) => <option key={g.id} value={g.id}>{g.id === 'toutes' ? 'Toutes' : g.label}</option>)}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className={selectCls}>
          <option value="tous">Tous</option>
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filtrer par source" className={selectCls}>
          {SOURCES.map((s) => <option key={s}>{s === 'Toutes' ? 'Toutes sources' : s}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="flex flex-col gap-esp-3 pt-esp-5">
          {chargement ? (
            <p className="text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : visibles.length === 0 ? (
            <p className="text-center font-courant text-[15px] text-gris-600">
              Aucun bug avec ces filtres. Élargissez la recherche.
            </p>
          ) : visibles.map((b) => (
            <div key={b.numero} className="flex flex-wrap items-start gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
              <Bug size={20} aria-hidden="true" className="mt-esp-1 shrink-0 text-digi" />
              <div className="min-w-52 flex-1">
                <p className="font-mono text-[13px] text-gris-600">{b.numero}</p>
                <p className="font-courant text-[15px] font-semibold text-gris-900">{b.titre}</p>
                <p className="font-courant text-[15px] text-gris-600">{titresProjets[b.project] ?? ''}</p>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-esp-1">
                <Badge ton={GRAVITE_TON[b.gravite] ?? 'neutre'}>{GRAVITE_LABEL[b.gravite] ?? b.gravite}</Badge>
                <Badge ton="neutre">{STATUT_LABEL[b.statut] ?? b.statut}</Badge>
                <Badge ton={sourceDe(b) === 'Manuel' ? 'info' : 'neutre'}>{sourceDe(b)}</Badge>
              </span>
              <span className="flex w-full flex-wrap gap-esp-2 border-t border-gris-200 pt-esp-2 sm:w-auto sm:border-0 sm:pt-0">
                {b.tache ? (
                  <Badge ton="succes">Tâche créée</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => convertir(b)}
                    className="inline-flex min-h-[44px] items-center gap-esp-2 rounded-md bg-digi px-esp-3 font-courant text-[15px] font-semibold text-blanc shadow-ombre-1 transition-colors duration-rapide hover:brightness-90"
                  >
                    <Wrench size={16} aria-hidden="true" /> Convertir en tâche
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => avancer(b)}
                  disabled={b.statut === 'corrige' || b.statut === 'rejete'}
                  className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 transition-colors duration-rapide hover:bg-gris-200 disabled:opacity-45"
                >
                  Avancer <ArrowRight size={16} aria-hidden="true" />
                </button>
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {modale && <ModaleBug projets={projets} onFermer={() => setModale(false)} onCreer={signaler} />}
    </div>
  );
}
