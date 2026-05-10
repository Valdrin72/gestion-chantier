import React, { useState, useMemo } from 'react';
import { Clock, X, Trash2, AlertTriangle } from 'lucide-react';
import { DS } from './ds';
import { fmtN, getHeuresParEmployeParDate } from './donnees';
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
  const employes = useMemo(() => parametres.employes || [], [parametres.employes]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [modal, setModal] = useState(null);
  const [samediConfirme, setSamediConfirme] = useState(false);

  const ouvrirModal = (prefill = {}) => {
    setSamediConfirme(false);
    const dateDefaut = prefill.date || isoDate(today);
    const employeId = prefill.employeId || employes[0]?.id || '';
    // Retrouver le chantier et les heures existantes pour ce jour/employé
    let chantierId = prefill.chantierId || chantiers[0]?.id || '';
    let heuresExistantes = '';
    if (prefill.date && employeId) {
      for (const c of chantiers) {
        const entry = (c.journal || []).find(e => e.date === prefill.date);
        if (entry) {
          const emp = (entry.employes || []).find(e => String(e.employeId) === String(employeId));
          if (emp) { chantierId = c.id; heuresExistantes = String(emp.heuresTravaillees); break; }
        }
      }
    }
    setModal({ form: { ...FORM_VIDE, date: dateDefaut, employeId, chantierId, heures: heuresExistantes || '8' }, existant: !!heuresExistantes });
  };

  const sauvegarder = () => {
    const { employeId, chantierId, date, heures } = modal.form;
    if (!employeId || !chantierId || !date || !heures) return;
    const h = parseFloat(heures);
    if (!h || h <= 0) return;
    // Allow Saturday of current or past weeks; only block truly future dates (> samedi courant)
    const todayStr = new Date().toISOString().split('T')[0];
    const samSemaineCourante = isoDate(addDays(getWeekStart(new Date()), 5));
    if (date > todayStr && date > samSemaineCourante) return;
    // Saturday confirmation required if chantier doesn't have inclusSamedi enabled
    const isSam = new Date(date + 'T00:00:00').getDay() === 6;
    const chantierCible = chantiers.find(c => String(c.id) === String(chantierId));
    if (isSam && chantierCible && !chantierCible.inclusSamedi && !samediConfirme) return;

    setChantiers(prev => prev.map(c => {
      if (String(c.id) !== String(chantierId)) return c;
      const journal = c.journal ? [...c.journal] : [];
      const idx = journal.findIndex(e => e.date === date);
      if (idx >= 0) {
        const entry = { ...journal[idx] };
        const employes2 = entry.employes ? [...entry.employes] : [];
        const ei = employes2.findIndex(e => String(e.employeId) === String(employeId));
        if (ei >= 0) employes2[ei] = { ...employes2[ei], heuresTravaillees: String(h) };
        else employes2.push({ employeId, heuresTravaillees: String(h) });
        journal[idx] = { ...entry, employes: employes2 };
      } else {
        journal.push({ date, employes: [{ employeId, heuresTravaillees: String(h) }] });
      }
      return { ...c, journal };
    }));
    setModal(null);
  };

  const supprimerHeures = (employeId, date) => {
    if (!window.confirm(`Supprimer les heures du ${new Date(date + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} pour cet employé ?`)) return;
    setChantiers(prev => prev.map(c => {
      const entry = (c.journal || []).find(e => e.date === date);
      if (!entry) return c;
      const employes2 = (entry.employes || []).filter(e => String(e.employeId) !== String(employeId));
      if (employes2.length === entry.employes?.length) return c; // cet employé n'était pas là
      const newJournal = employes2.length > 0
        ? c.journal.map(e => e.date === date ? { ...e, employes: employes2 } : e)
        : c.journal.filter(e => e.date !== date);
      return { ...c, journal: newJournal };
    }));
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Build hours map: { empId: { isoDate: hours } } — logique centralisée dans donnees.js
  const hoursMap = useMemo(() => getHeuresParEmployeParDate(chantiers, employes), [chantiers, employes]);

  // KPI computations — inclut samedi (index 5) s'il y a des heures saisies ce jour
  const { totalHeures, totalSupp, nonSaisis, hasSamediHeures } = useMemo(() => {
    const weekDayIsos = weekDays.slice(0, 6).map(isoDate); // Lun–Sam
    let total = 0, supp = 0, nsSaisis = 0, samH = false;

    employes.filter(e => e.actif !== false).forEach(e => {
      const empHours = hoursMap[e.id] || {};
      weekDayIsos.forEach((d, i) => {
        const h = empHours[d] || 0;
        total += h;
        if (h > 8) supp += (h - 8);
        if (i === 5 && h > 0) samH = true;
      });
      // non saisis = aucune heure Lun–Ven (samedi = optionnel)
      const hasSaisie = weekDayIsos.slice(0, 5).some(d => (empHours[d] || 0) > 0);
      if (!hasSaisie) nsSaisis++;
    });

    return { totalHeures: total, totalSupp: supp, nonSaisis: nsSaisis, hasSamediHeures: samH };
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
    return weekDays.slice(0, 6).some(d => (m[isoDate(d)] || 0) > 8);
  }).length;

  const KPI_ITEMS = [
    { label: 'HEURES SEMAINE',  value: `${fmtN(Math.round(totalHeures))}h`,  ...DS.kpi.blue, badge: hasSamediHeures ? 'Incl. SAM' : null },
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
                            onClick={() => !estFutur && ouvrirModal({ date: dateCell, employeId: emp.id })}
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
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {(() => {
                  const { employeId, date } = modal.form;
                  if (!employeId || !date) return 'Saisir des heures';
                  const existant = chantiers.some(c => (c.journal || []).some(e => e.date === date && (e.employes || []).some(em => String(em.employeId) === String(employeId) && (parseFloat(em.heuresTravaillees) || 0) > 0)));
                  return existant ? 'Modifier les heures' : 'Saisir des heures';
                })()}
              </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={DS.label}>Date</label>
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const samSemaine = isoDate(addDays(getWeekStart(new Date()), 5));
                  const maxDate = samSemaine > todayStr ? samSemaine : todayStr;
                  const futur = modal.form.date && modal.form.date > maxDate;
                  return (
                    <input type="date" value={modal.form.date} max={maxDate}
                      onChange={e => { setSamediConfirme(false); setModal({ ...modal, form: { ...modal.form, date: e.target.value } }); }}
                      style={{ ...DS.input, borderColor: futur ? '#ef4444' : undefined }} />
                  );
                })()}
              </div>
              <div>
                <label style={DS.label}>Heures travaillées</label>
                <input type="number" min="0.5" max="24" step="0.5" value={modal.form.heures} onChange={e => setModal({ ...modal, form: { ...modal.form, heures: e.target.value } })} style={DS.input} />
              </div>
            </div>

            {/* Alerte date vraiment future (au-delà du samedi courant) */}
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const samSemaine = isoDate(addDays(getWeekStart(new Date()), 5));
              const vraimantFutur = modal.form.date && modal.form.date > todayStr && modal.form.date > samSemaine;
              if (!vraimantFutur) return null;
              return (
                <div style={{ display: 'flex', gap: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 13 }}>Date dans le futur</div>
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Vous ne pouvez pas saisir des heures pour une date future.</div>
                  </div>
                </div>
              );
            })()}

            {/* Confirmation travail samedi */}
            {(() => {
              if (!modal.form.date) return null;
              const isSam = new Date(modal.form.date + 'T00:00:00').getDay() === 6;
              if (!isSam) return null;
              const chantierCible = chantiers.find(c => String(c.id) === String(modal.form.chantierId));
              return (
                <div style={{ display: 'flex', gap: 10, background: chantierCible?.inclusSamedi ? '#f0fdf4' : '#fffbeb', border: `1px solid ${chantierCible?.inclusSamedi ? '#86efac' : '#fcd34d'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <AlertTriangle size={18} style={{ color: chantierCible?.inclusSamedi ? '#16a34a' : '#d97706', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: chantierCible?.inclusSamedi ? '#15803d' : '#92400e', fontSize: 13 }}>
                      {chantierCible?.inclusSamedi ? 'Samedi autorisé sur ce chantier' : 'Travail le samedi — confirmation requise'}
                    </div>
                    <div style={{ fontSize: 12, color: chantierCible?.inclusSamedi ? '#166534' : '#78350f', marginTop: 3 }}>
                      {chantierCible?.inclusSamedi
                        ? 'Ce chantier inclut le samedi dans sa durée planifiée.'
                        : 'Selon la CCT Romande, les heures du samedi peuvent être majorées (+25%). Ce jour sera compté comme jour travaillé.'}
                    </div>
                    {!chantierCible?.inclusSamedi && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                        <input type="checkbox" checked={samediConfirme} onChange={e => setSamediConfirme(e.target.checked)} style={{ width: 14, height: 14 }} />
                        Je confirme que l'équipe a travaillé ce samedi
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Bouton supprimer — visible seulement si des heures existent pour cet employé/jour */}
              {modal.existant && (
                <button
                  onClick={() => {
                    if (!window.confirm(`Supprimer les heures du ${new Date(modal.form.date + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} ?`)) return;
                    supprimerHeures(modal.form.employeId, modal.form.date);
                    setModal(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                ><Trash2 size={14} /> Supprimer</button>
              )}
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <button onClick={() => setModal(null)} style={DS.btnGhost}>Annuler</button>
              {(() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const samSemaine = isoDate(addDays(getWeekStart(new Date()), 5));
                const futur = modal.form.date && modal.form.date > todayStr && modal.form.date > samSemaine;
                const manque = !modal.form.employeId || !modal.form.chantierId || !modal.form.date || !modal.form.heures;
                const isSam = modal.form.date ? new Date(modal.form.date + 'T00:00:00').getDay() === 6 : false;
                const chantierCible = chantiers.find(c => String(c.id) === String(modal.form.chantierId));
                const needsSamConf = isSam && chantierCible && !chantierCible.inclusSamedi && !samediConfirme;
                const bloque = futur || manque || needsSamConf;
                return (
                  <button onClick={sauvegarder} disabled={bloque}
                    style={{ ...DS.btnPrimary, opacity: bloque ? 0.4 : 1 }}>
                    {futur ? 'Date invalide' : needsSamConf ? 'Confirmer le samedi' : 'Enregistrer'}
                  </button>
                );
              })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
