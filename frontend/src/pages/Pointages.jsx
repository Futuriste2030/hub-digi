import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_RH, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { listerPointages } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';

/* Liste des pointages — RH (SPEC §5.5). Filtre par date + recherche employé. */

const STATUT_TON = { a_l_heure: 'succes', retard: 'alerte', normal: 'succes', anticipe: 'alerte' };
const STATUT_LABEL = { a_l_heure: "À l'heure", retard: 'En retard', normal: 'Normal', anticipe: 'Anticipé' };

const heureHM = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function Pointages() {
  const { notifier, session } = useOutletContext();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recherche, setRecherche] = useState('');
  const [pointages, setPointages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    setChargement(true);
    (async () => {
      try {
        const pts = await listerPointages({ date });
        if (!actif) return;
        setPointages(pts);
        setErreur('');
      } catch (e) {
        if (!actif) return;
        setErreur(messageErreur(e, 'Chargement des pointages impossible.'));
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => { actif = false; };
  }, [date]);

  if (!peutVoir(session, ROLES_RH)) {
    return (
      <AccesRestreint
        titre="Pointages réservés aux RH"
        requis="Seuls les membres des Ressources Humaines suivent les pointages."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef RH étudiera votre accès.' })}
      />
    );
  }

  const q = recherche.trim().toLowerCase();
  const visibles = pointages.filter((p) => q === '' || (p.email ?? '').toLowerCase().includes(q));
  const presents = pointages.filter((p) => p.heure_arrivee).length;
  const retards = pointages.filter((p) => p.statut_arrivee === 'retard').length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">RH · Pointage 08h00–17h00</p>
          <h1 className="mt-esp-2">Pointages</h1>
          <p className="mt-esp-1 font-courant text-[15px] text-gris-600 dg-tnum">
            {presents} présent{presents > 1 ? 's' : ''} · {retards} retard{retards > 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/rh/rapports"><Button variante="secondaire">Rapports mensuels <ArrowRight size={16} aria-hidden="true" /></Button></Link>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pt-date">Jour</Label>
          <div className="mt-esp-2"><Input id="pt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="relative sm:mt-[28px]">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="E-mail employé…" aria-label="Rechercher un employé" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Employé', 'Arrivée', 'Départ', 'Distance'].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900">{p.email}</td>
                  <td className="px-esp-3 py-esp-3">
                    <span className="font-courant text-[15px] text-gris-700 dg-tnum">{heureHM(p.heure_arrivee)}</span>{' '}
                    {p.statut_arrivee && <Badge ton={STATUT_TON[p.statut_arrivee] ?? 'neutre'}>{STATUT_LABEL[p.statut_arrivee] ?? p.statut_arrivee}</Badge>}
                  </td>
                  <td className="px-esp-3 py-esp-3">
                    <span className="font-courant text-[15px] text-gris-700 dg-tnum">{heureHM(p.heure_depart)}</span>{' '}
                    {p.statut_depart && <Badge ton={STATUT_TON[p.statut_depart] ?? 'neutre'}>{STATUT_LABEL[p.statut_depart] ?? p.statut_depart}</Badge>}
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{p.distance_m != null ? `${Math.round(p.distance_m)} m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && visibles.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun pointage ce jour.</p>
          )}
        </CardBody>
      </Card>
      <p className="mt-esp-3">
        <Link to="/rh/employes" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          Fiches employés <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
