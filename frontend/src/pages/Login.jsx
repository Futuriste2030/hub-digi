import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X, CircleCheck, Lock } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import Logo from '../components/Logo.jsx';
import { useAuth, userVersSession } from '../store/auth.js';
import { listerClients } from '../api/clients.js';
import { urlEspace, urlTableauDeBord } from '../lib/acces.js';
import { demanderReset } from '../api/auth.js';
import { messageErreur } from '../api/client.js';

/* Connexion réelle : JWT Django. Si la 2FA est active, second écran pour le code. */

const MODES = {
  reset: {
    surtitre: 'Accès au hub',
    titre: 'Mot de passe oublié',
    texte: 'Indiquez votre adresse pro. Nous envoyons un lien de réinitialisation valable 1 heure.',
    submit: 'Envoyer le lien',
    succesTitre: 'Lien envoyé',
    succesTexte: 'Vérifiez votre boîte mail, puis suivez le lien pour définir un nouveau mot de passe.',
  },
  support: {
    surtitre: 'Assistance',
    titre: 'Contacter le support',
    texte: 'Décrivez votre besoin. Le secrétariat qualifie chaque demande sous 24 heures ouvrées.',
    submit: 'Transmettre au support',
    succesTitre: 'Demande transmise',
    succesTexte: 'Le secrétariat accuse réception par e-mail avec une référence de suivi.',
  },
  probleme: {
    surtitre: 'Assistance',
    titre: 'Signaler un problème',
    texte: 'Décrivez ce qui bloque, avec les étapes pour reproduire. L équipe Dév prend le relais.',
    submit: 'Signaler le problème',
    succesTitre: 'Problème enregistré',
    succesTexte: 'Merci, votre signalement rejoint la file de qualification avec un numéro unique.',
  },
};

function ModaleAssistance({ mode, onFermer }) {
  const config = MODES[mode];
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ nom: '', email: '', sujet: 'Accès au hub', message: '' });

  useEffect(() => {
    const touche = (e) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });

  const soumettre = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErreur('Envoi impossible. Vérifier l\u2019adresse e-mail, puis relancer l\u2019envoi.');
      return;
    }
    if (mode !== 'reset' && form.message.trim().length < 10) {
      setErreur('Décrivez la demande en au moins 10 caractères pour un traitement rapide.');
      return;
    }
    if (mode === 'reset') {
      /* Reset réel : le backend envoie le mail avec lien (POST /auth/password/reset/). */
      if (envoi) return;
      setEnvoi(true);
      try {
        await demanderReset(form.email.trim());
        setEnvoye(true);
      } catch (err) {
        setErreur(messageErreur(err, 'Envoi impossible. Réessayez.'));
      } finally {
        setEnvoi(false);
      }
      return;
    }
    setEnvoye(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={config.titre}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <div className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">{config.surtitre}</p>
            <h2 className="mt-esp-2 !text-[26px]">{config.titre}</h2>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {envoye ? (
          <div className="flex flex-col items-center py-esp-6 text-center">
            <CircleCheck size={32} aria-hidden="true" className="text-succes" />
            <p className="mt-esp-3 font-titrage text-[21px] font-bold text-gris-900">{config.succesTitre}</p>
            <p className="mt-esp-2 max-w-[40ch] font-courant text-[15px] text-gris-600">{config.succesTexte}</p>
            <Button variante="secondaire" className="mt-esp-5" onClick={onFermer}>Fermer</Button>
          </div>
        ) : (
          <form onSubmit={soumettre} className="mt-esp-5 flex flex-col gap-esp-4">
            <p className="font-courant text-[15px] text-gris-600">{config.texte}</p>
            {mode !== 'reset' && (
              <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`am-nom-${mode}`}>Nom complet</Label>
                  <div className="mt-esp-2"><Input id={`am-nom-${mode}`} {...champ('nom')} placeholder="Ex. Awa Diallo" /></div>
                </div>
                <div>
                  <Label htmlFor={`am-sujet-${mode}`}>Sujet</Label>
                  <select
                    id={`am-sujet-${mode}`}
                    value={form.sujet}
                    onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))}
                    className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi"
                  >
                    {mode === 'support'
                      ? ['Accès au hub', 'Facturation', 'Projet en cours', 'Autre'].map((s) => <option key={s}>{s}</option>)
                      : ['Affichage', 'Connexion', 'Lenteur', 'Données', 'Autre'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor={`am-email-${mode}`}>Adresse e-mail pro</Label>
              <div className="mt-esp-2"><Input id={`am-email-${mode}`} type="email" {...champ('email')} placeholder="prenom.nom@digicom.ml" /></div>
            </div>
            {mode !== 'reset' && (
              <div>
                <Label htmlFor={`am-msg-${mode}`}>Message</Label>
                <div className="mt-esp-2"><Textarea id={`am-msg-${mode}`} {...champ('message')} placeholder="Décrivez la situation" rows={5} /></div>
              </div>
            )}
            {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
            <div className="flex justify-end gap-esp-3">
              <Button variante="fantome" onClick={onFermer}>Annuler</Button>
              <Button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : config.submit}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const naviguer = useNavigate();
  const login = useAuth((s) => s.login);
  const verifierOtp = useAuth((s) => s.verifierOtp);
  const chargement = useAuth((s) => s.chargement);
  const erreurAuth = useAuth((s) => s.erreur);
  const otpTemp = useAuth((s) => s.otpTemp);
  const access = useAuth((s) => s.access);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [visible, setVisible] = useState(false);
  const [souvenir, setSouvenir] = useState(true);
  const [modale, setModale] = useState(null);

  const allerAccueil = async (sess) => {
    if (sess?.role === 'client') {
      try {
        const cls = await listerClients();
        const liste = cls.results ?? cls;
        const moi = liste.find((c) => c.id === sess.clientId) ?? liste[0];
        naviguer(moi ? urlEspace(moi) : '/espace');
      } catch {
        naviguer('/espace');
      }
      return;
    }
    naviguer(urlTableauDeBord(sess));
  };

  const connecter = async (e) => {
    e.preventDefault();
    const { otpRequis, erreur } = await login(email.trim(), motDePasse);
    if (erreur) return;
    if (!otpRequis) allerAccueil(userVersSession(useAuth.getState().user));
  };

  const validerCode = async (e) => {
    e.preventDefault();
    const { erreur } = await verifierOtp(code.trim());
    if (!erreur) allerAccueil(userVersSession(useAuth.getState().user));
  };

  if (access && !otpTemp) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center overflow-hidden px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[480px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Hub de gestion</p>
          <p className="mt-esp-2 font-courant text-[15px] text-digi-brume">
            Digi Com et Technologies — un seul hub pour vos projets
          </p>
        </div>

        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          <div className="flex items-center gap-esp-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-digi-voile">
              <Lock size={20} aria-hidden="true" className="text-digi" />
            </span>
            <div>
              <p className="dg-surtitre">Accès sécurisé</p>
              <h1 className="mt-esp-1 !text-[26px]">Connexion</h1>
            </div>
          </div>

          {otpTemp ? (
          <form onSubmit={validerCode} className="mt-esp-5 flex flex-col gap-esp-4">
            <p className="font-courant text-[15px] text-gris-600">
              Votre compte est protégé par la double authentification. Saisissez le code de votre application authenticator.
            </p>
            <div>
              <Label htmlFor="login-otp">Code 2FA</Label>
              <div className="mt-esp-2">
                <Input id="login-otp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" autoFocus />
              </div>
            </div>
            {erreurAuth && <p role="alert" className="font-courant text-[15px] text-erreur">{erreurAuth}</p>}
            <Button type="submit" taille="lg" className="w-full" disabled={chargement}>Vérifier</Button>
          </form>
          ) : (
          <form onSubmit={connecter} className="mt-esp-5 flex flex-col gap-esp-4">
            <div>
              <Label htmlFor="login-email">Identifiant ou e-mail pro</Label>
              <div className="mt-esp-2">
                <Input id="login-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex. moussa.kone ou prenom.nom@digicom.ml" autoComplete="username" />
              </div>
            </div>
            <div>
              <Label htmlFor="login-mdp">Mot de passe</Label>
              <div className="relative mt-esp-2">
                <Input
                  id="login-mdp"
                  type={visible ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={visible}
                  className="absolute right-esp-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-md text-gris-500 hover:text-gris-700"
                >
                  {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-esp-3">
              <button
                type="button"
                role="switch"
                aria-checked={souvenir}
                aria-label="Rester connecté"
                onClick={() => setSouvenir((v) => !v)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-esp-2 font-courant text-[15px] text-gris-700"
              >
                <span
                  aria-hidden="true"
                  className={`relative h-7 w-12 shrink-0 rounded-pilule transition-colors duration-rapide ${souvenir ? 'bg-digi' : 'bg-gris-300'}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-pilule bg-blanc shadow-ombre-1 transition-all duration-rapide ${souvenir ? 'left-6' : 'left-1'}`}
                  />
                </span>
                Rester connecté
              </button>
              <button
                type="button"
                onClick={() => setModale('reset')}
                className="min-h-[44px] font-courant text-[15px] font-semibold text-digi-texte hover:underline"
              >
                Mot de passe oublié
              </button>
            </div>
            <Button type="submit" taille="lg" className="w-full" disabled={chargement}>
              {chargement ? 'Connexion…' : 'Se connecter'}
            </Button>
            {erreurAuth && <p role="alert" className="font-courant text-[15px] text-erreur">{erreurAuth}</p>}
          </form>
          )}

          <div className="mt-esp-4 rounded-lg bg-digi-voile p-esp-4 text-center">
            <p className="font-courant text-[15px] text-gris-700">Vous êtes client ? Connectez-vous avec vos identifiants, votre portail s'ouvre automatiquement.</p>
          </div>

          <div className="mt-esp-5 flex items-center justify-center gap-esp-2 border-t border-gris-200 pt-esp-4">
            <button
              type="button"
              onClick={() => setModale('support')}
              className="min-h-[44px] px-esp-2 font-courant text-[15px] font-semibold text-digi-texte hover:underline"
            >
              Contacter le support
            </button>
            <span aria-hidden="true" className="h-4 w-px bg-gris-300" />
            <button
              type="button"
              onClick={() => setModale('probleme')}
              className="min-h-[44px] px-esp-2 font-courant text-[15px] font-semibold text-digi-texte hover:underline"
            >
              Signaler un problème
            </button>
          </div>
        </div>

        <p className="mt-esp-4 text-center font-courant text-[13px] text-digi-brume">
          Digi Com et Technologies — HUB DIGI · v1.0 · 2026
        </p>
      </div>

      {modale && <ModaleAssistance mode={modale} onFermer={() => setModale(null)} />}
    </div>
  );
}
