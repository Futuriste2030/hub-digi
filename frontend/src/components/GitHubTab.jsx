import { useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import Button from './ui/Button.jsx';
import { Card, CardHeader, CardBody } from './ui/Card.jsx';
import Badge from './ui/Badge.jsx';
import { Input, Label } from './ui/Input.jsx';
import { livraisonsGithub, majProjetGithub, regenererSecretGithub } from '../api/projets.js';
import { messageErreur } from '../api/client.js';

/* Onglet GitHub d'un projet (chef_dev/super_admin) : webhook entrant V1 sans OAuth. */
export default function GitHubTab({ projet, onProjetMaj, notifier }) {
  const [repo, setRepo] = useState(projet.github_repo || '');
  const [autoStatut, setAutoStatut] = useState(!!projet.github_auto_statut);
  const [secret, setSecret] = useState(''); // affiché une seule fois.
  const [webhookUrl, setWebhookUrl] = useState('');
  const [livraisons, setLivraisons] = useState([]);

  const chargerLivraisons = async () => {
    try { setLivraisons(await livraisonsGithub(projet.id)); } catch { /* optionnel */ }
  };

  useEffect(() => { chargerLivraisons(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projet.id]);

  const copier = async (texte, quoi) => {
    try { await navigator.clipboard.writeText(texte); } catch { /* indisponible */ }
    notifier({ type: 'info', titre: 'Copié', texte: quoi });
  };

  const sauverRepo = async () => {
    try {
      const maj = await majProjetGithub(projet.id, { github_repo: repo.trim(), github_auto_statut: autoStatut });
      onProjetMaj(maj);
      notifier({ type: 'succes', titre: 'GitHub mis à jour', texte: repo.trim() || 'Dépôt retiré.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(e) });
    }
  };

  const regenerer = async () => {
    try {
      const r = await regenererSecretGithub(projet.id);
      setSecret(r.secret);
      setWebhookUrl(r.webhook_url);
      notifier({ type: 'info', titre: 'Secret régénéré', texte: 'Copiez-le maintenant : il ne sera plus affiché.' });
    } catch (e) {
      notifier({ type: 'info', titre: 'Régénération impossible', texte: messageErreur(e) });
    }
  };

  return (
    <div className="mt-esp-3 flex flex-col gap-esp-4">
      <Card survol={false}>
        <CardHeader><h3 className="!text-[18px]">Dépôt lié</h3></CardHeader>
        <CardBody className="flex flex-col gap-esp-3">
          <div>
            <Label htmlFor="gh-repo">Dépôt (owner/nom)</Label>
            <div className="mt-esp-2"><Input id="gh-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="digicom/mon-projet" /></div>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-esp-2 font-courant text-[15px] text-gris-800">
            <input type="checkbox" checked={autoStatut} onChange={(e) => setAutoStatut(e.target.checked)} className="h-5 w-5" />
            Changer le statut des tâches automatiquement (PR ouverte → En cours, fusionnée → Review, jamais Done)
          </label>
          <div><Button taille="sm" onClick={sauverRepo}>Enregistrer</Button></div>
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><h3 className="!text-[18px]">Webhook entrant</h3></CardHeader>
        <CardBody className="flex flex-col gap-esp-2 font-courant text-[15px] text-gris-700">
          <p>Dans GitHub : <em>Settings → Webhooks → Add webhook</em> ; <em>Payload URL</em> = URL du hub ci-dessous ; <em>Content type</em> = <code>application/json</code> ; <em>Secret</em> = le secret ; événements = <em>Pushes</em> et <em>Pull requests</em>.</p>
          <p>Mentionnez <code>TASK-AAAA-NNNN</code> ou <code>BUG-AAAA-NNNN</code> dans vos messages de commit, titres/descriptions de PR ou noms de branche.</p>
          {webhookUrl && (
            <p className="flex flex-wrap items-center gap-esp-2">
              <code className="break-all font-mono text-[13px]">{webhookUrl}</code>
              <button type="button" onClick={() => copier(webhookUrl, 'URL du webhook copiée.')} className="inline-flex min-h-[44px] items-center gap-esp-1 font-semibold text-digi-texte"><Copy size={14} aria-hidden="true" /> Copier</button>
            </p>
          )}
          {secret && (
            <p className="flex flex-wrap items-center gap-esp-2 rounded-md bg-gris-100 p-esp-2">
              <code className="break-all font-mono text-[13px] font-bold">{secret}</code>
              <button type="button" onClick={() => copier(secret, 'Secret copié. Conservez-le, il ne sera plus affiché.')} className="inline-flex min-h-[44px] items-center gap-esp-1 font-semibold text-digi-texte"><Copy size={14} aria-hidden="true" /> Copier</button>
            </p>
          )}
          <div><Button taille="sm" variante="secondaire" onClick={regenerer}><RefreshCw size={14} aria-hidden="true" /> {(secret || webhookUrl) ? 'Régénérer' : 'Générer le secret'}</Button></div>
        </CardBody>
      </Card>
      <Card survol={false}>
        <CardHeader><h3 className="!text-[18px]">20 dernières livraisons</h3></CardHeader>
        <CardBody className="flex flex-col gap-esp-2">
          {livraisons.length === 0 && <p className="font-courant text-[15px] text-gris-600">Aucune livraison reçue.</p>}
          {livraisons.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-esp-2 rounded-lg bg-gris-100 p-esp-2">
              <Badge ton={l.statut_traitement === 'ok' ? 'succes' : 'neutre'}>{l.event} · {l.statut_traitement}</Badge>
              <span className="font-mono text-[13px] text-gris-600">{l.delivery_id}</span>
              {l.erreur && <span className="font-courant text-[13px] text-erreur">{l.erreur}</span>}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
