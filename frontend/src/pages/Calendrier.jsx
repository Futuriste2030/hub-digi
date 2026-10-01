import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, ArrowRight, X, CalendarDays, Eye, ChevronLeft, ChevronRight, LayoutList, CalendarRange } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_COM, ROLES_COM, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import { ChipsCanaux } from '../components/com/ChampsCom.jsx';
import { creerPublication, listerPublications, majPublication, supprimerPublication } from '../api/ressources.js';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';

/* Calendrier éditorial — API réelle (SPEC §5.3 : isolé par client, vue mois, statuts). */

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const CANAUX = ['Facebook', 'Instagram', 'TikTok', 'LinkedIn'];
const STATUTS = [
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'a_valider', label: 'À valider' },
  { id: 'programme', label: 'Programmé' },
  { id: 'publie', label: 'Publié' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { brouillon: 'neutre', a_valider: 'alerte', programme: 'info', publie: 'succes' };
const STATUT_COULEUR = { brouillon: 'var(--gris-400)', a_valider: 'var(--alerte)', programme: 'var(--bleu-digi)', publie: 'var(--succes)' };
const SUIVANT = { brouillon: 'a_valider', a_valider: 'programme', programme: 'publie', publie: 'publie' };

const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('T')[0].split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const versMois = (iso) => {
  const [a, m, j] = String(iso).split('T')[0].split('-').map(Number);
  return { a, m, j };
};

function ModaleDetail({ pub, nomClient, onFermer, onAvancer, onSupprimer, peutSupprimer }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={pub.titre}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <div className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">{nomClient} · {dateFr(pub.date_pub)}</p>
            <h2 className="!text-[21px]">{pub.titre}</h2>
            <p className="mt-esp-1 font-courant text-[15px] text-gris-600">{pub.canal || '—'}</p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-3 flex flex-wrap items-center gap-esp-2">
          <Badge ton={STATUT_TON[pub.statut] ?? 'neutre'}>{STATUT_LABEL[pub.statut] ?? pub.statut}</Badge>
          {pub.a_valider_par_client && <Badge ton="alerte">À valider par le client</Badge>}
          {peutSupprimer && (pub.statut === 'brouillon' || pub.statut === 'a_valider') && (
            <BoutonSupprimer
              titre={`Supprimer ${pub.titre}`}
              libelle={pub.titre}
              texte="Supprimer définitivement la publication"
              onConfirmer={() => onSupprimer(pub)}
            />
          )}
        </div>
        {pub.contenu && (
          <p className="mt-esp-4 whitespace-pre-wrap font-courant text-[15px] text-gris-700">{pub.contenu}</p>
        )}
        {pub.statut !== 'publie' && (
          <div className="mt-esp-5 flex justify-end">
            <Button taille="sm" onClick={onAvancer}>Avancer <ArrowRight size={16} aria-hidden="true" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalePublication({ clients, clientFixe, onFermer, onCreer }) {
  const [form, setForm] = useState({ date: '', canaux: [], titre: '', contenu: '', client: clientFixe && clientFixe !== 'tous' ? clientFixe : (clients[0]?.id ?? '') });
  const [erreur, setErreur] = useState('');
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  const soumettre = (e) => {
    e.preventDefault();
    if (!form.date) {
      setErreur('Indiquez la date de mise en ligne.');
      return;
    }
    if (form.canaux.length === 0) {
      setErreur('Choisissez au moins un canal de diffusion.');
      return;
    }
    if (form.titre.trim().length < 3) {
      setErreur('Indiquez un titre d au moins 3 caractères.');
      return;
    }
    if (!form.client) {
      setErreur('Choisissez le client.');
      return;
    }
    onCreer({
      client: Number(form.client), titre: form.titre.trim(), canal: form.canaux.join(', '),
      date_pub: `${form.date}T09:00:00`, contenu: form.contenu.trim(), statut: 'brouillon',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle publication">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Communication</p>
            <h2 className="!text-[26px]">Nouvelle publication</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="np-date">Date</Label>
              <div className="mt-esp-2"><Input id="np-date" type="date" {...champ('date')} /></div>
            </div>
            <div>
              <Label htmlFor="np-client">Client</Label>
              <select id="np-client" {...champ('client')} className={selectCls}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="np-titre">Titre</Label>
            <div className="mt-esp-2"><Input id="np-titre" autoFocus {...champ('titre')} placeholder="Ex. Offre fibre -40%" /></div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Canaux *</span>
            <div className="mt-esp-2">
              <ChipsCanaux selection={form.canaux} onToggle={(canaux) => { setForm((f) => ({ ...f, canaux })); setErreur(''); }} />
            </div>
          </div>
          <div>
            <Label htmlFor="np-contenu">Contenu</Label>
            <div className="mt-esp-2"><Textarea id="np-contenu" {...champ('contenu')} rows={3} placeholder="Texte du post…" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Planifier</Button>
        </div>
      </form>
    </div>
  );
}

function VueMois({ items, nomsClients, annee, mois, onChangerMois, onOuvrir }) {
  const premier = new Date(annee, mois, 1);
  /* Lundi = 0 … Dimanche = 6 */
  const decalage = (premier.getDay() + 6) % 7;
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const parJour = {};
  items.forEach((p) => {
    if (!p.date_pub) return;
    const { a, m, j } = versMois(p.date_pub);
    if (a === annee && m === mois + 1) {
      parJour[j] = [...(parJour[j] ?? []), p];
    }
  });
  const aujourdhui = new Date();

  const cellules = [];
  for (let i = 0; i < decalage; i++) cellules.push(null);
  for (let j = 1; j <= nbJours; j++) cellules.push(j);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-esp-3">
        <div className="mr-auto flex items-center gap-esp-1">
          <button type="button" onClick={() => onChangerMois(-1)} aria-label="Mois précédent" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="!text-[21px]">{MOIS_NOMS[mois]} {annee}</h2>
          <button type="button" onClick={() => onChangerMois(1)} aria-label="Mois suivant" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={() => onChangerMois('now')} className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 hover:bg-gris-200">
          <CalendarDays size={16} aria-hidden="true" /> Aujourd hui
        </button>
      </div>
      <div className="mt-esp-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gris-300 bg-gris-300">
        {JOURS.map((j) => (
          <p key={j} className="bg-marine-profond px-esp-1 py-esp-2 text-center font-titrage text-[12px] font-bold uppercase tracking-[0.1em] text-blanc">{j}</p>
        ))}
        {cellules.map((j, i) => {
          if (!j) return <div key={`v-${i}`} className="min-h-[84px] bg-gris-100" />;
          const pubs = parJour[j] ?? [];
          const estJour = aujourdhui.getFullYear() === annee && aujourdhui.getMonth() === mois && aujourdhui.getDate() === j;
          return (
            <div key={j} className={`min-h-[84px] bg-gris-0 p-esp-1 ${estJour ? 'outline outline-2 outline-digi' : ''}`}>
              <p className={`font-mono text-[13px] dg-tnum ${estJour ? 'font-bold text-digi' : 'text-gris-600'}`}>{String(j).padStart(2, '0')}</p>
              <div className="mt-esp-1 flex flex-col gap-0.5">
                {pubs.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOuvrir(p)}
                    title={`${p.titre} — ${nomsClients[p.client] ?? ''} (${STATUT_LABEL[p.statut] ?? p.statut})`}
                    className="flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left font-courant text-[12px] font-semibold text-blanc hover:brightness-90"
                    style={{ background: STATUT_COULEUR[p.statut] ?? 'var(--gris-400)' }}
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-pilule bg-white/80" />
                    <span className="truncate">{p.titre}</span>
                  </button>
                ))}
                {pubs.length > 3 && <span className="font-courant text-[12px] text-gris-500">+{pubs.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="dg-legende mt-esp-2 flex flex-wrap gap-esp-3">
        {STATUTS.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-esp-1">
            <span aria-hidden="true" className="h-2 w-2 rounded-pilule" style={{ background: STATUT_COULEUR[s.id] }} /> {s.label}
          </span>
        ))}
      </p>
    </div>
  );
}

export default function Calendrier() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [client, setClient] = useState('tous');
  const [canal, setCanal] = useState('Tous');
  const [statut, setStatut] = useState('tous');
  const [vue, setVue] = useState('mois');
  const [modale, setModale] = useState(false);
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const now = new Date();
  const [cal, setCal] = useState({ a: now.getFullYear(), m: now.getMonth() });

  const charger = async (q = '', cl = 'tous', ca = 'Tous', st = 'tous') => {
    try {
      const [ps, cls] = await Promise.all([
        listerPublications({
          ...(q ? { search: q } : {}),
          ...(cl !== 'tous' ? { client: cl } : {}),
          ...(st !== 'tous' ? { statut: st } : {}),
        }),
        listerClients(),
      ]);
      const liste = cls.results ?? cls;
      setItems(ca === 'Tous' ? ps : ps.filter((p) => (p.canal ?? '').split(',').map((c) => c.trim()).includes(ca)));
      setClients(liste);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement du calendrier impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), client, canal, statut), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, client, canal, statut]);

  const creer = async (pub) => {
    try {
      const p = await creerPublication(pub);
      setModale(false);
      notifier({ type: 'succes', titre: 'Publication planifiée', texte: `${p.titre} — statut Brouillon.` });
      charger(recherche.trim(), client, canal, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const avancer = async (p) => {
    try {
      const maj = await majPublication(p.id, { statut: SUIVANT[p.statut] });
      setDetail(maj);
      notifier({ type: 'info', titre: 'Statut mis à jour', texte: `${p.titre} — ${STATUT_LABEL[maj.statut]}.` });
      charger(recherche.trim(), client, canal, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Transition impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (p) => {
    try {
      await supprimerPublication(p.id);
      setDetail(null);
      notifier({ type: 'succes', titre: 'Publication supprimée', texte: `${p.titre} — brouillon effacé.` });
      charger(recherche.trim(), client, canal, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ROLES_CHEF_COM);

  const changerMois = (d) => {
    if (d === 'now') {
      const n = new Date();
      setCal({ a: n.getFullYear(), m: n.getMonth() });
      return;
    }
    setCal((c) => {
      const dt = new Date(c.a, c.m + d, 1);
      return { a: dt.getFullYear(), m: dt.getMonth() };
    });
  };

  const selectCls = 'h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  if (!peutVoir(session, ROLES_COM)) {
    return (
      <AccesRestreint
        titre="Calendrier réservé à la Communication"
        requis="Seuls les membres du département Communication suivent le calendrier éditorial."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Communication étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Communication</p>
          <h1 className="mt-esp-2">Calendrier éditorial</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            {client === 'tous' ? 'Tous clients confondus.' : `Isolé sur ${nomsClients[client] ?? ''}.`} Cliquez une publication pour voir date et statut.
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-esp-3">
          <span className="flex rounded-md border border-gris-300 bg-gris-100 p-0.5" role="group" aria-label="Mode d affichage">
            {[
              ['mois', 'Mois', CalendarRange],
              ['liste', 'Liste', LayoutList],
            ].map(([k, lb, Icone]) => (
              <button
                key={k}
                type="button"
                aria-pressed={vue === k}
                onClick={() => setVue(k)}
                className={`inline-flex min-h-[36px] items-center gap-esp-1 rounded-sm px-esp-3 font-courant text-[15px] font-semibold ${vue === k ? 'bg-marine-profond text-blanc' : 'text-gris-600 hover:text-gris-900'}`}
              >
                <Icone size={16} aria-hidden="true" /> {lb}
              </button>
            ))}
          </span>
          <Button onClick={() => setModale(true)}>
            <Plus size={20} aria-hidden="true" /> Nouvelle publication
          </Button>
        </span>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher une publication" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Isoler par client" className={selectCls}>
          <option value="tous">Tous</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
        </select>
        <select value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Filtrer par canal" className={selectCls}>
          {['Tous', ...CANAUX].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className={selectCls}>
          <option value="tous">Tous</option>
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="pt-esp-5">
          {chargement ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : vue === 'mois' ? (
            <VueMois items={items} nomsClients={nomsClients} annee={cal.a} mois={cal.m} onChangerMois={changerMois} onOuvrir={setDetail} />
          ) : (
            <div className="flex flex-col gap-esp-1">
              {items.length === 0 && <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600">Rien de planifié avec ces filtres.</p>}
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDetail(p)}
                  className="flex flex-wrap items-center gap-esp-3 rounded-lg px-esp-3 py-esp-3 text-left transition-colors duration-rapide hover:bg-gris-100"
                >
                  <span className="inline-flex items-center gap-esp-2 rounded-md bg-digi-voile px-esp-2 py-esp-1 font-mono text-[13px] text-digi dg-tnum">
                    <CalendarDays size={16} aria-hidden="true" />{dateFr(p.date_pub)}
                  </span>
                  <div className="min-w-48 flex-1">
                    <p className="font-courant text-[15px] font-semibold text-gris-900">{p.titre}</p>
                    <p className="flex items-center gap-esp-1 font-courant text-[15px] text-gris-600">
                      {nomsClients[p.client] ?? ''} · {p.canal}
                    </p>
                  </div>
                  <Badge ton={STATUT_TON[p.statut] ?? 'neutre'}>{STATUT_LABEL[p.statut] ?? p.statut}</Badge>
                  <span className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
                    <Eye size={18} aria-hidden="true" /> Ouvrir
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {modale && <ModalePublication clients={clients} clientFixe={client} onFermer={() => setModale(false)} onCreer={creer} />}
      {detail && <ModaleDetail pub={detail} nomClient={nomsClients[detail.client] ?? ''} onFermer={() => setDetail(null)} onAvancer={() => avancer(detail)} onSupprimer={supprimer} peutSupprimer={peutSupprimer} />}
    </div>
  );
}
