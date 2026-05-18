import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import useAuth from './hooks/useAuth';
import { supabase } from './lib/supabase';

export default function Login({ onLogin }) {
  const { connecter, erreur } = useAuth();
  const [email, setEmail]           = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherMDP, setAfficherMDP] = useState(false);
  const [mdpOublie, setMdpOublie]   = useState(false);
  const [msgReinit, setMsgReinit]   = useState('');

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
    if (!email) { setMsgReinit('Saisissez votre adresse email ci-dessus.'); return; }
    setChargement(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setChargement(false);
    if (error) {
      setMsgReinit("Erreur lors de l'envoi. Vérifiez votre email.");
    } else {
      setMsgReinit('Email de réinitialisation envoyé. Vérifiez votre boîte de réception.');
      setMdpOublie(false);
    }
  };

  const canSubmit = !chargement && email && motDePasse;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0b2d52 0%, #0d3d6e 40%, #0f4c88 70%, #1a5c9a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Subtle grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src={`${process.env.PUBLIC_URL}/logo-cyna.png`}
            alt="CYNA"
            style={{ height: '52px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.5px' }}>
            Entreprise du bâtiment · Genève
          </div>
        </div>

        {/* CARTE */}
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}>

          {/* Titre */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px' }}>
              Connexion
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: 400 }}>
              Accès réservé à l'équipe CYNA
            </div>
          </div>

          <form onSubmit={soumettre} noValidate>

            {/* EMAIL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} strokeWidth={2} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    color: '#0f172a',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                />
              </div>
            </div>

            {/* MOT DE PASSE */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} strokeWidth={2} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type={afficherMDP ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 40px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    color: '#0f172a',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
                />
                <button
                  type="button"
                  onClick={() => setAfficherMDP(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center',
                    borderRadius: '6px', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                  {afficherMDP ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* ERREUR */}
            {erreur && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px', padding: '11px 14px', marginBottom: '16px',
              }}>
                <AlertCircle size={15} strokeWidth={2} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>{erreur}</span>
              </div>
            )}

            {/* BOUTON CONNEXION */}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '13px',
                background: canSubmit
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                  : '#cbd5e1',
                color: canSubmit ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '11px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                letterSpacing: '0.2px',
                boxShadow: canSubmit ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              {chargement ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Connexion en cours…
                </span>
              ) : 'Se connecter'}
            </button>

            {/* MOT DE PASSE OUBLIÉ */}
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              {!mdpOublie ? (
                <button
                  type="button"
                  onClick={() => { setMdpOublie(true); setMsgReinit(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#3b82f6',
                    fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                    padding: '4px 8px', borderRadius: '6px', fontFamily: 'inherit',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#1d4ed8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3b82f6'}
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                    Saisissez votre email ci-dessus puis cliquez sur le bouton.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={demanderReinit}
                      disabled={chargement}
                      style={{
                        background: 'none', border: '1.5px solid #3b82f6', color: '#3b82f6',
                        borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                        cursor: chargement ? 'wait' : 'pointer', fontWeight: 600,
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      {chargement ? 'Envoi…' : 'Envoyer le lien'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMdpOublie(false); setMsgReinit(''); }}
                      style={{
                        background: 'none', border: '1.5px solid #e2e8f0', color: '#64748b',
                        borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {msgReinit && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '11px 14px',
                  background: msgReinit.startsWith('Email de') ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${msgReinit.startsWith('Email de') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  borderRadius: '10px',
                  textAlign: 'left',
                }}>
                  {msgReinit.startsWith('Email de')
                    ? <CheckCircle size={14} strokeWidth={2} style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }} />
                    : <AlertCircle size={14} strokeWidth={2} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                  }
                  <span style={{ color: msgReinit.startsWith('Email de') ? '#059669' : '#dc2626', fontSize: '13px', fontWeight: 500 }}>
                    {msgReinit}
                  </span>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '0.3px' }}>
          CYNA SÀRL · Application sécurisée
        </div>
      </div>

      {/* Spinner CSS */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
