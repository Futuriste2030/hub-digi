import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Save } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import AccesRestreint from '../components/guards/AccesRestreint.jsx';
import { ROLES_CHEF_RH, ROLES_RH, peutVoir } from '../lib/acces.js';
import Entete, { PiedEntete } from '../components/doc/Entete.jsx';
import EditeurRiche from '../components/editeur/EditeurRiche.jsx';
import { listerEmployes } from '../api/ressources.js';
import { creerContrat } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { getEntreprise } from '../data/parametres.js';
import { NonTrouve } from './Pages.jsx';

/* Contrat de travail par employé — API réelle (fiche employé + archivage contrat). */

const modeleContrat = (employe, entreprise) =>
  `<p>Entre <strong>${entreprise.raison}</strong>, employeur, et <strong>${employe.email}</strong>, salarié en qualité de ${employe.fonction || '—'}.</p>`
  + `<p>Le présent contrat prend effet à compter du ${employe.date_embauche || '—'} pour une durée indéterminée.</p>`
  + `<p>Le salarié exercera ses fonctions sous l'autorité de la Direction. Solde congés : ${employe.solde_conges} jours.</p>`
  + `<p>Fait en deux exemplaires.</p>`;

export default function ContratEmploye() {
  const { id } = useParams();
  const { notifier, session } = useOutletContext();
  const entreprise = getEntreprise();
  const [employe, setEmploye] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [contenu, setContenu] = useState(null);

  useEffect(() => {
    let actif = true;
    listerEmployes().then(
      (es) => {
        if (!actif) return;
        const trouve = es.find((e) => String(e.id) === String(id));
        if (!trouve) setIntrouvable(true);
        else setEmploye(trouve);
      },
      (e) => notifier({ type: 'info', titre: 'Chargement impossible', texte: messageErreur(e) }),
    );
    return () => { actif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (introuvable) return <NonTrouve />;

  const enregistrer = async () => {
    try {
      await creerContrat({
        titre: `Contrat de travail — ${employe.email}`, type: 'employe',
        employe: employe.id, contenu: contenu ?? initial,
      });
      notifier({ type: 'succes', titre: 'Contrat enregistré', texte: `Contrat de ${employe.email} archivé côté Juridique.` });
    } catch (e) {
      notifier({ type: 'info', titre: 'Archivage impossible', texte: messageErreur(e) });
    }
  };

  if (!peutVoir(session, ROLES_RH)) {
    return (
      <AccesRestreint
        titre="Contrats de travail réservés aux RH"
        requis="Seuls les membres des Ressources Humaines suivent les contrats de travail."
        onDemander={() => notifier({ type: 'info', titre: 'Demande transmise', texte: 'Le Chef RH étudiera votre accès.' })}
      />
    );
  }
  const peutValider = peutVoir(session, ROLES_CHEF_RH);

  if (!employe) {
    return <p className="rounded-lg bg-gris-0 p-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Chargement…</p>;
  }
  const initial = modeleContrat(employe, entreprise);

  return (
    <div>
      <div className="dg-no-print">
        <Link to="/rh/employes" className="inline-flex min-h-[44px] items-center gap-esp-1 font-courant text-[15px] font-semibold text-digi-texte">
          <ArrowLeft size={16} aria-hidden="true" /> Employés
        </Link>
        <div className="mt-esp-2 flex flex-wrap items-center gap-esp-3">
          <div className="mr-auto">
            <p className="dg-surtitre">RH</p>
            <h1 className="mt-esp-2">Contrat — {employe.email}</h1>
            <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
              {employe.fonction || '—'} · <span className="dg-tnum">{employe.solde_conges} j de congés</span>
            </p>
          </div>
          {peutValider && (
          <Button variante="secondaire" onClick={enregistrer}>
            <Save size={20} aria-hidden="true" /> Enregistrer
          </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer size={20} aria-hidden="true" /> Imprimer / PDF
          </Button>
        </div>
        <p className="dg-legende mt-esp-3">Modèle pré-rempli par la fiche employé. Enregistrer archive le contrat côté Juridique.</p>
      </div>

      <div className="mt-esp-6 grid grid-cols-1 gap-esp-4 xl:grid-cols-2">
        <div className="dg-no-print">
          <EditeurRiche valeurInitiale={initial} cle={`contrat-${employe.id}`} onChanger={setContenu} />
        </div>
        <div className="dg-print-doc rounded-lg border border-gris-300 bg-gris-0 p-esp-6 shadow-ombre-1">
          <Entete entreprise={entreprise} />
          <p className="mt-esp-5 text-center font-titrage text-[12px] font-bold uppercase tracking-[0.16em] text-gris-600">Contrat de travail</p>
          <h2 className="mt-esp-1 text-center !text-[21px]">{employe.email} — {employe.fonction}</h2>
          <div className="dg-doc mt-esp-4 font-courant text-[17px] leading-[1.65] text-gris-700" dangerouslySetInnerHTML={{ __html: contenu ?? initial }} />
          <div className="mt-esp-7 flex justify-between gap-esp-4">
            <p className="border-t border-gris-400 px-esp-4 pt-esp-2 text-center font-courant text-[13px] text-gris-600">Le Salarié<br />Lu et approuvé</p>
            <p className="border-t border-gris-400 px-esp-4 pt-esp-2 text-center font-courant text-[13px] text-gris-600">L Employeur<br /><em>{entreprise.signataire}</em></p>
          </div>
          <PiedEntete entreprise={entreprise} />
        </div>
      </div>
    </div>
  );
}
