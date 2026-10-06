import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  MessageSquareText,
  SquarePen,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  User,
  LogOut,
} from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside.js';
import Button from '../ui/Button.jsx';
import { cap } from '../../utils/stats.js';
import { LIBELLES_ROLE } from '../../data/session.js';
import { useAuth } from '../../store/auth.js';
import { rechercheGlobale } from '../../api/projets.js';
import {
  conversations, envoyerMessage, filDiscussion, listerNotifs, marquerLus, marquerNotifLue, toutMarquerLu,
} from '../../api/centre.js';
import { listerUsersMini } from '../../api/ressources.js';

/* Titre courant par route — affiché en tête de barre, sans H1 (un seul par page). */
const TITRES = {
  '/': 'Tableau de bord',
  '/clients': 'Clients',
  '/clients/nouveau': 'Nouveau client',
  '/projets': 'Projets',
  '/dev/taches': 'Tâches Kanban',
  '/dev/bugs': 'Bugs',
  '/com/calendrier': 'Calendrier éditorial',
  '/com/campagnes': 'Campagnes',
  '/com/medias': 'Médias',
  '/com/communiques': 'Communiqués',
  '/juridique/contrats': 'Contrats',
  '/juridique/litiges': 'Litiges',
  '/secretariat/courriers': 'Courriers',
  '/rh/employes': 'Employés',
  '/rh/conges': 'Congés',
  '/rh/recrutement': 'Recrutement',
  '/rh/pointage': 'Pointage',
  '/rh/rapports': 'Rapports',
  '/pointage': 'Pointer',
  '/tickets': 'Tickets',
  '/secretariat/reunions': 'Réunions',
  '/factures': 'Factures',
  '/finance/devis': 'Devis',
  '/finance/recus': 'Reçus',
  '/finance/depenses': 'Dépenses',
  '/finance/paie': 'Paie des employés',
  '/parametres': 'Paramètres',
  '/parametres/utilisateurs': 'Utilisateurs',
  '/parametres/utilisateurs/nouveau': 'Nouvel utilisateur',
  '/mails': 'E-mails',
  '/chat': 'Chat interne',
  '/profil': 'Mon profil',
  '/dashboard': 'Tableau de bord',
  '/design-system': 'Design system',
  '/espace': 'Espace client',
};

const initiales = (email) => String(email ?? '').split(/[@.]/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

/* Libellés FR des groupes de recherche globale. */
const LIBELLES_GROUPES = {
  navigation: 'Pages', tache: 'Tâches', bug: 'Bugs', projet: 'Projets',
  client: 'Clients', ticket: 'Tickets', devis: 'Devis', facture: 'Factures',
  courrier: 'Courriers', campagne: 'Campagnes', employe: 'Employés', conge: 'Congés',
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

function BoutonIcone({ Icone, compteur, actif, onClick, libelle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors duration-rapide ${
        actif ? 'bg-gris-200 text-gris-900' : 'text-gris-700 hover:bg-gris-200'
      }`}
    >
      <Icone size={20} aria-hidden="true" />
      {compteur > 0 && (
        <span className="absolute right-esp-1 top-esp-1 flex h-4 min-w-4 items-center justify-center rounded-pilule bg-erreur px-1 font-courant text-[13px] font-bold leading-none text-blanc">
          {compteur}
        </span>
      )}
    </button>
  );
}

export default function Topbar({ ouvrirMenu, basculerSidebar, retractee, query, setQuery, notifier, session }) {
  const logout = useAuth((s) => s.logout);
  const [menu, setMenu] = useState(null);
  const rechercheRef = useRef(null);
  const notifRef = useClickOutside(() => setMenu((m) => (m === 'notif' ? null : m)));
  const chatRef = useClickOutside(() => setMenu((m) => (m === 'chat' ? null : m)));
  const profilRef = useClickOutside(() => setMenu((m) => (m === 'profil' ? null : m)));

  const [notifs, setNotifs] = useState([]);
  const [convos, setConvos] = useState([]);
  const [filAvec, setFilAvec] = useState(null);
  const [fil, setFil] = useState([]);
  const [texte, setTexte] = useState('');
  const [users, setUsers] = useState([]);
  const [nouveauAvec, setNouveauAvec] = useState('');
  const [resultats, setResultats] = useState([]);
  const [rechercheFaite, setRechercheFaite] = useState(false);
  const minuteurRecherche = useRef(null);
  const zoneRechercheRef = useClickOutside(() => { setResultats([]); setRechercheFaite(false); });
  const nonLuesN = notifs.filter((n) => !n.lue).length;
  const nonLusC = convos.reduce((s, c) => s + (c.non_lus ?? 0), 0);

  const chargerCentre = async () => {
    try {
      const [ns, cs] = await Promise.all([listerNotifs(), conversations()]);
      setNotifs(ns.slice(0, 10));
      setConvos(cs);
    } catch {
      /* hors-ligne : badges conservés */
    }
  };

  useEffect(() => {
    chargerCentre();
    const t = setInterval(chargerCentre, 30000);
    return () => clearInterval(t);
  }, []);

  const ouvrirFil = async (userId) => {
    setFilAvec(userId);
    setTexte('');
    try {
      setFil(await filDiscussion(userId));
      await marquerLus(userId);
      chargerCentre();
    } catch {
      /* lecture seule */
    }
  };

  const envoyer = async (e) => {
    e.preventDefault();
    const dest = filAvec ?? Number(nouveauAvec);
    if (!dest || texte.trim().length < 1) return;
    try {
      const m = await envoyerMessage(dest, texte.trim());
      setTexte('');
      setNouveauAvec('');
      setFilAvec(dest);
      setFil((prev) => [...prev, m]);
      chargerCentre();
    } catch {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: 'Réessayez dans un instant.' });
    }
  };

  const toutLire = async () => {
    await toutMarquerLu(notifs);
    setNotifs((prev) => prev.map((n) => ({ ...n, lue: true })));
  };

  const lireNotif = async (n) => {
    if (!n.lue) {
      await marquerNotifLue(n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
    }
  };

  const basculerMenu = (nom, chargeur) => setMenu((m) => {
    const suivant = m === nom ? null : nom;
    if (suivant) chargeur?.();
    return suivant;
  });

  const localisation = useLocation();
  const naviguer = useNavigate();
  const p = localisation.pathname;
  const titre = TITRES[p] ?? (p === '/dashboard' || p.startsWith('/dashboard/') ? 'Tableau de bord' : p === '/espace' || p.startsWith('/espace/') ? 'Espace client' : p.startsWith('/clients/') ? 'Fiche client' : p.startsWith('/projets/') ? 'Projet' : p.startsWith('/rh/employes/') ? 'Contrat employé' : p.startsWith('/finance/paie/') ? 'Fiche de paye' : p.startsWith('/devis/') ? 'Devis' : p.startsWith('/factures/') ? 'Facture' : p.startsWith('/recus/') ? 'Reçu' : 'HUB DIGI');
  const dateStr = cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

  useEffect(() => {
    const clavier = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        rechercheRef.current?.focus();
      }
      if (e.key === 'Escape') setMenu(null);
    };
    // Hors-ligne -> en ligne : rattraper aussitôt les notifs manquées
    // (cloche + chat), même après une longue coupure réseau.
    const aLaReconnexion = () => {
      chargerCentre();
      notifier({ type: 'succes', titre: 'Connexion rétablie', texte: 'Notifications mises à jour.' });
    };
    window.addEventListener('keydown', clavier);
    window.addEventListener('online', aLaReconnexion);
    return () => {
      window.removeEventListener('keydown', clavier);
      window.removeEventListener('online', aLaReconnexion);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-gris-300 bg-gris-0/90 backdrop-blur">
      <div className="flex h-16 items-center gap-esp-3 px-esp-5">
        <button
          type="button"
          onClick={ouvrirMenu}
          aria-label="Ouvrir le menu"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-700 hover:bg-gris-200 lg:hidden"
        >
          <Menu size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={basculerSidebar}
          aria-label={retractee ? 'Déplier la sidebar' : 'Rétracter la sidebar'}
          aria-pressed={retractee}
          className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-700 hover:bg-gris-200 lg:flex"
        >
          {retractee ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>

        <div className="hidden min-w-0 sm:block">
          <p className="truncate font-titrage text-[18px] font-bold leading-tight text-gris-900">{titre}</p>
          <p className="truncate font-courant text-[13px] text-gris-600">{dateStr} · Bonjour, {session?.nom ?? 'Super Admin'}</p>
        </div>

        <div className="relative ml-esp-5 hidden max-w-96 flex-1 md:block" ref={zoneRechercheRef}>
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input
            ref={rechercheRef}
            type="search"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              setRechercheFaite(false);
              if (minuteurRecherche.current) clearTimeout(minuteurRecherche.current);
              if (v.trim().length < 2 || session?.role === 'client') { setResultats([]); return; }
              minuteurRecherche.current = setTimeout(async () => {
                try {
                  const r = await rechercheGlobale(v.trim());
                  setResultats(r.groupes ?? []);
                } catch {
                  setResultats([]);
                } finally {
                  setRechercheFaite(true);
                }
              }, 300);
            }}
            placeholder="Rechercher tâche, bug, projet, client… (Ctrl+K)"
            aria-label="Recherche globale"
            aria-expanded={resultats.length > 0}
            className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-100 pl-11 pr-16 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
          />
          <kbd aria-hidden="true" className="absolute right-esp-3 top-1/2 -translate-y-1/2 rounded-sm border border-gris-300 bg-gris-0 px-esp-2 py-0.5 font-mono text-[13px] text-gris-600">
            ⌘K
          </kbd>
          {(resultats.length > 0 || rechercheFaite) && (
            <div role="listbox" aria-label="Résultats de recherche" className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-96 overflow-y-auto rounded-lg border border-gris-300 bg-gris-0 p-esp-2 shadow-ombre-4">
              {resultats.length === 0 && (
                <p className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-600">Aucun résultat pour « {query.trim()} ».</p>
              )}
              {resultats.map((g) => (
                <div key={g.type}>
                  <p className="px-esp-3 pb-esp-1 pt-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{LIBELLES_GROUPES[g.type] ?? g.type}</p>
                  {g.resultats.map((r) => (
                    <button
                      key={`${g.type}-${r.id}`}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => { setResultats([]); setRechercheFaite(false); naviguer(r.url); }}
                      className="flex w-full items-center gap-esp-2 rounded-md p-esp-3 text-left hover:bg-gris-100"
                    >
                      <span className="min-w-0 flex-1 truncate font-courant text-[15px] text-gris-900">{r.titre}</span>
                      {r.reference && <span className="shrink-0 font-mono text-[13px] text-gris-600">{r.reference}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-esp-1">
          <button
            type="button"
            onClick={() => naviguer('/mails')}
            aria-label="Écrire un e-mail"
            title="Nouveau mail"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-700 transition-colors duration-rapide hover:bg-gris-200"
          >
            <SquarePen size={20} aria-hidden="true" />
          </button>
          <div className="relative" ref={chatRef}>
            <BoutonIcone Icone={MessageSquareText} compteur={nonLusC} actif={menu === 'chat'} libelle="Messages" onClick={() => basculerMenu('chat', async () => { chargerCentre(); try { setUsers(await listerUsersMini()); } catch { /* liste optionnelle */ } })} />
            {menu === 'chat' && (
              <div className="dg-pop fixed inset-x-3 top-[68px] z-50 rounded-lg border border-gris-300 bg-gris-0 p-esp-2 shadow-ombre-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[360px]">
                <p className="px-esp-3 pb-esp-1 pt-esp-2 font-titrage text-[12px] font-bold uppercase leading-[1.2] tracking-[0.16em] text-gris-600">Chat interne</p>
                {!filAvec ? (
                  <>
                    {convos.length === 0 && (
                      <p className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-600">Aucune conversation. Écrivez au premier ci-dessous.</p>
                    )}
                    {convos.map((c) => (
                      <button
                        key={c.user.id}
                        type="button"
                        onClick={() => ouvrirFil(c.user.id)}
                        className="flex w-full items-start gap-esp-3 rounded-lg p-esp-3 text-left transition-colors duration-rapide hover:bg-gris-100"
                      >
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pilule bg-digi-voile font-courant text-[13px] font-bold text-digi">
                          {initiales(c.user.email)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-esp-2">
                            <span className="truncate font-courant text-[15px] font-semibold text-gris-900">{c.user.email}</span>
                            <span className="shrink-0 font-courant text-[13px] text-gris-600">{ilYa(c.dernier.cree_le)}</span>
                          </span>
                          <span className="mt-0.5 block truncate font-courant text-[15px] text-gris-600">{c.dernier.texte}</span>
                        </span>
                        {c.non_lus > 0 && <span className="rounded-pilule bg-erreur px-esp-2 py-0.5 font-courant text-[13px] font-bold text-blanc dg-tnum">{c.non_lus}</span>}
                      </button>
                    ))}
                    <div className="border-t border-gris-200 p-esp-2">
                      <form onSubmit={envoyer} className="flex gap-esp-2">
                        <select value={nouveauAvec} onChange={(e) => setNouveauAvec(e.target.value)} aria-label="Nouveau destinataire" className="h-11 min-h-[44px] min-w-0 flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]">
                          <option value="">Écrire à…</option>
                          {users.filter((u) => u.email !== session?.email).map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                        </select>
                        <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Message…" aria-label="Message" className="h-11 min-h-[44px] min-w-0 flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]" />
                        <Button taille="sm" type="submit"><Send size={16} aria-hidden="true" /></Button>
                      </form>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-esp-2 px-esp-3 pb-esp-1 pt-esp-2">
                      <button type="button" onClick={() => setFilAvec(null)} className="font-courant text-[14px] font-semibold text-digi-texte">‹ Retour</button>
                      <p className="truncate font-courant text-[14px] font-semibold text-gris-900">{convos.find((c) => c.user.id === filAvec)?.user.email ?? ''}</p>
                    </div>
                    <div className="flex max-h-64 flex-col gap-esp-2 overflow-y-auto p-esp-2">
                      {fil.map((m) => (
                        <div key={m.id} className={`max-w-[85%] rounded-lg p-esp-3 font-courant text-[14px] ${m.destinataire === session?.id ? 'self-end bg-digi text-blanc' : 'self-start bg-gris-100 text-gris-900'}`}>
                          <p>{m.texte}</p>
                          <p className={`mt-esp-1 text-[12px] ${m.destinataire === session?.id ? 'text-digi-brume' : 'text-gris-500'}`}>{ilYa(m.cree_le)}</p>
                        </div>
                      ))}
                      {fil.length === 0 && <p className="px-esp-3 py-esp-2 font-courant text-[14px] text-gris-600">Démarrez la conversation ci-dessous.</p>}
                    </div>
                    <form onSubmit={envoyer} className="flex gap-esp-2 border-t border-gris-200 p-esp-2">
                      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écrire…" aria-label="Écrire un message" className="h-11 min-h-[44px] min-w-0 flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]" />
                      <Button taille="sm" type="submit"><Send size={16} aria-hidden="true" /></Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={notifRef}>
            <BoutonIcone Icone={Bell} compteur={nonLuesN} actif={menu === 'notif'} libelle="Notifications" onClick={() => basculerMenu('notif', chargerCentre)} />
            {menu === 'notif' && (
              <div className="dg-pop fixed inset-x-3 top-[68px] z-50 rounded-lg border border-gris-300 bg-gris-0 p-esp-2 shadow-ombre-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[340px]">
                <div className="flex items-center justify-between px-esp-3 pb-esp-1 pt-esp-2">
                  <p className="font-titrage text-[12px] font-bold uppercase leading-[1.2] tracking-[0.16em] text-gris-600">Notifications</p>
                  {nonLuesN > 0 && (
                    <button
                      type="button"
                      onClick={toutLire}
                      className="font-courant text-[15px] font-semibold text-digi-texte"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                {notifs.length === 0 && (
                  <p className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-600">Rien à signaler — tout est à jour.</p>
                )}
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => lireNotif(n)}
                    className={`flex w-full items-start gap-esp-3 rounded-lg p-esp-3 text-left transition-colors duration-rapide ${!n.lue ? 'bg-gris-100 hover:bg-gris-200' : 'hover:bg-gris-100'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-esp-2">
                        <span className="truncate font-courant text-[15px] font-semibold text-gris-900">{n.titre}</span>
                        <span className="shrink-0 font-courant text-[13px] text-gris-600">{ilYa(n.cree_le)}</span>
                      </span>
                      <span className="mt-0.5 block font-courant text-[15px] text-gris-600">{n.texte}</span>
                    </span>
                    {!n.lue && <span aria-hidden="true" className="mt-esp-2 h-2 w-2 shrink-0 rounded-pilule bg-digi" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={profilRef}>
            <button
              type="button"
              onClick={() => setMenu((m) => (m === 'profil' ? null : 'profil'))}
              aria-label={`Profil ${session?.nom ?? ''}, ouvrir le menu compte`}
              className="flex min-h-[44px] items-center gap-esp-2 rounded-md px-esp-2 transition-colors duration-rapide hover:bg-gris-200"
            >
              <span className="relative">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-pilule font-titrage text-[15px] font-extrabold text-blanc" style={{ background: 'var(--degrade-bleu)' }}>
                  {session?.initiales ?? 'SA'}
                </span>
                <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-pilule bg-succes ring-2 ring-gris-0" />
              </span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block font-courant text-[15px] font-semibold text-gris-900">{session?.nom ?? 'Super Admin'}</span>
                <span className="block font-courant text-[13px] text-gris-600">{LIBELLES_ROLE[session?.role] ?? ''}{session?.dept ? ` · ${session.dept}` : ''}</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" className="hidden text-gris-500 xl:block" />
            </button>
            {menu === 'profil' && (
              <div className="dg-pop fixed inset-x-3 top-[68px] z-50 rounded-lg border border-gris-300 bg-gris-0 p-esp-2 shadow-ombre-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-72">
                <div className="mb-esp-1 flex items-center gap-esp-3 border-b border-gris-300 p-esp-3">
                  <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-pilule font-titrage text-[15px] font-extrabold text-blanc" style={{ background: 'var(--degrade-bleu)' }}>
                    {session?.initiales ?? 'SA'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{session?.nom}</p>
                    <p className="truncate font-courant text-[13px] text-gris-600">{session?.email}</p>
                  </div>
                </div>
                <p className="px-esp-3 pb-esp-1 pt-esp-2 font-titrage text-[12px] font-bold uppercase leading-[1.2] tracking-[0.16em] text-gris-600">
                  {LIBELLES_ROLE[session?.role] ?? ''}{session?.dept ? ` · ${session.dept}` : ''}
                </p>
                <div className="my-esp-1 border-t border-gris-300" />
                <button
                  type="button"
                  onClick={() => { setMenu(null); naviguer('/profil'); }}
                  className="flex w-full items-center gap-esp-3 rounded-md px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 transition-colors duration-rapide hover:bg-gris-100"
                >
                  <User size={16} aria-hidden="true" className="text-gris-500" /> Mon profil
                </button>
                <div className="my-esp-1 border-t border-gris-300" />
                <button
                  type="button"
                  onClick={() => { setMenu(null); logout(); naviguer('/login'); }}
                  className="flex w-full items-center gap-esp-3 rounded-md px-esp-3 py-esp-3 font-courant text-[15px] text-erreur transition-colors duration-rapide hover:bg-erreur-fond"
                >
                  <LogOut size={16} aria-hidden="true" /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
