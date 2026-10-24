import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search, Banknote, Printer, MessageCircle, Trash2, X, Award, FileBadge, Link2, Download,
  GraduationCap, CalendarDays, MapPin, Clock, Building2, Save, Star,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input, Select } from '../components/ui/Input.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import EtatVide from '../components/ui/EtatVide.jsx';
import { ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { useSession } from '../store/auth.js';
import {
  listerInscriptionsFormation, ouvrirWhatsapp, statsFormations, supprimerInscriptionFormation,
  whatsappFacture, listerAttestations, genererAttestation, genererAttestationsFormation,
  pdfAttestation, telechargerZipAttestations, detailFormation, majFormation, majStatutInscription,
} from '../api/formations.js';
import { payerFacture, telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

const PAR_PAGE = 10;

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'envoyee', label: 'Envoyée' },
  { id: 'partielle', label: 'Partielle' },
  { id: 'payee', label: 'Payée' },
];
const STATUT_TON = { brouillon: 'neutre', envoyee: 'info', partielle: 'alerte', payee: 'succes' };
/* Les 4 statuts d'inscription, pour le sélecteur (le BACKEND est la source). */
const STATUTS_INSCRIPTION = [
  { id: 'recue', label: 'Reçue' },
  { id: 'confirmee', label: 'Confirmée' },
  { id: 'terminee', label: 'Terminée' },
  { id: 'annulee', label: 'Annulée' },
];
const MOYENS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'mobile_money', label: 'Mobile Money' },
];

const TONS_KPI = {
  digi: { tuile: 'bg-digi-voile text-digi-texte', valeur: 'text-gris-900' },
  succes: { tuile: 'bg-succes-fond text-succes', valeur: 'text-succes' },
  alerte: { tuile: 'bg-alerte-fond text-alerte', valeur: 'text-gris-900' },
  erreur: { tuile: 'bg-erreur-fond text-erreur', valeur: 'text-erreur' },
};

function Kpi({ icone: Icone, libelle, valeur, detail, ton = 'digi' }) {
  const decor = TONS_KPI[ton] ?? TONS_KPI.digi;
  return (
    <div className="flex flex-col justify-between gap-esp-3 bg-gris-0 p-esp-5">
      <div className="flex items-start justify-between gap-esp-3">
        <p className="dg-surtitre">{libelle}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${decor.tuile}`}>
          <Icone size={18} aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className={`font-titrage text-[24px] font-extrabold leading-none dg-tnum ${decor.valeur}`}>{valeur}</p>
        {detail && <p className="mt-esp-2 dg-legende">{detail}</p>}
      </div>
    </div>
  );
}

function ModaleEncaisser({ inscription, onFermer, onEncaisser }) {
  const [montant, setMontant] = useState(String(inscription.facture_solde ?? ''));
  const [moyen, setMoyen] = useState('especes');
  const [reference, setReference] = useState('');

  const soumettre = (e) => {
    e.preventDefault();
    onEncaisser({ montant: Number(montant), moyen, ref_transaction: reference });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Encaisser">
      <div className="absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="relative w-full max-w-[420px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-center justify-between gap-esp-3">
          <h2 className="!text-[20px]">Encaisser</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex h-9 min-h-[36px] w-9 items-center justify-center rounded-md text-gris-600 hover:bg-gris-100">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-esp-1 font-courant text-[14px] text-gris-600">
          {inscription.participant_nom} · {inscription.facture_numero} · reste {fCFA(inscription.facture_solde)}
        </p>
        <div className="mt-esp-4 flex flex-col gap-esp-3">
          <div>
            <Label htmlFor="enc-montant">Montant encaissé</Label>
            <Input id="enc-montant" type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} className="mt-esp-2" />
          </div>
          <div>
            <Label htmlFor="enc-moyen">Moyen</Label>
            <Select id="enc-moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className="mt-esp-2">
              {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="enc-ref">Référence transaction</Label>
            <Input id="enc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. TX-2026-0001" className="mt-esp-2" />
          </div>
        </div>
        <div className="mt-esp-5 flex justify-end gap-esp-2">
          <Button type="button" variante="secondaire" onClick={onFermer}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
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
  const [page, setPage] = useState(1);
  /* Attestations */
  const [attestations, setAttestations] = useState([]);
  const [formationAtt, setFormationAtt] = useState('');
  const [mentionAtt, setMentionAtt] = useState('');
  const [recapAtt, setRecapAtt] = useState(null);
  const [travailAtt, setTravailAtt] = useState(false);
  const [pageAtt, setPageAtt] = useState(1);
  /* Session de la formation (durée, lieu, dates, département) */
  const [infosSession, setInfosSession] = useState({ duree: '', lieu: '', date_debut: '', date_fin: '', departement: '' });

  const majSession = (champ, valeur) => setInfosSession((s) => ({ ...s, [champ]: valeur }));

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

  const chargerAttestations = async (formationId) => {
    try {
      const liste = await listerAttestations(formationId ? { formation: formationId } : {});
      setAttestations(liste.results ?? liste);
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Attestations indisponibles', texte: messageErreur(e) });
    }
  };

  /* À la sélection d'une formation : on charge sa session pour pré-remplir. */
  const choisirFormation = async (id) => {
    setFormationAtt(id);
    setRecapAtt(null);
    setPageAtt(1);
    if (!id) return;
    try {
      const f = await detailFormation(id);
      setInfosSession({
        duree: f.duree || '',
        lieu: f.lieu || '',
        date_debut: f.date_debut || '',
        date_fin: f.date_fin || '',
        departement: f.departement || '',
      });
    } catch {
      setInfosSession({ duree: '', lieu: '', date_debut: '', date_fin: '', departement: '' });
    }
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => { chargerAttestations(formationAtt); }, [formationAtt]);

  const formationsDispo = [...new Set(inscriptions.map((i) => i.formation_titre).filter(Boolean))];
  /* Formations avec leur id (pour le panel attestations). */
  const formationsListe = [...new Map(
    inscriptions.filter((i) => i.formation).map((i) => [i.formation, i.formation_titre]),
  ).entries()].map(([id, titre]) => ({ id, titre }));

  const visibles = useMemo(() => inscriptions.filter((i) => {
    if (statut !== 'tous' && i.facture_statut !== statut) return false;
    if (formation !== 'toutes' && i.formation_titre !== formation) return false;
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      const hay = `${i.participant_nom} ${i.participant_email} ${i.participant_telephone} ${i.reference} ${i.facture_numero}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [inscriptions, statut, formation, recherche]);

  const attestationsFormation = useMemo(
    () => attestations.filter((a) => String(a.formation_id) === String(formationAtt)),
    [attestations, formationAtt],
  );

  const terminees = inscriptions.filter((i) => i.statut === 'terminee').length;
  const facturees = inscriptions.filter((i) => i.facture_id).length;
  const aSolder = inscriptions.filter((i) => Number(i.facture_solde) > 0).length;
  const eligiblesFormation = inscriptions.filter(
    (i) => String(i.formation) === String(formationAtt) && i.statut === 'terminee',
  ).length;
  const tauxRecouvrement = stats && Number(stats.total_facture) > 0
    ? Math.round((Number(stats.total_encaisse) / Number(stats.total_facture)) * 100)
    : 0;

  /* Pagination : on revient sur la page 1 dès qu'un filtre change. */
  useEffect(() => { setPage(1); }, [statut, formation, recherche]);
  const totalPages = Math.max(1, Math.ceil(visibles.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const visiblesPage = visibles.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const totalPagesAtt = Math.max(1, Math.ceil(attestationsFormation.length / PAR_PAGE));
  const pageAttCourante = Math.min(pageAtt, totalPagesAtt);
  const attestationsPage = attestationsFormation.slice(
    (pageAttCourante - 1) * PAR_PAGE, pageAttCourante * PAR_PAGE,
  );

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
      const recu = await payerFacture(aEncaisser.facture_id, { montant: Number(aEncaisser.facture_solde), moyen: payload.moyen, ref_transaction: payload.ref_transaction });
      notifier({ type: 'succes', titre: 'Paiement enregistré', texte: `Reçu ${recu.numero}.` });
      setAEncaisser(null);
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Paiement impossible', texte: messageErreur(e) });
    }
  };

  const telecharger = async (inscription) => {
    try {
      await telechargerPdf(`/finance/invoices/${inscription.facture_id}/pdf/`, `${inscription.facture_numero}.pdf`);
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

  /* --- Attestations --- */
  const enregistrerSession = async () => {
    if (!formationAtt) return false;
    try {
      await majFormation(formationAtt, {
        duree: infosSession.duree,
        lieu: infosSession.lieu,
        date_debut: infosSession.date_debut || null,
        date_fin: infosSession.date_fin || null,
        departement: infosSession.departement,
      });
      notifier({ type: 'succes', titre: 'Session enregistrée', texte: 'Les attestations porteront ces informations.' });
      return true;
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Enregistrement impossible', texte: messageErreur(e) });
      return false;
    }
  };

  const genererToutes = async () => {
    if (!formationAtt) return;
    setTravailAtt(true);
    try {
      // La session est enregistrée d'abord : elle figure sur les attestations.
      await majFormation(formationAtt, {
        duree: infosSession.duree,
        lieu: infosSession.lieu,
        date_debut: infosSession.date_debut || null,
        date_fin: infosSession.date_fin || null,
        departement: infosSession.departement,
      });
      const r = await genererAttestationsFormation(formationAtt, { mention: mentionAtt });
      setRecapAtt(r);
      notifier({
        type: 'succes',
        titre: 'Attestations générées',
        texte: `${r.creees_nombre} créée(s), ${r.existantes_nombre} déjà existante(s), ${r.ignorees_nombre} ignorée(s).`,
      });
      chargerAttestations(formationAtt);
      charger();
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Génération impossible', texte: messageErreur(e) });
    } finally {
      setTravailAtt(false);
    }
  };

  /* Changement de statut d'inscription : « terminée » ouvre le droit à
     l'attestation, « annulée » ferme la porte. */
  const changerStatut = async (inscription, statut) => {
    const precedent = inscription.statut;
    setInscriptions((liste) => liste.map((i) => (i.id === inscription.id ? { ...i, statut } : i)));
    try {
      await majStatutInscription(inscription.id, statut);
      notifier({
        type: 'succes',
        titre: 'Statut mis à jour',
        texte: `${inscription.participant_nom} — ${STATUTS_INSCRIPTION.find((s) => s.id === statut)?.label ?? statut}.`,
      });
      charger();
    } catch (e) {
      setInscriptions((liste) => liste.map((i) => (i.id === inscription.id ? { ...i, statut: precedent } : i)));
      notifier({ type: 'erreur', titre: 'Statut non modifié', texte: messageErreur(e) });
    }
  };

  const genererUne = async (inscription) => {
    try {
      const r = await genererAttestation(inscription.id, { mention: mentionAtt });
      notifier({
        type: 'succes',
        titre: r.creee ? 'Attestation délivrée' : 'Attestation existante',
        texte: `${r.numero} — ${r.participant_nom}`,
      });
      chargerAttestations(formationAtt);
      charger();
    } catch (e) {
      notifier({ type: 'erreur', titre: 'Attestation impossible', texte: messageErreur(e) });
    }
  };

  const telechargerAttestation = async (attestation) => {
    try {
      await telechargerPdf(pdfAttestation(attestation.id), `${attestation.numero}.pdf`);
    } catch (e) {
      notifier({ type: 'erreur', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  const copierLienAttestation = async (attestation) => {
    try {
      await navigator.clipboard.writeText(attestation.lien_verification);
      notifier({ type: 'succes', titre: 'Lien copié', texte: `Lien de vérification ${attestation.numero}.` });
    } catch {
      notifier({ type: 'erreur', titre: 'Copie impossible', texte: 'Lien de vérification indisponible.' });
    }
  };

  return (
    <div>
      {/* ---------------- En-tête ---------------- */}
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance · Formations</p>
          <h1 className="mt-esp-2">Formations</h1>
          <p className="mt-esp-1 max-w-[70ch] font-courant text-[15px] text-gris-600">
            Inscriptions, facturation et attestations de fin de session.
          </p>
        </div>
        <Badge ton="neutre">{inscriptions.length} inscription(s)</Badge>
      </div>

      {/* ---------------- Indicateurs ---------------- */}
      {stats && (
        <Card survol={false} className="mt-esp-6 overflow-hidden">
          <div className="grid grid-cols-1 gap-px bg-gris-300 xs:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icone={GraduationCap}
              libelle="Inscriptions"
              valeur={String(inscriptions.length)}
              detail={`${terminees} terminée(s) · ${facturees} facturée(s)`}
            />
            <Kpi
              icone={FileBadge}
              libelle="Total facturé"
              valeur={fCFA(stats.total_facture)}
              detail={`${facturees} facture(s) émise(s)`}
            />
            <Kpi
              icone={Banknote}
              libelle="Encaissé"
              valeur={fCFA(stats.total_encaisse)}
              ton="succes"
              detail={`${tauxRecouvrement} % du total facturé`}
            />
            <Kpi
              icone={Clock}
              libelle="Reste à recouvrer"
              valeur={fCFA(stats.reste)}
              ton="erreur"
              detail={`${aSolder} facture(s) à solder`}
            />
          </div>
        </Card>
      )}

      {/* ---------------- Inscriptions ---------------- */}
      <Card survol={false} className="mt-esp-5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-esp-3">
            <div>
              <h2 className="!text-[20px]">Inscriptions</h2>
              <p className="mt-esp-1 dg-legende">
                {visibles.length} affichée(s) sur {inscriptions.length} inscription(s)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pb-esp-2">
          <div className="grid grid-cols-1 gap-esp-3 md:grid-cols-[minmax(0,1fr)_170px_230px]">
            <div className="relative">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
              <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail, tél, référence…" aria-label="Rechercher" className="w-full pl-11" />
            </div>
            <Select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut facture">
              {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select value={formation} onChange={(e) => setFormation(e.target.value)} aria-label="Formation">
              <option value="toutes">Toutes formations</option>
              {formationsDispo.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
        </CardBody>

        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : visibles.length === 0 ? (
            <EtatVide titre="Aucune inscription" texte="Aucun stagiaire ne correspond à ces filtres." />
          ) : (
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-y border-gris-200 bg-gris-100">
                  {['Stagiaire', 'Formation', 'Facture', 'Montant', 'Attestation', 'Actions'].map((col) => (
                    <th key={col} scope="col" className="px-esp-3 py-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600 last:text-right">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblesPage.map((i) => (
                  <tr key={i.id} className="border-b border-gris-200 align-middle transition-colors duration-rapide last:border-0 hover:bg-gris-100">
                    <td className="px-esp-3 py-esp-3">
                      <p className="font-courant text-[15px] font-semibold text-gris-900">{i.participant_nom}</p>
                      <p className="font-mono text-[12px] text-gris-500">{i.reference}</p>
                      <p className="mt-esp-1 font-courant text-[13px] text-gris-600">{i.participant_email}</p>
                      {i.participant_telephone && <p className="font-courant text-[13px] text-gris-600">{i.participant_telephone}</p>}
                    </td>
                    <td className="px-esp-3 py-esp-3">
                      <span className="block max-w-[240px] font-courant text-[14px] text-gris-700">{i.formation_titre}</span>
                      <Select
                        value={i.statut || 'recue'}
                        onChange={(e) => changerStatut(i, e.target.value)}
                        aria-label={`Statut de l’inscription ${i.reference}`}
                        className="mt-esp-2 !h-9 max-w-[180px] !text-[13px]"
                      >
                        {STATUTS_INSCRIPTION.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-esp-3 py-esp-3">
                      {i.facture_id ? (
                        <>
                          <span className="block font-mono text-[13px] text-gris-700">{i.facture_numero}</span>
                          <span className="mt-esp-1 block"><Badge ton={STATUT_TON[i.facture_statut] ?? 'neutre'}>{i.facture_statut}</Badge></span>
                        </>
                      ) : (
                        <span className="font-courant text-[13px] text-gris-400" title="Cette inscription n’a pas de facture (elle ne vient pas du site vitrine).">Sans facture</span>
                      )}
                    </td>
                    <td className="dg-tnum whitespace-nowrap px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900">
                      {fCFA(i.facture_total)}
                      {Number(i.facture_solde) > 0 && <span className="block text-[12px] font-normal text-erreur">reste {fCFA(i.facture_solde)}</span>}
                    </td>
                    <td className="px-esp-3 py-esp-3">
                      {i.attestation_numero
                        ? <Badge ton="succes">{i.attestation_numero}</Badge>
                        : <span className="font-courant text-[13px] text-gris-400">—</span>}
                    </td>
                    <td className="px-esp-3 py-esp-3">
                      <span className="flex items-center justify-end gap-esp-1 whitespace-nowrap">
                        <Button variante="fantome" taille="sm" className="w-9 !px-0" onClick={() => envoyerWhatsapp(i)}
                          disabled={!i.facture_id}
                          aria-label={`Envoyer la facture de ${i.participant_nom} par WhatsApp`}
                          title={i.facture_id ? 'Envoyer la facture par WhatsApp' : 'Aucune facture liée à cette inscription'}>
                          <MessageCircle size={16} aria-hidden="true" />
                        </Button>
                        <Button variante="fantome" taille="sm" className="w-9 !px-0" onClick={() => setAEncaisser(i)}
                          disabled={!i.facture_id || i.facture_statut === 'payee'}
                          aria-label={`Encaisser la facture de ${i.participant_nom}`}
                          title={i.facture_id ? 'Enregistrer un encaissement' : 'Aucune facture liée à cette inscription'}>
                          <Banknote size={16} aria-hidden="true" />
                        </Button>
                        <Button variante="fantome" taille="sm" className="w-9 !px-0" onClick={() => telecharger(i)}
                          disabled={!i.facture_id}
                          aria-label={`Télécharger la facture de ${i.participant_nom}`}
                          title={i.facture_id ? 'Télécharger le PDF de la facture' : 'Aucune facture liée à cette inscription'}>
                          <Printer size={16} aria-hidden="true" />
                        </Button>
                        <Button variante="fantome" taille="sm" className="w-9 !px-0"
                          onClick={() => (i.attestation_numero ? window.open(i.attestation_lien, '_blank', 'noopener') : genererUne(i))}
                          aria-label={i.attestation_numero ? `Vérifier l’attestation de ${i.participant_nom}` : `Délivrer l’attestation de ${i.participant_nom}`}
                          title={i.attestation_numero ? 'Ouvrir la page de vérification de l’attestation' : 'Délivrer l’attestation'}>
                          {i.attestation_numero ? <Award size={16} aria-hidden="true" /> : <FileBadge size={16} aria-hidden="true" />}
                        </Button>
                        {peutSupprimer && (
                          <Button variante="fantome" taille="sm" className="w-9 !px-0" onClick={() => supprimer(i)} aria-label={`Supprimer ${i.reference}`} title="Supprimer l’inscription">
                            <Trash2 size={16} aria-hidden="true" />
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
        {!chargement && visibles.length > 0 && (
          <Pagination
            page={pageCourante}
            totalPages={totalPages}
            total={visibles.length}
            libelle="inscription(s)"
            onChange={setPage}
          />
        )}
      </Card>

      {aEncaisser && (
        <ModaleEncaisser inscription={aEncaisser} onFermer={() => setAEncaisser(null)} onEncaisser={encaisser} />
      )}

      {/* ---------------- Attestations ---------------- */}
      <Card survol={false} className="mt-esp-5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-esp-4">
            <div>
              <h2 className="!text-[20px]">Attestations</h2>
              <p className="mt-esp-1 max-w-[78ch] dg-legende">
                Document officiel A4 paysage, cachet et QR de traçabilité. Seules les inscriptions
                « Terminée » sont éligibles.
              </p>
            </div>
            <div className="flex flex-wrap gap-esp-2 md:ml-auto">
              <Button variante="secondaire" taille="sm" onClick={() => telechargerZipAttestations(formationAtt, `attestations-${formationAtt}.zip`)}
                disabled={!formationAtt || attestationsFormation.length === 0}
                title="Un PDF par stagiaire, prêts à imprimer (A4 paysage)">
                <Download size={16} aria-hidden="true" /> Tout télécharger (ZIP)
              </Button>
              <Button taille="sm" onClick={genererToutes} disabled={!formationAtt || travailAtt} chargement={travailAtt}>
                <Award size={16} aria-hidden="true" /> Générer les attestations
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="rounded-lg border border-gris-300 bg-gris-100 p-esp-4">
            <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-end">
              <div>
                <Label htmlFor="att-formation">Formation</Label>
                <Select id="att-formation" value={formationAtt} onChange={(e) => choisirFormation(e.target.value)} className="mt-esp-2">
                  <option value="">Choisir une formation…</option>
                  {formationsListe.map((f) => <option key={f.id} value={f.id}>{f.titre}</option>)}
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-esp-2 lg:justify-end lg:pb-esp-2">
                {formationAtt ? (
                  <>
                    <Badge ton="info">{attestationsFormation.length} attestation(s)</Badge>
                    <Badge ton="neutre">{eligiblesFormation} stagiaire(s) éligible(s)</Badge>
                    <span className="dg-legende">Session et éligibilité vérifiées à la génération.</span>
                  </>
                ) : (
                  <span className="dg-legende">Choisissez une formation pour gérer sa session et ses attestations.</span>
                )}
              </div>
            </div>
          </div>

          {formationAtt && (
            <div className="mt-esp-5 overflow-hidden rounded-lg border border-gris-300">
              <div className="flex flex-wrap items-center gap-esp-3 border-b border-gris-300 bg-gris-100 px-esp-4 py-esp-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-digi-voile text-digi-texte">
                  <CalendarDays size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-titrage text-[14px] font-bold text-gris-900">Session de la formation</p>
                  <p className="dg-legende">Ces informations figurent sur les attestations.</p>
                </div>
                <Button variante="secondaire" taille="sm" onClick={enregistrerSession}>
                  <Save size={16} aria-hidden="true" /> Enregistrer la session
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-esp-4 bg-gris-0 p-esp-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label htmlFor="sess-duree">
                    <span className="inline-flex items-center gap-esp-1">
                      <Clock size={13} aria-hidden="true" /> Durée
                    </span>
                  </Label>
                  <Input id="sess-duree" value={infosSession.duree} onChange={(e) => majSession('duree', e.target.value)} placeholder="Ex. 40 heures" className="mt-esp-2 w-full" />
                </div>
                <div>
                  <Label htmlFor="sess-lieu">
                    <span className="inline-flex items-center gap-esp-1">
                      <MapPin size={13} aria-hidden="true" /> Lieu
                    </span>
                  </Label>
                  <Input id="sess-lieu" value={infosSession.lieu} onChange={(e) => majSession('lieu', e.target.value)} placeholder="Ex. Bamako" className="mt-esp-2 w-full" />
                </div>
                <div>
                  <Label htmlFor="sess-debut">
                    <span className="inline-flex items-center gap-esp-1">
                      <CalendarDays size={13} aria-hidden="true" /> Début
                    </span>
                  </Label>
                  <Input id="sess-debut" type="date" value={infosSession.date_debut} onChange={(e) => majSession('date_debut', e.target.value)} className="mt-esp-2 w-full" />
                </div>
                <div>
                  <Label htmlFor="sess-fin">
                    <span className="inline-flex items-center gap-esp-1">
                      <CalendarDays size={13} aria-hidden="true" /> Fin
                    </span>
                  </Label>
                  <Input id="sess-fin" type="date" value={infosSession.date_fin} onChange={(e) => majSession('date_fin', e.target.value)} className="mt-esp-2 w-full" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="sess-dep">
                    <span className="inline-flex items-center gap-esp-1">
                      <Building2 size={13} aria-hidden="true" /> Département
                    </span>
                  </Label>
                  <Input id="sess-dep" value={infosSession.departement} onChange={(e) => majSession('departement', e.target.value)} placeholder="Ex. Ingénierie Informatique" className="mt-esp-2 w-full" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="att-mention">
                    <span className="inline-flex items-center gap-esp-1">
                      <Star size={13} aria-hidden="true" /> Appréciation
                    </span>
                  </Label>
                  <Input
                    id="att-mention"
                    value={mentionAtt}
                    onChange={(e) => setMentionAtt(e.target.value)}
                    placeholder="Ex. Mention Bien"
                    className="mt-esp-2 w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {recapAtt && (
            <div className="mt-esp-4 flex items-start gap-esp-3 rounded-lg border border-gris-300 bg-succes-fond p-esp-4">
              <Award size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-succes" />
              <div>
                <p className="font-titrage text-[14px] font-bold text-gris-900">
                  {recapAtt.creees_nombre} attestation(s) créée(s) · {recapAtt.existantes_nombre} déjà existante(s)
                  {recapAtt.ignorees_nombre > 0 && ` · ${recapAtt.ignorees_nombre} ignorée(s)`}
                </p>
                {recapAtt.ignorees_nombre > 0 && (
                  <ul className="mt-esp-2 flex flex-col gap-esp-1">
                    {recapAtt.ignorees.map((i) => (
                      <li key={i.inscription} className="font-courant text-[13px] text-gris-600">
                        {i.participant} — {i.motif}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!formationAtt ? (
            <div className="mt-esp-5 flex flex-col items-center rounded-lg border border-dashed border-gris-300 bg-gris-100 px-esp-5 py-esp-7 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-pilule border border-gris-300 bg-gris-0 text-digi-texte">
                <Award size={22} aria-hidden="true" />
              </span>
              <p className="mt-esp-3 font-titrage text-[16px] font-bold text-gris-900">Choisissez une formation</p>
              <p className="mt-esp-1 max-w-[52ch] font-courant text-[14px] text-gris-600">
                La session, les stagiaires éligibles et les attestations déjà délivrées s’affichent ici.
              </p>
            </div>
          ) : attestationsFormation.length === 0 ? (
            <div className="mt-esp-5">
              <EtatVide titre="Aucune attestation" texte="Renseignez la session puis générez les attestations des stagiaires terminés." />
            </div>
          ) : (
            <div className="mt-esp-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-gris-200 bg-gris-100">
                    {['Stagiaire', 'Attestation', 'Délivrée le', 'Documents'].map((col) => (
                      <th key={col} scope="col" className="px-esp-3 py-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600 last:text-right">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attestationsPage.map((a) => (
                    <tr key={a.id} className="border-b border-gris-200 last:border-0 transition-colors duration-rapide hover:bg-gris-100">
                      <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900">{a.participant_nom}</td>
                      <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-700">{a.numero}</td>
                      <td className="px-esp-3 py-esp-3 font-courant text-[14px] text-gris-600">
                        {new Date(a.date_delivrance).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-esp-3 py-esp-3">
                        <span className="flex items-center justify-end gap-esp-2 whitespace-nowrap">
                          <Button variante="secondaire" taille="sm" onClick={() => telechargerAttestation(a)}>
                            <Printer size={16} aria-hidden="true" /> PDF
                          </Button>
                          <Button variante="fantome" taille="sm" onClick={() => copierLienAttestation(a)} title="Copier le lien de vérification">
                            <Link2 size={16} aria-hidden="true" /> Copier le lien
                          </Button>
                          <Button variante="fantome" taille="sm" onClick={() => window.open(a.lien_verification, '_blank', 'noopener')} title="Ouvrir la page de vérification">
                            <Award size={16} aria-hidden="true" /> Vérifier
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
        {formationAtt && attestationsFormation.length > 0 && (
          <Pagination
            page={pageAttCourante}
            totalPages={totalPagesAtt}
            total={attestationsFormation.length}
            libelle="attestation(s)"
            onChange={setPageAtt}
          />
        )}
      </Card>
    </div>
  );
}
