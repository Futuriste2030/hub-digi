import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Briefcase, UserCheck, UserX, CalendarClock, Globe, X } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import Button from '../components/ui/Button.jsx';
import { ROLES_CHEF_RH, ROLES_RH, peutVoir } from '../lib/acces.js';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Textarea } from '../components/ui/Input.jsx';
import { listerCandidatures, statuerCandidature, supprimerCandidature } from '../api/ressources.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { messageErreur } from '../api/client.js';

/* Recrutement — API réelle (SPEC §5.5 + WEBHOOK-CARRIERE.md : reçoit du site, statue côté HUB). */

const STATUT_LABEL = { recue: 'Reçue', entretien: 'Entretien', retenue: 'Retenue', rejetee: 'Rejetée' };
const STATUT_TON = { recue: 'info', entretien: 'alerte', retenue: 'succes', rejetee: 'erreur' };

/* Chaque décision envoie un mail au candidat : la modale exige le contenu
   (date/lieu d'entretien, détails de retenue, motif de rejet obligatoire). */
const MODALE_CONFIG = {
  entretien: {
    titre: 'Convoquer en entretien',
    label: 'Date, lieu et précisions (envoyés au candidat)',
    placeholder: 'Ex. Entretien le 12/10 à 10h à nos bureaux de Bamako, muni de votre CV.',
    obligatoire: false,
  },
  retenue: {
    titre: 'Retenir le candidat',
    label: 'Détails (envoyés au candidat)',
    placeholder: 'Ex. Poste confirmé, démarrage le 01/11, contact RH au 70 00 00 00.',
    obligatoire: false,
  },
  rejetee: {
    titre: 'Rejeter la candidature',
    label: 'Motif du rejet (envoyé au candidat, obligatoire)',
    placeholder: 'Ex. Profil ne correspondant pas au poste, dossier conservé 1 an.',
    obligatoire: true,
  },
};

function ModaleDecision({ candidat, decision, onFermer, onConfirmer }) {
  const config = MODALE_CONFIG[decision];
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (config.obligatoire && message.trim().length < 10) {
      setErreur('Motif d\u2019au moins 10 caractères exigé : il sera envoyé au candidat.');
      return;
    }
    onConfirmer(message.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={config.titre}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Recrutement · {candidat.nom}</p>
            <h2 className="!text-[21px]">{config.titre}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="dec-message">{config.label}</Label>
            <div className="mt-esp-2"><Textarea id="dec-message" value={message} onChange={(e) => { setMessage(e.target.value); setErreur(''); }} placeholder={config.placeholder} rows={4} /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
          <p className="dg-legende">Un e-mail sera envoyé à {candidat.email}.</p>
          <Button type="submit" taille="lg" className="w-full">Confirmer — {STATUT_LABEL[decision].toLowerCase()}</Button>
        </div>
      </form>
    </div>
  );
}

export default function Recrutement() {
  const { notifier, session } = useOutletContext();
  const [candidatures, setCandidatures] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [decision, setDecision] = useState(null);

  const charger = async () => {
    try {
      setCandidatures(await listerCandidatures());
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des candidatures impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const statuer = async (message) => {
    if (!decision) return;
    const { candidat, statut } = decision;
    try {
      await statuerCandidature(candidat.id, { decision: statut, message });
      notifier({ type: statut === 'rejetee' ? 'info' : 'succes', titre: `Candidat ${STATUT_LABEL[statut].toLowerCase()} — mail envoyé`, texte: candidat.nom });
      setDecision(null);
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (c) => {
    try {
      await supprimerCandidature(c.id);
      notifier({ type: 'succes', titre: 'Candidature supprimée', texte: `${c.nom} — dossier effacé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_RH)) {
    return (
      <AccesRestreint
        titre="Recrutement réservé aux RH"
        requis="Seuls les membres des Ressources Humaines suivent les candidatures."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef RH étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_RH);

  const offres = {};
  candidatures.forEach((c) => {
    const cle = c.offre_reference || c.offre_titre || 'Sans offre';
    (offres[cle] = offres[cle] ?? { titre: c.offre_titre || c.offre_reference || 'Sans offre', candidats: [] }).candidats.push(c);
  });
  const liste = Object.values(offres);

  return (
    <div>
      <div>
        <p className="dg-surtitre">RH</p>
        <h1 className="mt-esp-2">Recrutement</h1>
      </div>

      <div className="mt-esp-4">
        <Alert ton="info" titre="Candidatures reçues du site web">
          Les offres sont publiées côté site vitrine — chaque dépôt arrive ici en temps réel via webhook.
          Le HUB ne crée pas d offres : il reçoit, affiche la source et fait avancer les statuts.
        </Alert>
      </div>

      {chargement ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : liste.length === 0 ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune candidature pour le moment.</p>
      ) : (
      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {liste.map((o) => (
          <Card key={o.titre} survol={false}>
            <CardHeader>
              <div className="flex items-center justify-between gap-esp-3">
                <span className="flex min-w-0 items-center gap-esp-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                    <Briefcase size={20} aria-hidden="true" className="text-digi" />
                  </span>
                  <h2 className="truncate !text-[18px]">{o.titre}</h2>
                </span>
                <Badge ton="info" className="dg-tnum">{o.candidats.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-esp-2">
              {o.candidats.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                  <div className="min-w-40 flex-1">
                    <p className="font-courant text-[15px] font-semibold text-gris-900">{c.nom}</p>
                    <p className="font-mono text-[13px] text-gris-600">{c.email}{c.telephone ? ` · ${c.telephone}` : ''}</p>
                    {c.message && <p className="mt-esp-1 font-courant text-[13px] text-gris-600">{c.message}</p>}
                  </div>
                  <Badge ton="info">
                    <span className="inline-flex items-center gap-esp-1">
                      <Globe size={14} aria-hidden="true" /> {c.source === 'site' ? 'Site web' : 'Manuelle'}
                    </span>
                  </Badge>
                  <Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{STATUT_LABEL[c.statut] ?? c.statut}</Badge>
                  {peutValider && c.statut === 'recue' && (
                    <button type="button" onClick={() => setDecision({ candidat: c, statut: 'entretien' })} className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 transition-colors duration-rapide hover:bg-gris-200">
                      <CalendarClock size={16} aria-hidden="true" /> Entretien
                    </button>
                  )}
                  {peutValider && (c.statut === 'recue' || c.statut === 'entretien') && (
                    <span className="flex gap-esp-2">
                      <button type="button" onClick={() => setDecision({ candidat: c, statut: 'retenue' })} aria-label={`Retenir ${c.nom}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-succes px-esp-2 font-courant text-[15px] font-semibold text-blanc transition-colors duration-rapide hover:brightness-90">
                        <UserCheck size={16} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setDecision({ candidat: c, statut: 'rejetee' })} aria-label={`Rejeter ${c.nom}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gris-300 font-courant text-[15px] font-semibold text-erreur transition-colors duration-rapide hover:bg-erreur-fond">
                        <UserX size={16} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {peutValider && (c.statut === 'recue' || c.statut === 'rejetee') && (
                    <BoutonSupprimer
                      titre={`Supprimer ${c.nom}`}
                      libelle={c.nom}
                      texte="Supprimer définitivement la candidature"
                      onConfirmer={() => supprimer(c)}
                    />
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
      )}

      {decision && (
        <ModaleDecision
          candidat={decision.candidat}
          decision={decision.statut}
          onFermer={() => setDecision(null)}
          onConfirmer={statuer}
        />
      )}
    </div>
  );
}
