import { useState, useEffect, useCallback, useRef } from 'react';
import { effacerCachesLocaux } from '../utils/cachesLocaux';
import { supabase, lienRecuperationMotDePasse } from '../lib/supabase';

const TOUTES_PAGES = [
  'dashboard', 'chantiers', 'clients', 'employes', 'devis', 'heures',
  'finances', 'planning', 'rapport', 'agents', 'parametres',
  'factures', 'statistiques', 'paiements', 'analyse', 'photos',
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

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_SESSION = {
  user: {
    id: DEMO_USER_ID,
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
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const deconnexionEnCoursRef = useRef(false);
  const [recuperationMotDePasse, setRecuperationMotDePasse] = useState(lienRecuperationMotDePasse);
  const terminerRecuperation = () => setRecuperationMotDePasse(false);
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
      if (isDemoMode() || deconnexionEnCoursRef.current) return; // Demo mode activated
      if (_event === 'PASSWORD_RECOVERY') setRecuperationMotDePasse(true);
      if (!s) setRecuperationMotDePasse(false);
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
    try { localStorage.removeItem(DEMO_FLAG); } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      setErreur(traduireErreur(error.message));
      return false;
    }
    return true;
  }, []);

  const deconnecter = useCallback(async () => {
    if (deconnexionEnCoursRef.current) return { ok: false };
    deconnexionEnCoursRef.current = true;
    try {
      if (isDemoMode()) {
        try { localStorage.removeItem(DEMO_FLAG); } catch {}
        setDemoActive(false); setSession(null); setProfil(null);
        setRecuperationMotDePasse(false);
        return { ok: true };
      }
      try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('signOut', error);
      } catch (error) { console.error('signOut', error); }
      const { data, error } = await supabase.auth.getSession();
      if (error || data?.session !== null) return { ok: false };
      effacerCachesLocaux(sessionRef.current?.user?.id);
      setSession(null); setProfil(null); setRecuperationMotDePasse(false);
      return { ok: true };
    } catch (error) {
      console.error('signOut session', error);
      return { ok: false };
    } finally { deconnexionEnCoursRef.current = false; }
  }, []);

  return { session, profil, loading, erreur, recuperationMotDePasse, terminerRecuperation, connecter, connecterDemo, deconnecter };
}

export { ROLE_PAGES, DEMO_USER_ID };

function traduireErreur(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('Email not confirmed')) return 'Confirmez votre email avant de vous connecter.';
  if (msg.includes('Too many requests')) return 'Trop de tentatives. Attendez quelques minutes.';
  return 'Erreur de connexion. Réessayez.';
}

