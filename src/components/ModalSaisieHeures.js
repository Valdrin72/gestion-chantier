import React, { useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { C, heuresJour } from '../donnees';
import { DS } from '../ds';

const inputStyle = DS.input;
const labelStyle = DS.label;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function ModalSaisieHeures({ chantierSaisie, initialDate, onFermer, onSave, parametres }) {
  const [date, setDate] = useState(initialDate);
  const [heures, setHeures] = useState(() => heuresJour(chantierSaisie.journal || [], initialDate));

  // Source : TOUS les employés actifs — pas seulement ceux en équipe du chantier
  const equipeIds = useMemo(() => new Set((chantierSaisie.equipe || []).map(m => parseInt(m.employeId))), [chantierSaisie.equipe]);
  const empsList = useMemo(() => {
    const tous = (parametres.employes || []).map(e => ({
      id: e.id,
      nom: `${e.prenom || ''} ${e.nom || ''}`.trim() || `Employé #${e.id}`,
      poste: e.poste || '',
      dansEquipe: equipeIds.has(e.id),
    }));
    // Equipe du chantier en premier, puis les autres
    return [...tous.filter(e => e.dansEquipe), ...tous.filter(e => !e.dansEquipe)];
  }, [parametres.employes, equipeIds]);

  const hierDate = useMemo(() => {
    const d = new Date(date); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [date]);
  const hierHeures = useMemo(() => heuresJour(chantierSaisie.journal || [], hierDate), [chantierSaisie.journal, hierDate]);

  const totalH = Object.values(heures).reduce((s, h) => s + (parseFloat(h) || 0), 0);
  const nbSaisis = Object.values(heures).filter(h => (parseFloat(h) || 0) > 0).length;

  // Validation date : bloquer si avant le début du chantier ou dans le futur
  const dateDebut = chantierSaisie.dateDebut || null;
  const today = new Date().toISOString().split('T')[0];
  const avantDebut = dateDebut && date < dateDebut;
  const dansLeFutur = date > today;
  const dateInvalide = avantDebut || dansLeFutur;

  const valider = useCallback(() => {
    if (dateInvalide) return;
    if (nbSaisis === 0) { alert('Aucune heure saisie.'); return; }
    const overLimit = Object.entries(heures).some(([, h]) => (parseFloat(h) || 0) > 10);
    if (overLimit && !window.confirm('Certains employés dépassent 10h. Confirmer ?')) return;
    const employes = Object.entries(heures)
      .filter(([, h]) => (parseFloat(h) || 0) > 0)
      .map(([empId, h]) => ({ employeId: parseInt(empId), heuresTravaillees: parseFloat(h) || 0 }));
    const journalFiltre = (chantierSaisie.journal || []).filter(e => e.date !== date);
    const newJournal = [...journalFiltre, { date, employes }];
    onSave({ ...chantierSaisie, journal: newJournal });
  }, [dateInvalide, nbSaisis, heures, chantierSaisie, date, onSave]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20, padding: '28px 32px',
        width: '100%', maxWidth: 600,
        border: '1px solid var(--border-hover)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>Saisie des heures</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{chantierSaisie.nom}</div>
          </div>
          <button onClick={onFermer} style={{ ...btnDanger, padding: '8px 12px' }}><X size={16} /></button>
        </div>

        {/* Info équipe */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '8px 14px', background: 'var(--bg-glass-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {equipeIds.size > 0
              ? `${equipeIds.size} dans l'équipe · ${empsList.length - equipeIds.size} autres disponibles`
              : `${empsList.length} employés disponibles`}
          </span>
        </div>

        {/* Date picker */}
        <div style={{ marginBottom: dateInvalide ? 12 : 20 }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={date}
            min={dateDebut || undefined}
            max={today}
            onChange={e => {
              const d = e.target.value;
              setDate(d);
              setHeures(heuresJour(chantierSaisie.journal || [], d));
            }}
            style={{ ...inputStyle, maxWidth: 200, borderColor: dateInvalide ? '#ef4444' : undefined }}
          />
        </div>

        {/* Blocage : date invalide */}
        {dateInvalide && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🚫</span>
            <div>
              {dansLeFutur ? (
                <>
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Date dans le futur</div>
                  <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 3 }}>
                    Vous ne pouvez pas saisir des heures pour une date future. Aujourd'hui : <strong>{new Date(today + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Chantier pas encore démarré</div>
                  <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 3 }}>
                    Ce chantier débute le <strong>{new Date(dateDebut + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bulk actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (Object.keys(hierHeures).length === 0) { alert('Aucune saisie trouvée pour la veille.'); return; }
              setHeures({ ...hierHeures });
            }}
            style={{ fontSize: 12, fontWeight: 700, color: C.info, background: C.info + '15', border: `1px solid ${C.info}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >Remplir comme hier</button>
          <button
            onClick={() => {
              const h = {};
              // Si équipe définie → 8h pour l'équipe seulement, sinon tous
              const cibles = equipeIds.size > 0 ? empsList.filter(e => e.dansEquipe) : empsList;
              cibles.forEach(e => { h[e.id] = 8; });
              setHeures(h);
            }}
            style={{ fontSize: 12, fontWeight: 700, color: C.primaire, background: C.primaire + '15', border: `1px solid ${C.primaire}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >{equipeIds.size > 0 ? `Équipe à 8h (${equipeIds.size})` : 'Tout à 8h'}</button>
          <button
            onClick={() => setHeures({})}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >Effacer</button>
        </div>

        {/* Employee list — clés stables, pas de nœud conditionnel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {empsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun employé configuré. Ajoutez vos employés dans Paramètres.
            </div>
          )}
          {empsList.map((emp, idx) => {
            const h = parseFloat(heures[emp.id]) || 0;
            const isActive = h > 0;
            const isOver = h > 10;
            const showSep = idx > 0 && !emp.dansEquipe && empsList[idx - 1].dansEquipe && equipeIds.size > 0;
            return (
              <React.Fragment key={emp.id}>
                {showSep && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Autres employés</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: isOver ? C.danger + '12' : isActive ? C.secondaire + '10' : 'var(--bg-glass)',
                border: `1px solid ${isOver ? C.danger + '40' : isActive ? C.secondaire + '30' : 'var(--border)'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>
                </div>
                {/* Quick fill buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 4, 8, 8.5].map(v => (
                    <button key={v}
                      onClick={() => setHeures(prev => ({ ...prev, [emp.id]: v }))}
                      style={{
                        fontSize: 11, fontWeight: 700,
                        color: h === v ? '#ffffff' : 'var(--text-muted)',
                        background: h === v ? C.primaire : 'var(--bg-hover)',
                        border: `1px solid ${h === v ? C.primaire : 'var(--border-glass-strong)'}`,
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{v}h</button>
                  ))}
                </div>
                {/* Number input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    value={h}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setHeures(prev => ({ ...prev, [emp.id]: val }));
                    }}
                    style={{
                      width: 62, background: 'var(--bg-glass-2)',
                      border: `1px solid ${isOver ? C.danger + '60' : 'var(--border-hover)'}`,
                      borderRadius: 8, color: isOver ? C.danger : 'var(--text-primary)',
                      fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                      textAlign: 'center', padding: '6px 8px',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>h</span>
                </div>
                {/* Span toujours présent — visibility au lieu de montage/démontage conditionnel */}
                <span style={{ fontSize: 10, color: C.danger, fontWeight: 700, whiteSpace: 'nowrap', visibility: isOver ? 'visible' : 'hidden' }}>&gt;10h</span>
              </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <button
          onClick={valider}
          disabled={dateInvalide || nbSaisis === 0}
          style={{ ...btnSucces, width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, fontWeight: 800, opacity: (dateInvalide || nbSaisis === 0) ? 0.4 : 1 }}
        >
          {dansLeFutur ? 'Date dans le futur — impossible' : avantDebut ? `Chantier démarre le ${new Date(dateDebut + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}` : `Valider — ${nbSaisis} employé${nbSaisis !== 1 ? 's' : ''} · ${totalH}h`}
        </button>
      </div>
    </div>
  );
}

export default ModalSaisieHeures;
