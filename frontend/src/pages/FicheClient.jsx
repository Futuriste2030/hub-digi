import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Send,
  FileText,
  Ticket,
  FolderKanban,
  Megaphone,
  Scale,
  FolderOpen,
  LayoutDashboard,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  Wallet,
  CalendarClock,
  CalendarDays,
  Bug,
  Link2,
  Banknote,
  ScrollText,
  ReceiptText,
  KeyRound,
  MonitorSmartphone,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { CHEFS, ROLES_ADMIN, ROLES_COM, ROLES_DEV, ROLES_FINANCE, ROLES_JURIDIQUE, peutVoir, urlEspace } from '../lib/acces.js';
import { fCFA } from '../utils/stats.js';
import { overviewClient } from '../api/finance.js';
import { payerFacture, telechargerPdf } from '../api/finance.js';
import { envoyerInvitationClient } from '../api/clients.js';
import { listerUsers } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { PAIEMENT_EN_LIGNE_ACTIF, MESSAGE_PAIEMENT_BIENTOT, lienPaiementFacture } from '../lib/paiement.js';
import { NonTrouve } from './Pages.jsx';

/* Fiche Client 360° — API réelle (SPEC §4 : GET /clients/:id/overview/). */

/* Visibilité des onglets par rôle (matrice SPEC §3, null = tous internes). */
const ONGLETS_ROLES = {
  apercu: null,
  projets: ROLES_DEV,
  com: ROLES_COM,
  finance: ROLES_FINANCE,
  juridique: ROLES_JURIDIQUE,
  support: CHEFS,
  documents: null,
};

const ONGLETS = [
  { id: 'apercu', libelle: 'Aperçu', Icone: LayoutDashboard },
  { id: 'projets', libelle: 'Projets', Icone: FolderKanban },
  { id: 'com', libelle: 'Com', Icone: Megaphone },
  { id: 'finance', libelle: 'Finance', Icone: FileText },
  { id: 'juridique', libelle: 'Juridique', Icone: Scale },
  { id: 'support', libelle: 'Tickets et mails', Icone: Ticket },
  { id: 'documents', libelle: 'Documents', Icone: FolderOpen },
];

const STATUT_CLIENT_LABEL = { prospect: 'Prospect', client: 'Client' };
const TYPES_PROJET = { site_web: 'Site web', app_web: 'App web', app_mobile: 'App mobile', autre: 'Autre' };
const STATUTS_PROJET = { a_faire: ['À faire', 'neutre'], en_cours: ['En cours', 'info'], en_review: ['En review', 'alerte'], termine: ['Terminé', 'succes'], en_pause: ['En pause', 'neutre'] };
const STATUTS_CAMPAGNE = { brouillon: ['Brouillon', 'neutre'], en_cours: ['En cours', 'info'], terminee: ['Terminée', 'succes'] };
const STATUTS_PUB = { brouillon: ['Brouillon', 'neutre'], a_valider: ['À valider', 'alerte'], programme: ['Programmé', 'info'], publie: ['Publié', 'succes'] };
const STATUTS_FACTURE = { brouillon: ['Brouillon', 'neutre'], validee: ['Validée', 'info'], envoyee: ['Envoyée', 'info'], partielle: ['Partielle', 'alerte'], payee: ['Payée', 'succes'], impayee: ['Impayée', 'erreur'] };
const STATUTS_TICKET = { nouveau: ['Nouveau', 'info'], qualifie: ['Qualifié', 'alerte'], en_attente_aval: ['En attente aval', 'alerte'], approuve: ['Approuvé', 'info'], repondu: ['Répondu', 'succes'], clos: ['Clos', 'neutre'], rejete: ['Rejeté', 'erreur'] };

function Vide({ texte }) {
  return (
    <p className="rounded-lg bg-gris-100 p-esp-4 text-center font-courant text-[15px] text-gris-600">{texte}</p>
  );
}

function TitreCarte({ Icone, children }) {
  return (
    <span className="flex items-center gap-esp-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
        <Icone size={20} aria-hidden="true" className="text-digi" />
      </span>
      <h2 className="!text-[18px]">{children}</h2>
    </span>
  );
}

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

/* Adapte l'overview API à la forme consommée par les onglets. */
function adapterOverview(ov) {
  const c = ov.client;
  const factures = ov.finance.factures.map((f) => ({
    id: f.id, numero: f.numero, objet: '', total: Number(f.total ?? 0), paye: Number(f.paye ?? 0),
    solde: Number(f.solde ?? 0), statut: f.statut, date: dateFr(f.cree_le),
  }));
  const numerosFactures = Object.fromEntries(factures.map((f) => [f.id, f.numero]));
  return {
    id: c.id,
    slug: c.slug,
    code: c.code,
    societe: c.nom_societe,
    est_interne: !!c.est_interne,
    contact: c.contact || '—',
    email: c.email || '',
    phone: c.phone || '—',
    adresse: c.adresse || '—',
    statut: STATUT_CLIENT_LABEL[c.statut] ?? c.statut,
    tonStatut: c.statut === 'client' ? 'succes' : 'alerte',
    solde: fCFA(ov.finance.solde_impayes ?? 0),
    kpi: {
      projetsActifs: ov.projets.length,
      impayes: fCFA(ov.finance.solde_impayes ?? 0),
      ticketsOuverts: ov.tickets.filter((t) => !['clos', 'rejete', 'repondu'].includes(t.statut)).length,
    },
    projets: ov.projets.map((p) => {
      const [statut, ton] = STATUTS_PROJET[p.statut] ?? [p.statut, 'neutre'];
      return { id: p.id, nom: p.titre, statut, ton, type: TYPES_PROJET[p.type] ?? p.type, avancement: p.progression ?? 0, deadline: dateFr(p.deadline), bugs: 0 };
    }),
    campagnes: ov.com.campagnes.map((m) => {
      const [statut, ton] = STATUTS_CAMPAGNE[m.statut] ?? [m.statut, 'neutre'];
      return { nom: m.titre, statut, ton, canal: m.canal || '—', budget: fCFA(Number(m.budget ?? 0)) };
    }),
    calendrier: ov.com.calendrier.map((p) => {
      const [statut] = STATUTS_PUB[p.statut] ?? [p.statut];
      return { titre: p.titre, canal: p.canal || '—', date: dateFr(p.date_pub), statut };
    }),
    factures,
    recus: ov.finance.recus.map((r) => ({
      numero: r.numero, facture: numerosFactures[r.invoice] ?? '', montant: fCFA(Number(r.montant ?? 0)), date: dateFr(r.cree_le),
    })),
    contrats: ov.juridique.map((k) => ({
      titre: k.titre, statut: k.statut, ton: 'info', type: k.type, fin: dateFr(k.date_fin),
    })),
    tickets: ov.tickets.map((t) => {
      const [statut, ton] = STATUTS_TICKET[t.statut] ?? [t.statut, 'neutre'];
      return { ref: t.numero, delai: ilYa(t.cree_le), objet: t.sujet, statut, ton };
    }),
    mails: (ov.mails ?? []).map((m) => ({ objet: m.subject, date: dateFr(m.cree_le), statut: 'Envoyé' })),
    documents: [],
  };
}

function OngletApercu({ client, compte, onEnvoyerAcces, envoi, peutEcrire, invitationEnvoyee }) {
  const coordonnees = [
    { Icone: User, html: <><strong className="font-semibold text-gris-900">{client.contact}</strong></> },
    { Icone: Mail, html: <span className="font-mono text-[13px]">{client.email || '—'}</span> },
    { Icone: Phone, html: <span className="dg-tnum">{client.phone}</span> },
    { Icone: MapPin, html: <span>{client.adresse}</span> },
  ];
  const indicateurs = [
    { Icone: FolderKanban, lb: 'Projets actifs', v: String(client.kpi.projetsActifs) },
    { Icone: Wallet, lb: 'Impayés', v: client.kpi.impayes },
    { Icone: Ticket, lb: 'Tickets ouverts', v: String(client.kpi.ticketsOuverts) },
  ];
  return (
    <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={User}>Coordonnées</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3 font-courant text-[15px] text-gris-700">
          {coordonnees.map(({ Icone, html }, i) => (
            <p key={i} className="flex items-start gap-esp-3">
              <Icone size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-gris-400" />{html}
            </p>
          ))}
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={LayoutDashboard}>Indicateurs</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {indicateurs.map(({ Icone, lb, v }) => (
            <div key={lb} className="flex items-center gap-esp-3">
              <Icone size={20} aria-hidden="true" className="shrink-0 text-gris-400" />
              <span className="font-courant text-[15px] text-gris-600">{lb}</span>
              <span className="ml-auto font-titrage text-[18px] font-bold text-gris-900 dg-tnum whitespace-nowrap">{v}</span>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={FileText}>Qualification</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          <Badge ton={client.tonStatut}>{client.statut}</Badge>
          <p className="dg-legende">Solde : {client.solde}</p>
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={KeyRound}>Accès espace client</TitreCarte></CardHeader>
        {client.est_interne ? (
          <CardBody>
            <p className="font-courant text-[15px] text-gris-600">
              Client interne (Digi Com) : géré dans le hub uniquement — aucun compte ni espace client.
            </p>
          </CardBody>
        ) : (
        <CardBody className="flex flex-col gap-esp-2 font-courant text-[15px] text-gris-700">
          <p className="flex items-center justify-between gap-esp-2">
            <span className="text-gris-600">Espace</span>
            <Link to={urlEspace(client)} className="font-mono text-[13px] font-semibold text-digi-texte">{urlEspace(client)}</Link>
          </p>
          <p className="flex items-center justify-between gap-esp-2">
            <span className="text-gris-600">Identifiant</span>
            <span className="font-mono text-[13px] text-gris-900">{compte?.username ?? '—'}</span>
          </p>
          <p className="flex items-center justify-between gap-esp-2">
            <span className="text-gris-600">Compte</span>
            <span className="font-courant text-[13px] font-semibold text-gris-900">{compte ? 'Créé' : 'Aucun compte'}</span>
          </p>
          {invitationEnvoyee && (
            <p className="dg-legende">Invitation envoyée — lien d activation 24h. Renvoyer invalide le précédent.</p>
          )}
          {!compte && !invitationEnvoyee && (
            <p className="dg-legende">Aucun mot de passe n est généré : l invitation crée le compte et envoie un lien 24h.</p>
          )}
          {peutEcrire && (
            <span className="flex flex-wrap gap-esp-2">
              <Button taille="sm" onClick={onEnvoyerAcces} disabled={envoi} title="Créer le compte si besoin + envoyer le lien d'activation 24h">
                <Mail size={16} aria-hidden="true" /> {envoi ? 'Envoi…' : compte ? "Renvoyer l'invitation" : 'Envoyer l invitation'}
              </Button>
            </span>
          )}
          <p className="dg-legende">Le client définit lui-même son mot de passe via le lien. Aucun mot de passe par mail.</p>
        </CardBody>
        )}
      </Card>
    </div>
  );
}

function OngletProjets({ client, peutOuvrir }) {
  const naviguer = useNavigate();
  if (client.projets.length === 0) return <Vide texte="Aucun projet. Créez le premier depuis le tableau de bord." />;
  return (
    <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
      {client.projets.map((p) => (
        <Card key={p.id} survol={false}>
          <CardHeader>
            <div className="flex items-center justify-between gap-esp-3">
              <TitreCarte Icone={FolderKanban}>{p.nom}</TitreCarte>
              <Badge ton={p.ton}>{p.statut}</Badge>
            </div>
            <p className="mt-esp-2 font-courant text-[15px] text-gris-600">{p.type}</p>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-esp-2">
              <span className="h-2 flex-1 overflow-hidden rounded-pilule bg-gris-200" role="progressbar" aria-valuenow={p.avancement} aria-valuemin="0" aria-valuemax="100" aria-label={`Avancement ${p.avancement} pour cent`}>
                <span className="block h-full rounded-pilule" style={{ width: `${p.avancement}%`, background: 'var(--degrade-bleu)' }} />
              </span>
              <span className="font-mono text-[13px] text-gris-600 dg-tnum">{p.avancement} %</span>
            </div>
            <div className="mt-esp-3 flex flex-wrap items-center gap-x-esp-4 gap-y-esp-2 font-courant text-[15px] text-gris-600">
              <span className="inline-flex items-center gap-esp-2"><CalendarClock size={16} aria-hidden="true" />{p.deadline}</span>
              <span className="inline-flex items-center gap-esp-2 dg-tnum"><Bug size={16} aria-hidden="true" />{p.bugs} bug{p.bugs > 1 ? 's' : ''}</span>
              {peutOuvrir && (
                <button type="button" onClick={() => naviguer(`/projets/${p.id}`)} className="ml-auto inline-flex min-h-[44px] items-center font-semibold text-digi-texte">
                  Ouvrir le projet
                </button>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function OngletCom({ client }) {
  return (
    <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={Megaphone}>Campagnes</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {client.campagnes.length === 0 && <Vide texte="Aucune campagne pour ce client." />}
          {client.campagnes.map((c) => (
            <div key={c.nom} className="rounded-lg bg-gris-100 p-esp-3">
              <div className="flex items-center justify-between gap-esp-2">
                <p className="font-courant text-[15px] font-semibold text-gris-900">{c.nom}</p>
                <Badge ton={c.ton}>{c.statut}</Badge>
              </div>
              <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{c.canal} · <span className="dg-tnum">{c.budget}</span></p>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={CalendarDays}>Calendrier éditorial</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {client.calendrier.length === 0 && <Vide texte="Rien de planifié. Ajoutez une publication." />}
          {client.calendrier.map((e) => (
            <div key={e.titre} className="flex items-center gap-esp-3">
              <span className="rounded-md bg-digi-voile px-esp-2 py-esp-1 font-mono text-[13px] text-digi dg-tnum">{e.date}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{e.titre}</p>
                <p className="font-courant text-[15px] text-gris-600">{e.canal}</p>
              </div>
              <Badge ton={e.statut === 'À valider' ? 'alerte' : 'info'}>{e.statut}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

const lienPaiement = (numero) => lienPaiementFacture(numero);

function OngletFinance({ client, notifier, onFait }) {
  const total = client.factures.reduce((s, f) => s + f.total, 0);
  const encaisse = client.factures.filter((f) => f.statut === 'payee').reduce((s, f) => s + f.total, 0);

  const pdf = async (numero, id, kind) => {
    try {
      await telechargerPdf(`/finance/${kind}/${id}/pdf/`, `${numero}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  const copierLien = async (f) => {
    if (!PAIEMENT_EN_LIGNE_ACTIF) {
      notifier({ type: 'info', titre: 'Paiement en ligne bientôt disponible', texte: MESSAGE_PAIEMENT_BIENTOT });
      return;
    }
    try {
      await navigator.clipboard.writeText(lienPaiement(f.numero));
    } catch {
      /* presse-papiers indisponible */
    }
    notifier({ type: 'info', titre: 'Lien copié', texte: `Lien de paiement ${f.numero} copié. Partagez-le au client.` });
  };

  const payer = async (f) => {
    try {
      const recu = await payerFacture(f.id, { montant: f.solde, moyen: 'especes' });
      notifier({ type: 'succes', titre: 'Paiement reçu', texte: `${f.numero} soldée. ${recu.numero} généré.` });
      onFait();
    } catch (e) {
      notifier({ type: 'info', titre: 'Encaissement impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-esp-4">
      <div className="flex flex-col gap-esp-4 lg:flex-row">
        {[
          { Icone: FileText, lb: 'Total facturé', v: fCFA(total) },
          { Icone: Wallet, lb: 'Encaissé', v: fCFA(encaisse) },
          { Icone: CalendarClock, lb: 'Reste à recevoir', v: fCFA(total - encaisse) },
        ].map(({ Icone, lb, v }) => (
          <Card key={lb} survol={false} className="flex-1">
            <CardBody className="flex items-center gap-esp-4 pt-esp-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <Icone size={20} aria-hidden="true" className="text-digi" />
              </span>
              <span className="min-w-0">
                <span className="block font-courant text-[15px] text-gris-600">{lb}</span>
                <span className="block font-titrage text-[18px] font-bold text-gris-900 dg-tnum whitespace-nowrap">{v}</span>
              </span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card survol={false}>
        <CardHeader><TitreCarte Icone={FileText}>Factures</TitreCarte></CardHeader>
        <CardBody className="overflow-x-auto">
          {client.factures.length === 0 && <Vide texte="Aucune facture. Créez un devis puis convertissez." />}
          {client.factures.length > 0 && (
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gris-300">
                  {['Facture', 'Montant', 'Statut', 'Paiement'].map((col) => (
                    <th key={col} scope="col" className="pb-esp-2 pr-esp-3 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {client.factures.map((f) => {
                  const [statutLabel, ton] = STATUTS_FACTURE[f.statut] ?? [f.statut, 'neutre'];
                  return (
                  <tr key={f.numero} className="border-b border-gris-200 align-top last:border-0">
                    <td className="py-esp-3 pr-esp-3">
                      <span className="font-mono text-[13px] text-gris-700">{f.numero}</span>
                      <span className="block font-courant text-[13px] text-gris-600">{f.date}{f.type_doc === 'proforma' ? ' · Proforma' : ''}</span>
                    </td>
                    <td className="py-esp-3 pr-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(f.total)}</td>
                    <td className="py-esp-3 pr-esp-3"><Badge ton={ton}>{statutLabel}</Badge></td>
                    <td className="py-esp-3">
                      {f.statut === 'payee' ? (
                        <Badge ton="succes">Soldée</Badge>
                      ) : (
                        <span className="flex flex-wrap items-center gap-esp-2">
                          <button
                            type="button"
                            onClick={() => copierLien(f)}
                            title={PAIEMENT_EN_LIGNE_ACTIF ? `Copier le lien de paiement ${f.numero}` : MESSAGE_PAIEMENT_BIENTOT}
                            aria-label={`Copier le lien de paiement ${f.numero}`}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gris-300 text-digi-texte transition-colors duration-rapide hover:bg-digi-voile"
                          >
                            <Link2 size={20} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => payer(f)}
                            title="Encaisser le solde (guichet)"
                            className="inline-flex min-h-[44px] items-center gap-esp-2 rounded-md bg-digi px-esp-3 font-courant text-[15px] font-semibold text-blanc shadow-ombre-1 transition-colors duration-rapide hover:brightness-90"
                          >
                            <Banknote size={20} aria-hidden="true" /> Encaisser
                          </button>
                          <button
                            type="button"
                            onClick={() => pdf(f.numero, f.id, 'invoices')}
                            aria-label={`Télécharger ${f.numero}`}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile"
                          >
                            <Download size={20} aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="dg-legende mt-esp-3">Le bouton Encaisser enregistre un règlement guichet (espèces/virement) : reçu auto + e-mail au client. Paiement en ligne via lien : bientôt disponible.</p>
        </CardBody>
      </Card>

      <Card survol={false}>
        <CardHeader><TitreCarte Icone={ReceiptText}>Reçus</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {client.recus.length === 0 && <Vide texte="Aucun reçu. Un reçu PDF naît à chaque paiement." />}
          {client.recus.map((r) => (
            <div key={r.numero} className="flex items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
              <ReceiptText size={20} aria-hidden="true" className="shrink-0 text-succes" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] text-gris-700">{r.numero} · {r.facture}</p>
                <p className="font-courant text-[15px] text-gris-600 dg-tnum">{r.montant} · {r.date}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function OngletJuridique({ client }) {
  if (client.contrats.length === 0) return <Vide texte="Aucun contrat. Ajoutez le premier depuis un modèle." />;
  return (
    <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
      {client.contrats.map((c) => (
        <Card key={c.titre} survol={false}>
          <CardHeader>
            <div className="flex items-center justify-between gap-esp-3">
              <TitreCarte Icone={ScrollText}>{c.titre}</TitreCarte>
              <Badge ton={c.ton}>{c.statut}</Badge>
            </div>
            <p className="mt-esp-2 flex items-center gap-esp-2 font-courant text-[15px] text-gris-600">
              {c.type} · <CalendarClock size={16} aria-hidden="true" /> Échéance {c.fin}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function OngletSupport({ client }) {
  return (
    <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={Ticket}>Tickets</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {client.tickets.length === 0 && <Vide texte="Aucun ticket. Le client ouvre depuis son espace." />}
          {client.tickets.map((t) => (
            <div key={t.ref} className="flex items-start gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
              <Ticket size={20} aria-hidden="true" className="mt-esp-1 shrink-0 text-digi" />
              <div className="min-w-0">
                <p className="font-mono text-[13px] text-gris-600">{t.ref} · {t.delai}</p>
                <p className="font-courant text-[15px] font-semibold text-gris-900">{t.objet}</p>
                <Badge ton={t.ton} className="mt-esp-1">{t.statut}</Badge>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><TitreCarte Icone={Send}>E-mails</TitreCarte></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          {client.mails.length === 0 && <Vide texte="Aucun e-mail. Envoyez depuis la page E-mails." />}
          {client.mails.map((m, i) => (
            <div key={i} className="flex items-start gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
              <Send size={20} aria-hidden="true" className="mt-esp-1 shrink-0 text-digi" />
              <div className="min-w-0">
                <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{m.objet}</p>
                <p className="font-courant text-[15px] text-gris-600">{m.date} · {m.statut}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function OngletDocuments({ client, notifier }) {
  if (client.documents.length === 0) return <Vide texte="Aucun document. Les médias et contrats alimenteront cet onglet." />;
  return (
    <Card survol={false}>
      <CardHeader><TitreCarte Icone={FolderOpen}>Documents</TitreCarte></CardHeader>
      <CardBody className="flex flex-col gap-esp-3">
        {client.documents.map((d) => (
          <div key={d.nom} className="flex items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
            <FileText size={20} aria-hidden="true" className="shrink-0 text-digi" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{d.nom}</p>
              <p className="font-courant text-[13px] text-gris-600">{d.meta}</p>
            </div>
            <button type="button" onClick={() => notifier({ type: 'info', titre: 'Document téléchargé', texte: d.nom })} aria-label={`Télécharger ${d.nom}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
              <Download size={20} aria-hidden="true" />
            </button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default function FicheClient() {
  const { id } = useParams();
  const { notifier, session } = useOutletContext();
  const naviguer = useNavigate();
  const [onglet, setOnglet] = useState('apercu');
  const [client, setClient] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreurChargement, setErreurChargement] = useState('');
  const [compte, setCompte] = useState(null);
  const [envoiAcces, setEnvoiAcces] = useState(false);
  const [invitationEnvoyee, setInvitationEnvoyee] = useState(false);

  const charger = async () => {
    setErreurChargement('');
    try {
      const ov = await overviewClient(id);
      setClient(adapterOverview(ov));
      try {
        const us = await listerUsers({ client: id, role: 'client' });
        setCompte(us[0] ?? null);
      } catch {
        setCompte(null);
      }
    } catch (e) {
      if (e.response?.status === 404) setIntrouvable(true);
      else {
        setErreurChargement(messageErreur(e, 'Chargement impossible.'));
        notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
      }
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (introuvable) return <NonTrouve />;

  /* Écriture et accès sensibles réservés à l'Administration (super_admin, admin). */
  const peutEcrire = client ? peutVoir(session, ROLES_ADMIN) : false;
  const ongletsVisibles = ONGLETS.filter((o) => {
    const roles = ONGLETS_ROLES[o.id];
    return !roles || peutVoir(session, roles);
  });
  const ongletActif = ongletsVisibles.some((o) => o.id === onglet) ? onglet : 'apercu';
  const voitProjets = ongletsVisibles.some((o) => o.id === 'projets');

  /* Accès espace : invitation sécurisée — le back crée le compte sans mdp si
     besoin puis envoie identifiant + lien d'activation 24h (aucun mdp par mail). */

  const envoyerAcces = async () => {
    if (client?.est_interne) {
      notifier({ type: 'info', titre: 'Client interne', texte: 'Aucun accès espace client pour un client interne.' });
      return;
    }
    if (envoiAcces) return;
    if (!client?.email) {
      notifier({ type: 'info', titre: 'E-mail manquant', texte: "Renseignez l'e-mail sur la fiche client." });
      return;
    }
    setEnvoiAcces(true);
    try {
      const url = `${window.location.origin}${urlEspace(client)}`;
      const res = await envoyerInvitationClient(client.id, { espaceUrl: url });
      if (res?.username) setCompte((c) => ({ ...(c ?? {}), username: res.username }));
      else {
        try {
          const us = await listerUsers({ client: client.id, role: 'client' });
          setCompte(us[0] ?? null);
        } catch {
          /* compte rafraîchi au prochain chargement */
        }
      }
      setInvitationEnvoyee(true);
      notifier({ type: 'succes', titre: 'Invitation envoyée', texte: `Lien d'activation 24h à ${client.email} — le client définit son mot de passe.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    } finally {
      setEnvoiAcces(false);
    }
  };

  if (!client) {
    return (
      <div>
        <Link to="/clients" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Clients
        </Link>
        {erreurChargement ? (
          <div className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center">
            <p className="font-courant text-[15px] text-erreur" role="alert">{erreurChargement}</p>
            <Button taille="sm" className="mt-esp-3" onClick={charger}>Réessayer</Button>
          </div>
        ) : (
          <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement de la fiche…</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Link to="/clients" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Clients
      </Link>
      <div className="mt-esp-2 flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Fiche client 360°</p>
          <h1 className="mt-esp-2">{client.societe}</h1>
          <div className="mt-esp-2 flex flex-wrap items-center gap-esp-2">
            <Badge ton={client.tonStatut}>{client.statut}</Badge>
            {client.est_interne && <Badge ton="info">Interne — sans espace client</Badge>}
            {!client.est_interne && client.slug && client.code && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}${urlEspace(client)}`);
                  } catch {
                    /* presse-papiers indisponible */
                  }
                  notifier({ type: 'info', titre: 'Lien espace copié', texte: urlEspace(client) });
                }}
                title="Copier le lien du portail client"
                className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-mono text-[13px] text-digi-texte transition-colors duration-rapide hover:bg-digi-voile"
              >
                <Link2 size={16} aria-hidden="true" /> {urlEspace(client)}
              </button>
            )}
          </div>
        </div>
        {peutEcrire && (
          <Button variante="secondaire" onClick={() => naviguer(`/mails?client=${client.id}`)}>
            <Send size={20} aria-hidden="true" /> Écrire au client
          </Button>
        )}
        {peutEcrire && !client.est_interne && (
          <Link to={urlEspace(client)} title="Prévisualiser le portail tel que ce client le voit (Administration)" className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-digi px-esp-5 font-titrage text-[15px] font-bold uppercase leading-none tracking-[0.06em] text-digi transition-all duration-standard hover:bg-digi-voile">
            <MonitorSmartphone size={20} aria-hidden="true" /> Voir son espace client
          </Link>
        )}
      </div>

      <div role="tablist" aria-label="Sections de la fiche client" className="dg-scroll-x mt-esp-6 flex gap-esp-1 overflow-x-auto border-b border-gris-300 pb-esp-1">
        {ongletsVisibles.map(({ id: oid, libelle, Icone }) => (
          <button
            key={oid}
            type="button"
            role="tab"
            aria-selected={ongletActif === oid}
            onClick={() => setOnglet(oid)}
            className={`flex min-h-[44px] shrink-0 items-center gap-esp-2 border-b-2 px-esp-3 font-courant text-[15px] transition-colors duration-rapide ${
              ongletActif === oid
                ? 'border-digi-signal font-semibold text-gris-900'
                : 'border-transparent text-gris-600 hover:text-gris-900'
            }`}
          >
            <Icone size={16} aria-hidden="true" className={ongletActif === oid ? 'text-digi' : ''} />
            {libelle}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="dg-fondu mt-esp-5" key={ongletActif}>
        {ongletActif === 'apercu' && <OngletApercu client={client} compte={compte} onEnvoyerAcces={envoyerAcces} envoi={envoiAcces} peutEcrire={peutEcrire} invitationEnvoyee={invitationEnvoyee} />}
        {ongletActif === 'projets' && <OngletProjets client={client} peutOuvrir={voitProjets} />}
        {ongletActif === 'com' && <OngletCom client={client} />}
        {ongletActif === 'finance' && <OngletFinance key={client.id} client={client} notifier={notifier} onFait={charger} />}
        {ongletActif === 'juridique' && <OngletJuridique client={client} />}
        {ongletActif === 'support' && <OngletSupport client={client} />}
        {ongletActif === 'documents' && <OngletDocuments client={client} notifier={notifier} />}
      </div>

      {voitProjets && (
        <div className="mt-esp-6 flex justify-end">
          <Button variante="fantome" onClick={() => naviguer('/projets')}>
            <Plus size={20} aria-hidden="true" /> Nouveau projet
          </Button>
        </div>
      )}
    </div>
  );
}
