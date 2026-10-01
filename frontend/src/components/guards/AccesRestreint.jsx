import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from '../ui/Button.jsx';

/* Page refusable — garde-fou frontend quand un rôle ouvre une URL hors périmètre.
   Props : { titre, requis, retour } + onDemander (toast mocké).
   BACKEND : guard RequireRole (JWT) + 403 DRF, seule vraie sécurité. */

export default function AccesRestreint({ titre = 'Accès non autorisé', requis = '', retour = '/', onDemander }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-esp-5 py-esp-9 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-pilule bg-erreur-fond text-erreur">
        <ShieldAlert size={32} aria-hidden="true" />
      </span>
      <h1 className="mt-esp-4 !text-[26px]">{titre}</h1>
      <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
        {requis || 'Votre rôle ne donne pas accès à cette page.'}
      </p>
      <div className="mt-esp-5 flex flex-wrap justify-center gap-esp-3">
        {onDemander && (
          <Button variante="secondaire" onClick={onDemander}>Demander l accès</Button>
        )}
        <Link to={retour} className="inline-flex min-h-[44px] items-center rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
