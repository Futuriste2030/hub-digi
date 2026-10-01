import axios from 'axios';

/* Client API HUB DIGI — JWT access/refresh, base URL via VITE_API_URL.
   Backend : Django DRF /api/v1/ (SPEC §12). */

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export const api = axios.create({ baseURL: API_URL });

let accessToken = null;
let onDeconnecte = null;
let refreshTokenStocke = null;

export const setAccessToken = (t) => { accessToken = t; };
export const setOnDeconnecte = (fn) => { onDeconnecte = fn; };
export const setRefreshToken = (t) => { refreshTokenStocke = t; };

/* Recharge les tokens persistés au démarrage du module : les routes hors AppLayout
   (ex. /espace en accès direct) n'appellent pas forcément restaurer() avant leurs fetchs. */
try {
  const brut = window.localStorage.getItem('hubdigi-auth');
  const pars = brut ? JSON.parse(brut)?.state : null;
  if (pars?.access) accessToken = pars.access;
  if (pars?.refresh) refreshTokenStocke = pars.refresh;
} catch {
  /* stockage indisponible */
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (erreur) => {
    const req = erreur.config;
    if (erreur.response?.status === 401 && !req._relance && refreshTokenStocke) {
      req._relance = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh: refreshTokenStocke });
        accessToken = data.access;
        if (data.refresh) refreshTokenStocke = data.refresh;
        req.headers.Authorization = `Bearer ${accessToken}`;
        window.dispatchEvent(new CustomEvent('hubdigi:tokens', { detail: { access: accessToken, refresh: refreshTokenStocke } }));
        return api(req);
      } catch {
        onDeconnecte?.();
      }
    }
    return Promise.reject(erreur);
  },
);

/* Décode le payload JWT sans dépendance (rôle, department_id, client_id). */
export function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

export function messageErreur(erreur, defaut = 'Action impossible.') {
  const data = erreur?.response?.data;
  if (!data) return defaut;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const premier = Object.values(data)[0];
  return Array.isArray(premier) ? premier[0] : String(premier ?? defaut);
}
