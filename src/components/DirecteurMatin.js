import React from 'react';
import { Sunrise, ChevronRight } from 'lucide-react';
import { libelleScoreSante } from '../donnees';

// Protège le rendu contre les valeurs non-string (données localStorage corrompues)
function safeStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.label || v.action || v.message || '';
  return String(v);
}

// Phrase de synthèse sobre à partir du score santé corrigé (étape 1 : trésorerie incluse).
export function synthesePhraseDirecteur(scoreSante) {
  if (scoreSante === null || scoreSante === undefined) {
    return 'Voici où en est CYNA ce matin.';
  }
  const libelle = libelleScoreSante(scoreSante).toLowerCase();
  if (scoreSante >= 75) return `CYNA est en bonne santé ce matin — score ${scoreSante}/100 (${libelle}).`;
  if (scoreSante >= 50) return `Situation à surveiller ce matin — score ${scoreSante}/100 (${libelle}).`;
  return `Vigilance ce matin — score ${scoreSante}/100 (${libelle}), plusieurs points à traiter.`;
}

// Le signal le plus important à surveiller : on priorise le rouge, puis l'orange, sinon le premier.
export function signalPrincipal(anticipations = []) {
  if (!Array.isArray(anticipations) || anticipations.length === 0) return null;
  return anticipations.find(a => a && a.couleur === '#ef4444')
    || anticipations.find(a => a && a.couleur === '#f59e0b')
    || anticipations[0];
}

const COULEUR_PRIORITE = { URGENT: '#ef4444', IMPORTANT: '#f59e0b' };

/**
 * Bloc "Directeur du matin" — tout en haut de l'Accueil.
 * LIT uniquement des données déjà calculées (briefing = simulerRapportLundi, scoreSante = CoachDirecteur).
 * Ne recalcule rien lui-même. 100% local. État neutre digne si pas assez de données.
 */
export default function DirecteurMatin({ briefing, scoreSante = null, naviguer = () => {} }) {
  const actions = Array.isArray(briefing?.actionsAvantLundi)
    ? briefing.actionsAvantLundi.filter(a => a && (a.priorite === 'URGENT' || a.priorite === 'IMPORTANT')).slice(0, 5)
    : [];
  const anticipations = Array.isArray(briefing?.anticipations) ? briefing.anticipations : [];
  const signal = signalPrincipal(anticipations);

  // État neutre : ni score, ni action, ni signal → pas de quoi faire un vrai briefing.
  const assezDeDonnees = !!briefing && (scoreSante !== null || actions.length > 0 || anticipations.length > 0);

  const card = {
    background: 'var(--dash-card, #ffffff)',
    border: '1px solid var(--dash-border, #e2e8f0)',
    borderLeft: '4px solid #0d3d6e',
    borderRadius: 14,
    padding: '16px 18px',
    marginBottom: 16,
    boxShadow: 'var(--ds-card-shadow, 0 2px 8px rgba(0,0,0,0.06))',
  };
  const entete = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Sunrise size={15} color="#0d3d6e" strokeWidth={2.2} />
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Directeur du matin
      </span>
    </div>
  );

  if (!assezDeDonnees) {
    return (
      <div style={card} data-testid="directeur-matin">
        {entete}
        <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: 1.5 }}>
          Pas encore assez d'historique pour un briefing complet. Continue à saisir tes heures,
          devis et factures — le briefing s'enrichit chaque jour.
        </p>
      </div>
    );
  }

  return (
    <div style={card} data-testid="directeur-matin">
      {entete}

      {/* (a) Phrase de synthèse — où en est l'entreprise aujourd'hui */}
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: '0 0 14px', lineHeight: 1.4 }}>
        {synthesePhraseDirecteur(scoreSante)}
      </p>

      {/* (b) Actions prioritaires (3-5) */}
      {actions.length > 0 ? (
        <div style={{ marginBottom: signal ? 14 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
            À traiter en priorité
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, lineHeight: '18px', flexShrink: 0 }}>{safeStr(a.icone) || '•'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{safeStr(a.action)}</div>
                  {a.detail && <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 1 }}>{safeStr(a.detail)}</div>}
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: COULEUR_PRIORITE[a.priorite] || '#64748b',
                  background: (COULEUR_PRIORITE[a.priorite] || '#64748b') + '18',
                  border: `1px solid ${(COULEUR_PRIORITE[a.priorite] || '#64748b')}30`,
                  borderRadius: 20, padding: '2px 8px',
                }}>{safeStr(a.priorite)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#10b981', fontWeight: 600, margin: signal ? '0 0 14px' : 0 }}>
          Aucune action urgente ce matin — tu es à jour.
        </p>
      )}

      {/* (c) Signal à surveiller — l'anticipation la plus importante */}
      {signal && (
        <div style={{ borderTop: '1px solid var(--dash-border, #e2e8f0)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
            Signal à surveiller
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{safeStr(signal.icone) || '•'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{safeStr(signal.label)}</span>
              {signal.valeur && (
                <span style={{ fontSize: 13, fontWeight: 800, color: signal.couleur || 'var(--text-primary, #0f172a)', marginLeft: 8 }}>
                  {safeStr(signal.valeur)}
                </span>
              )}
              {signal.detail && <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 1 }}>{safeStr(signal.detail)}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Lien discret vers le Centre IA */}
      <div
        onClick={() => naviguer('agents')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#0d3d6e' }}
      >
        Ouvrir le Centre IA <ChevronRight size={12} strokeWidth={2.5} />
      </div>
    </div>
  );
}
