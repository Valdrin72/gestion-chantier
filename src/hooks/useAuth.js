import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Pages complètes — accès total SINAAP / SINATEC
const TOUTES_PAGES = [
  'dashboard', 'chantiers', 'clients', 'employes', 'devis', 'heures',
  'finances', 'planning', 'rapport', 'agents', 'parametres',
  'factures', 'statistiques', 'paiements', 'analyse', 'importpdf', 'metrage', 'photos',
];

const ROLE_PAGES = {
  sinaap: {
    id: 'sinaap',
    nom: 'SINAAP',
    icone: '◈',
    couleur: '#0d3d6e',
    pages: TOUTES_PAGES,
  },
  sinatec: {
    id: 'sinatec',
    nom: 'SINATEC',
    icone: '◆',
    couleur: '#1a5c8a',
    pages: TOUTES_PAGES,
  },
  // Alias rétrocompatibilité — rôle Supabase existant
  direction: {
    id: 'sinaap',
    nom: 'SINAAP',
    icone: '◈',
    couleur: '#0d3d6e',
    pages: TOUTES_PAGES,
  },
};

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const resolverProfil = useCallback((user) => {
    if (!user) return null;
    // app_metadata est réservé aux admins (non modifiable par l'utilisateur via l'API publique)
    // user_metadata NE DOIT PAS être utilisé pour les rôles : modifiable par tout utilisateur authentifié
    const roleRaw = user.app_metadata?.role;
    // Un seul point d'entrée : sinaap, sinatec, ou direction (alias)
    const role = ROLE_PAGES[roleRaw] ? roleRaw : 'sinaap';
    return ROLE_PAGES[role];
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setProfil(resolverProfil(s?.user));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setProfil(resolverProfil(s?.user));
    });

    return () => subscription.unsubscribe();
  }, [resolverProfil]);

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
    await supabase.auth.signOut();
  }, []);

  return { session, profil, loading, erreur, connecter, deconnecter };
}

function traduireErreur(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('Email not confirmed')) return 'Confirmez votre email avant de vous connecter.';
  if (msg.includes('Too many requests')) return 'Trop de tentatives. Attendez quelques minutes.';
  return 'Erreur de connexion. Réessayez.';
}

export { ROLE_PAGES };
