import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, Search, X, ArrowRight, Download } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_RH, ROLES_RH, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { creerEmploye, listerContrats, listerEmployes, listerUsersMini } from '../api/ressources.js';
import { telechargerPdf } from '../api/finance.js';
import { messageErreur } from '../api/client.js';

/* Employés — API réelle (SPEC §5.5 : fiches liées aux comptes User). */

function ModaleEmploye({ users, onFermer, onCreer }) {
  const compteParDefaut = (id) => users.find((u) => String(u.id) === String(id));
  const [form, setForm] = useState(() => {
    const u = users[0];
    return { user: u?.id ?? '', fonction: u?.poste_titre ?? '', date_embauche: '' };
  });
  const [erreur, setErreur] = useState('');
  const compte = compteParDefaut(form.user);
  const nomCompte = compte ? [compte.first_name, compte.last_name].filter(Boolean).join(' ') || compte.email : '—';
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const choisirCompte = (id) => {
    const u = compteParDefaut(id);
    setForm((f) => ({ ...f, user: id, fonction: u?.poste_titre ?? f.fonction }));
    setErreur('');
  };
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  const soumettre = (e) => {
    e.preventDefault();
    if (!form.user) {
      setErreur('Choisissez le compte utilisateur lié à la fiche.');
      return;
    }
    if (form.fonction.trim().length < 2) {
      setErreur('Ce compte n a pas de poste : renseignez d abord le poste sur le compte utilisateur (Paramètres > Utilisateurs > Modifier).');
      return;
    }
    onCreer({ user: Number(form.user), fonction: form.fonction.trim(), date_embauche: form.date_embauche || null });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvel employé">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">RH</p>
            <h2 className="!text-[26px]">Nouvel employé</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="em-user">Compte utilisateur *</Label>
            <select id="em-user" value={form.user} onChange={(e) => choisirCompte(e.target.value)} className={selectCls}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email} · {u.role}</option>)}
            </select>
            {compte && (
              <p className="dg-legende mt-esp-2">
                {[compte.first_name, compte.last_name].filter(Boolean).join(' ') || 'Prénom/nom non renseignés sur le compte'}
                {compte.poste_titre ? ` — ${compte.poste_titre}` : ' — poste non renseigné'}
                {compte.department_nom ? ` (${compte.department_nom})` : ''}. La fonction reprend le poste et n est pas modifiable ici.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="em-nom">Prénom et nom (depuis le compte)</Label>
              <div className="mt-esp-2"><Input id="em-nom" value={nomCompte} disabled /></div>
            </div>
            <div>
              <Label htmlFor="em-fonction">Fonction (poste du compte)</Label>
              <div className="mt-esp-2"><Input id="em-fonction" value={form.fonction} disabled placeholder="Reprise du poste" /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="em-embauche">Date d embauche</Label>
            <div className="mt-esp-2"><Input id="em-embauche" type="date" {...champ('date_embauche')} /></div>
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

export default function Employes() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [modale, setModale] = useState(false);
  const [employes, setEmployes] = useState([]);
  const [contrats, setContrats] = useState({});
  const [usersLibres, setUsersLibres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '') => {
    try {
      const [es, us, cs] = await Promise.all([listerEmployes(), listerUsersMini(), listerContrats().catch(() => [])]);
      const lies = new Set(es.map((e) => e.user));
      setEmployes(es.filter((e) => q === '' || e.email.toLowerCase().includes(q) || (e.fonction ?? '').toLowerCase().includes(q)));
      setContrats(Object.fromEntries((cs ?? []).filter((c) => c.employe).map((c) => [c.employe, c])));
      setUsersLibres(us.filter((u) => !lies.has(u.id)));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des employés impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const creer = async (data) => {
    try {
      const e = await creerEmploye(data);
      setModale(false);
      notifier({ type: 'succes', titre: 'Employé créé', texte: `${e.email} — ${e.fonction}. Le contrat sera rédigé côté Juridique.` });
      charger(recherche.trim().toLowerCase());
    } catch (err) {
      notifier({ type: 'info', titre: 'Création impossible', texte: messageErreur(err) });
    }
  };

  const pdfContrat = async (c) => {
    try {
      await telechargerPdf(`/juridique/contracts/${c.id}/pdf/`, `contrat-${c.id}.pdf`);
    } catch (e) {
      notifier({ type: 'info', titre: 'PDF impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_RH)) {
    return (
      <AccesRestreint
        titre="Employés réservés aux RH"
        requis="Seuls les membres des Ressources Humaines suivent les fiches employés."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef RH étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_RH);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">RH</p>
          <h1 className="mt-esp-2">Employés</h1>
        </div>
        {peutValider && (
        <Button onClick={() => setModale(true)} disabled={usersLibres.length === 0}>
          <Plus size={20} aria-hidden="true" /> Nouvel employé
        </Button>
        )}
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="E-mail, fonction…" aria-label="Rechercher un employé" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          {chargement ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Employé', 'Fonction', 'Congés', 'Statut', 'Contrat'].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employes.map((e) => (
                <tr key={e.id} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3">
                    <span className="block font-courant text-[17px] font-semibold text-gris-900">{e.email}</span>
                  </td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{e.fonction || '—'}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700 dg-tnum">{e.solde_conges} j</td>
                  <td className="px-esp-3 py-esp-3">
                    {e.en_conge ? <Badge ton="alerte">En congé</Badge> : <Badge ton="succes">Présent</Badge>}
                  </td>
                  <td className="px-esp-3 py-esp-3">
                    {contrats[e.id] ? (
                      <button
                        type="button"
                        onClick={() => pdfContrat(contrats[e.id])}
                        aria-label={`Télécharger le contrat de ${e.email}`}
                        title={`${contrats[e.id].titre} — rédigé par le Juridique, téléchargement seul`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile"
                      >
                        <Download size={20} aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="font-courant text-[15px] text-gris-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!chargement && !erreur && employes.length === 0 && (
            <p className="px-esp-5 py-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun employé avec cette recherche.</p>
          )}
        </CardBody>
      </Card>
      <p className="mt-esp-3">
        <Link to="/rh/conges" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          Gérer les congés <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>

      {modale && <ModaleEmploye users={usersLibres} onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
