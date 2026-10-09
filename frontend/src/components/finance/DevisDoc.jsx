import QRCode from 'react-qr-code';
import Logo from '../Logo.jsx';
import Cachet from './Cachet.jsx';
import { fCFA } from '../../utils/stats.js';

/* Document devis — même charte que la facture + QR de traçage. */

export default function DevisDoc({ devis, entreprise }) {
  const total = devis.lignes.reduce((s, l) => s + l.montant * l.quantite, 0);
  // QR « Suivi du devis » : espace client vivant. L'ancienne URL
  // app.digicom.ml/d/… est morte (mauvais domaine, route inexistante).
  const origine = typeof window !== 'undefined' ? window.location.origin : '';
  const qrValeur = devis.espaceUrl || `${origine}/espace`;
  // NIF/RCCM affichés uniquement s'ils sont renseignés dans /parametres.
  const identifiants = [
    String(entreprise.nif ?? '').trim() && `NIF ${String(entreprise.nif).trim()}`,
    String(entreprise.rccm ?? '').trim() && `RCCM ${String(entreprise.rccm).trim()}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="dg-print-doc mx-auto w-full max-w-[800px] overflow-hidden rounded-lg border border-gris-300 bg-gris-0 shadow-ombre-1">
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
          <span className="block font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-digi-signal">Devis</span>
          <span className="block font-mono text-[18px] font-semibold text-blanc">{devis.numero}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-esp-2 px-esp-6 pt-esp-5 font-courant text-[15px] text-gris-600">
        <span>Émis le <strong className="font-semibold text-gris-900">{devis.date}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Valable jusqu au <strong className="font-semibold text-gris-900">{devis.validite}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Statut <strong className="font-semibold text-gris-900">{devis.statut}</strong></span>
      </div>

      <div className="grid grid-cols-1 gap-esp-4 px-esp-6 pt-esp-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Émetteur</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{entreprise.raison}</p>
          <p className="font-courant text-[15px] text-gris-700">{entreprise.adresse}</p>
          <p className="font-mono text-[13px] text-gris-600">{entreprise.email}</p>
        </div>
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Destinataire</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{devis.client}</p>
          {devis.clientEmail && <p className="font-mono text-[13px] text-gris-600">{devis.clientEmail}</p>}
          <p className="font-courant text-[15px] text-gris-700">{devis.objet}</p>
        </div>
      </div>

      <div className="overflow-x-auto px-esp-6 pt-esp-4">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-marine-profond">
              {['Description', 'Qté', 'PU HT', 'Total HT'].map((col) => (
                <th key={col} scope="col" className="pb-esp-2 pr-esp-3 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600 last:pr-0 last:text-right">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devis.lignes.map((l, i) => (
              <tr key={i} className="border-b border-gris-200">
                <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-900">{l.description}</td>
                <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.quantite}</td>
                <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum whitespace-nowrap">{fCFA(l.montant)}</td>
                <td className="py-esp-3 text-right font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(l.montant * l.quantite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-esp-6 pt-esp-4">
        <p className="font-titrage text-[18px] font-bold text-gris-900 dg-tnum">Total : {fCFA(total)}</p>
      </div>

      <div className="px-esp-6 py-esp-5">
        <p className="dg-legende">Devis valable 30 jours. Toute acceptation transforme ce devis en facture envoyée.</p>
      </div>

      <div className="flex flex-wrap items-center gap-esp-5 px-esp-6 py-esp-5">
        <span className="rounded-lg border border-gris-300 bg-gris-0 p-esp-3">
          <QRCode value={qrValeur} size={112} aria-label={`QR de suivi ${devis.numero}`} />
        </span>
        <div className="min-w-0 max-w-[280px]">
          <p className="font-courant text-[15px] font-semibold text-gris-900">Suivi du devis</p>
          <p className="mt-esp-1 break-all font-mono text-[13px] text-gris-600">{qrValeur}</p>
          <p className="dg-legende mt-esp-2">Scannez pour ouvrir l espace client.</p>
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
