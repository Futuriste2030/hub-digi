import Logo from './Logo.jsx';

/* Splash de lancement + transition post-login : fond marine, logo, anneau, message.
   compact=true : version légère pour les Suspense (chargements de chunks). */

export default function ChargementPage({ message = 'Chargement de votre espace…', compact = false }) {
  if (compact) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Chargement">
        <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-pilule border-2 border-gris-300 border-t-digi" />
        <span className="sr-only">{message}</span>
      </div>
    );
  }
  return (
    <div className="dg-fond-marine relative flex min-h-screen flex-col items-center justify-center px-esp-5" role="status" aria-label="Chargement">
      <div className="dg-motif-pixels absolute inset-0" aria-hidden="true" />
      <div className="dg-entree relative flex flex-col items-center text-center">
        <Logo hauteur={64} />
        <p className="mt-esp-4 font-titrage text-[18px] font-extrabold tracking-[0.08em] text-blanc">HUB DIGI</p>
        <span aria-hidden="true" className="mt-esp-5 h-12 w-12 animate-spin rounded-pilule border-[3px] border-marine-clair border-t-digi-signal" />
        <p className="mt-esp-4 font-courant text-[15px] text-digi-brume">{message}</p>
      </div>
    </div>
  );
}
