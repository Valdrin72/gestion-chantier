import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
      background: 'linear-gradient(135deg, #0d1a2e 0%, #0d3d6e 50%, #1a1035 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Grille de fond subtile */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Orbe bleu gauche */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Orbe indigo droite */}
      <div style={{
        position: 'absolute', bottom: '-5%', right: '-5%',
        width: '420px', height: '420px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Orbe vert centre-haut */}
      <div style={{
        position: 'absolute', top: '20%', right: '15%',
        width: '280px', height: '280px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src={process.env.PUBLIC_URL + '/logo-cyna-tech.png'}
            alt="CYNA"
            style={{
              height: '56px', objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
              marginBottom: '10px',
            }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ color: 'white', fontSize: '32px', fontWeight: '800', letterSpacing: '6px', lineHeight: 1 }}>
            CYNA
          </div>
          <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: '13px', marginTop: '6px', letterSpacing: '1px' }}>
            SÀRL · Genève
          </div>
        </div>

        {/* CARTE GLASS */}
        <div style={{
          background: 'rgba(13,25,48,0.85)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          borderRadius: '20px',
          padding: '36px 32px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#f1f5f9' }}>Connexion</div>
            <div style={{ fontSize: '14px', color: 'rgba(148,163,184,0.8)', marginTop: '4px' }}>
              Accès réservé à l'équipe CYNA
            </div>
          </div>

          <form onSubmit={soumettre}>
            {/* EMAIL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: 'rgba(148,163,184,0.9)', marginBottom: '7px',
              }}>
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
                  width: '100%', padding: '12px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', fontSize: '15px', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
                  color: '#f1f5f9',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <style>{`input::placeholder { color: rgba(148,163,184,0.6) !important; }`}</style>
            </div>

            {/* MOT DE PASSE */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: 'rgba(148,163,184,0.9)', marginBottom: '7px',
              }}>
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
                    width: '100%', padding: '12px 44px 12px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', fontSize: '15px', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
                    color: '#f1f5f9',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAfficherMDP(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(148,163,184,0.7)', padding: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {afficherMDP ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* ERREUR */}
            {erreur && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#fca5a5', fontSize: '14px',
              }}>
                {erreur}
              </div>
            )}

            {/* BOUTON SUBMIT */}
            <button
              type="submit"
              disabled={chargement || !email || !motDePasse}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #4f46e5 100%)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '16px', fontWeight: '700',
                cursor: chargement ? 'wait' : ((!email || !motDePasse) ? 'not-allowed' : 'pointer'),
                transition: 'opacity 0.2s, box-shadow 0.2s',
                opacity: (chargement || !email || !motDePasse) ? 0.5 : 1,
                boxShadow: (chargement || !email || !motDePasse)
                  ? 'none'
                  : '0 4px 20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
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
                    background: 'none', border: 'none', color: '#60a5fa',
                    fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                  }}
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'rgba(148,163,184,0.8)', marginBottom: '8px' }}>
                    Saisissez votre email ci-dessus puis cliquez sur le bouton.
                  </p>
                  <button
                    type="button"
                    onClick={demanderReinit}
                    disabled={chargement}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(96,165,250,0.5)',
                      color: '#60a5fa',
                      borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                      cursor: chargement ? 'wait' : 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {chargement ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMdpOublie(false); setMsgReinit(''); }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(148,163,184,0.6)',
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
                  background: msgReinit.startsWith('Email de')
                    ? 'rgba(16,185,129,0.1)'
                    : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${msgReinit.startsWith('Email de')
                    ? 'rgba(16,185,129,0.3)'
                    : 'rgba(239,68,68,0.3)'}`,
                  borderRadius: '8px',
                  color: msgReinit.startsWith('Email de') ? '#6ee7b7' : '#fca5a5',
                  fontSize: '13px',
                }}>
                  {msgReinit}
                </div>
              )}
            </div>
          </form>
        </div>

        <div style={{
          textAlign: 'center', marginTop: '24px',
          color: 'rgba(255,255,255,0.3)', fontSize: '12px',
        }}>
          CYNA v2.0 · Application sécurisée
        </div>
      </div>
    </div>
  );
}

export { };
