import { copieOrigine, aChangeDepuis, conserverBrouillonRefuse } from '../../utils/gardeEdition';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DS } from '../../ds';
import { V1 } from '../../design/v1';
import { useApp } from '../../context/AppContext';
import { usePointages } from '../../hooks/usePointages';
import LigneRepartition from './LigneRepartition';
import SectionAbsences from './SectionAbsences';
import SectionDeplacement from './SectionDeplacement';

const TODAY = new Date().toISOString().split('T')[0];
const MAX_LIGNES = 4;

const REPARTITION_VIDE = { chantierId: '', categorie: 'production', heures: '' };
const ABSENCE_INITIAL = { active: false, categorie: 'absence_cp', heures: '8' };
const DEPLACEMENT_INITIAL = { active: false, duree_h: '', indemnite_chf: '' };

function buildRepartitions(form) {
  const lignes = form.repartitions
    .filter(r => r.chantierId && parseFloat(r.heures) > 0)
    .map(r => ({
      chantierId: r.chantierId,
      categorie: r.categorie,
      heures: parseFloat(r.heures),
    }));
  if (form.absence.active && parseFloat(form.absence.heures) > 0) {
    lignes.push({
      chantierId: null,
      categorie: form.absence.categorie,
      heures: parseFloat(form.absence.heures),
    });
  }
  return lignes;
}

function buildDeplacement(form) {
  if (!form.deplacement.active) return null;
  const duree_h = parseFloat(form.deplacement.duree_h);
  if (!duree_h || duree_h <= 0) return null;
  return { duree_h, indemnite_chf: parseFloat(form.deplacement.indemnite_chf) || 0 };
}

function cantonDominant(form, chantiers) {
  if (form.repartitions.length === 0) return 'GE';
  const premiere = form.repartitions[0];
  const chantier = chantiers.find(c => String(c.id) === String(premiere.chantierId));
  return chantier?.canton ?? 'GE';
}

/**
 * Formulaire principal de saisie/modification d'un pointage.
 * Inclut détection auto-édition (Q2) : si (date, employeId) existant → pré-remplit.
 * Props optionnelles initialDate/initialEmployeId/initialChantierId : pré-remplissage au 1er render.
 */
export default function PointageFormulaire({ onSaved, initialDate, initialEmployeId, initialChantierId }) {
  const { chantiers, parametres, pointages, setPointages, afficherNotif } = useApp();
  const { upsertPointage } = usePointages({ pointages, setPointages });

  const employes = parametres?.employes ?? [];
  const chantiersActifs = chantiers.filter(c =>
    ['en cours', 'planifié'].includes(c.statut?.toLowerCase?.() ?? '')
  );

  const [form, setForm] = useState(() => ({
    employeId: initialEmployeId != null ? String(initialEmployeId) : '',
    date: initialDate || TODAY,
    repartitions: [{
      chantierId: initialChantierId != null ? String(initialChantierId) : '',
      categorie: 'production',
      heures: '',
    }],
    absence: { ...ABSENCE_INITIAL },
    deplacement: { ...DEPLACEMENT_INITIAL },
  }));
  const origineRef = useRef(null);
  const origineEnAttenteRef = useRef(false);
  // REV-02 — accusé de réception : l'enregistrement est considéré comme fait seulement quand
  // le pointage écrit (même date, employé et modifie_le) apparaît dans la liste.
  const accuseRef = useRef(null);
  const formRef = useRef(null);
  const DELAI_ACCUSE_MS = 3000;
  useEffect(() => () => clearTimeout(accuseRef.current?.minuteur), []);
  formRef.current = form;
  const [mode, setMode] = useState('create');
  const [erreurs, setErreurs] = useState([]);
  const [flash, setFlash] = useState(null);

  // Auto-édition (Q2) : pré-remplir si (date, employeId) existe déjà
  useEffect(() => {
    if (!form.date || !form.employeId) { setMode('create'); return; }
    const existing = pointages.find(p =>
      p.date === form.date && String(p.employeId) === String(form.employeId)
    );
    origineRef.current = copieOrigine(existing);
    origineEnAttenteRef.current = false;
    if (!existing) { setMode('create'); return; }

    setMode('edit');
    // Reconstruit l'état du formulaire depuis le pointage existant
    const repsAvecChantier = existing.repartitions
      .filter(r => r.chantierId)
      .map(r => ({ chantierId: String(r.chantierId), categorie: r.categorie, heures: String(r.heures) }));
    const absenceRep = existing.repartitions.find(r => !r.chantierId && r.categorie !== 'deplacement');

    setForm(prev => ({
      ...prev,
      repartitions: repsAvecChantier.length > 0 ? repsAvecChantier : [{ ...REPARTITION_VIDE }],
      absence: absenceRep
        ? { active: true, categorie: absenceRep.categorie, heures: String(absenceRep.heures) }
        : { active: false, categorie: 'absence_cp', heures: '8' },
      deplacement: existing.deplacement
        ? { active: true, duree_h: String(existing.deplacement.duree_h), indemnite_chf: String(existing.deplacement.indemnite_chf) }
        : { active: false, duree_h: '', indemnite_chf: '' },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.employeId]);

  useEffect(() => {
    if (!origineEnAttenteRef.current) return;
    const actuel = pointages.find(p => p.date === form.date && String(p.employeId) === String(form.employeId));
    const accuse = accuseRef.current;
    if (accuse) {
      // Origine = l'enregistrement RÉELLEMENT présent dans la liste (pas une reconstruction).
      if (!actuel || actuel.modifie_le !== accuse.modifie_le) return;
      clearTimeout(accuse.minuteur);
      accuseRef.current = null;
      origineRef.current = copieOrigine(actuel);
      origineEnAttenteRef.current = false;
      // IR-02 — si la saisie a changé depuis l'envoi, on garde la NOUVELLE saisie : ni vidage du
      // formulaire, ni fermeture de la modale. Seul l'enregistrement envoyé est confirmé.
      if (JSON.stringify(formRef.current) !== accuse.formEnvoye) {
        if (afficherNotif) afficherNotif(accuse.msg + ' (vos modifications suivantes ne sont pas encore enregistrées)');
        setErreurs([]);
        return;
      }
      terminerSucces(accuse.msg);
      return;
    }
    origineRef.current = copieOrigine(actuel);
    origineEnAttenteRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointages, form.date, form.employeId]);

  const terminerSucces = msg => {
    if (afficherNotif) afficherNotif(msg);
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
    setErreurs([]);
    setMode('create');
    setForm(prev => ({ ...prev, repartitions: [{ ...REPARTITION_VIDE }], absence: { ...ABSENCE_INITIAL }, deplacement: { ...DEPLACEMENT_INITIAL } }));
    if (onSaved) onSaved();
  };

  const setDate = useCallback(date => {
    setForm(prev => ({ ...prev, date, repartitions: [{ ...REPARTITION_VIDE }], absence: { ...ABSENCE_INITIAL }, deplacement: { ...DEPLACEMENT_INITIAL } }));
    setErreurs([]);
  }, []);

  const setEmployeId = useCallback(employeId => {
    setForm(prev => ({ ...prev, employeId, repartitions: [{ ...REPARTITION_VIDE }], absence: { ...ABSENCE_INITIAL }, deplacement: { ...DEPLACEMENT_INITIAL } }));
    setErreurs([]);
  }, []);

  const updateLigne = (idx, partial) => {
    setForm(prev => {
      const reps = prev.repartitions.map((r, i) => i === idx ? { ...r, ...partial } : r);
      return { ...prev, repartitions: reps };
    });
  };

  const ajouterLigne = () => {
    if (form.repartitions.length >= MAX_LIGNES) return;
    setForm(prev => ({ ...prev, repartitions: [...prev.repartitions, { ...REPARTITION_VIDE }] }));
  };

  const supprimerLigne = idx => {
    setForm(prev => ({ ...prev, repartitions: prev.repartitions.filter((_, i) => i !== idx) }));
  };

  const updateAbsence = partial => setForm(prev => ({ ...prev, absence: { ...prev.absence, ...partial } }));
  const updateDeplacement = partial => setForm(prev => ({ ...prev, deplacement: { ...prev.deplacement, ...partial } }));

  const sauvegarder = () => {
    const repartitions = buildRepartitions(form);
    if (repartitions.length === 0) {
      setErreurs(['Saisissez au moins une ligne de travail ou une absence.']);
      return;
    }
    const total = repartitions.reduce((s, r) => s + r.heures, 0);
    if (total > 16) {
      setErreurs([`Total heures (${total}h) dépasse le maximum de 16h.`]);
      return;
    }

    const canton = cantonDominant(form, chantiers);
    const pointage = {
      date: form.date,
      employeId: parseInt(form.employeId, 10) || form.employeId,
      repartitions,
      deplacement: buildDeplacement(form),
      majoration: null,
      saisi_par: 'user',
    };

    // F4 — jamais de clic ignoré sans message.
    if (origineEnAttenteRef.current) {
      setErreurs(["L'enregistrement précédent est encore en cours de prise en compte. Réessayez dans un instant."]);
      return;
    }
    const actuel = pointages.find(p => p.date === form.date && String(p.employeId) === String(form.employeId));
    if (aChangeDepuis(origineRef.current, actuel)) {
      const message = "Ce pointage a été modifié sur un autre appareil. Vérifiez puis rouvrez le formulaire." + conserverBrouillonRefuse('pointages', pointage);
      setErreurs([message]); afficherNotif?.(message, 'error'); return;
    }
    const res = upsertPointage(pointage, canton);
    if (!res.ok) {
      setErreurs([res.error || 'Erreur lors de la sauvegarde.']);
      return;
    }

    const nomChantier = chantiersActifs.find(c => String(c.id) === String(form.repartitions[0]?.chantierId))?.nom;
    const msg = mode === 'edit'
      ? 'Pointage modifié avec succès'
      : `Pointage enregistré${nomChantier ? ` — ${nomChantier}` : ''}`;
    origineEnAttenteRef.current = true;
    if (res.pointage?.modifie_le) {
      // REV-02 — attendre l'accusé de réception avant d'annoncer le succès, de vider la saisie
      // et de fixer l'origine. Sans accusé dans le délai : erreur, saisie conservée.
      const minuteur = setTimeout(() => {
        if (accuseRef.current?.minuteur !== minuteur) return;
        accuseRef.current = null;
        origineEnAttenteRef.current = false;
        setErreurs(["Le pointage n'a pas pu être enregistré. Votre saisie est conservée : réessayez."]);
      }, DELAI_ACCUSE_MS);
      accuseRef.current = { modifie_le: res.pointage.modifie_le, msg, minuteur, formEnvoye: JSON.stringify(form) };
      return;
    }
    // Sans enregistrement renvoyé (appelant qui ne le fournit pas) : comportement historique,
    // l'origine est reprise dans la liste au rendu suivant.
    terminerSucces(msg);
  };

  const peutSauvegarder = form.date && form.employeId &&
    (form.repartitions.some(r => r.chantierId && parseFloat(r.heures) > 0) ||
     (form.absence.active && parseFloat(form.absence.heures) > 0));

  return (
    <div style={{ ...DS.card, maxWidth: '640px' }}>
      {/* Indicateur mode édition */}
      {mode === 'edit' && (
        <div style={{
          background: '#fffbeb', border: '1px solid #f59e0b44',
          borderRadius: '8px', padding: '8px 12px', marginBottom: '16px',
          fontSize: '13px', color: '#b45309', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          ✏️ Modification d'un pointage existant
        </div>
      )}

      {/* Flash succès */}
      {flash && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #10b98133',
          borderRadius: '8px', padding: '8px 12px', marginBottom: '16px',
          fontSize: '13px', color: '#059669', fontWeight: 600,
        }}>
          ✓ {flash}
        </div>
      )}

      {/* Erreurs de validation */}
      {erreurs.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #ef444433',
          borderRadius: '8px', padding: '8px 12px', marginBottom: '16px',
          fontSize: '13px', color: '#dc2626',
        }}>
          {erreurs.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Date + Employé */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ ...DS.label, display: 'block', marginBottom: '4px' }}>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setDate(e.target.value)}
            style={{ ...DS.input, width: '100%', padding: '8px 10px', fontSize: '13px' }}
          />
        </div>
        <div style={{ flex: 2, minWidth: '180px' }}>
          <label style={{ ...DS.label, display: 'block', marginBottom: '4px' }}>Employé</label>
          <select
            value={form.employeId}
            onChange={e => setEmployeId(e.target.value)}
            style={{ ...DS.input, width: '100%', padding: '8px 10px', fontSize: '13px' }}
          >
            <option value="">— Sélectionnez un employé —</option>
            {employes.filter(e => e.actif !== false).map(e => (
              <option key={e.id} value={String(e.id)}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Répartitions multi-chantier */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Répartitions chantier
        </div>
        {form.repartitions.map((rep, idx) => (
          <LigneRepartition
            key={idx}
            repartition={rep}
            chantiers={chantiersActifs}
            date={form.date}
            onChange={partial => updateLigne(idx, partial)}
            onDelete={() => supprimerLigne(idx)}
            canDelete={form.repartitions.length > 1}
          />
        ))}
        {form.repartitions.length < MAX_LIGNES && (
          <button
            type="button"
            onClick={ajouterLigne}
            style={{ ...DS.btnGhost, marginTop: '4px', fontSize: '12px', padding: '6px 12px', color: V1.bleu, border: `1px solid ${V1.bleu}40`, background: V1.bleu + '0d' }}
          >
            + Ajouter un chantier
          </button>
        )}
      </div>

      {/* Séparateur */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* Absences */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Absence
        </div>
        <SectionAbsences absence={form.absence} onChange={updateAbsence} />
      </div>

      {/* Déplacement */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Déplacement
        </div>
        <SectionDeplacement deplacement={form.deplacement} onChange={updateDeplacement} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => { setForm(prev => ({ ...prev, repartitions: [{ ...REPARTITION_VIDE }], absence: { ...ABSENCE_INITIAL }, deplacement: { ...DEPLACEMENT_INITIAL } })); setErreurs([]); setMode('create'); }}
          style={DS.btnGhost}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={sauvegarder}
          disabled={!peutSauvegarder}
          style={{ ...DS.btnPrimary, opacity: peutSauvegarder ? 1 : 0.5, cursor: peutSauvegarder ? 'pointer' : 'not-allowed' }}
        >
          {mode === 'edit' ? 'Modifier le pointage' : 'Enregistrer le pointage'}
        </button>
      </div>
    </div>
  );
}
