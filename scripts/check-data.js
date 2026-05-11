/**
 * CYNA — Diagnostic : vérifie ce qui est dans Supabase
 * Usage : node scripts/check-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Variables .env.local manquantes');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log('\n📊  Diagnostic des données Supabase\n');

  // Liste users
  const { data: { users } } = await supabase.auth.admin.listUsers();
  console.log(`👥  Utilisateurs : ${users.length}`);
  users.forEach(u => console.log(`   ${u.email.padEnd(30)} id=${u.id}`));

  // Pour chaque user, vérifie ses données
  for (const u of users) {
    console.log(`\n🔍  ${u.email}`);
    for (const table of ['chantiers', 'devis', 'factures', 'clients']) {
      const { data, error } = await supabase
        .from(table)
        .select('id, data, created_at')
        .eq('user_id', u.id);

      if (error) {
        console.log(`   ${table.padEnd(10)} ❌ ${error.message}`);
      } else if (!data || data.length === 0) {
        console.log(`   ${table.padEnd(10)} (vide)`);
      } else {
        data.forEach(row => {
          const items = row.data?.items;
          const nb = Array.isArray(items) ? items.length : '?';
          console.log(`   ${table.padEnd(10)} ${nb} items   (row ${row.id.slice(0,8)}...)`);
        });
      }
    }
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
