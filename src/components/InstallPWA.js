import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPWA() {
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    if (window.__pwaInstallPrompt) setShow(true);
    const handler = () => setShow(true);
    window.addEventListener('pwa-installable', handler);
    return () => window.removeEventListener('pwa-installable', handler);
  }, []);

  const installer = async () => {
    const prompt = window.__pwaInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { setInstalled(true); setShow(false); }
    window.__pwaInstallPrompt = null;
  };

  if (installed || !show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 20,
      background: '#ffffff',
      border: '1px solid #dce4ef',
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 999,
      boxShadow: '0 4px 16px rgba(13,27,46,0.12)',
      maxWidth: 300,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: '#e8f0f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Download size={15} style={{ color: '#0d3d6e' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0d1b2e' }}>Installer l'app</div>
        <div style={{ fontSize: 11, color: '#7c8fa1', marginTop: 1 }}>Accès rapide depuis l'écran d'accueil</div>
      </div>
      <button onClick={installer} style={{
        background: '#0d3d6e', color: '#fff', border: 'none', borderRadius: 7,
        padding: '5px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer',
        flexShrink: 0, fontFamily: 'inherit',
      }}>Installer</button>
      <button onClick={() => setShow(false)} style={{
        background: 'none', border: 'none', color: '#a8b8c8', cursor: 'pointer', padding: 2,
        flexShrink: 0,
      }}><X size={14} /></button>
    </div>
  );
}
