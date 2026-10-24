import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX, Loader2, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Logo from '../components/Logo.jsx';
import { statutPaiementPublic } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Retour du client après la page de paiement LigdiCash (return_url / cancel_url).

   On ne déduit JAMAIS le résultat de l'URL : le statut affiché est celui que
   LigdiCash renvoie via /confirm, relu par le backend. Tant que c'est
   « pending », on reinterroge à intervalle régulier (le callback peut
   arriver après le retour du client). */

const INTERVALLE = 4000;
const MAX_TENTATIVES = 12;

export default function PaiementRetour() {
  const [params] = useSearchParams();
  const txn = params.get('txn') ?? '';
  const sig = params.get('sig') ?? '';
  const annule = window.location.pathname.endsWith('/annule');
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const tentatives = useRef(0);
  const timer = useRef(null);

  const charger = useCallback(async () => {
    try {
      const reponse = await statutPaiementPublic(txn, sig);
      setData(reponse);
      setErreur('');
      return reponse;
    } catch (e) {
      setErreur(messageErreur(e, 'Vérification impossible.'));
      return null;
    } finally {
      setChargement(false);
    }
  }, [txn, sig]);

  useEffect(() => {
    charger();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [charger]);

  /* Tant que le paiement est « pending », on reinterroge (le callback peut
     arriver après le retour du client). */
  useEffect(() => {
    if (!data || data.statut !== 'pending') return undefined;
    if (tentatives.current >= MAX_TENTATIVES) return undefined;
    timer.current = setTimeout(async () => {
      tentatives.current += 1;
      await charger();
    }, INTERVALLE);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data, charger]);

  const statut = data?.statut;
  const succes = statut === 'completed';
  const echec = statut === 'notcompleted';

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center overflow-hidden px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[480px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Paiement</p>
        </div>

        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          {chargement && (
            <p className="flex items-center justify-center gap-esp-2 py-esp-6 font-courant text-[15px] text-gris-600" role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Vérification du paiement…
            </p>
          )}

          {!chargement && succes && (
            <div className="flex flex-col items-center py-esp-4 text-center">
              <CircleCheck size={34} aria-hidden="true" className="text-succes" />
              <p className="mt-esp-3 font-titrage text-[22px] font-bold text-gris-900">Paiement confirmé</p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">
                Merci. Votre paiement de {fCFA(Number(data.montant ?? 0))} a bien été reçu.
              </p>
              {data.recu_numero && (
                <p className="mt-esp-3 font-mono text-[13px] text-gris-600">Reçu {data.recu_numero}</p>
              )}
              {data.operator_name && (
                <p className="mt-esp-1 font-courant text-[13px] text-gris-600">Opérateur : {data.operator_name}</p>
              )}
            </div>
          )}

          {!chargement && !succes && !echec && (
            <div className="flex flex-col items-center py-esp-4 text-center">
              <Loader2 size={32} aria-hidden="true" className="animate-spin text-digi" />
              <p className="mt-esp-3 font-titrage text-[22px] font-bold text-gris-900">
                {annule ? 'Paiement annulé' : 'Paiement en cours de confirmation'}
              </p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">
                {annule
                  ? 'Vous avez interrompu le paiement. Vous pouvez relancer le règlement depuis votre espace client.'
                  : 'Nous attendons la confirmation de votre opérateur. Cette page se met à jour automatiquement.'}
              </p>
            </div>
          )}

          {!chargement && echec && (
            <div className="flex flex-col items-center py-esp-4 text-center">
              <CircleX size={34} aria-hidden="true" className="text-erreur" />
              <p className="mt-esp-3 font-titrage text-[22px] font-bold text-gris-900">Paiement non abouti</p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">
                Le règlement n’a pas abouti. Vous pouvez réessayer depuis votre espace client.
              </p>
            </div>
          )}

          {erreur && <p role="alert" className="mt-esp-4 text-center font-courant text-[15px] text-erreur">{erreur}</p>}

          <div className="mt-esp-5 flex flex-col gap-esp-3">
            {statut === 'pending' && (
              <Button variante="secondaire" onClick={charger} className="w-full">
                <RefreshCw size={18} aria-hidden="true" /> Vérifier à nouveau
              </Button>
            )}
            <Link
              to="/espace"
              className="inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-esp-2 rounded-md font-titrage text-[15px] font-bold uppercase tracking-[0.06em] text-gris-700 transition-colors hover:bg-gris-200"
            >
              Mon espace client
            </Link>
          </div>

          {data?.facture_numero && (
            <p className="mt-esp-4 text-center font-mono text-[13px] text-gris-600">{data.facture_numero}</p>
          )}
        </div>

        <p className="mt-esp-4 text-center font-courant text-[13px] text-digi-brume">
          Digi Com et Technologies — HUB DIGI · 2026
        </p>
      </div>
    </div>
  );
}
