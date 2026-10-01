import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Lock } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import Logo from '../components/Logo.jsx';
import { confirmerReset } from '../api/auth.js';
import { messageErreur } from '../api/client.js';

/* Nouveau mot de passe via le lien reçu par mail (/reset-password/:uid/:token). */

export default function ResetPassword() {
  const { uid, token } = useParams();
  const [mdp, setMdp] = useState({ nouveau: '', confirmation: '' });
  const [erreur, setErreur] = useState('');
  const [ok, setOk] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    if (mdp.nouveau.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (mdp.nouveau !== mdp.confirmation) {
      setErreur('La confirmation ne correspond pas.');
      return;
    }
    if (envoi) return;
    setEnvoi(true);
    try {
      await confirmerReset({ uid, token, newPassword: mdp.nouveau });
      setOk(true);
    } catch (err) {
      setErreur(messageErreur(err, 'Lien invalide ou expiré. Redemandez un lien.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="dg-fond-marine relative flex min-h-screen items-center justify-center px-esp-5 py-esp-7">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative w-full max-w-[480px]">
        <div className="flex flex-col items-center text-center">
          <Logo hauteur={56} />
          <p className="dg-surtitre dg-surtitre-sur-marine mt-esp-4">Hub de gestion</p>
        </div>
        <div className="mt-esp-5 rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
          <div className="flex items-center gap-esp-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-digi-voile">
              <Lock size={20} aria-hidden="true" className="text-digi" />
            </span>
            <div>
              <p className="dg-surtitre">Accès sécurisé</p>
              <h1 className="mt-esp-1 !text-[26px]">Nouveau mot de passe</h1>
            </div>
          </div>
          {ok ? (
            <div className="flex flex-col items-center py-esp-6 text-center">
              <CircleCheck size={32} aria-hidden="true" className="text-succes" />
              <p className="mt-esp-3 font-titrage text-[21px] font-bold text-gris-900">Mot de passe défini</p>
              <p className="mt-esp-2 font-courant text-[15px] text-gris-600">Connectez-vous avec votre nouveau mot de passe.</p>
              <Link to="/login" className="mt-esp-5 inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">Se connecter</Link>
            </div>
          ) : (
            <form onSubmit={soumettre} className="mt-esp-5 flex flex-col gap-esp-4">
              <div>
                <Label htmlFor="reset-nouveau">Nouveau mot de passe (8+ caractères)</Label>
                <div className="mt-esp-2"><Input id="reset-nouveau" type="password" value={mdp.nouveau} onChange={(e) => { setMdp((m) => ({ ...m, nouveau: e.target.value })); setErreur(''); }} autoComplete="new-password" /></div>
              </div>
              <div>
                <Label htmlFor="reset-conf">Confirmation</Label>
                <div className="mt-esp-2"><Input id="reset-conf" type="password" value={mdp.confirmation} onChange={(e) => { setMdp((m) => ({ ...m, confirmation: e.target.value })); setErreur(''); }} autoComplete="new-password" /></div>
              </div>
              {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
              <Button type="submit" taille="lg" className="w-full" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Définir le mot de passe'}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
