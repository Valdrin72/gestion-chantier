/**
 * CYNA — DESIGN SYSTEM v1 « instrument de précision » (maquette validée patron).
 * Socle de tokens + styles partagés pour la refonte visuelle (Phase A).
 * Consommé d'abord par l'Accueil (Phase B) ; les autres pages migreront
 * phase par phase. AUCUNE logique métier ici — apparence uniquement.
 */

// ── TYPOGRAPHIE ─────────────────────────────────────────────────────────────
// Inter (textes/titres/labels) + IBM Plex Mono (TOUS les chiffres, montants,
// dates, %, annotations techniques). Chargées via Google Fonts (public/index.html).
export const FONT_UI   = "'Inter', -apple-system, 'Segoe UI', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', 'SF Mono', Consolas, monospace";

// ── COULEURS ────────────────────────────────────────────────────────────────
export const V1 = {
  // Marque — nav, liens, titres de section, onglet actif, accents
  marine:     '#0E2A4F',  // bleu nuit
  bleu:       '#1E5FAF',  // bleu profond
  bleuMoyen:  '#4C8FD1',
  bleuClair:  '#8FBCE6',
  bleuFond:   '#E6EDF5',
  // États — usage EXCLUSIF états métier
  ok:         '#1E8A4C',
  warn:       '#E8912B',
  danger:     '#C0392B',
  // Fonds
  page:       '#F4F6F9',  // uni, aucune grille
  carte:      '#FFFFFF',
  separation: '#EEF1F5',
  // Textes
  texte:      '#16233A',
  texteMuted: '#5B6B80',
};

export const BADGES_V1 = {
  ok:     { bg: '#EAF3DE', color: '#3B6D11' },
  warn:   { bg: '#FAEEDA', color: '#854F0B' },
  danger: { bg: '#FCEBEB', color: '#A32D2D' },
  marque: { bg: V1.bleuFond, color: V1.bleu },
};

// ── RYTHME STRICT ───────────────────────────────────────────────────────────
export const RYTHME = { padCarte: 16, entreCartes: 16, entreSections: 24 };

// ── COMPOSANTS (styles partagés) ────────────────────────────────────────────
export const carteV1 = {
  background: V1.carte,
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(16,38,73,0.04)',
  border: `1px solid ${V1.separation}`,
  padding: RYTHME.padCarte,
};

/** Montant suisse : 263'800 (mono, apostrophe). */
export const fmtCH = (n) => {
  const v = Math.round(parseFloat(n) || 0);
  const neg = v < 0 ? '−' : '';
  return neg + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

/** Style texte mono technique (chiffres, dates, annotations). */
export const mono = (size = 12, color = V1.texteMuted, weight = 500) => ({
  fontFamily: FONT_MONO, fontSize: size, color, fontWeight: weight,
  letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
});

/** Titre de section : index mono (01, 02…) + label uppercase espacé bleu profond. */
export const titreSection = (index, label) => ({
  index: { ...mono(11, V1.bleuMoyen, 500) },
  label: {
    fontFamily: FONT_UI, fontSize: 12, fontWeight: 700, color: V1.bleu,
    textTransform: 'uppercase', letterSpacing: '0.14em',
  },
  wrap: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: RYTHME.entreCartes },
  _index: index, _label: label,
});

/** Cartouche badge d'état. */
export const badgeV1 = (etat = 'marque') => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: (BADGES_V1[etat] || BADGES_V1.marque).bg,
  color: (BADGES_V1[etat] || BADGES_V1.marque).color,
  borderRadius: 6, padding: '3px 8px',
  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
});

/** Pastille d'état ronde 8px. */
export const pastille = (couleur) => ({
  width: 8, height: 8, borderRadius: '50%', background: couleur,
  display: 'inline-block', flexShrink: 0,
});

/** Barre de progression 8px, colorée par état. */
export const barreProgression = (pct, couleur) => ({
  piste: { height: 8, background: V1.separation, borderRadius: 4, overflow: 'hidden' },
  remplissage: {
    height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`,
    background: couleur, borderRadius: 4, transition: 'width 0.3s ease',
  },
});

/** Couleur d'état par valeur d'avancement / marge (mapping visuel simple). */
export const couleurEtat = (niveau) =>
  niveau === 'ok' ? V1.ok : niveau === 'warn' ? V1.warn : niveau === 'danger' ? V1.danger : V1.bleu;

// ── HERO ────────────────────────────────────────────────────────────────────
/** Fond hero bleu nuit dégradé + fine grille technique en filigrane (hero UNIQUEMENT). */
export const heroFond = {
  background: `
    repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 44px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 44px),
    linear-gradient(135deg, #0E2A4F 0%, #1E5FAF 100%)`,
  color: '#fff',
};
export const heroMono = (size = 11, opacity = 0.72) => ({
  fontFamily: FONT_MONO, fontSize: size, color: `rgba(255,255,255,${opacity})`,
  letterSpacing: '0.08em', fontWeight: 500,
});

/** Anneau de score santé (SVG paths calculés par le composant). */
export const scoreCouleur = (score) =>
  score === null ? V1.bleuClair : score >= 75 ? '#35C26E' : score >= 50 ? '#F5A93F' : '#E85C4A';
export const scoreLibelle = (score) =>
  score === null ? '—' : score >= 75 ? 'BONNE SANTÉ' : score >= 50 ? 'À SURVEILLER' : 'VIGILANCE';
