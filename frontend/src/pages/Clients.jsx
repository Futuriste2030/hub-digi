import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Search, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { INTERNES, ROLES_ADMIN, ROLES_CREATION_CLIENT, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients, supprimerClient } from '../api/clients.js';
import { messageErreur } from '../api/client.js';

/* Liste des clients — API réelle, ouvre la Fiche 360° au clic. */

const STATUT_LABEL = { prospect: 'Prospect', client: 'Client' };
const STATUT_TON = { prospect: 'alerte', client: 'succes' };

export default function Clients() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const naviguer = useNavigate();

  const charger = async (q = '') => {
    try {
      setChargement(true);
      const data = await listerClients({ search: q.trim() });
      setClients(data.results ?? []);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des clients impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    let actif = true;
    const minuteur = setTimeout(async () => {
      if (!actif) return;
      await charger(recherche);
    }, 250);
    return () => { actif = false; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const supprimer = async (c) => {
    try {
      await supprimerClient(c.id);
      notifier({ type: 'succes', titre: 'Client supprimé', texte: `${c.nom_societe} — fiche effacée.` });
      charger(recherche);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ROLES_ADMIN);

  if (!peutVoir(session, INTERNES)) {
    return (
      <AccesRestreint
        titre="Clients réservés"
        requis="Seuls les membres internes suivent les clients."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Fiche client 360°</p>
          <h1 className="mt-esp-2">Clients</h1>
        </div>
        {peutVoir(session, ROLES_CREATION_CLIENT) && (
        <Button onClick={() => naviguer('/clients/nouveau')}>
          <Plus size={20} aria-hidden="true" /> Nouveau client
        </Button>
        )}
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un client…"
          aria-label="Rechercher un client"
          className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
        />
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Société', 'Projets', 'Impayés', 'Tickets', 'Statut', ''].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-gris-200 transition-colors duration-rapide last:border-0 hover:bg-gris-100" onClick={() => naviguer(`/clients/${c.id}`)}>
                  <td className="px-esp-3 py-esp-3">
                    <span className="block font-courant text-[17px] font-semibold text-gris-900">{c.nom_societe}</span>
                    <span className="block font-courant text-[15px] text-gris-600">{c.contact}{c.email ? ` · ${c.email}` : ''}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{c.projets_count ?? 0}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{c.factures_impayees ?? 0}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{c.tickets_ouverts ?? 0}</td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{STATUT_LABEL[c.statut] ?? c.statut}</Badge>{c.est_interne && <span className="ml-esp-2"><Badge ton="info">Interne</Badge></span>}</td>
                  <td className="px-esp-3 py-esp-3 text-right">
                    <span className="inline-flex items-center gap-esp-1" onClick={(e) => e.stopPropagation()}>
                      {peutSupprimer && (
                        <BoutonSupprimer
                          titre={`Supprimer ${c.nom_societe}`}
                          libelle={c.nom_societe}
                          texte="Supprimer définitivement le client"
                          onConfirmer={() => supprimer(c)}
                        />
                      )}
                      <Link to={`/clients/${c.id}`} aria-label={`Ouvrir ${c.nom_societe}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <ArrowRight size={20} aria-hidden="true" />
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && clients.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">
              Aucun client trouvé. Vérifiez l orthographe, puis relancez la recherche.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
