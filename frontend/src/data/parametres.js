/* Paramètres société — API réelle GET/PATCH /settings/entreprise/ + cache local synchrone
   pour les documents (FactureDoc, RecuDoc, DevisDoc, Entete). */

import { api, API_URL } from '../api/client.js';

const origineApi = API_URL.split('/api/')[0];
const urlAbsolue = (u) => {
  if (!u) return null;
  if (u instanceof File) return URL.createObjectURL(u);
  return String(u).startsWith('http') ? String(u) : `${origineApi}${u}`;
};

const DEFAUT = {
  raison: 'Digi Com & Technologies',
  nif: '081234567A',
  rccm: 'ML-BKO-2021-B-1234',
  adresse: 'Sotuba ACI-2000, Bamako — Près de la Rue Alqoods',
  phone: '(+223) 70 16 33 86',
  email: 'contact@digicom.ml',
  devise: 'F CFA',
  tauxTva: 0,
  delaiPaiement: '30 jours',
  conditions: 'Paiement à 30 jours date de facture. Passé ce délai, pénalités de 1,5 % par mois de retard.',
  pied: 'Digi Com & Technologies — NIF 081234567A — RCCM ML-BKO-2021-B-1234 — Merci de votre confiance.',
  signataire: 'La Direction Financière',
  cachetFinance: null, signatureFinance: null,
  cachetJuridique: null, signatureJuridique: null,
  cachetSecretariat: null,
  entete: { haut: '/entete/entete-haut.png', bas: '/entete/entete-bas.png', source: 'Entete-Digi.pdf' },
};

let CACHE = { ...DEFAUT };
try {
  const brut = window.localStorage.getItem('hubdigi-entreprise');
  if (brut) CACHE = { ...DEFAUT, ...JSON.parse(brut) };
} catch {
  /* stockage indisponible */
}

const versCache = (apiData) => ({
  raison: apiData.raison ?? DEFAUT.raison,
  nif: apiData.nif ?? DEFAUT.nif,
  rccm: apiData.rccm ?? DEFAUT.rccm,
  adresse: apiData.adresse ?? DEFAUT.adresse,
  phone: apiData.phone ?? DEFAUT.phone,
  email: apiData.email ?? DEFAUT.email,
  delaiPaiement: apiData.delai_paiement ?? DEFAUT.delaiPaiement,
  signataire: apiData.signataire ?? DEFAUT.signataire,
  devise: apiData.devise ?? DEFAUT.devise,
  tauxTva: apiData.taux_tva ?? DEFAUT.tauxTva,
  conditions: apiData.conditions ?? DEFAUT.conditions,
  pied: apiData.pied ?? DEFAUT.pied,
  cachetFinance: urlAbsolue(apiData.cachet_finance),
  signatureFinance: urlAbsolue(apiData.signature_finance),
  cachetJuridique: urlAbsolue(apiData.cachet_juridique),
  signatureJuridique: urlAbsolue(apiData.signature_juridique),
  cachetSecretariat: urlAbsolue(apiData.cachet_secretariat),
});

const CHAMPS_FICHIER = {
  cachetFinance: 'cachet_finance', signatureFinance: 'signature_finance',
  cachetJuridique: 'cachet_juridique', signatureJuridique: 'signature_juridique',
  cachetSecretariat: 'cachet_secretariat',
};

const versApi = (v) => ({
  raison: v.raison, nif: v.nif, rccm: v.rccm, adresse: v.adresse, phone: v.phone,
  email: v.email, delai_paiement: v.delaiPaiement, signataire: v.signataire,
  devise: v.devise, taux_tva: Number(v.tauxTva) || 0,
  conditions: v.conditions, pied: v.pied,
});

function memoriser(cache) {
  CACHE = { ...CACHE, ...cache };
  try {
    window.localStorage.setItem('hubdigi-entreprise', JSON.stringify(CACHE));
  } catch {
    /* stockage indisponible */
  }
}

export const getEntreprise = () => ({ ...CACHE });

export async function chargerEntreprise() {
  try {
    const { data } = await api.get('/settings/entreprise/');
    memoriser(versCache(data));
  } catch {
    /* hors-ligne : garde le cache local */
  }
  return getEntreprise();
}

export async function majEntreprise(valeurs) {  const fusion = { ...CACHE, ...valeurs };
  const joints = Object.keys(CHAMPS_FICHIER).filter((k) => fusion[k] instanceof File);
  let data;
  if (joints.length > 0) {
    const form = new FormData();
    Object.entries(versApi(fusion)).forEach(([k, v]) => form.append(k, v ?? ''));
    joints.forEach((k) => form.append(CHAMPS_FICHIER[k], fusion[k]));
    // Pas de Content-Type manuel : le navigateur ajoute multipart + boundary.
    ({ data } = await api.patch('/settings/entreprise/', form));
  } else {
    ({ data } = await api.patch('/settings/entreprise/', versApi(fusion)));
  }
  memoriser(versCache(data));
  return getEntreprise();
}

/* Suppression d'un cachet/signature déjà importé (JSON null, fichier purgé serveur). */
export async function supprimerTampon(cle) {
  const champApi = CHAMPS_FICHIER[cle];
  if (!champApi) throw new Error('Tampon inconnu.');
  const { data } = await api.patch('/settings/entreprise/', { [champApi]: null });
  memoriser(versCache(data));
  return getEntreprise();
}
