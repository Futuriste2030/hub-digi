import { useEffect, useState } from 'react';
import { Play, Flag, X } from 'lucide-react';
import Button from './ui/Button.jsx';
import { Card, CardHeader, CardBody } from './ui/Card.jsx';
import Badge from './ui/Badge.jsx';
import { Input, Textarea, Label } from './ui/Input.jsx';
import { CourbeBurndown, BarresVelocite } from './Burndown.jsx';
import {
  listerSprints, creerSprint, demarrerSprint, terminerSprint, rapportSprint, velociteProjet,
} from '../api/projets.js';
import { messageErreur } from '../api/client.js';

const STATUT_TON = { planifie: 'neutre', actif: 'info', termine: 'succes' };
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const joursRestants = (fin) => {
  if (!fin) return '—';
  const n = Math.ceil((new Date(fin) - new Date()) / 86400000);
  return n < 0 ? 'dépassé' : `${n} j`;
};

/* Onglet Sprints d'un projet : liste, création, démarrer/terminer, burndown, vélocité. */
export default function SprintsTab({ projetId, peutEditer, notifier }) {
  const [sprints, setSprints] = useState([]);
  const [nom, setNom] = useState('');
  const [objectif, setObjectif] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [cloture, setCloture] = useState(null); // sprint à terminer : écran de clôture.
  const [cible, setCible] = useState('');
  const [rapports, setRapports] = useState({});
  const [velocite, setVelocite] = useState(null);

  const charger = async () => {
    try {
      const [ss, v] = await Promise.all([
        listerSprints({ project: projetId }), velociteProjet(projetId),
      ]);
      setSprints(ss);
      setVelocite(v);
    } catch (e) {
      notifier({ type: 'info', titre: 'Sprints indisponibles', texte: messageErreur(e) });
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projetId]);

  const chargerRapport = async (id) => {
    try {
      const rap = await rapportSprint(id);
      setRapports((p) => ({ ...p, [id]: rap }));
    } catch (e) {
      notifier({ type: 'info', titre: 'Rapport indisponible', texte: messageErreur(e) });
    }
  };

  const creer = async (e) => {
    e.preventDefault();
    if (nom.trim().length < 3 || !debut || !fin) {
      notifier({ type: 'info', titre: 'Sprint incomplet', texte: 'Nom (3 lettres min), début et fin requis.' });
      return;
    }
    try {
      await creerSprint({ project: projetId, nom: nom.trim(), objectif, date_debut: debut, date_fin: fin });
      setNom(''); setObjectif(''); setDebut(''); setFin('');
      charger();
      notifier({ type: 'succes', titre: 'Sprint créé', texte: 'Ajoutez-y des tâches depuis le backlog.' });
    } catch (err) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(err) });
    }
  };

  const demarrer = async (s) => {
    try {
      await demarrerSprint(s.id);
      charger();
      notifier({ type: 'succes', titre: 'Sprint démarré', texte: `${s.nom} : points engagés figés.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Démarrage impossible', texte: messageErreur(e) });
    }
  };

  const terminer = async () => {
    try {
      await terminerSprint(cloture.id, cible ? { sprint_cible: Number(cible) } : {});
      setCloture(null); setCible('');
      charger();
      notifier({ type: 'succes', titre: 'Sprint terminé', texte: 'Tâches ouvertes déplacées (autre sprint ou backlog).' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Clôture impossible', texte: messageErreur(e) });
    }
  };

  const actif = sprints.find((s) => s.statut === 'actif');
  const inputCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]';

  return (
    <div className="mt-esp-3 flex flex-col gap-esp-4">
      {actif && (
        <Card survol={false}>
          <CardBody>
            <p className="font-courant text-[15px] text-gris-700">
              <strong>{actif.nom}</strong> — {actif.objectif || 'sans objectif'} · {dateFr(actif.date_debut)} → {dateFr(actif.date_fin)} ·
              {' '}{joursRestants(actif.date_fin)} restants · {actif.taches_terminees}/{actif.taches_total} tâches · {actif.points_engages} pts engagés
            </p>
          </CardBody>
        </Card>
      )}
      {sprints.map((s) => {
        const rap = rapports[s.id];
        return (
          <Card key={s.id} survol={false}>
            <CardHeader>
              <span className="flex flex-wrap items-center gap-esp-2">
                <h3 className="!text-[18px]">{s.nom}</h3>
                <Badge ton={STATUT_TON[s.statut]}>{s.statut}</Badge>
                <span className="font-courant text-[13px] text-gris-600">{dateFr(s.date_debut)} → {dateFr(s.date_fin)} · {s.points_engages} pts engagés · {s.points_termines} pts terminés</span>
                {peutEditer && s.statut === 'planifie' && (
                  <Button taille="sm" variante="secondaire" onClick={() => demarrer(s)}><Play size={14} aria-hidden="true" /> Démarrer</Button>
                )}
                {peutEditer && s.statut !== 'termine' && (
                  <Button taille="sm" variante="fantome" onClick={() => setCloture(s)}><Flag size={14} aria-hidden="true" /> Terminer</Button>
                )}
                <Button taille="sm" variante="fantome" onClick={() => chargerRapport(s.id)}>Rapport</Button>
              </span>
            </CardHeader>
            {rap && (
              <CardBody className="flex flex-col gap-esp-3">
                <CourbeBurndown serie={rap.serie} />
                <p className="font-courant text-[13px] text-gris-600">
                  Engagés {rap.totaux.points_engages} · Terminés {rap.totaux.points_termines} · Tâches {rap.totaux.taches_terminees}/{rap.totaux.taches_total} ·
                  Ajoutés en cours {rap.totaux.points_ajoutes} · {rap.temps.heures_estimees} h estimées / {rap.temps.heures_passees} h passées
                </p>
              </CardBody>
            )}
          </Card>
        );
      })}
      {sprints.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun sprint. Créez le premier cycle ci-dessous.</p>}
      {velocite?.sprints?.length > 0 && (
        <Card survol={false}>
          <CardHeader><h3 className="!text-[18px]">Vélocité (moyenne {velocite.velocite_moyenne} pts)</h3></CardHeader>
          <CardBody><BarresVelocite sprints={velocite.sprints} /></CardBody>
        </Card>
      )}
      {peutEditer && (
        <Card survol={false}>
          <CardHeader><h3 className="!text-[18px]">Nouveau sprint</h3></CardHeader>
          <CardBody>
            <form onSubmit={creer} className="grid grid-cols-1 gap-esp-3 sm:grid-cols-2">
              <div><Label htmlFor="sp-nom">Nom</Label><div className="mt-esp-2"><Input id="sp-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Sprint 12" /></div></div>
              <div><Label htmlFor="sp-obj">Objectif</Label><div className="mt-esp-2"><Textarea id="sp-obj" value={objectif} onChange={(e) => setObjectif(e.target.value)} rows={1} placeholder="Ce que le sprint doit livrer" /></div></div>
              <div><Label htmlFor="sp-deb">Début</Label><input id="sp-deb" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputCls} /></div>
              <div><Label htmlFor="sp-fin">Fin</Label><input id="sp-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputCls} /></div>
              <div className="sm:col-span-2"><Button type="submit">Créer le sprint</Button></div>
            </form>
          </CardBody>
        </Card>
      )}
      {cloture && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Clôturer le sprint">
          <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={() => setCloture(null)} />
          <div className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
            <div className="flex items-start justify-between gap-esp-3">
              <div>
                <p className="dg-surtitre">Clôture</p>
                <h2 className="!text-[22px]">{cloture.nom} : {cloture.taches_total - cloture.taches_terminees} tâche(s) ouverte(s)</h2>
              </div>
              <button type="button" onClick={() => setCloture(null)} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-esp-3 font-courant text-[15px] text-gris-700">Où déplacer les tâches non terminées ? Par défaut : retour au backlog.</p>
            <select value={cible} onChange={(e) => setCible(e.target.value)} aria-label="Sprint de destination" className={`${inputCls} mt-esp-3`}>
              <option value="">Backlog (par défaut)</option>
              {sprints.filter((s) => s.id !== cloture.id && s.statut !== 'termine').map((s) => (
                <option key={s.id} value={s.id}>{s.nom} ({s.statut})</option>
              ))}
            </select>
            <div className="mt-esp-5 flex justify-end gap-esp-3">
              <Button variante="fantome" onClick={() => setCloture(null)}>Annuler</Button>
              <Button onClick={terminer}><Flag size={16} aria-hidden="true" /> Clôturer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
