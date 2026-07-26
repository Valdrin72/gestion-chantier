import React, { useState, useMemo, useCallback } from 'react';
import { C, heuresJour } from '../donnees';
import { DS } from '../ds';
import { useApp } from '../context/AppContext';
import { usePointages } from '../hooks/usePointages';

/**
 * SAISIE D'HEURES UNIFIÉE (simple, multi-employé) — porte unique des contextes :
 * Accueil (widget), fiche chantier (chantier fixé), grille Heures.
 *
 * Écrit TOUJOURS via `upsertPointage` (fusion multi-chantier C1, validation des
 * heures ≤0/NaN, recalcul des majorations CCT — tout est centralisé dans le hook,
 * jamais réimplémenté ici). Catégorie = 'production' (les cas rares — atelier,
 * absences, déplacement — restent dans l'écran Pointages « mode détaillé »).
 *
 * Superset des garde-fous des anciens P1/P2 :
 *  - refus date future (sauf samedi de la semaine courante si chantier.inclusSamedi)
 *  - refus date avant le début du chantier
 *  - confirmation au-delà de 10h/employé
 *  - refus des heures ≤ 0 (filtre + hook)
 *
 * @param {object|null} chantierFixe  - chantier imposé (fiche / modale) ; sinon select
 * @param {Array}       chantiers     - liste sélectionnable si pas de chantierFixe
 * @param {string}      initialDate   - 'YYYY-MM-DD'
 * @param {string|null} initialEmployeId - employé à pré-remplir (grille : cellule cliquée)
 * @param {object}      parametres    - contient employes
 * @param {function}    onSaved       - callback après enregistrement réussi
 */

function localISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SaisieHeuresRapide({
  chantierFixe = null,
  chantiers = [],
  initialDate,
  initialEmployeId = null,
  parametres,
  onSaved,
}) {
  const { pointages, setPointages, afficherNotif } = useApp();
  const { upsertPointage } = usePointages({ pointages, setPointages });

  const [chantierId, setChantierId] = useState(chantierFixe ? String(chantierFixe.id) : '');
  const [date, setDate] = useState(initialDate || localISODate(new Date()));
  const [heures, setHeures] = useState({});
  const [succes, setSucces] = useState(false);

  const chantier = useMemo(() => {
    if (chantierFixe) return chantierFixe;
    return chantiers.find(c => String(c.id) === chantierId) || null;
  }, [chantierFixe, chantiers, chantierId]);

  // Employés : équipe du chantier en premier, puis les autres actifs.
  const equipeIds = useMemo(
    () => new Set((chantier?.equipe || []).map(m => parseInt(m.employeId))),
    [chantier]
  );
  const empsList = useMemo(() => {
    const tous = (parametres?.employes || []).map(e => ({
      id: e.id,
      nom: `${e.prenom || ''} ${e.nom || ''}`.trim() || `Employé #${e.id}`,
      poste: e.poste || '',
      dansEquipe: equipeIds.has(e.id),
    }));
    return [...tous.filter(e => e.dansEquipe), ...tous.filter(e => !e.dansEquipe)];
  }, [parametres, equipeIds]);

  // Pré-remplissage depuis le journal dérivé (édition d'une saisie existante).
  const chargerJournal = useCallback((ch, d) => {
    setHeures(ch ? heuresJour(ch.journal || [], d) : {});
  }, []);

  const handleChantier = (id) => {
    setChantierId(id);
    setSucces(false);
    chargerJournal(chantiers.find(c => String(c.id) === id) || null, date);
  };
  const handleDate = (d) => {
    setDate(d);
    setSucces(false);
    chargerJournal(chantier, d);
  };

  // ── Validation de date (superset P1/P2) ──────────────────────────────────
  const dateDebut = chantier?.dateDebut || null;
  const today = localISODate(new Date());
  const samSemaineCourante = useMemo(() => {
    const t = new Date();
    const day = t.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(t);
    monday.setDate(t.getDate() - diffToMonday);
    monday.setDate(monday.getDate() + 5); // samedi
    return localISODate(monday);
  }, []);
  const isSamedi = date ? new Date(date + 'T00:00:00').getDay() === 6 : false;
  const samediFuturAutorise = isSamedi && date === samSemaineCourante && chantier?.inclusSamedi;
  const avantDebut = dateDebut && date < dateDebut;
  const dansLeFutur = date > today && !samediFuturAutorise;
  const dateInvalide = avantDebut || dansLeFutur;
  const maxDate = chantier?.inclusSamedi && samSemaineCourante > today ? samSemaineCourante : today;

  const hierDate = useMemo(() => {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - 1);
    return localISODate(d);
  }, [date]);

  const totalH = Object.values(heures).reduce((s, h) => s + (parseFloat(h) || 0), 0);
  const nbSaisis = Object.values(heures).filter(h => (parseFloat(h) || 0) > 0).length;

  const enregistrer = useCallback(() => {
    if (!chantier || nbSaisis === 0 || dateInvalide) return;
    const overLimit = Object.entries(heures).some(([, h]) => (parseFloat(h) || 0) > 10);
    if (overLimit && !window.confirm('Certains employés dépassent 10h. Confirmer ?')) return;
    const canton = chantier.canton ?? 'GE';
    const cId = String(chantier.id);
    Object.entries(heures)
      .filter(([, h]) => (parseFloat(h) || 0) > 0)
      .forEach(([empId, h]) => {
        upsertPointage({
          date,
          employeId: parseInt(empId),
          repartitions: [{ categorie: 'production', heures: parseFloat(h), chantierId: cId }],
          deplacement: null,
        }, canton);
      });
    if (afficherNotif) afficherNotif(`Heures enregistrées — ${chantier.nom || chantier.numero || ''}`.trim());
    setSucces(true);
    setHeures({});
    if (onSaved) onSaved();
  }, [chantier, nbSaisis, dateInvalide, heures, date, upsertPointage, afficherNotif, onSaved]);

  const setEmp = (id, v) => { setSucces(false); setHeures(prev => ({ ...prev, [id]: v })); };

  return (
    <div>
      {succes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>Heures enregistrées avec succès.</span>
        </div>
      )}

      {/* Chantier (select si non fixé) + Date */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {!chantierFixe && (
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label style={DS.label}>Chantier</label>
            <select aria-label="Chantier" value={chantierId} onChange={e => handleChantier(e.target.value)} style={{ ...DS.input, width: '100%' }}>
              <option value="">— Sélectionner un chantier —</option>
              {chantiers.map(c => <option key={c.id} value={String(c.id)}>{c.nom || c.numero}</option>)}
            </select>
          </div>
        )}
        <div style={{ flex: '0 0 auto' }}>
          <label style={DS.label}>Date</label>
          <input aria-label="Date" type="date" value={date} max={maxDate} min={dateDebut || undefined}
            onChange={e => handleDate(e.target.value)}
            style={{ ...DS.input, borderColor: dateInvalide ? '#ef4444' : undefined }} />
        </div>
      </div>

      {dateInvalide && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b', fontWeight: 700 }}>
          {dansLeFutur ? 'Date dans le futur — saisie impossible.' : `Chantier pas encore démarré (débute le ${dateDebut}).`}
        </div>
      )}

      {chantier && empsList.length > 0 && (
        <>
          {/* Actions groupées */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => {
              const h = heuresJour(chantier.journal || [], hierDate);
              if (Object.keys(h).length === 0) { if (afficherNotif) afficherNotif('Aucune saisie trouvée pour la veille.'); return; }
              setHeures({ ...h });
            }} style={{ fontSize: 12, fontWeight: 700, color: C.info, background: C.info + '15', border: `1px solid ${C.info}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Remplir comme hier</button>
            <button type="button" onClick={() => {
              const h = {};
              const cibles = equipeIds.size > 0 ? empsList.filter(e => e.dansEquipe) : empsList;
              cibles.forEach(e => { h[e.id] = 8; });
              setHeures(h);
            }} style={{ fontSize: 12, fontWeight: 700, color: C.primaire, background: C.primaire + '15', border: `1px solid ${C.primaire}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {equipeIds.size > 0 ? `Équipe à 8h (${equipeIds.size})` : 'Tout à 8h'}
            </button>
            <button type="button" onClick={() => setHeures({})} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Effacer</button>
          </div>

          {/* Grille employés */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {empsList.map(emp => {
              const h = parseFloat(heures[emp.id]) || 0;
              const isOver = h > 10;
              const focus = initialEmployeId != null && String(emp.id) === String(initialEmployeId);
              return (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                  background: isOver ? C.danger + '12' : h > 0 ? C.secondaire + '10' : 'var(--bg-glass)',
                  border: `1px solid ${focus ? C.primaire : isOver ? C.danger + '40' : h > 0 ? C.secondaire + '30' : 'var(--border)'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nom}</div>
                    {emp.poste && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 4, 8, 8.5].map(v => (
                      <button type="button" key={v} onClick={() => setEmp(emp.id, v)}
                        style={{ fontSize: 11, fontWeight: 700, color: h === v ? '#fff' : 'var(--text-muted)', background: h === v ? C.primaire : 'var(--bg-hover)', border: `1px solid ${h === v ? C.primaire : 'var(--border-glass-strong)'}`, borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>{v}h</button>
                    ))}
                  </div>
                  <input aria-label={`Heures ${emp.nom}`} type="number" min="0" max="24" step="0.5" value={heures[emp.id] ?? ''}
                    onChange={e => setEmp(emp.id, e.target.value)}
                    style={{ width: 62, background: 'var(--bg-glass-2)', border: `1px solid ${isOver ? C.danger + '60' : 'var(--border-hover)'}`, borderRadius: 8, color: isOver ? C.danger : 'var(--text-primary)', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, textAlign: 'center', padding: '6px 8px' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>h</span>
                  <span style={{ fontSize: 10, color: C.danger, fontWeight: 700, whiteSpace: 'nowrap', visibility: isOver ? 'visible' : 'hidden' }}>&gt;10h</span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {nbSaisis > 0 ? <span style={{ color: '#10b981', fontWeight: 700 }}>{nbSaisis} employé{nbSaisis > 1 ? 's' : ''} · {totalH}h total</span> : 'Aucune heure saisie'}
            </span>
            <button type="button" onClick={enregistrer} disabled={nbSaisis === 0 || dateInvalide}
              style={{ ...DS.btnSuccess, opacity: (nbSaisis === 0 || dateInvalide) ? 0.45 : 1, cursor: (nbSaisis === 0 || dateInvalide) ? 'not-allowed' : 'pointer' }}>
              Enregistrer les heures
            </button>
          </div>
        </>
      )}

      {!chantier && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          Sélectionnez un chantier pour saisir les heures.
        </div>
      )}
    </div>
  );
}
