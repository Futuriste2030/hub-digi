import { api } from './client.js';

/* Auth : reset mot de passe (le login vit dans le store). */

export async function demanderReset(email) {
  const { data } = await api.post('/auth/password/reset/', { email });
  return data;
}

export async function confirmerReset({ uid, token, newPassword }) {
  const { data } = await api.post('/auth/password/reset/confirm/', {
    uid, token, new_password: newPassword,
  });
  return data;
}

export async function changerMotDePasse({ actuel, nouveau, code }) {
  const { data } = await api.post('/auth/password/change/', {
    current_password: actuel, new_password: nouveau, code,
  });
  return data;
}
