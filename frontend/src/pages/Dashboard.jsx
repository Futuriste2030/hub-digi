import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { Plus, ArrowRight, ChevronDown, Ticket, X, Search } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import AreaChart from '../components/charts/AreaChart.jsx';
import Donut from '../components/charts/Donut.jsx';
import { AnimatedNumber } from '../components/stats/Primitives.jsx';
import NouveauProjetModal from '../components/NouveauProjetModal.jsx';
import CarteSprint from '../components/CarteSprint.jsx';
import { fCFA, num0, num1 } from '../utils/stats.js';
import { ROLES_CHEF_DEV, ROLES_FINANCE, peutVoir, slugDepartement, urlTableauDeBord } from '../lib/acces.js';
import { dashboardAdmin, dashboardPerso, seriesDashboard } from '../api/dashboard.js';
import { listerTickets } from '../api/tickets.js';
import { listerClients } from '../api/clients.js';
import { creerProjet } from '../api/projets.js';
import { messageErreur } from '../api/client.js';

/* Tableau de bord — données réelles (SPEC §5.1 : KPI super admin + vue perso scopée). */

const TYPES_VALEUR = { 'Site web': 'site_web', 'App web': 'app_web', 'App mobile': 'app_mobile', Autre: 'autre' };
const STATUTS_PROJET_LABEL = { a_faire: 'À faire', en_cours: 'En cours', en_review: 'En review', termine: 'Terminé', en_pause: 'En pause' };
const STATUTS_PROJET_COULEUR = { a_faire: 'var(--gris-300)', en_cours: 'var(--bleu-digi)', en_review: 'var(--alerte-lumineux)', termine: 'var(--succes-lumineux)', en_pause: 'var(--gris-400)' };

const STATUT_TICKET = {
  nouveau: { label: 'Nouveau', ton: 'info' },
  qualifie: { label: 'Qualifié', ton: 'alerte' },
  en_attente_aval: { label: 'En attente aval', ton: 'alerte' },
  approuve: { label: 'Approuvé', ton: 'info' },
  repondu: { label: 'Répondu', ton: 'succes' },
  clos: { label: 'Clos', ton: 'neutre' },
  rejete: { label: 'Rejeté', ton: 'erreur' },
};

const ilYa = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'Hier' : `Il y a ${j} j`;
};

function Cellule({ surtitre, children }) {
  return (
    <div className="bg-gris-0 p-esp-5 flex flex-col justify-between gap-esp-4">
      <p className="dg-surtitre">{surtitre}</p>
      {children}
    </div>
  );
}

function BandeauStats({ scope, kpi, series }) {
  const spark = (series?.encaissements ?? []).slice(-8);
  return (
    <Card survol={false} className="overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-gris-300 sm:grid-cols-2 xl:grid-cols-4">
        {scope === 'admin' ? (
          <>
            <Cellule surtitre="Encaissé net">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.ca_net ?? kpi.ca_paye} format={fCFA} />
              </p>
              <p className="font-courant text-[15px] text-gris-600 dg-tnum">{fCFA(kpi.ca_paye)} − {fCFA(kpi.depenses_total ?? 0)} dép.</p>
            </Cellule>
            <Cellule surtitre="Projets en retard">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.projets_en_retard} format={(v) => num0.format(Math.round(v))} />
              </p>
            </Cellule>
            <Cellule surtitre="Tickets ouverts">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.tickets_ouverts} format={(v) => num0.format(Math.round(v))} />
              </p>
              <Badge ton="alerte" className="mt-esp-2 self-start">{kpi.tickets_urgents} urgents</Badge>
            </Cellule>
            <Cellule surtitre="Bugs critiques">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.bugs_critiques} format={(v) => num0.format(Math.round(v))} />
              </p>
              <p className="font-courant text-[15px] text-gris-600 dg-tnum">{kpi.effectif} employés · {kpi.clients} clients</p>
            </Cellule>
          </>
        ) : (
          <>
            <Cellule surtitre="Mes tâches en cours">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.taches_assignees} format={(v) => num0.format(Math.round(v))} />
              </p>
              <p className="font-courant text-[15px] text-gris-600 dg-tnum">{kpi.projets_suivis} projets suivis</p>
            </Cellule>
            <Cellule surtitre="Tickets de mon département">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.tickets_dept_ouverts} format={(v) => num0.format(Math.round(v))} />
              </p>
            </Cellule>
            <Cellule surtitre={kpi.quatriemeLabel}>
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.quatriemeValeur} format={(v) => num0.format(Math.round(v))} />
              </p>
            </Cellule>
            <Cellule surtitre="Notifications non lues">
              <p className="font-titrage text-[26px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
                <AnimatedNumber value={kpi.notifs_non_lues} format={(v) => num0.format(Math.round(v))} />
              </p>
            </Cellule>
          </>
        )}
      </div>
      {scope === 'admin' && spark.length > 1 && (
        <p className="dg-legende px-esp-5 py-esp-2">Encaissements des {spark.length} derniers mois · source Finance</p>
      )}
    </Card>
  );
}

function CartePerformance({ series }) {
  const [metrique, setMetrique] = useState('enc');
  const [comparer, setComparer] = useState(true);

  const labels = series?.labels ?? [];
  const enc = series?.encaissements ?? [];
  const liv = series?.projets ?? [];
  const curr = labels.slice(6).map((d, i) => ({ d, v: metrique === 'enc' ? (enc[i + 6] ?? 0) : (liv[i + 6] ?? 0) }));
  const prev = labels.slice(0, 6).map((d, i) => ({ d, v: metrique === 'enc' ? (enc[i] ?? 0) : (liv[i] ?? 0) }));
  const totalC = curr.reduce((a, b) => a + b.v, 0);
  const totalP = prev.reduce((a, b) => a + b.v, 0);
  const delta = ((totalC - totalP) / (totalP || 1)) * 100;

  const format = metrique === 'enc' ? fCFA : (v) => `${num0.format(Math.round(v))} projets`;
  const formatAxe = metrique === 'enc'
    ? (v) => (v >= 1000 ? `${num1.format(v / 1000)} kF` : `${num0.format(v)} F`)
    : (v) => num0.format(v);

  return (
    <Card survol={false} className="flex h-full flex-col">
      <CardHeader>
        <div>
          <p className="dg-surtitre">Performance · 12 derniers mois</p>
          <h2 className="mt-esp-1 !text-[18px]">{metrique === 'enc' ? 'Encaissements' : 'Projets créés'}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-esp-2">
          <div className="flex rounded-md border border-gris-300 bg-gris-100 p-0.5">
            {[['enc', 'Encaissé'], ['liv', 'Projets']].map(([k, lb]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetrique(k)}
                aria-pressed={metrique === k}
                className={`min-h-[36px] rounded-sm px-esp-3 font-courant text-[15px] font-semibold transition-colors duration-rapide ${metrique === k ? 'bg-marine-profond text-blanc' : 'text-gris-600 hover:text-gris-900'}`}
              >
                {lb}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setComparer((c) => !c)}
            aria-pressed={comparer}
            className="flex min-h-[36px] items-center gap-esp-2 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-600 hover:text-gris-900"
          >
            <span className={`relative h-[18px] w-8 rounded-pilule transition-colors duration-rapide ${comparer ? 'bg-digi' : 'bg-gris-300'}`}>
              <span className={`absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-pilule bg-blanc transition-transform duration-rapide ${comparer ? 'translate-x-[14px]' : ''}`} />
            </span>
            Comparer
          </button>
        </div>
      </CardHeader>
      <div className="flex flex-wrap items-end gap-x-esp-4 gap-y-esp-1 px-esp-5">
        <p className="font-titrage text-[28px] font-extrabold leading-none text-gris-900 dg-tnum whitespace-nowrap">
          <AnimatedNumber key={metrique} value={totalC} format={format} />
        </p>
        <span className={`font-courant text-[15px] font-semibold dg-tnum ${delta >= 0 ? 'text-succes' : 'text-erreur'}`}>
          {delta >= 0 ? '+' : ''}{num1.format(delta)} % vs 6 mois précédents
        </span>
      </div>
      <div className="flex-1 px-esp-2 pb-esp-1">
        <AreaChart curr={curr} prev={prev} compare={comparer} format={format} formatAxe={formatAxe} animKey={metrique + (comparer ? 'c' : '')} />
      </div>
      <div className="flex items-center justify-between border-t border-gris-300 px-esp-5 py-esp-3">
        <div className="flex items-center gap-esp-4">
          <span className="inline-flex items-center gap-esp-2 font-courant text-[13px] text-gris-600">
            <span aria-hidden="true" className="h-[3px] w-4 rounded-pilule bg-digi" /> 6 derniers mois
          </span>
          {comparer && (
            <span className="inline-flex items-center gap-esp-2 font-courant text-[13px] text-gris-600">
              <span aria-hidden="true" className="h-[3px] w-4 rounded-pilule bg-gris-400" /> 6 mois précédents
            </span>
          )}
        </div>
        <span className="dg-legende">Source : Finance + Projets</span>
      </div>
    </Card>
  );
}

function CarteTickets({ tickets, query, setQuery }) {
  const [filtre, setFiltre] = useState('tous');
  const [ouvert, setOuvert] = useState(null);
  const filtres = [['tous', 'Tous'], ...Object.entries(STATUT_TICKET).map(([k, v]) => [k, v.label])];
  const q = query.trim().toLowerCase();
  const items = tickets.map((t) => ({
    ref: t.numero, client: t.client_nom ?? '', projet: t.project_titre ?? '',
    objet: t.sujet, statut: t.statut, delai: ilYa(t.cree_le), message: t.message,
  }));
  const visibles = items.filter(
    (t) =>
      (filtre === 'tous' || t.statut === filtre) &&
      (q === '' || t.objet.toLowerCase().includes(q) || t.client.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q) || t.projet.toLowerCase().includes(q)),
  );
  const compte = (k) => (k === 'tous' ? items.length : items.filter((t) => t.statut === k).length);

  return (
    <Card survol={false} className="flex h-full flex-col">
      <CardHeader>
        <div>
          <p className="dg-surtitre">Support</p>
          <h2 className="mt-esp-1 !text-[18px]">Tickets récents</h2>
        </div>
        <Link to="/tickets" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          Tout voir <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </CardHeader>
      <div className="flex flex-wrap gap-esp-2 px-esp-5 pb-esp-3">
        {filtres.map(([k, lb]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltre(k)}
            aria-pressed={filtre === k}
            className={`min-h-[36px] rounded-pilule border px-esp-3 font-courant text-[15px] font-semibold transition-colors duration-rapide dg-tnum ${
              filtre === k ? 'border-marine-profond bg-marine-profond text-blanc' : 'border-gris-300 text-gris-600 hover:text-gris-900'
            }`}
          >
            {lb} · {compte(k)}
          </button>
        ))}
      </div>
      <div className="flex-1 px-esp-3 pb-esp-2">
        {q !== '' && (
          <div className="mx-esp-2 mb-esp-2 flex items-center justify-between gap-esp-3 rounded-lg bg-digi-voile px-esp-4 py-esp-3">
            <span className="font-courant text-[15px] text-digi-texte dg-tnum">
              {visibles.length} résultat{visibles.length > 1 ? 's' : ''} pour « {query.trim()} »
            </span>
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-white/50"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {visibles.length === 0 ? (
          <div className="flex flex-col items-center px-esp-5 py-esp-9 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-pilule border border-gris-300 bg-gris-100 text-gris-500">
              <Search size={20} aria-hidden="true" />
            </span>
            <p className="mt-esp-3 font-courant text-[17px] font-semibold text-gris-900">Aucun ticket trouvé</p>
            <p className="mt-esp-1 font-courant text-[15px] text-gris-600">Essayez un autre objet, client ou numéro.</p>
            <button
              type="button"
              onClick={() => { setQuery(''); setFiltre('tous'); }}
              className="mt-esp-4 font-courant text-[15px] font-semibold text-digi-texte"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
        visibles.map((t) => {
          const st = STATUT_TICKET[t.statut] ?? { label: t.statut, ton: 'neutre' };
          const estOuvert = ouvert === t.ref;
          return (
            <div key={t.ref}>
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : t.ref)}
                aria-expanded={estOuvert}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-esp-3 rounded-lg px-esp-3 py-esp-3 text-left transition-colors duration-rapide hover:bg-gris-100"
              >
                <Ticket size={20} aria-hidden="true" className="shrink-0 text-digi" />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-esp-2">
                    <span className="truncate font-courant text-[17px] font-semibold text-gris-900">{t.objet}</span>
                  </span>
                  <span className="block truncate font-mono text-[13px] text-gris-600">
                    {t.ref} · {t.client} · {t.projet}
                  </span>
                </span>
                <span className="flex items-center gap-esp-2 justify-self-end">
                  <span className="hidden font-courant text-[13px] text-gris-600 md:block">{t.delai}</span>
                  <Badge ton={st.ton}>{st.label}</Badge>
                  <ChevronDown size={16} aria-hidden="true" className={`text-gris-500 transition-transform duration-standard ${estOuvert ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {estOuvert && (
                <div className="dg-pop mx-esp-3 mb-esp-2 rounded-lg border border-gris-300 bg-gris-100 p-esp-4">
                  <p className="font-courant text-[15px] leading-[1.6] text-gris-700">{t.message}</p>
                  <div className="mt-esp-3 flex items-center justify-between border-t border-gris-300 pt-esp-3">
                    <span className="font-courant text-[13px] text-gris-600">Secrétariat · demande aval si besoin</span>
                    <Link to="/tickets" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
                      Ouvrir <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
        </div>
      <div className="border-t border-gris-300 px-esp-5 py-esp-3">
        <Link to="/tickets" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-gris-600 hover:text-gris-900 dg-tnum">
          Voir les {items.length} tickets <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function CarteTopClients({ clients, notifier }) {
  const top = [...clients].sort((a, b) => (b.projets_count ?? 0) - (a.projets_count ?? 0)).slice(0, 4);
  const max = Math.max(1, ...top.map((c) => c.projets_count ?? 0));

  const exporter = () => {
    const lignes = ['Client;Projets;Tickets ouverts;Factures impayées',
      ...top.map((c) => `${c.nom_societe};${c.projets_count ?? 0};${c.tickets_ouverts ?? 0};${c.factures_impayees ?? 0}`)];
    const url = URL.createObjectURL(new Blob([lignes.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top-clients.csv';
    a.click();
    URL.revokeObjectURL(url);
    notifier({ type: 'succes', titre: 'Export généré', texte: 'top-clients.csv téléchargé.' });
  };

  return (
    <Card survol={false} className="flex h-full flex-col">
      <CardHeader>
        <div>
          <p className="dg-surtitre">Portefeuille</p>
          <h2 className="mt-esp-1 !text-[18px]">Top clients</h2>
        </div>
      </CardHeader>
      <div className="flex-1 divide-y divide-gris-200 px-esp-5 pb-esp-2">
        {top.length === 0 && <p className="py-esp-4 text-center font-courant text-[15px] text-gris-600">Aucun client pour le moment.</p>}
        {top.map((c, i) => (
          <div key={c.id} className="flex items-start gap-esp-4 py-esp-4">
            <span aria-hidden="true" className="w-8 font-titrage text-[21px] font-bold leading-none text-gris-400 dg-tnum">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-esp-3">
                <p className="truncate font-courant text-[17px] font-semibold text-gris-900">{c.nom_societe}</p>
              </div>
              <p className="mt-0.5 font-courant text-[15px] text-gris-600">{c.contact || c.email}</p>
              <div className="mt-esp-2 h-1.5 overflow-hidden rounded-pilule bg-gris-200" role="progressbar" aria-valuenow={Math.round(((c.projets_count ?? 0) / max) * 100)} aria-valuemin="0" aria-valuemax="100" aria-label={`Part de ${c.nom_societe}`}>
                <div className="h-full rounded-pilule" style={{ width: `${((c.projets_count ?? 0) / max) * 100}%`, background: 'var(--bleu-digi)' }} />
              </div>
              <p className="mt-esp-2 font-courant text-[15px] text-gris-600 dg-tnum">
                {c.projets_count ?? 0} projets · {c.tickets_ouverts ?? 0} tickets ouverts · <strong className="font-semibold text-gris-900">{c.factures_impayees ?? 0} impayés</strong>
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gris-300 px-esp-5 py-esp-3">
        <button
          type="button"
          onClick={exporter}
          className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-gris-600 hover:text-gris-900"
        >
          Exporter le classement <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { query, setQuery, notifier, session } = useOutletContext();
  const { departement } = useParams();
  const [modale, setModale] = useState(false);
  const [donnees, setDonnees] = useState(null);
  const [clientsOptions, setClientsOptions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        setChargement(true);
        const estAdmin = session?.role === 'super_admin';
        const [kpi, series, tickets, clients] = await Promise.all([
          estAdmin ? dashboardAdmin() : dashboardPerso(),
          seriesDashboard(),
          listerTickets({ ordering: '-cree_le', page_size: 6 }),
          listerClients(),
        ]);
        if (!actif) return;
        const liste = clients.results ?? clients;
        let quatrieme = { quatriemeLabel: 'Notifications non lues', quatriemeValeur: kpi.notifs_non_lues ?? 0 };
        if (estAdmin) quatrieme = null;
        else if (['chef_finance', 'membre_finance'].includes(session?.role)) {
          quatrieme = { quatriemeLabel: 'Factures impayées', quatriemeValeur: kpi.factures_impayees };
        } else if (['chef_rh', 'membre_rh', 'admin'].includes(session?.role)) {
          quatrieme = { quatriemeLabel: 'Congés en attente', quatriemeValeur: kpi.conges_en_attente };
        }
        setDonnees({ scope: estAdmin ? 'admin' : 'perso', kpi: { ...kpi, ...quatrieme }, series, tickets, clients: liste });
        setClientsOptions(liste);
        setErreur('');
      } catch (e) {
        if (actif) setErreur(messageErreur(e, 'Chargement du tableau de bord impossible.'));
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => { actif = false; };
  }, [session?.role]);

  const donut = useMemo(() => {
    const lignes = donnees?.kpi?.par_statut_projets ?? [];
    return lignes.map((l) => ({
      label: STATUTS_PROJET_LABEL[l.statut] ?? l.statut,
      valeur: l.n,
      couleur: STATUTS_PROJET_COULEUR[l.statut] ?? 'var(--gris-400)',
    }));
  }, [donnees]);

  /* Client hors hub agence -> portail dédié. Création projet = Chef Dév. */
  if (session?.role === 'client') return <Navigate to="/espace" replace />;
  /* Slug imposé : chacun son /dashboard/:departement (super_admin = /dashboard). */
  if (session?.role !== 'super_admin' && departement && departement !== slugDepartement(session?.dept)) {
    return <Navigate to={urlTableauDeBord(session)} replace />;
  }
  const peutCreerProjet = peutVoir(session, ROLES_CHEF_DEV);
  const voitFinance = peutVoir(session, [...ROLES_FINANCE, 'admin']);
  const voitSprints = peutVoir(session, ROLES_CHEF_DEV);

  const creer = async ({ nom, client, type, deadline }) => {
    const trouve = clientsOptions.find((c) => c.nom_societe === client);
    if (!trouve) {
      notifier({ type: 'info', titre: 'Client introuvable', texte: 'Sélectionnez un client existant.' });
      return;
    }
    try {
      await creerProjet({ client: trouve.id, titre: nom, type: TYPES_VALEUR[type] ?? 'autre', deadline });
      setModale(false);
      notifier({ type: 'succes', titre: 'Projet créé', texte: `${nom} — ${client}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  if (chargement || !donnees) {
    return (
      <div>
        <p className="dg-surtitre">Pilotage</p>
        <h1 className="mt-esp-2">Tableau de bord</h1>
        {erreur
          ? <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          : <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement des indicateurs…</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Pilotage{departement ? ` · ${departement}` : ''}</p>
          <h1 className="mt-esp-2">Tableau de bord</h1>
          <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
            Données temps réel — {donnees.scope === 'admin' ? 'vision globale' : 'votre périmètre'}.
          </p>
        </div>
        {peutCreerProjet && (
          <Button onClick={() => setModale(true)}>
            <Plus size={20} aria-hidden="true" /> Nouveau projet
          </Button>
        )}
      </div>

      <div className="mt-esp-6">
        <BandeauStats scope={donnees.scope} kpi={donnees.kpi} series={donnees.series} />
      </div>

      {voitSprints && (
        <div className="mt-esp-4">
          <CarteSprint />
        </div>
      )}

      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CartePerformance series={donnees.series} />
        </div>
        <Card survol={false} className="flex h-full flex-col">
          <CardHeader>
            <div>
              <p className="dg-surtitre">Répartition</p>
              <h2 className="mt-esp-1 !text-[18px]">Projets par statut</h2>
            </div>
          </CardHeader>
          <CardBody className="flex-1">
            {donut.length === 0
              ? <p className="font-courant text-[15px] text-gris-600">Aucun projet pour le moment.</p>
              : <Donut data={donut} />}
          </CardBody>
        </Card>
      </div>

      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CarteTickets tickets={donnees.tickets} query={query} setQuery={setQuery} />
        </div>
        {voitFinance && (
        <div className="lg:col-span-2">
          <CarteTopClients clients={donnees.clients} notifier={notifier} />
        </div>
        )}
      </div>

      {modale && (
        <NouveauProjetModal
          clients={clientsOptions.map((c) => c.nom_societe)}
          onFermer={() => setModale(false)}
          onCreer={creer}
        />
      )}
    </div>
  );
}
