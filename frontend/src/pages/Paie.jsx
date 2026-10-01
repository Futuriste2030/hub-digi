import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, X, ArrowRight, Wallet } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label } from '../components/ui/Input.jsx';
import { creerFichePaie, listerFichesPaie, supprimerFichePaie } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { ROLES_FINANCE, ROLES_CHEF_FINANCE, peutVoir } from '../lib/acces.js';
import { fCFA } from '../utils/stats.js';

/* Paie employés — API réelle : une fiche par mois, lignes saisies dans la fiche. */

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function ModaleFiche({ onFermer, onCreer }) {
  const maintenant = new Date();
  const [moisIdx, setMoisIdx] = useState(maintenant.getMonth());
  const [annee, setAnnee] = useState(maintenant.getFullYear());

  const soumettre = (e) => {
    e.preventDefault();
    onCreer(moisIdx, annee);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Créer une fiche de paye">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Finance · Paie</p>
            <h2 className="!text-[26px]">Créer une fiche de paye</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-esp-3 font-courant text-[15px] text-gris-600">Choisissez le mois. Une fiche vierge se crée (doublon = ouverture de l existante).</p>
        <div className="mt-esp-5 grid grid-cols-2 gap-esp-4">
          <div>
            <Label htmlFor="fp-mois">Mois</Label>
            <select id="fp-mois" value={moisIdx} onChange={(e) => setMoisIdx(Number(e.target.value))} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
              {MOIS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="fp-annee">Année</Label>
            <select id="fp-annee" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
              {[2024, 2025, 2026, 2027].map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Créer la fiche</Button>
        </div>
      </form>
    </div>
  );
}

export default function Paie() {
  const { notifier, session } = useOutletContext();
  const naviguer = useNavigate();
  const [modale, setModale] = useState(false);
  const [fiches, setFiches] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    try {
      setFiches(await listerFichesPaie());
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des fiches impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const creer = async (moisIdx, annee) => {
    try {
      const fiche = await creerFichePaie({ mois_idx: moisIdx, annee });
      setModale(false);
      notifier({ type: 'succes', titre: 'Fiche créée', texte: `${MOIS[moisIdx]} ${annee} — vierge.` });
      naviguer(`/finance/paie/${fiche.id}`);
    } catch (e) {
      if (e.response?.status === 400) {
        const existante = fiches.find((f) => f.mois_idx === moisIdx && f.annee === annee);
        setModale(false);
        notifier({ type: 'info', titre: 'Fiche existante', texte: `${MOIS[moisIdx]} ${annee} déjà créée, ouverture.` });
        if (existante) naviguer(`/finance/paie/${existante.id}`);
      } else {
        notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
      }
    }
  };

  const supprimer = async (f) => {
    try {
      await supprimerFichePaie(f.id);
      notifier({ type: 'succes', titre: 'Fiche supprimée', texte: `${MOIS[f.mois_idx]} ${f.annee} — brouillon effacé.` });
      charger();
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
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
          <h1 className="mt-esp-2">Paie des employés</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Une fiche par mois. Créez, saisissez comme dans un tableur, la signature Finance suit en italique.
          </p>
        </div>
        {peutValider && (
          <Button onClick={() => setModale(true)}>
            <Plus size={20} aria-hidden="true" /> Créer une fiche de paye
          </Button>
        )}
      </div>

      {chargement ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        {fiches.map((f) => {
          const lignes = f.lignes ?? [];
          const total = lignes.reduce((s, l) => s + Number(l.montant ?? 0), 0);
          const payes = lignes.filter((l) => l.statut === 'paye').length;
          return (
            <Card key={f.id} survol={false}>
              <CardBody className="pt-esp-5">
                <div className="flex items-center justify-between gap-esp-3">
                  <span className="flex items-center gap-esp-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                      <Wallet size={20} aria-hidden="true" className="text-digi" />
                    </span>
                    <span>
                      <span className="block font-titrage text-[18px] font-bold text-gris-900">{MOIS[f.mois_idx]} {f.annee}</span>
                      <span className="block font-courant text-[15px] text-gris-600 dg-tnum">{lignes.length} lignes · {payes} payées · {fCFA(total)}</span>
                    </span>
                  </span>
                  <Badge ton={f.statut === 'cloturee' ? 'succes' : 'alerte'}>{f.statut === 'cloturee' ? 'Clôturée' : 'Brouillon'}</Badge>
                </div>
                <div className="mt-esp-3 flex items-center justify-end gap-esp-1 border-t border-gris-200 pt-esp-2">
                  {peutValider && f.statut !== 'cloturee' && (
                    <BoutonSupprimer
                      titre={`Supprimer la fiche ${MOIS[f.mois_idx]} ${f.annee}`}
                      libelle={`${MOIS[f.mois_idx]} ${f.annee}`}
                      texte="Supprimer définitivement la fiche brouillon"
                      onConfirmer={() => supprimer(f)}
                    />
                  )}
                  <Link to={`/finance/paie/${f.id}`} className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
                    Ouvrir la fiche <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      )}
      {!chargement && !erreur && fiches.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune fiche de paye. Créez le premier mois.</p>
      )}

      {modale && <ModaleFiche onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
