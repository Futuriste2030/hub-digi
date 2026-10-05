import { get, post, patch, suppr, toutLister } from './base.js';
import { api } from './client.js';

/* Upload réel multipart (le JSON ne transporte pas les fichiers). */
export async function uploaderMedia({ client, nom, type, fichier }) {
  const form = new FormData();
  form.append('client', client);
  form.append('nom', nom);
  form.append('type', type);
  form.append('fichier', fichier);
  // Pas de Content-Type manuel : le navigateur ajoute multipart + boundary.
  const { data } = await api.post('/com/medias/', form);
  return data;
}

export const listerCampagnes = (params) => toutLister('/com/campaigns/', params);
export const creerCampagne = (payload) => post('/com/campaigns/', payload);
export const majCampagne = (id, payload) => patch(`/com/campaigns/${id}/`, payload);
export const supprimerCampagne = (id) => suppr(`/com/campaigns/${id}/`);
export const listerPublications = (params) => toutLister('/com/calendar/', params);
export const creerPublication = (payload) => post('/com/calendar/', payload);
export const majPublication = (id, payload) => patch(`/com/calendar/${id}/`, payload);
export const supprimerPublication = (id) => suppr(`/com/calendar/${id}/`);
export const listerMedias = (params) => toutLister('/com/medias/', params);
export const creerMediaLien = (payload) => post('/com/medias/', payload);
export const majMedia = (id, payload) => patch(`/com/medias/${id}/`, payload);
export const supprimerMedia = (id) => suppr(`/com/medias/${id}/`);
export const listerEmployes = () => toutLister('/rh/employees/');
export const creerEmploye = (payload) => post('/rh/employees/', payload);
export const listerUsersMini = () => get('/users/mini/');
export const listerConges = (params) => toutLister('/rh/leaves/', params);
export const demanderConge = (payload) => post('/rh/leaves/', payload);
export const validerConge = (id, payload) => patch(`/rh/leaves/${id}/validate/`, payload);
export const listerCandidatures = (params) => toutLister('/rh/recruitments/', params);
export const majCandidature = (id, payload) => patch(`/rh/recruitments/${id}/`, payload);
export const supprimerCandidature = (id) => suppr(`/rh/recruitments/${id}/`);
/* Pointage QR — SPEC §5.5 (MAJ 05/10/2026) : statut post-login, QR dynamique, scan GPS. */
export const statutPointage = () => get('/rh/pointage/statut/');
export const genererQrPointage = () => post('/rh/pointage/qr/', {});
export const scannerPointage = (payload) => post('/rh/pointage/scan/', payload);
export const listerPointages = (params) => toutLister('/rh/pointages/', params);
/* Rapports mensuels + primes — employé du mois auto, validation RH. */
export const rapportPointage = (mois) => get('/rh/pointage/rapport/', { mois });
export const listerPrimes = (params) => toutLister('/rh/primes/', params);
export const validerPrime = (id) => patch(`/rh/primes/${id}/valider/`, {});
export const listerContrats = (params) => toutLister('/juridique/contracts/', params);
export const creerContrat = (payload) => post('/juridique/contracts/', payload);
export const majContrat = (id, payload) => patch(`/juridique/contracts/${id}/`, payload);
export const supprimerContrat = (id) => suppr(`/juridique/contracts/${id}/`);
export const listerMesContrats = () => get('/juridique/contracts/mes/');
export const signerContrat = (id, payload) => post(`/juridique/contracts/${id}/signer/`, payload);
export const listerLitiges = (params) => toutLister('/juridique/disputes/', params);
export const creerLitige = (payload) => post('/juridique/disputes/', payload);
export const majLitige = (id, payload) => patch(`/juridique/disputes/${id}/`, payload);
export const listerCommuniques = (params) => toutLister('/com/communiques/', params);
export const creerCommunique = (payload) => post('/com/communiques/', payload);
export const majCommunique = (id, payload) => patch(`/com/communiques/${id}/`, payload);
export const supprimerCommunique = (id) => suppr(`/com/communiques/${id}/`);
export const envoyerMail = (payload) => post('/mailing/send/', payload);
export const listerMailsEnvoyes = (params) => toutLister('/mailing/sent/', params);
export const listerTemplatesMail = () => toutLister('/mailing/templates/', {});
export const listerUsers = (params) => toutLister('/users/', params);
export const creerUser = (payload) => post('/users/', payload);
export const majUser = (id, payload) => patch(`/users/${id}/`, payload);
export const resetUserPassword = (id, newPassword) => post(`/users/${id}/reset_password/`, { new_password: newPassword });
export const listerDepartements = () => get('/departments/').then((d) => d.results ?? d);
export const listerPostes = () => toutLister('/postes/', {});
