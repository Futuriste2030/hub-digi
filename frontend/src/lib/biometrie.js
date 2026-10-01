import { api } from '../api/client.js';

/* Biométrie / passkeys (WebAuthn) — optionnel, le mot de passe reste toujours
   disponible. La biométrie ne quitte jamais l'appareil (clé publique seule côté serveur). */

export const biometrieSupportee = () =>
  typeof window !== 'undefined' && !!window.PublicKeyCredential;

export async function biometrieDisponible() {
  if (!biometrieSupportee()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return !!window.isSecureContext;
  } catch {
    return false;
  }
}

const tamponVersB64 = (tampon) => {
  const octets = new Uint8Array(tampon);
  let binaire = '';
  octets.forEach((o) => { binaire += String.fromCharCode(o); });
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64VersTampon = (b64) => {
  const rembourre = '='.repeat((4 - (b64.length % 4)) % 4);
  const binaire = atob(String(b64).replace(/-/g, '+').replace(/_/g, '/') + rembourre);
  return Uint8Array.from([...binaire].map((c) => c.charCodeAt(0)));
};

/* Les options serveur (JSON, base64url) -> objets WebAuthn (ArrayBuffer). */
const preparerCreation = (opts) => ({
  ...opts,
  challenge: b64VersTampon(opts.challenge),
  user: { ...opts.user, id: b64VersTampon(opts.user.id) },
  excludeCredentials: (opts.excludeCredentials ?? []).map((c) => ({ ...c, id: b64VersTampon(c.id) })),
});

const preparerDemande = (opts) => ({
  ...opts,
  challenge: b64VersTampon(opts.challenge),
  allowCredentials: (opts.allowCredentials ?? []).map((c) => ({ ...c, id: b64VersTampon(c.id) })),
});

const credentialVersJson = (cred) => ({
  id: cred.id,
  rawId: tamponVersB64(cred.rawId),
  type: cred.type,
  response: Object.fromEntries(
    ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle']
      .filter((k) => cred.response[k] != null)
      .map((k) => {
        const v = cred.response[k];
        return [k, typeof v === 'string' ? v : tamponVersB64(v)];
      }),
  ),
});

export async function enregistrerBiometrie(nom = 'Mon appareil') {
  const { data: options } = await api.post('/auth/webauthn/register/begin/');
  const cred = await navigator.credentials.create({ publicKey: preparerCreation(options) });
  if (!cred) throw new Error('Enregistrement annulé.');
  await api.post('/auth/webauthn/register/complete/', { credential: credentialVersJson(cred), nom });
}

export async function connecterBiometrie(identifiant) {
  const { data: options } = await api.post('/auth/webauthn/login/begin/', { identifiant });
  const assertion = await navigator.credentials.get({ publicKey: preparerDemande(options) });
  if (!assertion) throw new Error('Authentification annulée.');
  const { data, status } = await api.post('/auth/webauthn/login/complete/', {
    identifiant,
    credential: credentialVersJson(assertion),
  });
  return { data, status };
}

export async function listerBiometries() {
  const { data } = await api.get('/auth/webauthn/credentials/');
  return data;
}

export async function supprimerBiometrie(id) {
  await api.delete(`/auth/webauthn/credentials/${id}/`);
}
