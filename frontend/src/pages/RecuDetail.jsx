import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import RecuDoc from '../components/finance/RecuDoc.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, peutVoir } from '../lib/acces.js';
import { detailFacture, listerRecus, telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import { NonTrouve } from './Pages.jsx';

/* Détail reçu — API réelle : document + PDF serveur. */

const MOYEN_LABEL = { especes: 'Espèces', virement: 'Virement', mobile_money: 'Mobile Money' };

const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export default function RecuDetail() {
  const { numero } = useParams();
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [recu, setRecu] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const rs = await listerRecus({ search: numero });
        const trouve = rs.find((r) => r.numero === numero);
        if (!trouve || !actif) {
          if (actif) setIntrouvable(true);
          return;
        }
        const facture = await detailFacture(trouve.invoice);
        if (actif) {
          setRecu({
            ...trouve,
            facture: trouve.facture_numero ?? facture.numero,
            factureDate: dateFr(facture.cree_le),
            client: trouve.client_nom ?? facture.client_nom ?? '',
            clientEmail: trouve.client_email ?? facture.client_email ?? '',
            clientAdresse: trouve.client_adresse ?? facture.client_adresse ?? '',
            clientPhone: trouve.client_phone ?? facture.client_phone ?? '',
            date: dateFr(trouve.cree_le),
            moyen: MOYEN_LABEL[trouve.moyen] ?? trouve.moyen,
            lignes: (facture.lignes ?? []).map((l) => ({
              description: l.description, quantite: Number(l.quantite), montant: Number(l.montant),
            })),
          });
        }
      } catch (e) {
        if (actif) notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
      }
    })();
    return () => { actif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero]);

  if (introuvable) return <NonTrouve />;

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Finance réservée"
        requis="Seuls les membres du département Finance suivent ces documents."
      />
    );
  }

  const pdfServeur = async () => {
    try {
      await telechargerPdf(`/finance/receipts/${recu.id}/pdf/`, `${recu.numero}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  if (!recu) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }

  return (
    <div>
      <div className="dg-no-print">
        <Link to="/finance/recus" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Reçus
        </Link>
        <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
          <div className="mr-auto">
            <p className="dg-surtitre">Finance</p>
            <h1 className="mt-esp-2">{recu.numero}</h1>
          </div>
          <Button variante="secondaire" onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" /> Imprimer
          </Button>
          <Button variante="secondaire" onClick={pdfServeur}>
            <Printer size={20} aria-hidden="true" /> PDF serveur
          </Button>
        </div>
      </div>

      <div className="mt-esp-6">
        <RecuDoc recu={recu} entreprise={entreprise} />
      </div>
    </div>
  );
}
