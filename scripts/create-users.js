/**
 * CYNA — Création des 3 comptes utilisateurs Supabase
 *
 * Usage :
 *   node scripts/create-users.js
 *
 * Prérequis :
 *   Ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url  = process.env.REACT_APP_SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('\n❌  Variables manquantes dans .env.local');
  console.error('   REACT_APP_SUPABASE_URL      =', url ? '✓' : '❌ manquant');
  console.error('   SUPABASE_SERVICE_ROLE_KEY   =', key ? '✓' : '❌ manquant');
  console.error('\n   Ajoute SUPABASE_SERVICE_ROLE_KEY=<ta clé> dans .env.local\n');
  process.exit(1);
}

// Client admin (bypass RLS, peut créer des users sans confirmation email)
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Les 3 utilisateurs CYNA ────────────────────────────────────────────────
// ⚠️  SÉCURITÉ : ne jamais committer de vrais mots de passe ici.
// Définir les variables d'environnement dans .env.local avant de lancer le script :
//   CYNA_PWD_DIRECTION=<mot-de-passe-fort>
//   CYNA_PWD_CONDUCTEUR=<mot-de-passe-fort>
//   CYNA_PWD_ADMINISTRATIF=<mot-de-passe-fort>
const UTILISATEURS = [
  {
    email:    'directeur@cyna-ge.ch',
    password: process.env.CYNA_PWD_DIRECTION     || '[CHANGEZ-CE-MOT-DE-PASSE]',
    role:     'direction',
    nom:      'Directeur',
  },
  {
    email:    'chantier@cyna-ge.ch',
    password: process.env.CYNA_PWD_CONDUCTEUR    || '[CHANGEZ-CE-MOT-DE-PASSE]',
    role:     'conducteur',
    nom:      'Chef de chantier',
  },
  {
    email:    'bureau@cyna-ge.ch',
    password: process.env.CYNA_PWD_ADMINISTRATIF || '[CHANGEZ-CE-MOT-DE-PASSE]',
    role:     'administratif',
    nom:      'Bureau',
  },
];

async function creerUtilisateur(u) {
  const { data, error } = await supabase.auth.admin.createUser({
    email:             u.email,
    password:          u.password,
    email_confirm:     true,          // confirme l'email directement, pas besoin de cliquer un lien
    user_metadata:     { role: u.role, nom: u.nom },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`  ⚠️  ${u.nom} (${u.email}) — existe déjà, mise à jour du rôle...`);
      // Met à jour le rôle si le user existe déjà
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find(usr => usr.email === u.email);
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, {
          user_metadata: { role: u.role, nom: u.nom }
        });
        console.log(`  ✅  Rôle mis à jour : ${u.role}`);
      }
    } else {
      console.error(`  ❌  ${u.nom} — ${error.message}`);
    }
  } else {
    console.log(`  ✅  ${u.nom} créé (${u.email}) — rôle: ${u.role}`);
  }
}

async function main() {
  console.log('\n🔧  Création des utilisateurs CYNA...\n');

  for (const u of UTILISATEURS) {
    await creerUtilisateur(u);
  }

  console.log('\n✅  Terminé !');
  console.log('\n📋  Comptes créés :');
  UTILISATEURS.forEach(u => {
    console.log(`   ${u.nom.padEnd(20)} ${u.email}`);
  });
  console.log('\n⚠️  Note : Les mots de passe sont lus depuis les variables d\'environnement CYNA_PWD_*.');
  console.log('   Modifiez-les depuis l\'application Supabase après la première connexion.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
