import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Inbox } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_DEV, ROLES_DEV, peutVoir } from '../lib/acces.js';
import { PRIORITE_LABEL, PRIORITE_TON } from '../lib/taches.js';
import {
  backlogProjet, listerProjets, listerSprints, majTache,
} from '../api/projets.js';
import { messageErreur } from '../api/client.js';

/* Backlog par projet : tâches sans sprint + sprints, affectation en 1 clic (SPEC Jira §2). */
export default function Backlog() {
  const { notifier, session } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [projets, setProjets] = useState([]);
  const [projetId, setProjetId] = useState(params.get('projet') ?? '');
  const [items, setItems] = useState([]);
  const [sprints, setSprints] = useState([]);

  useEffect(() => {
    listerProjets().then((ps) => {
      setProjets(ps);
      if (!projetId && ps[0]) setProjetId(String(ps[0].id));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projetId) return;
    setParams({ projet: projetId }, { replace: true });
    Promise.all([backlogProjet(projetId), listerSprints({ project: projetId })])
      .then(([b, ss]) => { setItems(b); setSprints(ss); })
      .catch((e) => notifier({ type: 'info', titre: 'Backlog indisponible', texte: messageErreur(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId]);

  if (!peutVoir(session, ROLES_DEV)) {
    return <AccesRestreint titre="Backlog réservé au Développement" requis="Seuls les membres du Développement organisent le backlog." onDemander={() => {}} />;
  }
  const peutEditer = peutVoir(session, ROLES_CHEF_DEV);
  const projet = projets.find((p) => String(p.id) === String(projetId));

  const affecter = async (tache, sprintId) => {
    try {
      const maj = await majTache(tache.id, { sprint: sprintId ? Number(sprintId) : null });
      setItems((prev) => prev.filter((t) => t.id !== maj.id || maj.sprint === null));
      if (maj.sprint !== null) setItems((prev) => prev.filter((t) => t.id !== maj.id));
      notifier({ type: 'succes', titre: 'Tâche affectée', texte: tache.titre });
    } catch (e) {
      notifier({ type: 'info', titre: 'Affectation impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <Link to="/projets" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Projets
      </Link>
      <div className="mt-esp-2 flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Développement · Sprints</p>
          <h1 className="mt-esp-2">Backlog{projet ? ` — ${projet.titre}` : ''}</h1>
        </div>
        <select
          value={projetId} onChange={(e) => setProjetId(e.target.value)} aria-label="Projet"
          className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]"
        >
          {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
        </select>
      </div>
      <div className="mt-esp-4 flex flex-wrap gap-esp-2">
        {sprints.map((s) => (
          <Badge key={s.id} ton={s.statut === 'actif' ? 'info' : 'neutre'}>{s.nom} · {s.statut} · {s.taches_terminees}/{s.taches_total}</Badge>
        ))}
        {sprints.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun sprint sur ce projet.</p>}
      </div>
      <Card survol={false} className="mt-esp-4">
        <CardHeader><h2 className="!text-[18px]"><Inbox size={16} aria-hidden="true" className="mr-esp-1 inline" />Backlog ({items.length}) — sans sprint, non terminées</h2></CardHeader>
        <CardBody className="flex flex-col gap-esp-2">
          {items.length === 0 && <p className="font-courant text-[15px] text-gris-600">Backlog vide : tout est planifié ou terminé.</p>}
          {items.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-esp-2 rounded-lg bg-gris-100 p-esp-3">
              <span className="font-mono text-[13px] text-gris-600">{t.reference}</span>
              <span className="min-w-40 flex-1 font-courant text-[15px] font-semibold text-gris-900">{t.titre}</span>
              <Badge ton={PRIORITE_TON[t.priorite] ?? 'neutre'}>{PRIORITE_LABEL[t.priorite] ?? t.priorite}</Badge>
              <span className="font-courant text-[13px] text-gris-600 dg-tnum">{t.estimation_points ?? '—'} pts</span>
              {peutEditer ? (
                <select
                  defaultValue="" onChange={(e) => affecter(t, e.target.value)} aria-label={`Affecter ${t.titre} à un sprint`}
                  className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]"
                >
                  <option value="">Affecter à…</option>
                  {sprints.filter((s) => s.statut !== 'termine').map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.statut})</option>)}
                </select>
              ) : (
                <Badge ton="neutre">{t.statut}</Badge>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
      <div className="mt-esp-3">
        <Link to={projetId ? `/projets/${projetId}` : '/projets'}><Button variante="secondaire">Ouvrir le Kanban</Button></Link>
      </div>
    </div>
  );
}
