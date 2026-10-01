import { Navigate } from 'react-router-dom';
import { useAuth, useSession } from '../store/auth.js';

/* Garde-fou frontend (mock) — SPEC §3 : la vraie sécurité est côté backend
   (permission DRF IsSuperAdmin sur /users/). */
export default function RequireSuperAdmin({ children }) {
  const access = useAuth((s) => s.access);
  const session = useSession();
  if (!access) {
    return <Navigate to="/login" replace />;
  }
  if (session?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
