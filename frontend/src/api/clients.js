import { api } from './client.js';
import { suppr } from './base.js';

/* Ressource Clients — DRF /clients/ (SPEC §4). */

export async function listerClients({ search = '', statut = '', page = 1 } = {}) {
  const { data } = await api.get('/clients/', { params: { search, statut, page } });
  return data; // { count, results: [{ id, nom_societe, contact, email, phone, adresse, statut, projets_count, tickets_ouverts, factures_impayees }] }
}

export async function creerClient(payload) {
  const { data } = await api.post('/clients/', payload);
  return data;
}

export const supprimerClient = (id) => suppr(`/clients/${id}/`);

/* Compte espace client créé SANS mot de passe (set_unusable_password côté back).
   Le client définit lui-même son mdp via le lien d'invitation 24h. */
export async function creerCompteClient({ clientId, email, username }) {
  const { data } = await api.post('/users/', { email, username, role: 'client', client: clientId });
  return data;
}

/* Invitation sécurisée : le back génère le lien d'activation uid/token 24h et
   envoie le template « Bienvenue espace client » (identifiant + lien, sans mdp). */
export async function envoyerInvitationClient(clientId, { username, espaceUrl } = {}) {
  const { data } = await api.post(`/clients/${clientId}/send_access/`, {
    ...(username ? { username } : {}),
    ...(espaceUrl ? { espace_url: espaceUrl } : {}),
  });
  return data;
}

export const genererUsername = (base) =>
  String(base ?? 'client').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'client';
