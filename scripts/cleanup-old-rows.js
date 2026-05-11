/**
 * Supprime les anciennes lignes (non-storage) dans devis et factures
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const MARKER = '__cyna_storage__';

async function main() {
  console.log('\n🧹  Nettoyage des anciennes lignes...\n');

  // Supprimer les devis qui ne sont PAS des storage rows
  const { data: oldDevis, error: e1 } = await supabase
    .from('devis').select('id, numero').neq('numero', MARKER);
  if (e1) { console.error('❌ select devis:', e1.message); }
  else {
    console.log(`   Vieux devis à supprimer: ${oldDevis.length}`);
    if (oldDevis.length > 0) {
      const ids = oldDevis.map(r => r.id);
      const { error: e2 } = await supabase.from('devis').delete().in('id', ids);
      if (e2) console.error('   ❌', e2.message);
      else console.log('   ✅ Supprimés');
    }
  }

  // Supprimer toutes les factures (anciennes lignes)
  const { data: oldFact, error: e3 } = await supabase.from('factures').select('id');
  if (e3) { console.error('❌ select factures:', e3.message); }
  else {
    console.log(`   Vieilles factures à supprimer: ${oldFact.length}`);
    if (oldFact.length > 0) {
      const ids = oldFact.map(r => r.id);
      const { error: e4 } = await supabase.from('factures').delete().in('id', ids);
      if (e4) console.error('   ❌', e4.message);
      else console.log('   ✅ Supprimées');
    }
  }

  // Vérification finale
  const { data: d1 } = await supabase.from('devis').select('id, numero');
  const { data: d2 } = await supabase.from('factures').select('id');
  console.log(`\n✅ État final: devis=${d1?.length || 0} lignes, factures=${d2?.length || 0} lignes`);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
