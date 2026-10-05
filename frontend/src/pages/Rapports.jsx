import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, Award, Download, Check } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_RH, ROLES_RH, peutVoir } from '../lib/acces.js';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { rapportPointage, validerPrime } from '../api/ressources.js';
import { telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';

/* Rapports mensuels de pointage — RH (SPEC §5.5) : généré automatiquement,
   employé du mois (score /100) + prime à valider, export PDF. */

const fCFA = (n) => `${Number(n ?? 0).toLocaleString('fr-FR')} F`;

export default function Rapports() {
  const { notifier, session } = useOutletContext();
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (m) => {
    setChargement(true);
    try {
      const r = await rapportPointage(m);
      setRapport(r);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Rapport indisponible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger(mois);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  if (!peutVoir(session, ROLES_RH)) {
    return (
      <AccesRestreint
        titre="Rapports réservés aux RH"
        requis="Seuls les membres des Ressources Humaines suivent les rapports de pointage."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef RH étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_RH);

  const valider = async () => {
    try {
      await validerPrime(rapport.prime.id);
      notifier({ type: 'succes', titre: 'Prime validée', texte: `${fCFA(rapport.prime.montant)} — ${rapport.prime.email}.` });
      charger(mois);
    } catch (e) {
      notifier({ type: 'info', titre: 'Validation impossible', texte: messageErreur(e) });
    }
  };

  const pdf = async () => {
    try {
      await telechargerPdf(`/rh/pointage/rapport/pdf/?mois=${mois}`, `rapport-pointage-${mois}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">RH · Pointage</p>
          <h1 className="mt-esp-2">Rapports mensuels</h1>
        </div>
        <span className="flex flex-wrap gap-esp-2">
          <Button variante="secondaire" onClick={pdf}><Download size={16} aria-hidden="true" /> PDF</Button>
          <Link to="/rh/pointage"><Button variante="fantome">Pointages du jour</Button></Link>
        </span>
      </div>

      <div className="mt-esp-6 max-w-96">
        <Label htmlFor="rp-mois">Mois</Label>
        <div className="mt-esp-2"><Input id="rp-mois" type="month" value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} /></div>
      </div>

      {chargement ? (
        <p className="mt-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Génération du rapport…</p>
      ) : erreur ? (
        <p className="mt-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : rapport && (
        <>
          <Card survol={false} className="mt-esp-4">
            <CardHeader>
              <span className="flex items-center gap-esp-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                  <Award size={20} aria-hidden="true" className="text-digi" />
                </span>
                <h2 className="!text-[18px]">Employé du mois — {rapport.mois}</h2>
              </span>
            </CardHeader>
            <CardBody>
              {rapport.gagnant ? (
                <div className="flex flex-wrap items-center gap-esp-3">
                  <div className="min-w-48 flex-1">
                    <p className="font-courant text-[17px] font-semibold text-gris-900">{rapport.gagnant.email}</p>
                    <p className="font-courant text-[15px] text-gris-600 dg-tnum">
                      Score {rapport.gagnant.score}/100 · {rapport.gagnant.presents} j présents · {rapport.gagnant.retards} retard{rapport.gagnant.retards > 1 ? 's' : ''} · {rapport.gagnant.heures} h
                    </p>
                    {rapport.prime && (
                      <p className="mt-esp-1 font-courant text-[15px] text-gris-700">
                        Prime {fCFA(rapport.prime.montant)} — <Badge ton={rapport.prime.validee ? 'succes' : 'alerte'}>{rapport.prime.validee ? 'Validée' : 'À valider'}</Badge>
                      </p>
                    )}
                  </div>
                  {peutValider && rapport.prime && !rapport.prime.validee && (
                    <Button taille="sm" onClick={valider}><Check size={16} aria-hidden="true" /> Valider la prime</Button>
                  )}
                </div>
              ) : (
                <p className="font-courant text-[15px] text-gris-600">Aucun pointage ce mois-ci : pas d employé du mois.</p>
              )}
            </CardBody>
          </Card>

          <Card survol={false} className="mt-esp-4">
            <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gris-300">
                    {['Employé', 'Présents', 'Retards', 'Dép. ant.', 'Congés', 'Absences', 'Heures', 'Score'].map((col) => (
                      <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(rapport.lignes ?? []).map((l) => (
                    <tr key={l.employe} className="border-b border-gris-200 last:border-0">
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900">{l.email}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.presents} j</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.retards}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.departs_anticipes}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.conges}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.absences}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{l.heures} h</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum">{l.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dg-legende mt-esp-2 px-esp-3">
                {rapport.jours_ouvres} jours ouvrés · Congés validés exclus des absences et du score · Score = présence 40 + ponctualité 30 + heures 20 + assiduité 10.
              </p>
            </CardBody>
          </Card>
        </>
      )}
      <p className="mt-esp-3">
        <Link to="/rh/employes" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          Fiches employés <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
