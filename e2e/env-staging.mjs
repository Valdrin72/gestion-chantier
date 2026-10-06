// Lecture et VALIDATION de la cible Supabase du test E2E — STAGING uniquement.
// Utilisé par playwright.config.mjs (avant de lancer le serveur) et par le test.
// Ne jamais afficher les valeurs lues (clé, identifiants).
import { readFileSync } from 'node:fs';

export const STAGING_ORIGIN = 'https://sabvmfqzxwtatvdonboq.supabase.co';
export const STAGING_HOST = new URL(STAGING_ORIGIN).hostname;
export const STAGING_REF = 'sabvmfqzxwtatvdonboq';
export const PROD_REF = 'hzsgudmnxcvoxltzuriv';

function lireEnv(fichier) {
  const env = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/** Renvoie { url, anon, email, motDePasse, email2?, motDePasse2? } ou lève une erreur SANS afficher de valeur.
 *  Le second compte (E2E_EMAIL_2 / E2E_PASSWORD_2) est facultatif : il sert au test d'isolation. */
export function chargerCibleStaging() {
  const local = lireEnv('.env.local');
  let origine = '';
  try { origine = new URL(local.REACT_APP_SUPABASE_URL || '').origin; } catch {}
  // Égalité EXACTE de l'origine (pas une recherche de sous-chaîne).
  if (origine !== STAGING_ORIGIN) throw new Error('ARRÊT : .env.local ne pointe pas exactement vers la base staging attendue.');
  if (!local.REACT_APP_SUPABASE_ANON_KEY) throw new Error('ARRÊT : clé anonyme staging absente de .env.local.');
  const test = lireEnv('.env.test.local');
  if (!test.E2E_EMAIL || !test.E2E_PASSWORD) throw new Error('ARRÊT : E2E_EMAIL / E2E_PASSWORD absents de .env.test.local.');
  return {
    url: STAGING_ORIGIN, anon: local.REACT_APP_SUPABASE_ANON_KEY, email: test.E2E_EMAIL, motDePasse: test.E2E_PASSWORD,
    email2: test.E2E_EMAIL_2 || null, motDePasse2: test.E2E_PASSWORD_2 || null,
  };
}

/** Destinations réseau autorisées pour le navigateur : l'app locale et la base staging. */
export function destinationAutorisee(adresse) {
  let u;
  try { u = new URL(adresse); } catch { return false; }
  if (['data:', 'blob:', 'about:'].includes(u.protocol)) return true;
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  return u.hostname === STAGING_HOST;
}
