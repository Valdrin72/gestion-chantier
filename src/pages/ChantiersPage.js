import { mettreALaCorbeille } from '../utils/corbeille';
import useActionConfirmee from '../hooks/useActionConfirmee';
import { chantierEstReferencé } from '../utils/referenceGuard';
import React, { useRef, useLayoutEffect, useState } from 'react';
import { donneesInitiales, heuresEmploye } from '../donnees';
import { useApp } from '../context/AppContext';
import { useChantierFiltres } from '../hooks/useChantierFiltres';
import { archiver, restaurer } from '../utils/archiveHelpers';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import ChantierForm from '../components/chantiers/ChantierForm';
import ChantiersListe from '../components/chantiers/ChantiersListe';

import { aEteModifieAilleurs, conserverBrouillonRefuse, copieOrigine } from '../utils/gardeEdition';

// Supprime les balises HTML des champs texte avant sauvegarde (protection XSS dans PDF)
const sanitiser = (obj) => {
  const nettoyer = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').substring(0, 2000) : v;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nettoyer(v)]));
};

function Chantiers() {
  const { chantiers, setChantiers, devis = [], factures = [], pointages = [], parametres, naviguer, contexte, afficherNotif, confirmer, consultationMobile, profil, userId } = useApp();
  const { filtre, setFiltre, chantiersFiltres, chantiersArchives, joursParChantier } = useChantierFiltres();

  const listesRef = useRef({ chantiers, factures, pointages });
  listesRef.current = { chantiers, factures, pointages };
  const agir = useActionConfirmee(afficherNotif);
  const [vue, setVue] = useState('liste');
  const [selected, setSelected] = useState(null);
  const [detailOnglet, setDetailOnglet] = useState('analyse');
  const [ajout, setAjout] = useState(false);
  const [modeCompleter, setModeCompleter] = useState(false);

  const vide = {
    numero: `CH-${new Date().getFullYear()}-${String(Math.max(0, ...chantiers.map(c => parseInt((c.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`, nom: '', clientId: '', conducteur: '', directeurTravauxId: '', adresse: '', ville: '', canton: '',
    dateDebut: '', nombreJours: '', nombrePersonnes: '', joursRealises: '', inclusSamedi: false,
    statut: 'En cours', priorite: 'Normale', avancement: 0, typesTravaux: [], surface: '',
    montantDevis: '', avenants: [], montantFacture: 0, equipe: [], employes: [],
    coutMaterielPrevu: '', materielReel: '', coutSousTraitancePrevu: '', sousTraitanceReelle: '',
    autresCoutsPrevu: '', autresCoutsReels: '', imprevus: [], heuresPrevu: '', heuresRealise: '', notes: '',
    journal: [],
  };
  const [form, setForm] = useState(vide);
  const origineEditionRef = useRef(null);
  useLayoutEffect(() => {
    origineEditionRef.current = form.id && ajout
      ? copieOrigine((chantiers.find(item => String(item.id) === String(form.id)) || null))
      : null;
    // Capture uniquement à l'ouverture, jamais lors d'un rechargement distant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id, ajout]);
  const [erreurs, setErreurs] = useState({});

  // Sync selected avec chantiers[] — évite données stales après modification externe
  React.useEffect(() => {
    if (!selected) return;
    const updated = chantiers.find(c => c.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [chantiers]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (contexte?.chantierActif) {
      const c = chantiers.find(ch => ch.id === contexte.chantierActif);
      if (c) { setSelected(c); setVue('detail'); setDetailOnglet('analyse'); }
    }
    if (contexte?.modeCompleter) setModeCompleter(true);
    if (contexte?.filtreStatut) setFiltre(contexte.filtreStatut);
    if (contexte?.clientActif) setFiltre('Tous');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sauvegarder = () => {
    if (form.id && aEteModifieAilleurs(origineEditionRef.current, chantiers.find(item => String(item.id) === String(form.id)))) {
      afficherNotif?.("Ce chantier a été modifié sur un autre appareil pendant que vous l'éditiez. Vos changements n'ont pas été enregistrés : fermez et rouvrez-le pour repartir de la version à jour." + conserverBrouillonRefuse('chantiers', form), 'error');
      return;
    }
    const nouvellesErreurs = {};
    if (!form.nom?.trim()) nouvellesErreurs.nom = 'Le nom du chantier est obligatoire';
    if (!form.devisId) nouvellesErreurs.devisId = 'Un devis signé est obligatoire pour créer un chantier';
    if (!form.id && !form.dateDebut) nouvellesErreurs.dateDebut = 'La date de début est obligatoire';
    if (!form.id && (!form.nombreJours || parseInt(form.nombreJours) <= 0)) nouvellesErreurs.nombreJours = 'Le nombre de jours doit être supérieur à 0';
    if (Object.keys(nouvellesErreurs).length > 0) {
      setErreurs(nouvellesErreurs);
      return;
    }
    const nb = parseInt(form.nombreJours);
    if (form.nombreJours && (isNaN(nb) || nb <= 0)) { alert('Le nombre de jours doit être un entier positif.'); return; }
    const formSain = sanitiser(form);
    const devisLie = devis.find(d => String(d.id) === String(formSain.devisId));
    if (devisLie) {
      formSain.montantDevis = String(parseFloat(devisLie.montantHT) || 0);
    }
    const empsList = parametres.employes || donneesInitiales.employes || [];
    const equipeAvecJours = form.equipe.map(m => {
      const empId = parseInt(m.employeId);
      const jours = heuresEmploye(form.journal || [], empId) / 8;
      return { ...m, joursRealises: String(jours) };
    });
    const coefficient = parseFloat(parametres?.parametres?.coefficientMainOeuvre) || 1.0;
    const employes = equipeAvecJours.map(m => {
      const emp = empsList.find(e => e.id === parseInt(m.employeId));
      const jours = parseFloat(m.joursRealises) || 0;
      // Règle BTP : appliquer le coefficient charges si tarifDejaCharge n'est pas coché
      const tarifCharge = emp
        ? (emp.tarifDejaCharge ? (parseFloat(emp.tarifJour) || 0) : (parseFloat(emp.tarifJour) || 0) * coefficient)
        : 0;
      return { ...m, cout: tarifCharge * jours };
    });
    const joursReelsChantier = new Set((form.journal || []).map(e => e.date).filter(Boolean)).size;
    const joursPrevusChantier = parseInt(form.nombreJours) || 0;
    const avancementAuto = joursPrevusChantier > 0
      ? Math.min(100, Math.round((joursReelsChantier / joursPrevusChantier) * 100))
      : (form.id ? (parseFloat(form.avancement) || 0) : 0);
    const chantiersData = { ...formSain, employes, avancement: avancementAuto };
    let tableauFinal;
    if (form.id) {
      tableauFinal = chantiers.map(c => c.id === form.id ? chantiersData : c);
    } else {
      tableauFinal = [...chantiers, { ...chantiersData, id: Date.now() }];
    }
    setChantiers(tableauFinal);
    if (afficherNotif) afficherNotif(form.id ? 'Chantier mis à jour' : 'Chantier créé');
    if (modeCompleter && form.id) {
      const saved = tableauFinal.find(c => c.id === form.id);
      if (saved) { setSelected(saved); setVue('detail'); }
      setModeCompleter(false);
    }
    setAjout(false); setForm(vide); setErreurs({});
  };

  const supprimer = async (id, copieAvantPremiereConfirmation) => {
    const origine = copieAvantPremiereConfirmation || copieOrigine(listesRef.current.chantiers.find(ch => String(ch.id) === String(id)));
    if (!origine || consultationMobile) return;
    const reference = chantierEstReferencé(origine, listesRef.current);
    if (reference) { afficherNotif?.(reference, 'error'); return; }
    if (!await confirmer(`Supprimer le chantier "${origine.nom}" ?\n\nCet élément sera placé dans la corbeille (Paramètres → Corbeille) pendant 30 jours.`, { labelOui: 'Supprimer' })) return;
    agir(setChantiers, prev => {
      const actuel = prev.find(ch => String(ch.id) === String(id));
      const erreur = aEteModifieAilleurs(origine, actuel) ? "Cet élément a été modifié ou supprimé pendant la confirmation. Vérifiez les données puis recommencez." : chantierEstReferencé(actuel, listesRef.current);
      return { erreur, valeur: erreur ? prev : prev.map(ch => String(ch.id) === String(id) ? mettreALaCorbeille(ch, profil?.nom || userId) : ch) };
    }, 'Chantier placé dans la corbeille', () => { setSelected(null); setVue('liste'); });
  };

  const archiverChantier = async id => {
    const origine = copieOrigine(listesRef.current.chantiers.find(ch => String(ch.id) === String(id)));
    if (!origine || consultationMobile) return;
    if (!await confirmer(`Archiver le chantier "${origine.nom}" ?

Il sera rangé hors de la liste active mais conservé (heures, factures, historique).`, { labelOui: 'Archiver' })) return;
    agir(setChantiers, prev => {
      const actuel = prev.find(ch => String(ch.id) === String(id));
      const erreur = aEteModifieAilleurs(origine, actuel) ? "Cet élément a été modifié ou supprimé pendant la confirmation. Vérifiez les données puis recommencez." : null;
      return { erreur, valeur: erreur ? prev : prev.map(ch => String(ch.id) === String(id) ? archiver(ch) : ch) };
    }, 'Chantier archivé — visible via « Voir les archivés »', () => { setSelected(null); setVue('liste'); });
  };

  const restaurerChantier = (id) => {
    setChantiers(chantiers.map(ch => String(ch.id) === String(id) ? restaurer(ch) : ch));
    if (afficherNotif) afficherNotif('Chantier restauré dans la liste active');
  };

  const ouvrirModification = (c) => {
    // F4 — recapturer l'origine à chaque ouverture, même si c'est le même chantier.
    origineEditionRef.current = copieOrigine(chantiers.find(item => String(item.id) === String(c.id)));
    setSelected(null); setVue('liste'); setForm({ ...vide, ...c }); setAjout(true);
  };

  const passerEnCours = (c) => {
    const updated = { ...c, statut: 'En cours' };
    setChantiers(chantiers.map(ch => ch.id === c.id ? updated : ch));
    setSelected(updated);
    setModeCompleter(false);
  };

  if (vue === 'detail' && selected) {
    return (
      <ChantierDetail
        chantier={selected}
        detailOnglet={detailOnglet}
        setDetailOnglet={setDetailOnglet}
        modeCompleter={modeCompleter}
        onRetour={() => { setVue('liste'); setSelected(null); setModeCompleter(false); }}
        onModifier={ouvrirModification}
        onSupprimer={supprimer}
        onPasserEnCours={passerEnCours}
      />
    );
  }

  return (
    <ChantiersListe
      chantiersFiltres={chantiersFiltres}
      chantiersArchives={chantiersArchives}
      joursParChantier={joursParChantier}
      filtre={filtre}
      setFiltre={setFiltre}
      onSelect={(c) => { setSelected(c); setVue('detail'); setDetailOnglet('analyse'); }}
      onModifier={ouvrirModification}
      onSupprimer={supprimer}
      onArchiver={archiverChantier}
      onRestaurer={restaurerChantier}
      formSlot={ajout && !consultationMobile && (
        <ChantierForm
          form={form}
          setForm={setForm}
          erreurs={erreurs}
          setErreurs={setErreurs}
          modeCompleter={modeCompleter}
          onSauvegarder={sauvegarder}
          onAnnuler={() => { setAjout(false); setForm(vide); setErreurs({}); }}
          naviguer={naviguer}
        />
      )}
    />
  );
}

export default Chantiers;
