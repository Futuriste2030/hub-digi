import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Megaphone,
  Target,
  CalendarDays,
  Images,
  Newspaper,
  Code2,
  FolderKanban,
  ClipboardList,
  Bug,
  QrCode,
  Wallet,
  FileText,
  Receipt,
  ReceiptText,
  Coins,
  Truck,
  HandCoins,
  GraduationCap,
  HeartHandshake,
  UserCog,
  CalendarOff,
  UserSearch,
  Scale,
  ScrollText,
  Gavel,
  Inbox,
  Ticket,
  Mails,
  FileCheck,
  MessageSquareText,
  CalendarClock,
  SlidersHorizontal,
  Palette,
  ChevronDown,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import Logo from '../Logo.jsx';
import { useAuth } from '../../store/auth.js';
import { compterTicketsOuverts } from '../../api/centre.js';
import { INTERNES, CHEFS, ROLES_COM, ROLES_DEV, ROLES_FINANCE, ROLES_RH, ROLES_JURIDIQUE, ROLES_SECRETARIAT, urlTableauDeBord } from '../../lib/acces.js';

/* Menu issu de SPECIFICATIONS.md §3 (matrice onglets × rôles) : chaque lien
   déclare les rôles autorisés. Source unique : src/lib/acces.js.
   Backend : JWT {role, department_id} + guard RequireRole sur les routes. */

const SECTIONS = [
  {
    libelle: 'Pilotage',
    Icone: LayoutDashboard,
    liens: [{ to: '/', libelle: 'Tableau de bord', Icone: LayoutDashboard, fin: true, roles: INTERNES },
      { to: '/pointage', libelle: 'Pointer', Icone: QrCode, roles: INTERNES }],
  },
  {
    libelle: 'Clients',
    Icone: Users,
    liens: [
      { to: '/clients', libelle: 'Liste clients', Icone: Users, roles: INTERNES },
      { to: '/clients/nouveau', libelle: 'Nouveau client', Icone: UserPlus, roles: INTERNES },
    ],
  },
  {
    libelle: 'Communication',
    Icone: Megaphone,
    liens: [
      { to: '/com/calendrier', libelle: 'Calendrier éditorial', Icone: CalendarDays, roles: ROLES_COM },
      { to: '/com/campagnes', libelle: 'Campagnes', Icone: Target, roles: ROLES_COM },
      { to: '/com/medias', libelle: 'Médias', Icone: Images, roles: ROLES_COM },
      { to: '/com/communiques', libelle: 'Communiqués', Icone: Newspaper, roles: ROLES_COM },
    ],
  },
  {
    libelle: 'Développement',
    Icone: Code2,
    liens: [
      { to: '/projets', libelle: 'Projets', Icone: FolderKanban, roles: ROLES_DEV },
      { to: '/dev/taches', libelle: 'Tâches Kanban', Icone: ClipboardList, roles: ROLES_DEV },
      { to: '/dev/bugs', libelle: 'Bugs', Icone: Bug, roles: ROLES_DEV },
    ],
  },
  {
    libelle: 'Finance',
    Icone: Wallet,
    liens: [
      { to: '/finance/devis', libelle: 'Devis', Icone: FileText, roles: ROLES_FINANCE },
      { to: '/factures', libelle: 'Factures', Icone: Receipt, roles: ROLES_FINANCE },
      { to: '/finance/recus', libelle: 'Reçus', Icone: ReceiptText, roles: ROLES_FINANCE },
      { to: '/finance/depenses', libelle: 'Dépenses', Icone: Coins, roles: ROLES_FINANCE },
      { to: '/finance/fournisseurs', libelle: 'Fournisseurs', Icone: Truck, roles: ROLES_FINANCE },
      { to: '/finance/formations', libelle: 'Formations', Icone: GraduationCap, roles: ROLES_FINANCE },
      { to: '/finance/paie', libelle: 'Paie employés', Icone: HandCoins, roles: ROLES_FINANCE },
    ],
  },
  {
    libelle: 'RH',
    Icone: HeartHandshake,
    liens: [
      { to: '/rh/employes', libelle: 'Employés', Icone: UserCog, roles: ROLES_RH },
      { to: '/rh/pointage', libelle: 'Pointage', Icone: QrCode, roles: ROLES_RH },
      { to: '/rh/rapports', libelle: 'Rapports', Icone: FileText, roles: ROLES_RH },
      { to: '/rh/conges', libelle: 'Congés', Icone: CalendarOff, roles: INTERNES },
      { to: '/rh/recrutement', libelle: 'Recrutement', Icone: UserSearch, roles: ROLES_RH },
    ],
  },
  {
    libelle: 'Juridique',
    Icone: Scale,
    liens: [
      { to: '/juridique/contrats', libelle: 'Contrats', Icone: ScrollText, roles: ROLES_JURIDIQUE },
      { to: '/juridique/litiges', libelle: 'Litiges', Icone: Gavel, roles: ROLES_JURIDIQUE },
    ],
  },
  {
    libelle: 'Secrétariat',
    Icone: Inbox,
    liens: [
      { to: '/tickets', libelle: 'Tickets', Icone: Ticket, roles: [...CHEFS, 'membre_com', 'membre_dev', 'membre_finance', 'membre_rh', 'membre_juridique'] },
      { to: '/secretariat/courriers', libelle: 'Courriers', Icone: Mails, roles: ROLES_SECRETARIAT },
      { to: '/secretariat/documents', libelle: 'Offres & lettres', Icone: FileText, roles: ROLES_SECRETARIAT },
      { to: '/secretariat/decharges', libelle: 'Décharges', Icone: FileCheck, roles: ROLES_SECRETARIAT },
      { to: '/secretariat/reunions', libelle: 'Réunions', Icone: CalendarClock, roles: ROLES_SECRETARIAT },
    ],
  },
  {
    libelle: 'Échanges',
    Icone: MessageSquareText,
    liens: [
      { to: '/chat', libelle: 'Chat interne', Icone: MessageSquareText, roles: INTERNES },
      { to: '/mails', libelle: 'E-mails', Icone: Mails, roles: INTERNES },
    ],
  },
  {
    libelle: 'Système',
    Icone: SlidersHorizontal,
    liens: [
      { to: '/design-system', libelle: 'Design system', Icone: Palette, roles: INTERNES },
    ],
  },
];

const estActif = (pathname, l) => (l.fin ? pathname === l.to : pathname.startsWith(l.to));

function SousLien({ to, libelle, fin = false, pastille, fermer }) {
  return (
    <NavLink
      to={to}
      end={fin}
      onClick={fermer}
      className={({ isActive }) =>
        `flex min-h-[40px] items-center gap-esp-2 rounded-md py-esp-1 pl-esp-4 pr-esp-3 font-courant text-[14px] transition-colors duration-rapide ${
          isActive ? 'font-semibold text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-pilule ${isActive ? 'bg-digi-signal' : 'bg-marine-clair'}`}
          />
          <span className="min-w-0 flex-1 truncate">{libelle}</span>
          {pastille && (
            <span className="rounded-pilule bg-erreur px-esp-2 py-0.5 font-courant text-[13px] font-bold leading-none text-blanc">
              {pastille}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* Infobulle : visible au survol ET au focus clavier. */
function Infobulle({ texte }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-esp-3 hidden whitespace-nowrap rounded-md bg-marine-profond px-esp-3 py-esp-2 font-courant text-[14px] text-blanc opacity-0 shadow-ombre-4 transition-opacity duration-rapide group-hover:block group-hover:opacity-100 group-focus:block group-focus:opacity-100 group-focus-visible:block group-focus-visible:opacity-100">
      {texte}
    </span>
  );
}

function BoutonIcone({ libelle, Icone, actif, onClick, pastille }) {
  return (
    <button
      type="button"
      aria-label={libelle}
      onClick={onClick}
      className={`group relative flex min-h-[44px] w-full items-center justify-center rounded-md transition-colors duration-rapide ${
        actif ? 'bg-digi-voile text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
      }`}
    >
      <Icone size={20} aria-hidden="true" className={actif ? 'text-digi-signal' : ''} />
      {pastille && (
        <span aria-hidden="true" className="absolute right-esp-1 top-esp-1 h-2 w-2 rounded-pilule bg-erreur" />
      )}
      <Infobulle texte={libelle} />
    </button>
  );
}

function SectionReduite({ section, flyoutOuvert, basculerFlyout, fermerFermer, fermer }) {
  const localisation = useLocation();
  const naviguer = useNavigate();
  const actif = section.liens.some((l) => estActif(localisation.pathname, l));
  const { Icone } = section;

  return (
    <li>
      <div className="flex items-center gap-esp-1">
        <button
          type="button"
          aria-label={section.libelle}
          onClick={() => {
            naviguer(section.liens[0].to);
            fermerFermer();
            fermer();
          }}
          className={`group relative flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-md transition-colors duration-rapide ${
            actif ? 'bg-digi-voile text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
          }`}
        >
          <Icone size={20} aria-hidden="true" className={actif ? 'text-digi-signal' : ''} />
          <Infobulle texte={section.libelle} />
        </button>
        <button
          type="button"
          aria-expanded={flyoutOuvert}
          aria-label={`Sous-rubriques ${section.libelle}`}
          onClick={basculerFlyout}
          className={`flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-rapide ${
            flyoutOuvert ? 'bg-digi-voile text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
          }`}
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform duration-standard ${flyoutOuvert ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </li>
  );
}

function Section({ section, ouverte, basculer, fermer }) {
  const localisation = useLocation();
  const actif = section.liens.some((l) => estActif(localisation.pathname, l));
  const { Icone } = section;

  return (
    <li>
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouverte}
        className={`flex min-h-[40px] w-full items-center gap-esp-2 rounded-md px-esp-3 font-titrage text-[13px] font-bold uppercase leading-none tracking-[0.06em] transition-colors duration-rapide ${
          actif ? 'bg-digi-voile text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
        }`}
      >
        <Icone size={18} aria-hidden="true" className={`shrink-0 ${actif ? 'text-digi-signal' : ''}`} />
        <span className="min-w-0 flex-1 truncate text-left">{section.libelle}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-standard ${ouverte ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`grid transition-all duration-standard ease-[cubic-bezier(0.2,0.6,0.2,1)] ${ouverte ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <ul className="min-h-0 overflow-hidden">
          {section.liens.map((lien) => (
            <li key={lien.to} className="ml-esp-4 border-l border-marine-clair pl-esp-2">
              <SousLien {...lien} fermer={fermer} />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Sidebar({ mobileOuvert, fermer, retractee, session }) {
  const role = session?.role ?? 'super_admin';
  const [ouverts, setOuverts] = useState(0);
  const localisation = useLocation();
  const naviguer = useNavigate();

  /* Pastille tickets live (ouverts visibles par l'utilisateur), rafraîchie à chaque navigation. */
  useEffect(() => {
    let actif = true;
    compterTicketsOuverts().then(
      (n) => { if (actif) setOuverts(n); },
      () => {},
    );
    return () => { actif = false; };
  }, [localisation.pathname]);

  /* Lien tableau de bord dynamique : /dashboard (super admin) ou /dashboard/:departement. */
  const sections = SECTIONS.map((s) => ({
    ...s,
    liens: s.liens.filter((l) => l.roles.includes(role)).map((l) => {
      if (l.to === '/') return { ...l, to: urlTableauDeBord(session), fin: false };
      if (l.to === '/tickets') {
        if (ouverts <= 0) {
          const reste = { ...l };
          delete reste.pastille;
          return reste;
        }
        return { ...l, pastille: String(ouverts) };
      }
      return l;
    }),
  })).filter((s) => s.liens.length > 0);
  const [ouvertes, setOuvertes] = useState(() =>
    retractee
      ? []
      : sections.filter((s) => s.liens.some((l) => estActif(localisation.pathname, l))).map((s) => s.libelle),
  );
  const [flyout, setFlyout] = useState(null);

  /* Mobile : tiroir toujours déplié avec libellés (les icônes seules + infobulles
     au survol sont inutilisables au tactile). Le mode compact icônes ne vaut
     que pour le tiroir fixe desktop. */
  const compact = retractee && !mobileOuvert;

  /* À l'ouverture du tiroir mobile, déplier la rubrique active pour un accès direct. */
  useEffect(() => {
    if (mobileOuvert) {
      setOuvertes(sections.filter((s) => s.liens.some((l) => estActif(localisation.pathname, l))).map((s) => s.libelle));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOuvert]);

  useEffect(() => {
    if (!flyout) return;
    const touche = (e) => {
      if (e.key === 'Escape') setFlyout(null);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [flyout]);

  const basculer = (libelle) =>
    setOuvertes((prev) => (prev.includes(libelle) ? prev.filter((l) => l !== libelle) : [...prev, libelle]));

  const basculerFlyout = (section, ancre) =>
    setFlyout((f) =>
      f && f.libelle === section.libelle ? null : { libelle: section.libelle, haut: ancre.top, droite: ancre.right },
    );

  const aller = (to) => {
    setFlyout(null);
    fermer();
    naviguer(to);
  };

  const deconnexion = () => {
    setFlyout(null);
    fermer();
    useAuth.getState().logout();
    naviguer('/login');
  };

  const sectionFlyout = flyout ? sections.find((s) => s.libelle === flyout.libelle) : null;
  const hauteurFlyout = sectionFlyout ? sectionFlyout.liens.length * 48 + 16 : 0;
  const hautFlyout =
    flyout && typeof window !== 'undefined'
      ? Math.max(8, Math.min(flyout.haut, window.innerHeight - hauteurFlyout - 8))
      : 0;

  const surParametres = localisation.pathname.startsWith('/parametres');
  const peutParametres = role === 'super_admin';

  return (
    <>
      {mobileOuvert && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={fermer}
          className="fixed inset-0 z-40 bg-marine-profond/60 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-marine-profond transition-all duration-standard ease-[cubic-bezier(0.2,0.6,0.2,1)] lg:sticky lg:top-0 lg:h-screen ${
          mobileOuvert ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${compact ? 'w-28' : 'w-60'}`}
      >
        <div className={`flex items-center ${compact ? 'justify-center' : 'justify-between'} px-esp-4 pb-esp-3 pt-esp-4`}>
          <NavLink to="/" aria-label="HUB DIGI - Accueil" className="flex min-w-0 items-center gap-esp-2">
            <Logo hauteur={40} />
            {!compact && (
              <span className="whitespace-nowrap leading-tight">
                <span className="block font-titrage text-[14px] font-extrabold tracking-[0.06em] text-blanc">
                  HUB DIGI
                </span>
                <span className="block font-courant text-[13px] text-digi-brume">Digi Com et Techno.</span>
              </span>
            )}
          </NavLink>
          {!compact && (
            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer le menu"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-brume hover:text-blanc lg:hidden"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav
          aria-label="Navigation principale"
          className={`dg-scroll-fin min-h-0 flex-1 overflow-y-auto pb-esp-3 ${compact ? 'px-esp-2' : 'px-esp-3'}`}
        >
          <ul className="flex flex-col gap-esp-1">
            {sections.map((section) =>
              compact ? (
                <SectionReduite
                  key={section.libelle}
                  section={section}
                  flyoutOuvert={flyout?.libelle === section.libelle}
                  basculerFlyout={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    basculerFlyout(section, r);
                  }}
                  fermerFermer={() => setFlyout(null)}
                  fermer={fermer}
                />
              ) : (
                <Section
                  key={section.libelle}
                  section={section}
                  ouverte={ouvertes.includes(section.libelle)}
                  basculer={() => basculer(section.libelle)}
                  fermer={fermer}
                />
              ),
            )}
          </ul>
        </nav>

        <div className={`border-t border-marine-clair ${compact ? 'p-esp-2' : 'p-esp-3'}`}>
          {compact ? (
            <div className="flex flex-col gap-esp-1">
              {peutParametres && (
                <BoutonIcone
                  libelle="Paramètres"
                  Icone={Settings}
                  actif={surParametres}
                  onClick={() => aller('/parametres')}
                />
              )}
              <BoutonIcone libelle="Déconnexion" Icone={LogOut} actif={false} onClick={deconnexion} />
            </div>
          ) : (
            <div className="flex flex-col gap-esp-1">
              {peutParametres && (
                <NavLink
                  to="/parametres"
                  className={({ isActive }) =>
                    `flex min-h-[40px] items-center gap-esp-2 rounded-md px-esp-3 font-courant text-[14px] font-semibold transition-colors duration-rapide ${
                      isActive ? 'bg-digi-voile text-blanc' : 'text-digi-brume hover:bg-white/5 hover:text-blanc'
                    }`
                  }
                >
                  <Settings size={18} aria-hidden="true" className="shrink-0" /> Paramètres
                </NavLink>
              )}
              <button
                type="button"
                onClick={deconnexion}
                className="flex min-h-[40px] items-center gap-esp-2 rounded-md px-esp-3 font-courant text-[14px] font-semibold text-digi-brume transition-colors duration-rapide hover:bg-white/5 hover:text-blanc"
              >
                <LogOut size={18} aria-hidden="true" className="shrink-0" /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </aside>

      {flyout && sectionFlyout && (
        <>
          <button
            type="button"
            aria-label="Fermer le sous-menu"
            onClick={() => setFlyout(null)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            role="menu"
            aria-label={sectionFlyout.libelle}
            className="dg-pop fixed z-50 w-16 rounded-lg border border-marine-clair bg-marine p-esp-2 shadow-ombre-4"
            style={{ top: hautFlyout, left: flyout.droite + 8 }}
          >
            <ul className="flex flex-col gap-esp-1">
              {sectionFlyout.liens.map((l) => (
                <li key={l.to}>
                  <BoutonIcone
                    libelle={l.libelle}
                    Icone={l.Icone}
                    actif={estActif(localisation.pathname, l)}
                    onClick={() => aller(l.to)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
