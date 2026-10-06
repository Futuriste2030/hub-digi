import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Bug,
  GitBranch,
  Rocket,
  Flag,
  Pencil,
  Check,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Input, Textarea } from '../components/ui/Input.jsx';
import ModaleTache from '../components/ModaleTache.jsx';
import LiensGit from '../components/LiensGit.jsx';
import SprintsTab from '../components/SprintsTab.jsx';
import GitHubTab from '../components/GitHubTab.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_DEV, ROLES_DEV, peutVoir } from '../lib/acces.js';
import { PRIORITE_LABEL, PRIORITE_TON, estimationTexte } from '../lib/taches.js';
import { creerJalon as creerJalonApi, creerTache, detailProjet, jalonsProjet, majJalon, majTache, tachesProjet, listerSprints } from '../api/projets.js';
import { listerBugs } from '../api/bugs.js';
import { cleTrackerProjet, genererCleTracker, majProjet } from '../api/tracker.js';
import { messageErreur } from '../api/client.js';
import { NonTrouve } from './Pages.jsx';

/* Détail projet — API réelle : Kanban, jalons, bugs, dépôt, snippet tracker.js (SPEC §9). */

const COLONNES = [
  { id: 'a_faire', libelle: 'À faire' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'review', libelle: 'Review' },
  { id: 'done', libelle: 'Done' },
];
const ORDRE = COLONNES.map((s) => s.id);
const TYPES_LABEL = { site_web: 'Site web', app_web: 'App web', app_mobile: 'App mobile', autre: 'Autre' };
const STATUTS_LABEL = { a_faire: 'À faire', en_cours: 'En cours', en_review: 'En review', termine: 'Terminé', en_pause: 'En pause' };
const STATUTS_TON = { a_faire: 'neutre', en_cours: 'info', en_review: 'alerte', termine: 'succes', en_pause: 'neutre' };
const JALON_STATUTS = [
  { id: 'a_venir', label: 'À venir' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'valide', label: 'Validé' },
];
const JALON_LABEL = Object.fromEntries(JALON_STATUTS.map((s) => [s.id, s.label]));
const GRAVITE_TON = { critique: 'erreur', haute: 'alerte', moyenne: 'info', basse: 'neutre' };
const snippet = (key) => `<script src="https://hub.digicom.ml/static/tracker.js" data-key="${key}"></script>`;
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const initialesDe = (email) => String(email ?? '').split(/[@.]/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

export default function ProjetDetail() {
  const { id } = useParams();
  const { notifier, session } = useOutletContext();
  const [projet, setProjet] = useState(null);
  const [taches, setTaches] = useState([]);
  const [jalons, setJalons] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [cle, setCle] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  const [modale, setModale] = useState(false);
  const [onglet, setOnglet] = useState('kanban');
  const [sprints, setSprints] = useState([]);
  const [sprintFiltre, setSprintFiltre] = useState('tous');
  const [detailTache, setDetailTache] = useState(null);
  const [jalonTitre, setJalonTitre] = useState('');
  const [repoEdit, setRepoEdit] = useState(false);
  const [repoValeur, setRepoValeur] = useState('');
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesValeur, setNotesValeur] = useState('');

  const charger = async () => {
    try {
      setChargement(true);
      const [p, ts, js, bs] = await Promise.all([
        detailProjet(id), tachesProjet(id), jalonsProjet(id), listerBugs({ project: id }),
      ]);
      setProjet(p);
      setTaches(ts);
      setJalons(js);
      setBugs(bs);
      try {
        const ss = await listerSprints({ project: id });
        setSprints(ss);
        const actif = ss.find((s) => s.statut === 'actif');
        if (actif) setSprintFiltre(String(actif.id));
      } catch {
        /* sprints optionnels */
      }
      if (['site_web', 'app_web'].includes(p.type)) {
        setCle(await cleTrackerProjet(id));
      }
    } catch (e) {
      if (e.response?.status === 404) setIntrouvable(true);
      else notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (introuvable) return <NonTrouve />;
  if (!peutVoir(session, ROLES_DEV)) {
    return (
      <AccesRestreint
        titre="Projet réservé au Développement"
        requis="Seuls les membres du département Développement suivent ce projet en interne."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Développement étudiera votre accès.' })}
      />
    );
  }
  const peutEditer = peutVoir(session, ROLES_CHEF_DEV);

  const deplacer = async (tache, dir) => {
    const i = ORDRE.indexOf(tache.statut);
    const j = Math.max(0, Math.min(ORDRE.length - 1, i + dir));
    if (i === j) return;
    try {
      const maj = await majTache(tache.id, { statut: ORDRE[j] });
      setTaches((prev) => prev.map((t) => (t.id === tache.id ? maj : t)));
    } catch (e) {
      notifier({ type: 'info', titre: 'Déplacement impossible', texte: messageErreur(e) });
    }
  };

  const creer = async ({ titre, statut, priorite, estimation_points, estimation_heures }) => {
    try {
      const payload = { project: Number(id), titre, statut };
      if (peutEditer) {
        if (priorite) payload.priorite = priorite;
        if (estimation_points !== undefined) payload.estimation_points = estimation_points;
        if (estimation_heures !== undefined) payload.estimation_heures = estimation_heures;
        if (sprintFiltre !== 'tous' && sprintFiltre !== 'backlog') payload.sprint = Number(sprintFiltre);
      }
      const t = await creerTache(payload);
      setTaches((prev) => [t, ...prev]);
      setModale(false);
      notifier({ type: 'succes', titre: 'Tâche créée', texte: titre });
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const copier = async (texte, quoi) => {
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      /* presse-papiers indisponible, on affiche quand même */
    }
    notifier({ type: 'info', titre: 'Copié', texte: quoi });
  };

  const creerJalon = async () => {
    if (jalonTitre.trim().length < 3) return;
    try {
      const j = await creerJalonApi({ project: Number(id), titre: jalonTitre.trim() });
      setJalons((prev) => [...prev, j]);
      setJalonTitre('');
      notifier({ type: 'succes', titre: 'Jalon ajouté', texte: 'Visible côté client dans son espace projet.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Ajout impossible', texte: messageErreur(e) });
    }
  };

  const changerJalon = async (jalon, statut) => {
    try {
      const maj = await majJalon(jalon.id, { statut });
      setJalons((prev) => prev.map((x) => (x.id === jalon.id ? maj : x)));
      notifier({ type: 'info', titre: 'Jalon actualisé', texte: `${jalon.titre} — ${JALON_LABEL[statut]}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Mise à jour impossible', texte: messageErreur(e) });
    }
  };

  const sauverRepo = async () => {
    if (repoValeur.trim().length < 3) return;
    try {
      const maj = await majProjet(id, { repo_url: repoValeur.trim() });
      setProjet(maj);
      setRepoEdit(false);
      notifier({ type: 'succes', titre: 'Dépôt mis à jour', texte: repoValeur.trim() });
    } catch (e) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
    }
  };

  const sauverNotes = async () => {
    try {
      const maj = await majProjet(id, { notes_deploiement: notesValeur });
      setProjet(maj);
      setNotesEdit(false);
      notifier({ type: 'succes', titre: 'Notes de déploiement mises à jour', texte: 'Environnements et consignes enregistrés.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
    }
  };

  const genererCle = async () => {
    try {
      const k = await genererCleTracker(Number(id));
      setCle(k);
      notifier({ type: 'succes', titre: 'Clé tracker générée', texte: k.public_key });
    } catch (e) {
      notifier({ type: 'info', titre: 'Génération impossible', texte: messageErreur(e) });
    }
  };

  if (chargement || !projet) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }

  return (
    <div>
      <Link to="/projets" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Projets
      </Link>
      <div className="mt-esp-2 flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">{projet.client_nom} · {TYPES_LABEL[projet.type] ?? projet.type}</p>
          <h1 className="mt-esp-2">{projet.titre}</h1>
          <div className="mt-esp-2 flex flex-wrap items-center gap-esp-2">
            <Badge ton={STATUTS_TON[projet.statut] ?? 'neutre'}>{STATUTS_LABEL[projet.statut] ?? projet.statut}</Badge>
            <Badge ton="neutre">Deadline {dateFr(projet.deadline)}</Badge>
            <Badge ton="neutre">{projet.progression} % terminé</Badge>
          </div>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle tâche
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center justify-between gap-esp-2">
              <h2 className="!text-[18px]">Dépôt</h2>
              {peutEditer && !repoEdit && (
                <button
                  type="button"
                  onClick={() => { setRepoValeur(projet.repo_url || ''); setRepoEdit(true); }}
                  aria-label="Modifier le dépôt"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-500 hover:bg-gris-200 hover:text-gris-700"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              )}
            </span>
          </CardHeader>
          <CardBody>
            {repoEdit ? (
              <span className="flex gap-esp-2">
                <span className="flex-1"><Input value={repoValeur} onChange={(e) => setRepoValeur(e.target.value)} placeholder="github.com/digicom/mon-projet" aria-label="Adresse du dépôt" /></span>
                <Button taille="sm" onClick={sauverRepo}><Check size={16} aria-hidden="true" /></Button>
              </span>
            ) : (
              <p className="flex items-center gap-esp-2 font-mono text-[13px] text-gris-700"><GitBranch size={16} aria-hidden="true" className="shrink-0 text-digi" />{projet.repo_url || '—'}</p>
            )}
          </CardBody>
        </Card>
        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center justify-between gap-esp-2">
              <h2 className="!text-[18px]">Déploiement</h2>
              {peutEditer && !notesEdit && (
                <button
                  type="button"
                  onClick={() => { setNotesValeur(projet.notes_deploiement || ''); setNotesEdit(true); }}
                  aria-label="Renseigner les notes de déploiement"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-500 hover:bg-gris-200 hover:text-gris-700"
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              )}
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-2 font-courant text-[15px] text-gris-700">
            {notesEdit ? (
              <>
                <Textarea value={notesValeur} onChange={(e) => setNotesValeur(e.target.value)} placeholder="URL prod, staging, consignes…" rows={4} aria-label="Notes de déploiement" />
                <span className="flex gap-esp-2">
                  <Button taille="sm" onClick={sauverNotes}><Check size={16} aria-hidden="true" /> Enregistrer</Button>
                  <Button taille="sm" variante="fantome" onClick={() => setNotesEdit(false)}>Annuler</Button>
                </span>
              </>
            ) : (
              <p className="whitespace-pre-wrap">{projet.notes_deploiement || '—'}</p>
            )}
          </CardBody>
        </Card>
        <Card survol={false}>
          <CardHeader><h2 className="!text-[18px]">Tracker bugs</h2></CardHeader>
          <CardBody>
            {cle ? (
              <>
                <p className="font-mono text-[13px] text-gris-700">Clé <span className="font-semibold text-gris-900">{cle.public_key}</span></p>
                <pre className="mt-esp-2 overflow-x-auto rounded-md bg-marine-profond p-esp-3 font-mono text-[13px] text-digi-brume">{snippet(cle.public_key)}</pre>
                <button type="button" onClick={() => copier(snippet(cle.public_key), 'Snippet tracker copié. Collez-le avant la balise de fermeture body.')} className="mt-esp-2 inline-flex min-h-[44px] items-center gap-esp-2 font-courant text-[15px] font-semibold text-digi-texte">
                  <Copy size={16} aria-hidden="true" /> Copier le snippet
                </button>
              </>
            ) : ['site_web', 'app_web'].includes(projet.type) ? (
              peutEditer ? (
                <Button variante="secondaire" onClick={genererCle}><Rocket size={16} aria-hidden="true" /> Générer la clé tracker</Button>
              ) : (
                <p className="font-courant text-[15px] text-gris-600">Clé non générée (chef Dév).</p>
              )
            ) : (
              <p className="font-courant text-[15px] text-gris-600">Pas de tracker : projet non web.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-esp-7 !text-[18px]">Suivi transmis au client</h2>
      <p className="mt-esp-1 max-w-[70ch] font-courant text-[15px] text-gris-600">
        Jalons = grandes étapes de validation convenues (pas les tâches Kanban internes). Tout est visible dans son espace projet.
      </p>
      <div className="mt-esp-3 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        <Card survol={false}>
          <CardHeader><h3 className="!text-[18px]">Jalons</h3></CardHeader>
          <CardBody className="flex flex-col gap-esp-2">
            {jalons.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun jalon pour le moment.</p>}
            {jalons.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-esp-2 rounded-lg bg-gris-100 p-esp-3">
                <Flag size={18} aria-hidden="true" className="shrink-0 text-digi" />
                <span className="min-w-40 flex-1 font-courant text-[15px] font-semibold text-gris-900">{j.titre}{j.date ? ` · ${dateFr(j.date)}` : ''}</span>
                {peutEditer ? (
                  <select
                    value={j.statut}
                    onChange={(e) => changerJalon(j, e.target.value)}
                    aria-label={`Statut du jalon ${j.titre}`}
                    className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]"
                  >
                    {JALON_STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                ) : (
                  <Badge ton="neutre">{JALON_LABEL[j.statut] ?? j.statut}</Badge>
                )}
              </div>
            ))}
            {peutEditer && (
              <div className="flex gap-esp-2">
                <div className="flex-1"><Input value={jalonTitre} onChange={(e) => setJalonTitre(e.target.value)} placeholder="Nouveau jalon… Ex. Mise en ligne" aria-label="Nouveau jalon" /></div>
                <Button taille="sm" onClick={creerJalon}><Plus size={16} aria-hidden="true" /></Button>
              </div>
            )}
          </CardBody>
        </Card>
        <Card survol={false}>
          <CardHeader><h3 className="!text-[18px]">Livrables</h3></CardHeader>
          <CardBody className="flex flex-col gap-esp-2">
            <p className="font-courant text-[15px] text-gris-600">Upload réel des fichiers à venir — les jalons ci-contre alimentent déjà l espace client.</p>
          </CardBody>
        </Card>
      </div>

      <div role="tablist" aria-label="Sections du projet" className="mt-esp-6 flex flex-wrap gap-esp-2">
        {[{ id: 'kanban', label: 'Kanban' }, { id: 'sprints', label: 'Sprints' }, ...(peutEditer ? [{ id: 'github', label: 'GitHub' }] : [])].map((o) => (
          <button
            key={o.id} role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}
            className={`min-h-[44px] rounded-md px-esp-4 font-courant text-[15px] font-semibold ${onglet === o.id ? 'bg-digi text-blanc' : 'bg-gris-200 text-gris-700 hover:bg-gris-300'}`}
          >
            {o.label}
          </button>
        ))}
        <Link to={`/dev/backlog?projet=${projet.id}`} className="inline-flex min-h-[44px] items-center rounded-md px-esp-4 font-courant text-[15px] font-semibold text-digi-texte hover:bg-gris-200">
          Backlog
        </Link>
      </div>

      {onglet === 'sprints' && <SprintsTab projetId={projet.id} peutEditer={peutEditer} notifier={notifier} />}
      {onglet === 'github' && peutEditer && <GitHubTab projet={projet} onProjetMaj={setProjet} notifier={notifier} />}

      {onglet === 'kanban' && (
      <>
      <div className="mt-esp-4 flex flex-wrap items-center gap-esp-2">
        <label htmlFor="flt-sprint" className="font-courant text-[14px] text-gris-600">Sprint</label>
        <select
          id="flt-sprint" value={sprintFiltre} onChange={(e) => setSprintFiltre(e.target.value)}
          className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]"
        >
          <option value="tous">Tous</option>
          <option value="backlog">Backlog (sans sprint)</option>
          {sprints.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.statut})</option>)}
        </select>
        {(() => {
          const s = sprints.find((x) => String(x.id) === String(sprintFiltre));
          if (!s) return null;
          const n = Math.ceil((new Date(s.date_fin) - new Date()) / 86400000);
          return (
            <p className="font-courant text-[14px] text-gris-700" role="status">
              <strong>{s.nom}</strong> — {s.objectif || 'sans objectif'} · {n < 0 ? 'dépassé' : `${n} j restants`} · {s.points_engages} pts engagés · {s.taches_terminees}/{s.taches_total} tâches
            </p>
          );
        })()}
      </div>
      <h2 className="mt-esp-7 !text-[18px]">Kanban</h2>
      <div className="mt-esp-3 grid grid-cols-1 gap-esp-4 md:grid-cols-2 xl:grid-cols-4">
        {COLONNES.map((col) => {
          const items = taches.filter((t) => t.statut === col.id).filter((t) => {
            if (sprintFiltre === 'tous') return true;
            if (sprintFiltre === 'backlog') return t.sprint == null;
            return String(t.sprint) === String(sprintFiltre);
          });
          return (
            <section key={col.id} aria-label={col.libelle} className="flex flex-col gap-esp-3 rounded-lg bg-gris-200/60 p-esp-3">
              <header className="flex items-center justify-between px-esp-1">
                <h3 className="font-titrage text-[13px] font-bold uppercase tracking-[0.06em] text-gris-700">{col.libelle}</h3>
                <Badge ton="neutre">{items.length}</Badge>
              </header>
              {items.map((t) => (
                <article key={t.id} className="rounded-lg border border-gris-300 bg-gris-0 p-esp-3 shadow-ombre-1">
                  <p className="font-mono text-[12px] text-gris-500">{t.reference} {t.ajoutee_en_cours_de_sprint && '· +sprint'}</p>
                  <p className="font-courant text-[15px] font-semibold text-gris-900">{t.titre}</p>
                  <div className="mt-esp-1 flex flex-wrap gap-esp-1">
                    <Badge ton={PRIORITE_TON[t.priorite] ?? 'neutre'}>{PRIORITE_LABEL[t.priorite] ?? t.priorite}</Badge>
                    <Badge ton="neutre">{t.estimation_points ?? '—'} pts</Badge>
                  </div>
                  <p className="mt-esp-1 font-courant text-[13px] text-gris-600 dg-tnum">{estimationTexte(t)}</p>
                  <div className="mt-esp-2 flex items-center gap-esp-2">
                    <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-pilule bg-digi-voile font-courant text-[13px] font-bold text-digi">
                      {initialesDe(t.assigne_email)}
                    </span>
                    <span className="truncate font-courant text-[13px] text-gris-600">{t.assigne_email ?? 'Non assignée'} · <span className="dg-tnum">{t.temps_passe}h</span></span>
                  </div>
                  <div className="mt-esp-2 flex items-center justify-between border-t border-gris-200 pt-esp-2">
                    <button type="button" onClick={() => deplacer(t, -1)} disabled={col.id === ORDRE[0]} aria-label={`Reculer ${t.titre}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200 disabled:opacity-45">
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDetailTache(detailTache?.id === t.id ? null : t)} aria-expanded={detailTache?.id === t.id} aria-label={`Détails ${t.titre}`} className="min-h-[44px] rounded-md px-esp-2 font-courant text-[13px] font-semibold text-digi-texte hover:bg-gris-200">
                      Détails
                    </button>
                    <button type="button" onClick={() => deplacer(t, 1)} disabled={col.id === ORDRE[ORDRE.length - 1]} aria-label={`Avancer ${t.titre}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200 disabled:opacity-45">
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </div>
                  {detailTache?.id === t.id && (
                    <div className="mt-esp-2 border-t border-gris-200 pt-esp-2">
                      <LiensGit tache={t} notifier={notifier} />
                    </div>
                  )}
                </article>
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-gris-300 px-esp-3 py-esp-4 text-center font-courant text-[13px] text-gris-500">Colonne vide</p>
              )}
            </section>
          );
        })}
      </div>

      <h2 className="mt-esp-7 !text-[18px]">Bugs remontés</h2>
      <Card survol={false} className="mt-esp-3">
        <CardBody className="flex flex-col gap-esp-3 pt-esp-5">
          {bugs.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucun bug. Le tracker alimente cette liste en direct.</p>}
          {bugs.map((b) => (
            <div key={b.numero} className="flex flex-col gap-esp-2 rounded-lg bg-gris-100 p-esp-3">
              <div className="flex items-start gap-esp-3">
                <Bug size={20} aria-hidden="true" className="mt-esp-1 shrink-0 text-digi" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] text-gris-600">{b.numero}</p>
                  <p className="font-courant text-[15px] font-semibold text-gris-900">{b.titre}</p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-esp-1">
                  <Badge ton={GRAVITE_TON[b.gravite] ?? 'neutre'}>{b.gravite}</Badge>
                  <Badge ton="neutre">{b.statut}</Badge>
                </span>
              </div>
              <LiensGit bug={b} notifier={notifier} />
            </div>
          ))}
        </CardBody>
      </Card>
      </>
      )}

      {modale && <ModaleTache projets={[{ id: projet.id, nom: projet.titre, client: projet.client_nom }]} projetFixe={projet.id} colonnes={COLONNES} onFermer={() => setModale(false)} onCreer={creer} estimationLectureSeule={!peutEditer} />}
    </div>
  );
}
