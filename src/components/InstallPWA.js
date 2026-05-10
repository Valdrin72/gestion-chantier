import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPWA() {
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Déjà installée ?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    // Prompt disponible
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
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#1e40af', color: '#fff', borderRadius: 14, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(30,64,175,0.45)', maxWidth: 340, width: 'calc(100% - 40px)',
    }}>
      <Download size={20} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Installer CYNA sur ce téléphone</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Accès rapide depuis l'écran d'accueil</div>
      </div>
      <button onClick={installer} style={{
        background: '#fff', color: '#1e40af', border: 'none', borderRadius: 8,
        padding: '6px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
      }}>Installer</button>
      <button onClick={() => setShow(false)} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4,
      }}><X size={16} /></button>
    </div>
  );
}
