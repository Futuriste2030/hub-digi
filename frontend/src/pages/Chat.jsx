import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Hash, MessageSquareText, RefreshCw, Send, User } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { INTERNES, peutVoir } from '../lib/acces.js';
import { messageErreur } from '../api/client.js';
import {
  conversations, envoyerGroupe, envoyerMessage, filDiscussion, filGroupe,
  listerGroupes, marquerGroupeLus, marquerLus,
} from '../api/centre.js';
import { listerUsersMini } from '../api/ressources.js';

/* Chat interne plein écran — directs + groupes Slack-like (onglet sidebar). */

const initiales = (email) => String(email ?? '').split(/[@.]/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

const ilYa = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'Hier' : `Il y a ${j} j`;
};

export default function Chat() {
  const { notifier, session } = useOutletContext();
  const [convos, setConvos] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [users, setUsers] = useState([]);
  const [cible, setCible] = useState(null); // { type: 'direct'|'groupe', id }
  const [fil, setFil] = useState([]);
  const [texte, setTexte] = useState('');
  const [nouveauAvec, setNouveauAvec] = useState('');
  const [chargement, setChargement] = useState(true);
  const basFil = useRef(null);

  const chargerListes = async (silencieux = false) => {
    try {
      const [cs, gs, us] = await Promise.all([
        conversations(), listerGroupes(), listerUsersMini().catch(() => []),
      ]);
      setConvos(cs);
      setGroupes(gs);
      setUsers(us);
    } catch (e) {
      if (!silencieux) notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) });
    } finally {
      setChargement(false);
    }
  };

  const chargerFil = async (c = cible) => {
    if (!c) return;
    try {
      if (c.type === 'groupe') {
        setFil(await filGroupe(c.id));
        await marquerGroupeLus(c.id);
      } else {
        setFil(await filDiscussion(c.id));
        await marquerLus(c.id);
      }
      chargerListes(true);
    } catch (e) {
      notifier({ type: 'info', titre: 'Fil inaccessible', texte: messageErreur(e) });
    }
  };

  useEffect(() => {
    chargerListes();
    const t = setInterval(() => { chargerListes(true); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cible) chargerFil(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible?.type, cible?.id]);

  useEffect(() => {
    basFil.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [fil]);

  const ouvrirDirect = (id) => {
    setCible({ type: 'direct', id });
    setTexte('');
    setNouveauAvec('');
  };

  const envoyer = async (e) => {
    e.preventDefault();
    const dest = cible?.type === 'groupe' ? cible.id : (cible?.id ?? Number(nouveauAvec));
    if (!dest || texte.trim().length < 1) return;
    try {
      const m = cible?.type === 'groupe'
        ? await envoyerGroupe(dest, texte.trim())
        : await envoyerMessage(dest, texte.trim());
      setTexte('');
      setNouveauAvec('');
      if (!cible) setCible({ type: 'direct', id: dest });
      setFil((prev) => [...prev, m]);
      chargerListes(true);
    } catch (err) {
      notifier({ type: 'info', titre: 'Envoi impossible', texte: messageErreur(err) });
    }
  };

  if (!peutVoir(session, INTERNES)) {
    return (
      <AccesRestreint
        titre="Chat réservé"
        requis="Seuls les membres internes utilisent le chat."
      />
    );
  }

  const titreCible = cible?.type === 'groupe'
    ? groupes.find((g) => g.id === cible.id)?.nom ?? 'Groupe'
    : convos.find((c) => c.user.id === cible?.id)?.user.email ?? users.find((u) => u.id === cible?.id)?.email ?? 'Conversation';
  const nonLusTotal = convos.reduce((s, c) => s + (c.non_lus ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-esp-4">
        <div>
          <p className="dg-surtitre">Échanges</p>
          <h1 className="mt-esp-2">Chat interne {nonLusTotal > 0 && <Badge ton="erreur">{nonLusTotal} non lu{nonLusTotal > 1 ? 's' : ''}</Badge>}</h1>
          <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
            Directs entre collègues + groupes créés par le Super Admin (Paramètres › Chat). Actualisation toutes les 15 s.
          </p>
        </div>
        <Button variante="fantome" onClick={() => { chargerListes(); if (cible) chargerFil(); }}>
          <RefreshCw size={20} aria-hidden="true" /> Actualiser
        </Button>
      </div>

      {chargement ? (
        <p className="mt-esp-6 rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>
      ) : (
      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 lg:grid-cols-3">
        <Card survol={false}>
          <CardBody className="flex max-h-[70vh] flex-col gap-esp-1 overflow-y-auto pt-esp-3">
            <p className="px-esp-3 pb-esp-1 pt-esp-2 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Groupes</p>
            {groupes.length === 0 && <p className="px-esp-3 py-esp-2 font-courant text-[14px] text-gris-600">Aucun groupe — le Super Admin les crée dans Paramètres › Chat.</p>}
            {groupes.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => { setCible({ type: 'groupe', id: g.id }); setTexte(''); }}
                className={`flex w-full items-center gap-esp-3 rounded-lg p-esp-3 text-left transition-colors duration-rapide ${cible?.type === 'groupe' && cible.id === g.id ? 'bg-digi-voile' : 'hover:bg-gris-100'}`}
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pilule bg-marine-profond font-courant text-[13px] font-bold text-blanc">
                  <Hash size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-courant text-[15px] font-semibold text-gris-900">{g.nom}</span>
                  <span className="block truncate font-courant text-[13px] text-gris-600">{g.general ? 'Tout le monde' : `${g.membres?.length ?? 0} membre${(g.membres?.length ?? 0) > 1 ? 's' : ''}`}</span>
                </span>
              </button>
            ))}
            <p className="px-esp-3 pb-esp-1 pt-esp-3 font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Directs</p>
            {convos.length === 0 && <p className="px-esp-3 py-esp-2 font-courant text-[14px] text-gris-600">Aucune conversation. Écrivez au premier ci-dessous.</p>}
            {convos.map((c) => (
              <button
                key={c.user.id}
                type="button"
                onClick={() => ouvrirDirect(c.user.id)}
                className={`flex w-full items-start gap-esp-3 rounded-lg p-esp-3 text-left transition-colors duration-rapide ${cible?.type === 'direct' && cible.id === c.user.id ? 'bg-digi-voile' : 'hover:bg-gris-100'}`}
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pilule bg-digi-voile font-courant text-[13px] font-bold text-digi">
                  {initiales(c.user.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-esp-2">
                    <span className="truncate font-courant text-[15px] font-semibold text-gris-900">{c.user.email}</span>
                    <span className="shrink-0 font-courant text-[13px] text-gris-600">{ilYa(c.dernier.cree_le)}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-courant text-[15px] text-gris-600">{c.dernier.texte}</span>
                </span>
                {c.non_lus > 0 && <span className="rounded-pilule bg-erreur px-esp-2 py-0.5 font-courant text-[13px] font-bold text-blanc dg-tnum">{c.non_lus}</span>}
              </button>
            ))}
            <div className="border-t border-gris-200 p-esp-2">
              <form onSubmit={envoyer} className="flex gap-esp-2">
                <select value={nouveauAvec} onChange={(e) => setNouveauAvec(e.target.value)} aria-label="Nouveau destinataire" className="h-11 min-h-[44px] min-w-0 flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]">
                  <option value="">Écrire à…</option>
                  {users.filter((u) => u.email !== session?.email).map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
                <Button taille="sm" type="submit"><Send size={16} aria-hidden="true" /></Button>
              </form>
            </div>
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardBody className="flex min-h-[50vh] flex-col pt-esp-3">
            {!cible ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-esp-2 p-esp-6 text-center">
                <MessageSquareText size={28} aria-hidden="true" className="text-gris-400" />
                <p className="font-courant text-[15px] text-gris-600">Choisissez un groupe ou une conversation, ou écrivez à un collègue.</p>
                <p className="font-courant text-[14px] text-gris-600">La bulle <User size={14} className="inline" aria-hidden="true" /> Messages en haut reste disponible partout.</p>
              </div>
            ) : (
              <>
                <p className="truncate px-esp-1 pb-esp-2 font-courant text-[15px] font-semibold text-gris-900">
                  {cible.type === 'groupe' ? `# ${titreCible}` : titreCible}
                </p>
                <div className="flex max-h-[55vh] min-h-[30vh] flex-1 flex-col gap-esp-2 overflow-y-auto rounded-lg bg-gris-100 p-esp-3">
                  {fil.length === 0 && <p className="px-esp-3 py-esp-2 font-courant text-[14px] text-gris-600">Démarrez la discussion ci-dessous.</p>}
                  {fil.map((m) => {
                    const mien = m.expediteur === session?.id;
                    return (
                      <div key={m.id} className={`max-w-[85%] rounded-lg p-esp-3 font-courant text-[14px] ${mien ? 'self-end bg-digi text-blanc' : 'self-start bg-gris-0 text-gris-900 shadow-ombre-1'}`}>
                        {cible.type === 'groupe' && !mien && <p className="font-mono text-[12px] font-bold text-digi">{m.expediteur_email}</p>}
                        <p>{m.texte}</p>
                        <p className={`mt-esp-1 text-[12px] ${mien ? 'text-digi-brume' : 'text-gris-500'}`}>{ilYa(m.cree_le)}</p>
                      </div>
                    );
                  })}
                  <span ref={basFil} />
                </div>
                <form onSubmit={envoyer} className="flex gap-esp-2 pt-esp-3">
                  <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écrire…" aria-label="Écrire un message" className="h-11 min-h-[44px] min-w-0 flex-1 rounded-md border border-gris-300 bg-gris-0 px-esp-3 font-courant text-[14px]" />
                  <Button taille="sm" type="submit"><Send size={16} aria-hidden="true" /> Envoyer</Button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
      </div>
      )}
      {session?.role === 'super_admin' && (
      <p className="mt-esp-3">
        <Link to="/parametres/chat" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          Gérer les groupes (Super Admin)
        </Link>
      </p>
      )}
    </div>
  );
}
