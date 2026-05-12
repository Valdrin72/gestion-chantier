import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ROLE_PAGES = {
  direction: {
    id: 'direction',
    nom: 'Direction',
    icone: '◈',
    couleur: '#3382c2',
    pages: ['dashboard', 'chantiers', 'devis', 'heures', 'finances', 'planning', 'rapport', 'agents', 'parametres', 'clients'],
  },
  conducteur: {
    id: 'conducteur',
    nom: 'Chef de chantier',
    icone: '⚒',
    couleur: '#e67e22',
    pages: ['dashboard', 'chantiers', 'heures', 'planning'],
  },
  administratif: {
    id: 'administratif',
    nom: 'Bureau',
    icone: '📋',
    couleur: '#27ae60',
    pages: ['dashboard', 'devis', 'finances', 'rapport'],
  },
};

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const resolverProfil = useCallback((user) => {
    if (!user) return null;
    const ROLES_AUTORISES = ['direction', 'conducteur', 'administratif'];
    const roleRaw = user.user_metadata?.role;
    // Protection contre l'élévation de rôle : si le rôle n'est pas dans la liste
    // des rôles connus, on replie sur 'conducteur' (le moins privilégié).
    const role = ROLES_AUTORISES.includes(roleRaw) ? roleRaw : 'conducteur';
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
