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

export async function creerCompteClient({ clientId, email, username, password }) {
  const { data } = await api.post('/users/', { email, username, password, role: 'client', client: clientId });
  return data;
}

export async function envoyerAccesClient({ to, username, espaceUrl }) {
  const { data } = await api.post('/mailing/send/', {
    to,
    subject: 'Bienvenue sur votre espace client',
    body_html: `<p>Bonjour,</p><p>Votre espace client est ouvert : <a href="${espaceUrl}">${espaceUrl}</a></p><p>Identifiant : <strong>${username}</strong> (mot de passe transmis séparément).</p>`,
  });
  return data;
}

export const genererUsername = (base) =>
  String(base ?? 'client').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'client';

export const genererMdp = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => alphabet[n % alphabet.length]).join('');
};
