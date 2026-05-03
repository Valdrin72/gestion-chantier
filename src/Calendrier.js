import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar } from 'lucide-react';
import { DS } from './ds';

export default function Calendrier({ chantiers = [], clients = [], devis = [], factures = [] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = viewDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  const prevMonthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-CH', { month: 'short' });
  const nextMonthLabel = new Date(year, month + 1, 1).toLocaleDateString('fr-CH', { month: 'short' });

  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Gather events for this month
  const eventsByDay = useMemo(() => {
    const map = {};
    const add = (day, evt) => { if (!map[day]) map[day] = []; map[day].push(evt); };

    chantiers.forEach(c => {
      if (c.dateDebut) {
        const d = new Date(c.dateDebut);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: c.nom || c.numero, color: '#dbeafe', textColor: '#1e40af' });
      }
      if (c.dateFin) {
        const d = new Date(c.dateFin);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: `Fin: ${c.nom || c.numero}`, color: '#d1fae5', textColor: '#065f46' });
      }
    });

    factures.forEach(f => {
      if (f.dateEcheance) {
        const d = new Date(f.dateEcheance);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: `Éch. ${f.numero || 'Facture'}`, color: '#fee2e2', textColor: '#991b1b' });
      }
    });

    return map;
  }, [chantiers, factures, year, month]);

  // Build 42-cell grid
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = i - firstDayDow + 1;
    cells.push(day >= 1 && day <= daysInMonth ? { day, events: eventsByDay[day] || [] } : { day: null, events: [] });
  }

  // Upcoming events (next 45 days)
  const upcoming = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const limit = new Date(now); limit.setDate(now.getDate() + 45);
    const list = [];

    chantiers.forEach(c => {
      if (c.dateDebut) {
        const d = new Date(c.dateDebut); d.setHours(0,0,0,0);
        if (d >= now && d <= limit) list.push({ date: d, label: c.nom || c.numero, sub: `Début de chantier`, color: '#3b82f6' });
      }
      if (c.dateFin) {
        const d = new Date(c.dateFin); d.setHours(0,0,0,0);
        if (d >= now && d <= limit) list.push({ date: d, label: c.nom || c.numero, sub: 'Fin prévue', color: '#10b981' });
      }
    });

    factures.forEach(f => {
      if (f.dateEcheance) {
        const d = new Date(f.dateEcheance); d.setHours(0,0,0,0);
        if (d >= now && d <= limit) {
          const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
          list.push({ date: d, label: f.numero || 'Facture', sub: `Échéance · CHF ${restant.toLocaleString('fr-CH', { maximumFractionDigits: 0 })}`, color: '#ef4444' });
        }
      }
    });

    return list.sort((a, b) => a.date - b.date).slice(0, 8);
  }, [chantiers, factures]);

  const isToday = (day) => day !== null && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  const btnStyle = { background: 'var(--ds-btn-ghost-bg)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.15s' };

  return (
    <div>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Calendrier</div>
          <div className="page-title-sub" style={{ textTransform: 'capitalize' }}>{monthLabel}</div>
        </div>
        <div className="page-actions-group">
          <button onClick={prevMonth} style={btnStyle}>← {prevMonthLabel}</button>
          <button onClick={goToday} style={btnStyle}>Aujourd'hui</button>
          <button onClick={nextMonth} style={btnStyle}>{nextMonthLabel} →</button>
          <button style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Nouvel événement
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Calendar grid */}
        <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ds-card-border)' }}>
            {JOURS.map(j => (
              <div key={j} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{j}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((cell, i) => (
              <div key={i} style={{
                minHeight: 88,
                padding: '8px',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ds-card-border)' : 'none',
                borderBottom: i < 35 ? '1px solid var(--ds-card-border)' : 'none',
                background: cell.day === null ? 'var(--bg-glass)' : 'transparent',
              }}>
                {cell.day !== null && (
                  <>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: '50%',
                      background: isToday(cell.day) ? '#3b82f6' : 'transparent',
                      color: isToday(cell.day) ? '#fff' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: isToday(cell.day) ? 700 : 500,
                      marginBottom: 4,
                    }}>
                      {cell.day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {cell.events.slice(0, 2).map((ev, ei) => (
                        <div key={ei} style={{
                          background: ev.color, color: ev.textColor,
                          borderRadius: 4, padding: '2px 5px',
                          fontSize: 10, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{ev.label}</div>
                      ))}
                      {cell.events.length > 2 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                          +{cell.events.length - 2} autres
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div style={DS.card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} strokeWidth={2} style={{ color: '#3b82f6' }} />
            Prochains événements
          </div>

          {upcoming.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Aucun événement à venir
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcoming.map((ev, i) => {
                const evToday = ev.date.toDateString() === today.toDateString();
                const dayLabel = evToday ? "Aujourd'hui" : ev.date.toLocaleDateString('fr-CH', { weekday: 'short' });
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      textAlign: 'center', minWidth: 44, flexShrink: 0,
                      background: 'var(--bg-glass-2)',
                      border: `2px solid ${ev.color}`,
                      borderRadius: 10, padding: '5px 4px',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: ev.color }}>
                        {ev.date.toLocaleDateString('fr-CH', { month: 'short' })}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {ev.date.getDate()}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {dayLabel}
                      </div>
                    </div>
                    <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {ev.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
