import { api } from '../api/client.js';

/* Push web HUB DIGI — abonnement navigateur relié au backend /push/.
   Logique in-app (cloche) inchangée : le serveur relaie chaque Notification. */

export const pushSupporte = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

const cleVersUint8 = (b64) => {
  const rembourre = '='.repeat((4 - (b64.length % 4)) % 4);
  const binaire = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + rembourre);
  return Uint8Array.from([...binaire].map((c) => c.charCodeAt(0)));
};

const tamponVersB64 = (tampon) => {
  const octets = new Uint8Array(tampon);
  let binaire = '';
  octets.forEach((o) => { binaire += String.fromCharCode(o); });
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function abonnementActuel() {
  if (!pushSupporte()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function activerPush() {
  if (!pushSupporte()) throw new Error('Navigateur incompatible avec les notifications push.');
  const { data } = await api.get('/push/vapid-key/');
  const reg = await navigator.serviceWorker.register('/push-sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission de notification refusée.');
  const abo = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleVersUint8(data.publicKey),
  });
  const json = abo.toJSON();
  await api.post('/push/subscribe/', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return abo;
}

export async function desactiverPush() {
  const abo = await abonnementActuel();
  if (abo) {
    try {
      await api.delete('/push/subscribe/', { data: { endpoint: abo.endpoint } });
    } catch {
      /* backend injoignable, on coupe au moins côté navigateur */
    }
    await abo.unsubscribe();
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && (await reg.pushManager.getSubscription()) === null) await reg.unregister();
  } catch {
    /* nettoyage optionnel */
  }
}

export async function testerPush() {
  await api.post('/push/test/');
}

export { tamponVersB64 };
