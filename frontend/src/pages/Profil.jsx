import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserRound, ShieldCheck, BellRing, Eye, EyeOff, Check, Smartphone } from 'lucide-react';
import QRCode from 'react-qr-code';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { LIBELLES_ROLE } from '../data/session.js';
import { api, messageErreur } from '../api/client.js';
import { changerMotDePasse } from '../api/auth.js';

/* Mon profil — infos session, sécurité réelle (POST /auth/password/change/), 2FA, préférences. */

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
                <div className="flex flex-wrap items-start gap-esp-5">
                  <span className="rounded-lg border border-gris-300 bg-gris-0 p-esp-3">
                    <QRCode value={qr.otpauth_url} size={180} aria-label="QR à scanner dans l application authenticator" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-courant text-[15px] text-gris-600">Sans scan possible, saisissez ce secret à la main :</p>
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
