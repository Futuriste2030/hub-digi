import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, X, Wallet } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { creerDepense, listerDepenses, supprimerDepense } from '../api/finance.js';
import { messageErreur } from '../api/client.js';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { ROLES_CHEF_FINANCE, ROLES_FINANCE, peutVoir } from '../lib/acces.js';
import { fCFA } from '../utils/stats.js';

/* Dépenses — API réelle, suivi par département. */

const DEPARTEMENTS = ['Administration', 'Communication', 'Développement', 'RH', 'Juridique', 'Finance'];
const MOYENS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'carte', label: 'Carte' },
];
const MOYEN_LABEL = Object.fromEntries(MOYENS.map((m) => [m.id, m.label]));
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};

function ModaleDepense({ onFermer, onCreer }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, libelle: '', departement: DEPARTEMENTS[0], montant: '', moyen: 'especes' });
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
    if (form.libelle.trim().length < 3) {
      setErreur('Décrivez la dépense en au moins 3 caractères.');
      return;
    }
    if (!form.date || !(Number(form.montant) > 0)) {
      setErreur('Indiquez une date et un montant valides.');
      return;
    }
    onCreer({ libelle: form.libelle.trim(), date: form.date, departement: form.departement, montant: Number(form.montant), moyen: form.moyen });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle dépense">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative w-full max-w-[480px] rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Finance</p>
            <h2 className="!text-[26px]">Nouvelle dépense</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="dp-libelle">Libellé</Label>
            <div className="mt-esp-2"><Input id="dp-libelle" autoFocus {...champ('libelle')} placeholder="Ex. Loyer bureau" /></div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dp-date">Date</Label>
              <div className="mt-esp-2"><Input id="dp-date" type="date" {...champ('date')} /></div>
            </div>
            <div>
              <Label htmlFor="dp-montant">Montant (F CFA)</Label>
              <div className="mt-esp-2"><Input id="dp-montant" inputMode="numeric" {...champ('montant')} placeholder="500000" /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dp-dept">Département</Label>
              <select id="dp-dept" {...champ('departement')} className={selectCls}>
                {DEPARTEMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="dp-moyen">Moyen</Label>
              <select id="dp-moyen" value={form.moyen} onChange={(e) => setForm((f) => ({ ...f, moyen: e.target.value }))} className={selectCls}>
                {MOYENS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Ajouter</Button>
        </div>
      </form>
    </div>
  );
}

export default function Depenses() {
  const { notifier, session } = useOutletContext();
  const [departement, setDepartement] = useState('Tous');
  const [modale, setModale] = useState(false);
  const [depenses, setDepenses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (dept = 'Tous') => {
    try {
      const ds = await listerDepenses(dept === 'Tous' ? {} : { departement: dept });
      setDepenses(ds);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des dépenses impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    charger(departement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departement]);

  const total = depenses.reduce((s, d) => s + Number(d.montant ?? 0), 0);

  const creer = async (data) => {
    try {
      const d = await creerDepense(data);
      setModale(false);
      notifier({ type: 'succes', titre: 'Dépense ajoutée', texte: `${d.libelle} — ${fCFA(Number(d.montant))}.` });
      charger(departement);
    } catch (e) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (d) => {
    try {
      await supprimerDepense(d.id);
      notifier({ type: 'succes', titre: 'Dépense supprimée', texte: `${d.libelle} — ${fCFA(Number(d.montant))} effacée.` });
      charger(departement);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ROLES_CHEF_FINANCE);

  if (!peutVoir(session, ROLES_FINANCE)) {
    return (
      <AccesRestreint
        titre="Finance réservée"
        requis="Seuls les membres du département Finance suivent ces documents."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Finance étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Finance</p>
          <h1 className="mt-esp-2">Dépenses</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle dépense
        </Button>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
        <Card survol={false}>
          <CardBody className="flex items-center gap-esp-4 pt-esp-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
              <Wallet size={20} aria-hidden="true" className="text-digi" />
            </span>
            <span>
              <span className="block font-courant text-[15px] text-gris-600">Total {departement === 'Tous' ? 'général' : departement}</span>
              <span className="font-titrage text-[18px] font-bold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(total)}</span>
            </span>
          </CardBody>
        </Card>
        <select value={departement} onChange={(e) => setDepartement(e.target.value)} aria-label="Filtrer par département" className="h-11 min-h-[44px] w-full self-center rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
          {['Tous', ...DEPARTEMENTS].map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Date', 'Libellé', 'Département', 'Montant', ''].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr key={d.id} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3 font-mono text-[13px] text-gris-600 dg-tnum">{dateFr(d.date)}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-900">{d.libelle}<span className="block font-courant text-[13px] text-gris-600">{MOYEN_LABEL[d.moyen] ?? d.moyen}</span></td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{d.departement}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] font-semibold text-gris-900 dg-tnum whitespace-nowrap">{fCFA(Number(d.montant ?? 0))}</td>
                  <td className="px-esp-3 py-esp-3 text-right">
                    {peutSupprimer && (
                      <BoutonSupprimer
                        titre={`Supprimer ${d.libelle}`}
                        libelle={d.libelle}
                        texte="Supprimer définitivement la dépense"
                        onConfirmer={() => supprimer(d)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && depenses.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucune dépense pour ce département.</p>
          )}
        </CardBody>
      </Card>

      {modale && <ModaleDepense onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
