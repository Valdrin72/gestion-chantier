import { CLES_REPRISE, lireMarqueur, empreinte } from './repriseLocale';
// Liste blanche EXPLICITE des clés effacées à la déconnexion (jamais d'effacement par préfixe).
// Uniquement les copies locales de données DÉJÀ enregistrées sur le serveur (blob Supabase).
// Les trois anciennes clés migrées ne sont effacées que si leur contenu actuel est confirmé.
// Les autres données propres au navigateur sont CONSERVÉES (cyna_chat_history,
// cyna_actions, cyna_agents_*, cyna-alertes-v1, cyna_notifs_lues…),
// ainsi que les préférences et les copies de secours (cyna_sauvegarde_en_echec_*, cyna_sauvegarde_rejetee*).
// cyna_pointages n'est plus écrit aujourd'hui, mais une ancienne version a pu le laisser.
export const CLES_A_EFFACER = ['cyna_chantiers', 'cyna_devis', 'cyna_factures', 'cyna_clients', 'cyna_parametres', 'cyna_pointages'];
export function effacerCachesLocaux(userId) {
  for (const cle of CLES_A_EFFACER) { try { localStorage.removeItem(cle); } catch {} }
  if (!userId) return;
  const marqueur = lireMarqueur(userId);
  for (const [cle, nom] of Object.entries(CLES_REPRISE)) {
    try { if (marqueur[cle] === empreinte(localStorage.getItem(nom))) localStorage.removeItem(nom); } catch {}
  }
}
