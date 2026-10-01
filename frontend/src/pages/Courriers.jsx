import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, ArrowLeft, Printer, Pencil, Stamp, Inbox, Send } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_SECRETARIAT, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import Entete, { PiedEntete } from '../components/doc/Entete.jsx';
import EditeurRiche from '../components/editeur/EditeurRiche.jsx';
import { creerCourrier, listerCourriers, majCourrier, supprimerCourrier } from '../api/tickets.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';

/* Registre Courriers Secrétariat — API réelle : entrants/sortants numérotés, rédaction, workflow. */

const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';
const texteBrut = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();

const SENS_LABEL = { entrant: 'Entrant', sortant: 'Sortant' };
const STATUTS = [
  { id: 'brouillon', label: 'Brouillon' },
  { id: 'envoye', label: 'Envoyé' },
  { id: 'recu', label: 'Reçu' },
  { id: 'traite', label: 'Traité' },
  { id: 'archive', label: 'Archivé' },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.id, s.label]));
const STATUT_TON = { brouillon: 'neutre', envoye: 'info', recu: 'alerte', traite: 'succes', archive: 'neutre' };
const TRANSITIONS = {
  brouillon: ['envoye', 'archive'],
  envoye: ['traite', 'archive'],
  recu: ['traite', 'archive'],
  traite: ['archive'],
  archive: [],
};
const correspondantDe = (c) => (c.sens === 'sortant' ? c.destinataire : c.expediteur) || '—';
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};

export default function Courriers() {
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [vue, setVue] = useState('liste');
  const [courrierId, setCourrierId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [sens, setSens] = useState('tous');
  const [statut, setStatut] = useState('tous');
  const [courriers, setCourriers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState('');

  const [fSens, setFSens] = useState('sortant');
  const [correspondant, setCorrespondant] = useState('');
  const [objet, setObjet] = useState('');
  const [contenu, setContenu] = useState('<p>Madame, Monsieur,</p><p>Par la présente, nous vous informons que…</p><p>Cordialement,</p>');
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', sn = 'tous', st = 'tous') => {
    try {
      const cs = await listerCourriers({
        ...(q ? { search: q } : {}),
        ...(sn !== 'tous' ? { sens: sn } : {}),
        ...(st !== 'tous' ? { statut: st } : {}),
      });
      setCourriers(cs);
      setErreurListe('');
    } catch (e) {
      setErreurListe(messageErreur(e, 'Chargement du registre impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), sens, statut), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, sens, statut]);

  const actif = courriers.find((c) => c.id === courrierId);
  const transitions = actif ? (TRANSITIONS[actif.statut] ?? []) : [];
  const modifiable = actif && ['brouillon', 'recu'].includes(actif.statut);

  const nouveau = () => {
    setCourrierId(null);
    setFSens('sortant');
    setCorrespondant('');
    setObjet('');
    setContenu('<p>Madame, Monsieur,</p><p>Par la présente, nous vous informons que…</p><p>Cordialement,</p>');
    setErreur('');
    setVue('editeur');
  };

  const modifier = () => {
    if (!actif) return;
    setCourrierId(actif.id);
    setFSens(actif.sens);
    setCorrespondant(correspondantDe(actif) === '—' ? '' : correspondantDe(actif));
    setObjet(actif.objet);
    setContenu(actif.contenu || '');
    setErreur('');
    setVue('editeur');
  };

  const payloadCor = () => (fSens === 'sortant'
    ? { destinataire: correspondant.trim(), expediteur: '' }
    : { expediteur: correspondant.trim(), destinataire: '' });

  const enregistrer = async () => {
    if (correspondant.trim().length < 2) {
      setErreur('Indiquez le correspondant (expéditeur ou destinataire).');
      return;
    }
    if (objet.trim().length < 3) {
      setErreur('Donnez un objet d au moins 3 caractères.');
      return;
    }
    if (texteBrut(contenu).length < 20) {
      setErreur('Rédigez au moins 20 caractères de contenu.');
      return;
    }
    try {
      if (courrierId) {
        await majCourrier(courrierId, { ...payloadCor(), objet: objet.trim(), contenu });
        notifier({ type: 'succes', titre: 'Courrier enregistré', texte: objet.trim() });
      } else {
        const c = await creerCourrier({ sens: fSens, objet: objet.trim(), contenu, ...payloadCor() });
        setCourrierId(c.id);
        notifier({ type: 'succes', titre: 'Courrier enregistré', texte: `${c.reference} — Brouillon.` });
      }
      setVue('detail');
      charger(recherche.trim(), sens, statut);
    } catch (e) {
      setErreur(messageErreur(e, 'Enregistrement impossible.'));
    }
  };

  const avancer = async (s) => {
    if (!actif) return;
    try {
      await majCourrier(actif.id, { statut: s });
      notifier({ type: 'succes', titre: 'Statut actualisé', texte: `${actif.reference} — ${STATUT_LABEL[s]}.` });
      charger(recherche.trim(), sens, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Transition impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (c) => {
    try {
      await supprimerCourrier(c.id);
      notifier({ type: 'succes', titre: 'Courrier supprimé', texte: `${c.reference} — brouillon effacé.` });
      setVue('liste');
      charger(recherche.trim(), sens, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_SECRETARIAT)) {
    return (
      <AccesRestreint
        titre="Courriers réservés au Secrétariat"
        requis="Seuls les membres du Secrétariat suivent le registre des courriers."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Secrétariat étudiera votre accès.' })}
      />
    );
  }

  if (vue === 'detail' && actif) {
    return (
      <div>
        <div className="dg-no-print flex flex-wrap items-center gap-esp-3">
          <Button variante="fantome" onClick={() => setVue('liste')}>
            <ArrowLeft size={20} aria-hidden="true" /> Registre
          </Button>
          <Badge ton={actif.sens === 'sortant' ? 'info' : 'alerte'}>{SENS_LABEL[actif.sens]}</Badge>
          <Badge ton={STATUT_TON[actif.statut] ?? 'neutre'}>{STATUT_LABEL[actif.statut] ?? actif.statut}</Badge>
          <span className="mr-auto" />
          {actif.statut === 'brouillon' && (
            <BoutonSupprimer
              titre={`Supprimer ${actif.reference}`}
              libelle={actif.objet}
              texte="Supprimer définitivement le courrier brouillon"
              onConfirmer={() => supprimer(actif)}
            />
          )}
          {transitions.map((s) => (
            <Button key={s} variante="secondaire" onClick={() => avancer(s)}>
              <Stamp size={20} aria-hidden="true" /> {STATUT_LABEL[s]}
            </Button>
          ))}
          {modifiable && (
            <Button variante="secondaire" onClick={modifier}>
              <Pencil size={20} aria-hidden="true" /> Modifier
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" /> Imprimer / PDF
          </Button>
        </div>
        <div className="dg-print-doc mx-auto mt-esp-6 w-full max-w-[800px] rounded-lg border border-gris-300 bg-gris-0 p-esp-6 shadow-ombre-1">
          <Entete entreprise={entreprise} />
          <h1 className="mt-esp-5 text-center !text-[26px]">{actif.objet}</h1>
          <p className="mt-esp-2 text-center font-courant text-[15px] text-gris-600">
            <span className="font-mono">Réf. {actif.reference}</span> · {actif.sens === 'sortant' ? 'Destinataire' : 'Expéditeur'} : <strong className="text-gris-900">{correspondantDe(actif)}</strong> · {dateFr(actif.date)}
          </p>
          <div className="dg-doc mt-esp-5 font-courant text-[17px] leading-[1.65] text-gris-700" dangerouslySetInnerHTML={{ __html: actif.contenu || '' }} />
          <div className="mt-esp-7 flex justify-end">
            <div className="px-esp-6 pt-esp-2 text-center">
              {entreprise.cachetSecretariat ? (
                <img src={entreprise.cachetSecretariat} alt="Cachet du Secrétariat" className="mx-auto h-28 w-auto object-contain" />
              ) : null}
              <p className="mt-esp-2 border-t border-gris-400 px-esp-6 pt-esp-2 font-courant text-[13px] text-gris-600">
                Le Secrétariat<br /><em>Signature et cachet</em>
              </p>
            </div>
          </div>
          <PiedEntete entreprise={entreprise} />
        </div>
      </div>
    );
  }

  if (vue === 'editeur') {
    return (
      <div>
        <button type="button" onClick={() => setVue(courrierId ? 'detail' : 'liste')} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Registre
        </button>
        <div className="mt-esp-2">
          <p className="dg-surtitre">Secrétariat</p>
          <h1 className="mt-esp-2">{courrierId ? 'Modifier le courrier' : 'Nouveau courrier'}</h1>
        </div>
        <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
          <div className="flex flex-col gap-esp-4">
            {!courrierId && (
              <div>
                <Label htmlFor="co-sens">Sens</Label>
                <select id="co-sens" value={fSens} onChange={(e) => setFSens(e.target.value)} className={selectCls}>
                  <option value="sortant">Sortant</option>
                  <option value="entrant">Entrant</option>
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="co-cor">{fSens === 'sortant' ? 'Destinataire' : 'Expéditeur'}</Label>
              <div className="mt-esp-2"><Input id="co-cor" autoFocus value={correspondant} onChange={(e) => { setCorrespondant(e.target.value); setErreur(''); }} placeholder="Ex. Orange Mali" /></div>
            </div>
            <div>
              <Label htmlFor="co-obj">Objet</Label>
              <div className="mt-esp-2"><Input id="co-obj" value={objet} onChange={(e) => { setObjet(e.target.value); setErreur(''); }} placeholder="Ex. Relance facture" /></div>
            </div>
            {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
            <div className="flex gap-esp-3">
              <Button onClick={enregistrer}>Enregistrer</Button>
              <Button variante="fantome" onClick={() => setVue(courrierId ? 'detail' : 'liste')}>Annuler</Button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <EditeurRiche valeurInitiale={contenu} cle={`courrier-${courrierId || 'new'}`} onChanger={setContenu} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Secrétariat</p>
          <h1 className="mt-esp-2">Courriers</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Registre numéroté : sortants à envoyer, entrants à traiter, puis archivage.
          </p>
        </div>
        <Button onClick={nouveau}>
          <Plus size={20} aria-hidden="true" /> Nouveau courrier
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-3">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, objet, correspondant…" aria-label="Rechercher un courrier" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={sens} onChange={(e) => setSens(e.target.value)} aria-label="Filtrer par sens" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          <option value="tous">Tous sens</option>
          <option value="sortant">Sortant</option>
          <option value="entrant">Entrant</option>
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          <option value="tous">Tous statuts</option>
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="flex flex-col gap-esp-1 pt-esp-3">
          {chargement ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreurListe ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-erreur" role="alert">{erreurListe}</p>
          ) : (
          <>
          {courriers.length === 0 && <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600">Aucun courrier avec ces filtres.</p>}
          {courriers.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-esp-3 rounded-lg px-esp-3 py-esp-3 text-left transition-colors duration-rapide hover:bg-gris-100"
            >
              <button
                type="button"
                onClick={() => { setCourrierId(c.id); setVue('detail'); }}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-esp-3 text-left"
                aria-label={`Ouvrir ${c.objet}`}
              >
                {c.sens === 'sortant'
                  ? <Send size={18} aria-hidden="true" className="shrink-0 text-digi" />
                  : <Inbox size={18} aria-hidden="true" className="shrink-0 text-alerte" />}
                <span className="min-w-48 flex-1">
                  <span className="block font-courant text-[15px] font-semibold text-gris-900">{c.objet}</span>
                  <span className="block font-courant text-[13px] text-gris-600"><span className="font-mono">{c.reference}</span> · {correspondantDe(c)} · {dateFr(c.date)}</span>
                </span>
                <Badge ton={c.sens === 'sortant' ? 'info' : 'alerte'}>{SENS_LABEL[c.sens]}</Badge>
                <Badge ton={STATUT_TON[c.statut] ?? 'neutre'}>{STATUT_LABEL[c.statut] ?? c.statut}</Badge>
              </button>
              {c.statut === 'brouillon' && (
                <BoutonSupprimer
                  titre={`Supprimer ${c.reference}`}
                  libelle={c.objet}
                  texte="Supprimer définitivement le courrier brouillon"
                  onConfirmer={() => supprimer(c)}
                />
              )}
            </div>
          ))}
          </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
