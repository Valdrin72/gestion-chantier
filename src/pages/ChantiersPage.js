import React, { useState } from 'react';
import { donneesInitiales, heuresEmploye } from '../donnees';
import { useApp } from '../context/AppContext';
import { useChantierFiltres } from '../hooks/useChantierFiltres';
import ChantierDetail from '../components/chantiers/ChantierDetail';
import ChantierForm from '../components/chantiers/ChantierForm';
import ChantiersListe from '../components/chantiers/ChantiersListe';

// Supprime les balises HTML des champs texte avant sauvegarde (protection XSS dans PDF)
const sanitiser = (obj) => {
  const nettoyer = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').substring(0, 2000) : v;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nettoyer(v)]));
};

function Chantiers() {
  const { chantiers, setChantiers, devis = [], factures = [], setFactures, parametres, naviguer, contexte } = useApp();
  const { filtre, setFiltre, chantiersFiltres, joursParChantier } = useChantierFiltres();

  const [vue, setVue] = useState('liste');
  const [selected, setSelected] = useState(null);
  const [detailOnglet, setDetailOnglet] = useState('vue');
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
      if (c) { setSelected(c); setVue('detail'); setDetailOnglet('vue'); }
    }
    if (contexte?.modeCompleter) setModeCompleter(true);
    if (contexte?.filtreStatut) setFiltre(contexte.filtreStatut);
    if (contexte?.clientActif) setFiltre('Tous');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sauvegarder = () => {
    if (!form.nom) return;
    if (!form.devisId) {
      setErreurs(prev => ({ ...prev, devisId: 'Un devis signé est obligatoire pour créer un chantier' }));
      return;
    }
    if (!form.id && (!form.dateDebut || !form.nombreJours)) return;
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
    const employes = equipeAvecJours.map(m => {
      const emp = empsList.find(e => e.id === parseInt(m.employeId));
      const jours = parseFloat(m.joursRealises) || 0;
      return { ...m, cout: emp ? (parseFloat(emp.tarifJour) || 0) * jours : 0 };
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
    if (modeCompleter && form.id) {
      const saved = tableauFinal.find(c => c.id === form.id);
      if (saved) { setSelected(saved); setVue('detail'); }
      setModeCompleter(false);
    }
    setAjout(false); setForm(vide); setErreurs({});
  };

  const supprimer = (id) => {
    const c = chantiers.find(ch => ch.id === id);
    const facturesLiees = factures.filter(f => String(f.chantierId) === String(id));
    const msg = facturesLiees.length > 0
      ? `Supprimer le chantier "${c?.nom}" et ses ${facturesLiees.length} facture(s) liée(s) ? Cette action est irréversible.`
      : `Supprimer le chantier "${c?.nom}" ? Cette action est irréversible.`;
    if (!window.confirm(msg)) return;
    setChantiers(chantiers.filter(ch => ch.id !== id));
    if (facturesLiees.length > 0) setFactures(factures.filter(f => String(f.chantierId) !== String(id)));
    setSelected(null);
    setVue('liste');
  };

  const ouvrirModification = (c) => {
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
      joursParChantier={joursParChantier}
      filtre={filtre}
      setFiltre={setFiltre}
      onSelect={(c) => { setSelected(c); setVue('detail'); setDetailOnglet('vue'); }}
      onModifier={ouvrirModification}
      onSupprimer={supprimer}
      formSlot={ajout && (
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
