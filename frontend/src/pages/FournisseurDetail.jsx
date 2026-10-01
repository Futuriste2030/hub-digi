import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Plus, X, Banknote, CheckCircle, Send, FileDown, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import EditeurLignes from '../components/finance/EditeurLignes.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import {
  convertirCommande, creerCommande, creerFactureFournisseur, creerLivraison,
  envoyerCommande, majFournisseur, overviewFournisseur,
  payerFactureFournisseur, pdfCommande, pdfFactureFournisseur,
  pdfLivraison, pdfPaiementFournisseur, supprimerCommande,
  supprimerFactureFournisseur, validerCommande, validerFactureFournisseur,
  validerLivraison,
} from '../api/fournisseurs.js';
import { telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Fiche fournisseur 360° : aperçu + onglets Commandes / Livraisons / Factures.
   Cycle : commande (BDC) → livraison (BDL, impute les quantités) → facture (ACHAT) → paiement + reçu PDF. */

const STATUT_TON = {
  brouillon: 'neutre', recue: 'info', validee: 'info', envoyee: 'info',
  partiellement_livree: 'alerte', livree: 'succes', facturee: 'succes',
  partielle: 'alerte', payee: 'succes', valide: 'succes',
};
const MOYENS = [
  { id: 'virement', label: 'Virement' },
  { id: 'especes', label: 'Espèces' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'carte', label: 'Carte' },
];
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const ONGLETS = [
  { id: 'commandes', label: 'Commandes' },
  { id: 'livraisons', label: 'Livraisons' },
  { id: 'factures', label: 'Factures & Reçus' },
];

function ModaleCommande({ onFermer, onCreer }) {
  const [objet, setObjet] = useState('');
  const [prevue, setPrevue] = useState('');
  const [lignes, setLignes] = useState([{ description: '', quantite: 1, montant: '' }]);
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    const utiles = lignes
      .filter((l) => l.description.trim() !== '' && Number(l.montant) > 0)
      .map((l) => ({ description: l.description.trim(), quantite: Number(l.quantite) || 1, montant: Number(l.montant) }));
    if (utiles.length === 0) { setErreur('Ajoutez au moins une ligne avec description et montant.'); return; }
    onCreer({ objet: objet.trim(), livraison_prevue: prevue || null, lignes: utiles });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau bon de commande">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Achat</p>
            <h2 className="!text-[26px]">Bon de commande</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bc-objet">Objet</Label>
              <div className="mt-esp-2"><Input id="bc-objet" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. Ramettes A4" /></div>
            </div>
            <div>
              <Label htmlFor="bc-prevue">Livraison prévue</Label>
              <div className="mt-esp-2"><Input id="bc-prevue" type="date" value={prevue} onChange={(e) => setPrevue(e.target.value)} /></div>
            </div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Lignes commandées</span>
            <div className="mt-esp-2"><EditeurLignes lignes={lignes} onChanger={(l) => { setLignes(l); setErreur(''); }} /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer en brouillon</Button>
        </div>
      </form>
    </div>
  );
}

/* Lignes restantes d'une commande : quantités non encore livrées. */
const lignesRestantes = (bc) => {
  if (!bc) return [{ description: '', quantite: 1, montant: '' }];
  const restantes = (bc.lignes ?? [])
    .filter((l) => Number(l.quantite ?? 0) - Number(l.quantite_livree ?? 0) > 0)
    .map((l) => ({
      description: l.description, montant: l.montant,
      quantite: Number(l.quantite) - Number(l.quantite_livree ?? 0),
      ligne_commande: l.id ?? null,
    }));
  return restantes.length > 0 ? restantes : [{ description: '', quantite: 1, montant: '' }];
};

function ModaleLivraison({ commandes, onFermer, onCreer }) {
  const eligibles = commandes.filter((c) => ['validee', 'envoyee', 'partiellement_livree'].includes(c.statut));
  const [mode, setMode] = useState(eligibles.length > 0 ? 'commande' : 'libre');
  const [commandeId, setCommandeId] = useState(eligibles[0]?.id ? String(eligibles[0].id) : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState(() => lignesRestantes(eligibles[0]));
  const [erreur, setErreur] = useState('');
  const commandeChoisie = commandes.find((c) => String(c.id) === String(commandeId));

  const choisirMode = (m) => {
    setMode(m);
    setErreur('');
    if (m === 'commande' && eligibles[0]) {
      setCommandeId(String(eligibles[0].id));
      setLignes(lignesRestantes(eligibles[0]));
    } else if (m === 'libre') {
      setCommandeId('');
      setLignes([{ description: '', quantite: 1, montant: '' }]);
    }
  };

  const choisirCommande = (id) => {
    setCommandeId(id);
    setErreur('');
    const bc = commandes.find((c) => String(c.id) === String(id));
    setLignes(lignesRestantes(bc));
  };

  const soumettre = (e) => {
    e.preventDefault();
    const utiles = lignes
      .filter((l) => l.description.trim() !== '' && Number(l.quantite) > 0)
      .map((l) => ({
        description: l.description.trim(), quantite: Number(l.quantite),
        montant: Number(l.montant) || 0,
        ...(l.ligne_commande ? { ligne_commande: l.ligne_commande } : {}),
      }));
    if (utiles.length === 0) { setErreur('Ajoutez au moins une ligne livrée en quantité positive.'); return; }
    onCreer({ commande: commandeId ? Number(commandeId) : null, date_livraison: date || null, lignes: utiles });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau bon de livraison">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Réception</p>
            <h2 className="!text-[26px]">Bon de livraison</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div role="radiogroup" aria-label="Origine de la livraison" className="grid grid-cols-1 gap-esp-2 sm:grid-cols-2">
            <button
              type="button" role="radio" aria-checked={mode === 'commande'}
              onClick={() => choisirMode('commande')}
              className={`min-h-[44px] rounded-md border px-esp-4 py-esp-3 text-left font-courant text-[15px] transition-colors duration-rapide ${mode === 'commande' ? 'border-digi bg-digi-voile font-semibold text-gris-900' : 'border-gris-300 bg-gris-0 text-gris-700'}`}
            >
              <span className="block font-semibold">À partir d&apos;une commande</span>
              <span className="block text-[13px] text-gris-600">
                {eligibles.length === 0
                  ? 'Indisponible : aucune commande validée — allez dans l\u2019onglet Commandes, créez le bon puis cliquez Valider'
                  : 'Choisir dans la liste : articles repris auto'}
              </span>
            </button>
            <button
              type="button" role="radio" aria-checked={mode === 'libre'}
              onClick={() => choisirMode('libre')}
              className={`min-h-[44px] rounded-md border px-esp-4 py-esp-3 text-left font-courant text-[15px] transition-colors duration-rapide ${mode === 'libre' ? 'border-digi bg-digi-voile font-semibold text-gris-900' : 'border-gris-300 bg-gris-0 text-gris-700'}`}
            >
              <span className="block font-semibold">Nouveau (saisie libre)</span>
              <span className="block text-[13px] text-gris-600">Sans commande : tout saisir à la main</span>
            </button>
          </div>

          {mode === 'commande' && (
            eligibles.length === 0 ? (
              <p className="font-courant text-[15px] text-gris-600">Aucune commande validée pour l&apos;instant — validez d&apos;abord un bon dans l&apos;onglet Commandes, ou passez en saisie libre.</p>
            ) : (
            <>
              <div>
                <Label htmlFor="bl-commande">Bon de commande</Label>
                <select id="bl-commande" value={commandeId} onChange={(e) => choisirCommande(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                  {eligibles.map((c) => <option key={c.id} value={c.id}>{c.numero} — {c.objet || 'sans objet'}</option>)}
                </select>
              </div>
              {commandeChoisie && (
                <div className="rounded-md bg-gris-100 px-esp-4 py-esp-3 font-courant text-[14px] text-gris-700">
                  <span className="font-semibold text-gris-900">{commandeChoisie.numero}</span>
                  {' · '}{commandeChoisie.objet || 'sans objet'}
                  {' · '}statut <Badge ton={STATUT_TON[commandeChoisie.statut] ?? 'neutre'}>{commandeChoisie.statut}</Badge>
                  <span className="block text-[13px] text-gris-600">Livraison prévue : {dateFr(commandeChoisie.livraison_prevue)} · Total {fCFA(Number(commandeChoisie.total ?? 0))} · Déjà livré {fCFA(Number(commandeChoisie.total_livre ?? 0))}</span>
                </div>
              )}
            </>
            )
          )}
          <div>
            <Label htmlFor="bl-date">Date de livraison</Label>
            <div className="mt-esp-2"><Input id="bl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Lignes reçues{mode === 'commande' ? ' (reprises de la commande, quantités modifiables)' : ''}</span>
            <div className="mt-esp-2"><EditeurLignes lignes={lignes} onChanger={(l) => { setLignes(l); setErreur(''); }} /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}

function ModaleFactureAchat({ onFermer, onCreer }) {
  const [objet, setObjet] = useState('');
  const [reference, setReference] = useState('');
  const [echeance, setEcheance] = useState('');
  const [lignes, setLignes] = useState([{ description: '', quantite: 1, montant: '' }]);
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    const utiles = lignes
      .filter((l) => l.description.trim() !== '' && Number(l.montant) > 0)
      .map((l) => ({ description: l.description.trim(), quantite: Number(l.quantite) || 1, montant: Number(l.montant) }));
    if (utiles.length === 0) { setErreur('Ajoutez au moins une ligne avec description et montant.'); return; }
    onCreer({ objet: objet.trim(), reference_fournisseur: reference.trim(), echeance: echeance || null, lignes: utiles });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle facture d'achat">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Achat</p>
            <h2 className="!text-[26px]">Nouvelle facture fournisseur</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fa-objet">Objet</Label>
              <div className="mt-esp-2"><Input id="fa-objet" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. Flyers A5" /></div>
            </div>
            <div>
              <Label htmlFor="fa-ref">Réf. fournisseur</Label>
              <div className="mt-esp-2"><Input id="fa-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° facture reçue" /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="fa-echeance">Échéance</Label>
            <div className="mt-esp-2"><Input id="fa-echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} /></div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Lignes</span>
            <div className="mt-esp-2"><EditeurLignes lignes={lignes} onChanger={(l) => { setLignes(l); setErreur(''); }} /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}

function ModalePaiement({ facture, onFermer, onPayer }) {
  const estAcompte = facture._mode === 'acompte';
  const solde = Number(facture.solde ?? 0);
  const [montant, setMontant] = useState(estAcompte ? '' : String(solde));
  const [moyen, setMoyen] = useState('virement');
  const [ref, setRef] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (!(Number(montant) > 0)) { setErreur('Indiquez un montant supérieur à zéro.'); return; }
    if (Number(montant) > solde) { setErreur(`Le montant ne peut pas dépasser le solde restant (${fCFA(solde)}).`); return; }
    onPayer({ montant: Number(montant), moyen, ref_transaction: ref.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={`${estAcompte ? 'Acompte' : 'Paiement total'} ${facture.numero}`}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">{estAcompte ? 'Acompte' : 'Paiement total'} · solde {fCFA(solde)}</p>
            <h2 className="!text-[26px]">{facture.numero}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pa-montant">Montant (F CFA)</Label>
              <div className="mt-esp-2"><Input id="pa-montant" inputMode="numeric" value={montant} onChange={(e) => { setMontant(e.target.value); setErreur(''); }} /></div>
            </div>
            <div>
              <Label htmlFor="pa-moyen">Moyen</Label>
              <select id="pa-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="pa-ref">Référence transaction</Label>
            <div className="mt-esp-2"><Input id="pa-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optionnel" /></div>
          </div>
          <p className="font-courant text-[14px] text-gris-600">Le montant est <b>déduit du solde dû</b> du fournisseur. En confirmant, un <b>reçu de paiement PDF</b> est généré automatiquement (section Reçus ci-dessous).</p>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Banknote size={20} aria-hidden="true" /> Payer</Button>
        </div>
      </form>
    </div>
  );
}

export default function FournisseurDetail() {
  const { notifier, session } = useOutletContext();
  const { id } = useParams();
  const naviguer = useNavigate();
  const [data, setData] = useState(null);
  const [onglet, setOnglet] = useState('commandes');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [modale, setModale] = useState(null); // commande | livraison | facture
  const [paiementPour, setPaiementPour] = useState(null);

  const charger = async () => {
    try {
      setChargement(true);
      setData(await overviewFournisseur(id));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Fiche fournisseur introuvable.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const telecharger = async (url, nom, quoi) => {
    try {
      await telechargerPdf(url, nom);
    } catch (e) {
      notifier({ type: 'info', titre: `${quoi} impossible`, texte: messageErreur(e) });
    }
  };

  const agir = async (fn, args, succes, bascule = null) => {
    try {
      const res = await fn(...args);
      notifier({ type: 'succes', titre: succes, texte: '' });
      charger();
      if (bascule) setOnglet(bascule);
      return res;
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
      return null;
    }
  };

  const changerStatut = async (statut) => {
    try {
      await majFournisseur(id, { statut });
      notifier({ type: 'succes', titre: 'Statut mis à jour', texte: statut });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'MAJ impossible', texte: messageErreur(e) });
    }
  };

  /* Paiement fournisseur (c'est Digi Com qui paie, pas de lien de paiement) :
     select Non payée / Acompte / Payée -> modale montant -> déduit du solde dû. */
  const statutPaiement = (fa) => (fa.statut === 'payee' ? 'payee' : fa.statut === 'partielle' ? 'acompte' : 'non_payee');

  const changerPaiement = (fa, valeur) => {
    if (valeur === statutPaiement(fa)) return;
    if (valeur === 'non_payee') {
      const dejaPaye = paiements.some((p) => p.facture === fa.id);
      notifier({
        type: 'info', titre: 'Retour impossible',
        texte: dejaPaye
          ? 'Des paiements existent déjà sur cette facture : le statut suit les montants versés.'
          : 'La facture est déjà non payée.',
      });
      return;
    }
    if (Number(fa.solde ?? 0) <= 0 && valeur !== 'non_payee') return;
    setPaiementPour({ ...fa, _mode: valeur === 'acompte' ? 'acompte' : 'solde' });
  };

  if (!peutVoir(session, ROLES_FINANCE)) {
    return <AccesRestreint titre="Achats réservés" requis="Seuls les membres Finance suivent les fournisseurs." />;
  }
  if (chargement) return <p role="status" className="font-courant text-[15px] text-gris-600">Chargement…</p>;
  if (erreur || !data) return <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>;

  const { fournisseur: f, factures, commandes = [], livraisons = [], paiements = [], solde_du } = data;
  const peutEcrire = peutVoir(session, ROLES_CHEF_FINANCE);
  const factureNumero = Object.fromEntries(factures.map((fa) => [fa.id, fa.numero]));
  const peutConvertir = (c) => ['envoyee', 'livree', 'partiellement_livree'].includes(c.statut);

  return (
    <div>
      <Button variante="fantome" onClick={() => naviguer('/finance/fournisseurs')}>← Fournisseurs</Button>
      <div className="mt-esp-3 flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance · Achats · {f.categorie || 'Fournisseur'}</p>
          <h1 className="mt-esp-2">{f.nom_societe}</h1>
          <p className="mt-esp-1 font-courant text-[15px] text-gris-600">
            {[f.contact, f.email, f.phone].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-esp-2">
          <Badge ton={f.statut === 'actif' ? 'succes' : 'neutre'}>{f.statut}</Badge>
          {peutEcrire && f.statut === 'actif' && (
            <Button variante="fantome" onClick={() => changerStatut('inactif')}>Passer inactif</Button>
          )}
          {peutEcrire && f.statut !== 'actif' && (
            <Button variante="fantome" onClick={() => changerStatut('actif')}>Réactiver</Button>
          )}
        </div>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-3">
        {[
          { label: 'Total achats', valeur: fCFA(Number(f.total_achats ?? 0)) },
          { label: 'Total payé', valeur: fCFA(Number(f.total_paye ?? 0)) },
          { label: 'Solde dû', valeur: fCFA(Number(solde_du ?? 0)) },
        ].map((s) => (
          <Card key={s.label} survol={false}>
            <CardBody>
              <span className="block font-courant text-[15px] text-gris-600">{s.label}</span>
              <span className="font-titrage text-[18px] font-bold text-gris-900 dg-tnum whitespace-nowrap">{s.valeur}</span>
            </CardBody>
          </Card>
        ))}
      </div>

      <div role="tablist" aria-label="Documents d'achat" className="mt-esp-6 flex flex-wrap gap-esp-2">
        {ONGLETS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={onglet === t.id} onClick={() => setOnglet(t.id)}
            className={`min-h-[44px] rounded-md px-esp-4 font-courant text-[15px] font-semibold transition-colors duration-rapide ${onglet === t.id ? 'bg-marine-profond text-blanc' : 'bg-gris-100 text-gris-700 hover:bg-gris-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {onglet === 'commandes' && (
        <Card survol={false} className="mt-esp-4">
          <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
            <p className="px-esp-3 pb-esp-1 pt-esp-2 font-courant text-[14px] text-gris-600">Parcours : <b>1.</b> créez le bon → <b>2.</b> Validez → <b>3.</b> Envoyez au fournisseur → <b>4.</b> à la réception, créez le bon de livraison → <b>5.</b> cliquez <b>Facturer</b> pour générer la facture.</p>
            <div className="flex justify-end px-esp-3 pb-esp-2 pt-esp-2">
              <Button onClick={() => setModale('commande')}><Plus size={20} aria-hidden="true" /> Bon de commande</Button>
            </div>
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gris-300">
                  {['N°', 'Objet', 'Total', 'Livré', 'Statut', ''].map((col) => (
                    <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id} className="border-b border-gris-200 last:border-0">
                    <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{c.numero}</td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900">{c.objet || '—'}<span className="block font-courant text-[13px] text-gris-600">Prévue : {dateFr(c.livraison_prevue)}</span></td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(c.total ?? 0))}</td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum whitespace-nowrap">{fCFA(Number(c.total_livre ?? 0))}</td>
                    <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{c.statut}</Badge></td>
                    <td className="px-esp-3 py-esp-3 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-esp-1">
                        {c.statut === 'brouillon' && (
                          <Button variante="fantome" onClick={() => agir(validerCommande, [c.id], 'Commande validée')}><CheckCircle size={18} aria-hidden="true" /> Valider</Button>
                        )}
                        {c.statut === 'validee' && (
                          <Button variante="fantome" onClick={() => agir(envoyerCommande, [c.id], 'Commande envoyée')}><Send size={18} aria-hidden="true" /> Envoyer</Button>
                        )}
                        {peutConvertir(c) && (
                          <Button variante="fantome" onClick={() => agir(convertirCommande, [c.id], 'Facture créée depuis la commande', 'factures')}><ArrowRight size={18} aria-hidden="true" /> Facturer</Button>
                        )}
                        <Button variante="fantome" onClick={() => telecharger(pdfCommande(c.id), `${c.numero}.pdf`, 'PDF')}><FileDown size={18} aria-hidden="true" /> PDF</Button>
                        {peutEcrire && ['brouillon', 'annulee'].includes(c.statut) && (
                          <BoutonSupprimer titre={`Supprimer ${c.numero}`} libelle={c.numero} texte="Supprimer définitivement le bon" onConfirmer={() => agir(supprimerCommande, [c.id], 'Bon supprimé')} />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {commandes.length === 0 && (
              <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun bon de commande. Créez le premier pour engager l&apos;achat.</p>
            )}
          </CardBody>
        </Card>
      )}

      {onglet === 'livraisons' && (
        <Card survol={false} className="mt-esp-4">
          <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
            <p className="px-esp-3 pb-esp-1 pt-esp-2 font-courant text-[14px] text-gris-600">Deux façons : <b>À partir d&apos;une commande</b> (liste + articles repris automatiquement) ou <b>Nouveau en saisie libre</b>. Valider impute les quantités reçues sur la commande.</p>
            <div className="flex justify-end px-esp-3 pb-esp-2 pt-esp-2">
              <Button onClick={() => setModale('livraison')}><Plus size={20} aria-hidden="true" /> Bon de livraison</Button>
            </div>
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gris-300">
                  {['N°', 'Commande', 'Date', 'Total reçu', 'Statut', ''].map((col) => (
                    <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {livraisons.map((l) => (
                  <tr key={l.id} className="border-b border-gris-200 last:border-0">
                    <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{l.numero}</td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{l.commande_numero || 'Libre'}</td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{dateFr(l.date_livraison)}</td>
                    <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(l.total ?? 0))}</td>
                    <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[l.statut] ?? 'neutre'}>{l.statut}</Badge></td>
                    <td className="px-esp-3 py-esp-3 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-esp-1">
                        {l.statut === 'brouillon' && (
                          <Button variante="fantome" onClick={() => agir(validerLivraison, [l.id], 'Réception validée')}><CheckCircle size={18} aria-hidden="true" /> Valider</Button>
                        )}
                        <Button variante="fantome" onClick={() => telecharger(pdfLivraison(l.id), `${l.numero}.pdf`, 'PDF')}><FileDown size={18} aria-hidden="true" /> PDF</Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {livraisons.length === 0 && (
              <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune livraison réceptionnée.</p>
            )}
          </CardBody>
        </Card>
      )}

      {onglet === 'factures' && (
        <>
          <Card survol={false} className="mt-esp-4">
            <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
              <p className="px-esp-3 pb-esp-1 pt-esp-2 font-courant text-[14px] text-gris-600">Deux façons de créer une facture : <b>1.</b> bouton <b>Facturer</b> sur une commande livrée (lignes reprises + lien BDC) — recommandé · <b>2.</b> bouton <b>Facture d&apos;achat</b> ci-dessous (saisie manuelle). Pour payer (c&apos;est Digi Com qui paie) : select <b>Non payée / Acompte / Payée</b> sur la ligne — <b>Acompte</b> ouvre la saisie du montant versé, déduit du <b>solde dû</b>, avec <b>reçu PDF</b> auto.</p>
              <div className="flex justify-end px-esp-3 pb-esp-2 pt-esp-2">
                <Button onClick={() => setModale('facture')}><Plus size={20} aria-hidden="true" /> Facture d&apos;achat</Button>
              </div>
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gris-300">
                    {['N°', 'Objet', 'Échéance', 'Total', 'Soldé', 'Statut', ''].map((col) => (
                      <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factures.map((fa) => (
                    <tr key={fa.id} className="border-b border-gris-200 last:border-0">
                      <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{fa.numero}{fa.reference_fournisseur ? <span className="block font-courant text-[13px] text-gris-600">Réf. {fa.reference_fournisseur}</span> : null}{fa.commande_numero ? <span className="block font-courant text-[13px] text-gris-600">BDC {fa.commande_numero}</span> : null}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900">{fa.objet || '—'}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{dateFr(fa.echeance)}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(fa.total ?? 0))}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(fa.solde ?? 0))}</td>
                      <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[fa.statut] ?? 'neutre'}>{fa.statut}</Badge></td>
                      <td className="px-esp-3 py-esp-3 text-right">
                        <span className="inline-flex flex-wrap items-center justify-end gap-esp-1">
                          {(fa.statut === 'brouillon' || fa.statut === 'recue') && (
                            <Button variante="fantome" onClick={() => agir(validerFactureFournisseur, [fa.id], 'Facture validée')}><CheckCircle size={18} aria-hidden="true" /> Valider</Button>
                          )}
                          {Number(fa.total ?? 0) > 0 && Number(fa.solde ?? 0) >= 0 && (
                            <select
                              value={statutPaiement(fa)}
                              onChange={(e) => changerPaiement(fa, e.target.value)}
                              aria-label={`Paiement ${fa.numero}`}
                              className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 focus:border-digi"
                            >
                              <option value="non_payee">Non payée</option>
                              <option value="acompte">Acompte</option>
                              <option value="payee">Payée</option>
                            </select>
                          )}
                          <Button variante="fantome" onClick={() => telecharger(pdfFactureFournisseur(fa.id), `${fa.numero}.pdf`, 'PDF')}><FileDown size={18} aria-hidden="true" /> PDF</Button>
                          {peutEcrire && (
                            <BoutonSupprimer titre={`Supprimer ${fa.numero}`} libelle={fa.numero} texte="Supprimer définitivement la facture" onConfirmer={() => agir(supprimerFactureFournisseur, [fa.id], 'Facture supprimée')} />
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {factures.length === 0 && (
                <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune facture. Convertissez une commande livrée ou saisissez directement.</p>
              )}
            </CardBody>
          </Card>

          {paiements.length > 0 && (
            <Card survol={false} className="mt-esp-4">
              <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
                <h2 className="px-esp-3 pb-esp-2 pt-esp-2 font-titrage text-[16px] font-bold text-gris-900">Reçus de paiement</h2>
                <p className="px-esp-3 pb-esp-1 font-courant text-[14px] text-gris-600">Un reçu est créé automatiquement à chaque montant versé (select <b>Acompte / Payée</b> ci-dessus) — pas de saisie manuelle.</p>
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gris-300">
                      {['Référence', 'Facture', 'Date', 'Montant', ''].map((col) => (
                        <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paiements.map((p) => (
                      <tr key={p.id} className="border-b border-gris-200 last:border-0">
                        <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{p.numero || `#${p.id}`}</td>
                        <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{factureNumero[p.facture] ?? `#${p.facture}`}</td>
                        <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{dateFr(p.date)}<span className="block font-courant text-[13px] text-gris-600">{p.moyen}{p.ref_transaction ? ` · ${p.ref_transaction}` : ''}</span></td>
                        <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(p.montant ?? 0))}</td>
                        <td className="px-esp-3 py-esp-3 text-right">
                          <Button variante="fantome" onClick={() => telecharger(pdfPaiementFournisseur(p.id), `recu-fournisseur-${p.id}.pdf`, 'Reçu')}><FileDown size={18} aria-hidden="true" /> Reçu</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {modale === 'commande' && (
        <ModaleCommande
          onFermer={() => setModale(null)}
          onCreer={async (payload) => {
            const bc = await agir(creerCommande, [{ ...payload, fournisseur: Number(id) }], 'Bon de commande créé');
            if (bc) setModale(null);
          }}
        />
      )}
      {modale === 'livraison' && (
        <ModaleLivraison
          commandes={commandes}
          onFermer={() => setModale(null)}
          onCreer={async (payload) => {
            const bl = await agir(creerLivraison, [{ ...payload, fournisseur: Number(id) }], 'Bon de livraison enregistré');
            if (bl) setModale(null);
          }}
        />
      )}
      {modale === 'facture' && (
        <ModaleFactureAchat
          onFermer={() => setModale(null)}
          onCreer={async (payload) => {
            const fa = await agir(creerFactureFournisseur, [{ ...payload, fournisseur: Number(id) }], 'Facture enregistrée');
            if (fa) setModale(null);
          }}
        />
      )}
      {paiementPour && (
        <ModalePaiement
          facture={paiementPour}
          onFermer={() => setPaiementPour(null)}
          onPayer={async (payload) => {
            const ok = await agir(payerFactureFournisseur, [paiementPour.id, payload], `Paiement enregistré — ${fCFA(Number(payload.montant))} versés.`);
            if (ok) setPaiementPour(null);
          }}
        />
      )}
    </div>
  );
}
