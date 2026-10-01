import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, ArrowRight, ArrowLeft, Printer, Pencil, Stamp } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_COM, ROLES_JURIDIQUE, ROLES_SECRETARIAT, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import Entete, { PiedEntete } from '../components/doc/Entete.jsx';
import EditeurRiche from '../components/editeur/EditeurRiche.jsx';
import {
  creerCommunique, creerContrat, creerLitige, listerCommuniques, listerContrats, listerEmployes,
  listerLitiges, majCommunique, majContrat, majLitige, supprimerCommunique, supprimerContrat,
} from '../api/ressources.js';
import Cachet from '../components/finance/Cachet.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients } from '../api/clients.js';
import { telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';

/* Espace de rédaction — API réelle : contrats, litiges (Juridique), communiqués (Com). */

export const CONFIGS = {
  contrats: {
    surtitre: 'Juridique',
    titre: 'Contrats',
    intro: 'Rédigez depuis un modèle, signez, archivez. L en-tête société suit les Paramètres.',
    destinataire: 'Cocontractant',
    nouveau: 'Nouveau contrat',
  },
  litiges: {
    surtitre: 'Juridique',
    titre: 'Litiges',
    intro: 'Rapports de litige : faits datés, position, issue proposée.',
    destinataire: 'Dossier',
    nouveau: 'Nouveau rapport',
  },
  courriers: {
    surtitre: 'Secrétariat',
    titre: 'Courriers',
    intro: 'Courriers officiels numérotés, prêts à signer et envoyer.',
    destinataire: 'Destinataire',
    nouveau: 'Nouveau courrier',
  },
  communiques: {
    surtitre: 'Communication',
    titre: 'Communiqués',
    intro: 'Communiqués de presse de l agence et de ses clients.',
    destinataire: 'Diffusion',
    nouveau: 'Nouveau communiqué',
  },
};

const MODELES_DEFAUT = {
  contrats: '<p>Entre les soussignés, il a été convenu ce qui suit…</p><p>Article 1 — Objet…</p>',
  litiges: '<p>Faits…</p><p>Position…</p><p>Issue proposée…</p>',
  communiques: '<p>Communiqué de presse…</p><p>Contact presse…</p>',
};

const TYPES_CONTRAT = [
  { id: 'client', label: 'Client' },
  { id: 'employe', label: 'Employé' },
];
const TYPE_CONTRAT_LABEL = Object.fromEntries(TYPES_CONTRAT.map((t) => [t.id, t.label]));
const TRANSITIONS_LITIGE = { ouvert: ['en_cours'], en_cours: ['resolu'], resolu: ['clos'], clos: [] };
const STATUT_LITIGE_LABEL = { ouvert: 'Ouvert', en_cours: 'En cours', resolu: 'Résolu', clos: 'Clos' };
const STATUT_LITIGE_TON = { ouvert: 'alerte', en_cours: 'info', resolu: 'succes', clos: 'neutre' };
const TRANSITIONS_COMMUNIQUE = { brouillon: ['publie'], publie: [] };
const STATUT_COMM_TON = { brouillon: 'neutre', publie: 'succes' };
const STATUT_COMM_LABEL = { brouillon: 'Brouillon', publie: 'Publié' };

const texteBrut = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();
const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

const API_PAR_CATEGORIE = {
  contrats: { lister: listerContrats, creer: creerContrat, maj: majContrat, supprimer: supprimerContrat, roleSuppr: ['super_admin', 'chef_juridique'] },
  litiges: { lister: listerLitiges, creer: creerLitige, maj: majLitige },
  communiques: { lister: listerCommuniques, creer: creerCommunique, maj: majCommunique, supprimer: supprimerCommunique, roleSuppr: ['super_admin', 'chef_com'] },
};

export default function EspaceRedaction({ categorie }) {
  const config = CONFIGS[categorie];
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [vue, setVue] = useState('liste');
  const [docId, setDocId] = useState(null);
  const [titre, setTitre] = useState('');
  const [destinataire, setDestinataire] = useState('');
  const [clientId, setClientId] = useState('');
  const [employeId, setEmployeId] = useState('');
  const [partie, setPartie] = useState('');
  const [typeContrat, setTypeContrat] = useState('client');
  const [contenu, setContenu] = useState(MODELES_DEFAUT[categorie] ?? '<p>…</p>');
  const [erreur, setErreur] = useState('');
  const [docs, setDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState('');

  const apiCat = API_PAR_CATEGORIE[categorie];
  const gere = !!apiCat;

  const charger = async () => {
    if (!gere) {
      setChargement(false);
      return;
    }
    try {
      const [ds, cls, es] = await Promise.all([
        apiCat.lister(), listerClients(), listerEmployes().catch(() => []),
      ]);
      const liste = cls.results ?? cls;
      setDocs(ds);
      setClients(liste);
      setEmployes(es);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setErreurListe('');
    } catch (e) {
      setErreurListe(messageErreur(e, 'Chargement des documents impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    setVue('liste');
    setDocId(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorie]);

  const actif = docs.find((d) => d.id === docId);
  const nomEmploye = (id) => employes.find((e) => String(e.id) === String(id))?.email ?? '';
  const sousTitre = (d) => {
    if (categorie === 'contrats') {
      const cible = d.type === 'employe'
        ? (d.employe_email ?? nomEmploye(d.employe) ?? '—')
        : (d.client_nom ?? (d.client ? nomsClients[d.client] ?? '' : '—'));
      return `${TYPE_CONTRAT_LABEL[d.type] ?? d.type} · ${cible}`;
    }
    if (categorie === 'litiges') return d.partie || d.client_nom || (d.client ? nomsClients[d.client] ?? '' : '') || 'Dossier interne';
    return `${d.diffusion || 'Diffusion générale'}${d.client ? ` · ${nomsClients[d.client] ?? ''}` : ''}`;
  };
  const transitions = actif
    ? (categorie === 'litiges' ? TRANSITIONS_LITIGE[actif.statut] ?? []
      : categorie === 'communiques' ? TRANSITIONS_COMMUNIQUE[actif.statut] ?? [] : [])
    : [];
  const statutLabel = (d) => {
    if (categorie === 'litiges') return STATUT_LITIGE_LABEL[d.statut] ?? d.statut;
    if (categorie === 'communiques') return STATUT_COMM_LABEL[d.statut] ?? d.statut;
    return d.statut;
  };
  const statutTon = (d) => {
    if (categorie === 'litiges') return STATUT_LITIGE_TON[d.statut] ?? 'neutre';
    if (categorie === 'communiques') return STATUT_COMM_TON[d.statut] ?? 'neutre';
    return 'info';
  };

  const nouveau = () => {
    setDocId(null);
    setTitre('');
    setDestinataire('');
    setClientId(clients[0]?.id ?? '');
    setEmployeId('');
    setPartie('');
    setTypeContrat('client');
    setContenu(MODELES_DEFAUT[categorie] ?? '<p>…</p>');
    setErreur('');
    setVue('editeur');
  };

  const modifier = (d) => {
    setDocId(d.id);
    setTitre(d.titre);
    setDestinataire('');
    setClientId(d.client ?? '');
    setEmployeId(d.employe ?? '');
    setPartie(d.partie ?? '');
    setTypeContrat(d.type ?? 'client');
    setContenu(categorie === 'contrats' ? d.contenu || '' : categorie === 'litiges' ? d.description || '' : d.contenu || '');
    setErreur('');
    setVue('editeur');
  };

  const enregistrer = async () => {
    if (titre.trim().length < 3) {
      setErreur('Donnez un titre d au moins 3 caractères.');
      return;
    }
    if (texteBrut(contenu).length < 20) {
      setErreur('Rédigez au moins 20 caractères de contenu.');
      return;
    }
    const base = categorie === 'contrats'
      ? {
        titre: titre.trim(), type: typeContrat,
        client: typeContrat === 'client' ? (clientId || null) : null,
        employe: typeContrat === 'employe' ? (employeId || null) : null,
        contenu,
      }
      : categorie === 'litiges'
        ? { titre: titre.trim(), client: clientId || null, partie: partie.trim(), description: contenu }
        : { titre: titre.trim(), client: clientId || null, diffusion: destinataire.trim(), contenu };
    try {
      if (docId) {
        await apiCat.maj(docId, base);
        notifier({ type: 'succes', titre: 'Document enregistré', texte: titre.trim() });
      } else {
        const d = await apiCat.creer(base);
        setDocId(d.id);
        notifier({ type: 'succes', titre: 'Document créé', texte: `${d.titre}.` });
      }
      setVue('liste');
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Enregistrement impossible.'));
    }
  };

  const avancerStatut = async (statut) => {
    if (!actif) return;
    try {
      await apiCat.maj(actif.id, { statut });
      notifier({ type: 'succes', titre: 'Statut actualisé', texte: `${actif.titre}.` });
      const maj = await apiCat.lister();
      setDocs(maj);
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Transition refusée', texte: messageErreur(e) });
    }
  };

  const pdfServeur = async () => {
    if (!actif) return;
    try {
      await telechargerPdf(`/juridique/contracts/${actif.id}/pdf/`, `contrat-${actif.id}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (d) => {
    if (!apiCat.supprimer) return;
    try {
      await apiCat.supprimer(d.id);
      notifier({ type: 'succes', titre: 'Document supprimé', texte: `${d.titre} — brouillon effacé.` });
      if (actif?.id === d.id) setVue('liste');
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimerDoc = (d) => {
    if (!apiCat.supprimer) return false;
    if (!(apiCat.roleSuppr ?? []).includes(session?.role)) return false;
    return d.statut === 'brouillon';
  };

  const ACCES_PAR_CATEGORIE = {
    contrats: { roles: ROLES_JURIDIQUE, titre: 'Contrats réservés au Juridique', requis: 'Seuls les membres du département Juridique rédigent les contrats.', demande: 'Le Chef Juridique étudiera votre accès.' },
    litiges: { roles: ROLES_JURIDIQUE, titre: 'Litiges réservés au Juridique', requis: 'Seuls les membres du département Juridique suivent les litiges.', demande: 'Le Chef Juridique étudiera votre accès.' },
    courriers: { roles: ROLES_SECRETARIAT, titre: 'Courriers réservés au Secrétariat', requis: 'Seuls les membres du Secrétariat rédigent les courriers.', demande: 'Le Secrétariat étudiera votre accès.' },
    communiques: { roles: ROLES_COM, titre: 'Communiqués réservés à la Communication', requis: 'Seuls les membres du département Communication rédigent les communiqués.', demande: 'Le Chef Communication étudiera votre accès.' },
  };
  const acces = ACCES_PAR_CATEGORIE[categorie];
  if (acces && !peutVoir(session, acces.roles)) {
    return (
      <AccesRestreint
        titre={acces.titre}
        requis={acces.requis}
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: acces.demande })}
      />
    );
  }
  if (!gere) {
    return (
      <AccesRestreint
        titre="Catégorie non branchée"
        requis="Cette catégorie n a pas encore d API."
      />
    );
  }

  if (vue === 'apercu' && actif) {
    return (
      <div>
        <div className="dg-no-print flex flex-wrap items-center gap-esp-3">
          <Button variante="fantome" onClick={() => setVue('liste')}>
            <ArrowLeft size={20} aria-hidden="true" /> Retour
          </Button>
          <Badge ton={statutTon(actif)}>{statutLabel(actif)}</Badge>
          <span className="mr-auto" />
          {transitions.map((s) => (
            <Button key={s} variante="secondaire" onClick={() => avancerStatut(s)}>
              <Stamp size={20} aria-hidden="true" /> {statutLabel({ statut: s })}
            </Button>
          ))}
          {peutSupprimerDoc(actif) && (
            <BoutonSupprimer
              titre={`Supprimer ${actif.titre}`}
              libelle={actif.titre}
              texte="Supprimer définitivement le document brouillon"
              onConfirmer={() => supprimer(actif)}
            />
          )}
          <Button variante="secondaire" onClick={() => modifier(actif)}>
            <Pencil size={20} aria-hidden="true" /> Modifier
          </Button>
          {categorie === 'contrats' && (
            <Button variante="secondaire" onClick={pdfServeur}>
              <Printer size={20} aria-hidden="true" /> PDF serveur
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" /> Imprimer / PDF
          </Button>
        </div>
        <div className="dg-print-doc mx-auto mt-esp-6 w-full max-w-[800px] rounded-lg border border-gris-300 bg-gris-0 p-esp-6 shadow-ombre-1">
          <Entete entreprise={entreprise} />
          <p className="mt-esp-5 text-center font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{config.titre}</p>
          <h1 className="mt-esp-2 text-center !text-[26px]">{actif.titre}</h1>
          <p className="mt-esp-2 text-center font-courant text-[15px] text-gris-600">
            {sousTitre(actif)} · {dateFr(actif.cree_le)} · {statutLabel(actif)}
          </p>
          <div className="dg-doc mt-esp-5 font-courant text-[17px] leading-[1.65] text-gris-700" dangerouslySetInnerHTML={{ __html: actif.contenu ?? actif.description ?? '' }} />
          {(categorie === 'contrats' || categorie === 'litiges') && (entreprise.cachetJuridique || entreprise.signatureJuridique) && (
            <div className="mt-esp-5 flex justify-center">
              <Cachet entreprise={entreprise} cachetUrl={entreprise.cachetJuridique} signatureUrl={entreprise.signatureJuridique} />
            </div>
          )}
          <div className="mt-esp-7 flex justify-end">
            <p className="border-t border-gris-400 px-esp-6 pt-esp-2 text-center font-courant text-[13px] text-gris-600">
              Signature<br /><em>{entreprise.signataire}</em>
            </p>
          </div>
          <PiedEntete entreprise={entreprise} />
        </div>
      </div>
    );
  }

  if (vue === 'editeur') {
    return (
      <div>
        <button type="button" onClick={() => setVue('liste')} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> {config.titre}
        </button>
        <div className="mt-esp-2">
          <p className="dg-surtitre">{config.surtitre}</p>
          <h1 className="mt-esp-2">{docId ? 'Modifier le document' : config.nouveau}</h1>
        </div>
        <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
          <div className="flex flex-col gap-esp-4">
            <div>
              <Label htmlFor="doc-titre">Titre</Label>
              <div className="mt-esp-2"><Input id="doc-titre" autoFocus value={titre} onChange={(e) => { setTitre(e.target.value); setErreur(''); }} placeholder="Ex. Contrat de prestation" /></div>
            </div>
            {categorie === 'contrats' && (
              <div>
                <Label htmlFor="doc-type">Type</Label>
                <select id="doc-type" value={typeContrat} onChange={(e) => setTypeContrat(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                  {TYPES_CONTRAT.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            )}
            {categorie === 'contrats' && typeContrat === 'employe' ? (
              <div>
                <Label htmlFor="doc-employe">Employé concerné *</Label>
                <select id="doc-employe" value={employeId} onChange={(e) => setEmployeId(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                  <option value="">— Choisir —</option>
                  {employes.map((e) => <option key={e.id} value={e.id}>{e.email} · {e.fonction || '—'}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <Label htmlFor="doc-client">Client concerné{categorie === 'litiges' ? ' (optionnel)' : ''}</Label>
                <select id="doc-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                  <option value="">— Aucun —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
                </select>
              </div>
            )}
            {categorie === 'litiges' && (
              <div>
                <Label htmlFor="doc-partie">Personne / entreprise concernée</Label>
                <div className="mt-esp-2"><Input id="doc-partie" value={partie} onChange={(e) => setPartie(e.target.value)} placeholder="Ex. Awa Diallo ou Azalai Hotels" /></div>
              </div>
            )}
            {categorie === 'communiques' && (
              <div>
                <Label htmlFor="doc-dest">{config.destinataire}</Label>
                <div className="mt-esp-2"><Input id="doc-dest" value={destinataire} onChange={(e) => setDestinataire(e.target.value)} placeholder="Ex. Presse nationale" /></div>
              </div>
            )}
            {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
            <div className="flex gap-esp-3">
              <Button onClick={enregistrer}>Enregistrer</Button>
              <Button variante="fantome" onClick={() => setVue('liste')}>Annuler</Button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <EditeurRiche valeurInitiale={contenu} cle={`${categorie}-${docId || 'new'}`} onChanger={setContenu} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">{config.surtitre}</p>
          <h1 className="mt-esp-2">{config.titre}</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">{config.intro}</p>
        </div>
        <Button onClick={nouveau}>
          <Plus size={20} aria-hidden="true" /> {config.nouveau}
        </Button>
      </div>

      <Card survol={false} className="mt-esp-6">
        <CardBody className="flex flex-col gap-esp-1 pt-esp-3">
          {chargement ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreurListe ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-erreur" role="alert">{erreurListe}</p>
          ) : (
          <>
          {docs.length === 0 && <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600">Aucun document. Créez le premier.</p>}
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg px-esp-3 py-esp-3 transition-colors duration-rapide hover:bg-gris-100">
              <div className="min-w-48 flex-1">
                <p className="font-courant text-[15px] font-semibold text-gris-900">{d.titre}</p>
                <p className="font-courant text-[15px] text-gris-600">{sousTitre(d)} · {dateFr(d.cree_le)}</p>
              </div>
              <Badge ton={statutTon(d)}>{statutLabel(d)}</Badge>
              <button type="button" onClick={() => { setDocId(d.id); setVue('apercu'); }} className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 transition-colors duration-rapide hover:bg-gris-200">
                Voir <ArrowRight size={16} aria-hidden="true" />
              </button>
              {peutSupprimerDoc(d) && (
                <BoutonSupprimer
                  titre={`Supprimer ${d.titre}`}
                  libelle={d.titre}
                  texte="Supprimer définitivement le document brouillon"
                  onConfirmer={() => supprimer(d)}
                />
              )}
            </div>
          ))}
          </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
