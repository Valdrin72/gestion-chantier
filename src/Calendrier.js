import React, { useState, useMemo } from 'react';
import { Plus, Clock, Calendar, X } from 'lucide-react';
import { DS } from './ds';

const CATEGORIES = [
  { id: 'reunion',    label: 'Réunion',    bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
  { id: 'livraison',  label: 'Livraison',  bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  { id: 'rdv_client', label: 'RDV Client', bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  { id: 'autre',      label: 'Autre',      bg: 'var(--bg-hover)',        color: 'var(--text-secondary)' },
];

const FORM_VIDE = { titre: '', date: '', categorie: 'reunion' };

export default function Calendrier({ chantiers = [], clients = [], devis = [], factures = [] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [customEvents, setCustomEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyna_cal_events') || '[]'); } catch { return []; }
  });
  const [modal, setModal] = useState(null); // null | { form }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = viewDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  const prevMonthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-CH', { month: 'short' });
  const nextMonthLabel = new Date(year, month + 1, 1).toLocaleDateString('fr-CH', { month: 'short' });

  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const ouvrirModal = (dateISO = '') => {
    setModal({ form: { ...FORM_VIDE, date: dateISO } });
  };

  const sauvegarder = () => {
    if (!modal.form.titre.trim() || !modal.form.date) return;
    const cat = CATEGORIES.find(c => c.id === modal.form.categorie);
    setCustomEvents(prev => {
      const next = [...prev, {
        id: Date.now(),
        label: modal.form.titre.trim(),
        date: modal.form.date,
        bg: cat.bg,
        color: cat.color,
        sub: cat.label,
      }];
      try { localStorage.setItem('cyna_cal_events', JSON.stringify(next)); } catch {}
      return next;
    });
    setModal(null);
  };

  const supprimerEvent = (id) => setCustomEvents(prev => {
    const next = prev.filter(e => e.id !== id);
    try { localStorage.setItem('cyna_cal_events', JSON.stringify(next)); } catch {}
    return next;
  });

  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDay = useMemo(() => {
    const map = {};
    const add = (day, evt) => { if (!map[day]) map[day] = []; map[day].push(evt); };

    chantiers.forEach(c => {
      if (c.dateDebut) {
        const d = new Date(c.dateDebut);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: c.nom || c.numero, bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' });
      }
      if (c.dateFin) {
        const d = new Date(c.dateFin);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: `Fin: ${c.nom || c.numero}`, bg: 'rgba(16,185,129,0.12)', color: '#10b981' });
      }
    });

    factures.forEach(f => {
      if (f.dateEcheance) {
        const d = new Date(f.dateEcheance);
        if (d.getFullYear() === year && d.getMonth() === month)
          add(d.getDate(), { label: `Éch. ${f.numero || 'Facture'}`, bg: 'rgba(239,68,68,0.12)', color: '#ef4444' });
      }
    });

    customEvents.forEach(e => {
      const d = new Date(e.date);
      if (d.getFullYear() === year && d.getMonth() === month)
        add(d.getDate(), { label: e.label, bg: e.bg, color: e.color, id: e.id, custom: true });
    });

    return map;
  }, [chantiers, factures, customEvents, year, month]);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = i - firstDayDow + 1;
    cells.push(day >= 1 && day <= daysInMonth ? { day, events: eventsByDay[day] || [] } : { day: null, events: [] });
  }

  const upcoming = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const limit = new Date(now); limit.setDate(now.getDate() + 45);
    const list = [];

    chantiers.forEach(c => {
      if (c.dateDebut) {
        const d = new Date(c.dateDebut); d.setHours(0,0,0,0);
        if (d >= now && d <= limit) list.push({ date: d, label: c.nom || c.numero, sub: 'Début de chantier', color: '#3b82f6' });
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

    customEvents.forEach(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0);
      if (d >= now && d <= limit) list.push({ date: d, label: e.label, sub: e.sub, color: e.color, id: e.id, custom: true });
    });

    return list.sort((a, b) => a.date - b.date).slice(0, 8);
  }, [chantiers, factures, customEvents]);

  const isToday = (day) => day !== null && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const btnStyle = { background: 'var(--ds-btn-ghost-bg)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.15s' };

  const isoFromCell = (day) => {
    if (!day) return '';
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

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
          <button onClick={() => ouvrirModal()} style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Nouvel événement
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Calendar grid */}
        <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ds-card-border)' }}>
            {JOURS.map(j => (
              <div key={j} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{j}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((cell, i) => (
              <div key={i}
                onClick={() => cell.day && ouvrirModal(isoFromCell(cell.day))}
                style={{
                  minHeight: 88, padding: '8px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ds-card-border)' : 'none',
                  borderBottom: i < 35 ? '1px solid var(--ds-card-border)' : 'none',
                  background: cell.day === null ? 'var(--bg-glass)' : 'transparent',
                  cursor: cell.day ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (cell.day) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (cell.day) e.currentTarget.style.background = 'transparent'; }}
              >
                {cell.day !== null && (
                  <>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: '50%',
                      background: isToday(cell.day) ? '#3b82f6' : 'transparent',
                      color: isToday(cell.day) ? '#fff' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: isToday(cell.day) ? 700 : 500, marginBottom: 4,
                    }}>
                      {cell.day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {cell.events.slice(0, 2).map((ev, ei) => (
                        <div key={ei}
                          onClick={ev.custom ? (e) => { e.stopPropagation(); supprimerEvent(ev.id); } : undefined}
                          title={ev.custom ? 'Cliquer pour supprimer' : ev.label}
                          style={{
                            background: ev.bg, color: ev.color,
                            borderRadius: 4, padding: '2px 5px',
                            fontSize: 10, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: ev.custom ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3,
                          }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
                          {ev.custom && <X size={8} strokeWidth={3} style={{ flexShrink: 0 }} />}
                        </div>
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
                      {ev.custom && (
                        <button onClick={() => supprimerEvent(ev.id)} style={{ marginTop: 4, background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal nouvel événement */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setModal(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ds-card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Nouvel événement</div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={DS.label}>Titre</label>
              <input
                autoFocus
                value={modal.form.titre}
                onChange={e => setModal({ ...modal, form: { ...modal.form, titre: e.target.value } })}
                onKeyDown={e => e.key === 'Enter' && sauvegarder()}
                placeholder="Ex : Réunion de chantier..."
                style={DS.input}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={DS.label}>Date</label>
              <input
                type="date"
                value={modal.form.date}
                onChange={e => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })}
                style={DS.input}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={DS.label}>Catégorie</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id}
                    onClick={() => setModal({ ...modal, form: { ...modal.form, categorie: cat.id } })}
                    style={{
                      background: modal.form.categorie === cat.id ? cat.bg : 'var(--bg-glass)',
                      color: modal.form.categorie === cat.id ? cat.color : 'var(--text-secondary)',
                      border: `1px solid ${modal.form.categorie === cat.id ? cat.color + '60' : 'var(--ds-card-border)'}`,
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={DS.btnGhost}>Annuler</button>
              <button
                onClick={sauvegarder}
                disabled={!modal.form.titre.trim() || !modal.form.date}
                style={{ ...DS.btnPrimary, opacity: (!modal.form.titre.trim() || !modal.form.date) ? 0.5 : 1 }}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
