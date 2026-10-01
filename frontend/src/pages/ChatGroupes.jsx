import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Hash, Plus, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { messageErreur } from '../api/client.js';
import { creerGroupe, listerGroupes, supprimerGroupe } from '../api/centre.js';
import { listerUsersMini } from '../api/ressources.js';

/* Paramètres > Chat — Super Admin : groupe général + sous-groupes façon Slack. */

export default function ChatGroupes() {
  const { notifier } = useOutletContext();
  const [groupes, setGroupes] = useState([]);
  const [users, setUsers] = useState([]);
  const [modale, setModale] = useState(false);
  const [nom, setNom] = useState('');
  const [general, setGeneral] = useState(false);
  const [tous, setTous] = useState(false);
  const [choisis, setChoisis] = useState([]);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      const [gs, us] = await Promise.all([listerGroupes(), listerUsersMini().catch(() => [])]);
      setGroupes(gs);
      setUsers(us);
    } catch (e) {
      notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    }
  };

  useEffect(() => { charger(); }, []);

  const basculerMembre = (id) => {
    setChoisis((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const ouvrirModale = () => {
    setNom('');
    setGeneral(false);
    setTous(false);
    setChoisis([]);
    setErreur('');
    setModale(true);
  };

  const creer = async (e) => {
    e.preventDefault();
    if (nom.trim().length < 2) {
      setErreur('Donnez un nom de groupe d au moins 2 caractères.');
      return;
    }
    if (!general && !tous && choisis.length === 0) {
      setErreur('Choisissez au moins un membre, ou cochez « Tout le monde » / « Groupe général ».');
      return;
    }
    setEnvoi(true);
    try {
      const g = await creerGroupe({ nom: nom.trim(), general, tous: tous && !general, membres: choisis });
      setModale(false);
      notifier({ type: 'succes', titre: 'Groupe créé', texte: `# ${g.nom} — visible dans le Chat.` });
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Création impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (g) => {
    try {
      await supprimerGroupe(g.id);
      notifier({ type: 'succes', titre: 'Groupe supprimé', texte: `# ${g.nom} — historique effacé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <Link to="/parametres" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Paramètres
      </Link>
      <div className="mt-esp-2 flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Système · Super Admin</p>
          <h1 className="mt-esp-2">Chat — groupes</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Un groupe général (tout le monde) + des sous-groupes par équipe ou sujet. Seuls les membres voient et écrivent.
          </p>
        </div>
        <Button onClick={ouvrirModale}>
          <Plus size={20} aria-hidden="true" /> Nouveau groupe
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {groupes.map((g) => (
          <Card key={g.id} survol={false}>
            <CardBody className="pt-esp-5">
              <div className="flex items-start justify-between gap-esp-3">
                <span className="flex min-w-0 items-center gap-esp-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-marine-profond">
                    <Hash size={20} aria-hidden="true" className="text-blanc" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-titrage text-[18px] font-bold text-gris-900"># {g.nom}</span>
                    <span className="block truncate font-courant text-[14px] text-gris-600">
                      {g.general ? 'Tout le monde (général)' : `${g.membres?.length ?? 0} membre${(g.membres?.length ?? 0) > 1 ? 's' : ''}`}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-esp-1">
                  {g.general && <Badge ton="info">Général</Badge>}
                  <BoutonSupprimer
                    titre={`Supprimer # ${g.nom}`}
                    libelle={g.nom}
                    texte="Supprimer définitivement le groupe et son historique"
                    onConfirmer={() => supprimer(g)}
                  />
                </span>
              </div>
              {!g.general && g.membres_emails?.length > 0 && (
                <p className="mt-esp-2 truncate font-mono text-[13px] text-gris-600">{g.membres_emails.join(', ')}</p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      {groupes.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">
          Aucun groupe. Créez d abord un groupe général « Général », puis des sous-groupes (Dév, Com, Finance…).
        </p>
      )}

      {modale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau groupe">
          <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={() => !envoi && setModale(false)} />
          <form onSubmit={creer} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
            <div className="flex items-start justify-between gap-esp-3">
              <div>
                <p className="dg-surtitre">Chat · Groupe</p>
                <h2 className="!text-[26px]">Nouveau groupe</h2>
              </div>
              <button type="button" onClick={() => setModale(false)} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-esp-5 flex flex-col gap-esp-4">
              <div>
                <Label htmlFor="cg-nom">Nom du groupe *</Label>
                <div className="mt-esp-2"><Input id="cg-nom" autoFocus value={nom} onChange={(e) => { setNom(e.target.value); setErreur(''); }} placeholder="Ex. Général, Dév, Com" /></div>
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md border border-gris-300 bg-gris-100 px-esp-4">
                <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} className="h-5 w-5 accent-[#0a3d91]" />
                <span className="font-courant text-[15px] font-semibold text-gris-900">Groupe général <span className="font-normal text-gris-600">— tout le monde, sans choisir les membres</span></span>
              </label>
              {!general && (
                <>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md border border-gris-300 bg-gris-100 px-esp-4">
                    <input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} className="h-5 w-5 accent-[#0a3d91]" />
                    <span className="font-courant text-[15px] font-semibold text-gris-900">Tout le monde <span className="font-normal text-gris-600">— ajoute tous les comptes internes</span></span>
                  </label>
                  {!tous && (
                    <div>
                      <p className="font-courant text-[15px] font-semibold text-gris-700">Membres *</p>
                      <div className="mt-esp-2 flex max-h-56 flex-col gap-esp-1 overflow-y-auto rounded-md border border-gris-300 p-esp-2">
                        {users.map((u) => (
                          <label key={u.id} className="flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md px-esp-2 hover:bg-gris-100">
                            <input type="checkbox" checked={choisis.includes(u.id)} onChange={() => basculerMembre(u.id)} className="h-5 w-5 accent-[#0a3d91]" />
                            <span className="min-w-0 font-courant text-[15px] text-gris-700">
                              <span className="block truncate font-semibold text-gris-900">{u.email}</span>
                              <span className="block truncate text-gris-600">{[u.first_name, u.last_name].filter(Boolean).join(' ')}{u.poste_titre ? ` — ${u.poste_titre}` : ''}</span>
                            </span>
                          </label>
                        ))}
                        {users.length === 0 && <p className="p-esp-2 font-courant text-[14px] text-gris-600">Aucun compte interne.</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
              {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
            </div>
            <div className="mt-esp-6 flex justify-end gap-esp-3">
              <Button variante="fantome" onClick={() => setModale(false)}>Annuler</Button>
              <Button type="submit" chargement={envoi}><Plus size={20} aria-hidden="true" /> Créer</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
