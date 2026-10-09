import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Receipt, Ticket as TicketIcon, Mails, LogOut,
  Plus, X, Printer, Check, ShieldAlert, Eye, Banknote, Bell, FileText, CreditCard,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import Logo from '../components/Logo.jsx';
import Toasts from '../components/Toasts.jsx';
import useClickOutside from '../hooks/useClickOutside.js';
import FactureDoc from '../components/finance/FactureDoc.jsx';
import RecuDoc from '../components/finance/RecuDoc.jsx';
import DevisDoc from '../components/finance/DevisDoc.jsx';
import { useAuth, useSession } from '../store/auth.js';
import { api } from '../api/client.js';
import { dashboardPortal, detailFacture, listerRecus, payerFacture, rejeterDevis, validerDevis as validerDevisApi } from '../api/finance.js';
import { creerTicket as creerTicketApi } from '../api/tickets.js';
import { listerClients } from '../api/clients.js';
import { listerMailsEnvoyes } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import { PAIEMENT_EN_LIGNE_ACTIF, MESSAGE_PAIEMENT_BIENTOT } from '../lib/paiement.js';
import { fCFA } from '../utils/stats.js';

/* Portail client — API réelle (SPEC §6 : GET /portal/dashboard/, scope client_id = me). */

const ONGLETS = [
  { id: 'apercu', libelle: 'Tableau de bord', Icone: LayoutDashboard },
  { id: 'projets', libelle: 'Mes projets', Icone: FolderKanban },
  { id: 'devis', libelle: 'Mes devis', Icone: FileText },
  { id: 'factures', libelle: 'Factures & reçus', Icone: Receipt },
  { id: 'tickets', libelle: 'Mes tickets', Icone: TicketIcon },
  { id: 'mails', libelle: 'Mails', Icone: Mails },
];

const TONS_DEVIS = { en_attente: 'alerte', accepte: 'succes', refuse: 'erreur' };
const LABEL_DEVIS = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' };
const TONS_FACTURE = { brouillon: 'neutre', validee: 'info', envoyee: 'info', partielle: 'alerte', payee: 'succes', impayee: 'erreur' };
const LABEL_FACTURE = { brouillon: 'Brouillon', validee: 'Validée', envoyee: 'Envoyée', partielle: 'Partielle', payee: 'Payée', impayee: 'Impayée' };
const TONS_TICKET = { nouveau: 'info', qualifie: 'alerte', en_attente_aval: 'alerte', approuve: 'info', repondu: 'succes', clos: 'neutre', rejete: 'erreur' };
const LABEL_TICKET = { nouveau: 'Nouveau', qualifie: 'Qualifié', en_attente_aval: 'En attente aval', approuve: 'Approuvé', repondu: 'Répondu', clos: 'Clos', rejete: 'Rejeté' };
const TYPES_PROJET = { site_web: 'Site web', app_web: 'App web', app_mobile: 'App mobile', autre: 'Autre' };
const STATUTS_PROJET = { a_faire: 'À faire', en_cours: 'En cours', en_review: 'En review', termine: 'Terminé', en_pause: 'En pause' };
const JALON_LABEL = { a_venir: 'À venir', en_cours: 'En cours', valide: 'Validé' };
const MOYENS = [
  { label: 'Mobile Money', value: 'mobile_money' },
  { label: 'Virement', value: 'virement' },
  { label: 'Espèces', value: 'especes' },
];

const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('T')[0].split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const ilYa = (iso) => {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${Math.round(h)} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'Hier' : `Il y a ${j} j`;
};
const numeroDevis = (d) => d.numero ?? `DEV-${String(d.id).padStart(4, '0')}`;

/* Connexion intégrée au portail : le client se connecte ici même (sans OTP),
   le compte interne est refusé avec consigne. */
function ConnexionEspace() {
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const connecter = async (e) => {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      const res = await login(email.trim(), motDePasse);
      if (res.erreur) {
        setErreur(res.erreur);
        return;
      }
      if (res.otpRequis) {
        logout();
        setErreur('Compte interne : connectez-vous via le hub (/login), pas ici.');
        return;
      }
      const role = useAuth.getState().user?.role;
      if (role !== 'client' && role !== 'super_admin') {
        logout();
        setErreur('Identifiants non client. Demandez vos accès à l agence.');
      }
      /* Sinon le portail s'ouvre seul (session à jour). */
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={52} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Espace client</p>
        </div>
        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          <h1 className="font-titrage text-[21px] font-bold text-gris-900">Connexion à votre espace</h1>
          <p className="mt-esp-1 font-courant text-[15px] text-gris-600">Identifiants transmis par l agence. Sans code, sans détour.</p>
          <form onSubmit={connecter} className="mt-esp-5 flex flex-col gap-esp-4">
            <div>
              <Label htmlFor="espace-email">Identifiant ou e-mail</Label>
              <div className="mt-esp-2"><Input id="espace-email" type="text" value={email} onChange={(e) => { setEmail(e.target.value); setErreur(''); }} placeholder="Ex. orange.mali ou contact@societe.ml" autoComplete="username" /></div>
            </div>
            <div>
              <Label htmlFor="espace-mdp">Mot de passe</Label>
              <div className="mt-esp-2"><Input id="espace-mdp" type="password" value={motDePasse} onChange={(e) => { setMotDePasse(e.target.value); setErreur(''); }} placeholder="Votre mot de passe" autoComplete="current-password" /></div>
            </div>
            {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
            <Button type="submit" taille="lg" className="w-full" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</Button>
          </form>
          <div className="mt-esp-4 text-center">
            <Link to="/" className="inline-flex min-h-[44px] items-center font-courant text-[15px] font-semibold text-digi-texte hover:underline">Hub agence</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModaleTicket({ projets, onFermer, onCreer }) {
  const [projet, setProjet] = useState(projets[0]?.id ?? '');
  const [objet, setObjet] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (objet.trim().length < 3) {
      setErreur('Décrivez l objet en au moins 3 caractères.');
      return;
    }
    if (message.trim().length < 10) {
      setErreur('Détaillez la demande en au moins 10 caractères.');
      return;
    }
    onCreer({ projet: projet || null, objet: objet.trim(), message: message.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau ticket">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Espace client</p>
            <h2 className="!text-[26px]">Nouveau ticket</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          {projets.length > 0 && (
            <div>
              <Label htmlFor="tk-projet">Projet concerné</Label>
              <select id="tk-projet" value={projet} onChange={(e) => setProjet(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                <option value="">— Général —</option>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="tk-objet">Objet</Label>
            <div className="mt-esp-2"><Input id="tk-objet" value={objet} onChange={(e) => { setObjet(e.target.value); setErreur(''); }} placeholder="Ex. Erreur page paiement" /></div>
          </div>
          <div>
            <Label htmlFor="tk-msg">Message</Label>
            <div className="mt-esp-2"><Textarea id="tk-msg" value={message} onChange={(e) => { setMessage(e.target.value); setErreur(''); }} placeholder="Décrivez le problème…" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Envoyer</Button>
        </div>
      </form>
    </div>
  );
}

function ModalePaiement({ facture, onFermer, onPayer }) {
  const [moyen, setMoyen] = useState('mobile_money');
  const [reference, setReference] = useState('');

  const payer = (e) => {
    e.preventDefault();
    if (moyen !== 'especes' && reference.trim().length < 3) return;
    onPayer({ moyen, ref_transaction: reference.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={`Payer ${facture.numero}`}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={payer} className="dg-pop relative w-full max-w-[440px] overflow-hidden rounded-xl bg-gris-0 shadow-ombre-4">
        <div className="flex items-center gap-esp-3 bg-marine-profond px-esp-6 py-esp-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
            <CreditCard size={22} aria-hidden="true" className="text-digi-signal" />
          </span>
          <div>
            <p className="font-titrage text-[15px] font-extrabold text-blanc">Paiement sécurisé</p>
            <p className="font-courant text-[13px] text-digi-brume">Digi Com & Technologies</p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-brume hover:text-blanc">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-esp-4 p-esp-6">
          <div className="rounded-lg bg-gris-100 p-esp-4 text-center">
            <p className="font-mono text-[13px] text-gris-600">{facture.numero}</p>
            <p className="mt-esp-1 font-titrage text-[30px] font-extrabold text-gris-900 dg-tnum">{fCFA(Number(facture.solde ?? 0))}</p>
          </div>
          <div>
            <Label htmlFor="pay-moyen">Moyen de paiement</Label>
            <select id="pay-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]">
              {MOYENS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          {moyen !== 'especes' && (
            <div>
              <Label htmlFor="pay-ref">Référence transaction</Label>
              <div className="mt-esp-2"><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. TX-2026-0001" /></div>
            </div>
          )}
          <Button type="submit" taille="lg" className="w-full" disabled={!PAIEMENT_EN_LIGNE_ACTIF} title={PAIEMENT_EN_LIGNE_ACTIF ? undefined : MESSAGE_PAIEMENT_BIENTOT}><Banknote size={20} aria-hidden="true" /> Payer {fCFA(Number(facture.solde ?? 0))}</Button>
          {!PAIEMENT_EN_LIGNE_ACTIF && <p role="note" className="rounded-md bg-gris-100 p-esp-3 text-center font-courant text-[14px] text-gris-600">{MESSAGE_PAIEMENT_BIENTOT} Logique conservée, activation via VITE_PAIEMENT_ACTIF=true.</p>}
          <p className="dg-legende text-center">Le reçu est généré automatiquement après paiement.</p>
        </div>
      </form>
    </div>
  );
}

function ModaleMail({ mail, onFermer }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={mail.subject}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <div className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Mail reçu · {dateFr(mail.cree_le)}</p>
            <h2 className="!text-[21px]">{mail.subject}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="dg-doc mt-esp-4 rounded-lg bg-gris-100 p-esp-4 font-courant text-[15px] leading-[1.65] text-gris-700" dangerouslySetInnerHTML={{ __html: mail.body_html || '<p>(Message vide)</p>' }} />
        <div className="mt-esp-4 flex justify-end">
          <Button variante="secondaire" taille="sm" onClick={onFermer}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

function DetailProjet({ jalons, bugs, onFermer }) {
  return (
    <div>
      <button type="button" onClick={onFermer} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <X size={16} aria-hidden="true" /> Fermer
      </button>
      <div className="mt-esp-2 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        <Card survol={false}>
          <CardHeader><h2 className="!text-[18px]">Jalons de validation</h2></CardHeader>
          <CardBody className="flex flex-col gap-esp-2">
            {jalons.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun jalon convenu pour le moment.</p>}
            {jalons.map((j) => (
              <div key={j.id} className="flex items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                <div className="min-w-0 flex-1">
                  <p className="font-courant text-[15px] font-semibold text-gris-900">{j.titre}</p>
                  <p className="font-courant text-[13px] text-gris-600">{dateFr(j.date)}</p>
                </div>
                <Badge ton={j.statut === 'valide' ? 'succes' : j.statut === 'en_cours' ? 'info' : 'neutre'}>{JALON_LABEL[j.statut] ?? j.statut}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card survol={false}>
          <CardHeader><h2 className="!text-[18px]">Bugs signalés</h2></CardHeader>
          <CardBody className="flex flex-col gap-esp-2">
            {bugs.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun bug sur ce projet.</p>}
            {bugs.map((b) => (
              <div key={b.numero} className="rounded-lg bg-gris-100 p-esp-3">
                <p className="font-mono text-[13px] text-gris-600">{b.numero}</p>
                <p className="font-courant text-[15px] font-semibold text-gris-900">{b.titre}</p>
                <p className="font-courant text-[13px] text-gris-600">{b.statut}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function EspaceClient() {
  const session = useSession();
  const access = useAuth((s) => s.access);
  const restaurer = useAuth((s) => s.restaurer);
  const logout = useAuth((s) => s.logout);
  const { slug, code } = useParams();
  const naviguer = useNavigate();
  const [, maj] = useReducer((c) => c + 1, 0);
  const [toasts, setToasts] = useState([]);
  const [onglet, setOnglet] = useState('apercu');
  const [modaleTicket, setModaleTicket] = useState(false);
  const [mailVu, setMailVu] = useState(null);
  const [docVu, setDocVu] = useState(null);
  const [projetVu, setProjetVu] = useState(null);
  const [paiement, setPaiement] = useState(null);
  const [menuNotif, setMenuNotif] = useState(false);
  const notifRef = useClickOutside(() => setMenuNotif(false));
  const idToast = useRef(0);

  const [donnees, setDonnees] = useState(null);
  const [recus, setRecus] = useState([]);
  const [mails, setMails] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [lienInvalide, setLienInvalide] = useState(false);
  const [choisirClient, setChoisirClient] = useState(false);
  const [erreurEspace, setErreurEspace] = useState('');
  const entreprise = getEntreprise();

  /* Résolution du compte : /espace/:slug/:code validés ensemble.
     - super_admin : prévisualise via l'URL personnalisée complète (pas de sélecteur en prod) ;
       sans slug -> retour liste Clients pour choisir un lien explicite ;
     - client : toujours son propre compte (le backend filtre). */
  const resoudreClientId = async () => {
    if (session?.role === 'super_admin' && slug) {
      if (/^\d+$/.test(slug) && !code) return { id: Number(slug) };
      const cls = await listerClients({ slug });
      const trouve = (cls.results ?? cls).find((c) => c.slug === slug);
      if (!trouve) return { invalide: true };
      if (code && trouve.code !== code) return { invalide: true };
      return { id: trouve.id };
    }
    if (session?.role === 'super_admin') return { choisir: true };
    return {};
  };

  const charger = async (vivant) => {
    const ok = () => !vivant || vivant.current;
    try {
      setLienInvalide(false);
      setErreurEspace('');
      const cible = await resoudreClientId();
      if (!ok()) return;
      if (cible.invalide) {
        setDonnees(null);
        setLienInvalide(true);
        setChargement(false);
        return;
      }
      if (cible.choisir) {
        setDonnees(null);
        setChoisirClient(true);
        setChargement(false);
        return;
      }
      if (cible.id) {
        const dv = await api.get('/portal/dashboard/', { params: { client: cible.id } }).then((r) => r.data);
        if (!ok()) return;
        setDonnees(dv);
      } else {
        const dv = await dashboardPortal();
        if (!ok()) return;
        setDonnees(dv);
      }
      const [rs, ms] = await Promise.all([listerRecus(), listerMailsEnvoyes()]);
      if (!ok()) return;
      setRecus(rs);
      setMails(ms.slice(0, 20));
    } catch (e) {
      if (ok()) {
        setDonnees(null);
        setErreurEspace(messageErreur(e, 'Chargement impossible.'));
      }
    } finally {
      if (ok()) {
        setChargement(false);
        maj();
      }
    }
  };

  useEffect(() => {
    restaurer();
    if (!access || !session) return;
    const vivant = { current: true };
    setChargement(true);
    charger(vivant);
    return () => { vivant.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, session?.id, session?.role, slug, code]);

  const notifier = (t) => {
    idToast.current += 1;
    const id = idToast.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  };

  if (!access || (session?.role !== 'client' && session?.role !== 'super_admin')) {
    return <ConnexionEspace />;
  }

  /* Un client qui ouvre le slug d'un autre est ramené sur son propre portail. */
  if (session?.role === 'client' && slug && donnees?.client) {
    const ok = [String(donnees.client.id), donnees.client.slug].filter(Boolean);
    if (!ok.includes(slug)) return <Navigate to="/espace" replace />;
  }

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gris-100 p-esp-6">
        <p className="font-courant text-[15px] text-gris-600" role="status">Chargement de votre espace…</p>
      </div>
    );
  }

  /* Super_admin sans slug : retour liste Clients pour ouvrir un lien explicite. */
  if (choisirClient && session?.role === 'super_admin') {
    return <Navigate to="/clients" replace />;
  }

  if (lienInvalide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gris-100 p-esp-6">
        <Card survol={false} className="w-full max-w-[520px]">
          <CardBody className="pt-esp-6 text-center">
            <ShieldAlert size={40} aria-hidden="true" className="mx-auto text-erreur" />
            <h1 className="mt-esp-3 !text-[26px]">Lien invalide</h1>
            <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
              Cette adresse d espace n existe pas — vérifiez le slug et le code à 4 chiffres.
            </p>
            <div className="mt-esp-5 flex justify-center gap-esp-3">
              <Link to="/clients" className="inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">Voir les clients</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!donnees?.client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gris-100 p-esp-6">
        <Card survol={false} className="w-full max-w-[520px]">
          <CardBody className="pt-esp-6 text-center">
            <ShieldAlert size={40} aria-hidden="true" className="mx-auto text-alerte" />
            <h1 className="mt-esp-3 !text-[26px]">Aucun espace à afficher</h1>
            <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
              {erreurEspace || (session?.role === 'super_admin'
                ? 'Aucun compte client existant. Créez le premier depuis Clients → Nouveau client.'
                : 'Aucun compte client lié à votre profil. Contactez l agence.')}
            </p>
            <div className="mt-esp-5 flex justify-center gap-esp-3">
              {erreurEspace ? (
                <button type="button" onClick={() => { setChargement(true); charger(); }} className="inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">Réessayer</button>
              ) : session?.role === 'super_admin' ? (
                <Link to="/clients" className="inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">Voir les clients</Link>
              ) : (
                <Link to="/login" className="inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">Connexion</Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const client = {
    id: donnees.client.id,
    societe: donnees.client.nom_societe,
    contact: donnees.client.contact || '',
  };
  const projets = (donnees.projets ?? []).map((p) => ({
    id: p.id, nom: p.titre, type: TYPES_PROJET[p.type] ?? p.type,
    statut: STATUTS_PROJET[p.statut] ?? p.statut, deadline: dateFr(p.deadline), avancement: p.progression ?? 0,
  }));
  const jalonsParProjet = {};
  (donnees.jalons ?? []).forEach((j) => {
    const pid = j.project;
    (jalonsParProjet[pid] = jalonsParProjet[pid] ?? []).push(j);
  });
  const bugsParProjet = {};
  (donnees.bugs ?? []).forEach((b) => {
    (bugsParProjet[b.project] = bugsParProjet[b.project] ?? []).push(b);
  });
  const factures = (donnees.factures ?? []).map((f) => ({
    id: f.id, numero: f.numero, objet: '', montant: fCFA(Number(f.total ?? 0)), total: Number(f.total ?? 0),
    solde: Number(f.solde ?? 0), statut: LABEL_FACTURE[f.statut] ?? f.statut, statutId: f.statut,
    type_doc: f.type_doc ?? 'facture', typeDoc: f.type_doc ?? 'facture',
    date: dateFr(f.cree_le), lignes: f.lignes ?? [],
  }));
  const impayees = factures.filter((f) => f.statutId !== 'payee');
  const reste = impayees.reduce((s, f) => s + f.solde, 0);
  const devis = (donnees.devis ?? []).map((d) => ({
    id: d.id, numero: numeroDevis(d), objet: d.objet, montant: fCFA(Number(d.total ?? 0)),
    validite: dateFr(d.validite), statut: LABEL_DEVIS[d.statut] ?? d.statut, statutId: d.statut, lignes: d.lignes ?? [],
  }));
  const tickets = (donnees.tickets ?? []).map((t) => ({
    id: t.id, numero: t.numero, objet: t.sujet, projet: t.project_titre ?? '',
    statut: LABEL_TICKET[t.statut] ?? t.statut, delai: ilYa(t.cree_le),
  }));
  const ticketsOuverts = tickets.filter((t) => !['Clos', 'Rejeté'].includes(t.statut));
  const prochaines = [...projets].sort((a, b) => (a.deadline > b.deadline ? 1 : -1)).slice(0, 3);

  const notifications = [
    ...devis.filter((d) => d.statutId === 'en_attente').map((d) => ({ Icone: FileText, texte: `Devis à valider : ${d.numero}`, cible: 'devis' })),
    ...impayees.map((f) => ({ Icone: Receipt, texte: `Facture à régler : ${f.numero}`, cible: 'factures' })),
    ...ticketsOuverts.filter((t) => t.statut === 'Répondu').map((t) => ({ Icone: TicketIcon, texte: `Réponse reçue : ${t.objet}`, cible: 'tickets' })),
    ...mails.slice(0, 5).map((m) => ({ Icone: Mails, texte: `Nouveau mail : ${m.subject}`, cible: 'mails' })),
  ];

  /* Compteurs sur les onglets, en plus de la cloche. */
  const compteursOnglets = {
    devis: devis.filter((d) => d.statutId === 'en_attente').length,
    factures: impayees.length,
    tickets: ticketsOuverts.length,
    mails: mails.length,
  };

  const creerTicket = async ({ projet, objet, message }) => {
    try {
      const t = await creerTicketApi({ client: client.id, project: projet ? Number(projet) : null, sujet: objet, message, priorite: 'normale', categorie: '' });
      setModaleTicket(false);
      notifier({ type: 'succes', titre: 'Ticket envoyé', texte: `${t.numero} — le secrétariat vous répond sous 24h.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  const payer = async ({ moyen, ref_transaction }) => {
    try {
      const recu = await payerFacture(paiement.id, { montant: Number(paiement.solde), moyen, ref_transaction });
      setPaiement(null);
      setOnglet('factures');
      notifier({ type: 'succes', titre: 'Paiement reçu', texte: `${paiement.numero} soldée — reçu ${recu.numero} généré automatiquement.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Paiement impossible', texte: messageErreur(e) });
    }
  };

  const validerDevis = async (d) => {
    try {
      const f = await validerDevisApi(d.id);
      notifier({ type: 'succes', titre: 'Devis accepté', texte: `${d.numero} converti en facture ${f.numero}.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Validation impossible', texte: messageErreur(e) });
    }
  };

  const refuserDevis = async (d) => {
    try {
      await rejeterDevis(d.id);
      notifier({ type: 'info', titre: 'Devis refusé', texte: `${d.numero} signalé refusé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const voirRecu = async (r) => {
    try {
      const facture = await detailFacture(r.invoice);
      setDocVu({
        type: 'recu', numero: r.numero,
        lignes: (facture.lignes ?? []).map((l) => ({ description: l.description, quantite: Number(l.quantite), montant: Number(l.montant) })),
        facture: facture.numero, montant: String(r.montant),
      });
    } catch (e) {
      notifier({ type: 'info', titre: 'Affichage impossible', texte: messageErreur(e) });
    }
  };

  const docFacture = docVu?.type === 'facture' ? factures.find((f) => f.numero === docVu.numero) : null;
  const docDevis = docVu?.type === 'devis' ? devis.find((d) => d.numero === docVu.numero) : null;

  const deconnexion = () => {
    logout();
    naviguer('/login');
  };

  if (docFacture) {
    const doc = {
      numero: docFacture.numero, date: docFacture.date, statut: docFacture.statut,
      typeDoc: docFacture.type_doc ?? docFacture.typeDoc ?? 'facture',
      lignes: (docFacture.lignes ?? []).map((l) => ({ description: l.description, quantite: Number(l.quantite), montant: Number(l.montant) })),
    };
    return (
      <div className="min-h-screen bg-gris-100">
        <div className="dg-no-print mx-auto flex w-full max-w-[800px] flex-wrap items-center gap-esp-3 px-esp-5 py-esp-4">
          <button type="button" onClick={() => setDocVu(null)} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
            <X size={16} aria-hidden="true" /> Mes factures
          </button>
          <span className="mr-auto" />
          <Button variante="secondaire" taille="sm" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimer / PDF</Button>
        </div>
        <div className="px-esp-5 pb-esp-8"><FactureDoc facture={doc} entreprise={entreprise} /></div>
      </div>
    );
  }

  if (docVu?.type === 'recu' && docVu.lignes) {
    return (
      <div className="min-h-screen bg-gris-100">
        <div className="dg-no-print mx-auto flex w-full max-w-[800px] flex-wrap items-center gap-esp-3 px-esp-5 py-esp-4">
          <button type="button" onClick={() => setDocVu(null)} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
            <X size={16} aria-hidden="true" /> Mes reçus
          </button>
          <span className="mr-auto" />
          <Button variante="secondaire" taille="sm" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimer / PDF</Button>
        </div>
        <div className="px-esp-5 pb-esp-8"><RecuDoc recu={docVu} entreprise={entreprise} /></div>
      </div>
    );
  }

  if (docDevis) {
    const doc = {
      numero: docDevis.numero, objet: docDevis.objet, client: client.societe,
      espaceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      date: dateFr(new Date().toISOString()), validite: docDevis.validite, statut: docDevis.statut,
      lignes: (docDevis.lignes ?? []).map((l) => ({ description: l.description, quantite: Number(l.quantite), montant: Number(l.montant) })),
    };
    return (
      <div className="min-h-screen bg-gris-100">
        <div className="dg-no-print mx-auto flex w-full max-w-[800px] flex-wrap items-center gap-esp-3 px-esp-5 py-esp-4">
          <button type="button" onClick={() => setDocVu(null)} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
            <X size={16} aria-hidden="true" /> Mes devis
          </button>
          <span className="mr-auto" />
          <Button variante="secondaire" taille="sm" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimer / PDF</Button>
        </div>
        <div className="px-esp-5 pb-esp-8"><DevisDoc devis={doc} entreprise={entreprise} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gris-100">
      <header className="border-b border-gris-300 bg-marine-profond">
        <div className="mx-auto flex w-full max-w-grille flex-wrap items-center gap-esp-3 px-esp-5 py-esp-4">
          <Logo hauteur={40} />
          <div className="min-w-0">
            <p className="font-titrage text-[15px] font-extrabold tracking-[0.06em] text-blanc">ESPACE CLIENT</p>
            <p className="truncate font-courant text-[15px] text-digi-brume">{client.societe} — {client.contact}</p>
          </div>
          <div className="ml-auto flex items-center gap-esp-2">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setMenuNotif((m) => !m)}
                aria-label={`Notifications, ${notifications.length} non lues`}
                className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-brume hover:bg-white/5 hover:text-blanc"
              >
                <Bell size={20} aria-hidden="true" />
                {notifications.length > 0 && (
                  <span className="absolute right-esp-1 top-esp-1 flex h-4 min-w-4 items-center justify-center rounded-pilule bg-erreur px-1 font-courant text-[13px] font-bold leading-none text-blanc">
                    {notifications.length}
                  </span>
                )}
              </button>
              {menuNotif && (
                <div className="dg-pop absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-lg border border-gris-300 bg-gris-0 p-esp-2 shadow-ombre-4">
                  <p className="px-esp-3 pb-esp-1 pt-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Notifications</p>
                  {notifications.length === 0 && <p className="px-esp-3 py-esp-2 font-courant text-[15px] text-gris-600">Rien à signaler — tout est à jour.</p>}
                  {notifications.slice(0, 6).map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setMenuNotif(false); setProjetVu(null); setOnglet(n.cible); }}
                      className="flex w-full items-center gap-esp-3 rounded-lg p-esp-3 text-left hover:bg-gris-100"
                    >
                      <n.Icone size={18} aria-hidden="true" className="shrink-0 text-digi" />
                      <span className="flex-1 font-courant text-[15px] text-gris-900">{n.texte}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={deconnexion} className="inline-flex min-h-[44px] items-center gap-esp-2 rounded-md px-esp-3 font-courant text-[14px] font-semibold text-digi-brume hover:bg-white/5 hover:text-blanc">
              <LogOut size={18} aria-hidden="true" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      {session.role === 'super_admin' && (
        <div className="mx-auto w-full max-w-grille px-esp-5 pt-esp-4">
          <Alert ton="info" titre="Aperçu Super Admin">Vous prévisualisez le portail tel que le client le voit. Données filtrées : client_id = {client.id}.</Alert>
        </div>
      )}

      <main className="mx-auto w-full max-w-grille px-esp-5 py-esp-6">
        <Card survol={false} className="dg-fond-marine border-0">
          <CardBody className="pt-esp-5">
            <p className="font-titrage text-[21px] font-extrabold text-blanc">Bienvenue sur votre espace, {client.contact}</p>
            <p className="mt-esp-1 max-w-[70ch] font-courant text-[15px] text-digi-brume">
              Suivez vos projets et leurs étapes, réglez vos factures,
              échangez avec l agence — sans appeler.
            </p>
          </CardBody>
        </Card>
        {!projetVu && (
          <div className="dg-scroll-x mt-esp-4 flex gap-esp-2 overflow-x-auto pb-esp-2" role="tablist" aria-label="Sections espace client">
            {ONGLETS.map(({ id, libelle, Icone }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={onglet === id}
                onClick={() => setOnglet(id)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-esp-2 rounded-pilule border px-esp-4 font-courant text-[15px] font-semibold ${onglet === id ? 'border-marine-profond bg-marine-profond text-blanc' : 'border-gris-300 bg-gris-0 text-gris-600 hover:text-gris-900'}`}
              >
                <Icone size={18} aria-hidden="true" /> {libelle}
                {(compteursOnglets[id] ?? 0) > 0 && (
                  <span className={`rounded-pilule px-esp-2 py-0.5 font-courant text-[13px] font-bold dg-tnum ${onglet === id ? 'bg-white/20 text-blanc' : 'bg-erreur text-blanc'}`}>{compteursOnglets[id]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {projetVu ? (
          <div className="mt-esp-2">
            <DetailProjet
              projet={projets.find((p) => p.id === projetVu)}
              jalons={jalonsParProjet[projetVu] ?? []}
              bugs={(bugsParProjet[projetVu] ?? []).map((b) => ({ numero: b.numero, titre: b.titre, statut: b.statut }))}
              onFermer={() => setProjetVu(null)}
            />
          </div>
        ) : onglet === 'apercu' && (
          <div className="mt-esp-6 flex flex-col gap-esp-4">
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card survol={false}><CardBody className="pt-esp-5">
                <p className="dg-surtitre">Projets en cours</p>
                <p className="mt-esp-2 font-titrage text-[28px] font-extrabold text-gris-900 dg-tnum">{projets.length}</p>
                <button type="button" onClick={() => setOnglet('projets')} className="mt-esp-1 font-courant text-[15px] font-semibold text-digi-texte">Voir mes projets</button>
              </CardBody></Card>
              <Card survol={false}><CardBody className="pt-esp-5">
                <p className="dg-surtitre">À régler</p>
                <p className="mt-esp-2 font-titrage text-[28px] font-extrabold text-gris-900 dg-tnum">{reste.toLocaleString('fr-FR')} F</p>
                <p className="font-courant text-[15px] text-gris-600 dg-tnum">{impayees.length} facture{impayees.length > 1 ? 's' : ''} impayée{impayees.length > 1 ? 's' : ''}</p>
              </CardBody></Card>
              <Card survol={false}><CardBody className="pt-esp-5">
                <p className="dg-surtitre">Tickets ouverts</p>
                <p className="mt-esp-2 font-titrage text-[28px] font-extrabold text-gris-900 dg-tnum">{ticketsOuverts.length}</p>
                <button type="button" onClick={() => setOnglet('tickets')} className="mt-esp-1 font-courant text-[15px] font-semibold text-digi-texte">Suivre mes tickets</button>
              </CardBody></Card>
            </div>
            <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
              <Card survol={false}>
                <CardHeader><h2 className="!text-[18px]">Prochaines échéances</h2></CardHeader>
                <CardBody className="flex flex-col gap-esp-2">
                  {prochaines.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun projet en cours.</p>}
                  {prochaines.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProjetVu(p.id)} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3 text-left hover:bg-gris-200">
                      <div className="min-w-0 flex-1">
                        <p className="font-courant text-[15px] font-semibold text-gris-900">{p.nom}</p>
                        <p className="font-courant text-[13px] text-gris-600 dg-tnum">Deadline {p.deadline} · {p.avancement} %</p>
                      </div>
                      <div className="h-2 w-28 overflow-hidden rounded-pilule bg-gris-200" role="progressbar" aria-valuenow={p.avancement} aria-valuemin="0" aria-valuemax="100">
                        <div className="h-full rounded-pilule" style={{ width: `${p.avancement}%`, background: 'var(--degrade-bleu)' }} />
                      </div>
                    </button>
                  ))}
                </CardBody>
              </Card>
              <Card survol={false}>
                <CardHeader><h2 className="!text-[18px]">Dernières factures</h2></CardHeader>
                <CardBody className="flex flex-col gap-esp-2">
                  {factures.slice(0, 3).length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucune facture.</p>}
                  {factures.slice(0, 3).map((f) => (
                    <div key={f.numero} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-courant text-[15px] font-semibold text-gris-900">{f.numero}</p>
                        <p className="font-mono text-[13px] text-gris-600 dg-tnum">{f.montant}</p>
                      </div>
                      <Badge ton={TONS_FACTURE[f.statutId] || 'neutre'}>{f.statut}</Badge>
                      {f.statutId !== 'payee' && (
                        <Button taille="sm" onClick={() => setPaiement(f)} title={PAIEMENT_EN_LIGNE_ACTIF ? undefined : MESSAGE_PAIEMENT_BIENTOT}><Banknote size={16} aria-hidden="true" /> {PAIEMENT_EN_LIGNE_ACTIF ? 'Payer' : 'Payer (bientôt)'}</Button>
                      )}
                      <Button taille="sm" variante="secondaire" onClick={() => setDocVu({ type: 'facture', numero: f.numero })}><Eye size={16} aria-hidden="true" /> Voir</Button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {!projetVu && onglet === 'projets' && (
          <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
            {projets.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun projet.</p>}
            {projets.map((p) => (
              <Card key={p.id} survol={false}>
                <CardHeader>
                  <h2 className="!text-[18px]">{p.nom}</h2>
                  <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{p.type} · {p.statut} · deadline {p.deadline}</p>
                </CardHeader>
                <CardBody>
                  <div className="flex items-center gap-esp-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-pilule bg-gris-200" role="progressbar" aria-valuenow={p.avancement} aria-valuemin="0" aria-valuemax="100">
                      <div className="h-full rounded-pilule" style={{ width: `${p.avancement}%`, background: 'var(--degrade-bleu)' }} />
                    </div>
                    <span className="font-mono text-[13px] dg-tnum">{p.avancement} %</span>
                  </div>
                  <div className="mt-esp-3 flex justify-end">
                    <Button taille="sm" variante="secondaire" onClick={() => setProjetVu(p.id)}><Eye size={16} aria-hidden="true" /> Ouvrir le projet</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {!projetVu && onglet === 'devis' && (
          <Card survol={false} className="mt-esp-6">
            <CardHeader>
              <h2 className="!text-[18px]">Mes devis</h2>
              <p className="mt-esp-1 font-courant text-[14px] text-gris-600">Validez pour transformer en facture, ou refusez — l admin est notifié dans les deux cas.</p>
            </CardHeader>
            <CardBody className="flex flex-col gap-esp-2">
              {devis.length === 0 && <p className="text-center font-courant text-[15px] text-gris-600">Aucun devis.</p>}
              {devis.map((d) => (
                <div key={d.numero} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[13px] text-gris-600">{d.numero}</p>
                    <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{d.objet}</p>
                    <p className="font-courant text-[13px] text-gris-600 dg-tnum">{d.montant} · valable jusqu au {d.validite}</p>
                  </div>
                  <Badge ton={TONS_DEVIS[d.statutId] || 'neutre'}>{d.statut}</Badge>
                  <span className="flex gap-esp-2">
                    <Button taille="sm" variante="secondaire" onClick={() => setDocVu({ type: 'devis', numero: d.numero })}><Eye size={16} aria-hidden="true" /> Voir</Button>
                    {d.statutId === 'en_attente' && (
                      <>
                        <Button taille="sm" onClick={() => validerDevis(d)}><Check size={16} aria-hidden="true" /> Valider</Button>
                        <Button taille="sm" variante="fantome" onClick={() => refuserDevis(d)}><X size={16} aria-hidden="true" /> Rejeter</Button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {!projetVu && onglet === 'factures' && (
          <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
            <Card survol={false}>
              <CardHeader><h2 className="!text-[18px]">Mes factures</h2></CardHeader>
              <CardBody className="flex flex-col gap-esp-2">
                {factures.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucune facture.</p>}
                {factures.map((f) => (
                  <div key={f.numero} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] text-gris-600">{f.numero}</span>
                      <span className="block truncate font-courant text-[15px] font-semibold text-gris-900">{f.montant}</span>
                      <span className="block font-courant text-[13px] text-gris-600 dg-tnum">{f.date}</span>
                    </span>
                    <Badge ton={TONS_FACTURE[f.statutId] || 'neutre'}>{f.statut}</Badge>
                    <span className="flex gap-esp-1">
                      {f.statutId !== 'payee' && (
                        <Button taille="sm" onClick={() => setPaiement(f)} title={PAIEMENT_EN_LIGNE_ACTIF ? undefined : MESSAGE_PAIEMENT_BIENTOT}><Banknote size={16} aria-hidden="true" /> {PAIEMENT_EN_LIGNE_ACTIF ? 'Payer' : 'Payer (bientôt)'}</Button>
                      )}
                      <Button taille="sm" variante="secondaire" onClick={() => setDocVu({ type: 'facture', numero: f.numero })}><Eye size={16} aria-hidden="true" /> Voir</Button>
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card survol={false}>
              <CardHeader><h2 className="!text-[18px]">Mes reçus</h2></CardHeader>
              <CardBody className="flex flex-col gap-esp-2">
                {recus.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun reçu — ils sont générés automatiquement après chaque paiement.</p>}
                {recus.map((r) => (
                  <button key={r.numero} type="button" onClick={() => voirRecu(r)} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3 text-left hover:bg-gris-200">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] text-gris-600">{r.numero}</span>
                      <span className="block font-courant text-[15px] font-semibold text-gris-900">{fCFA(Number(r.montant ?? 0))}</span>
                      <span className="block font-courant text-[13px] text-gris-600 dg-tnum">{dateFr(r.cree_le)}</span>
                    </span>
                    <Badge ton="succes">Payé</Badge>
                  </button>
                ))}
              </CardBody>
            </Card>
          </div>
        )}

        {!projetVu && onglet === 'tickets' && (
          <div className="mt-esp-6">
            <div className="flex justify-end">
              <Button onClick={() => setModaleTicket(true)}><Plus size={20} aria-hidden="true" /> Créer un ticket</Button>
            </div>
            <Card survol={false} className="mt-esp-4">
              <CardBody className="flex flex-col gap-esp-2 pt-esp-5">
                {tickets.length === 0 && <p className="text-center font-courant text-[15px] text-gris-600">Aucun ticket. Décrivez votre besoin, le secrétariat répond sous 24h.</p>}
                {tickets.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-courant text-[15px] font-semibold text-gris-900">{t.objet}</p>
                      <p className="font-mono text-[13px] text-gris-600">{t.numero} · {t.projet} · {t.delai}</p>
                    </div>
                    <Badge ton={TONS_TICKET[t.statut] ?? 'neutre'}>{t.statut}</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        )}

        {!projetVu && onglet === 'mails' && (
          <Card survol={false} className="mt-esp-6">
            <CardBody className="flex flex-col gap-esp-2 pt-esp-5">
              {mails.length === 0 && <p className="text-center font-courant text-[15px] text-gris-600">Aucun mail reçu du hub pour le moment.</p>}
              {mails.map((m) => (
                <button key={m.id} type="button" onClick={() => setMailVu(m.id)} className="rounded-lg bg-gris-100 p-esp-3 text-left hover:bg-gris-200">
                  <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{m.subject}</p>
                  <p className="font-courant text-[13px] text-gris-600 dg-tnum">{dateFr(m.cree_le)} · cliquer pour lire</p>
                </button>
              ))}
            </CardBody>
          </Card>
        )}
      </main>

      {modaleTicket && <ModaleTicket projets={projets} onFermer={() => setModaleTicket(false)} onCreer={creerTicket} />}
      {paiement && <ModalePaiement facture={paiement} onFermer={() => setPaiement(null)} onPayer={payer} />}
      {mailVu && (() => {
        const mail = mails.find((m) => m.id === mailVu);
        return mail ? <ModaleMail mail={mail} onFermer={() => setMailVu(null)} /> : null;
      })()}

      <footer className="dg-no-print mt-esp-8 bg-marine-footer">
        <div className="mx-auto flex w-full max-w-grille flex-wrap items-center gap-x-esp-6 gap-y-esp-2 px-esp-5 py-esp-5">
          <span className="flex items-center gap-esp-2">
            <Logo hauteur={28} />
            <span className="font-titrage text-[13px] font-extrabold tracking-[0.06em] text-blanc">Digi Com & Technologies</span>
          </span>
          <p className="font-courant text-[13px] text-digi-brume">{entreprise.adresse} · {entreprise.phone} · {entreprise.email}</p>
          <p className="ml-auto font-courant text-[13px] text-digi-brume">Espace {client.societe} · HUB DIGI v1.0 · 2026</p>
        </div>
      </footer>
      <Toasts toasts={toasts} fermer={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
