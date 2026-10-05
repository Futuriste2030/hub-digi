import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import RequireRole from './components/RequireRole.jsx';
import RequireSuperAdmin from './components/RequireSuperAdmin.jsx';
import {
  INTERNES, CHEFS,
  ROLES_COM, ROLES_DEV, ROLES_FINANCE, ROLES_RH, ROLES_JURIDIQUE, ROLES_SECRETARIAT,
} from './lib/acces.js';

/* Code-splitting : chaque page = chunk séparé (réduit le bundle initial ~872 Ko).
   Login + EspaceClient + Dashboard chargés en priorité, le reste en lazy. */
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import EspaceClient from './pages/EspaceClient.jsx';
import Accueil from './pages/Accueil.jsx';
import ChargementPage from './components/ChargementPage.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const DesignSystem = lazy(() => import('./pages/DesignSystem.jsx'));
const Mails = lazy(() => import('./pages/Mails.jsx'));
const Clients = lazy(() => import('./pages/Clients.jsx'));
const FicheClient = lazy(() => import('./pages/FicheClient.jsx'));
const NouveauClient = lazy(() => import('./pages/NouveauClient.jsx'));
const Projets = lazy(() => import('./pages/Projets.jsx'));
const ProjetDetail = lazy(() => import('./pages/ProjetDetail.jsx'));
const Taches = lazy(() => import('./pages/Taches.jsx'));
const Bugs = lazy(() => import('./pages/Bugs.jsx'));
const Calendrier = lazy(() => import('./pages/Calendrier.jsx'));
const Campagnes = lazy(() => import('./pages/Campagnes.jsx'));
const Medias = lazy(() => import('./pages/Medias.jsx'));
const Factures = lazy(() => import('./pages/Factures.jsx'));
const FactureDetail = lazy(() => import('./pages/FactureDetail.jsx'));
const Recus = lazy(() => import('./pages/Recus.jsx'));
const RecuDetail = lazy(() => import('./pages/RecuDetail.jsx'));
const Devis = lazy(() => import('./pages/Devis.jsx'));
const Depenses = lazy(() => import('./pages/Depenses.jsx'));
const Fournisseurs = lazy(() => import('./pages/Fournisseurs.jsx'));
const FournisseurDetail = lazy(() => import('./pages/FournisseurDetail.jsx'));
const Parametres = lazy(() => import('./pages/Parametres.jsx'));
const DevisDetail = lazy(() => import('./pages/DevisDetail.jsx'));
const Paie = lazy(() => import('./pages/Paie.jsx'));
const FichePaie = lazy(() => import('./pages/FichePaie.jsx'));
const EspaceRedaction = lazy(() => import('./pages/EspaceRedaction.jsx'));
const Courriers = lazy(() => import('./pages/Courriers.jsx'));
const Decharges = lazy(() => import('./pages/Decharges.jsx'));
const Reunions = lazy(() => import('./pages/Reunions.jsx'));
const Employes = lazy(() => import('./pages/Employes.jsx'));
const Conges = lazy(() => import('./pages/Conges.jsx'));
const Recrutement = lazy(() => import('./pages/Recrutement.jsx'));
const Pointage = lazy(() => import('./pages/Pointage.jsx'));
const Pointages = lazy(() => import('./pages/Pointages.jsx'));
const Rapports = lazy(() => import('./pages/Rapports.jsx'));
const Tickets = lazy(() => import('./pages/Tickets.jsx'));
const Profil = lazy(() => import('./pages/Profil.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const ChatGroupes = lazy(() => import('./pages/ChatGroupes.jsx'));
const Utilisateurs = lazy(() => import('./pages/Utilisateurs.jsx'));
const UtilisateurNouveau = lazy(() => import('./pages/UtilisateurNouveau.jsx'));
import { NonTrouve, FEATURE_ROUTES, SectionPage } from './pages/Pages.jsx';

const ROLES_TICKETS = [...CHEFS, 'membre_com', 'membre_dev', 'membre_finance', 'membre_rh', 'membre_juridique'];

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<ChargementPage compact />}>
        <Routes>
        <Route path="login" element={<Login />} />
        <Route path="reset-password/:uid/:token" element={<ResetPassword />} />
        {/* Portail client : URL personnalisée /espace/:slug/:code (code unique 4 chiffres).
            /espace seul = son propre portail ; super_admin prévisualise via slug + code. */}
        <Route path="espace" element={<EspaceClient />} />
        <Route path="espace/:slug" element={<EspaceClient />} />
        <Route path="espace/:slug/:code" element={<EspaceClient />} />
        <Route path="espace-client" element={<Navigate to="/espace" replace />} />
          <Route element={<AppLayout />}>
            <Route index element={<Accueil />} />
            {/* Tableau de bord : /dashboard (super admin) ou /dashboard/:departement. */}
            <Route path="dashboard" element={<RequireRole roles={INTERNES}><Dashboard /></RequireRole>} />
            <Route path="dashboard/:departement" element={<RequireRole roles={INTERNES}><Dashboard /></RequireRole>} />
            <Route path="clients" element={<RequireRole roles={INTERNES}><Clients /></RequireRole>} />
            <Route path="clients/nouveau" element={<RequireRole roles={INTERNES}><NouveauClient /></RequireRole>} />
            <Route path="clients/:id" element={<RequireRole roles={INTERNES}><FicheClient /></RequireRole>} />
            <Route path="projets" element={<RequireRole roles={ROLES_DEV}><Projets /></RequireRole>} />
            <Route path="projets/:id" element={<RequireRole roles={ROLES_DEV}><ProjetDetail /></RequireRole>} />
            <Route path="dev/taches" element={<RequireRole roles={ROLES_DEV}><Taches /></RequireRole>} />
            <Route path="dev/bugs" element={<RequireRole roles={ROLES_DEV}><Bugs /></RequireRole>} />
            <Route path="com/calendrier" element={<RequireRole roles={ROLES_COM}><Calendrier /></RequireRole>} />
            <Route path="com/campagnes" element={<RequireRole roles={ROLES_COM}><Campagnes /></RequireRole>} />
            <Route path="com/medias" element={<RequireRole roles={ROLES_COM}><Medias /></RequireRole>} />
            <Route path="tickets" element={<RequireRole roles={ROLES_TICKETS}><Tickets /></RequireRole>} />
            <Route path="factures" element={<RequireRole roles={ROLES_FINANCE}><Factures /></RequireRole>} />
            <Route path="factures/:numero" element={<RequireRole roles={ROLES_FINANCE}><FactureDetail /></RequireRole>} />
            <Route path="finance/devis" element={<RequireRole roles={ROLES_FINANCE}><Devis /></RequireRole>} />
            <Route path="devis/:numero" element={<RequireRole roles={ROLES_FINANCE}><DevisDetail /></RequireRole>} />
            <Route path="finance/recus" element={<RequireRole roles={ROLES_FINANCE}><Recus /></RequireRole>} />
            <Route path="recus/:numero" element={<RequireRole roles={ROLES_FINANCE}><RecuDetail /></RequireRole>} />
            <Route path="finance/depenses" element={<RequireRole roles={ROLES_FINANCE}><Depenses /></RequireRole>} />
            <Route path="finance/fournisseurs" element={<RequireRole roles={ROLES_FINANCE}><Fournisseurs /></RequireRole>} />
            <Route path="finance/fournisseurs/:id" element={<RequireRole roles={ROLES_FINANCE}><FournisseurDetail /></RequireRole>} />
            <Route path="finance/paie" element={<RequireRole roles={ROLES_FINANCE}><Paie /></RequireRole>} />
            <Route path="finance/paie/:id" element={<RequireRole roles={ROLES_FINANCE}><FichePaie /></RequireRole>} />
            <Route path="juridique/contrats" element={<RequireRole roles={ROLES_JURIDIQUE}><EspaceRedaction categorie="contrats" /></RequireRole>} />
            <Route path="juridique/litiges" element={<RequireRole roles={ROLES_JURIDIQUE}><EspaceRedaction categorie="litiges" /></RequireRole>} />
            <Route path="secretariat/courriers" element={<RequireRole roles={ROLES_SECRETARIAT}><Courriers /></RequireRole>} />
            <Route path="secretariat/decharges" element={<RequireRole roles={ROLES_SECRETARIAT}><Decharges /></RequireRole>} />
            <Route path="secretariat/reunions" element={<RequireRole roles={ROLES_SECRETARIAT}><Reunions /></RequireRole>} />
            <Route path="com/communiques" element={<RequireRole roles={ROLES_COM}><EspaceRedaction categorie="communiques" /></RequireRole>} />
            <Route path="rh/employes" element={<RequireRole roles={ROLES_RH}><Employes /></RequireRole>} />
            <Route path="rh/conges" element={<RequireRole roles={INTERNES}><Conges /></RequireRole>} />
            <Route path="rh/recrutement" element={<RequireRole roles={ROLES_RH}><Recrutement /></RequireRole>} />
            <Route path="rh/pointage" element={<RequireRole roles={ROLES_RH}><Pointages /></RequireRole>} />
            <Route path="rh/rapports" element={<RequireRole roles={ROLES_RH}><Rapports /></RequireRole>} />
            <Route path="pointage" element={<RequireRole roles={INTERNES}><Pointage /></RequireRole>} />
            <Route path="parametres" element={<RequireRole roles={['super_admin']}><Parametres /></RequireRole>} />
            <Route path="mails" element={<RequireRole roles={INTERNES}><Mails /></RequireRole>} />
            <Route path="chat" element={<RequireRole roles={INTERNES}><Chat /></RequireRole>} />
            <Route path="parametres/chat" element={<RequireSuperAdmin><ChatGroupes /></RequireSuperAdmin>} />
            <Route path="profil" element={<RequireRole roles={INTERNES}><Profil /></RequireRole>} />
            <Route path="parametres/utilisateurs" element={<RequireSuperAdmin><Utilisateurs /></RequireSuperAdmin>} />
            <Route path="parametres/utilisateurs/nouveau" element={<RequireSuperAdmin><UtilisateurNouveau /></RequireSuperAdmin>} />
            <Route path="design-system" element={<RequireRole roles={INTERNES}><DesignSystem /></RequireRole>} />
            {FEATURE_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={<SectionPage surtitre={r.surtitre} titre={r.titre} texte={r.texte} />} />
            ))}
            <Route path="*" element={<NonTrouve />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
