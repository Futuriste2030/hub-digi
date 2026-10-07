import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Banknote, Printer, MessageCircle, Trash2, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { useSession } from '../store/auth.js';
import { listerInscriptionsFormation, ouvrirWhatsapp, statsFormations, supprimerInscriptionFormation, whatsappFacture } from '../api/formations.js';
import { payerFacture, telechargerPdf, pdfFacture } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Formations — pilotage inscriptions + factures (brouillon -> WhatsApp -> payée, reçu auto). */

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'envoyee', label: 'Envoyée' },
  { id: 'partielle', label: 'Partielle' },
  { id: 'payee', label: 'Payée' },
];
const STATUT_TON = { brouillon: 'neutre', envoyee: 'info', partielle: 'alerte', payee: 'succes' };
const MOYENS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'mobile_money', label: 'Mobile Money' },
];

function ModaleEncaisser({ inscription, onFermer, onEncaisser }) {
  const [montant, setMontant] = useState(String(inscription.facture_solde ?? ''));
  const [moyen, setMoyen] = useState('especes');
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    if (!(Number(montant) > 0)) {
      setErreur('Montant invalide.');
      return;
    }
    onEncaisser({ montant: Number(montant), moyen, ref_transaction: reference.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Encaisser">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Formations · {inscription.facture_numero}</p>
            <h2 className="!text-[21px]">Encaisser — {inscription.participant_nom}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="enc-montant">Montant (solde : {fCFA(Number(inscription.facture_solde ?? 0))})</Label>
            <div className="mt-esp-2"><Input id="enc-montant" type="number" min="1" value={montant} onChange={(e) => { setMontant(e.target.value); setErreur(''); }} /></div>
          </div>
          <div>
            <Label htmlFor="enc-moyen">Moyen de paiement</Label>
            <select id="enc-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px]">
              {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="enc-ref">Référence transaction (optionnel)</Label>
            <div className="mt-esp-2"><Input id="enc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. TX-2026-0001" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
          <Button type="submit" taille="lg" className="w-full"><Banknote size={20} aria-hidden="true" /> Encaisser {fCFA(Number(montant) || 0)}</Button>
          <p className="dg-legende text-center">Le reçu est généré automatiquement après paiement.</p>
        </div>
      </form>
    </div>
  );
}

export default function Formations() {
  const { notifier } = useOutletContext();
  const session = useSession();
  const peutSupprimer = peutVoir(session, ROLES_CHEF_FINANCE);
  const [inscriptions, setInscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [statut, setStatut] = useState('tous');
  const [formation, setFormation] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [aEncaisser, setAEncaisser] = useState(null);

  const charger = async () => {
    setChargement(true);
    try {
      const [liste, st] = await Promise.all([listerInscriptionsFormation(), statsFormations()]);
      setInscriptions(liste.results ?? liste);
      setStats(st);
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Chargement impossible', texte: messageErreur(e) });
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const formationsDispo = [...new Set(inscriptions.map((i) => i.formation_titre).filter(Boolean))];
  const visibles = inscriptions.filter((i) => {
    if (statut !== 'tous' && i.facture_statut !== statut) return false;
    if (formation !== 'toutes' && i.formation_titre !== formation) return false;
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      const hay = `${i.participant_nom} ${i.participant_email} ${i.participant_telephone} ${i.reference} ${i.facture_numero}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const envoyerWhatsapp = async (inscription) => {
    if (!inscription.facture_id) return;
    try {
      const r = await whatsappFacture(inscription.facture_id);
      ouvrirWhatsapp(r.telephone, r.message);
      notifier({ type: 'succes', titre: 'Facture envoyée', texte: `${inscription.facture_numero} passe en envoyée.` });
      charger();
    } catch (e) {
      notifier({ type: 'erreur', titre: 'WhatsApp impossible', texte: messageErreur(e) });
    }
  };

  const encaisser = async (payload) => {
    try {
      const recu = await payerFacture(aEncaisser.facture_id, payload);
      notifier({ type: 'succes', titre: 'Paiement enregistré', texte: `Reçu ${recu.numero}.` });
      setAEncaisser(null);
      charger();
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Encaissement impossible', texte: messageErreur(e) });
    }
  };

  const telecharger = async (inscription) => {
    try {
      await telechargerPdf(pdfFacture(inscription.facture_id), `${inscription.facture_numero}.pdf`);
    } catch (e) {
      notifier({ type: 'erreur', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (inscription) => {
    if (!window.confirm(`Supprimer l'inscription ${inscription.reference} (${inscription.participant_nom}) et sa facture non soldée ?`)) return;
    try {
      await supprimerInscriptionFormation(inscription.id);
      notifier({ type: 'succes', titre: 'Inscription supprimée', texte: inscription.reference });
      charger();
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <p className="dg-surtitre">Finance · Formations</p>
      <h1 className="mt-esp-2">Inscriptions & factures formations</h1>

      {stats && (
        <div className="mt-esp-5 grid grid-cols-1 gap-esp-4 sm:grid-cols-3">
          <Card survol={false}><CardBody>
            <p className="dg-legende">Total facturé</p>
            <p className="dg-tnum font-titrage text-[26px] font-extrabold">{fCFA(stats.total_facture)}</p>
          </CardBody></Card>
          <Card survol={false}><CardBody>
            <p className="dg-legende">Encaissé</p>
            <p className="dg-tnum font-titrage text-[26px] font-extrabold text-succes">{fCFA(stats.total_encaisse)}</p>
          </CardBody></Card>
          <Card survol={false}><CardBody>
            <p className="dg-legende">Reste à recouvrer</p>
            <p className="dg-tnum font-titrage text-[26px] font-extrabold text-erreur">{fCFA(stats.reste)}</p>
          </CardBody></Card>
        </div>
      )}

      <Card survol={false} className="mt-esp-5">
        <CardBody>
          <div className="flex flex-col gap-esp-3 md:flex-row">
            <div className="relative flex-1">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
              <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail, tél, référence…" aria-label="Rechercher" className="pl-11" />
            </div>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut facture" className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]">
              {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={formation} onChange={(e) => setFormation(e.target.value)} aria-label="Formation" className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]">
              <option value="toutes">Toutes formations</option>
              {formationsDispo.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {chargement ? (
            <p className="mt-esp-5 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : visibles.length === 0 ? (
            <p className="mt-esp-5 text-center font-courant text-[15px] text-gris-600">Aucune inscription pour ce filtre.</p>
          ) : (
            <ul className="mt-esp-4 flex flex-col gap-esp-3">
              {visibles.map((i) => (
                <li key={i.id} className="rounded-lg border border-gris-200 p-esp-4">
                  <div className="flex flex-wrap items-center gap-esp-2">
                    <p className="font-courant text-[15px] font-semibold text-gris-900">{i.participant_nom}</p>
                    <Badge ton="neutre">{i.formation_titre}</Badge>
                    {i.facture_statut && <Badge ton={STATUT_TON[i.facture_statut] ?? 'neutre'}>{i.facture_statut}</Badge>}
                    <span className="ml-auto dg-tnum font-courant text-[15px] font-bold">{fCFA(i.facture_total)}</span>
                  </div>
                  <p className="mt-esp-1 font-courant text-[14px] text-gris-600">
                    {i.participant_telephone} · {i.participant_email} · {i.reference} · {i.facture_numero}
                    {Number(i.facture_solde) > 0 && <> · Solde : <strong>{fCFA(i.facture_solde)}</strong></>}
                  </p>
                  <div className="mt-esp-3 flex flex-wrap gap-esp-2">
                    <Button variante="secondaire" taille="sm" onClick={() => envoyerWhatsapp(i)} disabled={!i.facture_id}>
                      <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                    </Button>
                    <Button variante="fantome" taille="sm" onClick={() => setAEncaisser(i)} disabled={!i.facture_id || i.facture_statut === 'payee'}>
                      <Banknote size={16} aria-hidden="true" /> Encaisser
                    </Button>
                    <Button variante="fantome" taille="sm" onClick={() => telecharger(i)} disabled={!i.facture_id}>
                      <Printer size={16} aria-hidden="true" /> PDF
                    </Button>
                    {peutSupprimer && (
                      <Button variante="fantome" taille="sm" onClick={() => supprimer(i)} aria-label={`Supprimer ${i.reference}`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {aEncaisser && (
        <ModaleEncaisser inscription={aEncaisser} onFermer={() => setAEncaisser(null)} onEncaisser={encaisser} />
      )}
    </div>
  );
}
