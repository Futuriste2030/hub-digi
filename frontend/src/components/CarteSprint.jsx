import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody } from './ui/Card.jsx';
import Badge from './ui/Badge.jsx';
import { listerSprints, rapportSprint, velociteProjet } from '../api/projets.js';
import { CourbeBurndown } from './Burndown.jsx';

/* Carte Pilotage (chef_dev/super_admin) : sprints actifs + vélocité moyenne. */
export default function CarteSprint() {
  const [sprints, setSprints] = useState([]);
  const [rapports, setRapports] = useState({});
  const [moyennes, setMoyennes] = useState({});

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const ss = await listerSprints({ statut: 'actif' });
        if (!actif) return;
        setSprints((ss.results ?? ss).slice(0, 3));
        const seen = new Set();
        for (const s of (ss.results ?? ss).slice(0, 3)) {
          try {
            const r = await rapportSprint(s.id);
            if (actif) setRapports((p) => ({ ...p, [s.id]: r }));
          } catch { /* rapport optionnel */ }
          if (!seen.has(s.project)) {
            seen.add(s.project);
            try {
              const v = await velociteProjet(s.project);
              if (actif) setMoyennes((p) => ({ ...p, [s.project]: v.velocite_moyenne }));
            } catch { /* optionnel */ }
          }
        }
      } catch {
        /* aucun sprint : carte masquée */
      }
    })();
    return () => { actif = false; };
  }, []);

  if (sprints.length === 0) return null;
  return (
    <Card survol={false}>
      <CardHeader>
        <div>
          <p className="dg-surtitre">Pilotage dev</p>
          <h2 className="mt-esp-1 !text-[18px]">Sprints actifs</h2>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-esp-4">
        {sprints.map((s) => {
          const rap = rapports[s.id];
          const pct = s.points_engages ? Math.round(((s.points_engages - (rap?.serie?.at(-1)?.restant_reel ?? s.points_engages)) / s.points_engages) * 100) : 0;
          const n = Math.ceil((new Date(s.date_fin) - new Date()) / 86400000);
          return (
            <div key={s.id} className="rounded-lg bg-gris-100 p-esp-3">
              <p className="flex flex-wrap items-center gap-esp-2 font-courant text-[15px] font-semibold text-gris-900">
                {s.nom} <Badge ton="info">{s.taches_terminees}/{s.taches_total} tâches</Badge>
                <span className="font-normal text-gris-600">{n < 0 ? 'dépassé' : `${n} j restants`} · {pct} % · vélocité {moyennes[s.project] ?? '—'} pts</span>
              </p>
              <div className="mt-esp-2" aria-hidden="true">
                <div className="h-2 overflow-hidden rounded bg-gris-300">
                  <div className="h-full rounded bg-digi" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                </div>
              </div>
              {rap && <div className="mt-esp-2"><CourbeBurndown serie={rap.serie.slice(-14)} /></div>}
              <Link to={`/projets/${s.project}`} className="mt-esp-1 inline-block font-courant text-[14px] font-semibold text-digi-texte">Ouvrir le projet</Link>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
