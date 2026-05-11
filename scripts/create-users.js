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
// Modifie les mots de passe avant de lancer le script !
const UTILISATEURS = [
  {
    email:    'directeur@cyna-ge.ch',
    password: 'CynaDirecteur2024!',
    role:     'direction',
    nom:      'Directeur',
  },
  {
    email:    'chantier@cyna-ge.ch',
    password: 'CynaChantier2024!',
    role:     'conducteur',
    nom:      'Chef de chantier',
  },
  {
    email:    'bureau@cyna-ge.ch',
    password: 'CynaBureau2024!',
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
  console.log('\n📋  Identifiants créés :');
  UTILISATEURS.forEach(u => {
    console.log(`   ${u.nom.padEnd(20)} ${u.email.padEnd(30)} ${u.password}`);
  });
  console.log('\n⚠️  Note : Modifie les mots de passe depuis l\'application après la première connexion.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
