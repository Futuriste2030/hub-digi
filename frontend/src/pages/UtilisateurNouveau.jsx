import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Stepper from '../components/ui/Stepper.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { creerUser, listerDepartements, listerPostes } from '../api/ressources.js';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';
import { LIBELLES_ROLE } from '../data/session.js';

/* Nouvel utilisateur — API réelle (SPEC §5.1 : compte + rôle + département + poste). */

const ETAPES = ['Compte', 'Rôle & affectation', 'Récapitulatif'];
const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

export default function UtilisateurNouveau() {
  const naviguer = useNavigate();
  const { notifier } = useOutletContext();
  const [etape, setEtape] = useState(0);
  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', role: 'membre_dev', department: '', poste: '', client: '' });
  const [erreur, setErreur] = useState('');
  const [departements, setDepartements] = useState([]);
  const [postes, setPostes] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    Promise.all([listerDepartements(), listerPostes(), listerClients()]).then(
      ([dpts, pst, cls]) => {
        setDepartements(dpts);
        setPostes(pst);
        setClients(cls.results ?? cls);
        setForm((f) => ({ ...f, department: f.department || dpts[0]?.id?.toString() || '' }));
      },
      () => {},
    );
  }, []);

  const postesDept = postes.filter((p) => String(p.department) === String(form.department));

  const changerDepartement = (id) => {
    const duDept = postes.filter((p) => String(p.department) === String(id));
    setForm((f) => ({ ...f, department: id, poste: duDept[0]?.id?.toString() ?? '' }));
    setErreur('');
  };

  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErreur('');
    },
  });

  const validerEtape = () => {
    if (etape === 0) {
      if (form.username.trim().length < 3) return 'Indiquez un identifiant d au moins 3 caractères.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Adresse e-mail invalide.';
      if (form.password.length < 8) return 'Mot de passe provisoire : 8 caractères minimum.';
      return '';
    }
    if (etape === 1) {
      if (form.role === 'client' && !form.client) return 'Choisissez le compte client lié.';
      if (form.role !== 'client' && form.role !== 'super_admin' && !form.department) return 'Choisissez le département.';
      return '';
    }
    return '';
  };

  const suivant = () => {
    const e = validerEtape();
    if (e) {
      setErreur(e);
      return;
    }
    setErreur('');
    setEtape((x) => Math.min(2, x + 1));
  };

  const creer = async () => {
    try {
      const payload = {
        username: form.username.trim(), email: form.email.trim(),
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        password: form.password, role: form.role,
        department: form.role === 'client' || form.role === 'super_admin' ? null : Number(form.department) || null,
        poste: form.poste ? Number(form.poste) : null,
        client: form.role === 'client' ? Number(form.client) : null,
      };
      const u = await creerUser(payload);
      notifier({ type: 'succes', titre: 'Utilisateur créé', texte: `${u.email} — ${(LIBELLES_ROLE[u.role] ?? u.role)}.` });
      naviguer('/parametres/utilisateurs');
    } catch (err) {
      setErreur(messageErreur(err, 'Création impossible.'));
    }
  };

  const nomDept = departements.find((d) => String(d.id) === String(form.department))?.nom ?? '—';
  const nomPoste = postes.find((p) => String(p.id) === String(form.poste))?.titre ?? '—';

  return (
    <div>
      <Link to="/parametres/utilisateurs" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Utilisateurs
      </Link>
      <div className="mt-esp-2">
        <p className="dg-surtitre">Système · Super Admin</p>
        <h1 className="mt-esp-2">Nouvel utilisateur</h1>
      </div>
      <div className="mt-esp-5 max-w-[720px]">
        <Stepper etapes={ETAPES} courant={etape} />
      </div>

      <Card survol={false} className="mt-esp-5 max-w-[720px]">
        <CardBody className="flex flex-col gap-esp-4 pt-esp-5">
          {etape === 0 && (
            <>
              <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nu-username">Identifiant *</Label>
                  <div className="mt-esp-2"><Input id="nu-username" autoFocus {...champ('username')} placeholder="Ex. moussa.kone" /></div>
                </div>
                <div>
                  <Label htmlFor="nu-email">E-mail pro *</Label>
                  <div className="mt-esp-2"><Input id="nu-email" type="email" {...champ('email')} placeholder="prenom.nom@digicom.ml" /></div>
                </div>
                <div>
                  <Label htmlFor="nu-prenom">Prénom</Label>
                  <div className="mt-esp-2"><Input id="nu-prenom" {...champ('first_name')} placeholder="Ex. Moussa" /></div>
                </div>
                <div>
                  <Label htmlFor="nu-nom">Nom</Label>
                  <div className="mt-esp-2"><Input id="nu-nom" {...champ('last_name')} placeholder="Ex. Koné" /></div>
                </div>
              </div>
              <div>
                <Label htmlFor="nu-mdp">Mot de passe provisoire *</Label>
                <div className="mt-esp-2"><Input id="nu-mdp" type="password" {...champ('password')} placeholder="8+ caractères, transmis à l utilisateur" autoComplete="new-password" /></div>
              </div>
            </>
          )}
          {etape === 1 && (
            <>
              <div>
                <Label htmlFor="nu-role">Rôle *</Label>
                <select id="nu-role" {...champ('role')} className={selectCls}>
                  {Object.entries(LIBELLES_ROLE).filter(([v]) => v !== 'super_admin').map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
                </select>
              </div>
              {form.role === 'client' ? (
                <div>
                  <Label htmlFor="nu-client">Compte client lié *</Label>
                  <select id="nu-client" {...champ('client')} className={selectCls}>
                    <option value="">— Choisir —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
                  </select>
                </div>
              ) : form.role !== 'super_admin' && (
                <>
                  <div>
                    <Label htmlFor="nu-dept">Département</Label>
                    <select id="nu-dept" value={form.department} onChange={(e) => changerDepartement(e.target.value)} className={selectCls}>
                      {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="nu-poste">Poste</Label>
                    <select id="nu-poste" {...champ('poste')} className={selectCls}>
                      <option value="">— Aucun —</option>
                      {postesDept.map((p) => <option key={p.id} value={p.id}>{p.titre} ({p.niveau})</option>)}
                    </select>
                  </div>
                </>
              )}
              <Alert ton="info" titre="Permissions par rôle">
                Chef = valide/assigne, Membre = exécute. Le backend applique les permissions, le frontend ne fait que masquer.
              </Alert>
            </>
          )}
          {etape === 2 && (
            <div className="flex flex-col gap-esp-2">
              {[
                ['Identifiant', form.username],
                ['E-mail', form.email],
                ['Nom', `${form.first_name} ${form.last_name}`.trim() || '—'],
                ['Rôle', LIBELLES_ROLE[form.role]],
                ...(form.role === 'client'
                  ? [['Client', clients.find((c) => String(c.id) === String(form.client))?.nom_societe ?? '—']]
                  : form.role === 'super_admin' ? [] : [['Département', nomDept], ['Poste', nomPoste]]),
              ].map(([k, v]) => (
                <p key={k} className="flex items-center justify-between gap-esp-3 rounded-lg bg-gris-100 p-esp-3 font-courant text-[15px]">
                  <span className="text-gris-600">{k}</span>
                  <span className="text-right font-semibold text-gris-900">{v}</span>
                </p>
              ))}
              <Badge ton="info" className="self-start">Le mot de passe provisoire est à transmettre à l utilisateur.</Badge>
            </div>
          )}
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
          <div className="flex justify-between gap-esp-3">
            <Button variante="fantome" onClick={() => (etape === 0 ? naviguer('/parametres/utilisateurs') : setEtape((x) => x - 1))}>
              {etape === 0 ? 'Annuler' : <><ArrowLeft size={16} aria-hidden="true" /> Retour</>}
            </Button>
            {etape < 2
              ? <Button onClick={suivant}>Continuer <ArrowRight size={16} aria-hidden="true" /></Button>
              : <Button onClick={creer}><Check size={16} aria-hidden="true" /> Créer le compte</Button>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
