import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Search, ArrowRight, Link2, Banknote, Printer, Plus, X, Mail } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import EditeurLignes from '../components/finance/EditeurLignes.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { creerFacture, envoyerFacture, listerFactures, payerFacture, telechargerPdf } from '../api/finance.js';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';
import { PAIEMENT_EN_LIGNE_ACTIF, MESSAGE_PAIEMENT_BIENTOT, lienPaiementFacture } from '../lib/paiement.js';
import { fCFA } from '../utils/stats.js';

/* Factures globales — API réelle (SPEC §5.7 : brouillon -> payée, reçu auto, template mail). */

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'validee', label: 'Validée' },
  { id: 'envoyee', label: 'Envoyée' },
  { id: 'partielle', label: 'Partielle' },
  { id: 'payee', label: 'Payée' },
  { id: 'impayee', label: 'Impayée' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { brouillon: 'neutre', validee: 'info', envoyee: 'info', partielle: 'alerte', payee: 'succes', impayee: 'erreur' };
const TYPES_DOC = [
  { id: 'facture', label: 'Facture' },
  { id: 'proforma', label: 'Proforma' },
];
const TYPE_DOC_LABEL = Object.fromEntries(TYPES_DOC.map((t) => [t.id, t.label]));
const MOYENS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'mobile_money', label: 'Mobile Money' },
];

function ModaleFacture({ clients, onFermer, onCreer }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [typeDoc, setTypeDoc] = useState('facture');
  const [lignes, setLignes] = useState([{ description: '', quantite: 1, montant: '' }]);
  const [tvaActive, setTvaActive] = useState(false);
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    const utiles = lignes
      .filter((l) => l.description.trim() !== '' && Number(l.montant) > 0)
      .map((l) => ({ description: l.description.trim(), quantite: Number(l.quantite) || 1, montant: Number(l.montant) }));
    if (utiles.length === 0) {
      setErreur('Ajoutez au moins une ligne facturée avec description et montant.');
      return;
    }
    if (!clientId) {
      setErreur('Choisissez le client facturé.');
      return;
    }
    onCreer({ client: Number(clientId), type_doc: typeDoc, lignes: utiles, tva_active: tvaActive });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle facture">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Finance</p>
            <h2 className="!text-[26px]">Nouvelle facture</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nf-type">Type de document</Label>
              <select id="nf-type" value={typeDoc} onChange={(e) => setTypeDoc(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                {TYPES_DOC.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="nf-client">Client</Label>
              <select id="nf-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="font-courant text-[15px] font-semibold text-gris-700">Lignes de facturation</span>
            <div className="mt-esp-2"><EditeurLignes lignes={lignes} onChanger={(l) => { setLignes(l); setErreur(''); }} /></div>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md border border-gris-300 bg-gris-100 px-esp-4">
            <input type="checkbox" checked={tvaActive} onChange={(e) => setTvaActive(e.target.checked)} className="h-5 w-5 accent-[#0a3d91]" />
            <span className="font-courant text-[15px] font-semibold text-gris-900">Activer la TVA 18 % <span className="font-normal text-gris-600">— désactivée par défaut (pas de TVA au Mali)</span></span>
          </label>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer en brouillon</Button>
        </div>
      </form>
    </div>
  );
}

function ModalePaiement({ facture, onFermer, onPayer }) {
  const [montant, setMontant] = useState(String(facture.solde ?? 0));
  const [moyen, setMoyen] = useState('especes');
  const [ref, setRef] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (!(Number(montant) > 0)) {
      setErreur('Indiquez un montant supérieur à zéro.');
      return;
    }
    onPayer({ montant: Number(montant), moyen, ref_transaction: ref.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={`Encaisser ${facture.numero}`}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Encaissement · solde {fCFA(Number(facture.solde ?? 0))}</p>
            <h2 className="!text-[26px]">{facture.numero}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pay-montant">Montant (F)</Label>
              <div className="mt-esp-2"><Input id="pay-montant" inputMode="numeric" value={montant} onChange={(e) => { setMontant(e.target.value); setErreur(''); }} /></div>
            </div>
            <div>
              <Label htmlFor="pay-moyen">Moyen</Label>
              <select id="pay-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="pay-ref">Référence transaction (Mobile Money)</Label>
            <div className="mt-esp-2"><Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ex. TX-2026-0001" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Banknote size={20} aria-hidden="true" /> Encaisser</Button>
        </div>
      </form>
    </div>
  );
}

export default function Factures() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('tous');
  const [typeFiltre, setTypeFiltre] = useState('tous');
  const [modale, setModale] = useState(false);
  const [paiement, setPaiement] = useState(null);
  const [factures, setFactures] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', st = 'tous', ty = 'tous') => {
    try {
      const [fs, cls] = await Promise.all([
        listerFactures({ ...(q ? { search: q } : {}), ...(st !== 'tous' ? { statut: st } : {}), ...(ty !== 'tous' ? { type_doc: ty } : {}) }),
        listerClients(),
      ]);
      const liste = cls.results ?? cls;
      setFactures(fs);
      setClients(liste);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des factures impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), statut, typeFiltre), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, statut, typeFiltre]);

  const creer = async (data) => {
    try {
      const f = await creerFacture(data);
      setModale(false);
      notifier({ type: 'succes', titre: `${TYPE_DOC_LABEL[data.type_doc] ?? 'Facture'} créée`, texte: `${f.numero} — statut Brouillon.` });
      charger(recherche.trim(), statut, typeFiltre);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const copier = async (f) => {
    if (!PAIEMENT_EN_LIGNE_ACTIF) {
      notifier({ type: 'info', titre: 'Paiement en ligne bientôt disponible', texte: MESSAGE_PAIEMENT_BIENTOT });
      return;
    }
    try {
      await navigator.clipboard.writeText(lienPaiementFacture(f.numero));
    } catch {
      /* presse-papiers indisponible */
    }
    notifier({ type: 'info', titre: 'Lien copié', texte: `Lien de paiement ${f.numero} copié.` });
  };

  const payer = async (f, data) => {
    try {
      const recu = await payerFacture(f.id, data);
      setPaiement(null);
      notifier({ type: 'succes', titre: 'Paiement reçu', texte: `${f.numero} — reçu ${recu.numero} généré et envoyé.` });
      charger(recherche.trim(), statut, typeFiltre);
    } catch (e) {
      notifier({ type: 'info', titre: 'Encaissement impossible', texte: messageErreur(e) });
    }
  };

  const envoyer = async (f) => {
    try {
      await envoyerFacture(f.id);
      notifier({ type: 'succes', titre: 'Facture envoyée', texte: `Template facture_disponible + PDF à ${f.numero}.` });
      charger(recherche.trim(), statut, typeFiltre);
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
  const reste = factures.filter((f) => f.statut !== 'payee').reduce((s, f) => s + Number(f.solde ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance</p>
          <h1 className="mt-esp-2">Factures</h1>
        </div>
        <span className="flex flex-wrap items-center gap-esp-3">
          <Badge ton="alerte">Reste à recevoir : {fCFA(reste)}</Badge>
          <Button onClick={() => setModale(true)}>
            <Plus size={20} aria-hidden="true" /> Nouvelle facture
          </Button>
        </span>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, client…" aria-label="Rechercher une facture" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={typeFiltre} onChange={(e) => setTypeFiltre(e.target.value)} aria-label="Filtrer par type" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          <option value="tous">Tous types</option>
          {TYPES_DOC.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
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
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Facture', 'Type', 'Client', 'Montant', 'Statut', 'Actions'].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.numero} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3">
                    <span className="font-mono text-[13px] text-gris-700">{f.numero}</span>
                    <span className="block font-courant text-[13px] text-gris-600 dg-tnum">Payé {fCFA(Number(f.paye ?? 0))} · Solde {fCFA(Number(f.solde ?? 0))}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={(f.type_doc ?? 'facture') === 'proforma' ? 'info' : 'neutre'}>{TYPE_DOC_LABEL[f.type_doc] ?? 'Facture'}</Badge></td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{nomsClients[f.client] ?? ''}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(f.total ?? 0))}{f.tva_active && <span className="ml-esp-2"><Badge ton="info">TVA 18 %</Badge></span>}</td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={STATUT_TON[f.statut] || 'neutre'}>{STATUT_LABEL[f.statut] ?? f.statut}</Badge></td>
                  <td className="px-esp-3 py-esp-3">
                    <span className="flex flex-wrap gap-esp-1">
                      <Link to={`/factures/${f.numero}`} aria-label={`Voir ${f.numero}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <ArrowRight size={20} aria-hidden="true" />
                      </Link>
                      <button type="button" onClick={() => copier(f)} aria-label={`Copier le lien ${f.numero}`} title={PAIEMENT_EN_LIGNE_ACTIF ? 'Copier le lien de paiement' : MESSAGE_PAIEMENT_BIENTOT} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <Link2 size={20} aria-hidden="true" />
                      </button>
                      {peutValider && f.statut !== 'payee' && (
                        <button type="button" onClick={() => setPaiement(f)} aria-label={`Encaisser ${f.numero}`} title="Encaisser" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-succes hover:bg-succes-fond">
                          <Banknote size={20} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" onClick={() => telechargerPdf(`/finance/invoices/${f.id}/pdf/`, `${f.numero}.pdf`)} aria-label={`PDF ${f.numero}`} title="Télécharger le PDF" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
                        <Printer size={20} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => envoyer(f)} aria-label={`Envoyer ${f.numero} par mail`} title="Envoyer le template + PDF en pièce jointe" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <Mail size={20} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && factures.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune facture avec ces filtres.</p>
          )}
        </CardBody>
      </Card>

      {modale && <ModaleFacture clients={clients} onFermer={() => setModale(false)} onCreer={creer} />}
      {paiement && <ModalePaiement facture={paiement} onFermer={() => setPaiement(null)} onPayer={(data) => payer(paiement, data)} />}
    </div>
  );
}
