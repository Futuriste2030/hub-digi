import { useEffect, useState } from 'react';
import { Copy, GitBranch, GitCommitHorizontal, GitPullRequest } from 'lucide-react';
import Badge from './ui/Badge.jsx';
import { liensTache, listerLiensGit } from '../api/projets.js';
import { messageErreur } from '../api/client.js';

const ICONE = { commit: GitCommitHorizontal, pull_request: GitPullRequest, branche: GitBranch };
const TYPE_LABEL = { commit: 'Commit', pull_request: 'Pull request', branche: 'Branche' };

export function nomBranche(reference, titre) {
  const slug = String(titre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tache';
  return `feature/${reference}-${slug}`;
}

/* Section « Développement » : branches, commits et PR liés + bouton copier branche. */
export default function LiensGit({ tache, bug, notifier }) {
  const [liens, setLiens] = useState([]);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        if (tache?.id) setLiens(await liensTache(tache.id));
        else if (bug?.id) setLiens(await listerLiensGit({ bug: bug.id }));
      } catch (e) {
        setErreur(messageErreur(e, 'Liens Git indisponibles.'));
      }
    };
    charger();
  }, [tache?.id, bug?.id]);

  const copier = async (texte, quoi) => {
    try { await navigator.clipboard.writeText(texte); } catch { /* presse-papiers indisponible */ }
    notifier?.({ type: 'info', titre: 'Copié', texte: quoi });
  };

  const ref = tache?.reference ?? bug?.numero ?? '';
  const titre = tache?.titre ?? bug?.titre ?? '';

  return (
    <div className="flex flex-col gap-esp-2">
      <div className="flex flex-wrap items-center justify-between gap-esp-2">
        <h4 className="font-titrage text-[15px] font-bold text-gris-900">Développement</h4>
        {tache?.reference && (
          <button
            type="button"
            onClick={() => copier(nomBranche(tache.reference, tache.titre), `Branche ${nomBranche(tache.reference, tache.titre)} copiée.`)}
            className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[13px] font-semibold text-digi-texte"
          >
            <Copy size={14} aria-hidden="true" /> Copier le nom de branche
          </button>
        )}
      </div>
      {ref && <p className="font-mono text-[13px] text-gris-600">{ref}{tache?.reference ? ` · ${nomBranche(tache.reference, titre)}` : ''}</p>}
      {erreur && <p className="font-courant text-[13px] text-erreur">{erreur}</p>}
      {liens.length === 0 && !erreur && <p className="font-courant text-[13px] text-gris-600">Aucun lien Git. Mentionnez {ref || 'la référence'} dans vos commits, PR ou branches.</p>}
      {liens.map((l) => {
        const Icone = ICONE[l.type] ?? GitBranch;
        return (
          <div key={l.id} className="flex items-center gap-esp-2 rounded-lg bg-gris-100 p-esp-2">
            <Icone size={16} aria-hidden="true" className="shrink-0 text-digi" />
            <span className="min-w-0 flex-1 truncate font-courant text-[13px] text-gris-800">{l.titre || l.identifiant_externe}</span>
            <Badge ton={l.statut_pr === 'fusionnee' ? 'succes' : 'neutre'}>{l.statut_pr ?? TYPE_LABEL[l.type]}</Badge>
            {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 font-courant text-[13px] font-semibold text-digi-texte">Voir</a>}
          </div>
        );
      })}
    </div>
  );
}
