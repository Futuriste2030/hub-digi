import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleX, Loader2, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { attestationPublique } from '../api/formations.js';
import { messageErreur } from '../api/client.js';

/* Vérification PUBLIQUE d'une attestation — c'est la cible du QR imprimé sur
   le document. L'attestation affichée est celle ENREGISTRÉE dans le HUB :
   source de vérité, pas une capture d'écran. Le lien est signé côté serveur. */

const dateFr = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export default function Attestation() {
  const { numero } = useParams();
  const [params] = useSearchParams();
  const sig = params.get('sig') ?? '';
  const [attestation, setAttestation] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await attestationPublique(numero, sig);
      setAttestation(data);
      setErreur('');
    } catch (e) {
      setAttestation(null);
      setErreur(messageErreur(e, 'Attestation introuvable ou lien invalide.'));
    } finally {
      setChargement(false);
    }
  }, [numero, sig]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center overflow-hidden px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[520px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Vérification d'attestation</p>
        </div>

        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          {chargement && (
            <p className="flex items-center justify-center gap-esp-2 py-esp-6 font-courant text-[15px] text-gris-600" role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Vérification…
            </p>
          )}

          {!chargement && !attestation && (
            <div className="flex flex-col items-center py-esp-5 text-center">
              <CircleX size={30} aria-hidden="true" className="text-erreur" />
              <p className="mt-esp-3 font-titrage text-[20px] font-bold text-gris-900">Attestation introuvable</p>
              <p className="mt-esp-2 max-w-[42ch] font-courant text-[15px] text-gris-600">{erreur}</p>
            </div>
          )}

          {!chargement && attestation && (
            <>
              <div className="flex items-center gap-esp-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-succes-fond">
                  <CircleCheck size={22} aria-hidden="true" className="text-succes" />
                </span>
                <div>
                  <p className="dg-surtitre">Attestation authentique</p>
                  <h1 className="mt-esp-1 !text-[24px]">{attestation.numero}</h1>
                </div>
              </div>

              <div className="mt-esp-4 rounded-lg bg-gris-100 p-esp-4 text-center">
                <p className="font-titrage text-[26px] font-extrabold text-gris-900">
                  {attestation.participant}
                </p>
                <p className="mt-esp-1 font-courant text-[13px] text-gris-600">
                  a suivi la formation « {attestation.formation} »
                </p>
              </div>

              <dl className="mt-esp-4 flex flex-col gap-esp-2">
                {[
                  ['Formation', attestation.formation],
                  ['Durée', attestation.formation_duree],
                  ['Période', attestation.formation_date_debut
                    ? `${dateFr(attestation.formation_date_debut)}${attestation.formation_date_fin
                      ? ` — ${dateFr(attestation.formation_date_fin)}` : ''}`
                    : ''],
                  ['Lieu', attestation.formation_lieu],
                  ['Délivrée le', dateFr(attestation.date_delivrance)],
                  ['Référence interne', attestation.inscription],
                ].filter(([, valeur]) => valeur).map(([libelle, valeur]) => (
                  <div key={libelle} className="flex items-baseline justify-between gap-esp-3 border-b border-gris-200 pb-esp-2 last:border-0">
                    <dt className="font-courant text-[14px] text-gris-600">{libelle}</dt>
                    <dd className="text-right font-courant text-[14px] font-semibold text-gris-900">{valeur}</dd>
                  </div>
                ))}
              </dl>

              {attestation.mention && (
                <p className="mt-esp-3 rounded-lg border-l-4 border-digi bg-digi-voile px-esp-3 py-esp-2 font-courant text-[14px] italic text-gris-700">
                  {attestation.mention}
                </p>
              )}

              <p className="mt-esp-4 flex items-center justify-center gap-esp-2 text-center font-courant text-[13px] text-gris-500">
                <ShieldCheck size={14} aria-hidden="true" /> Document enregistré par le HUB DIGI.
              </p>
            </>
          )}
        </div>

        <p className="mt-esp-4 text-center font-courant text-[13px] text-digi-brume">
          <Link to="/" className="hover:underline">Digi Com et Technologies</Link>
        </p>
      </div>
    </div>
  );
}
