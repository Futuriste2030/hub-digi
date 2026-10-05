import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Camera, Clock, MapPin, QrCode, CircleCheck, ArrowRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Html5Qrcode } from 'html5-qrcode';
import Button from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { genererQrPointage, scannerPointage, statutPointage } from '../api/ressources.js';
import { messageErreur } from '../api/client.js';
import { urlTableauDeBord } from '../lib/acces.js';

/* Pointage post-login — SPEC §5.5 (MAJ 05/10/2026).
   Horaires verrouillés 08h00–17h00 (heure serveur) : hors plage, cet écran
   renvoie vers le hub. Sinon : QR dynamique à scanner avec le mobile (GPS). */

const TYPE_LABEL = { arrivee: 'Arrivée', depart: 'Départ' };

function positionGps() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GPS indisponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error('Position refusée : autorisez le GPS puis réessayez.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function Pointage() {
  const naviguer = useNavigate();
  const { notifier, session } = useOutletContext();
  const [statut, setStatut] = useState(null);
  const [qr, setQr] = useState('');
  const [chargement, setChargement] = useState(true);
  const [scanOuvert, setScanOuvert] = useState(false);
  const [scanEnCours, setScanEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [transmise, setTransmise] = useState(false);
  const [erreur, setErreur] = useState('');
  const lecteurRef = useRef(null);

  const chargerQr = useCallback(async () => {
    try {
      const d = await genererQrPointage();
      setQr(d.qr);
      setErreur('');
    } catch (e) {
      setErreur(messageErreur(e, 'QR indisponible.'));
    }
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const s = await statutPointage();
        if (!actif) return;
        setStatut(s);
        if (s.doit_pointer) await chargerQr();
      } catch (e) {
        if (!actif) return;
        setStatut({ doit_pointer: false, motif: messageErreur(e, 'Pointage indisponible.') });
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => { actif = false; };
  }, [chargerQr]);

  /* QR dynamique : renouvelé toutes les 10 s (TTL serveur 60 s). */
  useEffect(() => {
    if (!statut?.doit_pointer || resultat) return;
    const t = setInterval(chargerQr, 10000);
    return () => clearInterval(t);
  }, [statut, resultat, chargerQr]);

  const arreterLecteur = useCallback(async () => {
    try {
      await lecteurRef.current?.stop();
    } catch {
      /* déjà arrêté */
    }
    try {
      await lecteurRef.current?.clear();
    } catch {
      /* rien à nettoyer */
    }
    lecteurRef.current = null;
  }, []);

  useEffect(() => () => { arreterLecteur(); }, [arreterLecteur]);

  const traiterQrScanne = useCallback(async (texte) => {
    await arreterLecteur();
    setScanOuvert(false);
    setScanEnCours(true);
    setErreur('');
    setTransmise(false);
    try {
      const pos = await positionGps();
      const r = await scannerPointage({ qr: texte, ...pos });
      setResultat(r);
      notifier({ type: 'succes', titre: `Pointage ${TYPE_LABEL[r.type] ?? r.type} enregistré`, texte: `${r.heure} — ${r.statut === 'retard' ? 'en retard' : r.statut === 'anticipe' ? 'départ anticipé' : 'à l heure'}.` });
    } catch (e) {
      setErreur(messageErreur(e, 'Pointage impossible.'));
      if (e?.response?.data?.tentative_id) setTransmise(true);
    } finally {
      setScanEnCours(false);
    }
  }, [arreterLecteur, notifier]);

  const ouvrirCamera = async () => {
    setErreur('');
    setScanOuvert(true);
    /* Laisse le DOM monter le conteneur avant de démarrer la caméra. */
    await new Promise((r) => setTimeout(r, 50));
    try {
      const lecteur = new Html5Qrcode('pointage-lecteur');
      lecteurRef.current = lecteur;
      await lecteur.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (texte) => { traiterQrScanne(texte); },
        () => { /* balayage en cours, silence */ },
      );
    } catch {
      setScanOuvert(false);
      setErreur('Caméra inaccessible : autorisez l accès puis réessayez (connexion sécurisée requise).');
    }
  };

  const fermerCamera = async () => {
    await arreterLecteur();
    setScanOuvert(false);
  };

  const continuer = () => naviguer(urlTableauDeBord(session));

  if (chargement) {
    return <p className="mt-esp-6 text-center font-courant text-[15px] text-gris-600" role="status">Vérification du pointage…</p>;
  }

  if (resultat) {
    return (
      <div className="mx-auto max-w-[560px]">
        <p className="dg-surtitre">RH · Pointage</p>
        <h1 className="mt-esp-2">Pointage enregistré</h1>
        <Card survol={false} className="mt-esp-6">
          <CardBody className="flex flex-col items-center gap-esp-3 py-esp-6 text-center">
            <CircleCheck size={48} aria-hidden="true" className="text-succes" />
            <p className="font-titrage text-[21px] font-bold text-gris-900">
              {TYPE_LABEL[resultat.type] ?? resultat.type} · <span className="dg-tnum">{resultat.heure}</span>
            </p>
            <p className="font-courant text-[15px] text-gris-600">
              {resultat.statut === 'retard' && 'Enregistré en retard (après 08h15).'}
              {resultat.statut === 'a_l_heure' && 'Arrivée à l heure. Bonne journée.'}
              {resultat.statut === 'normal' && 'Départ enregistré. Bonne soirée.'}
              {resultat.statut === 'anticipe' && 'Départ anticipé (avant 17h00) signalé à la RH.'}
            </p>
            <p className="dg-legende flex items-center gap-esp-1"><MapPin size={14} aria-hidden="true" /> Position vérifiée ({resultat.distance_m} m du site)</p>
            <Button onClick={continuer} className="mt-esp-2">Continuer vers le hub <ArrowRight size={16} aria-hidden="true" /></Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!statut?.doit_pointer) {
    return (
      <div className="mx-auto max-w-[560px]">
        <p className="dg-surtitre">RH · Pointage</p>
        <h1 className="mt-esp-2">Pointage</h1>
        <Card survol={false} className="mt-esp-6">
          <CardBody className="flex flex-col items-center gap-esp-3 py-esp-6 text-center">
            <Clock size={40} aria-hidden="true" className="text-gris-400" />
            <p className="font-courant text-[15px] text-gris-600">{statut?.motif ?? 'Rien à pointer pour le moment.'}</p>
            {statut?.heure_serveur && <p className="dg-legende dg-tnum">Heure du serveur : {statut.heure_serveur} (08h00–17h00)</p>}
            <Button onClick={continuer} className="mt-esp-2">Continuer vers le hub <ArrowRight size={16} aria-hidden="true" /></Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <p className="dg-surtitre">RH · Pointage {TYPE_LABEL[statut.type_attendu] ?? ''}</p>
      <h1 className="mt-esp-2">Scannez avec votre appareil mobile</h1>
      <p className="mt-esp-2 font-courant text-[15px] text-gris-600">
        Pointez votre <strong className="font-semibold">arrivée</strong> (08h00, retard après 08h15) ou votre{' '}
        <strong className="font-semibold">départ</strong> (17h00). La position GPS doit être dans les 150 m de l entreprise.
      </p>

      {erreur && <div className="mt-esp-4"><Alert ton="erreur" titre="Pointage impossible">{erreur}</Alert></div>}
      {transmise && !resultat && (
        <div className="mt-esp-4">
          <Alert ton="info" titre="Demande transmise">
            L administration peut autoriser ce scan (intempéries, GPS imprécis) depuis la liste des pointages.
          </Alert>
        </div>
      )}

      <Card survol={false} className="mt-esp-6">
        <CardBody className="flex flex-col items-center gap-esp-3 py-esp-6">
          {qr ? (
            <QRCode value={qr} size={220} aria-label={`QR dynamique de pointage ${statut.type_attendu}`} />
          ) : (
            <p className="font-courant text-[15px] text-gris-600" role="status">Génération du QR…</p>
          )}
          <p className="dg-legende flex items-center gap-esp-1"><QrCode size={14} aria-hidden="true" /> QR renouvelé automatiquement (toutes les 10 s)</p>
        </CardBody>
      </Card>

      <Card survol={false} className="mt-esp-4">
        <CardBody className="flex flex-col items-center gap-esp-3 py-esp-6 text-center">
          {!scanOuvert ? (
            <>
              <button
                type="button"
                onClick={ouvrirCamera}
                aria-label="Ouvrir la caméra pour scanner le QR"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-marine-profond text-blanc shadow-ombre-2 transition-transform duration-rapide hover:scale-105"
              >
                <Camera size={28} aria-hidden="true" />
              </button>
              <p className="font-courant text-[15px] text-gris-600">
                Sur votre mobile, touchez la caméra ci-dessus puis visez le QR affiché sur l écran du bureau.
              </p>
            </>
          ) : (
            <div className="w-full">
              <div id="pointage-lecteur" className="overflow-hidden rounded-lg" />
              <Button variante="fantome" onClick={fermerCamera} className="mt-esp-3">Fermer la caméra</Button>
            </div>
          )}
          {scanEnCours && <p className="font-courant text-[15px] text-gris-600" role="status">Vérification GPS et enregistrement…</p>}
        </CardBody>
      </Card>
    </div>
  );
}
