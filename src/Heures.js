import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { DS } from './ds';
import { fmtN } from './donnees';

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

  const KPI_ITEMS = [
    { label: 'HEURES SEMAINE', val: `${fmtN(Math.round(totalHeures))}h`, gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', glow: 'rgba(59,130,246,0.32)' },
    { label: 'MOYENNE / EMPLOYÉ', val: `${moyenneParEmploye}h`, gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: 'rgba(16,185,129,0.32)' },
    { label: 'HEURES SUPP.', val: `${Math.round(totalSupp)}h`, gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', glow: 'rgba(245,158,11,0.32)', badge: totalSupp > 0 ? `${employes.filter(e => { const m = hoursMap[e.id] || {}; return weekDays.slice(0,5).some(d => (m[isoDate(d)] || 0) > 8); }).length} employés` : null },
    { label: 'NON SAISIES', val: `${nonSaisis}`, gradient: nonSaisis > 0 ? 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)' : 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: nonSaisis > 0 ? 'rgba(239,68,68,0.32)' : 'rgba(16,185,129,0.32)', badge: nonSaisis > 0 ? 'Relancer' : null },
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
          <button style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} strokeWidth={2.5} /> Saisir des heures
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {KPI_ITEMS.map(k => (
          <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, position: 'relative' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
            {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
          </div>
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
    </div>
  );
}
