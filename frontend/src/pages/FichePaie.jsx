import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Upload, Trash2, Stamp } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { API_URL } from '../api/client.js';
import {
  ajouterLignePaie, cloturerFichePaie, detailFichePaie, envoyerCachet, majLignePaie, retirerCachet,
} from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { fCFA } from '../utils/stats.js';
import { NonTrouve } from './Pages.jsx';

/* Fiche de paye mensuelle — API réelle : tableau façon tableur (clic, saisie, Entrée).
   À la dernière colonne, le bouton Enregistrer apparaît. */

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DEPARTEMENTS = ['Administration', 'Communication', 'Développement', 'RH', 'Juridique', 'Finance'];
const STATUT_OPTIONS = [
  { v: 'en_attente', l: 'En attente' },
  { v: 'paye', l: 'Payé' },
];
const STATUT_LABEL = Object.fromEntries(STATUT_OPTIONS.map((o) => [o.v, o.l]));
const COLONNES_PAIE = [
  { id: 'departement', libelle: 'Département', type: 'select', options: DEPARTEMENTS },
  { id: 'prenom', libelle: 'Prénom', type: 'text' },
  { id: 'nom', libelle: 'Nom', type: 'text' },
  { id: 'fonction', libelle: 'Fonction', type: 'text' },
  { id: 'montant', libelle: 'Montant (F)', type: 'number' },
  { id: 'statut', libelle: 'Statut', type: 'select', options: STATUT_OPTIONS },
  { id: 'date', libelle: 'Date', type: 'text' },
];

const origineApi = API_URL.split('/api/')[0];

export default function FichePaie() {
  const { id } = useParams();
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [fiche, setFiche] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  const [cellule, setCellule] = useState(null);
  const [valeur, setValeur] = useState('');
  const [brouillon, setBrouillon] = useState({});
  const [avertissement, setAvertissement] = useState('');
  const inputCachet = useRef(null);

  const charger = async () => {
    try {
      setFiche(await detailFichePaie(id));
    } catch (e) {
      if (e.response?.status === 404) setIntrouvable(true);
      else notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    }
  };

  useEffect(() => { charger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (introuvable) return <NonTrouve />;

  const verrouillee = fiche?.statut === 'cloturee';
  const total = fiche?.total ?? 0;
  const complet = fiche && COLONNES_PAIE.every((c) => String(brouillon[c.id] ?? '').trim() !== '');

  const valeurCellule = (ligne, col) => {
    if (ligne === 'new') return brouillon[col] ?? '';
    if (col === 'statut') return STATUT_LABEL[ligne.statut] ?? ligne.statut;
    if (col === 'montant') return ligne.montant === '' ? '' : String(ligne.montant);
    return ligne[col] ?? '';
  };

  const ouvrir = (ligne, col) => {
    if (verrouillee) return;
    const courant = ligne === 'new' ? (brouillon[col] ?? '') : String(ligne[col] ?? '');
    setCellule({ ligne: ligne === 'new' ? 'new' : ligne.numero, col });
    setValeur(courant);
  };

  const confirmer = async (avancer = true, valeurForcee = null) => {
    if (!cellule) return;
    const { ligne, col } = cellule;
    const val = valeurForcee ?? valeur;
    const idx = COLONNES_PAIE.findIndex((c) => c.id === col);
    if (ligne === 'new') {
      const nb = { ...brouillon, [col]: val };
      setBrouillon(nb);
      setCellule(null);
      if (avancer && idx < COLONNES_PAIE.length - 1) {
        const suivant = COLONNES_PAIE[idx + 1].id;
        setCellule({ ligne: 'new', col: suivant });
        setValeur(nb[suivant] ?? '');
      }
    } else {
      const patch = col === 'montant' ? { montant: Number(val) || 0 } : { [col]: val };
      try {
        await majLignePaie(fiche.id, ligne, patch);
        await charger();
      } catch (e) {
        notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
      }
      setCellule(null);
      if (avancer && idx < COLONNES_PAIE.length - 1) {
        const suivant = COLONNES_PAIE[idx + 1].id;
        setCellule({ ligne, col: suivant });
        const l = fiche.lignes.find((x) => x.numero === ligne);
        setValeur(String(l?.[suivant] ?? ''));
      }
    }
  };

  const enregistrer = async () => {
    try {
      const ligne = await ajouterLignePaie(fiche.id, {
        ...brouillon,
        montant: Number(brouillon.montant) || 0,
      });
      setBrouillon({});
      setCellule(null);
      await charger();
      notifier({ type: 'succes', titre: 'Ligne enregistrée', texte: `${ligne.numero} — ${ligne.prenom} ${ligne.nom}, ${fCFA(Number(ligne.montant))}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
    }
  };

  const cloturer = async () => {
    if (!fiche.cachet) {
      setAvertissement('Cachet du directeur financier manquant : importez le cachet avant de clôturer la fiche.');
      notifier({ type: 'alerte', titre: 'Clôture bloquée', texte: 'Importez le cachet du directeur financier pour clôturer.' });
      inputCachet.current?.focus();
      return;
    }
    try {
      await cloturerFichePaie(fiche.id);
      setAvertissement('');
      await charger();
      notifier({ type: 'succes', titre: 'Fiche clôturée', texte: `${MOIS[fiche.mois_idx]} ${fiche.annee} — saisie verrouillée.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Clôture impossible', texte: messageErreur(e) });
    }
  };

  const importerCachet = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (!fichier.type.startsWith('image/')) {
      setAvertissement('Fichier refusé : importez une image (PNG, JPG ou WebP).');
      return;
    }
    if (fichier.size > 2 * 1024 * 1024) {
      setAvertissement('Image trop lourde : 2 Mo maximum pour le cachet.');
      return;
    }
    try {
      await envoyerCachet(fiche.id, fichier);
      setAvertissement('');
      await charger();
      notifier({ type: 'succes', titre: 'Cachet importé', texte: `${fichier.name} — clôture désormais possible.` });
    } catch (err) {
      setAvertissement(messageErreur(err, 'Import impossible.'));
    }
  };

  const retirerLeCachet = async () => {
    try {
      await retirerCachet(fiche.id);
      setAvertissement('');
      await charger();
      notifier({ type: 'info', titre: 'Cachet retiré', texte: 'La clôture est de nouveau bloquée.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Retrait impossible', texte: messageErreur(e) });
    }
  };

  const editerCellule = (ligne, col, cle) => {
    const estOuverte = cellule && (cellule.ligne === (ligne === 'new' ? 'new' : ligne.numero)) && cellule.col === col;
    const colDef = COLONNES_PAIE.find((c) => c.id === col);
    if (estOuverte) {
      if (colDef.type === 'select') {
        return (
          <select
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={valeur}
            onChange={(e) => { const v = e.target.value; setValeur(v); confirmer(false, v); }}
            onBlur={() => confirmer(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmer(true);
              if (e.key === 'Escape') setCellule(null);
            }}
            aria-label={`${colDef.libelle} ${cle}`}
            className="h-11 min-h-[44px] w-full rounded-md border border-digi bg-gris-0 px-esp-2 font-courant text-[15px]"
          >
            {colDef.options.map((o) => {
              const v = typeof o === 'string' ? o : o.v;
              const l = typeof o === 'string' ? o : o.l;
              return <option key={v} value={v}>{l}</option>;
            })}
          </select>
        );
      }
      return (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type={colDef.type === 'number' ? 'number' : 'text'}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          onBlur={() => confirmer(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmer(true);
            if (e.key === 'Escape') setCellule(null);
          }}
          aria-label={`${colDef.libelle} ${cle}`}
          className="h-11 min-h-[44px] w-full rounded-md border border-digi bg-gris-0 px-esp-2 font-courant text-[15px] dg-tnum"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => ouvrir(ligne, col)}
        disabled={verrouillee}
        aria-label={`Saisir ${colDef.libelle} ${cle}`}
        className="flex min-h-[44px] w-full items-center rounded-md px-esp-2 text-left font-courant text-[15px] text-gris-700 transition-colors duration-rapide hover:bg-digi-voile disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className={col === 'montant' ? 'dg-tnum' : ''}>{valeurCellule(ligne, col) || <span className="text-gris-400">Cliquer pour saisir…</span>}</span>
      </button>
    );
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

  if (!fiche) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }

  const cachetUrl = fiche.cachet ? `${origineApi}${fiche.cachet}` : null;

  return (
    <div>
      <div className="dg-no-print">
        <Link to="/finance/paie" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Paie des employés
        </Link>
        <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
          <div className="mr-auto">
            <p className="dg-surtitre">Finance · Paie</p>
            <h1 className="mt-esp-2">Fiche {MOIS[fiche.mois_idx]} {fiche.annee}</h1>
            <div className="mt-esp-2 flex flex-wrap items-center gap-esp-2">
              <Badge ton={verrouillee ? 'succes' : 'alerte'}>{verrouillee ? 'Clôturée' : 'Brouillon'}</Badge>
              <Badge ton="neutre">Total : {fCFA(Number(total))}</Badge>
            </div>
          </div>
          {!verrouillee && peutValider && (
            <Button
              variante="secondaire"
              onClick={cloturer}
              title={fiche.cachet ? 'Clôturer la fiche' : 'Cachet requis pour clôturer'}
            >
              <Lock size={20} aria-hidden="true" /> Clôturer la fiche
            </Button>
          )}
          <Button variante="fantome" onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>
        {avertissement && !verrouillee && (
          <div className="mt-esp-4 max-w-[70ch]">
            <Alert ton="alerte" titre="Clôture impossible sans cachet">{avertissement}</Alert>
          </div>
        )}
      </div>

      <Card survol={false} className="dg-print-doc mt-esp-6">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-marine-profond">
                <th scope="col" className="px-esp-2 pb-esp-2 font-mono text-[13px] text-gris-600">N°</th>
                {COLONNES_PAIE.map((c) => (
                  <th key={c.id} scope="col" className="px-esp-2 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{c.libelle}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiche.lignes.map((l) => (
                <tr key={l.numero} className="border-b border-gris-200">
                  <td className="px-esp-2 py-esp-1 font-mono text-[13px] text-gris-600 dg-tnum whitespace-nowrap">{l.numero}</td>
                  {COLONNES_PAIE.map((c) => (
                    <td key={c.id} className="min-w-28 px-esp-1 py-esp-1">{editerCellule(l, c.id, l.numero)}</td>
                  ))}
                </tr>
              ))}
              {!verrouillee && (
                <tr className="bg-digi-voile/40">
                  <td className="px-esp-2 py-esp-1 font-mono text-[13px] text-gris-400 dg-tnum">Auto</td>
                  {COLONNES_PAIE.map((c) => (
                    <td key={c.id} className="min-w-28 px-esp-1 py-esp-1">{editerCellule('new', c.id, 'nouvelle ligne')}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          {fiche.lignes.length === 0 && verrouillee && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Fiche vide.</p>
          )}
        </CardBody>
        <div className="flex flex-wrap items-end justify-between gap-esp-4 px-esp-5 py-esp-4">
          <div className="flex flex-wrap items-end gap-esp-4">
            <div>
              <p className="font-courant text-[15px] text-gris-700">
                Signature Finance : <em className="font-semibold text-gris-900">{entreprise.signataire}</em>
              </p>
              <p className="dg-legende mt-esp-1">Directeur financier — signature et cachet</p>
              {cachetUrl && (
                <img
                  src={cachetUrl}
                  alt="Cachet du directeur financier"
                  className="mt-esp-2 h-24 w-auto rounded-md border border-gris-300 bg-gris-0 object-contain"
                />
              )}
            </div>
            {!verrouillee && peutValider && (
              <div className="dg-no-print rounded-lg border border-dashed border-gris-300 bg-gris-100 p-esp-3">
                <p className="flex items-center gap-esp-2 font-courant text-[15px] font-semibold text-gris-900">
                  <Stamp size={18} aria-hidden="true" className="text-digi" /> Cachet du directeur
                  {!fiche.cachet && <Badge ton="alerte">Requis pour clôturer</Badge>}
                </p>
                <input
                  ref={inputCachet}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={importerCachet}
                  aria-label="Importer le cachet du directeur financier"
                  className="mt-esp-2 block w-full max-w-[260px] font-courant text-[14px] text-gris-700"
                />
                <p className="dg-legende mt-esp-1">PNG, JPG ou WebP · 2 Mo max.</p>
                <div className="mt-esp-2 flex flex-wrap gap-esp-2">
                  <Button variante="secondaire" taille="sm" onClick={() => inputCachet.current?.click()}>
                    <Upload size={16} aria-hidden="true" /> {fiche.cachet ? 'Remplacer' : 'Importer'}
                  </Button>
                  {fiche.cachet && (
                    <Button variante="fantome" taille="sm" onClick={retirerLeCachet}>
                      <Trash2 size={16} aria-hidden="true" /> Retirer
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="font-titrage text-[18px] font-bold text-gris-900 dg-tnum">Total : {fCFA(Number(total))}</p>
        </div>
      </Card>

      {complet && !verrouillee && (
        <div className="dg-no-print dg-pop mt-esp-4 flex justify-end">
          <Button onClick={enregistrer}>
            <Save size={20} aria-hidden="true" /> Enregistrer la ligne
          </Button>
        </div>
      )}
    </div>
  );
}
