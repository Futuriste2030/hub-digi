import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, Search, KeyRound, UserCheck, UserX, Pencil, X, Save } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import EtatVide from '../components/ui/EtatVide.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { listerDepartements, listerPostes, listerUsers, majUser } from '../api/ressources.js';
import { demanderReset } from '../api/auth.js';
import { messageErreur } from '../api/client.js';
import { LIBELLES_ROLE } from '../data/session.js';

/* Utilisateurs — API réelle (SPEC §5.1 : CRUD + assignation Dept/Poste + reset + disable). */

const selectCls = 'h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';
const ROLES = Object.keys(LIBELLES_ROLE).filter((r) => r !== 'client' && r !== 'super_admin');

export default function Utilisateurs() {
  const { notifier } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [dept, setDept] = useState('tous');
  const [role, setRole] = useState('tous');
  const [statut, setStatut] = useState('Tous');
  const [users, setUsers] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [postes, setPostes] = useState([]);
  const [nomsDepts, setNomsDepts] = useState({});
  const [modifie, setModifie] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', dp = 'tous', ro = 'tous', st = 'Tous') => {
    try {
      const [us, dpts, pst] = await Promise.all([
        listerUsers({
          ...(q ? { search: q } : {}),
          ...(dp !== 'tous' ? { department: dp } : {}),
          ...(ro !== 'tous' ? { role: ro } : {}),
          ...(st === 'Actif' ? { is_active: true } : st === 'Désactivé' ? { is_active: false } : {}),
        }),
        listerDepartements(),
        listerPostes(),
      ]);
      setUsers(us.filter((u) => u.role !== 'super_admin'));
      setDepartements(dpts);
      setPostes(pst.results ?? pst);
      setNomsDepts(Object.fromEntries(dpts.map((d) => [d.id, d.nom])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des utilisateurs impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), dept, role, statut), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, dept, role, statut]);

  const basculer = async (u) => {
    try {
      await majUser(u.id, { is_active: !u.is_active });
      notifier(u.is_active
        ? { type: 'info', titre: 'Compte désactivé', texte: `${u.email} ne peut plus se connecter.` }
        : { type: 'succes', titre: 'Compte activé', texte: `${u.email} peut se connecter.` });
      charger(recherche.trim(), dept, role, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Action impossible', texte: messageErreur(e) });
    }
  };

  const reset = async (u) => {
    try {
      await demanderReset(u.email);
      notifier({ type: 'succes', titre: 'Lien de réinitialisation envoyé', texte: `Mail transmis à ${u.email}.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(e) });
    }
  };

  const enregistrerModification = async (id, payload) => {
    try {
      await majUser(id, payload);
      setModifie(null);
      notifier({ type: 'succes', titre: 'Compte modifié', texte: 'Rôle, département et poste mis à jour.' });
      charger(recherche.trim(), dept, role, statut);
    } catch (e) {
      notifier({ type: 'info', titre: 'Modification impossible', texte: messageErreur(e) });
    }
  };

  const nomAffiche = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

function ModaleModifierUser({ user, departements, postes, onFermer, onEnregistrer }) {
  const [form, setForm] = useState({
    first_name: user.first_name ?? '', last_name: user.last_name ?? '', role: user.role,
    department: user.department?.toString() ?? '', poste: user.poste?.toString() ?? '',
  });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });
  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';
  const postesDept = postes.filter((p) => String(p.department) === String(form.department));

  const changerDepartement = (id) => {
    const duDept = postes.filter((p) => String(p.department) === String(id));
    setForm((f) => ({ ...f, department: id, poste: duDept[0]?.id?.toString() ?? '' }));
    setErreur('');
  };

  const soumettre = async (e) => {
    e.preventDefault();
    if (form.role !== 'client' && form.role !== 'super_admin' && !form.department) {
      setErreur('Choisissez le département.');
      return;
    }
    setEnvoi(true);
    try {
      await onEnregistrer(user.id, {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), role: form.role,
        department: form.role === 'super_admin' ? null : Number(form.department) || null,
        poste: form.poste ? Number(form.poste) : null,
      });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label={`Modifier ${user.email}`}>
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Système · Super Admin</p>
            <h2 className="!text-[26px]">Modifier {user.email}</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mu-prenom">Prénom</Label>
              <div className="mt-esp-2"><Input id="mu-prenom" autoFocus {...champ('first_name')} placeholder="Ex. Moussa" /></div>
            </div>
            <div>
              <Label htmlFor="mu-nom">Nom</Label>
              <div className="mt-esp-2"><Input id="mu-nom" {...champ('last_name')} placeholder="Ex. Koné" /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="mu-role">Rôle</Label>
            <select id="mu-role" {...champ('role')} className={selectCls}>
              {ROLES.map((r) => <option key={r} value={r}>{LIBELLES_ROLE[r]}</option>)}
            </select>
          </div>
          {form.role !== 'super_admin' && form.role !== 'client' && (
            <>
              <div>
                <Label htmlFor="mu-dept">Département</Label>
                <select id="mu-dept" value={form.department} onChange={(e) => changerDepartement(e.target.value)} className={selectCls}>
                  <option value="">— Choisir —</option>
                  {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="mu-poste">Poste</Label>
                <select id="mu-poste" {...champ('poste')} className={selectCls}>
                  <option value="">— Aucun —</option>
                  {postesDept.map((p) => <option key={p.id} value={p.id}>{p.titre} ({p.niveau})</option>)}
                </select>
              </div>
            </>
          )}
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit" chargement={envoi}><Save size={20} aria-hidden="true" /> Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}

  const corps = (u, mobile = false) => (
    <>
      <p className={`font-courant font-semibold text-gris-900 ${mobile ? 'text-[17px]' : 'text-[15px]'}`}>{nomAffiche(u)}</p>
      <p className="font-mono text-[13px] text-gris-600">{u.email}</p>
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Système · Super Admin</p>
          <h1 className="mt-esp-2">Utilisateurs</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            <span className="dg-tnum">{users.length}</span> compte{users.length > 1 ? 's' : ''} — rôle + département + poste.
          </p>
        </div>
        <Link to="/parametres/utilisateurs/nouveau" className="inline-flex min-h-[44px] items-center gap-esp-2 rounded-md bg-digi px-esp-5 font-titrage text-[15px] font-bold uppercase text-blanc shadow-ombre-1 hover:brightness-90">
          <Plus size={20} aria-hidden="true" /> Nouvel utilisateur
        </Link>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail…" aria-label="Rechercher un utilisateur" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filtrer par département" className={selectCls}>
          <option value="tous">Tous</option>
          {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filtrer par rôle" className={selectCls}>
          <option value="tous">Tous</option>
          {ROLES.map((r) => <option key={r} value={r}>{LIBELLES_ROLE[r]}</option>)}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut" className={selectCls}>
          {['Tous', 'Actif', 'Désactivé'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <>
      {/* Tableau ≥ 768px */}
      <Card survol={false} className="mt-esp-4 hidden md:block">
        <CardBody className="overflow-x-auto px-esp-2 pb-esp-2 pt-esp-2">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gris-300">
                {['Personne', 'Département', 'Poste', 'Rôle', 'Statut', 'Actions'].map((col) => (
                  <th key={col} scope="col" className="px-esp-3 pb-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gris-200 last:border-0">
                  <td className="px-esp-3 py-esp-3">{corps(u)}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{u.department ? nomsDepts[u.department] ?? '' : '—'}</td>
                  <td className="px-esp-3 py-esp-3 font-courant text-[15px] text-gris-700">{u.poste_titre ?? '—'}</td>
                  <td className="px-esp-3 py-esp-3"><Badge ton="info">{LIBELLES_ROLE[u.role] ?? u.role}</Badge></td>
                  <td className="px-esp-3 py-esp-3"><Badge ton={u.is_active ? 'succes' : 'neutre'}>{u.is_active ? 'Actif' : 'Désactivé'}</Badge></td>
                  <td className="px-esp-3 py-esp-3">
                    <span className="flex flex-wrap gap-esp-1">
                      <button type="button" onClick={() => setModifie(u)} aria-label={`Modifier ${u.email}`} title="Modifier le compte" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <Pencil size={20} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => reset(u)} aria-label={`Envoyer un lien de réinitialisation à ${u.email}`} title="Envoyer le lien de réinitialisation" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                        <KeyRound size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => basculer(u)}
                        aria-label={u.is_active ? `Désactiver ${u.email}` : `Activer ${u.email}`}
                        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md ${u.is_active ? 'text-erreur hover:bg-erreur-fond' : 'text-succes hover:bg-succes-fond'}`}
                      >
                        {u.is_active ? <UserX size={20} aria-hidden="true" /> : <UserCheck size={20} aria-hidden="true" />}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EtatVide titre="Aucun utilisateur" texte="Aucun compte avec ces filtres." />}
        </CardBody>
      </Card>

      {/* Cartes < 768px */}
      <div className="mt-esp-4 flex flex-col gap-esp-3 md:hidden">
        {users.length === 0 && <Card survol={false}><EtatVide titre="Aucun utilisateur" texte="Aucun compte avec ces filtres." /></Card>}
        {users.map((u) => (
          <Card key={u.id} survol={false}>
            <CardBody className="flex flex-col gap-esp-2 pt-esp-4">
              <div className="flex items-start justify-between gap-esp-2">
                <div>{corps(u, true)}</div>
                <Badge ton={u.is_active ? 'succes' : 'neutre'}>{u.is_active ? 'Actif' : 'Désactivé'}</Badge>
              </div>
              <p className="font-courant text-[15px] text-gris-600">{u.department ? nomsDepts[u.department] ?? '' : '—'} · {LIBELLES_ROLE[u.role] ?? u.role}</p>
              <div className="flex gap-esp-2 border-t border-gris-200 pt-esp-2">
                <Button taille="sm" variante="secondaire" onClick={() => setModifie(u)}><Pencil size={16} aria-hidden="true" /> Modifier</Button>
                <Button taille="sm" variante="secondaire" onClick={() => reset(u)}><KeyRound size={16} aria-hidden="true" /> Reset mdp</Button>
                <Button taille="sm" variante="fantome" onClick={() => basculer(u)}>
                  {u.is_active ? <><UserX size={16} aria-hidden="true" /> Désactiver</> : <><UserCheck size={16} aria-hidden="true" /> Activer</>}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      </>
      )}
      {modifie && <ModaleModifierUser user={modifie} departements={departements} postes={postes} onFermer={() => setModifie(null)} onEnregistrer={enregistrerModification} />}
    </div>
  );
}
