import React from 'react';
import { Sparkles, ShieldCheck, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fmtN } from '../../donnees';
import { conseilPrixM2ParType, MARGE_MIN_NEGO } from '../../calculs/conseilPrix';
import { V1, mono } from '../../design/v1';

const FIABLE = '#1E8A4C';         // vert « source fiable »
const FIABLE_FOND = 'rgba(30,138,76,0.08)';
const clamp = (v) => Math.max(0, Math.min(100, v));

// Un bloc « source A » (historique CYNA) pour UN type de travaux.
function BlocType({ type, conseil, surface }) {
  if (!conseil.suffisant) {
    return (
      <div data-testid={`aide-type-${type}`} style={{ border: `1px dashed ${V1.separation}`, borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: V1.texte }}>{type}</div>
        <div style={{ fontSize: 12.5, color: V1.texteMuted, marginTop: 4 }}>
          Données CYNA insuffisantes — {conseil.nbChantiers} chantier{conseil.nbChantiers !== 1 ? 's' : ''} facturé{conseil.nbChantiers !== 1 ? 's' : ''} (minimum&nbsp;3).
          Aucun prix/m² fiable pour ce type pour l'instant.
        </div>
      </div>
    );
  }

  const { conseille, bas, haut, coutM2Median, plancher, nbChantiers } = conseil;
  const min = Math.min(bas, plancher ?? bas), max = haut;
  const span = max - min || 1;
  const pos = (v) => clamp(((v - min) / span) * 100);
  const surf = parseFloat(surface) || 0;

  return (
    <div data-testid={`aide-type-${type}`} style={{ background: FIABLE_FOND, border: `1px solid ${FIABLE}33`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: FIABLE, color: '#fff', borderRadius: 20, padding: '3px 9px' }}>Fiable</span>
        <span style={{ ...mono(10, FIABLE, 700), textTransform: 'uppercase', letterSpacing: '0.1em' }}>Historique CYNA · {type}</span>
      </div>
      <div style={{ fontSize: 11, color: V1.texteMuted, marginBottom: 12 }}>
        Médiane du prix facturé au m² sur {nbChantiers} chantier{nbChantiers > 1 ? 's' : ''} facturé{nbChantiers > 1 ? 's' : ''}.
      </div>

      {/* Conseillé + fourchette Q1–Q3 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: V1.texteMuted }}>Conseillé (médiane)</span>
        <span data-testid={`aide-conseille-${type}`} style={{ ...mono(24, FIABLE, 700) }}>{fmtN(Math.round(conseille))}<span style={{ fontSize: 12, color: V1.texteMuted, marginLeft: 3 }}>CHF/m²</span></span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 6, background: `${FIABLE}22`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(bas)}%`, right: `${100 - pos(haut)}%`, background: `${FIABLE}66`, borderRadius: 6 }} />
        <div style={{ position: 'absolute', top: -3, width: 2, height: 16, background: FIABLE, left: `${pos(conseille)}%` }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        {[
          { k: 'Bas · Q1', v: bas },
          { k: 'Conseillé', v: conseille },
          { k: 'Haut · Q3', v: haut },
        ].map(q => (
          <div key={q.k} style={{ background: V1.carte, border: `1px solid ${V1.separation}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: V1.texteMuted }}>{q.k}</div>
            <div style={{ ...mono(15, V1.texte, 700), marginTop: 2 }}>{fmtN(Math.round(q.v))}</div>
          </div>
        ))}
      </div>

      {/* Marge de négociation */}
      {plancher != null && (
        <div style={{ marginTop: 14, background: V1.carte, border: `1px solid ${V1.separation}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: V1.marine, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} /> Marge de négociation
          </div>
          <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', border: `1px solid ${V1.separation}` }}>
            <div style={{ width: `${clamp(pos(plancher))}%`, background: V1.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: '#fff' }}>à perte</div>
            <div style={{ width: `${clamp(pos(conseille) - pos(plancher))}%`, background: FIABLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: '#fff' }}>marge saine</div>
            <div style={{ flex: 1, background: V1.bleu, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: '#fff' }}>premium</div>
          </div>
          <div style={{ fontSize: 12, color: V1.texteMuted, marginTop: 10 }}>
            Tu peux descendre jusqu'à <strong data-testid={`aide-plancher-${type}`} style={{ color: V1.danger }}>{fmtN(Math.round(plancher))} CHF/m²</strong> en gardant une marge nette ≥ {Math.round(MARGE_MIN_NEGO * 100)} %.
            En dessous, tu passes à perte. {coutM2Median != null && <>Coût/m² historique : <strong>{fmtN(Math.round(coutM2Median))}</strong>.</>}
          </div>
        </div>
      )}

      {/* Total indicatif (jamais écrit dans le devis) */}
      {surf > 0 && (
        <div style={{ fontSize: 12, color: V1.texteMuted, marginTop: 10 }}>
          À titre indicatif : {fmtN(Math.round(conseille))} × {fmtN(surf)} m² ≈ <strong style={{ color: V1.texte }}>CHF {fmtN(Math.round(conseille * surf))}</strong> HT — <em>pas reporté dans le devis.</em>
        </div>
      )}
    </div>
  );
}

/**
 * Panneau « Aide au devis » — LOT A : partie HISTORIQUE (source A, fiable, 100 % local, sans IA).
 * CONSEILLE seulement : n'écrit JAMAIS form.montantHT ni aucun total. Lit le(s) type(s) + la surface
 * du formulaire et se met à jour quand ils changent.
 */
export default function AideDevisPanel({ typesSelectionnes = [], surface = 0 }) {
  const { chantiers = [], factures = [], devis = [], parametres = {}, pointages = [] } = useApp();
  const types = (typesSelectionnes || []).filter(Boolean);

  return (
    <div data-testid="aide-devis-panel" style={{ marginBottom: 20, background: V1.bleuFond, border: `1px solid ${V1.bleu}2e`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Sparkles size={16} color={V1.bleu} />
        <span style={{ fontWeight: 800, fontSize: 14, color: V1.marine }}>Aide au devis — prix conseillé au m²</span>
      </div>

      {/* Bandeau permanent : l'outil conseille, il n'écrit jamais le prix */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: V1.carte, border: `1px solid ${V1.bleu}33`, borderLeft: `4px solid ${V1.bleu}`, borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
        <ShieldCheck size={15} color={V1.bleu} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: V1.texteMuted }}>
          <strong style={{ color: V1.marine }}>Cet outil ne remplit jamais le prix.</strong> Il t'éclaire — tu tapes ton montant toi-même. Aucun chiffre ici n'entre dans les totaux.
        </span>
      </div>

      {types.length === 0 ? (
        <div style={{ fontSize: 12.5, color: V1.texteMuted, textAlign: 'center', padding: '12px 0' }}>
          Coche un ou plusieurs <strong>travaux</strong> ci-dessous pour voir le prix/m² conseillé issu de ton historique.
        </div>
      ) : (
        types.map(type => (
          <BlocType key={type} type={type}
            conseil={conseilPrixM2ParType({ chantiers, factures, devis, parametres, pointages, type })}
            surface={surface} />
        ))
      )}

      {/* Placeholder source B (repère marché IA) — lot suivant */}
      <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8912B' }} />
        Repère marché (estimation IA, à vérifier) — bientôt.
      </div>
    </div>
  );
}
