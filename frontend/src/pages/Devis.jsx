import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, Search, X, ArrowRight, Printer, Mail } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import EditeurLignes from '../components/finance/EditeurLignes.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { creerDevis, listerDevis, rejeterDevis, supprimerDevis, validerDevis } from '../api/finance.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients } from '../api/clients.js';
import { envoyerMail } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Devis — API réelle (SPEC §5.7 : chiffrage, validité, conversion en facture). */

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'en_attente', label: 'En attente' },
  { id: 'accepte', label: 'Accepté' },
  { id: 'refuse', label: 'Refusé' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { en_attente: 'alerte', accepte: 'succes', refuse: 'erreur' };
const numeroDevis = (d) => d.numero ?? `DEV-${String(d.id).padStart(4, '0')}`;

function ModaleDevis({ clients, onFermer, onCreer }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [objet, setObjet] = useState('');
  const [validite, setValidite] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [lignes, setLignes] = useState([{ description: '', quantite: 1, montant: '' }]);
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (objet.trim().length < 3) {
      setErreur('Décrivez l objet du devis en au moins 3 caractères.');
      return;
    }
    const utiles = lignes
      .filter((l) => l.description.trim() !== '' && Number(l.montant) > 0)
      .map((l) => ({ description: l.description.trim(), quantite: Number(l.quantite) || 1, montant: Number(l.montant) }));
    if (utiles.length === 0) {
      setErreur('Ajoutez au moins une ligne chiffrée avec description et montant.');
      return;
    }
    if (!validite || !clientId) {
      setErreur('Indiquez le client et la date de validité du devis.');
      return;
    }
    onCreer({ client: Number(clientId), objet: objet.trim(), validite, lignes: utiles });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouveau devis">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Finance</p>
            <h2 className="!text-[26px]">Nouveau devis</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dv-client">Client</Label>
              <select id="dv-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="dv-validite">Valable jusqu au</Label>
              <div className="mt-esp-2"><Input id="dv-validite" type="date" value={validite} onChange={(e) => setValidite(e.target.value)} /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="dv-objet">Objet</Label>
            <div className="mt-esp-2"><Input id="dv-objet" autoFocus value={objet} onChange={(e) => { setObjet(e.target.value); setErreur(''); }} placeholder="Ex. Refonte site vitrine" /></div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Lignes de chiffrage</span>
            <div className="mt-esp-2"><EditeurLignes lignes={lignes} onChanger={(l) => { setLignes(l); setErreur(''); }} /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer le devis</Button>
        </div>
      </form>
    </div>
  );
}

export default function Devis() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('tous');
  const [modale, setModale] = useState(false);
  const [devis, setDevis] = useState([]);
  const [clients, setClients] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [mailsClients, setMailsClients] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', st = 'tous') => {
    try {
      const [ds, cls] = await Promise.all([
        listerDevis({ ...(q ? { search: q } : {}), ...(st !== 'tous' ? { statut: st } : {}) }),
        listerClients(),
      ]);
      const liste = cls.results ?? cls;
      setDevis(ds);
      setClients(liste);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setMailsClients(Object.fromEntries(liste.map((c) => [c.id, c.email])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des devis impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), statut), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, statut]);

  const creer = async (data) => {
    try {
      const d = await creerDevis(data);
      setModale(false);
      notifier({ type: 'succes', titre: 'Devis créé', texte: `${numeroDevis(d)} — en attente.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const convertir = async (d) => {
    try {
      const f = await validerDevis(d.id);
      notifier({ type: 'succes', titre: 'Facture créée', texte: `${f.numero} générée depuis ${numeroDevis(d)}.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Conversion impossible', texte: messageErreur(e) });
    }
  };

  const rejeter = async (d) => {
    try {
      await rejeterDevis(d.id);
      notifier({ type: 'info', titre: 'Devis refusé', texte: `${numeroDevis(d)} signalé refusé.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (d) => {
    try {
      await supprimerDevis(d.id);
      notifier({ type: 'succes', titre: 'Devis supprimé', texte: `${numeroDevis(d)} — ${d.objet} effacé.` });
      charger(recherche.trim(), statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  const envoyer = async (d) => {
    try {
      await envoyerMail({
        to: mailsClients[d.client], subject: `Votre devis ${numeroDevis(d)}`,
        body_html: `<p>Bonjour, votre devis « ${d.objet} » (${fCFA(Number(d.total ?? 0))}) est disponible.</p>`,
        client: d.client,
      });
      notifier({ type: 'succes', titre: 'Devis envoyé', texte: `Template à ${mailsClients[d.client] || '—'}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Finance réservée"
        requis="Seuls les membres du département Finance suivent ces documents."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Finance étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_FINANCE);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance</p>
          <h1 className="mt-esp-2">Devis</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouveau devis
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Client, objet…" aria-label="Rechercher un devis" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi sm:max-w-96">
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Devis', 'Client', 'Montant', 'Statut', ''].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <tr key={d.id} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3">
                    <span className="font-mono text-[13px] text-gris-700">{numeroDevis(d)}</span>
                    <span className="block font-courant text-[15px] text-gris-900">{d.objet}</span>
                    <span className="block font-courant text-[13px] text-gris-600">Valable {d.validite || '—'}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{nomsClients[d.client] ?? ''}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(d.total ?? 0))}</td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[d.statut]}>{STATUT_LABEL[d.statut] ?? d.statut}</Badge></td>
                  <td className="px-esp-3 py-esp-3 text-right">
                    <span className="inline-flex gap-esp-1">
                      <Link to={`/devis/${d.id}`} aria-label={`Voir ${numeroDevis(d)}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <ArrowRight size={20} aria-hidden="true" />
                      </Link>
                      <Link to={`/devis/${d.id}`} aria-label={`Imprimer ${numeroDevis(d)}`} title="Aperçu imprimable" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                        <Printer size={20} aria-hidden="true" />
                      </Link>
                      <button type="button" onClick={() => envoyer(d)} aria-label={`Envoyer ${numeroDevis(d)} par mail`} title="Envoyer au client" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <Mail size={20} aria-hidden="true" />
                      </button>
                      {peutValider && d.statut === 'en_attente' && (
                        <>
                          <button type="button" onClick={() => convertir(d)} className="inline-flex min-h-[44px] items-center gap-esp-1 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-gris-700 transition-colors duration-rapide hover:bg-gris-200">
                            Convertir <ArrowRight size={16} aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => rejeter(d)} className="inline-flex min-h-[44px] items-center rounded-md px-esp-3 font-courant text-[15px] font-semibold text-erreur hover:bg-erreur-fond">
                            Refuser
                          </button>
                        </>
                      )}
                      {peutValider && d.statut !== 'accepte' && (
                        <BoutonSupprimer
                          titre={`Supprimer ${numeroDevis(d)}`}
                          libelle={d.objet}
                          texte="Supprimer définitivement le devis"
                          onConfirmer={() => supprimer(d)}
                        />
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && devis.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun devis avec ces filtres.</p>
          )}
        </CardBody>
      </Card>

      {modale && <ModaleDevis clients={clients} onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
