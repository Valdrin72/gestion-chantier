import React, { useState, useMemo, useCallback } from 'react';
import { Clock, ChevronDown, CheckCircle, Plus } from 'lucide-react';
import { heuresJour } from '../donnees';
import { DS } from '../ds';

function localISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = localISODate(new Date());

export default function SaisieRapideDashboard({ chantiersActifs, parametres, setChantiers, afficherNotif }) {
  const [ouvert, setOuvert] = useState(false);
  const [chantierId, setChantierId] = useState('');
  const [date, setDate] = useState(TODAY);
  const [heures, setHeures] = useState({});
  const [succes, setSucces] = useState(false);

  const chantier = useMemo(
    () => chantiersActifs.find(c => String(c.id) === chantierId) || null,
    [chantiersActifs, chantierId]
  );

  // Equipe du chantier sélectionné (membres en premier, puis autres)
  const employes = useMemo(() => {
    const tous = (parametres?.employes || []).map(e => ({
      id: e.id,
      nom: `${e.prenom || ''} ${e.nom || ''}`.trim() || `Employé #${e.id}`,
      dansEquipe: (chantier?.equipe || []).some(m => String(m.employeId) === String(e.id)),
    }));
    return [...tous.filter(e => e.dansEquipe), ...tous.filter(e => !e.dansEquipe)];
  }, [chantier, parametres]);

  const handleChantierId = useCallback((id) => {
    setChantierId(id);
    setSucces(false);
    const c = chantiersActifs.find(ch => String(ch.id) === id);
    if (c) setHeures(heuresJour(c.journal || [], date));
    else setHeures({});
  }, [chantiersActifs, date]);

  const handleDate = useCallback((d) => {
    setDate(d);
    setSucces(false);
    if (chantier) setHeures(heuresJour(chantier.journal || [], d));
  }, [chantier]);

  const totalH = Object.values(heures).reduce((s, h) => s + (parseFloat(h) || 0), 0);
  const nbSaisis = Object.values(heures).filter(h => (parseFloat(h) || 0) > 0).length;
  const dateInvalide = date > TODAY || (chantier?.dateDebut && date < chantier.dateDebut);

  const enregistrer = useCallback(() => {
    if (!chantier || nbSaisis === 0 || dateInvalide) return;
    const employsEntries = Object.entries(heures)
      .filter(([, h]) => (parseFloat(h) || 0) > 0)
      .map(([empId, h]) => ({ employeId: parseInt(empId), heuresTravaillees: parseFloat(h) || 0 }));
    const journalFiltre = (chantier.journal || []).filter(e => e.date !== date);
    const newJournal = [...journalFiltre, { date, employes: employsEntries }];
    const updated = { ...chantier, journal: newJournal };
    setChantiers(prev => prev.map(c => String(c.id) === String(chantier.id) ? updated : c));
    if (afficherNotif) afficherNotif(`Heures enregistrées — ${chantier.nom}`);
    setSucces(true);
    setHeures({});
    setTimeout(() => setSucces(false), 3000);
  }, [chantier, nbSaisis, dateInvalide, heures, date, setChantiers, afficherNotif]);

  return (
    <div style={{
      background: 'var(--dash-card)',
      border: '1px solid var(--dash-border)',
      borderRadius: 16,
      boxShadow: 'var(--ds-card-shadow)',
      overflow: 'hidden',
    }}>
      {/* En-tête cliquable */}
      <button
        onClick={() => setOuvert(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'rgba(16,185,129,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={15} style={{ color: '#10b981' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Saisie rapide d'heures
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Enregistrer les heures du jour directement depuis le tableau de bord
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{ color: 'var(--text-muted)', flexShrink: 0, transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {/* Corps (expandable) */}
      {ouvert && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--dash-border)' }}>

          {/* Succès flash */}
          {succes && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>
                Heures enregistrées avec succès.
              </span>
            </div>
          )}

          {/* Ligne chantier + date */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <label style={DS.label}>Chantier</label>
              <select
                value={chantierId}
                onChange={e => handleChantierId(e.target.value)}
                style={{ ...DS.input, width: '100%' }}
              >
                <option value="">— Sélectionner un chantier —</option>
                {chantiersActifs.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.nom || c.numero}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <label style={DS.label}>Date</label>
              <input
                type="date"
                value={date}
                max={TODAY}
                min={chantier?.dateDebut || undefined}
                onChange={e => handleDate(e.target.value)}
                style={{ ...DS.input, borderColor: dateInvalide ? '#ef4444' : undefined }}
              />
            </div>
          </div>

          {/* Grille des employés */}
          {chantier && employes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Heures par employé
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {employes.map(e => (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-glass-2)', border: `1px solid ${e.dansEquipe ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                    borderRadius: 9, padding: '7px 10px',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: e.dansEquipe ? 'rgba(16,185,129,0.15)' : 'var(--bg-glass-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800,
                      color: e.dansEquipe ? '#10b981' : 'var(--text-muted)',
                    }}>
                      {(e.nom || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.nom}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      step="0.5"
                      placeholder="0"
                      value={heures[e.id] ?? ''}
                      onChange={ev => setHeures(prev => ({ ...prev, [e.id]: ev.target.value }))}
                      style={{
                        width: 48, textAlign: 'center', padding: '4px 6px',
                        border: `1px solid ${(parseFloat(heures[e.id]) || 0) > 0 ? '#10b981' : 'var(--border)'}`,
                        borderRadius: 6, background: 'var(--bg-card)',
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: total + bouton */}
          {chantier && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {nbSaisis > 0
                  ? <span style={{ color: '#10b981', fontWeight: 700 }}>{nbSaisis} employé{nbSaisis > 1 ? 's' : ''} · {totalH}h total</span>
                  : 'Aucune heure saisie'
                }
              </div>
              <button
                onClick={enregistrer}
                disabled={nbSaisis === 0 || dateInvalide}
                style={{
                  ...DS.btnSuccess,
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: nbSaisis === 0 || dateInvalide ? 0.45 : 1,
                  cursor: nbSaisis === 0 || dateInvalide ? 'not-allowed' : 'pointer',
                }}
              >
                <Plus size={13} /> Enregistrer les heures
              </button>
            </div>
          )}

          {!chantier && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              Sélectionnez un chantier pour saisir les heures.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
