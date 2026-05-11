require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  // Supprimer les lignes devis avec numero IS NULL (vieilles lignes)
  const { error } = await supabase.from('devis').delete().is('numero', null);
  if (error) console.error('❌', error.message);
  else console.log('✅ Lignes devis avec numero=null supprimées');

  const { data } = await supabase.from('devis').select('id, numero');
  console.log(`État final devis: ${data?.length || 0} lignes`);
  data?.forEach(r => console.log(`  ${r.id} numero=${r.numero}`));
}
main().catch(console.error);
