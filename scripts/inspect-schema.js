require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  for (const t of ['chantiers', 'devis', 'factures', 'clients']) {
    console.log(`\n📋  Table : ${t}`);
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) console.log('  ❌', error.message);
    else if (!data || data.length === 0) {
      console.log('  (vide — colonnes inconnues)');
      // Try insert to see columns
      const { error: e2 } = await supabase.from(t).insert({}).select();
      if (e2) console.log('  insert hint:', e2.message);
    } else {
      console.log('  colonnes :', Object.keys(data[0]).join(', '));
      console.log('  row:', JSON.stringify(data[0], null, 2).slice(0, 300));
    }
  }
}
main();
