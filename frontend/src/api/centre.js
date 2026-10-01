import { api, messageErreur } from './client.js';
import { get, post, patch, suppr, toutLister } from './base.js';

export { messageErreur };

/* Notifications in-app (cloche). */
export const listerNotifs = () => toutLister('/notifications/', {});
export const marquerNotifLue = (id) => patch(`/notifications/${id}/`, { lue: true });
export async function toutMarquerLu(notifs) {
  await Promise.all(notifs.filter((n) => !n.lue).map((n) => marquerNotifLue(n.id)));
}

/* Chat interne (bulle Messages). */
export const conversations = () => get('/chat/conversations/');
export const filDiscussion = (avec) => get('/chat/messages/', { avec });
export const envoyerMessage = (destinataire, texte) => post('/chat/send/', { destinataire, texte });
export const marquerLus = (avec) => post('/chat/lus/', { avec });

/* Groupes Slack-like (onglet Chat + Paramètres > Chat). */
export const listerGroupes = () => get('/chat/groupes/');
export const creerGroupe = (payload) => post('/chat/groupes/', payload);
export const supprimerGroupe = (id) => suppr(`/chat/groupes/${id}/`);
export const filGroupe = (id) => get(`/chat/groupes/${id}/messages/`);
export const envoyerGroupe = (id, texte) => post(`/chat/groupes/${id}/messages/`, { texte });
export const marquerGroupeLus = (id) => post(`/chat/groupes/${id}/lus/`, {});

/* Compteur tickets ouverts (pastille sidebar). */
export async function compterTicketsOuverts() {
  const { data } = await api.get('/tickets/', { params: { page_size: 1 } });
  return data.count ?? 0;
}
