import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Download, ArrowRight, Mail } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import DevisDoc from '../components/finance/DevisDoc.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { listerDevis, rejeterDevis, telechargerPdf, validerDevis } from '../api/finance.js';
import { listerClients } from '../api/clients.js';
import { envoyerMail } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import { fCFA } from '../utils/stats.js';
import { NonTrouve } from './Pages.jsx';

/* Détail devis — API réelle : document + conversion + envoi. */

const STATUT_LABEL = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' };
const numeroDevis = (d) => d.numero ?? `DEV-${String(d.id).padStart(4, '0')}`;
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};

export default function DevisDetail() {
  const { numero } = useParams();
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [devis, setDevis] = useState(null);
  const [nomClient, setNomClient] = useState('');
  const [emailClient, setEmailClient] = useState('');
  const [introuvable, setIntrouvable] = useState(false);

  const charger = async () => {
    try {
      const [ds, cls] = await Promise.all([listerDevis(), listerClients()]);
      const liste = cls.results ?? cls;
      const trouve = ds.find((d) => String(d.id) === String(numero));
      if (!trouve) setIntrouvable(true);
      else {
        setDevis(trouve);
        const cli = liste.find((c) => c.id === trouve.client);
        setNomClient(trouve.client_nom ?? cli?.nom_societe ?? '');
        setEmailClient(trouve.client_email ?? cli?.email ?? '');
      }
    } catch (e) {
      notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [numero]);

  if (introuvable) return <NonTrouve />;

  const convertir = async () => {
    try {
      const f = await validerDevis(devis.id);
      notifier({ type: 'succes', titre: 'Facture créée', texte: `${f.numero} générée.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Conversion impossible', texte: messageErreur(e) });
    }
  };

  const refuser = async () => {
    try {
      await rejeterDevis(devis.id);
      notifier({ type: 'info', titre: 'Devis refusé', texte: `${numeroDevis(devis)} signalé refusé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const envoyer = async () => {
    try {
      const cls = await listerClients();
      const email = (cls.results ?? cls).find((c) => c.id === devis.client)?.email;
      if (!email) {
        notifier({ type: 'info', titre: 'Envoi impossible', texte: 'Aucun e-mail sur la fiche client.' });
        return;
      }
      await envoyerMail({
        to: email, subject: `Votre devis ${numeroDevis(devis)}`,
        body_html: `<p>Bonjour, votre devis « ${devis.objet} » (${fCFA(Number(devis.total ?? 0))}) est disponible.</p>`,
        client: devis.client,
      });
      notifier({ type: 'succes', titre: 'Devis envoyé', texte: `Template à ${email}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  const imprimer = () => window.print();

  const telecharger = async () => {
    try {
      await telechargerPdf(`/finance/quotes/${devis.id}/pdf/`, `${numeroDevis(devis)}.pdf`);
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

  if (!devis) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }

  const doc = {
    numero: numeroDevis(devis),
    objet: devis.objet,
    client: nomClient,
    clientEmail: emailClient,
    date: dateFr(devis.cree_le),
    validite: dateFr(devis.validite),
    statut: STATUT_LABEL[devis.statut] ?? devis.statut,
    lignes: (devis.lignes ?? []).map((l) => ({ description: l.description, quantite: Number(l.quantite), montant: Number(l.montant) })),
  };

  return (
    <div>
      <div className="dg-no-print">
        <Link to="/finance/devis" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Devis
        </Link>
        <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
          <div className="mr-auto">
            <p className="dg-surtitre">Finance</p>
            <h1 className="mt-esp-2">{numeroDevis(devis)}</h1>
          </div>
          <Button variante="secondaire" onClick={imprimer}>
            <Printer size={20} aria-hidden="true" /> Imprimer
          </Button>
          <Button variante="secondaire" onClick={telecharger}>
            <Download size={20} aria-hidden="true" /> Télécharger en PDF
          </Button>
          <Button variante="secondaire" onClick={envoyer} title="Envoyer le template au client">
            <Mail size={20} aria-hidden="true" /> Envoyer par mail
          </Button>
          {peutValider && devis.statut === 'en_attente' && (
            <>
              <Button onClick={convertir}>
                Convertir en facture <ArrowRight size={20} aria-hidden="true" />
              </Button>
              <Button variante="fantome" onClick={refuser}>Refuser</Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-esp-6">
        <DevisDoc devis={doc} entreprise={entreprise} />
      </div>
    </div>
  );
}
