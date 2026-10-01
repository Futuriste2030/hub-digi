import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Link2, Banknote, Send } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import FactureDoc from '../components/finance/FactureDoc.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { envoyerFacture, listerFactures, majFacture, payerFacture, telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import { PAIEMENT_EN_LIGNE_ACTIF, MESSAGE_PAIEMENT_BIENTOT, lienPaiementFacture } from '../lib/paiement.js';
import { NonTrouve } from './Pages.jsx';

/* Détail facture — API réelle : document + paiement + envoi + PDF serveur. */

const STATUT_LABEL = { brouillon: 'Brouillon', validee: 'Validée', envoyee: 'Envoyée', partielle: 'Partielle', payee: 'Payée', impayee: 'Impayée' };

const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export default function FactureDetail() {
  const { numero } = useParams();
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [facture, setFacture] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  const charger = async () => {
    try {
      const fs = await listerFactures({ search: numero });
      const trouve = fs.find((f) => f.numero === numero);
      if (!trouve) setIntrouvable(true);
      else setFacture(trouve);
    } catch (e) {
      notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [numero]);

  if (introuvable) return <NonTrouve />;

  const copier = async () => {
    if (!PAIEMENT_EN_LIGNE_ACTIF) {
      notifier({ type: 'info', titre: 'Paiement en ligne bientôt disponible', texte: MESSAGE_PAIEMENT_BIENTOT });
      return;
    }
    try {
      await navigator.clipboard.writeText(lienPaiementFacture(facture.numero));
    } catch {
      /* presse-papiers indisponible */
    }
    notifier({ type: 'info', titre: 'Lien copié', texte: `Lien de paiement ${facture.numero} copié.` });
  };

  const payer = async () => {
    try {
      const recu = await payerFacture(facture.id, { montant: Number(facture.solde), moyen: 'especes' });
      notifier({ type: 'succes', titre: 'Paiement reçu', texte: `${facture.numero} soldée. ${recu.numero} généré.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Encaissement impossible', texte: messageErreur(e) });
    }
  };

  const envoyer = async () => {
    try {
      await envoyerFacture(facture.id);
      notifier({ type: 'succes', titre: 'Facture envoyée', texte: `Template facture_disponible + PDF pour ${facture.numero}.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  const basculerTva = async () => {
    try {
      await majFacture(facture.id, { tva_active: !facture.tva_active });
      notifier(facture.tva_active
        ? { type: 'info', titre: 'TVA désactivée', texte: `${facture.numero} — montants HT = TTC.` }
        : { type: 'succes', titre: 'TVA 18 % activée', texte: `${facture.numero} — HT recalculé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const pdfServeur = async () => {
    try {
      await telechargerPdf(`/finance/invoices/${facture.id}/pdf/`, `${facture.numero}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Finance réservée"
        requis="Seuls les membres du département Finance suivent ces documents."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Finance étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_FINANCE);

  if (!facture) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }

  const doc = {
    numero: facture.numero,
    date: dateFr(facture.cree_le),
    statut: STATUT_LABEL[facture.statut] ?? facture.statut,
    tauxTva: facture.tva_active ? 18 : 0,
    tvaActive: !!facture.tva_active,
    client: facture.client_nom ?? '',
    clientEmail: facture.client_email ?? '',
    clientAdresse: facture.client_adresse ?? '',
    clientPhone: facture.client_phone ?? '',
    lienPaiement: lienPaiementFacture(facture.numero) || undefined,
    lignes: (facture.lignes ?? []).map((l) => ({ description: l.description, quantite: Number(l.quantite), montant: Number(l.montant) })),
  };

  return (
    <div>
      <div className="dg-no-print">
        <Link to="/factures" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Factures
        </Link>
        <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
          <div className="mr-auto">
            <p className="dg-surtitre">Finance</p>
            <h1 className="mt-esp-2">{facture.numero}</h1>
          </div>
          <Button variante="secondaire" onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" /> Imprimer
          </Button>
          <Button variante="secondaire" onClick={pdfServeur}>
            <Printer size={20} aria-hidden="true" /> PDF serveur
          </Button>
          <Button variante="fantome" onClick={copier} title={PAIEMENT_EN_LIGNE_ACTIF ? undefined : MESSAGE_PAIEMENT_BIENTOT}>
            <Link2 size={20} aria-hidden="true" /> {PAIEMENT_EN_LIGNE_ACTIF ? 'Lien de paiement' : 'Lien de paiement (bientôt)'}
          </Button>
          {peutValider && (
            <Button variante={facture.tva_active ? 'primaire' : 'secondaire'} onClick={basculerTva} title="Activer ou couper la TVA 18 %">
              TVA {facture.tva_active ? '18 % ON' : 'OFF'}
            </Button>
          )}
          {peutValider && facture.statut !== 'payee' && (
            <Button onClick={payer}>
              <Banknote size={20} aria-hidden="true" /> Marquer payée
            </Button>
          )}
          <Button variante="fantome" onClick={envoyer}>
            <Send size={20} aria-hidden="true" /> Envoyer par mail
          </Button>
        </div>
      </div>

      <div className="mt-esp-6">
        <FactureDoc facture={doc} entreprise={entreprise} />
      </div>
    </div>
  );
}
