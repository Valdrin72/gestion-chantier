import React, { useState, useMemo, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { DS } from './ds';
import { fmtN, getHeuresParEmployeParDate, getIntervallesPeriode } from './donnees';
import KpiCard from './components/ui/KpiCard';
import { useApp } from './context/AppContext';
import ModalPointageFormulaire from './components/pointages/ModalPointageFormulaire';

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
  // Utilise les composantes locales (pas UTC) pour éviter le décalage UTC+2 (Genève)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_LABELS_SHORT = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export default function Heures({ chantiers = [], parametres = {}, setChantiers }) {
  const employes = useMemo(() => parametres.employes || [], [parametres.employes]); // eslint-disable-line react-hooks/exhaustive-deps
  const { periodeGlobale } = useApp();
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  // Sync to current week when global period changes to 'semaine'
  useEffect(() => {
    if (periodeGlobale === 'semaine') setWeekStart(getWeekStart(new Date()));
  }, [periodeGlobale]);
  const [pointageModal, setPointageModal] = useState(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Build hours map: { empId: { isoDate: hours } } — logique centralisée dans donnees.js
  const hoursMap = useMemo(() => getHeuresParEmployeParDate(chantiers, employes), [chantiers, employes]);

  // KPI computations — semaine: current grid; mois/annee: aggregate over the period
  const { totalHeures, totalSupp, nonSaisis, hasSamediHeures } = useMemo(() => {
    const actifs = employes.filter(e => e.actif !== false);
    let total = 0, supp = 0, nsSaisis = 0, samH = false;

    if (periodeGlobale === 'semaine') {
      // Inclure les 7 jours (lun–dim) pour cohérence avec la colonne TOTAL et le TOTAL row du tableau
      // Le dimanche est possible en heures supplémentaires (CCT ×1.50)
      const weekDayIsos = weekDays.map(isoDate);
      actifs.forEach(e => {
        const empHours = hoursMap[e.id] || {};
        weekDayIsos.forEach((d, i) => {
          const h = empHours[d] || 0;
          total += h;
          if (h > 8) supp += (h - 8);
          if (i === 5 && h > 0) samH = true; // index 5 = SAM
        });
        // "Non saisies" = aucune heure lun–ven (jours standard)
        const hasSaisie = weekDayIsos.slice(0, 5).some(d => (empHours[d] || 0) > 0);
        if (!hasSaisie) nsSaisis++;
      });
    } else {
      const { debut, fin } = getIntervallesPeriode(periodeGlobale);
      const debutStr = isoDate(debut);
      const finStr = isoDate(fin);
      actifs.forEach(e => {
        const empHours = hoursMap[e.id] || {};
        let hasSaisie = false;
        Object.entries(empHours).forEach(([d, h]) => {
          if (d < debutStr || d > finStr) return;
          total += h;
          if (h > 8) supp += (h - 8);
          if (new Date(d + 'T00:00:00').getDay() === 6 && h > 0) samH = true;
          if (new Date(d + 'T00:00:00').getDay() !== 0 && new Date(d + 'T00:00:00').getDay() !== 6) hasSaisie = true;
        });
        if (!hasSaisie) nsSaisis++;
      });
    }

    return { totalHeures: total, totalSupp: supp, nonSaisis: nsSaisis, hasSamediHeures: samH };
  }, [employes, hoursMap, weekDays, periodeGlobale]);

  const actifs = employes.filter(e => e.actif !== false);
  const moyenneParEmploye = actifs.length > 0 ? Math.round(totalHeures / actifs.length * 10) / 10 : 0;

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const thisWeek = () => setWeekStart(getWeekStart(today));

  const isCurrentWeek = isoDate(weekStart) === isoDate(getWeekStart(today));

  const weekLabel = `Semaine du ${weekStart.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} au ${addDays(weekStart, 6).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const nbSuppEmployes = useMemo(() => {
    if (periodeGlobale === 'semaine') {
      return employes.filter(e => {
        const m = hoursMap[e.id] || {};
        return weekDays.some(d => (m[isoDate(d)] || 0) > 8); // 7 jours pour cohérence avec KPI
      }).length;
    }
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    const debutStr = isoDate(debut);
    const finStr = isoDate(fin);
    return employes.filter(e => {
      const m = hoursMap[e.id] || {};
      return Object.entries(m).some(([d, h]) => d >= debutStr && d <= finStr && h > 8);
    }).length;
  }, [employes, hoursMap, weekDays, periodeGlobale]);

  const periodeLabel = periodeGlobale === 'semaine' ? 'SEMAINE' : periodeGlobale === 'mois' ? 'MOIS' : 'ANNÉE';
  const KPI_ITEMS = [
    { label: `HEURES ${periodeLabel}`, value: `${fmtN(Math.round(totalHeures))}h`, ...DS.kpi.blue, badge: hasSamediHeures ? 'Incl. SAM' : null },
    { label: 'MOYENNE / EMPLOYÉ',      value: `${moyenneParEmploye}h`,              ...DS.kpi.green },
    { label: 'HEURES SUPP.',           value: `${Math.round(totalSupp)}h`,          ...DS.kpi.amber, badge: totalSupp > 0 ? `${nbSuppEmployes} employé${nbSuppEmployes > 1 ? 's' : ''}` : null },
    { label: 'NON SAISIES',            value: `${nonSaisis}`,                       ...(nonSaisis > 0 ? DS.kpi.red : DS.kpi.green), badge: nonSaisis > 0 ? 'Relancer' : null },
  ];

  const btnStyle = { background: 'var(--ds-btn-ghost-bg)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.15s' };

  const getCellStyle = (hours, dayIndex) => {
    if (!hours) return { background: 'transparent', color: 'var(--text-muted)' };
    if (dayIndex === 5) return { background: '#ede9fe', color: '#4c1d95' }; // Sam
    if (dayIndex === 6) return { background: '#ede9fe', color: '#4c1d95' }; // Dim
    if (hours > 8) return { background: '#fef3c7', color: '#92400e' }; // Supp
    return { background: '#e8f0f9', color: '#0d3d6e' }; // Normal
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
          <button onClick={() => setPointageModal({})} style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} strokeWidth={2.5} /> Saisir des heures
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 24 }}>
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
            <button onClick={thisWeek} style={{ ...btnStyle, background: isCurrentWeek ? 'rgba(13,61,110,0.1)' : undefined, color: isCurrentWeek ? '#0d3d6e' : undefined }}>Cette semaine</button>
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
                      <th key={i} style={{ ...DS.th, textAlign: 'center', minWidth: 72, background: isDToday ? 'rgba(13,61,110,0.08)' : isWe ? 'var(--bg-glass)' : 'var(--ds-th-bg)', color: isDToday ? '#0d3d6e' : isWe ? 'var(--text-muted)' : 'var(--text-muted)' }}>
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
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0d3d6e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {((emp.nom || 'NN').trim().split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2) || 'NN').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>
                          </div>
                        </div>
                      </td>
                      {dayHours.map((h, di) => {
                        const cs = getCellStyle(h, di);
                        const dateCell = isoDate(weekDays[di]);
                        const todayStr = isoDate(today);
                        // Samedi de la semaine courante = cliquable même si "futur" (ex: saisie vendredi pour samedi)
                        const isSamSemCourante = di === 5 && dateCell >= isoDate(weekStart) && dateCell <= isoDate(addDays(weekStart, 5));
                        const estFutur = dateCell > todayStr && !isSamSemCourante;
                        const isSamFuturAutorise = di === 5 && dateCell > todayStr && isSamSemCourante;
                        return (
                          <td key={di} style={{ ...DS.td, textAlign: 'center', opacity: estFutur ? 0.35 : 1, cursor: estFutur ? 'default' : 'pointer' }}
                            onClick={() => !estFutur && setPointageModal({ date: dateCell, employeId: String(emp.id) })}
                            title={estFutur ? 'Date future — saisie impossible' : isSamFuturAutorise ? 'Saisir heures du samedi (confirmation requise)' : h > 0 ? `Modifier — ${h}h` : 'Saisir heures'}
                          >
                            {h > 0
                              ? <span style={{ ...cs, borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 700, display: 'inline-block' }}>{h}h</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 13, opacity: 0.4 }}>{estFutur ? '—' : '+'}</span>
                            }
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
                  <td style={{ ...DS.td, textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#0d3d6e' }}>
                    {(() => {
                      const weekTotal = actifs.reduce((t, e) => t + weekDays.reduce((ws, d) => ws + ((hoursMap[e.id] || {})[isoDate(d)] || 0), 0), 0);
                      return weekTotal > 0 ? `${Math.round(weekTotal * 10) / 10}h` : '—';
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pointageModal && (
        <ModalPointageFormulaire
          initialDate={pointageModal.date}
          initialEmployeId={pointageModal.employeId}
          onClose={() => setPointageModal(null)}
        />
      )}
    </div>
  );
}
