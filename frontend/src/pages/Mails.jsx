import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { INTERNES, peutVoir, urlEspace } from '../lib/acces.js';
import {
  envoyerMail, listerCampagnes, listerMailsEnvoyes, listerTemplatesMail,
} from '../api/ressources.js';
import { listerFactures } from '../api/finance.js';
import { listerReunions, listerTickets } from '../api/tickets.js';
import { listerClients } from '../api/clients.js';
import { detailClient } from '../api/finance.js';
import { messageErreur } from '../api/client.js';

/* E-mails — les variables des modèles se résolvent seules depuis le contexte
   (client, facture, ticket, campagne, réunion). Aucune variable brute à gérer. */

const IDENTITES = {
  Administration: 'admin@digicom.ml',
  Communication: 'com@digicom.ml',
  Développement: 'dev@digicom.ml',
  Finance: 'finance@digicom.ml',
  RH: 'rh@digicom.ml',
  Juridique: 'juridique@digicom.ml',
};

/* Modèles purement automatiques : masqués de l'envoi manuel (déjà envoyés par les pages).
   - recu_disponible : auto au paiement (Factures, Fiche 360°, Espace)
   - reponse_ticket : auto à la réponse (Tickets)
   - relance auto J+ et rappel J-3 : tâches Celery
   - reset_password : auto à la demande (Login) */
const AUTO_SEULEMENT = new Set(['reset_password', 'conge_rappel_j3', 'recu_disponible', 'reponse_ticket']);

/* Quelles variables chaque modèle attend, et d'où les résoudre. */
const MAPPINGS = {
  bienvenue_espace_client: { client: ['societe', 'espace_url'], texte: ['username'] },
  facture_disponible: { client: ['societe', 'espace_url'], facture: ['numero', 'total'] },
  relance_facture: { client: ['societe'], facture: ['numero', 'solde'] },
  reponse_ticket: { client: ['societe'], ticket: ['numero', 'sujet', 'message'] },
  validation_visuel: { client: ['societe', 'espace_url'], campagne: ['campagne'] },
  reunion_convocation: { reunion: ['titre', 'date', 'heure', 'lieu', 'ordre_du_jour'] },
  reunion_pv_diffusion: { reunion: ['titre', 'pv'] },
};

const texteBrut = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('T')[0].split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const fMontant = (n) => `${Number(n ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F`;

export default function Mails() {
  const { notifier, session } = useOutletContext();
  const [params] = useSearchParams();
  const [a, setA] = useState('');
  const [modele, setModele] = useState('libre');
  const [brut, setBrut] = useState(null);
  const [contexte, setContexte] = useState({ client: '', facture: '', ticket: '', campagne: '', reunion: '' });
  const [extras, setExtras] = useState({});
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoyes, setEnvoyes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [factures, setFactures] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [campagnes, setCampagnes] = useState([]);
  const [reunions, setReunions] = useState([]);

  const identite = session?.role === 'super_admin'
    ? { departement: 'Administration', adresse: IDENTITES.Administration }
    : { departement: session?.dept ?? '—', adresse: IDENTITES[session?.dept] ?? 'admin@digicom.ml' };

  const charger = async () => {
    try {
      const [ms, ts, cls, rs] = await Promise.all([
        listerMailsEnvoyes(), listerTemplatesMail(), listerClients(), listerReunions(),
      ]);
      setEnvoyes(ms.slice(0, 20));
      setTemplates(ts.filter((t) => !AUTO_SEULEMENT.has(t.key)));
      const liste = cls.results ?? cls;
      setClients(liste);
      setReunions(rs);
    } catch {
      /* historique indisponible, le formulaire reste utilisable */
    }
  };

  useEffect(() => { charger(); }, []);

  /* Pré-remplissage depuis la fiche client (/mails?client=<id>). */
  useEffect(() => {
    const id = params.get('client');
    if (!id) return;
    detailClient(id).then(
      (c) => {
        setA(c.email ?? '');
        setContexte((ctx) => ({ ...ctx, client: String(c.id) }));
      },
      () => {},
    );
  }, [params]);

  /* Listes liées au client choisi (factures, tickets, campagnes). */
  useEffect(() => {
    if (!contexte.client) {
      setFactures([]);
      setTickets([]);
      setCampagnes([]);
      return;
    }
    let actif = true;
    Promise.all([
      listerFactures({ client_id: contexte.client }),
      listerTickets({ client: contexte.client }),
      listerCampagnes({ client_id: contexte.client }),
    ]).then(
      ([fs, ts, cs]) => {
        if (!actif) return;
        setFactures(fs);
        setTickets(ts);
        setCampagnes(cs);
      },
      () => {},
    );
    return () => { actif = false; };
  }, [contexte.client]);

  const mapping = MAPPINGS[modele];

  /* Résout toutes les variables depuis le contexte + champs libres. */
  const valeurs = (() => {
    if (!brut || !mapping) return {};
    const v = {};
    const client = clients.find((c) => String(c.id) === String(contexte.client));
    const facture = factures.find((f) => String(f.id) === String(contexte.facture));
    const ticket = tickets.find((t) => String(t.id) === String(contexte.ticket));
    const campagne = campagnes.find((c) => String(c.id) === String(contexte.campagne));
    const reunion = reunions.find((r) => String(r.id) === String(contexte.reunion));
    if (client) {
      v.societe = client.nom_societe;
      v.espace_url = `${window.location.origin}${urlEspace(client)}`;
    }
    if (facture) {
      v.numero = facture.numero;
      v.total = fMontant(facture.total);
      v.solde = fMontant(facture.solde);
      v.montant = fMontant(facture.total);
      v.facture_numero = facture.numero;
    }
    if (ticket) {
      v.numero = ticket.numero;
      v.sujet = ticket.sujet;
      v.message = ticket.message;
    }
    if (campagne) v.campagne = campagne.titre;
    if (reunion) {
      v.titre = reunion.titre;
      v.date = dateFr(reunion.date);
      v.heure = String(reunion.heure ?? '').slice(0, 5);
      v.lieu = reunion.lieu || '—';
      v.ordre_du_jour = texteBrut(reunion.ordre_du_jour) || '—';
      v.pv = texteBrut(reunion.pv) || '—';
    }
    return { ...v, ...extras };
  })();

  const substituer = (texte) =>
    String(texte ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, nom) => valeurs[nom] ?? '');

  const choisirModele = (k) => {
    setModele(k);
    setContexte({ client: '', facture: '', ticket: '', campagne: '', reunion: '' });
    setExtras({});
    if (k === 'libre') {
      setBrut(null);
      setObjet('');
      setCorps('');
    } else {
      const t = templates.find((x) => x.key === k);
      if (t) setBrut({ objet: t.subject, corps: texteBrut(t.body_html) });
    }
    setErreur('');
  };

  const envoyer = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) {
      setErreur('Envoi impossible. Vérifier l\u2019adresse e-mail, puis relancer l\u2019envoi.');
      return;
    }
    const obj = modele === 'libre' ? objet : substituer(brut?.objet);
    const msg = modele === 'libre' ? corps : substituer(brut?.corps);
    if (obj.trim().length < 3 || msg.trim().length < 10) {
      setErreur('Choisissez le contexte (client, facture…) pour remplir le modèle.');
      return;
    }
    if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(obj + msg)) {
      setErreur('Il reste des champs à renseigner dans le contexte ci-dessus.');
      return;
    }
    if (envoi) return;
    setEnvoi(true);
    try {
      await envoyerMail({
        to: a.trim(), subject: obj.trim(), body_html: `<p>${msg.trim().replace(/\n/g, '<br>')}</p>`,
        ...(contexte.client ? { client: Number(contexte.client) } : {}),
      });
      setA('');
      choisirModele('libre');
      notifier({ type: 'succes', titre: 'E-mail envoyé', texte: `Via ${identite.adresse}.` });
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Envoi impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  if (!peutVoir(session, INTERNES)) {
    return (
      <AccesRestreint
        titre="E-mails réservés aux internes"
        requis="Seuls les membres internes envoient des e-mails depuis le hub."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'L Administration étudiera votre accès.' })}
      />
    );
  }

  const selectCls = 'mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  return (
    <div>
      <p className="dg-surtitre">Système</p>
      <h1 className="mt-esp-2">E-mails</h1>
      <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
        Envoyez un e-mail depuis le hub. L adresse d envoi suit votre département, l historique rejoint la fiche client.
      </p>

      <div className="mt-esp-5">
        <Alert ton="info" titre="Identité d'envoi">
          <span className="font-mono text-[13px]">{identite.adresse}</span> — {identite.departement}. Chaque membre écrit via l adresse de son département, jamais celle d un autre.
        </Alert>
      </div>

      <div className="mt-esp-4">
        <Alert ton="info" titre="Mails automatiques (rien à faire ici)">
          Reçu auto à chaque paiement · réponse ticket auto · relances factures auto · rappels congés J-3 · reset mot de passe auto. Cette page sert aux envois manuels : message libre, bienvenue client, facture/relance ciblée, visuel, convocation/PV.
        </Alert>
      </div>

      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-5">
        <Card survol={false} className="lg:col-span-3">
          <CardHeader>
            <h2 className="!text-[18px]">Nouveau message</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={envoyer} className="flex flex-col gap-esp-4">
              <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="mail-a">Destinataire</Label>
                  <div className="mt-esp-2">
                    <Input id="mail-a" type="email" value={a} onChange={(e) => { setA(e.target.value); setErreur(''); }} placeholder="contact@client.ml" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="mail-modele">Modèle</Label>
                  <select
                    id="mail-modele"
                    value={modele}
                    onChange={(e) => choisirModele(e.target.value)}
                    className="mt-esp-2 h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi"
                  >
                    <option value="libre">Message libre</option>
                    {templates.map((t) => <option key={t.key} value={t.key}>{t.nom}</option>)}
                  </select>
                </div>
              </div>

              {modele !== 'libre' && mapping && (
                <div className="rounded-lg bg-gris-100 p-esp-4">
                  <p className="font-courant text-[15px] font-semibold text-gris-900">Contexte — remplit le modèle tout seul</p>
                  <div className="mt-esp-3 grid grid-cols-1 gap-esp-3 sm:grid-cols-2">
                    {(mapping.client || mapping.texte) && (
                      <div className={mapping.client && mapping.client.length > 1 ? '' : 'sm:col-span-2'}>
                        <Label htmlFor="ctx-client">Client</Label>
                        <select id="ctx-client" value={contexte.client} onChange={(e) => setContexte((c) => ({ ...c, client: e.target.value, facture: '', ticket: '', campagne: '' }))} className={selectCls}>
                          <option value="">— Choisir —</option>
                          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
                        </select>
                      </div>
                    )}
                    {mapping.facture && (
                      <div>
                        <Label htmlFor="ctx-facture">Facture</Label>
                        <select id="ctx-facture" value={contexte.facture} onChange={(e) => setContexte((c) => ({ ...c, facture: e.target.value }))} className={selectCls} disabled={!contexte.client}>
                          <option value="">— Choisir —</option>
                          {factures.map((f) => <option key={f.id} value={f.id}>{f.numero} · {fMontant(f.solde ?? f.total)}</option>)}
                        </select>
                      </div>
                    )}
                    {mapping.ticket && (
                      <div>
                        <Label htmlFor="ctx-ticket">Ticket</Label>
                        <select id="ctx-ticket" value={contexte.ticket} onChange={(e) => setContexte((c) => ({ ...c, ticket: e.target.value }))} className={selectCls} disabled={!contexte.client}>
                          <option value="">— Choisir —</option>
                          {tickets.map((t) => <option key={t.id} value={t.id}>{t.numero} · {t.sujet}</option>)}
                        </select>
                      </div>
                    )}
                    {mapping.campagne && (
                      <div>
                        <Label htmlFor="ctx-campagne">Campagne</Label>
                        <select id="ctx-campagne" value={contexte.campagne} onChange={(e) => setContexte((c) => ({ ...c, campagne: e.target.value }))} className={selectCls} disabled={!contexte.client}>
                          <option value="">— Choisir —</option>
                          {campagnes.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                        </select>
                      </div>
                    )}
                    {mapping.reunion && (
                      <div>
                        <Label htmlFor="ctx-reunion">Réunion</Label>
                        <select id="ctx-reunion" value={contexte.reunion} onChange={(e) => setContexte((c) => ({ ...c, reunion: e.target.value }))} className={selectCls}>
                          <option value="">— Choisir —</option>
                          {reunions.map((r) => <option key={r.id} value={r.id}>{r.titre}</option>)}
                        </select>
                      </div>
                    )}
                    {(mapping.texte ?? []).map((nom) => (
                      <div key={nom}>
                        <Label htmlFor={`ctx-${nom}`}>{nom}</Label>
                        <div className="mt-esp-2">
                          <Input id={`ctx-${nom}`} value={extras[nom] ?? ''} onChange={(e) => setExtras((x) => ({ ...x, [nom]: e.target.value }))} placeholder={`Valeur pour {{ ${nom} }}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="mail-objet">Objet</Label>
                <div className="mt-esp-2">
                  <Input id="mail-objet" value={modele === 'libre' ? objet : substituer(brut?.objet)} onChange={(e) => { setObjet(e.target.value); setErreur(''); }} placeholder="Objet du message" readOnly={modele !== 'libre'} />
                </div>
              </div>
              <div>
                <Label htmlFor="mail-corps">Message</Label>
                <div className="mt-esp-2">
                  <Textarea id="mail-corps" value={modele === 'libre' ? corps : substituer(brut?.corps)} onChange={(e) => { setCorps(e.target.value); setErreur(''); }} placeholder="Rédigez le message" rows={8} readOnly={modele !== 'libre'} />
                </div>
              </div>
              {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
              <div className="flex justify-end">
                <Button type="submit" chargement={envoi}>
                  <Send size={20} aria-hidden="true" /> Envoyer
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <h2 className="!text-[18px]">Envoyés récents</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-3">
            {envoyes.length === 0 && (
              <p className="font-courant text-[15px] text-gris-600">Aucun e-mail enregistré.</p>
            )}
            {envoyes.map((m) => (
              <div key={m.id} className="rounded-lg bg-gris-100 p-esp-3">
                <div className="flex items-center justify-between gap-esp-2">
                  <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{m.subject}</p>
                  <Badge ton={m.statut === 'envoye' ? 'succes' : 'erreur'}>{m.statut === 'envoye' ? 'Envoyé' : 'Échec'}</Badge>
                </div>
                <p className="mt-esp-1 truncate font-mono text-[13px] text-gris-600">À {m.to}</p>
                <p className="font-courant text-[13px] text-gris-600">{dateFr(m.cree_le)}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
