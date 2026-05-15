// ============================================================
// CYNA — DESIGN SYSTEM TOKENS
// Source de vérité : CYNA App.html
// ============================================================

export const DS = {
  // ── Cartes ──────────────────────────────────────────────────
  // Card = { background:'#fff', borderRadius:16, padding:20,
  //          border:'1px solid #E2E8F0',
  //          boxShadow:'0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.06)' }
  card: {
    background: 'var(--ds-card-bg)',
    backdropFilter: 'var(--ds-card-blur)',
    WebkitBackdropFilter: 'var(--ds-card-blur)',
    padding: '20px',
    borderRadius: '16px',
    marginBottom: '20px',
    boxShadow: 'var(--ds-card-shadow)',
    border: '1px solid var(--ds-card-border)',
    position: 'relative',
  },
  cardCompact: {
    background: 'var(--ds-card-compact-bg)',
    backdropFilter: 'var(--ds-card-blur)',
    WebkitBackdropFilter: 'var(--ds-card-blur)',
    padding: '16px 18px',
    borderRadius: '14px',
    marginBottom: '16px',
    boxShadow: 'var(--ds-card-compact-shadow)',
    border: '1px solid var(--ds-card-compact-border)',
    position: 'relative',
  },
  cardInset: {
    background: 'var(--ds-card-inset-bg)',
    borderRadius: '12px',
    padding: '14px 16px',
    border: '1px solid var(--ds-card-inset-border)',
    boxShadow: 'var(--ds-card-inset-shadow)',
  },

  // ── Boutons ─────────────────────────────────────────────────
  // btnPrimary = gradient blue→indigo, shadow rgba(59,130,246,0.32)
  btnPrimary: {
    background: 'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    boxShadow: '0 4px 14px rgba(59,130,246,0.32)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  // btnSuccess = gradient green
  btnSuccess: {
    background: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    boxShadow: '0 4px 14px rgba(16,185,129,0.32)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    background: 'var(--red-bg)',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  // btnGhost = { background:'#fff', color:'#475569', border:'1px solid #E2E8F0' }
  btnGhost: {
    background: 'var(--ds-btn-ghost-bg)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--ds-btn-ghost-border)',
    borderRadius: '10px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  btnWarning: {
    background: 'var(--orange-bg)',
    color: '#F59E0B',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: '10px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  // iconBtn = petits boutons action dans les tableaux (28×28)
  iconBtn: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748B',
  },
  // btnIconWhite = boutons icône topbar/header (38×38)
  btnIconWhite: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'var(--ds-btn-ghost-bg)',
    border: '1px solid var(--ds-btn-ghost-border)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
  },

  // ── Inputs ──────────────────────────────────────────────────
  // input = { background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:9, fontSize:13.5 }
  input: {
    width: '100%',
    padding: '10px 13px',
    borderRadius: '9px',
    border: '1px solid var(--ds-input-border)',
    background: 'var(--ds-input-bg)',
    color: 'var(--text-primary)',
    fontSize: '13.5px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  },
  label: {
    display: 'block',
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },

  // ── Tables ──────────────────────────────────────────────────
  // th = { padding:'12px 16px', fontSize:10.5, fontWeight:700, color:'#64748B',
  //        textTransform:'uppercase', letterSpacing:'0.6px', background:'#F8FAFC' }
  th: {
    padding: '12px 16px',
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    background: 'var(--ds-th-bg)',
    borderBottom: '1px solid var(--ds-th-border)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  // td = { padding:'14px 16px', fontSize:13, color:'#0F172A', whiteSpace:'nowrap' }
  td: {
    padding: '14px 16px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 500,
    borderBottom: '1px solid var(--ds-td-border)',
    whiteSpace: 'nowrap',
  },

  // ── Sections ────────────────────────────────────────────────
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    color: 'var(--ds-section-label-color)',
    marginBottom: '14px',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--ds-section-label-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  // ── Brand tokens ────────────────────────────────────────────
  brand: {
    primary:      '#3B82F6',
    primaryDeep:  '#1E40AF',
    secondary:    '#4F46E5',
    soft:         '#EEF2FF',
    tint:         '#EFF6FF',
    gradient:     'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)',
    gradientDeep: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
  },

  // ── KPI Gradients (source: CYNA App.html KpiCard) ───────────
  kpi: {
    blue:   { gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', glow: 'rgba(59,130,246,0.32)' },
    green:  { gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: 'rgba(16,185,129,0.32)' },
    amber:  { gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', glow: 'rgba(245,158,11,0.32)' },
    purple: { gradient: 'linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)', glow: 'rgba(139,92,246,0.32)' },
    red:    { gradient: 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)', glow: 'rgba(239,68,68,0.32)' },
  },

  // ── Badges sémantiques (Section 9 DESIGN_TOKENS.md) ─────────
  badges: {
    success : { bg: '#D1FAE5', color: '#065F46' },
    warning : { bg: '#FEF3C7', color: '#92400E' },
    danger  : { bg: '#FEE2E2', color: '#991B1B' },
    info    : { bg: '#DBEAFE', color: '#1E40AF' },
    neutral : { bg: '#F1F5F9', color: '#475569' },
    purple  : { bg: '#EDE9FE', color: '#5B21B6' },
    indigo  : { bg: '#E0E7FF', color: '#3730A3' },
  },

  // ── Statuts badges (source: CYNA App.html STATUT_COL) ───────
  statuts: {
    'En cours':   { bg: '#DBEAFE', color: '#1E40AF' },
    'Terminé':    { bg: '#D1FAE5', color: '#065F46' },
    'Planifié':   { bg: '#E0E7FF', color: '#3730A3' },
    'Suspendu':   { bg: '#FEE2E2', color: '#991B1B' },
    'Facturé':    { bg: '#EDE9FE', color: '#5B21B6' },
    'Brouillon':  { bg: '#F1F5F9', color: '#475569' },
    'Envoyé':     { bg: '#DBEAFE', color: '#1E40AF' },
    'Accepté':    { bg: '#D1FAE5', color: '#065F46' },
    'Refusé':     { bg: '#FEE2E2', color: '#991B1B' },
    'Payée':      { bg: '#D1FAE5', color: '#065F46' },
    'En retard':  { bg: '#FEE2E2', color: '#991B1B' },
    'En attente': { bg: '#FEF3C7', color: '#92400E' },
    'Partielle':  { bg: '#FEF3C7', color: '#92400E' },
    // Alias minuscules — normalisés par LEGACY_STATUTS dans DevisPage
    'en cours':   { bg: '#DBEAFE', color: '#1E40AF' },
    'terminé':    { bg: '#D1FAE5', color: '#065F46' },
    'planifié':   { bg: '#E0E7FF', color: '#3730A3' },
    'suspendu':   { bg: '#FEE2E2', color: '#991B1B' },
    'facturé':    { bg: '#EDE9FE', color: '#5B21B6' },
    'brouillon':  { bg: '#F1F5F9', color: '#475569' },
    'envoyé':     { bg: '#DBEAFE', color: '#1E40AF' },
    'accepté':    { bg: '#D1FAE5', color: '#065F46' },
    'refusé':     { bg: '#FEE2E2', color: '#991B1B' },
    'payée':      { bg: '#D1FAE5', color: '#065F46' },
    'en retard':  { bg: '#FEE2E2', color: '#991B1B' },
    'en attente': { bg: '#FEF3C7', color: '#92400E' },
    'partielle':  { bg: '#FEF3C7', color: '#92400E' },
  },

  // ── Couleurs palette (source: CYNA App.html) ────────────────
  colors: {
    textPrimary:   '#0F172A',
    textSecondary: '#475569',
    textMuted:     '#64748B',
    textFaint:     '#94A3B8',
    bgApp:         '#F8FAFC',
    bgCard:        '#FFFFFF',
    border:        '#E2E8F0',
    borderLight:   '#F1F5F9',
    activeNavBg:   '#EEF2FF',
    activeNavText: '#4F46E5',
    blue:          '#3B82F6',
    blueDark:      '#1E40AF',
    green:         '#10B981',
    greenDark:     '#065F46',
    amber:         '#F59E0B',
    amberDark:     '#92400E',
    purple:        '#8B5CF6',
    purpleDark:    '#4C1D95',
    red:           '#EF4444',
    redDark:       '#991B1B',
    indigo:        '#4F46E5',
    indigoDark:    '#3730A3',
  },
};

// ── Helpers statuts (source unique = DS.statuts) ────────────────
// Lookup insensible à la casse : tente d'abord la valeur exacte,
// puis la valeur en minuscules (normalisation LEGACY_STATUTS).
const _lookupStatut = (s) => DS.statuts[s] || DS.statuts[s?.trim().toLowerCase()] || null;
export const couleurStatut = (s) => _lookupStatut(s)?.color || '#3B82F6';
export const badgeStatut   = (s) => _lookupStatut(s) || { bg: '#F1F5F9', color: '#475569' };
