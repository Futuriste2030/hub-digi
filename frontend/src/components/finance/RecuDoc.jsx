import QRCode from 'react-qr-code';
import Logo from '../Logo.jsx';
import Cachet from './Cachet.jsx';
import { getFacture } from '../../data/finance.js';
import { PAIEMENT_EN_LIGNE_ACTIF, lienVerifRecu } from '../../lib/paiement.js';
import { fCFA } from '../../utils/stats.js';

/* Document reçu — même charte que facture/devis :
   montant hero + parties + produits réglés + totaux + règlement + QR + cachet.
   Données réelles (props) en priorité, maquette en repli. */

const montantNombre = (s) => Number(String(s ?? '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

export default function RecuDoc({ recu, entreprise }) {
  const lignesReelles = recu.lignes?.length > 0 ? recu.lignes : null;
  const facture = lignesReelles
    ? { lignes: recu.lignes, date: recu.factureDate, objet: recu.objet }
    : getFacture(recu.facture);
  const lignes = lignesReelles ?? facture?.lignes ?? [];
  const client = recu.client || facture?.client || '—';
  const clientEmail = recu.clientEmail || facture?.clientEmail || '';
  const clientAdresse = recu.clientAdresse || '';
  const clientPhone = recu.clientPhone || '';
  const totalLignes = lignes.reduce((s, l) => s + l.montant * l.quantite, 0);
  const montantRecu = montantNombre(recu.montant) || totalLignes;
  const totalFacture = facture ? lignes.reduce((s, l) => s + l.montant * l.quantite, 0) : totalLignes;
  const reste = Math.max(0, totalFacture - montantRecu);
  const objet = recu.objet ?? facture?.objet ?? `Règlement ${recu.facture}`;
  /* Sans gateway : QR de vérification interne (pas de domaine pay.digicom.ml mort). Logique conservée. */
  const qrValeur = lienVerifRecu(recu.numero, recu.facture, montantRecu);
  // NIF/RCCM affichés uniquement s'ils sont renseignés dans /parametres.
  const identifiants = [
    String(entreprise.nif ?? '').trim() && `NIF ${String(entreprise.nif).trim()}`,
    String(entreprise.rccm ?? '').trim() && `RCCM ${String(entreprise.rccm).trim()}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="dg-print-doc mx-auto w-full max-w-[800px] overflow-hidden rounded-lg border border-gris-300 bg-gris-0 shadow-ombre-1">
      {/* En-tête société */}
      <div className="flex flex-wrap items-center justify-between gap-esp-4 bg-marine-profond px-esp-6 py-esp-5">
        <span className="flex items-center gap-esp-3">
          <Logo hauteur={48} />
          <span>
            <span className="block font-titrage text-[15px] font-extrabold tracking-[0.06em] text-blanc">{entreprise.raison}</span>
            {identifiants !== '' && (
              <span className="block font-courant text-[13px] text-digi-brume">{identifiants}</span>
            )}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-digi-signal">Reçu de paiement</span>
          <span className="block font-mono text-[18px] font-semibold text-blanc">{recu.numero}</span>
        </span>
      </div>

      {/* Méta */}
      <div className="flex flex-wrap gap-esp-2 px-esp-6 pt-esp-5 font-courant text-[15px] text-gris-600">
        <span>Émis le <strong className="font-semibold text-gris-900">{recu.date}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Facture <strong className="font-mono text-[13px] text-gris-900">{recu.facture}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Moyen <strong className="font-semibold text-gris-900">{recu.moyen}</strong></span>
      </div>

      {/* Montant hero + tampon */}
      <div className="relative px-esp-6 pt-esp-4">
        <span aria-hidden="true" className="pointer-events-none absolute right-esp-6 top-esp-4 rotate-[-8deg] rounded-md border-4 border-succes px-esp-4 py-esp-1 font-titrage text-[21px] font-extrabold uppercase tracking-[0.1em] text-succes">
          Payé
        </span>
        <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Montant reçu</p>
        <p className="mt-esp-1 font-titrage text-[34px] font-extrabold leading-none text-gris-900 dg-tnum">{fCFA(montantRecu)}</p>
        <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
          Reçu de <strong className="font-semibold text-gris-900">{client}</strong>
          {(clientAdresse || clientPhone) && ` — ${[clientAdresse, clientPhone].filter(Boolean).join(' · ')}`} — {objet}
        </p>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 gap-esp-4 px-esp-6 pt-esp-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Émetteur</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{entreprise.raison}</p>
          <p className="font-courant text-[15px] text-gris-700">{entreprise.adresse}</p>
          <p className="font-courant text-[15px] text-gris-700 dg-tnum">{entreprise.phone}</p>
          <p className="font-mono text-[13px] text-gris-600">{entreprise.email}</p>
        </div>
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Reçu de</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{client}</p>
          {clientAdresse && <p className="font-courant text-[15px] text-gris-700">{clientAdresse}</p>}
          {clientPhone && <p className="font-courant text-[15px] text-gris-700 dg-tnum">{clientPhone}</p>}
          {clientEmail && <p className="font-mono text-[13px] text-gris-600">{clientEmail}</p>}
          <p className="mt-esp-1 font-courant text-[15px] text-gris-700">
            Facture <strong className="font-mono text-[13px]">{recu.facture}</strong>
            {facture?.date && <span className="text-gris-600"> du {facture.date}</span>}
          </p>
        </div>
      </div>

      {/* Produits / prestations réglées */}
      <div className="px-esp-6 pt-esp-5">
        <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">
          Produits / prestations réglées
        </p>
        <div className="mt-esp-2 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-marine-profond">
                {['Description', 'Qté', 'PU', 'Total'].map((col) => (
                  <th key={col} scope="col" className="pb-esp-2 pr-esp-3 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600 last:pr-0 last:text-right">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i} className="border-b border-gris-200 last:border-0">
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-900">{l.description}</td>
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.quantite}</td>
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum whitespace-nowrap">{fCFA(l.montant)}</td>
                  <td className="py-esp-3 text-right font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(l.montant * l.quantite)}</td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-esp-4 text-center font-courant text-[15px] text-gris-600">
                    Aucun détail produit — règlement {fCFA(montantRecu)}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totaux */}
      <div className="flex justify-end px-esp-6 pt-esp-4">
        <dl className="w-full max-w-[280px] font-courant text-[15px]">
          <div className="flex justify-between py-esp-1 text-gris-600"><dt>Total facture</dt><dd className="dg-tnum">{fCFA(totalFacture)}</dd></div>
          <div className="flex justify-between py-esp-1 text-gris-600"><dt>Montant reçu</dt><dd className="dg-tnum">{fCFA(montantRecu)}</dd></div>
          <div className="mt-esp-1 flex justify-between border-t-2 border-marine-profond pt-esp-2 font-titrage text-[18px] font-bold text-gris-900">
            <dt>Reste à payer</dt><dd className="dg-tnum">{fCFA(reste)}</dd>
          </div>
        </dl>
      </div>

      {/* Détails du règlement */}
      <dl className="grid grid-cols-2 gap-esp-3 px-esp-6 pt-esp-4 font-courant text-[15px] sm:grid-cols-4">
        {[
          ['Date de paiement', recu.date],
          ['Moyen', recu.moyen],
          ['Réf. transaction', recu.refTransaction || '—'],
          ['Statut facture', recu.factureStatut || 'Payée'],
        ].map(([terme, valeur]) => (
          <div key={terme} className="rounded-lg bg-gris-100 p-esp-3">
            <dt className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{terme}</dt>
            <dd className="mt-esp-1 break-words font-semibold text-gris-900">{valeur}</dd>
          </div>
        ))}
      </dl>

      {/* QR + cachet + signature */}
      <div className="flex flex-wrap items-center gap-esp-5 px-esp-6 py-esp-5">
        <span className="rounded-lg border border-gris-300 bg-gris-0 p-esp-3">
          <QRCode value={qrValeur} size={112} aria-label={`QR de vérification ${recu.numero}`} />
        </span>
        <div className="min-w-0 max-w-[260px]">
          <p className="font-courant text-[15px] font-semibold text-gris-900">Vérification</p>
          <p className="mt-esp-1 break-all font-mono text-[13px] text-gris-600">{qrValeur}</p>
          <p className="dg-legende mt-esp-2">{PAIEMENT_EN_LIGNE_ACTIF ? 'Scannez pour vérifier l authenticité du reçu.' : 'Référence interne de vérification (vérification en ligne bientôt disponible).'}</p>
        </div>
        <div className="ml-auto flex items-end gap-esp-5">
          <Cachet entreprise={entreprise} cachetUrl={entreprise.cachetFinance} signatureUrl={entreprise.signatureFinance} />
          <p className="border-t border-gris-400 px-esp-6 pt-esp-2 text-center font-courant text-[13px] text-gris-600">
            {entreprise.signataire ?? 'La Direction'}<br />Signature et cachet
          </p>
        </div>
      </div>

      <p className="border-t border-gris-300 bg-gris-100 px-esp-6 py-esp-3 text-center font-courant text-[13px] text-gris-600">{entreprise.pied}</p>
    </div>
  );
}
