import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import Logo from '../Logo.jsx';
import Cachet from './Cachet.jsx';
import { fCFA } from '../../utils/stats.js';

/* Document facture — montants stockés TTC, HT recalculé au taux de la facture
   (tva_active côté API, 0 par défaut : pas de TVA au Mali).
   PDF : window.print() avec la feuille .dg-print-doc (voir index.css). */

export default function FactureDoc({ facture, entreprise }) {
  const barcodeRef = useRef(null);
  const estProforma = (facture.typeDoc ?? facture.type_doc ?? 'facture') === 'proforma';
  const titreDoc = estProforma ? 'Facture Proforma' : 'Facture';
  // NIF/RCCM affichés uniquement s'ils sont renseignés dans /parametres.
  const identifiants = [
    String(entreprise.nif ?? '').trim() && `NIF ${String(entreprise.nif).trim()}`,
    String(entreprise.rccm ?? '').trim() && `RCCM ${String(entreprise.rccm).trim()}`,
  ].filter(Boolean).join(' · ');

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, facture.numero, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 13,
          height: 44,
          margin: 0,
          background: '#ffffff',
          lineColor: '#0B182B',
        });
      } catch {
        /* code-barres indisponible, le numéro reste lisible */
      }
    }
  }, [facture.numero]);

  const taux = Number(facture.tauxTva ?? entreprise.tauxTva ?? 0);
  const ttc = facture.lignes.reduce((s, l) => s + l.montant * l.quantite, 0);
  const ht = Math.round((ttc * 100) / (100 + taux));
  const tva = ttc - ht;

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
          <span className="block font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-digi-signal">{titreDoc}</span>
          <span className="block font-mono text-[18px] font-semibold text-blanc">{facture.numero}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-esp-2 px-esp-6 pt-esp-5 font-courant text-[15px] text-gris-600">
        <span>Émise le <strong className="font-semibold text-gris-900">{facture.date}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Paiement sous <strong className="font-semibold text-gris-900">{entreprise.delaiPaiement}</strong></span>
        <span aria-hidden="true">·</span>
        <span>Statut <strong className="font-semibold text-gris-900">{facture.statut}</strong></span>
      </div>

      <div className="grid grid-cols-1 gap-esp-4 px-esp-6 pt-esp-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Émetteur</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{entreprise.raison}</p>
          <p className="font-courant text-[15px] text-gris-700">{entreprise.adresse}</p>
          <p className="font-courant text-[15px] text-gris-700 dg-tnum">{entreprise.phone}</p>
          <p className="font-mono text-[13px] text-gris-600">{entreprise.email}</p>
        </div>
        <div className="rounded-lg bg-gris-100 p-esp-4">
          <p className="font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Facturé à</p>
          <p className="mt-esp-2 font-courant text-[15px] font-semibold text-gris-900">{facture.client || '—'}</p>
          {facture.clientAdresse && <p className="font-courant text-[15px] text-gris-700">{facture.clientAdresse}</p>}
          {facture.clientPhone && <p className="font-courant text-[15px] text-gris-700 dg-tnum">{facture.clientPhone}</p>}
          {facture.clientEmail && <p className="font-mono text-[13px] text-gris-600">{facture.clientEmail}</p>}
          {facture.lienPaiement && <p className="mt-esp-1 font-mono text-[13px] text-gris-600">{facture.lienPaiement}</p>}
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
            {facture.lignes.map((l, i) => {
              const puHt = Math.round((l.montant * 100) / (100 + taux));
              return (
                <tr key={i} className="border-b border-gris-200">
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-900">{l.description}</td>
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.quantite}</td>
                  <td className="py-esp-3 pr-esp-3 font-courant text-[15px] text-gris-700 dg-tnum whitespace-nowrap">{fCFA(puHt)}</td>
                  <td className="py-esp-3 text-right font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(puHt * l.quantite)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-esp-6 pt-esp-4">
        <dl className="w-full max-w-[280px] font-courant text-[15px]">
          <div className="flex justify-between py-esp-1 text-gris-600"><dt>Total HT</dt><dd className="dg-tnum">{fCFA(ht)}</dd></div>
          <div className="flex justify-between py-esp-1 text-gris-600"><dt>TVA {taux} %</dt><dd className="dg-tnum">{fCFA(tva)}</dd></div>
          <div className="mt-esp-1 flex justify-between border-t-2 border-marine-profond pt-esp-2 font-titrage text-[18px] font-bold text-gris-900"><dt>Total TTC</dt><dd className="dg-tnum">{fCFA(ttc)}</dd></div>
        </dl>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-esp-4 px-esp-6 py-esp-5">
        <div>
          <svg ref={barcodeRef} role="img" aria-label={`Code-barres ${facture.numero}`} />
          <p className="dg-legende mt-esp-2 max-w-[52ch]">{entreprise.conditions}</p>
        </div>
        <div className="flex items-end gap-esp-5">
          <Cachet entreprise={entreprise} cachetUrl={entreprise.cachetFinance} signatureUrl={entreprise.signatureFinance} />
          <div className="text-center">
            <p className="font-courant text-[13px] text-gris-600">Document généré par HUB DIGI</p>
            <p className="mt-esp-2 border-t border-gris-400 px-esp-6 pt-esp-2 font-courant text-[13px] text-gris-600">
              {entreprise.signataire ?? 'La Direction'}<br />Signature et cachet
            </p>
          </div>
        </div>
      </div>

      <p className="border-t border-gris-300 bg-gris-100 px-esp-6 py-esp-3 text-center font-courant text-[13px] text-gris-600">{entreprise.pied}</p>
    </div>
  );
}
