import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Search, ArrowRight, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { creerFournisseur, listerFournisseurs, supprimerFournisseur } from '../api/fournisseurs.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Fournisseurs — miroir achats des Clients, périmètre Finance (SPEC §5.7 étendu). */

const STATUT_LABEL = { actif: 'Actif', inactif: 'Inactif', prospect: 'Prospect' };
const STATUT_TON = { actif: 'succes', inactif: 'neutre', prospect: 'alerte' };

function ModaleFournisseur({ onFermer, onCreer }) {
  const [form, setForm] = useState({ nom_societe: '', categorie: '', contact: '', email: '', phone: '' });
  const [erreur, setErreur] = useState('');
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErreur(''); },
  });

  const soumettre = (e) => {
    e.preventDefault();
    if (form.nom_societe.trim().length < 2) {
      setErreur('Nom de société requis (2 caractères minimum).');
      return;
    }
    onCreer({ ...form, nom_societe: form.nom_societe.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau fournisseur">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[520px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Achats</p>
            <h2 className="!text-[26px]">Nouveau fournisseur</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="fo-nom">Société</Label>
            <div className="mt-esp-2"><Input id="fo-nom" autoFocus {...champ('nom_societe')} placeholder="Ex. Imprimerie Sud" /></div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fo-cat">Catégorie</Label>
              <div className="mt-esp-2"><Input id="fo-cat" {...champ('categorie')} placeholder="Imprimerie, Hébergement…" /></div>
            </div>
            <div>
              <Label htmlFor="fo-contact">Contact</Label>
              <div className="mt-esp-2"><Input id="fo-contact" {...champ('contact')} placeholder="Nom du contact" /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fo-email">E-mail</Label>
              <div className="mt-esp-2"><Input id="fo-email" type="email" {...champ('email')} placeholder="contact@fournisseur.ml" /></div>
            </div>
            <div>
              <Label htmlFor="fo-phone">Téléphone</Label>
              <div className="mt-esp-2"><Input id="fo-phone" {...champ('phone')} placeholder="+223 …" /></div>
            </div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer</Button>
        </div>
      </form>
    </div>
  );
}

export default function Fournisseurs() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [items, setItems] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [modale, setModale] = useState(false);
  const naviguer = useNavigate();

  const charger = async (q = '') => {
    try {
      setChargement(true);
      const data = await listerFournisseurs({ search: q.trim() });
      setItems(data);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des fournisseurs impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    let actif = true;
    const minuteur = setTimeout(async () => { if (actif) await charger(recherche); }, 250);
    return () => { actif = false; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const creer = async (payload) => {
    try {
      const f = await creerFournisseur(payload);
      setModale(false);
      notifier({ type: 'succes', titre: 'Fournisseur créé', texte: `${f.nom_societe} — fiche ouverte.` });
      naviguer(`/finance/fournisseurs/${f.id}`);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (f) => {
    try {
      await supprimerFournisseur(f.id);
      notifier({ type: 'succes', titre: 'Fournisseur supprimé', texte: `${f.nom_societe} effacé.` });
      charger(recherche);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ROLES_CHEF_FINANCE);

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Achats réservés"
        requis="Seuls les membres Finance suivent les fournisseurs."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Finance étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance · Achats</p>
          <h1 className="mt-esp-2">Fournisseurs</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouveau fournisseur
        </Button>
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un fournisseur…"
          aria-label="Rechercher un fournisseur"
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
                {['Société', 'Factures', 'Soldé dû', 'Statut', ''].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="cursor-pointer border-b border-gris-200 transition-colors duration-rapide last:border-0 hover:bg-gris-100" onClick={() => naviguer(`/finance/fournisseurs/${f.id}`)}>
                  <td className="px-esp-3 py-esp-3">
                    <span className="block font-courant text-[17px] font-semibold text-gris-900">{f.nom_societe}</span>
                    <span className="block font-courant text-[15px] text-gris-600">{[f.categorie, f.contact].filter(Boolean).join(' · ')}{f.email ? ` · ${f.email}` : ''}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{f.factures_count ?? '—'}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(f.solde_du ?? 0))}</td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[f.statut] ?? 'neutre'}>{STATUT_LABEL[f.statut] ?? f.statut}</Badge></td>
                  <td className="px-esp-3 py-esp-3 text-right">
                    <span className="inline-flex items-center gap-esp-1" onClick={(e) => e.stopPropagation()}>
                      {peutSupprimer && (
                        <BoutonSupprimer
                          titre={`Supprimer ${f.nom_societe}`}
                          libelle={f.nom_societe}
                          texte="Supprimer définitivement le fournisseur"
                          onConfirmer={() => supprimer(f)}
                        />
                      )}
                      <Link to={`/finance/fournisseurs/${f.id}`} aria-label={`Ouvrir ${f.nom_societe}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <ArrowRight size={20} aria-hidden="true" />
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && items.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun fournisseur trouvé.</p>
          )}
        </CardBody>
      </Card>

      {modale && <ModaleFournisseur onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
