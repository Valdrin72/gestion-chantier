require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase.from('devis').select('*');
  if (error) { console.error(error.message); return; }
  console.log(`${data.length} ligne(s) dans devis:`);
  data.forEach(r => {
    console.log(JSON.stringify({ id: r.id, user_id: r.user_id, numero: r.numero, data_keys: r.data ? Object.keys(r.data) : null }, null, 2));
  });
}
main().catch(console.error);
