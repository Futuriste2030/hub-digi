import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX, Loader2, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { recuPublique } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Vérification PUBLIQUE d'un reçu — c'est la cible du QR imprimé sur le reçu
   (lien unique et signé, propagé depuis la facture). Le reçu affiché est
   celui enregistré par le HUB après le paiement : c'est la référence du
   règlement, pas une capture d'écran. */

const dateFr = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
};

export default function PaiementRecu() {
  const { numero } = useParams();
  const [params] = useSearchParams();
  const sig = params.get('sig') ?? '';
  const [recu, setRecu] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await recuPublique(numero, sig);
      setRecu(data);
      setErreur('');
    } catch (e) {
      setRecu(null);
      setErreur(messageErreur(e, 'Reçu introuvable ou lien invalide.'));
    } finally {
      setChargement(false);
    }
  }, [numero, sig]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center overflow-hidden px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[480px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Vérification de paiement</p>
        </div>

        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          {chargement && (
            <p className="flex items-center justify-center gap-esp-2 py-esp-6 font-courant text-[15px] text-gris-600" role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Vérification…
            </p>
          )}

          {!chargement && !recu && (
            <div className="flex flex-col items-center py-esp-5 text-center">
              <CircleX size={30} aria-hidden="true" className="text-erreur" />
              <p className="mt-esp-3 font-titrage text-[20px] font-bold text-gris-900">Reçu introuvable</p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">{erreur}</p>
            </div>
          )}

          {!chargement && recu && (
            <>
              <div className="flex items-center gap-esp-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-succes-fond">
                  <CircleCheck size={22} aria-hidden="true" className="text-succes" />
                </span>
                <div>
                  <p className="dg-surtitre">Paiement authentique</p>
                  <h1 className="mt-esp-1 !text-[24px]">{recu.numero}</h1>
                </div>
              </div>

              <div className="mt-esp-4 rounded-lg bg-gris-100 p-esp-4 text-center">
                <p className="font-titrage text-[30px] font-extrabold text-gris-900 dg-tnum">
                  {fCFA(Number(recu.montant ?? 0))}
                </p>
                <p className="mt-esp-1 font-courant text-[13px] text-gris-600">reçu le {dateFr(recu.date)}</p>
              </div>

              <dl className="mt-esp-4 flex flex-col gap-esp-2">
                {[
                  ['Client', recu.client],
                  ['Facture réglée', recu.facture_numero],
                  ['Moyen de paiement', recu.moyen],
                  ['Statut de la facture', recu.statut_facture],
                ].map(([libelle, valeur]) => (
                  <div key={libelle} className="flex items-baseline justify-between gap-esp-3 border-b border-gris-200 pb-esp-2 last:border-0">
                    <dt className="font-courant text-[14px] text-gris-600">{libelle}</dt>
                    <dd className="font-courant text-[14px] font-semibold text-gris-900">{valeur || '—'}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-esp-4 flex items-center justify-center gap-esp-2 text-center font-courant text-[13px] text-gris-500">
                <ShieldCheck size={14} aria-hidden="true" /> Reçu enregistré par le HUB DIGI.
              </p>
            </>
          )}
        </div>

        <p className="mt-esp-4 text-center font-courant text-[13px] text-digi-brume">
          <Link to="/espace" className="hover:underline">Mon espace client</Link> · Digi Com et Technologies
        </p>
      </div>
    </div>
  );
}
