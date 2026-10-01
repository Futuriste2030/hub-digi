import { Navigate } from 'react-router-dom';
import ChargementPage from '../components/ChargementPage.jsx';
import { useAuth, useSession } from '../store/auth.js';
import { urlTableauDeBord } from '../lib/acces.js';

/* Racine / : redirige vers la page d'accueil du rôle (splash pendant la restauration). */
export default function Accueil() {
  const access = useAuth((s) => s.access);
  const session = useSession();
  if (!access) return <Navigate to="/login" replace />;
  if (!session) return <ChargementPage message="Préparation de votre tableau de bord…" />;
  return <Navigate to={urlTableauDeBord(session)} replace />;
}
