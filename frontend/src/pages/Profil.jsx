import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserRound, ShieldCheck, BellRing, Eye, EyeOff, Check, Smartphone, Fingerprint, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { LIBELLES_ROLE } from '../data/session.js';
import { api, messageErreur } from '../api/client.js';
import { abonnementActuel, activerPush, desactiverPush, pushSupporte, testerPush } from '../lib/push.js';
import { biometrieDisponible, biometrieSupportee, enregistrerBiometrie, listerBiometries, messageBiometrie, supprimerBiometrie } from '../lib/biometrie.js';
import { changerMotDePasse } from '../api/auth.js';

/* Mon profil — infos session, sécurité réelle (POST /auth/password/change/), 2FA, préférences. */

const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export default function Profil() {
  const { notifier, session } = useOutletContext();
  const [mdp, setMdp] = useState({ actuel: '', nouveau: '', confirmation: '', code: '' });
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoiMdp, setEnvoiMdp] = useState(false);
  const [prefs, setPrefs] = useState({ mail: true, inapp: true, rappels: true });
  /* 2FA TOTP : activation en 2 temps (QR à scanner, puis code de vérification). */
  const [doubleAuth, setDoubleAuth] = useState(null); // null = inconnu, true/false = état
  const [qr, setQr] = useState(null); // { otpauth_url, secret }
  const [code2fa, setCode2fa] = useState('');
  const [erreur2fa, setErreur2fa] = useState('');
  /* Push web : relais navigateur des notifs in-app (bugs, tickets, mails…). */
  const [pushActif, setPushActif] = useState(false);
  const [pushAction, setPushAction] = useState(false);
  /* Biométrie : passkeys de l'appareil, mot de passe toujours conservé. */
  const [bioDispo, setBioDispo] = useState(null);
  const [passkeys, setPasskeys] = useState([]);
  const [bioAction, setBioAction] = useState(false);

  useEffect(() => {
    let actif = true;
    api.get('/auth/otp/status/').then(
      ({ data }) => { if (actif) setDoubleAuth(!!data.active); },
      () => { if (actif) setDoubleAuth(false); },
    );
    return () => { actif = false; };
  }, []);

  const demarrer2fa = async () => {
    setErreur2fa('');
    try {
      const { data } = await api.post('/auth/otp/setup/');
      setQr(data);
    } catch (e) {
      setErreur2fa(messageErreur(e, 'Activation 2FA impossible.'));
    }
  };

  const confirmer2fa = async (e) => {
    e.preventDefault();
    setErreur2fa('');
    try {
      await api.post('/auth/otp/confirm/', { code: code2fa.trim() });
      setQr(null);
      setCode2fa('');
      setDoubleAuth(true);
      notifier({ type: 'succes', titre: '2FA activée', texte: 'Prochaine connexion : mot de passe + code authenticator.' });
    } catch (err) {
      setErreur2fa(messageErreur(err, 'Code invalide.'));
    }
  };

  const desactiver2fa = async () => {
    setErreur2fa('');
    try {
      await api.delete('/auth/otp/disable/');
      setDoubleAuth(false);
      notifier({ type: 'info', titre: '2FA désactivée', texte: 'Connexion par mot de passe uniquement.' });
    } catch (e) {
      setErreur2fa(messageErreur(e, 'Désactivation impossible.'));
    }
  };

  const changerMdp = async (e) => {
    e.preventDefault();
    if (mdp.actuel.trim().length < 4) {
      setErreur('Indiquez votre mot de passe actuel.');
      return;
    }
    if (mdp.nouveau.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (mdp.nouveau !== mdp.confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    if (doubleAuth && mdp.code.trim().length < 6) {
      setErreur('Saisissez le code 2FA de votre application authenticator.');
      return;
    }
    if (envoiMdp) return;
    setEnvoiMdp(true);
    try {
      await changerMotDePasse({ actuel: mdp.actuel, nouveau: mdp.nouveau, code: mdp.code.trim() });
      setMdp({ actuel: '', nouveau: '', confirmation: '', code: '' });
      setErreur('');
      notifier({ type: 'succes', titre: 'Mot de passe modifié', texte: 'Prochaine connexion avec le nouveau mot de passe.' });
    } catch (err) {
      setErreur(messageErreur(err, 'Modification impossible. Vérifiez le mot de passe actuel.'));
    } finally {
      setEnvoiMdp(false);
    }
  };

  useEffect(() => {
    let actif = true;
    abonnementActuel().then(
      (abo) => { if (actif) setPushActif(!!abo); },
      () => {},
    );
    return () => { actif = false; };
  }, []);

  const basculerPush = async () => {
    if (pushAction) return;
    setPushAction(true);
    try {
      if (pushActif) {
        await desactiverPush();
        setPushActif(false);
        notifier({ type: 'info', titre: 'Push désactivées', texte: 'La cloche in-app continue de fonctionner.' });
      } else {
        await activerPush();
        setPushActif(true);
        notifier({ type: 'succes', titre: 'Push activées', texte: 'Bugs, tickets et mails arriveront même hub fermé.' });
      }
    } catch (e) {
      notifier({ type: 'info', titre: 'Push impossibles', texte: e.message ?? messageErreur(e) });
    } finally {
      setPushAction(false);
    }
  };

  const envoyerTestPush = async () => {
    try {
      await testerPush();
      notifier({ type: 'succes', titre: 'Test envoyé', texte: 'Regardez vos notifications système.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Test impossible', texte: messageErreur(e) });
    }
  };

  useEffect(() => {
    let actif = true;
    biometrieDisponible().then((ok) => { if (actif) setBioDispo(!!ok); });
    listerBiometries().then(
      (liste) => { if (actif) setPasskeys(liste); },
      () => {},
    );
    return () => { actif = false; };
  }, []);

  const activerBiometrie = async () => {
    if (bioAction) return;
    setBioAction(true);
    try {
      await enregistrerBiometrie('Mon appareil');
      setPasskeys(await listerBiometries());
      notifier({ type: 'succes', titre: 'Biométrie activée', texte: 'Prochaine connexion possible par empreinte ou visage.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Activation impossible', texte: messageBiometrie(e, messageErreur(e)) });
    } finally {
      setBioAction(false);
    }
  };

  const retirerBiometrie = async (id) => {
    try {
      await supprimerBiometrie(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      notifier({ type: 'info', titre: 'Appareil retiré', texte: 'Connexion par mot de passe conservée.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Retrait impossible', texte: messageErreur(e) });
    }
  };

  const basculerPref = (k) => {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
    notifier({ type: 'info', titre: 'Préférence enregistrée', texte: 'Notifications mises à jour.' });
  };

  const infos = [
    ['E-mail pro', session?.email ?? '—'],
    ['Rôle', LIBELLES_ROLE[session?.role] ?? '—'],
    ['Département', session?.dept ?? (session?.role === 'client' ? `Compte ${session?.clientId ?? ''}` : '—')],
  ];

  return (
    <div>
      <div>
        <p className="dg-surtitre">Compte</p>
        <h1 className="mt-esp-2">Mon profil</h1>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-pilule font-titrage text-[18px] font-extrabold text-blanc" style={{ background: 'var(--degrade-bleu)' }}>
                {session?.initiales ?? '—'}
              </span>
              <span>
                <span className="block font-titrage text-[18px] font-bold text-gris-900">{session?.nom ?? '—'}</span>
                <Badge ton="info">{LIBELLES_ROLE[session?.role] ?? session?.role}</Badge>
              </span>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-3">
            {infos.map(([k, v]) => (
              <p key={k} className="flex items-center justify-between gap-esp-3 rounded-lg bg-gris-100 p-esp-3 font-courant text-[15px]">
                <span className="text-gris-600">{k}</span>
                <span className="text-right font-semibold text-gris-900">{v}</span>
              </p>
            ))}
            <p className="dg-legende flex items-center gap-esp-1"><UserRound size={14} aria-hidden="true" /> Rôle et département assignés par le Super Admin.</p>
          </CardBody>
        </Card>

        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-digi-voile">
                <ShieldCheck size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Sécurité</h2>
            </span>
          </CardHeader>
          <CardBody>
            <form onSubmit={changerMdp} className="flex flex-col gap-esp-4">
              <div>
                <Label htmlFor="pf-actuel">Mot de passe actuel</Label>
                <div className="mt-esp-2"><Input id="pf-actuel" type={visible ? 'text' : 'password'} value={mdp.actuel} onChange={(e) => { setMdp((m) => ({ ...m, actuel: e.target.value })); setErreur(''); }} autoComplete="current-password" /></div>
              </div>
              <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pf-nouveau">Nouveau (8+ caractères)</Label>
                  <div className="mt-esp-2"><Input id="pf-nouveau" type={visible ? 'text' : 'password'} value={mdp.nouveau} onChange={(e) => { setMdp((m) => ({ ...m, nouveau: e.target.value })); setErreur(''); }} autoComplete="new-password" /></div>
                </div>
                <div>
                  <Label htmlFor="pf-conf">Confirmation</Label>
                  <div className="mt-esp-2"><Input id="pf-conf" type={visible ? 'text' : 'password'} value={mdp.confirmation} onChange={(e) => { setMdp((m) => ({ ...m, confirmation: e.target.value })); setErreur(''); }} autoComplete="new-password" /></div>
                </div>
              </div>
              {doubleAuth && (
                <div>
                  <Label htmlFor="pf-2fa-mdp">Code 2FA (requis, protection active)</Label>
                  <div className="mt-esp-2"><Input id="pf-2fa-mdp" value={mdp.code} onChange={(e) => { setMdp((m) => ({ ...m, code: e.target.value })); setErreur(''); }} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" /></div>
                  <p className="dg-legende mt-esp-1">Utilisez un code frais : celui saisi à la connexion est déjà consommé, attendez le suivant.</p>
                </div>
              )}
              <button type="button" onClick={() => setVisible((v) => !v)} className="inline-flex min-h-[44px] items-center gap-esp-2 self-start font-courant text-[15px] font-semibold text-digi-texte">
                {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />} {visible ? 'Masquer' : 'Afficher'} les mots de passe
              </button>
              {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
              <div><Button type="submit" disabled={envoiMdp}><Check size={20} aria-hidden="true" /> {envoiMdp ? 'Enregistrement…' : 'Mettre à jour'}</Button></div>
            </form>
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-digi-voile">
                <Smartphone size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Double authentification (2FA)</h2>
              {doubleAuth !== null && (
                <Badge ton={doubleAuth ? 'succes' : 'neutre'}>{doubleAuth ? 'Activée' : 'Désactivée'}</Badge>
              )}
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-4">
            <p className="font-courant text-[15px] text-gris-600">
              Protège la connexion par un code à 6 chiffres (Google Authenticator, Authy…).
              Scannez le QR affiché, puis saisissez le code pour activer.
            </p>
            {erreur2fa && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur2fa}</p>}
            {doubleAuth === false && !qr && (
              <div><Button variante="secondaire" onClick={demarrer2fa}>Activer la 2FA</Button></div>
            )}
            {doubleAuth === false && qr && (
              <form onSubmit={confirmer2fa} className="flex flex-col gap-esp-4">
                <div className="flex flex-col items-center gap-esp-4 sm:flex-row sm:items-start sm:gap-esp-5">
                  <span className="shrink-0 rounded-lg border border-gris-300 bg-gris-0 p-esp-3">
                    <QRCode value={qr.otpauth_url} size={168} aria-label="QR à scanner dans l application authenticator" />
                  </span>
                  <div className="min-w-0 w-full flex-1">
                    <p className="text-center font-courant text-[15px] text-gris-600 sm:text-left">Sans scan possible, saisissez ce secret à la main :</p>
                    <p className="mt-esp-2 break-all rounded-md bg-gris-100 p-esp-3 font-mono text-[13px] text-gris-900">{qr.secret}</p>
                  </div>
                </div>
                <div className="max-w-96">
                  <Label htmlFor="pf-2fa">Code à 6 chiffres</Label>
                  <div className="mt-esp-2"><Input id="pf-2fa" value={code2fa} onChange={(e) => { setCode2fa(e.target.value); setErreur2fa(''); }} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" /></div>
                </div>
                <div><Button type="submit">Vérifier et activer</Button></div>
              </form>
            )}
            {doubleAuth === true && (
              <div><Button variante="fantome" onClick={desactiver2fa}>Désactiver la 2FA</Button></div>
            )}
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-digi-voile">
                <Fingerprint size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Biométrie de cet appareil</h2>
              <Badge ton={passkeys.length > 0 ? 'succes' : 'neutre'}>{passkeys.length > 0 ? 'Activée' : 'Désactivée'}</Badge>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-3">
            <p className="font-courant text-[15px] text-gris-600">
              Empreinte ou visage selon votre appareil, pour se connecter sans mot de passe.
              La biométrie ne quitte jamais l appareil — le mot de passe reste toujours disponible.
            </p>
            {!biometrieSupportee() || bioDispo === false ? (
              <p className="font-courant text-[15px] text-gris-600">Appareil incompatible — connexion par mot de passe conservée.</p>
            ) : (
              <>
                {passkeys.map((p) => (
                  <div key={p.id} className="flex items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
                    <Fingerprint size={20} aria-hidden="true" className="shrink-0 text-digi" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-courant text-[15px] font-semibold text-gris-900">{p.nom}</span>
                      <span className="block font-courant text-[13px] text-gris-600">Ajouté le {dateFr(p.cree_le)}{p.dernier_usage ? ` · utilisé le ${dateFr(p.dernier_usage)}` : ''}</span>
                    </span>
                    <button type="button" onClick={() => retirerBiometrie(p.id)} aria-label={`Retirer ${p.nom}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-erreur hover:bg-erreur-fond">
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div>
                  <Button variante="secondaire" onClick={activerBiometrie} disabled={bioAction || bioDispo === null}>
                    {bioAction ? 'Activation…' : passkeys.length > 0 ? 'Ajouter cet appareil' : 'Activer la biométrie'}
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-digi-voile">
                <BellRing size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Notifications push</h2>
              <Badge ton={pushActif ? 'succes' : 'neutre'}>{pushActif ? 'Activées' : 'Désactivées'}</Badge>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-3">
            <p className="font-courant text-[15px] text-gris-600">
              Relaye bugs, tickets et mails jusque sur votre écran, même hub fermé.
              La cloche in-app reste active dans tous les cas.
            </p>
            {!pushSupporte() ? (
              <p className="font-courant text-[15px] text-gris-600">Navigateur incompatible — sur iPhone, ajoutez le hub à l écran d accueil puis réessayez.</p>
            ) : (
              <div className="flex flex-wrap gap-esp-3">
                <Button variante={pushActif ? 'fantome' : 'secondaire'} onClick={basculerPush} disabled={pushAction}>
                  {pushActif ? 'Désactiver le push' : 'Activer le push'}
                </Button>
                {pushActif && <Button variante="fantome" onClick={envoyerTestPush}>Envoyer un test</Button>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-digi-voile">
                <BellRing size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Préférences de notification</h2>
            </span>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-esp-3 sm:grid-cols-3">
            {[
              ['mail', 'E-mails', 'Factures, tickets, rappels par mail'],
              ['inapp', 'Notifications in-app', 'Pastilles et toasts dans le hub'],
              ['rappels', 'Rappels d échéances', 'Deadlines J-3, SLA, congés J-3'],
            ].map(([k, titre, texte]) => (
              <button
                key={k}
                type="button"
                role="switch"
                aria-checked={prefs[k]}
                onClick={() => basculerPref(k)}
                className="flex items-start gap-esp-3 rounded-lg bg-gris-100 p-esp-4 text-left"
              >
                <span aria-hidden="true" className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-pilule transition-colors duration-rapide ${prefs[k] ? 'bg-digi' : 'bg-gris-300'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-pilule bg-blanc shadow-ombre-1 transition-all duration-rapide ${prefs[k] ? 'left-6' : 'left-1'}`} />
                </span>
                <span>
                  <span className="block font-courant text-[15px] font-semibold text-gris-900">{titre}</span>
                  <span className="block font-courant text-[14px] text-gris-600">{texte}</span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
