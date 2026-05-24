import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectTimerRef = React.useRef(null);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => setShowReconnected(false), 3000);
    };
    const goOffline = () => {
      setOnline(false);
      setShowReconnected(false);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: online ? '#10b981' : '#ef4444',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '7px 16px',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'background 0.3s',
    }}>
      {online
        ? <><Wifi size={14} /> Connexion rétablie — données synchronisées</>
        : <><WifiOff size={14} /> Hors ligne — les modifications seront synchronisées à la reconnexion</>
      }
    </div>
  );
}
