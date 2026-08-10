import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Check, Award } from 'lucide-react';
import { DS } from './ds';
import { useApp } from './context/AppContext';
import { fmtN, calculerCoutsChantier, SEUILS } from './donnees';
import { V1, mono } from './design/v1';

function StatBarre({ label, val, min, max, couleur = V1.bleu, unite = '' }) {
  const pct = max > min ? Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100)) : 50;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: V1.texteMuted, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ ...mono(12, V1.texte, 700) }}>{fmtN(Math.round(val))}{unite}</span>
      </div>
      <div style={{ height: 5, background: V1.separation, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: couleur, borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(9, V1.texteMuted), marginTop: 1 }}>
        <span>Min {fmtN(Math.round(min))}{unite}</span><span>Max {fmtN(Math.round(max))}{unite}</span>
      </div>
    </div>
  );
}

export default function AssistantDevisIA({ chantiers = [], devis = [], parametres = {}, form, onApply }) {
  const { pointages = [] } = useApp();
  const [ouvert, setOuvert] = useState(false);
  const [typeSelectionne, setTypeSelectionne] = useState('');

  const typesTravaux = parametres.typesTravaux || [];

  // Analyse les chantiers terminés par type pour extraire les statistiques
  const stats = useMemo(() => {
    const TERMINES = ['terminé', 'facturé', 'clôturé'];
    const termines = chantiers.filter(c => TERMINES.includes(c.statut?.trim().toLowerCase()));

    const parType = {};
    termines.forEach(c => {
      const types = (c.typesTravaux?.length > 0 ? c.typesTravaux : [c.typeChantier || 'Autre']);
      types.forEach(t => {
        if (!t) return;
        if (!parType[t]) parType[t] = [];
        const devisLie = devis.find(d => String(d.id) === String(c.devisId));
        const montant = parseFloat(devisLie?.montantHT) || 0;
        const duree = parseInt(c.nombreJours) || 0;
        const personnes = parseInt(c.nombrePersonnes) || 0;
        const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
        const marge = couts.margeActuellePct;
        if (montant > 0) parType[t].push({ montant, duree, personnes, marge, nom: c.nom || c.numero });
      });
    });

    const result = {};
    Object.entries(parType).forEach(([type, data]) => {
      if (data.length === 0) return;
      const montants = data.map(d => d.montant).sort((a, b) => a - b);
      const durees = data.map(d => d.duree).filter(d => d > 0).sort((a, b) => a - b);
      const personnes = data.map(d => d.personnes).filter(p => p > 0);
      const marges = data.map(d => d.marge).filter(m => m !== null && !isNaN(m));
      const median = arr => arr.length > 0 ? arr[Math.floor(arr.length / 2)] : null;
      const avg = arr => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

      result[type] = {
        nbChantiers: data.length,
        montant: { min: Math.min(...montants), max: Math.max(...montants), median: median(montants), avg: avg(montants) },
        duree: durees.length > 0 ? { min: Math.min(...durees), max: Math.max(...durees), avg: Math.round(avg(durees)) } : null,
        personnes: personnes.length > 0 ? { avg: Math.round(avg(personnes) * 10) / 10 } : null,
        marge: marges.length > 0 ? { avg: Math.round(avg(marges) * 10) / 10 } : null,
        meilleur: data.filter(d => d.marge !== null).sort((a, b) => (b.marge || 0) - (a.marge || 0))[0] || null,
      };
    });
    return result;
  }, [chantiers, devis, parametres, pointages]);

  const typesDisponibles = typesTravaux.filter(t => stats[t.nom]);
  // Auto-sélectionne le premier type avec données si aucun sélectionné
  const typeActif = typeSelectionne || (typesDisponibles[0]?.nom) || '';
  const suggestionActive = stats[typeActif];

  if (!ouvert) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setOuvert(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: V1.bleuFond, border: `1px solid ${V1.bleu}33`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Sparkles size={16} color={V1.bleu} />
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: V1.bleu }}>Assistant Devis IA</div>
            <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 1 }}>
              {Object.keys(stats).length > 0
                ? `${Object.keys(stats).length} type(s) de travaux analysés — cliquez pour des suggestions basées sur votre historique`
                : 'Pas encore de chantiers terminés — suggestions disponibles après vos premiers chantiers clôturés'}
            </div>
          </div>
          <ChevronDown size={16} color={V1.bleu} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20, background: V1.bleuFond, border: `1px solid ${V1.bleu}2e`, borderRadius: 14, padding: '18px 20px' }} data-testid="assistant-devis-ia">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Sparkles size={16} color={V1.bleu} />
          <span style={{ fontWeight: 800, fontSize: 14, color: V1.marine }}>Assistant Devis IA</span>
          <span style={{ fontSize: 11, background: V1.carte, color: V1.bleu, border: `1px solid ${V1.bleu}33`, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
            Basé sur {Object.values(stats).reduce((s, v) => s + v.nbChantiers, 0)} chantier(s) terminé(s)
          </span>
        </div>
        <button onClick={() => setOuvert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V1.texteMuted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}>
          <ChevronUp size={14} /> Réduire
        </button>
      </div>

      {Object.keys(stats).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
          Aucun chantier terminé dans votre historique. Les suggestions apparaîtront après vos premiers chantiers clôturés.
        </div>
      ) : (
        <>
          {/* Sélecteur de type */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: V1.bleu, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Type de travaux à analyser</label>
            <select
              value={typeActif}
              onChange={e => setTypeSelectionne(e.target.value)}
              style={{ ...DS.input, borderColor: V1.separation, background: V1.carte }}
            >
              {typesDisponibles.map(t => (
                <option key={t.nom} value={t.nom}>{t.nom} ({stats[t.nom].nbChantiers} chantier{stats[t.nom].nbChantiers > 1 ? 's' : ''})</option>
              ))}
              {typesTravaux.filter(t => !stats[t.nom]).map(t => (
                <option key={t.nom} value={t.nom} disabled>{t.nom} (aucun historique)</option>
              ))}
            </select>
          </div>

          {suggestionActive && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Stats */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: V1.texteMuted, textTransform: 'uppercase', marginBottom: 10 }}>Statistiques historiques</div>
                <StatBarre
                  label="Montant HT médian"
                  val={suggestionActive.montant.median}
                  min={suggestionActive.montant.min}
                  max={suggestionActive.montant.max}
                  couleur={V1.ok} unite=" CHF"
                />
                {suggestionActive.duree && (
                  <StatBarre
                    label="Durée moyenne"
                    val={suggestionActive.duree.avg}
                    min={suggestionActive.duree.min}
                    max={suggestionActive.duree.max}
                    couleur={V1.bleu} unite="j"
                  />
                )}
                {suggestionActive.marge && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: V1.texteMuted }}>Marge nette réelle moyenne</div>
                    <div style={{ ...mono(20, suggestionActive.marge.avg >= SEUILS.margeRentable ? V1.ok : suggestionActive.marge.avg >= SEUILS.margeLimite ? V1.warn : V1.danger, 700), marginTop: 2 }}>
                      {suggestionActive.marge.avg >= 0 ? '+' : ''}{suggestionActive.marge.avg}%
                    </div>
                  </div>
                )}
                {suggestionActive.meilleur && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(30,138,76,0.08)', border: `1px solid ${V1.ok}33`, borderRadius: 8, fontSize: 11, color: V1.ok }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Award size={12} color={V1.ok} /> Meilleur : {suggestionActive.meilleur.nom} — marge {Number.isFinite(suggestionActive.meilleur.marge) ? Math.round(suggestionActive.meilleur.marge * 10) / 10 : '—'}%</span>
                  </div>
                )}
              </div>

              {/* Suggestions à appliquer */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: V1.texteMuted, textTransform: 'uppercase', marginBottom: 10 }}>Appliquer au devis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    {
                      label: 'Montant HT médian',
                      val: Math.round(suggestionActive.montant.median),
                      valStr: `CHF ${fmtN(Math.round(suggestionActive.montant.median))}`,
                      action: () => onApply({ montantHT: String(Math.round(suggestionActive.montant.median)) }),
                      champ: 'montantHT',
                      current: parseFloat(form.montantHT),
                    },
                    ...(suggestionActive.duree ? [{
                      label: 'Durée moyenne',
                      val: suggestionActive.duree.avg,
                      valStr: `${suggestionActive.duree.avg} jours`,
                      action: () => onApply({ dureeEstimee: String(suggestionActive.duree.avg) }),
                      champ: 'dureeEstimee',
                      current: parseFloat(form.dureeEstimee),
                    }] : []),
                    ...(suggestionActive.personnes ? [{
                      label: 'Nb personnes',
                      val: suggestionActive.personnes.avg,
                      valStr: `${suggestionActive.personnes.avg} pers.`,
                      action: () => onApply({ nombrePersonnes: String(Math.round(suggestionActive.personnes.avg)) }),
                      champ: 'nombrePersonnes',
                      current: parseFloat(form.nombrePersonnes),
                    }] : []),
                  ].map(item => {
                    const dejaApplique = item.current === item.val;
                    return (
                      <div key={item.champ} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: V1.carte, border: `1px solid ${dejaApplique ? V1.ok + '66' : V1.separation}`, borderRadius: 8, padding: '8px 12px' }}>
                        <div>
                          <div style={{ fontSize: 11, color: V1.texteMuted }}>{item.label}</div>
                          <div style={{ ...mono(13, V1.texte, 700) }}>{item.valStr}</div>
                        </div>
                        <button
                          onClick={item.action}
                          disabled={dejaApplique}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: dejaApplique ? V1.ok + '18' : V1.bleu, color: dejaApplique ? V1.ok : '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: dejaApplique ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                          {dejaApplique ? <><Check size={11} /> Appliqué</> : 'Appliquer'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>
                  Fourchette : CHF {fmtN(Math.round(suggestionActive.montant.min))} – {fmtN(Math.round(suggestionActive.montant.max))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
