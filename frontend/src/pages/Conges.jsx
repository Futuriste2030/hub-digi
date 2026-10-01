import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, X, Check, Ban, CalendarDays, BellRing } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { demanderConge, listerConges, listerEmployes, validerConge } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { ROLES_CHEF_RH, peutVoir } from '../lib/acces.js';

/* Congés — API réelle (SPEC §5.5 : demande, validation RH, rappel J-3). */

const STATUTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'en_attente', label: 'En attente' },
  { id: 'valide', label: 'Validé' },
  { id: 'refuse', label: 'Refusé' },
  { id: 'annule', label: 'Annulé' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { en_attente: 'alerte', valide: 'succes', refuse: 'erreur', annule: 'neutre' };

const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const dansNJours = (iso, n) => {
  const cible = new Date();
  cible.setHours(0, 0, 0, 0);
  cible.setDate(cible.getDate() + n);
  const d = new Date(`${iso}T00:00`);
  return d.getTime() === cible.getTime();
};

function DemandesJ3({ conges, noms }) {
  const prochains = conges.filter((c) => c.statut === 'valide' && dansNJours(c.du_jour, 3));
  if (prochains.length === 0) return null;
  return (
    <div className="mt-esp-4">
      <Alert ton="info" titre="Rappels J-3 (mail auto)">
        {prochains.map((c) => (
          <p key={c.id} className="flex items-center gap-esp-2">
            <BellRing size={16} aria-hidden="true" />
            {noms[c.employe] ?? '—'} — congé dans 3 jours ({dateFr(c.du_jour)} → {dateFr(c.au_jour)}).
          </p>
        ))}
      </Alert>
    </div>
  );
}

function ModaleConge({ employe, onFermer, onCreer }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ du: today, au: today, motif: 'Congés annuels' });
  const [erreur, setErreur] = useState('');
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  const soumettre = (e) => {
    e.preventDefault();
    if (!form.du || !form.au || form.du > form.au) {
      setErreur('Indiquez une période valide, date de fin après date de début.');
      return;
    }
    onCreer({ employe: employe.id, du_jour: form.du, au_jour: form.au, motif: form.motif });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle demande de congé">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Mes congés</p>
            <h2 className="!text-[26px]">Demande de congé</h2>
            <p className="mt-esp-1 font-courant text-[15px] text-gris-600">
              {employe.email} — <span className="dg-tnum">{employe.solde_conges} j restants</span>
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-2 gap-esp-4">
            <div>
              <Label htmlFor="cg-du">Du</Label>
              <div className="mt-esp-2"><Input id="cg-du" type="date" {...champ('du')} /></div>
            </div>
            <div>
              <Label htmlFor="cg-au">Au</Label>
              <div className="mt-esp-2"><Input id="cg-au" type="date" {...champ('au')} /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="cg-motif">Motif</Label>
            <select id="cg-motif" {...champ('motif')} className={selectCls}>
              {['Congés annuels', 'Mariage', 'Maladie', 'Maternité', 'Formation', 'Autre'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Déposer</Button>
        </div>
      </form>
    </div>
  );
}

export default function Conges() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('tous');
  const [modale, setModale] = useState(false);
  const [onglet, setOnglet] = useState('mes');
  const [conges, setConges] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState('');
  const [refusId, setRefusId] = useState(null);
  const [motifRefus, setMotifRefus] = useState('');

  const charger = async (st = 'tous') => {
    try {
      const [cs, es] = await Promise.all([
        listerConges(st === 'tous' ? {} : { statut: st }),
        listerEmployes(),
      ]);
      setConges(cs);
      setEmployes(es);
      setErreurListe('');
    } catch (e) {
      setErreurListe(messageErreur(e, 'Chargement des congés impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    charger(statut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut]);

  const noms = Object.fromEntries(employes.map((e) => [e.id, e.email]));
  const connecte = employes.find((e) => e.user === session?.id);
  const nom = (id) => noms[id] ?? '—';
  const q = recherche.trim().toLowerCase();
  /* Validation réservée RH/admin (chef) — les autres ne voient que Mes demandes. */
  const peutValider = peutVoir(session, ROLES_CHEF_RH);
  const ongletActif = onglet === 'rh' && !peutValider ? 'mes' : onglet;
  const tous = conges.filter(
    (c) => q === '' || nom(c.employe).toLowerCase().includes(q) || (c.motif ?? '').toLowerCase().includes(q),
  );
  const visibles = ongletActif === 'mes'
    ? tous.filter((c) => (connecte ? c.employe === connecte.id : true))
    : tous;
  const enAttente = conges.filter((c) => c.statut === 'en_attente').length;

  const creer = async (data) => {
    try {
      const c = await demanderConge(data);
      setModale(false);
      notifier({ type: 'succes', titre: 'Demande déposée', texte: `${c.duree} jour${c.duree > 1 ? 's' : ''} — en attente de validation RH.` });
      charger(statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Dépôt impossible', texte: messageErreur(e) });
    }
  };

  const valider = async (c) => {
    try {
      await validerConge(c.id, { decision: 'valide' });
      notifier({ type: 'succes', titre: 'Congé validé', texte: `${nom(c.employe)} — solde décompté.` });
      charger(statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Validation impossible', texte: messageErreur(e) });
    }
  };

  const refuser = async (c) => {
    if (motifRefus.trim().length < 3) {
      notifier({ type: 'info', titre: 'Motif requis', texte: 'Indiquez le motif du refus (obligatoire).' });
      return;
    }
    try {
      await validerConge(c.id, { decision: 'refuse', commentaire: motifRefus.trim() });
      setRefusId(null);
      setMotifRefus('');
      notifier({ type: 'info', titre: 'Congé refusé', texte: `${nom(c.employe)} — notifié.` });
      charger(statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Refus impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">RH · Congés</p>
          <h1 className="mt-esp-2">Congés</h1>
        </div>
        <Button onClick={() => setModale(true)} disabled={!connecte}>
          <Plus size={20} aria-hidden="true" /> Demander un congé
        </Button>
      </div>
      {!connecte && !chargement && (
        <p className="mt-esp-3 rounded-lg bg-gris-100 p-esp-3 font-courant text-[14px] text-gris-600">
          Pas de fiche employé liée à votre compte — la RH doit la créer avant toute demande.
        </p>
      )}

      <div className="mt-esp-6 flex gap-esp-2" role="tablist" aria-label="Vues congés">
        {[
          ['mes', `Mes demandes${connecte ? ` · ${connecte.solde_conges} j` : ''}`],
          ...(peutValider ? [['rh', `À valider (RH) · ${enAttente}`]] : []),
        ].map(([k, lb]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={ongletActif === k}
            onClick={() => setOnglet(k)}
            className={`min-h-[44px] rounded-pilule border px-esp-4 font-courant text-[15px] font-semibold transition-colors duration-rapide ${
              ongletActif === k ? 'border-marine-profond bg-marine-profond text-blanc' : 'border-gris-300 text-gris-600 hover:text-gris-900'
            }`}
          >
            {lb}
          </button>
        ))}
      </div>

      <DemandesJ3 conges={conges} noms={noms} />

      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Employé, motif…" aria-label="Rechercher un congé" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi sm:max-w-96">
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="flex flex-col gap-esp-3 pt-esp-5">
          {chargement ? (
            <p className="text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreurListe ? (
            <p className="text-center font-courant text-[15px] text-erreur" role="alert">{erreurListe}</p>
          ) : visibles.length === 0 ? (
            <p className="text-center font-courant text-[15px] text-gris-600">
              {ongletActif === 'mes' ? 'Aucune demande pour vous. Déposez votre première demande.' : 'Aucune demande avec ces filtres.'}
            </p>
          ) : visibles.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg bg-gris-100 p-esp-3">
              <CalendarDays size={20} aria-hidden="true" className="shrink-0 text-digi" />
              <div className="min-w-48 flex-1">
                <p className="font-courant text-[15px] font-semibold text-gris-900">{nom(c.employe)}</p>
                <p className="font-courant text-[15px] text-gris-600 dg-tnum">{dateFr(c.du_jour)} → {dateFr(c.au_jour)} · {c.duree} j · {c.motif}</p>
                {c.statut === 'refuse' && c.commentaire && (
                  <p className="font-courant text-[13px] text-erreur">Motif du refus : {c.commentaire}</p>
                )}
              </div>
              <Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{STATUT_LABEL[c.statut] ?? c.statut}</Badge>
              {ongletActif === 'rh' && c.statut === 'en_attente' && (
                refusId === c.id ? (
                  <span className="flex w-full flex-wrap items-center gap-esp-2">
                    <input value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} placeholder="Motif du refus (obligatoire)…" aria-label="Motif du refus" className="h-11 min-h-[44px] flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[15px]" />
                    <button type="button" onClick={() => refuser(c)} className="inline-flex min-h-[44px] items-center rounded-md bg-erreur px-esp-3 font-courant text-[15px] font-semibold text-blanc">Confirmer</button>
                    <button type="button" onClick={() => { setRefusId(null); setMotifRefus(''); }} className="inline-flex min-h-[44px] items-center rounded-md px-esp-3 font-courant text-[15px] font-semibold text-gris-600">Annuler</button>
                  </span>
                ) : (
                  <span className="flex gap-esp-2">
                    <button type="button" onClick={() => valider(c)} aria-label={`Valider le congé de ${nom(c.employe)}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-succes px-esp-3 font-courant text-[15px] font-semibold text-blanc transition-colors duration-rapide hover:brightness-90">
                      <Check size={16} aria-hidden="true" /> Valider
                    </button>
                    <button type="button" onClick={() => setRefusId(c.id)} aria-label={`Refuser le congé de ${nom(c.employe)}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-erreur transition-colors duration-rapide hover:bg-erreur-fond">
                      <Ban size={16} aria-hidden="true" />
                    </button>
                  </span>
                )
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {modale && connecte && <ModaleConge employe={connecte} onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
