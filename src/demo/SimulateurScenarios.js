import React, { useState } from 'react';
import { FlaskConical, RotateCcw, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SCENARIOS, construireScenario, donneesDemoStandard } from './scenariosDirecteur';

/**
 * Simulateur de scénarios — teste le "Directeur du matin" sur la démo.
 *
 * SÉCURITÉ : ne s'affiche et n'agit QU'EN MODE DÉMO (isDemo). En dehors, il retourne
 * null et ses handlers sont inertes — impossible de toucher les vraies données d'un
 * vrai compte. Chaque scénario est chargeable puis effaçable (réversible à 100%).
 */
export function appliquerJeu(jeu, setters) {
  // Ordre : clients/devis d'abord (référencés), puis chantiers/factures, puis params.
  setters.setClients(jeu.clients);
  setters.setDevis(jeu.devis);
  setters.setChantiers(jeu.chantiers);
  setters.setFactures(jeu.factures);
  setters.setPointages(jeu.pointages || []);
  setters.setParametres(jeu.parametres);
}

export default function SimulateurScenarios() {
  const {
    isDemo, setChantiers, setDevis, setFactures, setClients, setPointages, setParametres,
    afficherNotif = () => {}, naviguer = () => {},
  } = useApp();
  const [actif, setActif] = useState(null);

  // GARDE-FOU ABSOLU : hors démo, rien ne s'affiche et rien ne peut être écrit.
  if (!isDemo) return null;

  const setters = { setChantiers, setDevis, setFactures, setClients, setPointages, setParametres };

  const charger = (sc) => {
    if (!isDemo) return; // double garde
    const jeu = construireScenario(sc.id);
    if (!jeu) return;
    appliquerJeu(jeu, setters);
    setActif(sc.id);
    afficherNotif(`Scénario « ${sc.titre} » chargé — ouvre l'Accueil pour voir le Directeur.`, 'success');
  };

  const reinitialiser = () => {
    if (!isDemo) return; // double garde
    appliquerJeu(donneesDemoStandard(), setters);
    setActif(null);
    afficherNotif('Démo réinitialisée — plus aucune donnée de scénario.', 'success');
  };

  const card = { background: 'var(--dash-card, #fff)', border: '1px solid var(--dash-border, #e2e8f0)', borderRadius: 12, padding: 16 };

  return (
    <div style={{ ...card, borderLeft: '4px solid #8b5cf6', marginBottom: 20 }} data-testid="simulateur-scenarios">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FlaskConical size={16} color="#8b5cf6" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>Simulateur de scénarios — Directeur du matin</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 14, lineHeight: 1.5 }}>
        <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Données <strong>fictives</strong> (mode démo). Charge un scénario, va sur l'Accueil regarder le
          Directeur du matin, puis change ou réinitialise. Rien ne persiste après réinitialisation.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
        {SCENARIOS.map(sc => {
          const estActif = actif === sc.id;
          return (
            <div key={sc.id} style={{
              border: `1px solid ${estActif ? '#8b5cf6' : 'var(--dash-border, #e2e8f0)'}`,
              background: estActif ? '#8b5cf60d' : 'transparent',
              borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{sc.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>{sc.titre}</span>
                {estActif && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: '#8b5cf6', background: '#8b5cf618', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>Chargé</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>{sc.description}</div>
              <div style={{ fontSize: 11, color: '#8b5cf6', fontStyle: 'italic', lineHeight: 1.4 }}>Attendu : {sc.attendu}</div>
              <button
                onClick={() => charger(sc)}
                style={{ marginTop: 4, background: '#0d3d6e', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
              >Charger ce scénario</button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={reinitialiser}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
        ><RotateCcw size={13} /> Réinitialiser la démo</button>
        <button
          onClick={() => naviguer('dashboard')}
          style={{ background: 'transparent', color: '#0d3d6e', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
        >Ouvrir l'Accueil →</button>
      </div>
    </div>
  );
}
