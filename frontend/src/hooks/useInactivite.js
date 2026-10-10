import { useCallback, useEffect, useRef, useState } from 'react';

/* Déconnexion automatique après inactivité — 15 min, préavis 2 min.
   Seuls les gestes utilisateur comptent (pas les appels API en tâche de fond).
   Horodatage partagé en localStorage : l'activité dans un onglet garde
   les autres onglets en vie. */

export const DELAI_INACTIVITE_MS = 15 * 60 * 1000;
export const PREAVIS_MS = 2 * 60 * 1000;
export const CLE_ACTIVITE = 'hubdigi-derniere-activite';
export const CLE_EXPIRATION = 'hubdigi-inactivite';

const lire = () => {
  try {
    return Number(window.localStorage.getItem(CLE_ACTIVITE)) || 0;
  } catch {
    return 0;
  }
};

const ecrire = (t) => {
  try {
    window.localStorage.setItem(CLE_ACTIVITE, String(t));
  } catch {
    /* stockage indisponible */
  }
};

const EVENEMENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];

export default function useInactivite({ actif, onExpirer }) {
  const [enPreavis, setEnPreavis] = useState(false);
  const [secondesRestantes, setSecondesRestantes] = useState(DELAI_INACTIVITE_MS / 1000);
  const onExpirerRef = useRef(onExpirer);
  useEffect(() => {
    onExpirerRef.current = onExpirer;
  }, [onExpirer]);
  const expireRef = useRef(false);
  const dernierEcritRef = useRef(0);

  /* Throttle : au plus une écriture toutes les 5 s (les mousemove pleuvent). */
  const toucher = useCallback(() => {
    const maintenant = Date.now();
    if (maintenant - dernierEcritRef.current < 5000) return;
    dernierEcritRef.current = maintenant;
    ecrire(maintenant);
    setEnPreavis(false);
  }, []);

  const prolonger = useCallback(() => {
    const maintenant = Date.now();
    dernierEcritRef.current = maintenant;
    ecrire(maintenant);
    expireRef.current = false;
    setEnPreavis(false);
    setSecondesRestantes(DELAI_INACTIVITE_MS / 1000);
  }, []);

  useEffect(() => {
    if (!actif) return;
    if (!lire()) {
      const maintenant = Date.now();
      dernierEcritRef.current = maintenant;
      ecrire(maintenant);
    }
    EVENEMENTS.forEach((e) => window.addEventListener(e, toucher, { passive: true }));
    const surStockage = (e) => {
      if (e.key === CLE_ACTIVITE) setEnPreavis(false);
    };
    window.addEventListener('storage', surStockage);
    const minuteur = setInterval(() => {
      const restant = DELAI_INACTIVITE_MS - (Date.now() - lire());
      if (restant <= 0) {
        if (!expireRef.current) {
          expireRef.current = true;
          onExpirerRef.current?.();
        }
        return;
      }
      setSecondesRestantes(Math.ceil(restant / 1000));
      setEnPreavis(restant <= PREAVIS_MS);
    }, 1000);
    return () => {
      EVENEMENTS.forEach((e) => window.removeEventListener(e, toucher));
      window.removeEventListener('storage', surStockage);
      clearInterval(minuteur);
    };
  }, [actif, toucher]);

  return { enPreavis, secondesRestantes, prolonger };
}
