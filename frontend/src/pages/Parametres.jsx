import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Building2, ReceiptText, Save, Stamp, Upload, Users, ArrowRight, MessageSquareText } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../components/ui/Card.jsx';
import { Label, Input, Textarea } from '../components/ui/Input.jsx';
import { chargerEntreprise, getEntreprise, majEntreprise } from '../data/parametres.js';
import { messageErreur } from '../api/client.js';

/* Paramètres société — infos reprises sur factures et reçus (SPEC §5.1). */

export default function Parametres() {
  const { notifier } = useOutletContext();
  const [form, setForm] = useState(getEntreprise());
  const [apercuEntete, setApercuEntete] = useState(null);
  const [apercusTampons, setApercusTampons] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const champ = (k) => ({
    value: form[k],
    onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  const inputCls = 'mt-esp-2';

  const choisirTampon = (cle, fichier) => {
    if (!fichier) return;
    if (!fichier.type.startsWith('image/')) {
      notifier({ type: 'info', titre: 'Fichier refusé', texte: 'Importez une image (PNG, JPG ou WebP).' });
      return;
    }
    if (fichier.size > 2 * 1024 * 1024) {
      notifier({ type: 'info', titre: 'Image trop lourde', texte: '2 Mo maximum pour les cachets et signatures.' });
      return;
    }
    setForm((f) => ({ ...f, [cle]: fichier }));
    setApercusTampons((a) => ({ ...a, [cle]: URL.createObjectURL(fichier) }));
  };

  const apercuTampon = (cle) => apercusTampons[cle] ?? (typeof form[cle] === 'string' ? form[cle] : null);

  useEffect(() => {
    chargerEntreprise().then(setForm);
  }, []);

  const enregistrer = async (e) => {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    try {
      const maj = await majEntreprise(form);
      setForm(maj);
      setApercusTampons({});
      notifier({ type: 'succes', titre: 'Paramètres enregistrés', texte: 'Factures et reçus utilisent ces informations.' });
    } catch (err) {
      notifier({ type: 'info', titre: 'Enregistrement impossible', texte: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div>
      <div>
        <p className="dg-surtitre">Système</p>
        <h1 className="mt-esp-2">Paramètres</h1>
        <p className="mt-esp-2 max-w-[65ch] font-courant text-[15px] text-gris-600">
          Raison sociale, identifiants et mentions repris sur chaque facture et reçu PDF.
        </p>
      </div>

      <Link to="/parametres/utilisateurs" className="mt-esp-6 flex items-center gap-esp-4 rounded-lg border border-gris-300 bg-gris-0 p-esp-5 shadow-ombre-1 transition-colors duration-rapide hover:border-digi">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
          <Users size={22} aria-hidden="true" className="text-digi" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-titrage text-[18px] font-bold text-gris-900">Utilisateurs</span>
          <span className="block font-courant text-[15px] text-gris-600">Création des comptes avec département et poste — Super Admin uniquement.</span>
        </span>
        <ArrowRight size={20} aria-hidden="true" className="shrink-0 text-digi" />
      </Link>

      <Link to="/parametres/chat" className="mt-esp-4 flex items-center gap-esp-4 rounded-lg border border-gris-300 bg-gris-0 p-esp-5 shadow-ombre-1 transition-colors duration-rapide hover:border-digi">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
          <MessageSquareText size={22} aria-hidden="true" className="text-digi" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-titrage text-[18px] font-bold text-gris-900">Chat — groupes</span>
          <span className="block font-courant text-[15px] text-gris-600">Groupe général + sous-groupes façon Slack, membres choisis ou tout le monde.</span>
        </span>
        <ArrowRight size={20} aria-hidden="true" className="shrink-0 text-digi" />
      </Link>

      <form onSubmit={enregistrer} className="mt-esp-4 grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
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
              <Label htmlFor="pm-raison">Raison sociale</Label>
              <div className={inputCls}><Input id="pm-raison" {...champ('raison')} /></div>
            </div>
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pm-nif">NIF</Label>
                <div className={inputCls}><Input id="pm-nif" {...champ('nif')} /></div>
              </div>
              <div>
                <Label htmlFor="pm-rccm">RCCM</Label>
                <div className={inputCls}><Input id="pm-rccm" {...champ('rccm')} /></div>
              </div>
            </div>
            <div>
              <Label htmlFor="pm-adresse">Adresse</Label>
              <div className={inputCls}><Input id="pm-adresse" {...champ('adresse')} /></div>
            </div>
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pm-phone">Téléphone</Label>
                <div className={inputCls}><Input id="pm-phone" {...champ('phone')} /></div>
              </div>
              <div>
                <Label htmlFor="pm-email">E-mail</Label>
                <div className={inputCls}><Input id="pm-email" type="email" {...champ('email')} /></div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card survol={false}>
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <ReceiptText size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Facturation</h2>
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-esp-4">
            <div className="grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pm-devise">Devise</Label>
                <div className={inputCls}><Input id="pm-devise" {...champ('devise')} /></div>
              </div>
              <div>
                <Label htmlFor="pm-tva">TVA (%)</Label>
                <div className={inputCls}><Input id="pm-tva" inputMode="numeric" {...champ('tauxTva')} /></div>
              </div>
            </div>
            <div>
              <Label htmlFor="pm-delai">Délai de paiement</Label>
              <div className={inputCls}><Input id="pm-delai" {...champ('delaiPaiement')} /></div>
            </div>
            <div>
              <Label htmlFor="pm-conditions">Conditions</Label>
              <div className={inputCls}><Textarea id="pm-conditions" {...champ('conditions')} value={form.conditions} rows={3} /></div>
            </div>
            <div>
              <Label htmlFor="pm-pied">Pied de page</Label>
              <div className={inputCls}><Textarea id="pm-pied" {...champ('pied')} value={form.pied} rows={2} /></div>
            </div>
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <Stamp size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Papier à en-tête</h2>
            </span>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-esp-4 lg:grid-cols-2">
              <div>
                <p className="font-courant text-[15px] font-semibold text-gris-700">Haut de page</p>
                <img src={apercuEntete || form.entete.haut} alt="Haut du papier à en-tête" className="mt-esp-2 w-full rounded-md border border-gris-300" />
              </div>
              <div>
                <p className="font-courant text-[15px] font-semibold text-gris-700">Bas de page</p>
                <img src={form.entete.bas} alt="Bas du papier à en-tête" className="mt-esp-2 w-full rounded-md border border-gris-300" />
                <label htmlFor="pm-entete" className="mt-esp-3 flex min-h-[44px] cursor-pointer items-center gap-esp-2 rounded-md border border-dashed border-gris-400 bg-gris-100 px-esp-4 font-courant text-[15px] text-gris-700 transition-colors duration-rapide hover:border-digi">
                  <Upload size={20} aria-hidden="true" className="shrink-0 text-digi" />
                  Remplacer par mon fichier…
                </label>
                <input
                  id="pm-entete"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.type.startsWith('image/')) setApercuEntete(URL.createObjectURL(f));
                    notifier({ type: 'info', titre: 'Fichier reçu', texte: `${f.name} — aperçu de session. Pour un remplacement définitif, écrasez public/entete/ puis redécoupez.` });
                  }}
                />
                <p className="dg-legende mt-esp-2">Source actuelle : {form.entete.source} dans public/entete/. Utilisé sur contrats, courriers, communiqués et rapports.</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card survol={false} className="lg:col-span-2">
          <CardHeader>
            <span className="flex items-center gap-esp-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-digi-voile">
                <Stamp size={20} aria-hidden="true" className="text-digi" />
              </span>
              <h2 className="!text-[18px]">Cachets & signatures</h2>
            </span>
          </CardHeader>
          <CardBody>
            <p className="font-courant text-[15px] text-gris-600">
              Tampons apposés sur les documents : la signature se superpose au cachet. PNG, JPG ou WebP · 2 Mo max.
            </p>
            <div className="mt-esp-4 grid grid-cols-1 gap-esp-4 sm:grid-cols-2">
              {[
                ['cachetFinance', 'Cachet — factures, devis, reçus'],
                ['signatureFinance', 'Signature — superposée au cachet finance'],
                ['cachetJuridique', 'Cachet — contrats, litiges'],
                ['signatureJuridique', 'Signature — superposée au cachet juridique'],
                ['cachetSecretariat', 'Cachet — courriers secrétariat (signature manuscrite après impression)'],
            ].map(([cle, libelle]) => {
              const sigCle = cle.replace('cachet', 'signature');
              const sigSrc = cle.startsWith('cachet')
                ? (apercusTampons[sigCle] ?? (typeof form[sigCle] === 'string' ? form[sigCle] : null))
                : null;
              return (
              <div key={cle} className="rounded-lg border border-gris-300 bg-gris-100 p-esp-4">
                <p className="font-courant text-[15px] font-semibold text-gris-900">{libelle}</p>
                {apercuTampon(cle) ? (
                  <span className="relative mt-esp-2 inline-block">
                    <img src={apercuTampon(cle)} alt={libelle} className="h-24 w-auto rounded-md border border-gris-300 bg-gris-0 object-contain" />
                    {sigSrc && (
                      <img
                        src={sigSrc}
                        alt="Signature superposée"
                        className="absolute inset-0 m-auto h-3/5 w-auto rotate-[-8deg] object-contain opacity-90"
                      />
                    )}
                  </span>
                ) : (
                  <p className="dg-legende mt-esp-2">Aucun fichier — le tampon fictif reste utilisé.</p>
                )}
                <label htmlFor={`pm-${cle}`} className="mt-esp-3 flex min-h-[44px] cursor-pointer items-center gap-esp-2 rounded-md border border-dashed border-gris-400 bg-gris-0 px-esp-4 font-courant text-[15px] text-gris-700 transition-colors duration-rapide hover:border-digi">
                  <Upload size={20} aria-hidden="true" className="shrink-0 text-digi" />
                  {apercuTampon(cle) ? 'Remplacer…' : 'Importer…'}
                </label>
                <input
                  id={`pm-${cle}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => { choisirTampon(cle, e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
              );
            })}
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" disabled={envoi}><Save size={20} aria-hidden="true" /> {envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </div>
  );
}
