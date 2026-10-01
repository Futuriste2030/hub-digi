import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setAccessToken, setOnDeconnecte, setRefreshToken } from '../api/client.js';

/* Store auth — remplace le mock session.js : JWT réels Django (SPEC §3, §10).
   session : { id, nom, role, dept, poste, clientId, email, initiales } (forme consommée par le layout). */

const initialesDe = (nom) =>
  String(nom ?? '').split(/[\s·]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

export function userVersSession(u) {
  if (!u) return null;
  const nom = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email;
  return {
    id: u.id,
    nom,
    role: u.role,
    dept: u.department_nom ?? null,
    poste: u.poste_titre ?? null,
    clientId: u.client ?? null,
    email: u.email,
    initiales: initialesDe(nom),
  };
}

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      access: null,
      refresh: null,
      otpTemp: null, // temp_token quand la 2FA est exigée
      chargement: false,
      erreur: '',

      estConnecte: () => !!get().access,

      async login(email, motDePasse) {
        set({ chargement: true, erreur: '', otpTemp: null });
        try {
          const { data, status } = await api.post('/auth/login/', { email, password: motDePasse });
          if (status === 202 && data.otp_required) {
            set({ otpTemp: data.temp_token, chargement: false });
            return { otpRequis: true };
          }
          await get().appliquerTokens(data.access, data.refresh);
          return { otpRequis: false };
        } catch (e) {
          const msg = e.response?.data?.detail ?? 'E-mail ou mot de passe incorrect.';
          set({ erreur: msg, chargement: false });
          return { otpRequis: false, erreur: msg };
        }
      },

      async verifierOtp(code) {
        set({ chargement: true, erreur: '' });
        try {
          const { data } = await api.post('/auth/otp/verify/', { temp_token: get().otpTemp, code });
          await get().appliquerTokens(data.access, data.refresh);
          return {};
        } catch {
          set({ erreur: 'Code 2FA invalide ou expiré.', chargement: false });
          return { erreur: 'Code 2FA invalide ou expiré.' };
        }
      },

      async appliquerTokens(access, refresh) {
        setAccessToken(access);
        setRefreshToken(refresh);
        set({ access, refresh, otpTemp: null });
        try {
          const { data } = await api.get('/users/me/');
          set({ user: data, chargement: false, erreur: '' });
        } catch {
          set({ user: null, access: null, refresh: null, chargement: false, erreur: 'Session illisible.' });
        }
      },

      async restaurer() {
        const { access, refresh, user } = get();
        if (!access) return;
        setAccessToken(access);
        setRefreshToken(refresh);
        if (!user) {
          try {
            const { data } = await api.get('/users/me/');
            set({ user: data });
          } catch {
            get().logout();
          }
        }
      },

      logout() {
        setAccessToken(null);
        setRefreshToken(null);
        set({ user: null, access: null, refresh: null, otpTemp: null, erreur: '' });
      },
    }),
    { name: 'hubdigi-auth', partialize: (s) => ({ user: s.user, access: s.access, refresh: s.refresh }) },
  ),
);

setOnDeconnecte(() => useAuth.getState().logout());
if (typeof window !== 'undefined') {
  window.addEventListener('hubdigi:tokens', (e) => {
    useAuth.setState({ access: e.detail.access, refresh: e.detail.refresh });
  });
}

/* Sélecteur stable : même référence tant que user ne change pas (sinon boucle useSyncExternalStore). */
export const useSession = () => {
  const user = useAuth((s) => s.user);
  return useMemo(() => userVersSession(user), [user]);
};
