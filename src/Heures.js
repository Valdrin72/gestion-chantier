import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Clock, Menu } from 'lucide-react';
import { fmtN, getHeuresParEmployeParDate, getIntervallesPeriode } from './donnees';
import { V1, mono, carteV1, heroFond, heroMono } from './design/v1';
import { useApp } from './context/AppContext';
import ModalPointageFormulaire from './components/pointages/ModalPointageFormulaire';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
const PERIODES = [{ id: 'semaine', label: 'Cette semaine' }, { id: 'mois', label: 'Ce mois' }, { id: 'annee', label: 'Cette année' }];

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
  const { periodeGlobale, setPeriodeGlobale = () => {}, ouvrirMenu } = useApp();
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);
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
  // Label semaine en mono (JJ.MM) — contient « Semaine du » pour rester lisible et testable.
  const jjmm = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  const weekLabelMono = `SEMAINE DU ${jjmm(weekStart)} AU ${jjmm(addDays(weekStart, 6))}`;
  const heroChiffres = [
    { label: `HEURES ${periodeLabel}`, value: `${fmtN(Math.round(totalHeures))}h`, couleur: '#8FBCE6', sub: hasSamediHeures ? 'incl. SAM' : null },
    { label: 'MOYENNE / EMPLOYÉ',      value: `${moyenneParEmploye}h`,              couleur: '#4ADE80', sub: null },
    { label: 'HEURES SUPP.',           value: `${Math.round(totalSupp)}h`,          couleur: '#F5B14A', sub: totalSupp > 0 ? `${nbSuppEmployes} employé${nbSuppEmployes > 1 ? 's' : ''}` : null },
    { label: 'NON SAISIES',            value: `${nonSaisis}`,                       couleur: nonSaisis > 0 ? '#FF7A6B' : '#4ADE80', sub: nonSaisis > 0 ? 'relancer' : null },
  ];

  const btnStyle = { background: 'transparent', border: `1px solid ${V1.separation}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: V1.texteMuted, fontFamily: 'inherit', transition: 'all 0.15s' };

  const getCellStyle = (hours, dayIndex) => {
    if (!hours) return { background: 'transparent', color: 'var(--text-muted)' };
    if (dayIndex === 5) return { background: V1.bleuFond, color: V1.bleu }; // Sam
    if (dayIndex === 6) return { background: V1.bleuFond, color: V1.bleu }; // Dim
    if (hours > 8) return { background: '#fef3c7', color: '#92400e' }; // Supp
    return { background: '#e8f0f9', color: '#0d3d6e' }; // Normal
  };

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-heures" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
        {/* Ligne 1 — ☰ · CYNA · HEURES / 06 · sélecteur période + Saisir des heures */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· HEURES / 06 · {periodeLabel}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select value={periodeGlobale} onChange={e => setPeriodeGlobale(e.target.value)} aria-label="Période" style={{ ...heroBtn, padding: '6px 8px' }}>
              {PERIODES.map(p => <option key={p.id} value={p.id} style={{ color: '#16233A' }}>{p.label}</option>)}
            </select>
            <button onClick={() => setPointageModal({})} style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
              <Clock size={14} strokeWidth={2.5} /> Saisir des heures
            </button>
          </div>
        </div>

        {/* Ligne 2 — titre + ligne mono (semaine + collaborateurs) */}
        <div style={heroMono(11, 0.6)}>HEURES / 06</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Heures</h1>
        <div style={heroMono(11, 0.7)}>{weekLabelMono} · {actifs.length} COLLABORATEUR{actifs.length > 1 ? 'S' : ''}</div>

        {/* Ligne 3 — les 4 chiffres clés */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20, paddingBottom: 24 }} data-testid="hero-chiffres">
          {heroChiffres.map(t => (
            <div key={t.label} data-testid={`hero-kpi-${t.label.toLowerCase().replace(/[^a-zà-ÿ]+/g, '-').replace(/^-|-$/g, '')}`}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={heroMono(9, 0.6)}>{t.label}</div>
              <div style={{ ...mono(22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.value}</div>
              {t.sub && <div style={heroMono(9, 0.5)}>{t.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Timesheet table */}
      <div style={carteV1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: V1.bleu, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Saisie hebdomadaire</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={prevWeek} style={btnStyle}>← Sem. préc.</button>
            <button onClick={thisWeek} style={{ ...btnStyle, background: isCurrentWeek ? V1.bleu : 'transparent', color: isCurrentWeek ? '#fff' : V1.texteMuted, border: isCurrentWeek ? `1px solid ${V1.bleu}` : `1px solid ${V1.separation}` }}>Cette semaine</button>
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
                  <th style={{ ...mono(10, V1.texteMuted), textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', borderBottom: `1px solid ${V1.separation}`, background: '#FAFBFC', minWidth: 180 }}>EMPLOYÉ</th>
                  {weekDays.map((d, i) => {
                    const isWe = i >= 5;
                    const isDToday = isoDate(d) === isoDate(today);
                    return (
                      <th key={i} style={{ ...mono(10, isDToday ? V1.bleu : V1.texteMuted, isDToday ? 600 : 500), textAlign: 'center', minWidth: 72, padding: '10px 8px', borderBottom: `1px solid ${V1.separation}`, background: isDToday ? V1.bleuFond : isWe ? '#FAFBFC' : '#FAFBFC' }}>
                        <div>{DAY_LABELS_SHORT[i]} {d.getDate()}</div>
                        <div style={{ fontWeight: 400, fontSize: 9, opacity: 0.7 }}>{jjmm(d)}</div>
                      </th>
                    );
                  })}
                  <th style={{ ...mono(10, V1.texteMuted), textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 8px', borderBottom: `1px solid ${V1.separation}`, background: '#FAFBFC', minWidth: 70 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map(emp => {
                  const empHours = hoursMap[emp.id] || {};
                  const dayHours = weekDays.map(d => empHours[isoDate(d)] || 0);
                  const total = dayHours.reduce((s, h) => s + h, 0);
                  const tdCell = { padding: '12px 8px', borderBottom: `1px solid ${V1.separation}`, verticalAlign: 'middle' };
                  return (
                    <tr key={emp.id}>
                      <td style={{ ...tdCell, padding: '12px 14px' }}>
                        {/* Initiales colorées retirées (décision patron) — nom + métier épurés. */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: V1.texte }}>{emp.nom}</div>
                        <div style={{ ...mono(10, V1.texteMuted), marginTop: 1 }}>{emp.poste}</div>
                      </td>
                      {dayHours.map((h, di) => {
                        const cs = getCellStyle(h, di);
                        const dateCell = isoDate(weekDays[di]);
                        const todayStr = isoDate(today);
                        const isDToday = dateCell === todayStr;
                        // Samedi de la semaine courante = cliquable même si "futur" (ex: saisie vendredi pour samedi)
                        const isSamSemCourante = di === 5 && dateCell >= isoDate(weekStart) && dateCell <= isoDate(addDays(weekStart, 5));
                        const estFutur = dateCell > todayStr && !isSamSemCourante;
                        const isSamFuturAutorise = di === 5 && dateCell > todayStr && isSamSemCourante;
                        return (
                          <td key={di} style={{ ...tdCell, textAlign: 'center', background: isDToday ? V1.bleuFond + '99' : undefined, opacity: estFutur ? 0.35 : 1, cursor: estFutur ? 'default' : 'pointer' }}
                            onClick={() => !estFutur && setPointageModal({ date: dateCell, employeId: String(emp.id) })}
                            title={estFutur ? 'Date future — saisie impossible' : isSamFuturAutorise ? 'Saisir heures du samedi (confirmation requise)' : h > 0 ? `Modifier — ${h}h` : 'Saisir heures'}
                          >
                            {h > 0
                              ? <span style={{ ...cs, ...mono(13, cs.color, 700), borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>{h}h</span>
                              : <span style={{ color: V1.texteMuted, fontSize: 14, opacity: 0.4 }}>{estFutur ? '—' : '+'}</span>
                            }
                          </td>
                        );
                      })}
                      <td style={{ ...tdCell, textAlign: 'center' }}>
                        <span style={{ ...mono(14, total > 0 ? V1.texte : V1.texteMuted, 700) }}>
                          {total > 0 ? `${Math.round(total * 10) / 10}h` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ background: '#FAFBFC' }}>
                  <td style={{ padding: '12px 14px', borderTop: `2px solid ${V1.separation}`, ...mono(11, V1.texte, 700), textTransform: 'uppercase', letterSpacing: '0.06em' }}>TOTAL</td>
                  {weekDays.map((d, di) => {
                    const dayTotal = actifs.reduce((s, e) => s + ((hoursMap[e.id] || {})[isoDate(d)] || 0), 0);
                    return (
                      <td key={di} style={{ padding: '12px 8px', borderTop: `2px solid ${V1.separation}`, textAlign: 'center', ...mono(13, V1.texte, 700) }}>
                        {dayTotal > 0 ? `${Math.round(dayTotal * 10) / 10}h` : '—'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '12px 8px', borderTop: `2px solid ${V1.separation}`, textAlign: 'center', ...mono(14, V1.bleu, 700) }}>
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
