import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Building2, UserRound, KeyRound, RefreshCw, Copy } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CREATION_CLIENT, peutVoir } from '../lib/acces.js';
import { creerClient, creerCompteClient, genererUsername } from '../api/clients.js';
import { messageErreur } from '../api/client.js';

/* Nouveau client — POST /api/v1/clients/ puis compte sans mdp (/users/) + invitation 24h. */

const STATUTS = [
  { valeur: 'prospect', label: 'Prospect' },
  { valeur: 'client', label: 'Client' },
];

export default function NouveauClient() {
  const naviguer = useNavigate();
  const { notifier, session } = useOutletContext();
  const [form, setForm] = useState({
    societe: '',
    contact: '',
    fonction: '',
    email: '',
    phone: '',
    adresse: '',
    statut: 'prospect',
    notes: '',
    est_interne: false,
  });
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  /* Identifiant espace client — aucun mot de passe généré/transmis :
     le client définit lui-même son mdp via le lien d'invitation 24h. */
  const [acces, setAcces] = useState(() => ({ username: genererUsername('client') }));

  const generer = (societe) => {
    setAcces({
      username: genererUsername(societe && societe.trim().length >= 2 ? societe : 'client'),
    });
  };

  const copier = async (texte, quoi) => {
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      /* presse-papiers indisponible */
    }
    notifier({ type: 'info', titre: `${quoi} copié`, texte: texte });
  };

  const champ = (k) => ({
    value: form[k],
    onChange: (e) => {
      const v = e.target.value;
      setForm((f) => {
        const Maj = { ...f, [k]: v };
        /* Détection auto : Digi Com elle-même = cliente interne, sans espace client. */
        if (k === 'societe') {
          const norm = String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          if (norm.includes('digicom')) Maj.est_interne = true;
        }
        return Maj;
      });
      setErreurs((prev) => ({ ...prev, [k]: '' }));
    },
  });

  const valider = () => {
    const e = {};
    if (form.societe.trim().length < 2) e.societe = 'Indiquez le nom de la société.';
    if (form.contact.trim().length < 2) e.contact = 'Indiquez le nom du contact.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Envoi impossible. Vérifier l\u2019adresse e-mail, puis relancer l\u2019envoi.';
    setErreurs(e);
    return Object.keys(e).length === 0;
  };

  const soumettre = async (ev) => {
    ev.preventDefault();
    if (!valider() || envoi) return;
    setEnvoi(true);
    try {
      const cree = await creerClient({
        nom_societe: form.societe.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        adresse: form.adresse.trim(),
        statut: form.statut,
        est_interne: form.est_interne,
      });
      if (form.est_interne) {
        /* Client interne (Digi Com) : géré dans le hub, aucun compte espace client. */
        notifier({ type: 'succes', titre: 'Client interne créé', texte: `${cree.nom_societe} — sans espace client, fiche 360° ouverte.` });
        naviguer(`/clients/${cree.id}`);
        return;
      }
      try {
        await creerCompteClient({ clientId: cree.id, email: form.email.trim(), username: acces.username });
        notifier({ type: 'succes', titre: 'Client créé', texte: `${cree.nom_societe} — compte invité créé, envoyez l'invitation depuis la fiche.` });
      } catch {
        notifier({ type: 'info', titre: 'Client créé', texte: `${cree.nom_societe} — compte espace à finaliser (droits super admin requis).` });
      }
      naviguer(`/clients/${cree.id}`);
    } catch (e) {
      setErreurs({ societe: messageErreur(e, 'Création impossible.') });
    } finally {
      setEnvoi(false);
    }
  };

  /* Pas d'envoi depuis cet écran : le compte est créé sans mdp, puis
     l'invitation (lien 24h) part depuis la fiche client. */

  if (!peutVoir(session, ROLES_CREATION_CLIENT)) {
    return (
      <AccesRestreint
        titre="Création réservée"
        requis="Super Admin, Administration et chefs de département."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'L Administration étudiera votre accès.' })}
      />
    );
  }

  return (
    <div>
      <Link to="/clients" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
        <ArrowLeft size={16} aria-hidden="true" /> Clients
      </Link>
      <div className="mt-esp-2">
        <p className="dg-surtitre">Fiche client 360°</p>
        <h1 className="mt-esp-2">Nouveau client</h1>
        <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
          Créez la fiche société et le contact. Projets, factures et tickets suivent dans les onglets.
        </p>
      </div>

      <form onSubmit={soumettre} className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <Building2 size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Société</h2>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-4">
            <div>
              <Label htmlFor="nc-societe">Société *</Label>
              <div className="mt-esp-2"><Input id="nc-societe" autoFocus {...champ('societe')} erreur={erreurs.societe} placeholder="Ex. Sonatel" /></div>
            </div>
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nc-phone">Téléphone</Label>
                <div className="mt-esp-2"><Input id="nc-phone" {...champ('phone')} placeholder="+223 20 00 00 00" /></div>
              </div>
              <div>
                <Label htmlFor="nc-statut">Statut</Label>
                <select id="nc-statut" value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))} className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi">
                  {STATUTS.map((s) => <option key={s.valeur} value={s.valeur}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="nc-adresse">Adresse</Label>
              <div className="mt-esp-2"><Input id="nc-adresse" {...champ('adresse')} placeholder="Quartier, ville, pays" /></div>
            </div>
            <label htmlFor="nc-interne" className="flex min-h-[44px] cursor-pointer items-start gap-esp-3 rounded-md border border-gris-300 bg-gris-100 p-esp-3">
              <input
                id="nc-interne"
                type="checkbox"
                checked={form.est_interne}
                onChange={(e) => setForm((f) => ({ ...f, est_interne: e.target.checked }))}
                className="mt-1 h-5 w-5 shrink-0 accent-[#0a2a5e]"
              />
              <span className="font-courant text-[15px] text-gris-700">
                <strong className="font-semibold text-gris-900">Client interne (Digi Com)</strong>
                <br />Géré dans le hub uniquement — aucun compte ni espace client ne sera créé.
              </span>
            </label>
          </CardBody>
        </Card>

        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <UserRound size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Contact principal</h2>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-4">
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nc-contact">Nom complet *</Label>
                <div className="mt-esp-2"><Input id="nc-contact" {...champ('contact')} erreur={erreurs.contact} placeholder="Ex. Cheikh Ndiaye" /></div>
              </div>
              <div>
                <Label htmlFor="nc-fonction">Fonction</Label>
                <div className="mt-esp-2"><Input id="nc-fonction" {...champ('fonction')} placeholder="Ex. Directeur digital" /></div>
              </div>
            </div>
            <div>
              <Label htmlFor="nc-email">E-mail pro *</Label>
              <div className="mt-esp-2"><Input id="nc-email" type="email" {...champ('email')} erreur={erreurs.email} placeholder="prenom.nom@societe.ml" /></div>
            </div>
            <div>
              <Label htmlFor="nc-notes">Notes internes</Label>
              <div className="mt-esp-2"><Textarea id="nc-notes" {...champ('notes')} value={form.notes} placeholder="Contexte, périmètre envisagé" rows={3} /></div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-esp-3 lg:col-span-2">
          <Button variante="fantome" onClick={() => naviguer('/clients')}>Annuler</Button>
          <Button type="submit" disabled={envoi}>{envoi ? 'Création…' : 'Créer le client'}</Button>
        </div>

        {form.est_interne ? (
          <Card survol={false} className="lg:col-span-2">
            <CardBody>
              <p className="font-courant text-[15px] text-gris-600">
                Client interne : aucun accès espace client ne sera créé. La fiche 360° reste disponible pour la gestion (projets, factures, tickets).
              </p>
            </CardBody>
          </Card>
        ) : (
        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <KeyRound size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Accès espace client</h2>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-4">
            <p className="font-courant text-[15px] text-gris-600">
              Identifiant proposé. Aucun mot de passe n est généré ni envoyé :
              après création, envoyez l invitation depuis la fiche client — le client
              définit lui-même son mot de passe via un lien valable 24 heures.
            </p>
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nc-username">Identifiant</Label>
                <div className="mt-esp-2 flex gap-esp-2">
                  <div className="flex-1"><Input id="nc-username" value={acces.username} readOnly /></div>
                  <button type="button" onClick={() => copier(acces.username, 'Identifiant')} aria-label="Copier l identifiant" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gris-300 text-gris-600 hover:bg-gris-200">
                    <Copy size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-esp-2">
              <Button variante="secondaire" taille="sm" onClick={() => generer(form.societe)}>
                <RefreshCw size={16} aria-hidden="true" /> Régénérer l identifiant
              </Button>
            </div>
          </CardBody>
        </Card>
        )}
      </form>
    </div>
  );
}
