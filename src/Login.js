import React, { useState } from 'react';
import useAuth from './hooks/useAuth';
import { supabase } from './lib/supabase';

export default function Login({ onLogin }) {
  const { connecter, erreur } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherMDP, setAfficherMDP] = useState(false);
  const [mdpOublie, setMdpOublie] = useState(false);
  const [msgReinit, setMsgReinit] = useState('');

  const soumettre = async (e) => {
    e.preventDefault();
    if (!email || !motDePasse) return;
    setChargement(true);
    const ok = await connecter(email.trim().toLowerCase(), motDePasse);
    setChargement(false);
    if (ok && onLogin) onLogin();
  };

  const demanderReinit = async (e) => {
    e.preventDefault();
    if (!email) {
      setMsgReinit('Saisissez votre adresse email ci-dessus.');
      return;
    }
    setChargement(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setChargement(false);
    if (error) {
      setMsgReinit('Erreur lors de l\'envoi. Vérifiez votre email.');
    } else {
      setMsgReinit('Email de réinitialisation envoyé. Vérifiez votre boîte de réception.');
      setMdpOublie(false);
    }
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

            {/* MOT DE PASSE OUBLIÉ */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              {!mdpOublie ? (
                <button
                  type="button"
                  onClick={() => { setMdpOublie(true); setMsgReinit(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#3382c2',
                    fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                  }}
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>
                    Saisissez votre email ci-dessus puis cliquez sur le bouton.
                  </p>
                  <button
                    type="button"
                    onClick={demanderReinit}
                    disabled={chargement}
                    style={{
                      background: 'none', border: '1px solid #3382c2', color: '#3382c2',
                      borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                      cursor: chargement ? 'wait' : 'pointer',
                    }}
                  >
                    {chargement ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMdpOublie(false); setMsgReinit(''); }}
                    style={{
                      background: 'none', border: 'none', color: '#888',
                      fontSize: '12px', cursor: 'pointer', marginLeft: '12px',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              )}
              {msgReinit && (
                <div style={{
                  marginTop: '10px', padding: '10px 14px',
                  background: msgReinit.startsWith('Email de') ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${msgReinit.startsWith('Email de') ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px', color: msgReinit.startsWith('Email de') ? '#16a34a' : '#dc2626',
                  fontSize: '13px',
                }}>
                  {msgReinit}
                </div>
              )}
            </div>
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
