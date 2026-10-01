import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, ArrowLeft, CalendarClock, Users, MapPin, Check, ListChecks, ScrollText, ArrowRight, Printer } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_SECRETARIAT, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import Entete, { PiedEntete } from '../components/doc/Entete.jsx';
import EditeurRiche from '../components/editeur/EditeurRiche.jsx';
import {
  ajouterDecision, convertirDecision, creerReunion, detailReunion, listerReunions, majReunion, supprimerReunion,
} from '../api/tickets.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerEmployes } from '../api/ressources.js';
import { listerProjets } from '../api/projets.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';

/* Réunions Secrétariat — API réelle (SPEC §5.2 : ODJ, PV, décisions -> tâches). */

const STATUT_LABEL = { planifiee: 'Planifiée', pv_redaction: 'PV en rédaction', cloturee: 'Clôturée' };
const STATUT_TON = { planifiee: 'info', pv_redaction: 'alerte', cloturee: 'neutre' };
const TRANSITIONS = { planifiee: ['pv_redaction'], pv_redaction: ['cloturee'], cloturee: [] };

const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const heureCourte = (h) => String(h ?? '').slice(0, 5) || '—';
const pointsOdj = (texte) => String(texte ?? '').split('\n').map((p) => p.trim()).filter(Boolean);

function ModaleReunion({ onFermer, onCreer }) {
  const [form, setForm] = useState({ titre: '', date: new Date().toISOString().slice(0, 10), heure: '09:00', lieu: '', participants: '' });
  const [erreur, setErreur] = useState('');
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const soumettre = (e) => {
    e.preventDefault();
    if (form.titre.trim().length < 3) {
      setErreur('Donnez un titre d au moins 3 caractères.');
      return;
    }
    if (!form.date) {
      setErreur('Indiquez la date de la réunion.');
      return;
    }
    onCreer({ titre: form.titre.trim(), date: form.date, heure: form.heure || null, lieu: form.lieu.trim(), participants: form.participants.trim() });
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle réunion">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Secrétariat</p>
            <h2 className="!text-[26px]">Nouvelle réunion</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">✕</button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="re-titre">Titre</Label>
              <div className="mt-esp-2"><Input id="re-titre" autoFocus {...champ('titre')} placeholder="Ex. Revue hebdo projets" /></div>
          </div>
          <div className="grid grid-cols-2 gap-esp-4">
            <div>
              <Label htmlFor="re-date">Date</Label>
              <div className="mt-esp-2"><Input id="re-date" type="date" {...champ('date')} /></div>
            </div>
            <div>
              <Label htmlFor="re-heure">Heure</Label>
              <div className="mt-esp-2"><Input id="re-heure" type="time" {...champ('heure')} /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="re-lieu">Lieu</Label>
            <div className="mt-esp-2"><Input id="re-lieu" {...champ('lieu')} placeholder="Ex. Salle de réunion — ACI 2000" /></div>
          </div>
          <div>
            <Label htmlFor="re-part">Participants (séparés par des virgules)</Label>
            <div className="mt-esp-2"><Input id="re-part" {...champ('participants')} placeholder="Ex. Moussa Koné, Awa Diallo" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Planifier</Button>
        </div>
      </form>
    </div>
  );
}

function OngletOdj({ reunion, onFait }) {
  const { notifier } = useOutletContext();
  const [point, setPoint] = useState('');
  /* ODJ = avant la réunion : modifiable en Planifiée, figé une fois tenue. */
  const modifiable = reunion.statut === 'planifiee';
  const points = pointsOdj(reunion.ordre_du_jour);

  const ajouter = async () => {
    if (point.trim().length < 3) return;
    try {
      await majReunion(reunion.id, { ordre_du_jour: [...points, point.trim()].join('\n') });
      setPoint('');
      onFait();
      notifier({ type: 'succes', titre: 'Point ajouté', texte: 'Ordre du jour actualisé.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Ajout impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <ol className="flex flex-col gap-esp-2">
        {points.map((p, i) => (
          <li key={`${i}-${p}`} className="flex gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
            <span aria-hidden="true" className="font-titrage text-[15px] font-bold text-digi dg-tnum">{String(i + 1).padStart(2, '0')}</span>
            <span className="font-courant text-[15px] text-gris-900">{p}</span>
          </li>
        ))}
        {points.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun point à l ordre du jour.</p>}
      </ol>
      {!modifiable && (
        <p className="mt-esp-3 rounded-lg bg-gris-100 p-esp-3 font-courant text-[14px] text-gris-600">
          Ordre du jour figé — il se prépare avant la réunion (statut Planifiée).
        </p>
      )}
      {modifiable && (
        <div className="mt-esp-3 flex flex-wrap gap-esp-2">
          <input value={point} onChange={(e) => setPoint(e.target.value)} placeholder="Ajouter un point…" aria-label="Ajouter un point à l ordre du jour" className="h-11 min-h-[44px] flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]" />
          <Button taille="sm" onClick={ajouter}><Plus size={16} aria-hidden="true" /> Ajouter</Button>
        </div>
      )}
    </div>
  );
}

function OngletPv({ reunion, onFait }) {
  const { notifier } = useOutletContext();
  const [edition, setEdition] = useState(false);
  const [pv, setPv] = useState(reunion.pv);
  /* PV = après la réunion : rédigeable en « PV en rédaction » uniquement. */
  const modifiable = reunion.statut === 'pv_redaction';

  const sauver = async () => {
    try {
      await majReunion(reunion.id, { pv });
      setEdition(false);
      onFait();
      notifier({ type: 'succes', titre: 'PV enregistré', texte: reunion.titre });
    } catch (e) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
    }
  };

  if (edition) {
    return (
      <div>
        <EditeurRiche valeurInitiale={pv} cle={`pv-${reunion.id}`} onChanger={setPv} />
        <div className="mt-esp-3 flex gap-esp-2">
          <Button taille="sm" onClick={sauver}><Check size={16} aria-hidden="true" /> Enregistrer le PV</Button>
          <Button taille="sm" variante="fantome" onClick={() => { setPv(reunion.pv); setEdition(false); }}>Annuler</Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {reunion.pv
        ? <div className="dg-doc rounded-lg bg-gris-100 p-esp-4 font-courant text-[15px] text-gris-700" dangerouslySetInnerHTML={{ __html: reunion.pv }} />
        : <p className="font-courant text-[15px] text-gris-600">PV non rédigé.</p>}
      {!modifiable && reunion.statut === 'planifiee' && (
        <p className="mt-esp-3 rounded-lg bg-gris-100 p-esp-3 font-courant text-[14px] text-gris-600">
          Le PV se rédige après la réunion — passez au statut « PV en rédaction ».
        </p>
      )}
      {modifiable && (
        <div className="mt-esp-3">
          <Button taille="sm" variante="secondaire" onClick={() => { setPv(reunion.pv); setEdition(true); }}>
            <ScrollText size={16} aria-hidden="true" /> {reunion.pv ? 'Modifier le PV' : 'Rédiger le PV'}
          </Button>
        </div>
      )}
    </div>
  );
}

function OngletDecisions({ reunion, employes, projets, onFait }) {
  const { notifier } = useOutletContext();
  const [texte, setTexte] = useState('');
  const [responsable, setResponsable] = useState(employes[0]?.user ?? '');
  const [echeance, setEcheance] = useState('');
  const [projetId, setProjetId] = useState(projets[0]?.id ?? '');
  /* Décisions = actées pendant/après la réunion : modifiables en « PV en rédaction ». */
  const modifiable = reunion.statut === 'pv_redaction';

  const ajouter = async () => {
    if (texte.trim().length < 3 || !responsable || !echeance) return;
    try {
      await ajouterDecision(reunion.id, { texte: texte.trim(), responsable: Number(responsable), echeance });
      setTexte('');
      setEcheance('');
      onFait();
      notifier({ type: 'succes', titre: 'Décision ajoutée', texte: 'Responsable + échéance obligatoires : OK.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Ajout impossible', texte: messageErreur(e) });
    }
  };

  const convertir = async (d) => {
    try {
      await convertirDecision(reunion.id, d.id, projetId);
      onFait();
      notifier({ type: 'succes', titre: 'Tâche créée', texte: `${d.texte} rejoint le Kanban.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Conversion impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="flex flex-col gap-esp-2">
      {reunion.decisions.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucune décision actée.</p>}
      {reunion.decisions.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
          <div className="min-w-48 flex-1">
            <p className="font-courant text-[15px] font-semibold text-gris-900">{d.texte}</p>
            <p className="font-courant text-[13px] text-gris-600">{d.responsable_email ?? ''} · échéance {dateFr(d.echeance)}{d.tache ? ' · tâche créée' : ''}</p>
          </div>
          <Badge ton={d.tache ? 'succes' : 'alerte'}>{d.tache ? 'Convertie' : 'À convertir'}</Badge>
          {!modifiable && (
            <span className="font-courant text-[14px] text-gris-600">
              {reunion.statut === 'planifiee' ? 'Les décisions s actent après la réunion.' : 'Réunion clôturée — lecture seule.'}
            </span>
          )}
          {modifiable && !d.tache && (
            <span className="flex flex-wrap items-center gap-esp-2">
              <select value={projetId} onChange={(e) => setProjetId(e.target.value)} aria-label={`Projet cible pour ${d.texte}`} className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]">
                {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
              <button type="button" onClick={() => convertir(d)} className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md bg-digi px-esp-3 font-courant text-[15px] font-semibold text-blanc hover:brightness-90">
                <ListChecks size={16} aria-hidden="true" /> En tâche
              </button>
            </span>
          )}
        </div>
      ))}
      {modifiable && (
        <div className="mt-esp-2 grid grid-cols-1 gap-esp-2 rounded-lg border border-dashed border-gris-300 p-esp-3 sm:grid-cols-4">
          <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Décision…" aria-label="Texte de la décision" className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px] sm:col-span-2" />
          <select value={responsable} onChange={(e) => setResponsable(e.target.value)} aria-label="Responsable" className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]">
            {employes.map((em) => <option key={em.id} value={em.user}>{em.email}</option>)}
          </select>
          <span className="flex gap-esp-2">
            <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} aria-label="Échéance" className="h-11 min-h-[44px] flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]" />
            <Button taille="sm" onClick={ajouter}><Plus size={16} aria-hidden="true" /></Button>
          </span>
        </div>
      )}
    </div>
  );
}

const ONGLETS = [
  { id: 'odj', libelle: 'Ordre du jour' },
  { id: 'pv', libelle: 'PV' },
  { id: 'decisions', libelle: 'Décisions' },
];

export default function Reunions() {
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [vue, setVue] = useState('liste');
  const [reunionId, setReunionId] = useState(null);
  const [onglet, setOnglet] = useState('odj');
  const [modale, setModale] = useState(false);
  const [reunions, setReunions] = useState([]);
  const [reunion, setReunion] = useState(null);
  const [employes, setEmployes] = useState([]);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState('');

  const chargerListe = async () => {
    try {
      const rs = await listerReunions();
      setReunions(rs);
      setErreurListe('');
    } catch (e) {
      setErreurListe(messageErreur(e, 'Chargement des réunions impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { chargerListe(); }, []);
  useEffect(() => {
    listerEmployes().then(setEmployes, () => {});
    listerProjets().then(setProjets, () => {});
  }, []);

  const ouvrir = async (id) => {
    try {
      setReunion(await detailReunion(id));
      setReunionId(id);
      setOnglet('odj');
      setVue('detail');
    } catch (e) {
      notifier({ type: 'info', titre: 'Ouverture impossible', texte: messageErreur(e) });
    }
  };

  const rafraichir = async () => {
    await chargerListe();
    if (reunionId) {
      try {
        setReunion(await detailReunion(reunionId));
      } catch {
        /* liste à jour, détail conservé */
      }
    }
  };

  const creer = async (data) => {
    try {
      const r = await creerReunion(data);
      setModale(false);
      setReunion(r);
      setReunionId(r.id);
      setOnglet('odj');
      setVue('detail');
      chargerListe();
      notifier({ type: 'succes', titre: 'Réunion planifiée', texte: `${r.titre} — ${dateFr(r.date)}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (r) => {
    try {
      await supprimerReunion(r.id);
      notifier({ type: 'succes', titre: 'Réunion supprimée', texte: `${r.titre} — planifiée effacée.` });
      setVue('liste');
      chargerListe();
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  const avancer = async (s) => {
    if (!reunion) return;
    try {
      const maj = await majReunion(reunion.id, { statut: s });
      setReunion(maj);
      chargerListe();
      notifier({ type: 'succes', titre: 'Statut actualisé', texte: `${maj.titre} — ${STATUT_LABEL[s]}.` });
      if (s === 'pv_redaction') {
        notifier({ type: 'info', titre: 'Ordre du jour figé', texte: 'La réunion est tenue : rédigez le PV et actez les décisions.' });
      }
      if (s === 'cloturee') {
        notifier({ type: 'info', titre: 'Réunion clôturée', texte: 'ODJ, PV et décisions en lecture seule.' });
      }
    } catch (e) {
      notifier({ type: 'info', titre: 'Transition impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_SECRETARIAT)) {
    return (
      <AccesRestreint
        titre="Réunions réservées au Secrétariat"
        requis="Seuls les membres du Secrétariat organisent les réunions et les PV."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Secrétariat étudiera votre accès.' })}
      />
    );
  }
  const transitions = reunion ? (TRANSITIONS[reunion.statut] ?? []) : [];

  if (vue === 'detail' && reunion) {
    const parts = String(reunion.participants ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    return (
      <div>
        <div className="dg-no-print">
          <button type="button" onClick={() => setVue('liste')} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
            <ArrowLeft size={16} aria-hidden="true" /> Réunions
          </button>
          <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
            <div className="mr-auto">
              <p className="dg-surtitre">Secrétariat</p>
              <h1 className="mt-esp-2">{reunion.titre}</h1>
              <p className="mt-esp-2 flex flex-wrap items-center gap-esp-3 font-courant text-[15px] text-gris-600">
                <span className="inline-flex items-center gap-esp-1"><CalendarClock size={16} aria-hidden="true" /> {dateFr(reunion.date)} · {heureCourte(reunion.heure)}</span>
                <span className="inline-flex items-center gap-esp-1"><MapPin size={16} aria-hidden="true" /> {reunion.lieu || '—'}</span>
                <span className="inline-flex items-center gap-esp-1"><Users size={16} aria-hidden="true" /> {parts.join(', ') || '—'}</span>
              </p>
            </div>
            <Badge ton={STATUT_TON[reunion.statut] ?? 'neutre'}>{STATUT_LABEL[reunion.statut] ?? reunion.statut}</Badge>
            {transitions.map((s) => (
              <Button key={s} variante="secondaire" taille="sm" onClick={() => avancer(s)}><Check size={16} aria-hidden="true" /> {STATUT_LABEL[s]}</Button>
            ))}
            {reunion.statut === 'planifiee' && (
              <BoutonSupprimer
                titre={`Supprimer ${reunion.titre}`}
                libelle={reunion.titre}
                texte="Supprimer définitivement la réunion planifiée"
                onConfirmer={() => supprimer(reunion)}
              />
            )}
            <Button variante="fantome" taille="sm" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> PV / PDF</Button>
          </div>
          <div className="mt-esp-4 flex gap-esp-2" role="tablist" aria-label="Sections réunion">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={onglet === o.id}
                onClick={() => setOnglet(o.id)}
                className={`min-h-[44px] rounded-pilule border px-esp-4 font-courant text-[15px] font-semibold ${onglet === o.id ? 'border-marine-profond bg-marine-profond text-blanc' : 'border-gris-300 text-gris-600 hover:text-gris-900'}`}
              >
                {o.libelle}
                {o.id === 'decisions' && reunion.decisions.length > 0 ? ` · ${reunion.decisions.length}` : ''}
              </button>
            ))}
          </div>
        </div>

        <Card survol={false} className="dg-print-doc mt-esp-4">
          <CardBody className="pt-esp-5">
            {onglet === 'odj' && <OngletOdj reunion={reunion} onFait={rafraichir} />}
            {onglet === 'pv' && <OngletPv reunion={reunion} onFait={rafraichir} />}
            {onglet === 'decisions' && <OngletDecisions reunion={reunion} employes={employes} projets={projets} onFait={rafraichir} />}
          </CardBody>
        </Card>

        {/* Version imprimée du PV */}
        <div className="dg-print-doc mx-auto mt-esp-4 hidden w-full max-w-[800px] rounded-lg border border-gris-300 bg-gris-0 p-esp-6 print:block">
          <Entete entreprise={entreprise} />
          <p className="mt-esp-5 text-center font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Procès-verbal</p>
          <h1 className="mt-esp-2 text-center !text-[26px]">{reunion.titre}</h1>
          <p className="mt-esp-2 text-center font-courant text-[15px] text-gris-600">{dateFr(reunion.date)} · {heureCourte(reunion.heure)} · {reunion.lieu} — {parts.join(', ')}</p>
          <div className="dg-doc mt-esp-5 font-courant text-[17px] text-gris-700" dangerouslySetInnerHTML={{ __html: reunion.pv || '<p>PV en cours de rédaction.</p>' }} />
          {reunion.decisions.length > 0 && (
            <div className="mt-esp-5">
              <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Décisions</p>
              <ul className="mt-esp-2 flex flex-col gap-esp-1">
                {reunion.decisions.map((d) => (
                  <li key={d.id} className="font-courant text-[15px] text-gris-700">{d.texte} — {d.responsable_email}, échéance {dateFr(d.echeance)}</li>
                ))}
              </ul>
            </div>
          )}
          <PiedEntete entreprise={entreprise} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Secrétariat</p>
          <h1 className="mt-esp-2">Réunions</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Ordres du jour, procès-verbaux et décisions converties en tâches assignées.
          </p>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle réunion
        </Button>
      </div>

      {chargement ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreurListe ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreurListe}</p>
      ) : (
      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {reunions.map((r) => (
          <Card key={r.id} survol={false}>
            <CardBody className="pt-esp-5">
              <div className="flex items-start justify-between gap-esp-3">
                <div>
                  <p className="font-titrage text-[18px] font-bold text-gris-900">{r.titre}</p>
                  <p className="mt-esp-1 font-courant text-[15px] text-gris-600 dg-tnum">{dateFr(r.date)} · {heureCourte(r.heure)} · {r.lieu || '—'}</p>
                  <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{r.participants || 'Aucun participant'}</p>
                </div>
                <span className="flex items-center gap-esp-1">
                  <Badge ton={STATUT_TON[r.statut] ?? 'neutre'}>{STATUT_LABEL[r.statut] ?? r.statut}</Badge>
                  {r.statut === 'planifiee' && (
                    <BoutonSupprimer
                      titre={`Supprimer ${r.titre}`}
                      libelle={r.titre}
                      texte="Supprimer définitivement la réunion planifiée"
                      onConfirmer={() => supprimer(r)}
                    />
                  )}
                </span>
              </div>
              <p className="mt-esp-2 font-courant text-[15px] text-gris-600 dg-tnum">{pointsOdj(r.ordre_du_jour).length} points · {r.decisions?.length ?? 0} décisions</p>
              <div className="mt-esp-3 flex justify-end border-t border-gris-200 pt-esp-2">
                <button type="button" onClick={() => ouvrir(r.id)} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
                  Ouvrir <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      )}
      {!chargement && !erreurListe && reunions.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune réunion planifiée.</p>
      )}

      {modale && <ModaleReunion onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
