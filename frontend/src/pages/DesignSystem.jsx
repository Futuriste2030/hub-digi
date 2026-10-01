import { Info } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import BadgeNiveau from '../components/ui/BadgeNiveau.jsx';
import BadgePoste from '../components/ui/BadgePoste.jsx';
import EtatVide from '../components/ui/EtatVide.jsx';
import Stepper from '../components/ui/Stepper.jsx';
import AccordeonPermissions from '../components/ui/AccordeonPermissions.jsx';
import SwitchSensible from '../components/ui/SwitchSensible.jsx';
import { MODULES, PERMISSIONS } from '../data/permissions.js';
import Alert from '../components/ui/Alert.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import Logo from '../components/Logo.jsx';

/* Page de contrôle charte — un seul H1, surtitre avant chaque H2. */
export default function DesignSystem() {
  return (
    <div>
      <p className="dg-surtitre">Référence visuelle</p>
      <h1 className="mt-esp-2">Système design</h1>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Boutons</p>
        <h2 className="mt-esp-2">Actions</h2>
        <Card><CardBody className="flex flex-wrap gap-esp-4 pt-esp-5">
          <Button>Primaire</Button>
          <Button variante="secondaire">Secondaire</Button>
          <Button variante="fantome">Fantôme</Button>
          <Button chargement>Chargement</Button>
        </CardBody></Card>
      </section>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Cartes et badges</p>
        <h2 className="mt-esp-2">Conteneurs</h2>
        <div className="flex flex-wrap gap-esp-3">
          <Badge ton="info">Info</Badge>
          <Badge ton="succes">Succès</Badge>
          <Badge ton="alerte">Alerte</Badge>
          <Badge ton="erreur">Erreur</Badge>
        </div>
        <Card miseEnAvant className="mt-esp-4">
          <CardHeader><h3 className="!text-[26px]">Carte mise en avant</h3></CardHeader>
          <CardBody><p>Filet dégradé bleu de 3 px sur arête haute, une seule par rangée.</p></CardBody>
        </Card>
      </section>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Formulaires</p>
        <h2 className="mt-esp-2">Champs</h2>
        <Card><CardBody className="flex flex-col gap-esp-4 pt-esp-5">
          <div><Label htmlFor="demo-nom">Nom du client</Label><Input id="demo-nom" placeholder="Ex. Orange Mali" /></div>
          <div><Label htmlFor="demo-err">Adresse e-mail</Label><Input id="demo-err" placeholder="contact@client.ml" erreur="Envoi impossible. Vérifier l'adresse e-mail, puis relancer l'envoi." /></div>
          <div><Label htmlFor="demo-msg">Message</Label><Textarea id="demo-msg" value="" placeholder="Décrire la demande" onChange={() => {}} /></div>
        </CardBody></Card>
      </section>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Niveaux et postes</p>
        <h2 className="mt-esp-2">Hiérarchie</h2>
        <Card><CardBody className="flex flex-wrap gap-esp-2 pt-esp-5">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => <BadgeNiveau key={n} niveau={n} />)}
        </CardBody></Card>
        <Card className="mt-esp-4"><CardBody className="flex flex-wrap items-center gap-esp-4 pt-esp-5">
          <BadgePoste libelle="Développeur back" />
          <BadgePoste libelle="DevOps" personnalise />
        </CardBody></Card>
        <Card className="mt-esp-4"><EtatVide titre="Aucun utilisateur" texte="Aucun compte avec ces filtres." /></Card>
      </section>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Création de compte</p>
        <h2 className="mt-esp-2">Stepper et permissions</h2>
        <Card><CardBody className="pt-esp-5">
          <Stepper etapes={['Identité', 'Rattachement', 'Permissions']} courant={1} />
        </CardBody></Card>
        <Card className="mt-esp-4"><CardBody className="pt-esp-5">
          <AccordeonPermissions
            modules={MODULES.filter((m) => m.id === 'clients' || m.id === 'com')}
            codesParModule={{ clients: ['clients.read', 'clients.create'], com: ['com.calendrier_read'] }}
            meta={Object.fromEntries(PERMISSIONS.map((p) => [p.code, p]))}
            effectives={['clients.read', 'com.calendrier_read']}
            ajuste={(code) => code === 'clients.read'}
            onToggle={() => {}}
          />
        </CardBody></Card>
        <Card className="mt-esp-4"><CardBody className="flex flex-col gap-esp-2 pt-esp-5">
          <SwitchSensible code="paie.valider" libelle="Clôturer la paie" checked={false} onDemande={() => {}} />
        </CardBody></Card>
      </section>

      <section className="mt-esp-7">
        <p className="dg-surtitre">Alertes et logo</p>
        <h2 className="mt-esp-2">Retours</h2>
        <div className="flex flex-col gap-esp-4">
          <Alert ton="info" titre="Information"><span className="inline-flex items-center gap-esp-2"><Info size={16} aria-hidden="true" /> Message factuel et actionnable.</span></Alert>
          <Alert ton="erreur" titre="Erreur">Envoi impossible. Vérifier la pièce jointe, puis relancer l-envoi.</Alert>
        </div>
        <div className="dg-fond-marine mt-esp-4 rounded-lg p-esp-6">
          <p className="dg-surtitre dg-surtitre-sur-marine">Logo sur marine</p>
          <Logo hauteur={44} className="mt-esp-3" />
        </div>
        <div className="mt-esp-4 rounded-lg bg-gris-0 p-esp-6">
          <p className="dg-surtitre">Logo sur fond clair</p>
          <Logo hauteur={44} surClair className="mt-esp-3" />
        </div>
      </section>
    </div>
  );
}
