import { Navigate, useOutletContext } from 'react-router-dom';
import AccesRestreint from './guards/AccesRestreint.jsx';
import { useAuth, useSession } from '../store/auth.js';

/* Garde-fou frontend générique (SPEC §3).
   Usage : <RequireRole roles={ROLES_DEV}>…</RequireRole>
   Session réelle (JWT). BACKEND : 403 DRF, seule vraie sécurité. */
export default function RequireRole({ roles = [], children, retour = '/', session: sessionProp }) {
  const ctx = useOutletContext();
  const access = useAuth((s) => s.access);
  const sessionStore = useSession();
  const session = sessionProp ?? ctx?.session ?? sessionStore;
  /* Login required — redirection si pas de token. */
  if (!access) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(session?.role)) {
    return (
      <AccesRestreint
        titre="Accès non autorisé"
        requis="Votre rôle ne donne pas accès à cette page."
        retour={retour}
      />
    );
  }
  return children;
}
