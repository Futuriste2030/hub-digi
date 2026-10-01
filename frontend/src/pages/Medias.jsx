import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, X, Image, Film, Music, FileText, Check, Ban, Upload, Link2, ExternalLink, HardDrive } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_COM, ROLES_COM, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input } from '../components/ui/Input.jsx';
import { creerMediaLien, listerMedias, majMedia, supprimerMedia, uploaderMedia } from '../api/ressources.js';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { listerClients } from '../api/clients.js';
import { messageErreur } from '../api/client.js';

/* Médiathèque — API réelle : bibliothèque par client + validation + upload/liens. */

const ICONES_TYPE = { image: Image, video: Film, audio: Music, document: FileText };
const TYPES = [
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Vidéo' },
  { id: 'audio', label: 'Audio' },
  { id: 'document', label: 'Document' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
const STATUT_LABEL = { a_valider: 'À valider', valide: 'Validé', rejete: 'Rejeté' };
const STATUT_TON = { a_valider: 'alerte', valide: 'succes', rejete: 'erreur' };
const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.zip';
const SEUIL_LOURD = 25 * 1024 * 1024;

const tailleLisible = (octets) => {
  if (!octets && octets !== 0) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1048576) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1048576).toFixed(1).replace('.', ',')} Mo`;
};

const detecterPlateforme = (url) => {
  const u = url.toLowerCase();
  if (u.includes('youtu')) return 'YouTube';
  if (u.includes('vimeo')) return 'Vimeo';
  if (u.includes('drive.google') || u.includes('docs.google')) return 'Drive';
  if (u.includes('dropbox')) return 'Dropbox';
  return 'Lien';
};

function ModaleMedia({ clients, onFermer, onCreer }) {
  const [source, setSource] = useState('fichier');
  const [form, setForm] = useState({ nom: '', client: clients[0]?.id ?? '', type: 'image', url: '' });
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
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

  const choisirFichier = (e) => {
    const f = e.target.files?.[0];
    setFichier(f ?? null);
    setErreur('');
    if (f) {
      if (!form.nom.trim()) setForm((prev) => ({ ...prev, nom: f.name }));
      if (f.type.startsWith('image/')) setApercu(URL.createObjectURL(f));
      else setApercu(null);
    } else {
      setApercu(null);
    }
  };

  const soumettre = async (e) => {
    e.preventDefault();
    if (form.nom.trim().length < 3) {
      setErreur('Indiquez un nom de fichier d au moins 3 caractères.');
      return;
    }
    if (!form.client) {
      setErreur('Choisissez le client du média.');
      return;
    }
    if (source === 'lien') {
      if (!/^https?:\/\/.+\..+/.test(form.url.trim())) {
        setErreur('Collez un lien valide, par exemple une vidéo YouTube non répertoriée.');
        return;
      }
      onCreer({ mode: 'lien', client: Number(form.client), nom: form.nom.trim(), type: form.type, url: form.url.trim() });
      return;
    }
    if (!fichier) {
      setErreur('Choisissez un fichier à envoyer.');
      return;
    }
    setEnvoi(true);
    try {
      await onCreer({ mode: 'fichier', client: Number(form.client), nom: form.nom.trim(), type: form.type, fichier });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Ajouter un média">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Communication</p>
            <h2 className="!text-[26px]">Ajouter un média</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-esp-4 flex rounded-md border border-gris-300 bg-gris-100 p-0.5" role="group" aria-label="Source du média">
          {[
            ['fichier', 'Fichier'],
            ['lien', 'Lien externe'],
          ].map(([id, lb]) => (
            <button
              key={id}
              type="button"
              aria-pressed={source === id}
              onClick={() => { setSource(id); setErreur(''); }}
              className={`min-h-[44px] flex-1 rounded-sm px-esp-3 font-courant text-[15px] font-semibold transition-colors duration-rapide ${source === id ? 'bg-marine-profond text-blanc' : 'text-gris-600 hover:text-gris-900'}`}
            >
              {lb}
            </button>
          ))}
        </div>

        <div className="mt-esp-4 flex flex-col gap-esp-4">
          {source === 'lien' ? (
            <>
              <div>
                <Label htmlFor="md-url">URL (YouTube, Vimeo, Drive…)</Label>
                <div className="mt-esp-2">
                  <Input id="md-url" type="url" inputMode="url" {...champ('url')} placeholder="https://www.youtube.com/watch?v=…" />
                </div>
              </div>
              <Alert ton="info" titre="Zéro octet sur le VPS">
                La vidéo reste hébergée chez le fournisseur. Recommandé pour tout fichier de plus de 25 Mo.
              </Alert>
            </>
          ) : (
            <>
              <div>
                <span className="font-courant text-[15px] font-semibold text-gris-700">Fichier</span>
                <label htmlFor="md-fichier" className="mt-esp-2 flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md border border-dashed border-gris-400 bg-gris-100 px-esp-4 py-esp-3 transition-colors duration-rapide hover:border-digi">
                  {apercu ? (
                    <img src={apercu} alt="Aperçu du fichier" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <Upload size={20} aria-hidden="true" className="shrink-0 text-digi" />
                  )}
                  <span className="min-w-0 font-courant text-[15px] text-gris-700">
                    {fichier ? <><strong className="font-semibold text-gris-900">{fichier.name}</strong><span className="block text-gris-600 dg-tnum">{tailleLisible(fichier.size)}</span></> : 'Choisir un fichier… (image, vidéo, audio, PDF)'}
                  </span>
                </label>
                <input id="md-fichier" type="file" accept={ACCEPT} onChange={choisirFichier} className="sr-only" />
              </div>
              {fichier && fichier.size > SEUIL_LOURD && (
                <Alert ton="alerte" titre="Fichier lourd">
                  Ce fichier pèse {tailleLisible(fichier.size)}. Pour une vidéo, collez plutôt un lien YouTube non répertoriée et gardez le VPS léger.
                </Alert>
              )}
            </>
          )}
          <div>
            <Label htmlFor="md-nom">Nom du média</Label>
            <div className="mt-esp-2"><Input id="md-nom" {...champ('nom')} placeholder="Ex. Visuel fibre -40%" /></div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="md-client">Client</Label>
              <select id="md-client" {...champ('client')} className={selectCls}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="md-type">Type</Label>
              <select id="md-type" {...champ('type')} className={selectCls}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit" disabled={envoi}><Plus size={20} aria-hidden="true" /> {envoi ? 'Envoi…' : 'Ajouter'}</Button>
        </div>
      </form>
    </div>
  );
}

export default function Medias() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [client, setClient] = useState('tous');
  const [type, setType] = useState('tous');
  const [modale, setModale] = useState(false);
  const [medias, setMedias] = useState([]);
  const [clients, setClients] = useState([]);
  const [nomsClients, setNomsClients] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = async (q = '', cl = 'tous', ty = 'tous') => {
    try {
      const [ms, cls] = await Promise.all([
        listerMedias({
          ...(q ? { search: q } : {}),
          ...(cl !== 'tous' ? { client: cl } : {}),
          ...(ty !== 'tous' ? { type: ty } : {}),
        }),
        listerClients(),
      ]);
      const liste = cls.results ?? cls;
      setMedias(ms);
      setClients(liste);
      setNomsClients(Object.fromEntries(liste.map((c) => [c.id, c.nom_societe])));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des médias impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => charger(recherche.trim(), client, type), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, client, type]);

  const creer = async (data) => {
    try {
      const m = data.mode === 'lien'
        ? await creerMediaLien({ client: data.client, nom: data.nom, type: data.type, url: data.url })
        : await uploaderMedia({ client: data.client, nom: data.nom, type: data.type, fichier: data.fichier });
      setModale(false);
      notifier({ type: 'succes', titre: 'Média ajouté', texte: `${m.nom} — en attente de validation.` });
      charger(recherche.trim(), client, type);
    } catch (e) {
      notifier({ type: 'info', titre: 'Ajout impossible', texte: messageErreur(e) });
    }
  };

  const statuer = async (m, statut) => {
    try {
      await majMedia(m.id, { statut });
      notifier({ type: statut === 'valide' ? 'succes' : 'info', titre: `Média ${STATUT_LABEL[statut].toLowerCase()}`, texte: m.nom });
      charger(recherche.trim(), client, type);
    } catch (e) {
      notifier({ type: 'info', titre: 'Décision impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (m) => {
    try {
      await supprimerMedia(m.id);
      notifier({ type: 'succes', titre: 'Média supprimé', texte: `${m.nom} — retiré de la bibliothèque.` });
      charger(recherche.trim(), client, type);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };

  const selectCls = 'h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 focus:border-digi';

  if (!peutVoir(session, ROLES_COM)) {
    return (
      <AccesRestreint
        titre="Médias réservés à la Communication"
        requis="Seuls les membres du département Communication suivent la médiathèque."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef Communication étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_COM);
  const fichiers = medias.filter((m) => !m.url).length;
  const liens = medias.filter((m) => m.url).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Communication</p>
          <h1 className="mt-esp-2">Médias</h1>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Ajouter un média
        </Button>
      </div>

      <Card survol={false} className="mt-esp-6">
        <CardBody className="flex items-center gap-esp-4 pt-esp-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
            <HardDrive size={20} aria-hidden="true" className="text-digi" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-courant text-[15px] text-gris-600">Bibliothèque</p>
            <p className="font-courant text-[15px] font-semibold text-gris-900 dg-tnum">{fichiers} fichier{fichiers > 1 ? 's' : ''} stocké{fichiers > 1 ? 's' : ''} · {liens} lien{liens > 1 ? 's' : ''} externe{liens > 1 ? 's' : ''} (0 octet)</p>
          </div>
        </CardBody>
      </Card>

      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un média" className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi" />
        </div>
        <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Filtrer par client" className={selectCls}>
          <option value="tous">Tous clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom_societe}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filtrer par type" className={selectCls}>
          <option value="tous">Tous types</option>
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {chargement ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : erreur ? (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
      ) : (
      <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 sm:grid-cols-2 xl:grid-cols-3">
        {medias.map((m) => {
          const Icone = ICONES_TYPE[m.type] || FileText;
          const estLien = !!m.url;
          return (
            <Card key={m.id} survol={false}>
              <CardBody className="pt-esp-5">
                <div className="flex items-start gap-esp-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                    <Icone size={20} aria-hidden="true" className="text-digi" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-courant text-[15px] font-semibold text-gris-900">{m.nom}</p>
                    <p className="font-courant text-[15px] text-gris-600">{nomsClients[m.client] ?? ''} · {TYPE_LABEL[m.type] ?? m.type}</p>
                    <p className="font-courant text-[13px] text-gris-600">
                      {estLien ? <span className="inline-flex items-center gap-esp-1"><Link2 size={16} aria-hidden="true" />{detecterPlateforme(m.url)} · 0 octet</span> : <span className="dg-tnum">Fichier stocké</span>}
                    </p>
                  </div>
                  <Badge ton={STATUT_TON[m.statut] ?? 'neutre'}>{STATUT_LABEL[m.statut] ?? m.statut}</Badge>
                </div>
                {estLien && (
                  <a href={m.url} target="_blank" rel="noreferrer" className="mt-esp-3 inline-flex min-h-[44px] items-center gap-esp-2 rounded-md border border-gris-300 px-esp-3 font-courant text-[15px] font-semibold text-digi-texte transition-colors duration-rapide hover:bg-digi-voile">
                    <ExternalLink size={16} aria-hidden="true" /> Ouvrir le lien
                  </a>
                )}
                {m.statut === 'a_valider' && peutValider && (
                  <div className="mt-esp-3 flex items-center gap-esp-2 border-t border-gris-200 pt-esp-3">
                    <button type="button" onClick={() => statuer(m, 'valide')} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-esp-2 rounded-md bg-succes font-courant text-[15px] font-semibold text-blanc transition-colors duration-rapide hover:brightness-90">
                      <Check size={16} aria-hidden="true" /> Valider
                    </button>
                    <button type="button" onClick={() => statuer(m, 'rejete')} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-esp-2 rounded-md border border-gris-300 font-courant text-[15px] font-semibold text-erreur transition-colors duration-rapide hover:bg-erreur-fond">
                      <Ban size={16} aria-hidden="true" /> Rejeter
                    </button>
                  </div>
                )}
                {peutValider && m.statut !== 'valide' && (
                  <div className="mt-esp-2 flex justify-end">
                    <BoutonSupprimer
                      titre={`Supprimer ${m.nom}`}
                      libelle={m.nom}
                      texte="Supprimer définitivement le média"
                      onConfirmer={() => supprimer(m)}
                    />
                  </div>
                )}
                {m.statut !== 'a_valider' && (
                  <p className="dg-legende mt-esp-3 border-t border-gris-200 pt-esp-3">Décision enregistrée. Visible côté client.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
      )}
      {!chargement && !erreur && medias.length === 0 && (
        <p className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600">Aucun média avec ces filtres.</p>
      )}

      {modale && <ModaleMedia clients={clients} onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
