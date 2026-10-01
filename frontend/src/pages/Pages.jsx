import { Link } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';

export function PageSimple({ surtitre, titre, texte, badge = 'Phase 1' }) {
  return (
    <div>
      <p className="dg-surtitre">{surtitre}</p>
      <h1 className="mt-esp-2">{titre}</h1>
      <Card className="mt-esp-6">
        <CardBody className="flex items-center justify-between gap-esp-4 pt-esp-5">
          <p className="font-courant text-[17px]">{texte}</p>
          <Badge ton="info">{badge}</Badge>
        </CardBody>
      </Card>
      <p className="dg-legende mt-esp-4">
        Maquette connectée à venir. Voir la <Link to="/design-system" className="text-digi-texte underline">référence visuelle</Link>.
      </p>
    </div>
  );
}

export function Clients() {
  return <PageSimple surtitre="Fiche client 360°" titre="Clients" texte="Onglets par client : aperçu, projets, com, finance, juridique, tickets et mails." />;
}
export function Projets() {
  return <PageSimple surtitre="Développement" titre="Projets" texte="Kanban, jalons, deadlines et bugs remontés via tracker.js." />;
}
export function NonTrouve() {
  return <PageSimple surtitre="Erreur 404" titre="Page introuvable" texte="Vérifier l'adresse saisie, puis relancer la navigation." badge="Erreur" />;
}

/* Maquettes Phase 1 — une entrée par feature du menu (SPEC §5).
   Remplacer une entrée par sa vraie page dès qu'elle est câblée à l'API. */
export const FEATURE_ROUTES = [];

export function SectionPage({ surtitre, titre, texte }) {
  return <PageSimple surtitre={surtitre} titre={titre} texte={texte} />;
}
