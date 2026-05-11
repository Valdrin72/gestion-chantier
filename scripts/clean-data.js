require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log('\n🧹  Nettoyage des données test...\n');
  for (const t of ['chantiers', 'devis', 'factures', 'clients']) {
    const { error, count } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000').select('*', { count: 'exact', head: true });
    if (error) console.log(`   ${t.padEnd(10)} ❌ ${error.message}`);
    else console.log(`   ${t.padEnd(10)} ✅ ${count ?? 0} lignes supprimées`);
  }
  console.log('');
}
main();
