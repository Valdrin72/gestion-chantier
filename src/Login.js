import React, { useState } from 'react';
import { C } from './donnees';

const PROFILS = [
  {
    id: 'direction',
    nom: 'Direction',
    icone: '👔',
    couleur: C.primaire,
    description: 'Accès complet à toutes les fonctionnalités',
    pages: ['dashboard', 'chantiers', 'devis', 'finances', 'clients', 'employes', 'planning', 'statistiques', 'qualite', 'parametres', 'rapport', 'analyse'],
  },
  {
    id: 'conducteur',
    nom: 'Conducteur de travaux',
    icone: '🦺',
    couleur: C.warning,
    description: 'Chantiers, planning, qualité et équipes',
    pages: ['dashboard', 'chantiers', 'employes', 'planning', 'qualite'],
  },
  {
    id: 'administratif',
    nom: 'Administratif',
    icone: '📋',
    couleur: C.info,
    description: 'Clients, devis, paiements et statistiques',
    pages: ['dashboard', 'clients', 'devis', 'finances', 'statistiques', 'rapport', 'analyse'],
    
  },
  {
    id: 'chef_equipe',
    nom: "Chef d'équipe",
    icone: '👷',
    couleur: C.secondaire,
    description: 'Accès à ses chantiers uniquement',
    pages: ['dashboard', 'chantiers', 'planning', 'qualite'],
  },
];

export default function Login({ onLogin }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{
      minHeight: '100vh', background: `linear-gradient(135deg, #3382c2 0%, #1a5a9a 50%, #0d3d6e 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>🏗️</div>
          <div style={{ color: 'white', fontSize: '36px', fontWeight: 'bold', letterSpacing: '4px' }}>CYNA</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginTop: '5px' }}>Entreprise du bâtiment · Genève</div>
        </div>

        {/* TITRE */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>Qui êtes-vous ?</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginTop: '5px' }}>Sélectionnez votre profil pour continuer</div>
        </div>

        {/* PROFILS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {PROFILS.map(profil => (
            <div key={profil.id}
              onClick={() => setSelected(profil.id)}
              style={{
                background: selected === profil.id ? 'white' : 'rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '18px 20px', cursor: 'pointer',
                border: `2px solid ${selected === profil.id ? profil.couleur : 'transparent'}`,
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '15px'
              }}>
              <div style={{
                width: '50px', height: '50px', borderRadius: '12px',
                background: selected === profil.id ? profil.couleur : 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0
              }}>
                {profil.icone}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: selected === profil.id ? profil.couleur : 'white' }}>
                  {profil.nom}
                </div>
                <div style={{ fontSize: '13px', color: selected === profil.id ? '#666' : 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                  {profil.description}
                </div>
              </div>
              {selected === profil.id && (
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: profil.couleur, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '14px' }}>✓</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* BOUTON CONNEXION */}
        <button
          onClick={() => {
            if (selected) {
              const profil = PROFILS.find(p => p.id === selected);
              onLogin(profil);
            }
          }}
          disabled={!selected}
          style={{
            width: '100%', marginTop: '25px', padding: '15px',
            background: selected ? C.secondaire : 'rgba(255,255,255,0.2)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontSize: '16px', fontWeight: 'bold', cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s'
          }}>
          {selected ? `✅ Continuer en tant que ${PROFILS.find(p => p.id === selected)?.nom}` : 'Sélectionnez un profil'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          Application CYNA v1.0 · Gestion de chantiers
        </div>
      </div>
    </div>
  );
}

export { PROFILS };