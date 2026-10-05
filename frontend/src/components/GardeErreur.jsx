import { Component } from 'react';

/* Garde-fous anti écran blanc : toute erreur de rendu d'une page affiche
   un message + bouton Recharger au lieu d'une page vide. */

export default class GardeErreur extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, infos) {
    // eslint-disable-next-line no-console
    console.error('[HUBDIGI] Erreur de rendu :', erreur, infos?.componentStack);
  }

  render() {
    if (this.state.erreur) {
      return (
        <div className="mx-auto max-w-[560px] py-esp-6 text-center">
          <p className="dg-surtitre">HUB DIGI</p>
          <h1 className="mt-esp-2">Affichage impossible</h1>
          <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
            Une erreur inattendue a interrompu cette page. Rechargez pour réessayer ;
            si elle persiste, signalez-la au support avec une capture de la console (F12).
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-esp-4 inline-flex min-h-[44px] items-center rounded-md bg-marine-profond px-esp-5 font-courant text-[15px] font-semibold text-blanc"
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
