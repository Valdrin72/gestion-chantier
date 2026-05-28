import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TOUTES_PAGES = [
  'dashboard', 'chantiers', 'clients', 'employes', 'devis', 'heures',
  'finances', 'planning', 'rapport', 'agents', 'parametres',
  'factures', 'statistiques', 'paiements', 'analyse', 'importpdf', 'metrage', 'photos',
  'calculs', 'alertes', 'pointages',
];

const ROLE_PAGES = {
  cyna: {
    id: 'cyna',
    nom: 'CYNA',
    icone: '◈',
    couleur: '#0d3d6e',
    pages: TOUTES_PAGES,
  },
  cynatech: {
    id: 'cynatech',
    nom: 'CYNATECH',
    icone: '◆',
    couleur: '#1a5c8a',
    pages: TOUTES_PAGES,
  },
};

const DEMO_SESSION = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'demo@cyna.ch',
    app_metadata: { role: 'cyna' },
    user_metadata: {},
    aud: 'authenticated',
  },
};
const DEMO_FLAG = 'cyna_demo_mode';

export default function useAuth() {
  const isDemoMode = () => {
    try { return localStorage.getItem(DEMO_FLAG) === '1'; } catch { return false; }
  };

  const [session, setSession] = useState(() => isDemoMode() ? DEMO_SESSION : null);
  const [profil, setProfil] = useState(() => isDemoMode() ? ROLE_PAGES['cyna'] : null);
  const [loading, setLoading] = useState(() => !isDemoMode());
  const [erreur, setErreur] = useState(null);

  const resolverProfil = useCallback((user) => {
    if (!user) return null;
    // app_metadata réservé aux admins — non modifiable par l'utilisateur
    const roleRaw = user.app_metadata?.role;
    // Point d'entrée unique : cyna ou cynatech. Tout autre rôle → cyna par défaut.
    const role = ROLE_PAGES[roleRaw] ? roleRaw : 'cyna';
    return ROLE_PAGES[role];
  }, []);

  const [demoActive, setDemoActive] = useState(() => isDemoMode());

  useEffect(() => {
    if (demoActive) return; // Demo mode : skip Supabase auth
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (isDemoMode()) return; // Demo mode activated while loading
      setSession(s);
      setProfil(resolverProfil(s?.user));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (isDemoMode()) return; // Demo mode activated
      setSession(s);
      setProfil(resolverProfil(s?.user));
    });

    return () => subscription.unsubscribe();
  }, [resolverProfil, demoActive]);

  const connecterDemo = useCallback(() => {
    try { localStorage.setItem(DEMO_FLAG, '1'); } catch {}
    setDemoActive(true);
    setSession(DEMO_SESSION);
    setProfil(ROLE_PAGES['cyna']);
    setLoading(false);
    setErreur(null);
  }, []);

  const connecter = useCallback(async (email, motDePasse) => {
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      setErreur(traduireErreur(error.message));
      return false;
    }
    return true;
  }, []);

  const deconnecter = useCallback(async () => {
    try { localStorage.removeItem(DEMO_FLAG); } catch {}
    if (!isDemoMode()) await supabase.auth.signOut();
    setSession(null);
    setProfil(null);
  }, []);

  return { session, profil, loading, erreur, connecter, connecterDemo, deconnecter };
}

function traduireErreur(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('Email not confirmed')) return 'Confirmez votre email avant de vous connecter.';
  if (msg.includes('Too many requests')) return 'Trop de tentatives. Attendez quelques minutes.';
  return 'Erreur de connexion. Réessayez.';
}

export { ROLE_PAGES };
