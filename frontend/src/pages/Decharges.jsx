import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, Search, X, Download, ImagePlus, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_SECRETARIAT, peutVoir } from '../lib/acces.js';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import BoutonSupprimer from '../components/ui/BoutonSupprimer.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import { creerDecharge, listerDecharges, supprimerDecharge } from '../api/tickets.js';
import { messageErreur, API_URL } from '../api/client.js';
import { fCFA } from '../utils/stats.js';

/* Décharges Secrétariat — registre des scans (image compressée serveur : JPEG 1600px q70). */

const origineApi = API_URL.split('/api/')[0];
const urlImage = (d) => (d.image ? (String(d.image).startsWith('http') ? d.image : `${origineApi}${d.image}`) : null);
const dateFr = (iso) => {
  if (!iso) return '—';
  const [a, m, j] = String(iso).split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(iso);
};
const tailleLisible = (ko) => (ko >= 1024 ? `${(ko / 1024).toFixed(1)} Mo` : `${ko} Ko`);

function ModaleDecharge({ onFermer, onCreer }) {
  const today = new Date().toISOString().slice(0, 10);
  const [provenance, setProvenance] = useState('');
  const [objet, setObjet] = useState('');
  const [montant, setMontant] = useState('');
  const [dateRecue, setDateRecue] = useState(today);
  const [image, setImage] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState('');

  const choisir = (f) => {
    setErreur('');
    if (!f) { setImage(null); setApercu(null); return; }
    if (!f.type.startsWith('image/')) { setErreur('Choisissez une image (photo ou scan).'); return; }
    if (f.size > 10 * 1024 * 1024) { setErreur('10 Mo maximum — le serveur compresse ensuite pour le stockage.'); return; }
    setImage(f);
    setApercu(URL.createObjectURL(f));
  };

  const soumettre = (e) => {
    e.preventDefault();
    if (provenance.trim().length < 2) { setErreur('Indiquez la provenance (qui a remis).'); return; }
    if (objet.trim().length < 3) { setErreur('Décrivez l\u2019objet déchargé (3 caractères minimum).'); return; }
    if (!image) { setErreur('Joignez le scan de la décharge.'); return; }
    if (montant !== '' && !(Number(montant) >= 0)) { setErreur('Montant invalide.'); return; }
    onCreer({
      provenance: provenance.trim(), objet: objet.trim(),
      montant: montant === '' ? '' : Number(montant),
      date_recue: dateRecue, image,
      commentaire: commentaire.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-esp-4" role="dialog" aria-modal="true" aria-label="Nouvelle décharge">
      <div className="dg-fondu absolute inset-0 bg-marine-profond/60" onClick={onFermer} />
      <form onSubmit={soumettre} className="dg-pop relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl bg-gris-0 p-esp-6 shadow-ombre-4">
        <div className="flex items-start justify-between gap-esp-3">
          <div>
            <p className="dg-surtitre">Secrétariat</p>
            <h2 className="!text-[26px]">Nouvelle décharge</h2>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gris-600 hover:bg-gris-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-esp-5 flex flex-col gap-esp-4">
          <div>
            <Label htmlFor="dc-prov">Provenance (qui a remis)</Label>
            <div className="mt-esp-2"><Input id="dc-prov" autoFocus value={provenance} onChange={(e) => { setProvenance(e.target.value); setErreur(''); }} placeholder="Ex. Orange Mali — comptabilité" /></div>
          </div>
          <div>
            <Label htmlFor="dc-objet">Objet déchargé</Label>
            <div className="mt-esp-2"><Input id="dc-objet" value={objet} onChange={(e) => { setObjet(e.target.value); setErreur(''); }} placeholder="Ex. Remise espèces facture…" /></div>
          </div>
          <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dc-date">Date de réception</Label>
              <div className="mt-esp-2"><Input id="dc-date" type="date" value={dateRecue} onChange={(e) => setDateRecue(e.target.value)} /></div>
            </div>
            <div>
              <Label htmlFor="dc-montant">Montant (F CFA, optionnel)</Label>
              <div className="mt-esp-2"><Input id="dc-montant" inputMode="numeric" value={montant} onChange={(e) => { setMontant(e.target.value); setErreur(''); }} placeholder="—" /></div>
            </div>
          </div>
          <div>
            <Label htmlFor="dc-image">Scan de la décharge</Label>
            <label htmlFor="dc-image" className="mt-esp-2 flex min-h-[44px] cursor-pointer items-center gap-esp-3 rounded-md border border-dashed border-gris-400 bg-gris-100 px-esp-4 py-esp-3 transition-colors duration-rapide hover:border-digi">
              {apercu
                ? <img src={apercu} alt="Aperçu du scan" className="h-12 w-12 rounded-md object-cover" />
                : <ImagePlus size={20} aria-hidden="true" className="shrink-0 text-digi" />}
              <span className="font-courant text-[15px] text-gris-700">
                {image ? <><strong className="font-semibold text-gris-900">{image.name}</strong><span className="block text-gris-600">{(image.size / 1024).toFixed(0)} Ko → compressé serveur</span></> : 'Choisir une image… (10 Mo max)'}
              </span>
            </label>
            <input id="dc-image" type="file" accept="image/*" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} />
          </div>
          <div>
            <Label htmlFor="dc-com">Commentaire (optionnel)</Label>
            <div className="mt-esp-2"><Textarea id="dc-com" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Précisions d\u2019archivage…" /></div>
          </div>
          {erreur && <p role="alert" className="font-courant text-[15px] text-erreur">{erreur}</p>}
        </div>
        <div className="mt-esp-6 flex justify-end gap-esp-3">
          <Button variante="fantome" onClick={onFermer}>Annuler</Button>
          <Button type="submit"><Plus size={20} aria-hidden="true" /> Archiver</Button>
        </div>
      </form>
    </div>
  );
}

export default function Decharges() {
  const { notifier, session } = useOutletContext();
  const [recherche, setRecherche] = useState('');
  const [items, setItems] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [modale, setModale] = useState(false);
  const [detail, setDetail] = useState(null);

  const charger = async (q = '') => {
    try {
      setChargement(true);
      setItems(await listerDecharges({ search: q.trim() }));
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'Chargement des décharges impossible.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    let actif = true;
    const t = setTimeout(async () => { if (actif) await charger(recherche); }, 250);
    return () => { actif = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const creer = async (payload) => {
    try {
      const d = await creerDecharge(payload);
      setModale(false);
      notifier({ type: 'succes', titre: 'Décharge archivée', texte: `${d.reference} — scan compressé (${tailleLisible(d.poids_ko)}).` });
      charger(recherche);
    } catch (e) {
      notifier({ type: 'info', titre: 'Archivage impossible', texte: messageErreur(e) });
    }
  };

  const supprimer = async (d) => {
    try {
      await supprimerDecharge(d.id);
      setDetail(null);
      notifier({ type: 'succes', titre: 'Décharge supprimée', texte: `${d.reference} effacée.` });
      charger(recherche);
    } catch (e) {
      notifier({ type: 'info', titre: 'Suppression impossible', texte: messageErreur(e) });
    }
  };
  const peutSupprimer = peutVoir(session, ['super_admin', 'admin']);

  if (!peutVoir(session, ROLES_SECRETARIAT)) {
    return (
      <AccesRestreint
        titre="Décharges réservées au Secrétariat"
        requis="Seuls les membres du Secrétariat suivent les décharges."
      />
    );
  }

  if (detail) {
    const d = items.find((x) => x.id === detail) ?? null;
    if (!d) setDetail(null);
    else {
      return (
        <div>
          <Button variante="fantome" onClick={() => setDetail(null)}>← Décharges</Button>
          <div className="mt-esp-3 flex flex-wrap items-end justify-between gap-esp-4">
            <div>
              <p className="dg-surtitre">Secrétariat · {d.reference}</p>
              <h1 className="mt-esp-2">{d.objet}</h1>
              <p className="mt-esp-1 font-courant text-[15px] text-gris-600">
                Provenance : <strong className="text-gris-900">{d.provenance}</strong> · Reçue le {dateFr(d.date_recue)}
                {d.montant != null ? ` · ${fCFA(Number(d.montant))}` : ''} · Scan {tailleLisible(d.poids_ko)}
              </p>
            </div>
            <div className="flex flex-wrap gap-esp-2">
              {urlImage(d) && (
                <a href={urlImage(d)} download target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-esp-2 rounded-md bg-marine-profond px-esp-4 font-courant text-[15px] font-semibold text-blanc">
                  <Download size={20} aria-hidden="true" /> Télécharger
                </a>
              )}
              {peutSupprimer && (
                <BoutonSupprimer titre={`Supprimer ${d.reference}`} libelle={d.objet} texte="Supprimer définitivement la décharge" onConfirmer={() => supprimer(d)} />
              )}
            </div>
          </div>
          {d.commentaire && (
            <Card survol={false} className="mt-esp-4"><CardBody><p className="font-courant text-[15px] text-gris-700">{d.commentaire}</p></CardBody></Card>
          )}
          {urlImage(d) && (
            <Card survol={false} className="mt-esp-4">
              <CardBody>
                <img src={urlImage(d)} alt={`Scan ${d.reference}`} className="mx-auto max-h-[75vh] w-auto rounded-md border border-gris-300 object-contain" />
              </CardBody>
            </Card>
          )}
        </div>
      );
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Secrétariat</p>
          <h1 className="mt-esp-2">Décharges</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Scans archivés avec provenance et date. Chaque image est compressée par le serveur (JPEG 1600 px) pour préserver l&apos;espace disque.
          </p>
        </div>
        <Button onClick={() => setModale(true)}>
          <Plus size={20} aria-hidden="true" /> Nouvelle décharge
        </Button>
      </div>

      <div className="relative mt-esp-6 max-w-96">
        <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-esp-3 top-1/2 -translate-y-1/2 text-gris-400" />
        <input
          type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Référence, provenance, objet…" aria-label="Rechercher une décharge"
          className="h-11 min-h-[44px] w-full rounded-md border border-gris-300 bg-gris-0 pl-11 pr-esp-4 font-courant text-[15px] text-gris-700 placeholder:text-gris-400 focus:border-digi"
        />
      </div>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="flex flex-col gap-esp-1 pt-esp-3">
          {chargement ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
          ) : erreur ? (
            <p className="p-esp-4 text-center font-courant text-[15px] text-erreur" role="alert">{erreur}</p>
          ) : (
          <>
            {items.length === 0 && <p className="p-esp-4 text-center font-courant text-[15px] text-gris-600">Aucune décharge archivée.</p>}
            {items.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-esp-3 rounded-lg px-esp-3 py-esp-3 text-left transition-colors duration-rapide hover:bg-gris-100">
                <button type="button" onClick={() => setDetail(d.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-esp-3 text-left" aria-label={`Ouvrir ${d.objet}`}>
                  {urlImage(d)
                    ? <img src={urlImage(d)} alt="" className="h-12 w-12 shrink-0 rounded-md border border-gris-300 object-cover" />
                    : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gris-200"><ImagePlus size={20} aria-hidden="true" className="text-gris-400" /></span>}
                  <span className="min-w-48 flex-1">
                    <span className="block font-courant text-[15px] font-semibold text-gris-900">{d.objet}</span>
                    <span className="block font-courant text-[13px] text-gris-600"><span className="font-mono">{d.reference}</span> · {d.provenance} · {dateFr(d.date_recue)} · {tailleLisible(d.poids_ko)}</span>
                  </span>
                  {d.montant != null && <Badge ton="info">{fCFA(Number(d.montant))}</Badge>}
                </button>
                <span className="inline-flex items-center gap-esp-1" onClick={(e) => e.stopPropagation()}>
                  {peutSupprimer && (
                    <BoutonSupprimer titre={`Supprimer ${d.reference}`} libelle={d.objet} texte="Supprimer définitivement la décharge" onConfirmer={() => supprimer(d)} />
                  )}
                  <Link to="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDetail(d.id); }} aria-label={`Ouvrir ${d.objet}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-digi-texte hover:bg-digi-voile">
                    <ArrowRight size={20} aria-hidden="true" />
                  </Link>
                </span>
              </div>
            ))}
          </>
          )}
        </CardBody>
      </Card>

      {modale && <ModaleDecharge onFermer={() => setModale(false)} onCreer={creer} />}
    </div>
  );
}
