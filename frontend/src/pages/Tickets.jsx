import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Ticket as TicketIcon, Send, Check, Ban, Lock, RotateCcw, ShieldCheck, Siren } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Textarea } from '../components/ui/Input.jsx';
import {
  approvalsTicket, cloreTicket, demanderAval, donnerAval, listerTickets, messagesTicket,
  qualifierTicket, rejeterTicket, repondreTicket, rouvrirTicket,
} from '../api/tickets.js';
import { messageErreur } from '../api/client.js';
import { ROLES_SECRETARIAT, estChefDuDept, peutVoir } from '../lib/acces.js';

/* Boîte Tickets Secrétariat — API réelle (SPEC §7 : nouveau → qualifié → aval → réponse → clos). */

const selectCls = 'h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'qualifie', label: 'Qualifié' },
  { id: 'en_attente_aval', label: 'En attente aval' },
  { id: 'approuve', label: 'Approuvé' },
  { id: 'repondu', label: 'Répondu' },
  { id: 'clos', label: 'Clos' },
  { id: 'rejete', label: 'Rejeté' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { nouveau: 'info', qualifie: 'alerte', en_attente_aval: 'alerte', approuve: 'info', repondu: 'succes', clos: 'neutre', rejete: 'erreur' };
const PRIORITES = [
  { id: 'basse', label: 'Basse' },
  { id: 'normale', label: 'Normale' },
  { id: 'haute', label: 'Haute' },
  { id: 'critique', label: 'Critique' },
];
const PRIORITE_LABEL = Object.fromEntries(PRIORITES.map((p) => [p.id, p.label]));
const PRIORITE_TON = { basse: 'neutre', normale: 'info', haute: 'alerte', critique: 'erreur' };
const DEPTS = ['Développement', 'Communication', 'Finance', 'RH', 'Juridique', 'Administration'];
const CATEGORIES = ['Bug', 'Facturation', 'Projet', 'Visuel', 'Accès', 'Autre'];
const TEMPLATES_REPONSE = [
  { id: 'standard', libelle: 'Standard — prise en charge', corps: 'Bonjour, votre demande est bien prise en compte. Notre équipe revient vers vous sous 24 heures ouvrées.' },
  { id: 'resolution', libelle: 'Résolution — correctif déployé', corps: 'Bonjour, le correctif est déployé et vérifié. N hésitez pas si le problème persiste.' },
  { id: 'info', libelle: 'Demande d information', corps: 'Bonjour, pour avancer il nous manque une information : pouvez-vous préciser les étapes pour reproduire le problème ?' },
];

const heuresDepuis = (iso) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000);
const ilYa = (iso) => {
  const h = heuresDepuis(iso);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${Math.round(h)} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'Hier' : `Il y a ${j} j`;
};

function SlaBadge({ ticket }) {
  const h = heuresDepuis(ticket.cree_le);
  if (h > 72) return <Badge ton="erreur">SLA 72h dépassé</Badge>;
  if (h > 24) return <Badge ton="erreur">SLA 24h dépassé</Badge>;
  return null;
}

function BlocQualification({ ticket, onFait }) {
  const { notifier } = useOutletContext();
  const [categorie, setCategorie] = useState(ticket.categorie || CATEGORIES[0]);
  const [priorite, setPriorite] = useState(ticket.priorite || 'normale');
  const [dept, setDept] = useState(ticket.dept_assigne || DEPTS[0]);
  const [motif, setMotif] = useState('');
  const [rejet, setRejet] = useState(false);

  const valider = async () => {
    try {
      await qualifierTicket(ticket.id, { categorie, priorite, dept_assigne: dept });
      onFait();
      notifier({ type: 'succes', titre: 'Ticket qualifié', texte: `${ticket.numero} — ${categorie}, ${PRIORITE_LABEL[priorite]}, ${dept}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Qualification impossible', texte: messageErreur(e) });
    }
  };
  const rejeter = async () => {
    if (motif.trim().length < 3) return;
    try {
      await rejeterTicket(ticket.id, motif.trim());
      onFait();
      notifier({ type: 'info', titre: 'Ticket rejeté', texte: ticket.numero });
    } catch (e) {
      notifier({ type: 'info', titre: 'Rejet impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="rounded-lg bg-gris-100 p-esp-4">
      <p className="font-courant text-[15px] font-semibold text-gris-900">Qualification Secrétariat</p>
      <div className="mt-esp-3 grid grid-cols-1 gap-esp-3 sm:grid-cols-3">
        <div><Label htmlFor={`q-cat-${ticket.id}`}>Catégorie</Label><select id={`q-cat-${ticket.id}`} value={categorie} onChange={(e) => setCategorie(e.target.value)} className={`mt-esp-2 ${selectCls}`}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><Label htmlFor={`q-prio-${ticket.id}`}>Priorité</Label><select id={`q-prio-${ticket.id}`} value={priorite} onChange={(e) => setPriorite(e.target.value)} className={`mt-esp-2 ${selectCls}`}>{PRIORITES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div><Label htmlFor={`q-dept-${ticket.id}`}>Département</Label><select id={`q-dept-${ticket.id}`} value={dept} onChange={(e) => setDept(e.target.value)} className={`mt-esp-2 ${selectCls}`}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></div>
      </div>
      <div className="mt-esp-3 flex flex-wrap gap-esp-2">
        <Button taille="sm" onClick={valider}><Check size={16} aria-hidden="true" /> Qualifier</Button>
        <Button taille="sm" variante="fantome" onClick={() => setRejet((r) => !r)}><Ban size={16} aria-hidden="true" /> Rejeter</Button>
      </div>
      {rejet && (
        <div className="mt-esp-3 flex flex-wrap items-center gap-esp-2">
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif du rejet…" aria-label="Motif du rejet" className="h-11 min-h-[44px] flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]" />
          <Button taille="sm" variante="secondaire" onClick={rejeter}>Confirmer le rejet</Button>
        </div>
      )}
    </div>
  );
}

function BlocAval({ ticket, approvals, onFait }) {
  const { notifier, session } = useOutletContext();
  const [note, setNote] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const enCours = approvals.find((a) => !a.decision);
  const estSecretariat = peutVoir(session, ROLES_SECRETARIAT);
  const estChef = estChefDuDept(session, ticket.dept_assigne);

  const demander = async () => {
    if (note.trim().length < 3) return;
    try {
      await demanderAval(ticket.id, { reponse_proposee: note.trim() });
      setNote('');
      onFait();
      notifier({ type: 'info', titre: 'Aval demandé', texte: `${ticket.numero} — notifié au Chef ${ticket.dept_assigne}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Demande impossible', texte: messageErreur(e) });
    }
  };
  const decider = async (decision) => {
    try {
      await donnerAval(ticket.id, { decision, commentaire: commentaire.trim() });
      setCommentaire('');
      onFait();
      notifier(decision === 'approuve'
        ? { type: 'succes', titre: 'Aval accordé', texte: `${ticket.numero} — réponse au client possible.` }
        : { type: 'info', titre: 'Aval refusé', texte: ticket.numero });
    } catch (e) {
      notifier({ type: 'info', titre: 'Décision impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="rounded-lg bg-gris-100 p-esp-4">
      <p className="flex items-center gap-esp-2 font-courant text-[15px] font-semibold text-gris-900">
        <ShieldCheck size={18} aria-hidden="true" className="text-digi" /> Aval du Chef de département
      </p>
      {enCours ? (
        <div className="mt-esp-3">
          <p className="font-courant text-[15px] text-gris-700">
            Demandé — « {enCours.reponse_proposee} »
          </p>
          {estChef ? (
            <div className="mt-esp-2 flex flex-wrap items-center gap-esp-2">
              <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire du Chef (optionnel)…" aria-label="Commentaire du Chef" className="h-11 min-h-[44px] flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]" />
              <Button taille="sm" onClick={() => decider('approuve')}><Check size={16} aria-hidden="true" /> Approuver</Button>
              <Button taille="sm" variante="fantome" onClick={() => decider('rejete')}>Refuser</Button>
            </div>
          ) : (
            <p className="dg-legende mt-esp-2">Seul le Chef du département assigné donne l aval.</p>
          )}
        </div>
      ) : estSecretariat ? (
        <div className="mt-esp-3 flex flex-wrap items-end gap-esp-2">
          <div className="min-w-48 flex-1">
            <Label htmlFor={`av-note-${ticket.id}`}>Réponse proposée au Chef</Label>
            <input id={`av-note-${ticket.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Valider le remboursement de 50 000 F ?" className={`mt-esp-2 ${selectCls}`} />
          </div>
          <Button taille="sm" variante="secondaire" onClick={demander}>Demander l aval</Button>
        </div>
      ) : (
        <p className="dg-legende mt-esp-3">Demande d aval réservée au Secrétariat.</p>
      )}
      {approvals.filter((a) => a.decision).length > 0 && (
        <ul className="mt-esp-3 flex flex-col gap-esp-1">
          {approvals.filter((a) => a.decision).map((a) => (
            <li key={a.id} className="font-courant text-[14px] text-gris-600">
              <strong>{a.decision}</strong>{a.commentaire ? ` : ${a.commentaire}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlocReponse({ ticket, onFait }) {
  const { notifier } = useOutletContext();
  const [modele, setModele] = useState(TEMPLATES_REPONSE[0].id);
  const [texte, setTexte] = useState(TEMPLATES_REPONSE[0].corps);

  const choisir = (id) => {
    setModele(id);
    const t = TEMPLATES_REPONSE.find((x) => x.id === id);
    if (t) setTexte(t.corps);
  };
  const envoyer = async () => {
    if (texte.trim().length < 10) return;
    try {
      await repondreTicket(ticket.id, { message: texte.trim() });
      onFait();
      notifier({ type: 'succes', titre: 'Réponse envoyée', texte: `${ticket.numero} — mail transmis au client.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="rounded-lg bg-gris-100 p-esp-4">
      <p className="flex items-center gap-esp-2 font-courant text-[15px] font-semibold text-gris-900">
        <Send size={18} aria-hidden="true" className="text-digi" /> Répondre au client (Secrétariat uniquement)
      </p>
      <div className="mt-esp-3">
        <Label htmlFor={`rep-mod-${ticket.id}`}>Modèle de mail</Label>
        <select id={`rep-mod-${ticket.id}`} value={modele} onChange={(e) => choisir(e.target.value)} className={`mt-esp-2 ${selectCls}`}>
          {TEMPLATES_REPONSE.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
        </select>
      </div>
      <div className="mt-esp-3">
        <Label htmlFor={`rep-txt-${ticket.id}`}>Message client</Label>
        <div className="mt-esp-2"><Textarea id={`rep-txt-${ticket.id}`} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={2000} /></div>
      </div>
      <div className="mt-esp-3"><Button taille="sm" onClick={envoyer}><Send size={16} aria-hidden="true" /> Envoyer la réponse</Button></div>
    </div>
  );
}

function DetailTicket({ ticket, onFait }) {
  const { notifier, session } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const h = heuresDepuis(ticket.cree_le);
  const estSecretariat = peutVoir(session, ROLES_SECRETARIAT);
  const peutRepondre = estSecretariat && ['approuve', 'qualifie'].includes(ticket.statut);

  useEffect(() => {
    let actif = true;
    Promise.all([messagesTicket(ticket.id), approvalsTicket(ticket.id)]).then(
      ([ms, as]) => { if (actif) { setMessages(ms); setApprovals(as); } },
      () => {},
    );
    return () => { actif = false; };
  }, [ticket.id, ticket.statut]);

  const clore = async () => {
    try {
      await cloreTicket(ticket.id);
      onFait();
      notifier({ type: 'succes', titre: 'Ticket clos', texte: ticket.numero });
    } catch (e) {
      notifier({ type: 'info', titre: 'Clôture impossible', texte: messageErreur(e) });
    }
  };
  const rouvrir = async () => {
    try {
      await rouvrirTicket(ticket.id);
      onFait();
      notifier({ type: 'info', titre: 'Ticket rouvert', texte: ticket.numero });
    } catch (e) {
      notifier({ type: 'info', titre: 'Réouverture impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="flex flex-col gap-esp-4">
      <div>
        <p className="font-mono text-[13px] text-gris-600">{ticket.numero} · {ilYa(ticket.cree_le)}</p>
        <h2 className="!text-[21px]">{ticket.sujet}</h2>
        <div className="mt-esp-2 flex flex-wrap gap-esp-2">
          <Badge ton={STATUT_TON[ticket.statut] ?? 'neutre'}>{STATUT_LABEL[ticket.statut] ?? ticket.statut}</Badge>
          <Badge ton={PRIORITE_TON[ticket.priorite] ?? 'neutre'}>{PRIORITE_LABEL[ticket.priorite] ?? ticket.priorite}</Badge>
          <SlaBadge ticket={ticket} />
        </div>
      </div>

      {(h > 24) && (
        <Alert ton="erreur" titre="SLA dépassé — alerte Super Admin + Chef">
          <span className="inline-flex items-center gap-esp-2"><Siren size={16} aria-hidden="true" /> Ouvert depuis {Math.round(h)} h (réponse 24h, résolution 72h).</span>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-esp-3 font-courant text-[15px] sm:grid-cols-3">
        {[
          ['Client', ticket.client_nom ?? '—'],
          ['Projet', ticket.project_titre ?? '—'],
          ['Catégorie', ticket.categorie || '—'],
          ['Priorité', PRIORITE_LABEL[ticket.priorite] ?? ticket.priorite],
          ['Assigné à', ticket.dept_assigne || '—'],
          ['Créé', ilYa(ticket.cree_le)],
        ].map(([t, v]) => (
          <div key={t} className="rounded-lg bg-gris-100 p-esp-3">
            <dt className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{t}</dt>
            <dd className="mt-esp-1 font-semibold text-gris-900">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-gris-300 p-esp-4">
        <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Demande client</p>
        <p className="mt-esp-2 font-courant text-[15px] leading-[1.65] text-gris-700">{ticket.message}</p>
      </div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-esp-2">
          {messages.map((m) => (
            <div key={m.id} className={`rounded-lg p-esp-3 ${m.is_internal ? 'border border-dashed border-gris-300 bg-gris-0' : 'bg-digi-voile'}`}>
              <p className="flex flex-wrap items-center gap-esp-2 font-courant text-[13px] text-gris-600">
                {m.is_internal && <Badge ton="neutre">Interne</Badge>}
              </p>
              <p className="mt-esp-1 font-courant text-[15px] text-gris-700">{m.message}</p>
            </div>
          ))}
        </div>
      )}

      {ticket.statut === 'nouveau' && estSecretariat && <BlocQualification ticket={ticket} onFait={onFait} />}
      {ticket.statut === 'nouveau' && !estSecretariat && (
        <Alert ton="info" titre="En attente de qualification">
          Le Secrétariat qualifie ce ticket (catégorie, priorité, département assigné).
        </Alert>
      )}
      {['qualifie', 'approuve', 'en_attente_aval'].includes(ticket.statut) && <BlocAval ticket={ticket} approvals={approvals} onFait={onFait} />}

      {ticket.statut === 'qualifie' && (
        <Alert ton="alerte" titre="Aval requis avant réponse">
          Demandez l aval du Chef de département ci-dessus — seul le Secrétariat répond au client après approbation.
        </Alert>
      )}
      {peutRepondre && <BlocReponse ticket={ticket} onFait={onFait} />}

      <div className="flex flex-wrap gap-esp-2">
        {ticket.statut === 'repondu' && estSecretariat && (
          <Button taille="sm" variante="secondaire" onClick={clore}><Lock size={16} aria-hidden="true" /> Clore le ticket</Button>
        )}
        {['clos', 'rejete'].includes(ticket.statut) && estSecretariat && (
          <Button taille="sm" variante="secondaire" onClick={rouvrir}><RotateCcw size={16} aria-hidden="true" /> Rouvrir</Button>
        )}
      </div>
    </div>
  );
}

export default function Tickets() {
  const { session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('tous');
  const deptDefaut = session?.dept && DEPTS.includes(session.dept) && !['super_admin', 'admin'].includes(session.role)
    ? session.dept
    : 'Tous';
  const [dept, setDept] = useState(deptDefaut);
  const [tickets, setTickets] = useState([]);
  const [ouverts, setOuverts] = useState(0);
  const [selection, setSelection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', st = 'tous', dp = 'Tous') => {
    try {
      const ts = await listerTickets({
        ...(q ? { search: q } : {}),
        ...(st !== 'tous' ? { statut: st } : {}),
        ...(dp !== 'Tous' ? { dept_assigne: dp } : {}),
      });
      setTickets(ts);
      setOuverts(ts.filter((t) => !['clos', 'rejete'].includes(t.statut)).length);
      setSelection((sel) => sel ?? ts[0]?.id ?? null);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des tickets impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), statut, dept), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, statut, dept]);

  const actif = tickets.find((t) => t.id === selection) ?? tickets[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Secrétariat</p>
          <h1 className="mt-esp-2">Tickets</h1>
          <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
            Boîte entrante : qualification, aval du Chef, réponse au client. <span className="dg-tnum">{ouverts} ouverts</span>.
          </p>
        </div>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, objet, client, projet…" aria-label="Rechercher un ticket" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.id === 'tous' ? 'Tous' : s.label}</option>)}
        </select>
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filtrer par département assigné" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          {['Tous', ...DEPTS].map((d) => <option key={d}>{d === 'Tous' ? 'Tous départements' : d}</option>)}
        </select>
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-5">
        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <p className="dg-surtitre">Boîte Secrétariat</p>
            <p className="font-courant text-[15px] text-gris-600 dg-tnum">{tickets.length} ticket{tickets.length > 1 ? 's' : ''}</p>
          </CardHeader>
          <CardBody className="flex max-h-[640px] flex-col gap-esp-1 overflow-y-auto pt-esp-2">
            {tickets.length === 0 && <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600">Aucun ticket avec ces filtres.</p>}
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelection(t.id)}
                aria-current={actif?.id === t.id}
                className={`rounded-lg border p-esp-3 text-left transition-colors duration-rapide ${
                  actif?.id === t.id ? 'border-digi bg-digi-voile' : 'border-transparent hover:bg-gris-100'
                }`}
              >
                <span className="flex items-center gap-esp-2">
                  <TicketIcon size={18} aria-hidden="true" className="shrink-0 text-digi" />
                  <span className="truncate font-courant text-[15px] font-semibold text-gris-900">{t.sujet}</span>
                </span>
                <span className="mt-esp-1 block font-mono text-[13px] text-gris-600">{t.numero} · {t.client_nom}</span>
                <span className="mt-esp-2 flex flex-wrap gap-esp-1">
                  <Badge ton={STATUT_TON[t.statut] ?? 'neutre'}>{STATUT_LABEL[t.statut] ?? t.statut}</Badge>
                  <Badge ton={PRIORITE_TON[t.priorite] ?? 'neutre'}>{PRIORITE_LABEL[t.priorite] ?? t.priorite}</Badge>
                  {t.dept_assigne && <Badge ton="neutre">{t.dept_assigne}</Badge>}
                  <SlaBadge ticket={t} />
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-3">
          <CardBody className="pt-esp-5">
            {actif ? <DetailTicket key={actif.id + actif.statut} ticket={actif} onFait={() => charger(recherche.trim(), statut, dept)} /> : <p className="text-center font-courant text-[15px] text-gris-600">Sélectionnez un ticket.</p>}
          </CardBody>
        </Card>
      </div>
      )}
    </div>
  );
}
