import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import Toasts from '../Toasts.jsx';
import GardeErreur from '../GardeErreur.jsx';
import ChargementPage from '../ChargementPage.jsx';
import { useAuth, useSession } from '../../store/auth.js';
import { chargerEntreprise } from '../../data/parametres.js';
import { api } from '../../api/client.js';
import { statutPointage } from '../../api/ressources.js';

/* Coquille logicielle : sidebar marine rétractable + colonne (topbar, contenu, pied fin).
   Fournit aux pages : recherche globale, notifications toast. Session réelle (JWT). */
/* Fermée par défaut : on ne déplie que si l'utilisateur l'a explicitement demandé. */
function lirePreference() {
  try {
    return window.localStorage.getItem('hubdigi-sidebar') !== 'pleine';
  } catch {
    return true;
  }
}

export default function AppLayout() {
  const [mobileOuvert, setMobileOuvert] = useState(false);
  const [retractee, setRetractee] = useState(lirePreference);
  const [query, setQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const idToast = useRef(0);
  const access = useAuth((s) => s.access);
  const restaurer = useAuth((s) => s.restaurer);
  const session = useSession();
  const localisation = useLocation();
  const [pret, setPret] = useState(false);
  /* Garde pointage obligatoire : arrivée non pointée le matin -> forcé sur /pointage.
     Bloque le retour navigateur (token persisté) + les clics sidebar qui échappaient
     à l'écran post-login (qui ne tournait qu'au login). Départ = non bloquant. */
  const [pointageBloquant, setPointageBloquant] = useState(null);
  /* Statut API réel (prod) : ping au chargement puis toutes les 60 s.
     null = vérification en cours, true = joignable, false = injoignable. */
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    restaurer().finally(() => setPret(true));
    chargerEntreprise();
  }, [restaurer]);

  /* Revérifié à chaque navigation : couvre reopen navigateur + évasion par sidebar.
     Fail-open si API indisponible (comme au login). Clients exclus (pas de fiche employé). */
  useEffect(() => {
    if (!pret || !session) return;
    if (session.role === 'client') {
      setPointageBloquant(false);
      return;
    }
    let actif = true;
    statutPointage()
      .then((s) => {
        if (actif) setPointageBloquant(s?.doit_pointer === true && s?.type_attendu === 'arrivee');
      })
      .catch(() => {
        if (actif) setPointageBloquant(false);
      });
    return () => { actif = false; };
  }, [pret, session, localisation.pathname]);

  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      try {
        await api.get('/settings/entreprise/', { timeout: 8000 });
        if (actif) setApiOk(true);
      } catch {
        if (actif) setApiOk(false);
      }
    };
    verifier();
    const minuteur = setInterval(verifier, 60000);
    return () => { actif = false; clearInterval(minuteur); };
  }, []);

  /* Login required : sans JWT, retour au login. Splash pendant la restauration. */
  if (!access) {
    return <Navigate to="/login" replace />;
  }
  if (!pret || !session) {
    return <ChargementPage message="Chargement de votre espace…" />;
  }
  /* Arrivée due le matin : toute route interne rebondit sur /pointage (sauf /pointage lui-même). */
  if (pointageBloquant === null) {
    return <ChargementPage message="Vérification du pointage…" />;
  }
  if (pointageBloquant && localisation.pathname !== '/pointage') {
    return <Navigate to="/pointage" replace />;
  }

  const basculerRetractee = () => {
    setRetractee((prev) => {
      try {
        window.localStorage.setItem('hubdigi-sidebar', prev ? 'pleine' : 'retractee');
      } catch {
        /* stockage indisponible, on garde l'état mémoire */
      }
      return !prev;
    });
  };

  const notifier = (t) => {
    idToast.current += 1;
    const id = idToast.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  };

  return (
    <div className="flex min-h-screen bg-gris-100">
      <Sidebar mobileOuvert={mobileOuvert} fermer={() => setMobileOuvert(false)} retractee={retractee} session={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          ouvrirMenu={() => setMobileOuvert(true)}
          basculerSidebar={basculerRetractee}
          retractee={retractee}
          query={query}
          setQuery={setQuery}
          notifier={notifier}
          session={session}
        />
        <main className="mx-auto w-full max-w-grille flex-1 px-esp-5 py-esp-6">
          <div key={localisation.pathname} className="dg-entree">
            <GardeErreur key={localisation.pathname}>
              <Outlet context={{ query, setQuery, notifier, session }} />
            </GardeErreur>
          </div>
        </main>
        <footer className="bg-marine-footer">
          <div className="mx-auto flex max-w-grille flex-wrap items-center gap-esp-2 px-esp-5 py-esp-3">
            <p className="font-courant text-[13px] text-digi-brume">
              Digi Com et Technologies — HUB DIGI · v1.0 · 2026
            </p>
            <p className="ml-auto flex items-center gap-esp-2 font-courant text-[13px] text-digi-brume">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-pilule ${apiOk === false ? 'bg-erreur' : apiOk === true ? 'bg-succes-lumineux' : 'bg-gris-400'}`}
              />
              {apiOk === null ? 'Vérification…' : apiOk ? 'Système opérationnel' : 'Connexion interrompue'}
            </p>
          </div>
        </footer>
      </div>
      <Toasts toasts={toasts} fermer={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
