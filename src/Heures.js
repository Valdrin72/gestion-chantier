import React, { useState, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { DS } from './ds';
import { fmtN } from './donnees';
import KpiCard from './components/ui/KpiCard';

const FORM_VIDE = { employeId: '', chantierId: '', date: '', heures: '8' };

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS_SHORT = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export default function Heures({ chantiers = [], parametres = {}, setChantiers }) {
  const employes = parametres.employes || [];
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [modal, setModal] = useState(null);

  const ouvrirModal = () => {
    const dateDefaut = isoDate(today);
    setModal({ form: { ...FORM_VIDE, date: dateDefaut, employeId: employes[0]?.id || '', chantierId: chantiers[0]?.id || '' } });
  };

  const sauvegarder = () => {
    const { employeId, chantierId, date, heures } = modal.form;
    if (!employeId || !chantierId || !date || !heures) return;
    const h = parseFloat(heures);
    if (!h || h <= 0) return;

    setChantiers(prev => prev.map(c => {
      if (String(c.id) !== String(chantierId)) return c;
      const journal = c.journal ? [...c.journal] : [];
      const idx = journal.findIndex(e => e.date === date);
      if (idx >= 0) {
        const entry = { ...journal[idx] };
        const employes2 = entry.employes ? [...entry.employes] : [];
        const ei = employes2.findIndex(e => String(e.employeId) === String(employeId));
        if (ei >= 0) employes2[ei] = { ...employes2[ei], heuresTravaillees: String(employes2[ei].heuresTravaillees * 1 + h) };
        else employes2.push({ employeId, heuresTravaillees: String(h) });
        journal[idx] = { ...entry, employes: employes2 };
      } else {
        journal.push({ date, employes: [{ employeId, heuresTravaillees: String(h) }] });
      }
      return { ...c, journal };
    }));
    setModal(null);
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Build hours map: { empId: { isoDate: hours } }
  const hoursMap = useMemo(() => {
    const map = {};
    employes.forEach(e => { map[e.id] = {}; });

    chantiers.forEach(c => {
      (c.journal || []).forEach(entry => {
        if (!entry.date) return;
        (entry.employes || []).forEach(ej => {
          const empId = ej.employeId;
          if (!map[empId]) map[empId] = {};
          if (!map[empId][entry.date]) map[empId][entry.date] = 0;
          map[empId][entry.date] += parseFloat(ej.heuresTravaillees) || 0;
        });
      });
    });

    return map;
  }, [chantiers, employes]);

  // KPI computations
  const { totalHeures, totalSupp, nonSaisis } = useMemo(() => {
    const weekDayIsos = weekDays.slice(0, 5).map(isoDate);
    let total = 0, supp = 0, nsSaisis = 0;

    employes.filter(e => e.actif !== false).forEach(e => {
      const empHours = hoursMap[e.id] || {};
      let empWeekTotal = 0;
      weekDayIsos.forEach(d => {
        const h = empHours[d] || 0;
        total += h;
        empWeekTotal += h;
        if (h > 8) supp += (h - 8);
      });
      const hasSaisie = weekDayIsos.some(d => (empHours[d] || 0) > 0);
      if (!hasSaisie) nsSaisis++;
    });

    return { totalHeures: total, totalSupp: supp, nonSaisis: nsSaisis };
  }, [employes, hoursMap, weekDays]);

  const actifs = employes.filter(e => e.actif !== false);
  const moyenneParEmploye = actifs.length > 0 ? Math.round(totalHeures / actifs.length * 10) / 10 : 0;

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const thisWeek = () => setWeekStart(getWeekStart(today));

  const isCurrentWeek = isoDate(weekStart) === isoDate(getWeekStart(today));

  const weekLabel = `Semaine du ${weekStart.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} au ${addDays(weekStart, 6).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const nbSuppEmployes = employes.filter(e => {
    const m = hoursMap[e.id] || {};
    return weekDays.slice(0, 5).some(d => (m[isoDate(d)] || 0) > 8);
  }).length;

  const KPI_ITEMS = [
    { label: 'HEURES SEMAINE',  value: `${fmtN(Math.round(totalHeures))}h`,  ...DS.kpi.blue },
    { label: 'MOYENNE / EMPLOYÉ', value: `${moyenneParEmploye}h`,            ...DS.kpi.green },
    { label: 'HEURES SUPP.',    value: `${Math.round(totalSupp)}h`,           ...DS.kpi.amber, badge: totalSupp > 0 ? `${nbSuppEmployes} employé${nbSuppEmployes > 1 ? 's' : ''}` : null },
    { label: 'NON SAISIES',     value: `${nonSaisis}`,                        ...(nonSaisis > 0 ? DS.kpi.red : DS.kpi.green), badge: nonSaisis > 0 ? 'Relancer' : null },
  ];

  const btnStyle = { background: 'var(--ds-btn-ghost-bg)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.15s' };

  const getCellStyle = (hours, dayIndex) => {
    if (!hours) return { background: 'transparent', color: 'var(--text-muted)' };
    if (dayIndex === 5) return { background: '#ede9fe', color: '#4c1d95' }; // Sam
    if (dayIndex === 6) return { background: '#ede9fe', color: '#4c1d95' }; // Dim
    if (hours > 8) return { background: '#fef3c7', color: '#92400e' }; // Supp
    return { background: '#dbeafe', color: '#1e40af' }; // Normal
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Heures</div>
          <div className="page-title-sub">{weekLabel}</div>
        </div>
        <div className="page-actions-group">
          <button onClick={ouvrirModal} style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} strokeWidth={2.5} /> Saisir des heures
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {KPI_ITEMS.map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} gradient={k.gradient} glow={k.glow} badge={k.badge} />
        ))}
      </div>

      {/* Timesheet table */}
      <div style={DS.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Saisie hebdomadaire</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={prevWeek} style={btnStyle}>← Sem. préc.</button>
            <button onClick={thisWeek} style={{ ...btnStyle, background: isCurrentWeek ? 'rgba(59,130,246,0.1)' : undefined, color: isCurrentWeek ? '#3b82f6' : undefined }}>Cette semaine</button>
            <button onClick={nextWeek} style={btnStyle}>Sem. suiv. →</button>
          </div>
        </div>

        {employes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <Clock size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun employé configuré</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Ajoutez des employés dans les Paramètres</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...DS.th, textAlign: 'left', minWidth: 180 }}>EMPLOYÉ</th>
                  {weekDays.map((d, i) => {
                    const isWe = i >= 5;
                    const isDToday = isoDate(d) === isoDate(today);
                    return (
                      <th key={i} style={{ ...DS.th, textAlign: 'center', minWidth: 72, background: isDToday ? 'rgba(59,130,246,0.08)' : isWe ? 'var(--bg-glass)' : 'var(--ds-th-bg)', color: isDToday ? '#3b82f6' : isWe ? 'var(--text-muted)' : 'var(--text-muted)' }}>
                        <div>{DAY_LABELS_SHORT[i]}</div>
                        <div style={{ fontWeight: 400, fontSize: 10 }}>{d.getDate()}/{d.getMonth() + 1}</div>
                      </th>
                    );
                  })}
                  <th style={{ ...DS.th, textAlign: 'center', minWidth: 70 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map(emp => {
                  const empHours = hoursMap[emp.id] || {};
                  const dayHours = weekDays.map(d => empHours[isoDate(d)] || 0);
                  const total = dayHours.reduce((s, h) => s + h, 0);
                  return (
                    <tr key={emp.id}>
                      <td style={{ ...DS.td, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {emp.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>
                          </div>
                        </div>
                      </td>
                      {dayHours.map((h, di) => {
                        const cs = getCellStyle(h, di);
                        return (
                          <td key={di} style={{ ...DS.td, textAlign: 'center' }}>
                            {h > 0 ? (
                              <span style={{ ...cs, borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 700, display: 'inline-block' }}>{h}h</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ ...DS.td, textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: total > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {total > 0 ? `${Math.round(total * 10) / 10}h` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ background: 'var(--bg-glass)' }}>
                  <td style={{ ...DS.td, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>TOTAL</td>
                  {weekDays.map((d, di) => {
                    const dayTotal = actifs.reduce((s, e) => s + ((hoursMap[e.id] || {})[isoDate(d)] || 0), 0);
                    return (
                      <td key={di} style={{ ...DS.td, textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {dayTotal > 0 ? `${Math.round(dayTotal * 10) / 10}h` : '—'}
                      </td>
                    );
                  })}
                  <td style={{ ...DS.td, textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#3b82f6' }}>
                    {Math.round(totalHeures * 10) / 10}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal saisie heures */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setModal(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ds-card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Saisir des heures</div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={DS.label}>Employé</label>
              <select value={modal.form.employeId} onChange={e => setModal({ ...modal, form: { ...modal.form, employeId: e.target.value } })} style={DS.input}>
                <option value="">— Sélectionner —</option>
                {employes.filter(e => e.actif !== false).map(e => (
                  <option key={e.id} value={e.id}>{e.nom}{e.poste ? ` · ${e.poste}` : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={DS.label}>Chantier</label>
              <select value={modal.form.chantierId} onChange={e => setModal({ ...modal, form: { ...modal.form, chantierId: e.target.value } })} style={DS.input}>
                <option value="">— Sélectionner —</option>
                {chantiers.filter(c => !['Terminé','Clôturé','Facturé'].includes(c.statut)).map(c => (
                  <option key={c.id} value={c.id}>{c.nom || c.numero}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={DS.label}>Date</label>
                <input type="date" value={modal.form.date} onChange={e => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })} style={DS.input} />
              </div>
              <div>
                <label style={DS.label}>Heures travaillées</label>
                <input type="number" min="0.5" max="24" step="0.5" value={modal.form.heures} onChange={e => setModal({ ...modal, form: { ...modal.form, heures: e.target.value } })} style={DS.input} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={DS.btnGhost}>Annuler</button>
              <button
                onClick={sauvegarder}
                disabled={!modal.form.employeId || !modal.form.chantierId || !modal.form.date || !modal.form.heures}
                style={{ ...DS.btnPrimary, opacity: (!modal.form.employeId || !modal.form.chantierId || !modal.form.date || !modal.form.heures) ? 0.5 : 1 }}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
