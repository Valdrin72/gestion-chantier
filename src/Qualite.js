import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { C } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;
const inputStyle = DS.input;

const checklistsDefaut = {
  demarrage: [
    { id: 'd1', categorie: 'Préparation', texte: 'Plans et documents reçus et vérifiés' },
    { id: 'd2', categorie: 'Préparation', texte: 'Réunion de démarrage effectuée avec le client' },
    { id: 'd3', categorie: 'Préparation', texte: 'Matériaux commandés et confirmés' },
    { id: 'd4', categorie: 'Sécurité', texte: "EPI disponibles pour toute l'équipe" },
    { id: 'd5', categorie: 'Sécurité', texte: 'Zone de travail délimitée et signalisée' },
    { id: 'd6', categorie: 'Sécurité', texte: 'Accès sécurisé vérifié' },
    { id: 'd7', categorie: 'Protection', texte: 'Protection des zones adjacentes en place' },
    { id: 'd8', categorie: 'Protection', texte: 'Bâches de protection posées' },
    { id: 'd9', categorie: 'Matériaux', texte: 'Conformité des matériaux vérifiée' },
    { id: 'd10', categorie: 'Matériaux', texte: 'Quantités réceptionnées et contrôlées' },
  ],
  miParcours: [
    { id: 'm1', categorie: 'Mesures', texte: 'Vérification des mesures et niveaux' },
    { id: 'm2', categorie: 'Mesures', texte: 'Alignements et aplombs contrôlés' },
    { id: 'm3', categorie: 'Mesures', texte: 'Dimensions conformes aux plans' },
    { id: 'm4', categorie: 'Qualité', texte: 'Joints et assemblages conformes' },
    { id: 'm5', categorie: 'Qualité', texte: 'Fixations et ancrages vérifiés' },
    { id: 'm6', categorie: 'Qualité', texte: 'Étanchéité contrôlée si applicable' },
    { id: 'm7', categorie: 'Propreté', texte: 'Chantier propre et rangé' },
    { id: 'm8', categorie: 'Propreté', texte: 'Déchets évacués régulièrement' },
    { id: 'm9', categorie: 'Avancement', texte: 'Avancement conforme au planning' },
    { id: 'm10', categorie: 'Avancement', texte: 'Problèmes signalés et traités' },
  ],
  reception: [
    { id: 'r1', categorie: 'Finitions', texte: 'Finitions et joints parfaits' },
    { id: 'r2', categorie: 'Finitions', texte: 'Surfaces nettoyées et protégées' },
    { id: 'r3', categorie: 'Finitions', texte: 'Retouches effectuées si nécessaire' },
    { id: 'r4', categorie: 'Conformité', texte: 'Travaux conformes au devis' },
    { id: 'r5', categorie: 'Conformité', texte: 'Quantités posées vérifiées' },
    { id: 'r6', categorie: 'Conformité', texte: 'Documentation remise au client' },
    { id: 'r7', categorie: 'Nettoyage', texte: 'Nettoyage complet effectué' },
    { id: 'r8', categorie: 'Nettoyage', texte: 'Matériaux restants évacués' },
    { id: 'r9', categorie: 'Réception', texte: 'PV de réception signé par le client' },
    { id: 'r10', categorie: 'Réception', texte: 'Réserves notées et traitées' },
  ],
  securite: [
    { id: 's1', categorie: 'EPI', texte: 'Casques portés en permanence' },
    { id: 's2', categorie: 'EPI', texte: 'Chaussures de sécurité portées' },
    { id: 's3', categorie: 'EPI', texte: 'Gilets de visibilité portés' },
    { id: 's4', categorie: 'Électrique', texte: 'Sécurité électrique vérifiée' },
    { id: 's5', categorie: 'Électrique', texte: 'Câbles et outils en bon état' },
    { id: 's6', categorie: 'Électrique', texte: 'Tableau électrique sécurisé' },
    { id: 's7', categorie: 'Accès', texte: 'Échafaudages et échelles sécurisés' },
    { id: 's8', categorie: 'Accès', texte: 'Zones à risque balisées' },
    { id: 's9', categorie: 'Urgence', texte: 'Trousse de premiers secours disponible' },
    { id: 's10', categorie: 'Urgence', texte: "Numéros d'urgence affichés" },
  ],
};

const TYPES_CONTROLE = [
  { id: 'demarrage', label: 'Démarrage', couleur: C.info, items: checklistsDefaut.demarrage },
  { id: 'miParcours', label: 'Mi-parcours', couleur: C.warning, items: checklistsDefaut.miParcours },
  { id: 'reception', label: 'Réception', couleur: C.secondaire, items: checklistsDefaut.reception },
  { id: 'securite', label: 'Sécurité', couleur: C.danger, items: checklistsDefaut.securite },
];

export default function Qualite({ chantiers, setChantiers, qualiteData, setQualiteData }) {
  const [chantierSelectionne, setChantierSelectionne] = useState(null);
  const [typeActif, setTypeActif] = useState('demarrage');

  const getQualite = (chantierId, type) => qualiteData[`${chantierId}_${type}`] || {};

  const toggleItem = (chantierId, type, itemId) => {
    const key = `${chantierId}_${type}`;
    const actuel = qualiteData[key] || {};
    setQualiteData({ ...qualiteData, [key]: { ...actuel, [itemId]: !actuel[itemId] } });
  };

  const getScore = (chantierId, type) => {
    const items = TYPES_CONTROLE.find(t => t.id === type)?.items || [];
    const data = getQualite(chantierId, type);
    const coches = items.filter(item => data[item.id]).length;
    return { coches, total: items.length, pct: items.length > 0 ? Math.round((coches / items.length) * 100) : 0 };
  };

  const getScoreGlobal = (chantierId) => {
    const totaux = TYPES_CONTROLE.map(t => getScore(chantierId, t.id));
    const totalCoches = totaux.reduce((s, t) => s + t.coches, 0);
    const totalItems = totaux.reduce((s, t) => s + t.total, 0);
    return totalItems > 0 ? Math.round((totalCoches / totalItems) * 100) : 0;
  };

  const couleurScore = (pct) => pct >= 80 ? C.secondaire : pct >= 50 ? C.warning : C.danger;
  const getNotes = (chantierId) => qualiteData[`${chantierId}_notes`] || '';
  const setNotes = (chantierId, val) => setQualiteData({ ...qualiteData, [`${chantierId}_notes`]: val });

  const supprimerChantier = (e, c) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le chantier "${c.nom}" ? Cette action est irréversible.`)) return;
    const newQualiteData = { ...qualiteData };
    Object.keys(newQualiteData).filter(k => k.startsWith(`${c.id}_`)).forEach(k => delete newQualiteData[k]);
    setQualiteData(newQualiteData);
    setChantiers(chantiers.filter(ch => ch.id !== c.id));
  };

  if (chantierSelectionne) {
    const c = chantierSelectionne;
    const scoreGlobal = getScoreGlobal(c.id);
    const typeInfo = TYPES_CONTROLE.find(t => t.id === typeActif);
    const scoreType = getScore(c.id, typeActif);
    const data = getQualite(c.id, typeActif);

    const categories = {};
    typeInfo.items.forEach(item => {
      if (!categories[item.categorie]) categories[item.categorie] = [];
      categories[item.categorie].push(item);
    });

    return (
      <div>
        <button onClick={() => setChantierSelectionne(null)}
          style={{ ...DS.btnPrimary }}>
          ← Retour
        </button>

        <div style={{
            background: `linear-gradient(145deg, ${couleurScore(scoreGlobal)}12 0%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0.04) 100%)`,
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px',
            border: `1px solid ${couleurScore(scoreGlobal)}33`,
            borderLeft: `4px solid ${couleurScore(scoreGlobal)}`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.5), 0 0 32px ${couleurScore(scoreGlobal)}12`,
            position: 'relative', overflow: 'hidden',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title-main" style={{ fontSize: 20, marginBottom: 4 }}>{c.nom}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>{c.ville} · {c.numero}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', fontWeight: 700, color: couleurScore(scoreGlobal) }}>{scoreGlobal}%</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Score qualité global</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap' }}>
            {TYPES_CONTROLE.map(t => {
              const s = getScore(c.id, t.id);
              return (
                <div key={t.id} style={{
                    flex: 1,
                    background: typeActif === t.id
                      ? `linear-gradient(145deg, ${t.couleur}18 0%, ${t.couleur}08 100%)`
                      : 'rgba(255,255,255,0.025)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: '12px', padding: '12px', textAlign: 'center',
                    border: `1px solid ${typeActif === t.id ? t.couleur + '55' : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: typeActif === t.id ? `0 0 20px ${t.couleur}22, 0 4px 12px rgba(0,0,0,0.3)` : 'none',
                    cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onClick={() => setTypeActif(t.id)}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: couleurScore(s.pct) }}>{s.pct}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.coches}/{s.total} points</div>
                  <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.09)', borderRadius: '10px', height: '6px' }}>
                    <div style={{ background: `linear-gradient(90deg, #3b82f6, #6366f1)`, width: `${s.pct}%`, height: '6px', borderRadius: '10px', boxShadow: '0 0 6px rgba(59,130,246,0.4)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={carteStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="ds-card-title" style={{ margin: 0 }}>{typeInfo.label}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TYPES_CONTROLE.map(t => (
                <button key={t.id} onClick={() => setTypeActif(t.id)} style={{
                  background: typeActif === t.id ? t.couleur + 'cc' : 'rgba(255,255,255,0.04)',
                  color: typeActif === t.id ? 'white' : t.couleur,
                  border: `1px solid ${typeActif === t.id ? t.couleur + '80' : t.couleur + '44'}`,
                  padding: '6px 16px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '13px', transition: 'all 0.18s'
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Progression</span>
              <span style={{ fontWeight: 'bold', color: couleurScore(scoreType.pct) }}>{scoreType.coches}/{scoreType.total} — {scoreType.pct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '10px', height: '10px' }}>
              <div style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)', width: `${scoreType.pct}%`, height: '10px', borderRadius: '10px', transition: 'width 0.3s', boxShadow: '0 0 10px rgba(59,130,246,0.45)' }} />
            </div>
          </div>

          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 600, color: typeInfo.couleur, marginBottom: '10px', fontSize: '13px', borderBottom: `1px solid ${typeInfo.couleur}44`, paddingBottom: '5px', letterSpacing: '0.3px' }}>
                {cat}
              </div>
              {items.map(item => (
                <div key={item.id} onClick={() => toggleItem(c.id, typeActif, item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer', background: data[item.id] ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.025)', border: `1px solid ${data[item.id] ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.2s' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${data[item.id] ? '#3b82f6' : 'var(--border)'}`, background: data[item.id] ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {data[item.id] && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '14px', color: data[item.id] ? '#10b981' : 'var(--text-primary)' }}>{item.texte}</span>
                  {data[item.id] && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#3b82f6' }}>Validé</span>}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={carteStyle}>
          <div className="ds-card-title">Notes & Observations</div>
          <textarea value={getNotes(c.id)} onChange={e => setNotes(c.id, e.target.value)}
            placeholder="Notez vos observations, problèmes rencontrés, actions correctives..."
            style={{ ...inputStyle, height: '120px', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={() => {
            const newData = { ...qualiteData };
            const key = `${c.id}_${typeActif}`;
            const allChecked = {};
            typeInfo.items.forEach(item => { allChecked[item.id] = true; });
            newData[key] = allChecked;
            setQualiteData(newData);
          }} style={{ ...DS.btnPrimary }}>
            Tout valider
          </button>
          <button onClick={() => {
            const newData = { ...qualiteData };
            newData[`${c.id}_${typeActif}`] = {};
            setQualiteData(newData);
          }} style={{ ...DS.btnDanger }}>
            Réinitialiser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title-main" style={{ marginBottom: 24 }}>Contrôle qualité</div>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px' }}>
        {[
          { label: 'Chantiers suivis', val: chantiers.length, couleur: '#10b981' },
          { label: 'Score moyen', val: `${chantiers.length > 0 ? Math.round(chantiers.reduce((s, c) => s + getScoreGlobal(c.id), 0) / chantiers.length) : 0}%`, couleur: '#10b981' },
          { label: 'À compléter', val: chantiers.filter(c => getScoreGlobal(c.id) < 80).length, couleur: C.warning },
          { label: 'Critiques', val: chantiers.filter(c => getScoreGlobal(c.id) < 50).length, couleur: C.danger },
        ].map(s => (
          <div key={s.label} className="premium-card" style={{
            background: `linear-gradient(145deg, ${s.couleur}14 0%, ${s.couleur}07 60%, rgba(255,255,255,0.02) 100%)`,
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            border: `1px solid ${s.couleur}2e`,
            borderRadius: 16, padding: '22px 24px',
            boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4)`,
            flex: 1, minWidth: 150, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${s.couleur}40 50%, transparent)` }} />
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: s.couleur + '22', border: `1px solid ${s.couleur}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 }}>{s.label.split(' ')[0]}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 6, letterSpacing: '-1px' }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label.substring(s.label.indexOf(' ') + 1)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chantiers.length === 0 ? (
          <div style={{ ...carteStyle, textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
            Aucun chantier — Créez des chantiers pour commencer le suivi qualité
          </div>
        ) : (
          chantiers.map(c => {
            const scoreGlobal = getScoreGlobal(c.id);
            const scores = TYPES_CONTROLE.map(t => ({ ...t, score: getScore(c.id, t.id) }));
            return (
              <div key={c.id} className="premium-card" style={{
                  background: `linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.038) 100%)`,
                  backdropFilter: 'blur(14px) saturate(1.6)',
                  WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
                  borderRadius: '14px',
                  boxShadow: 'var(--shadow-card)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderLeft: `4px solid ${couleurScore(scoreGlobal)}`,
                  padding: '20px', cursor: 'pointer',
                }}
                onClick={() => setChantierSelectionne(c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.nom}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>{c.ville} · {c.statut} · {c.numero}</div>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {scores.map(t => (
                        <div key={t.id} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t.label}</div>
                          <div style={{ fontSize: '15px', fontWeight: 'bold', color: couleurScore(t.score.pct) }}>{t.score.pct}%</div>
                          <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '10px', height: '4px', width: '60px', marginTop: '3px' }}>
                            <div style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)', width: `${t.score.pct}%`, height: '4px', borderRadius: '10px', boxShadow: '0 0 5px rgba(59,130,246,0.4)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginLeft: '20px' }}>
                    <div style={{ fontSize: '40px', fontWeight: 700, color: 'var(--text-primary)' }}>{scoreGlobal}%</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Score global</div>
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ background: couleurScore(scoreGlobal) + '18', color: couleurScore(scoreGlobal), padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                        {scoreGlobal >= 80 ? 'Bon' : scoreGlobal >= 50 ? 'À améliorer' : 'Critique'}
                      </span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#3b82f6' }}>Voir détail →</div>
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={(e) => supprimerChantier(e, c)}
                        style={{ ...DS.btnDanger, padding: '4px 10px', fontSize: '12px' }}
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
