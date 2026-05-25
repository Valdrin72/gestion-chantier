import React, { useState } from 'react';
import useAuth from './hooks/useAuth';
import { supabase } from './lib/supabase';

export default function Login({ onLogin }) {
  const { connecter, connecterDemo, erreur } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherMDP, setAfficherMDP] = useState(false);
  const [mdpOublie, setMdpOublie] = useState(false);
  const [msgReinit, setMsgReinit] = useState('');

  const canSubmit = !chargement && !!email && !!motDePasse;

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
      background: '#f0f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Dot pattern overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(#dce4ef 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={`${process.env.PUBLIC_URL}/logo-cyna.png`}
            alt="CYNA"
            style={{ height: '44px', width: 'auto', objectFit: 'contain', marginBottom: '10px' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ color: '#7c8fa1', fontSize: '12px', letterSpacing: '0.4px', fontWeight: 500 }}>
            Entreprise du bâtiment · Genève
          </div>
        </div>

        {/* CARD */}
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '36px 32px',
          boxShadow: '0 4px 24px rgba(13,27,46,0.10), 0 1px 4px rgba(13,27,46,0.06)',
          border: '1px solid #dce4ef',
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0d1b2e' }}>Connexion</div>
            <div style={{ fontSize: '13px', color: '#7c8fa1', marginTop: '4px' }}>Accès réservé à l'équipe CYNA</div>
          </div>

          <form onSubmit={soumettre}>
            {/* EMAIL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.6px',
                color: '#7c8fa1', marginBottom: '6px',
              }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  color: '#a8b8c8', fontSize: '14px', pointerEvents: 'none',
                }}>✉</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                  style={{
                    width: '100%', padding: '10px 14px 10px 36px',
                    border: '1px solid #dce4ef',
                    borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#fff', color: '#0d1b2e',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#0d3d6e'; e.target.style.boxShadow = '0 0 0 3px rgba(13,61,110,0.10)'; }}
                  onBlur={e => { e.target.style.borderColor = '#dce4ef'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* MOT DE PASSE */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.6px',
                color: '#7c8fa1', marginBottom: '6px',
              }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  color: '#a8b8c8', fontSize: '14px', pointerEvents: 'none',
                }}>🔒</span>
                <input
                  type={afficherMDP ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%', padding: '10px 44px 10px 36px',
                    border: '1px solid #dce4ef',
                    borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#fff', color: '#0d1b2e',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#0d3d6e'; e.target.style.boxShadow = '0 0 0 3px rgba(13,61,110,0.10)'; }}
                  onBlur={e => { e.target.style.borderColor = '#dce4ef'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setAfficherMDP(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#a8b8c8', fontSize: '15px', padding: '4px',
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
                padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>⚠</span> {erreur}
              </div>
            )}

            {/* BOUTON */}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '13px',
                background: canSubmit ? '#0d3d6e' : '#cbd5e1',
                color: canSubmit ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                letterSpacing: '0.2px',
                boxShadow: canSubmit ? '0 2px 10px rgba(13,61,110,0.32)' : 'none',
                fontFamily: 'inherit',
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
                    background: 'none', border: 'none', color: '#0d3d6e',
                    fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: '#7c8fa1', marginBottom: '8px' }}>
                    Saisissez votre email ci-dessus puis cliquez sur le bouton.
                  </p>
                  <button
                    type="button"
                    onClick={demanderReinit}
                    disabled={chargement}
                    style={{
                      background: 'none', border: '1px solid #0d3d6e', color: '#0d3d6e',
                      borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                      cursor: chargement ? 'wait' : 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {chargement ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMdpOublie(false); setMsgReinit(''); }}
                    style={{
                      background: 'none', border: 'none', color: '#7c8fa1',
                      fontSize: '12px', cursor: 'pointer', marginLeft: '12px', fontFamily: 'inherit',
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

        {/* Demo mode */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            data-testid="demo-login"
            onClick={() => { connecterDemo(); if (onLogin) onLogin(); }}
            style={{
              background: 'none', border: '1px solid #cbd5e1', color: '#7c8fa1',
              borderRadius: '8px', padding: '8px 20px', fontSize: '12px',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.2px',
            }}
          >
            Continuer en mode demo
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '16px', color: '#a8b8c8', fontSize: '11px', letterSpacing: '0.3px' }}>
          CYNA SÀRL · Application sécurisée
        </div>
      </div>
    </div>
  );
}

export { };
