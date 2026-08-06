/**
 * CYNA — Composants d'Accueil, design v1 « instrument de précision » (Phase B).
 * PRÉSENTATION UNIQUEMENT : chaque composant reçoit des données DÉJÀ calculées
 * par le Dashboard (mêmes memos, mêmes moteurs) — zéro logique métier ici.
 */
import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import {
  V1, FONT_UI, carteV1, fmtCH, mono, badgeV1, pastille, barreProgression,
  heroFond, heroMono, scoreCouleur, scoreLibelle, RYTHME,
} from '../../design/v1';

// ── Petits éléments ─────────────────────────────────────────────────────────

export function TitreSectionV1({ index, label, droite = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: RYTHME.entreCartes }}>
      <span style={mono(12, V1.bleuMoyen)}>{index}</span>
      <span style={{ fontFamily: FONT_UI, fontSize: 13.5, fontWeight: 700, color: V1.bleu, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{label}</span>
      {droite && <span style={{ marginLeft: 'auto', ...mono(11, V1.texteMuted) }}>{droite}</span>}
    </div>
  );
}

export function Sparkline({ points = [], couleur = V1.bleu, largeur = 72, hauteur = 22 }) {
  if (!points.length) return <div style={{ width: largeur, height: hauteur }} />;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const range = max - min || 1;
  const pts = points.map((v, i) => `${(i / (points.length - 1 || 1)) * largeur},${hauteur - 2 - ((v - min) / range) * (hauteur - 4)}`).join(' ');
  return (
    <svg width={largeur} height={hauteur} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={couleur} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Anneau de score santé (hero). */
export function AnneauScore({ score, taille = 132 }) {
  const c = scoreCouleur(score);
  const r = (taille - 16) / 2, circ = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div style={{ position: 'relative', width: taille, height: taille, flexShrink: 0 }}>
      <svg width={taille} height={taille} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={c} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} style={{ filter: `drop-shadow(0 0 8px ${c})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...mono(Math.round(taille * 0.24), '#fff'), fontWeight: 500 }}>{score ?? '—'}</span>
        <span style={heroMono(9, 0.6)}>/100</span>
      </div>
    </div>
  );
}

// ── HERO ────────────────────────────────────────────────────────────────────
/**
 * Hero bleu nuit. Props : dateLabel, periodeGlobale/setPeriodeGlobale, nbActifs,
 * nbCollaborateurs, score, actions (top 3 du rendez-vous), prenom, ongletsRdv
 * (élément React — les onglets Matin/Soir/Hebdo du DirecteurBloc), onCloche.
 */
export function HeroDirection({ prenom = 'Valdrin', dateLabel, periodeGlobale, setPeriodeGlobale = () => {},
  nbActifs = 0, nbCollaborateurs = 0, score = null, actions = [], ongletsRdv = null, onCloche = () => {}, onMenu = null, compact = false }) {
  const PERIODES = [{ id: 'semaine', label: 'Cette semaine' }, { id: 'mois', label: 'Ce mois' }, { id: 'annee', label: 'Cette année' }];
  return (
    <div style={{ ...heroFond, borderRadius: 0, padding: compact ? '18px 18px 96px' : '30px 32px 128px', position: 'relative' }} data-testid="hero-direction">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: compact ? 18 : 34, flexWrap: 'wrap' }}>
        {onMenu && (
          <button onClick={onMenu} aria-label="Menu" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 7, cursor: 'pointer', color: '#fff', display: 'inline-flex' }}>
            <Menu size={16} />
          </button>
        )}
        <span style={{ fontFamily: FONT_UI, fontWeight: 800, fontSize: 15, letterSpacing: '0.06em' }}>CYNA</span>
        <span style={heroMono(10, 0.55)}>· TABLEAU DE BORD · DIRECTION</span>
        <span style={{ marginLeft: 'auto', ...heroMono(10, 0.75) }}>{dateLabel}</span>
        <button onClick={onCloche} aria-label="Notifications" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff', display: 'inline-flex' }}>
          <Bell size={13} />
        </button>
        <select value={periodeGlobale} onChange={e => setPeriodeGlobale(e.target.value)} aria-label="Période"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '5px 8px', color: '#fff', fontFamily: FONT_UI, fontSize: 12, cursor: 'pointer' }}>
          {PERIODES.map(p => <option key={p.id} value={p.id} style={{ color: '#16233A' }}>{p.label}</option>)}
        </select>
        {ongletsRdv}
      </div>

      <div style={{ display: 'flex', gap: compact ? 18 : 40, alignItems: 'flex-start', flexWrap: compact ? 'wrap' : 'nowrap' }}>
        {/* Gauche : salutation */}
        <div style={{ flex: '1 1 320px', minWidth: 240 }}>
          <div style={heroMono(11, 0.6)}>ACCUEIL / 00</div>
          <h1 style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: compact ? 30 : 47, margin: '12px 0 10px', letterSpacing: '-0.02em', color: '#fff' }}>
            Bonjour {prenom}
          </h1>
          <div style={{ fontFamily: FONT_UI, fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
            Voici l'état de votre entreprise aujourd'hui.
          </div>
          <div style={{ marginTop: 14, ...heroMono(11, 0.7) }}>
            — {nbActifs} CHANTIER{nbActifs !== 1 ? 'S' : ''} ACTIF{nbActifs !== 1 ? 'S' : ''} – {nbCollaborateurs} COLLABORATEUR{nbCollaborateurs !== 1 ? 'S' : ''}
          </div>
        </div>

        {/* Centre-droit : anneau score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <AnneauScore score={score} taille={compact ? 104 : 168} />
          <div style={heroMono(9, 0.65)}>SANTÉ ENTREPRISE · {scoreLibelle(score)}</div>
        </div>

        {/* Droite : actions du jour */}
        {!compact && (
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <div style={{ ...heroMono(10, 0.6), marginBottom: 12 }}>ACTIONS DU JOUR</div>
            {actions.length === 0 ? (
              <div style={{ fontFamily: FONT_UI, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Rien d'urgent — journée dégagée.</div>
            ) : actions.slice(0, 3).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <span style={heroMono(11, 0.55)}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_UI, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{typeof a.action === 'string' ? a.action : ''}</div>
                  {a.detail && <div style={{ ...heroMono(10, 0.55), marginTop: 2 }}>{typeof a.detail === 'string' ? a.detail : ''}</div>}
                </div>
                <span style={{ ...pastille(a.priorite === 'URGENT' ? '#E85C4A' : '#F5A93F'), marginTop: 5 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI CARDS (chevauchent le hero) ─────────────────────────────────────────
/** items : [{ label, valeur (string mono), etat 'ok'|'warn'|'danger'|null, badge, sousLigne, sparkline (points), action {label, onClick}, couleurValeur }] */
export function KpiStripV1({ items = [], compact = false }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : `repeat(${items.length}, 1fr)`,
      gap: RYTHME.entreCartes, padding: compact ? '0 18px' : '0 32px',
      margin: compact ? '-72px 0 24px' : '-84px 0 24px',
      position: 'relative', zIndex: 2, boxSizing: 'border-box',
    }} data-testid="kpi-strip">
      {items.map(k => (
        <div key={k.label} style={{ ...carteV1, display: 'flex', flexDirection: 'column', minHeight: 134 }}>
          <div style={{ ...mono(10, V1.texteMuted), textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{k.label}</div>
          <div style={{ ...mono(compact ? 20 : 30, k.couleurValeur || V1.texte, 500), lineHeight: 1 }}>{k.valeur}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: 10 }}>
            {k.sparkline && <Sparkline points={k.sparkline} couleur={k.couleurValeur || V1.bleu} />}
            {k.badge && <span style={badgeV1(k.etat || 'marque')}>{k.badge}</span>}
            {k.sousLigne && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...mono(10, k.etat ? (k.etat === 'danger' ? V1.danger : k.etat === 'warn' ? V1.warn : V1.ok) : V1.texteMuted) }}>
              <span style={pastille(k.etat === 'danger' ? V1.danger : k.etat === 'warn' ? V1.warn : V1.ok)} />{k.sousLigne}
            </span>}
            {k.action && (
              <button onClick={k.action.onClick} style={{
                marginLeft: 'auto', cursor: 'pointer', fontFamily: FONT_UI, fontSize: 11, fontWeight: 700,
                ...(k.etat === 'danger'
                  ? { background: V1.danger, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px' }
                  : { background: 'transparent', color: V1.bleu, border: 'none', padding: 0 }),
              }}>{k.action.label}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CARTE CHANTIER ──────────────────────────────────────────────────────────
/** ch : { nom, icone (ReactNode), sousLigne (mono), avancement, couleur, cartouche {texte, etat}, echeance } */
export function CarteChantierV1({ ch, onClick = () => {} }) {
  const barre = barreProgression(ch.avancement, ch.couleur);
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ ...carteV1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 136, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: V1.bleuFond, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V1.bleu, flexShrink: 0 }}>
          {ch.icone}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_UI, fontSize: 15, fontWeight: 700, color: V1.texte, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.nom}</div>
          <div style={{ ...mono(10, V1.texteMuted), marginTop: 2, textTransform: 'uppercase' }}>{ch.sousLigne}</div>
        </div>
        <div style={{ ...mono(24, ch.couleur, 500), width: 80, textAlign: 'right', flexShrink: 0 }}>{ch.avancement}%</div>
      </div>
      <div style={barre.piste}><div style={barre.remplissage} /></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={badgeV1(ch.cartouche.etat)}>{ch.cartouche.texte}</span>
        <span style={mono(10, V1.texteMuted)}>{ch.echeance}</span>
      </div>
    </div>
  );
}

// ── APERÇU FINANCIER ────────────────────────────────────────────────────────
export function ApercuFinancierV1({ resultatNet, lignes = [], serie = [], compact = false }) {
  return (
    <div style={{ ...carteV1, display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="apercu-financier">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ ...mono(10, V1.texteMuted), textTransform: 'uppercase', letterSpacing: '0.1em' }}>RÉSULTAT NET</span>
        <span style={mono(20, resultatNet >= 0 ? V1.ok : V1.danger, 500)}>{fmtCH(resultatNet)}</span>
        <span style={badgeV1(resultatNet >= 0 ? 'ok' : 'danger')}>{resultatNet >= 0 ? 'POSITIF' : 'NÉGATIF'}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, flexDirection: compact ? 'column' : 'row' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 168 }}>
          {lignes.map(l => (
            <div key={l.label}>
              <div style={{ ...mono(9, V1.texteMuted), textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={mono(16, l.couleur || V1.texte, 500)}>{fmtCH(l.valeur)}</span>
                {l.delta != null && <span style={mono(10, l.delta >= 0 ? V1.ok : V1.danger)}>{l.delta >= 0 ? '+' : ''}{l.delta}%</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: compact ? 140 : 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fill: V1.texteMuted }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => `CHF ${fmtCH(v)}`} contentStyle={{ fontFamily: FONT_UI, fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="CA" stroke={V1.bleu} fill={V1.bleuFond} strokeWidth={2} name="CA signé" />
              <Area type="monotone" dataKey="Couts" stroke="#B9C3D0" fill="#EEF1F5" strokeWidth={1.5} name="Dépenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── TIMELINE ACTIVITÉ ───────────────────────────────────────────────────────
/** evenements : [{ horodatage (mono), couleur, texte, montant (string ou null) }] */
export function TimelineActiviteV1({ evenements = [] }) {
  return (
    <div style={carteV1} data-testid="timeline-activite">
      {evenements.length === 0 ? (
        <div style={{ fontFamily: FONT_UI, fontSize: 13, color: V1.texteMuted }}>Aucune activité récente.</div>
      ) : evenements.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 40, borderTop: i > 0 ? `1px solid ${V1.separation}` : 'none' }}>
          <span style={{ ...mono(10, V1.texteMuted), width: 84, flexShrink: 0, textTransform: 'uppercase' }}>{e.horodatage}</span>
          <span style={pastille(e.couleur)} />
          <span style={{ fontFamily: FONT_UI, fontSize: 13, color: V1.texte, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.texte}</span>
          {e.montant && <span style={{ ...mono(12, e.couleur, 500), textAlign: 'right' }}>{e.montant}</span>}
        </div>
      ))}
    </div>
  );
}
