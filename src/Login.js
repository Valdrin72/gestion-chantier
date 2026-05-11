import React, { useState } from 'react';
import useAuth from './hooks/useAuth';

export default function Login({ onLogin }) {
  const { connecter, erreur } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherMDP, setAfficherMDP] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    if (!email || !motDePasse) return;
    setChargement(true);
    const ok = await connecter(email.trim().toLowerCase(), motDePasse);
    setChargement(false);
    if (ok && onLogin) onLogin();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #3382c2 0%, #1a5a9a 50%, #0d3d6e 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: 'white', fontSize: '40px', fontWeight: 'bold', letterSpacing: '6px' }}>CYNA</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '6px' }}>
            Entreprise du bâtiment · Genève
          </div>
        </div>

        {/* CARTE */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e' }}>Connexion</div>
            <div style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>Accès réservé à l'équipe CYNA</div>
          </div>

          <form onSubmit={soumettre}>
            {/* EMAIL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
                style={{
                  width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#3382c2'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* MOT DE PASSE */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={afficherMDP ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px', border: '2px solid #e5e7eb',
                    borderRadius: '10px', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3382c2'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
                <button
                  type="button"
                  onClick={() => setAfficherMDP(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '16px', padding: '4px'
                  }}
                >
                  {afficherMDP ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* ERREUR */}
            {erreur && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '14px'
              }}>
                {erreur}
              </div>
            )}

            {/* BOUTON */}
            <button
              type="submit"
              disabled={chargement || !email || !motDePasse}
              style={{
                width: '100%', padding: '14px',
                background: chargement || !email || !motDePasse ? '#93c5fd' : '#3382c2',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '16px', fontWeight: 'bold', cursor: chargement ? 'wait' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {chargement ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          CYNA v2.0 · Application sécurisée
        </div>
      </div>
    </div>
  );
}

export { };
