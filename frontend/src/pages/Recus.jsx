import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Search, ArrowRight, Printer } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, peutVoir } from '../lib/acces.js';
import { listerRecus, telechargerPdf } from '../api/finance.js';
import { listerFactures } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Reçus — API réelle, générés automatiquement à chaque paiement (SPEC §5.7). */

const MOYEN_LABEL = { especes: 'Espèces', virement: 'Virement', mobile_money: 'Mobile Money' };
const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export default function Recus() {
  const { session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [recus, setRecus] = useState([]);
  const [factures, setFactures] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '') => {
    try {
      const [rs, fs] = await Promise.all([
        listerRecus(q ? { search: q } : {}),
        listerFactures(),
      ]);
      setRecus(rs);
      setFactures(Object.fromEntries(fs.map((f) => [f.id, f.numero])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des reçus impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const pdf = async (r) => {
    try {
      await telechargerPdf(`/finance/receipts/${r.id}/pdf/`, `${r.numero}.pdf`);
    } catch {
      /* échec silencieux : le détail affiche l'erreur */
    }
  };

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Finance réservée"
        requis="Seuls les membres du département Finance suivent ces documents."
      />
    );
  }

  return (
    <div>
      <div>
        <p className="dg-surtitre">Finance</p>
        <h1 className="mt-esp-2">Reçus</h1>
        <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
          Chaque paiement solde sa facture, génère un reçu PDF avec QR et l envoie au client.
        </p>
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, facture…" aria-label="Rechercher un reçu" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Reçu', 'Montant', 'Moyen', ''].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recus.map((r) => (
                <tr key={r.numero} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3">
                    <span className="font-mono text-[13px] text-gris-700">{r.numero}</span>
                    <span className="block font-courant text-[15px] text-gris-900">Facture {factures[r.invoice] ?? ''}</span>
                    <span className="block font-courant text-[13px] text-gris-600">{dateFr(r.cree_le)}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(r.montant ?? 0))}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{MOYEN_LABEL[r.moyen] ?? r.moyen}</td>
                  <td className="px-esp-3 py-esp-3 text-right">
                    <span className="inline-flex gap-esp-1">
                      <Link to={`/recus/${r.numero}`} aria-label={`Voir ${r.numero}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <ArrowRight size={20} aria-hidden="true" />
                      </Link>
                      <button type="button" onClick={() => pdf(r)} aria-label={`PDF ${r.numero}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                        <Printer size={20} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && recus.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun reçu avec cette recherche.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
