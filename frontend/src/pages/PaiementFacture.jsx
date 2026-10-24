import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleX, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Logo from '../components/Logo.jsx';
import { facturePaiementPublique, initierPaiementLien } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { PAIEMENT_EN_LIGNE_ACTIF } from '../lib/paiement.js';
import { fCFA } from '../utils/stats.js';

/* Page de paiement PUBLIQUE d'une facture — c'est la cible du QR imprimé sur
   la facture (lien unique et signé, figé dans le document).

   Règle : le montant affiché vient TOUJOURS du serveur. Le lien ne transporte
   que le numéro de la facture et sa signature : impossible d'y changer le
   montant à la main. */

export default function PaiementFacture() {
  const { numero } = useParams();
  const [params] = useSearchParams();
  const sig = params.get('sig') ?? '';
  const [facture, setFacture] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await facturePaiementPublique(numero, sig);
      setFacture(data);
      setErreur('');
    } catch (e) {
      setFacture(null);
      setErreur(messageErreur(e, 'Lien de paiement invalide ou expiré.'));
    } finally {
      setChargement(false);
    }
  }, [numero, sig]);

  useEffect(() => { charger(); }, [charger]);

  const payer = async () => {
    setEnCours(true);
    setErreur('');
    try {
      const data = await initierPaiementLien(numero, sig);
      /* LigdiCash bloque l'iframe et le navigateur bloque le popup après un
         await : on ouvre la page de paiement dans l'onglet courant. */
      window.location.assign(data.pay_url);
    } catch (e) {
      setErreur(messageErreur(e, 'Paiement impossible. Réessayez dans un instant.'));
      setEnCours(false);
    }
  };

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center overflow-hidden px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[520px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Digi Com et Technologies</p>
        </div>

        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          {chargement && (
            <p className="flex items-center justify-center gap-esp-2 py-esp-6 font-courant text-[15px] text-gris-600" role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Chargement de la facture…
            </p>
          )}

          {!chargement && !facture && (
            <div className="flex flex-col items-center py-esp-5 text-center">
              <CircleX size={30} aria-hidden="true" className="text-erreur" />
              <p className="mt-esp-3 font-titrage text-[20px] font-bold text-gris-900">Lien de paiement indisponible</p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">{erreur}</p>
              <Link to="/espace" className="mt-esp-4 font-courant text-[15px] font-semibold text-digi-texte hover:underline">
                Accéder à mon espace client
              </Link>
            </div>
          )}

          {!chargement && facture && (
            <>
              <div className="flex items-center gap-esp-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-digi-voile">
                  <Smartphone size={20} aria-hidden="true" className="text-digi" />
                </span>
                <div>
                  <p className="dg-surtitre">Règlement en ligne</p>
                  <h1 className="mt-esp-1 !text-[24px]">{facture.numero}</h1>
                </div>
              </div>

              <p className="mt-esp-4 font-courant text-[15px] text-gris-600">
                Facture adressée à <strong className="text-gris-900">{facture.client}</strong>.
                Réglez-la par Mobile Money (Orange, MTN, Moov…) via la page sécurisée LigdiCash.
              </p>

              <div className="mt-esp-4 rounded-lg bg-gris-100 p-esp-4 text-center">
                <p className="font-mono text-[13px] text-gris-600">{facture.numero}</p>
                <p className="mt-esp-1 font-titrage text-[30px] font-extrabold text-gris-900 dg-tnum">
                  {fCFA(Number(facture.montant_a_payer ?? 0))}
                </p>
                {Number(facture.paye ?? 0) > 0 && (
                  <p className="mt-esp-1 font-courant text-[13px] text-gris-600">
                    Déjà réglé : {fCFA(Number(facture.paye))} — reste à payer ci-dessus.
                  </p>
                )}
              </div>

              {facture.lignes?.length > 0 && (
                <ul className="mt-esp-4 flex flex-col gap-esp-2">
                  {facture.lignes.map((l, i) => (
                    <li key={`${l.description}-${i}`} className="flex items-baseline justify-between gap-esp-3 border-b border-gris-200 pb-esp-2 last:border-0">
                      <span className="font-courant text-[14px] text-gris-700">{l.description}</span>
                      <span className="font-courant text-[14px] font-semibold text-gris-900 dg-tnum">{fCFA(Number(l.montant ?? 0))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {erreur && <p role="alert" className="mt-esp-4 font-courant text-[15px] text-erreur">{erreur}</p>}

              {PAIEMENT_EN_LIGNE_ACTIF && Number(facture.montant_a_payer ?? 0) > 0 ? (
                <Button taille="lg" className="mt-esp-5 w-full" onClick={payer} desactive={enCours} chargement={enCours}>
                  <Smartphone size={20} aria-hidden="true" /> Payer {fCFA(Number(facture.montant_a_payer))}
                </Button>
              ) : (
                <p role="note" className="mt-esp-5 rounded-md bg-gris-100 p-esp-3 text-center font-courant text-[14px] text-gris-600">
                  {Number(facture.montant_a_payer ?? 0) > 0
                    ? 'Le paiement en ligne n’est pas encore activé. Contactez l’agence pour régler cette facture.'
                    : 'Cette facture est déjà réglée. Merci.'}
                </p>
              )}

              <p className="mt-esp-4 flex items-center justify-center gap-esp-2 text-center font-courant text-[13px] text-gris-500">
                <ShieldCheck size={14} aria-hidden="true" /> Paiement sécurisé par LigdiCash — aucun numéro de carte requis.
              </p>
            </>
          )}
        </div>

        <p className="mt-esp-4 text-center font-courant text-[13px] text-digi-brume">
          Digi Com et Technologies — HUB DIGI · 2026
        </p>
      </div>
    </div>
  );
}
