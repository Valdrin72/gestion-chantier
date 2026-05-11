/**
 * Diagnostic : inspecte la ligne de stockage unique dans devis
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
  console.log('\n📊  Diagnostic stockage Supabase (nouvelle architecture)\n');

  // Toutes les lignes devis
  const { data: rows, error } = await supabase.from('devis').select('id, user_id, numero, data, created_at');
  if (error) { console.error('❌ devis:', error.message); return; }

  console.log(`Total lignes dans devis: ${rows.length}`);

  const storageRows = rows.filter(r => r.numero === MARKER);
  const devisRows   = rows.filter(r => r.numero !== MARKER);

  console.log(`  Lignes storage (${MARKER}): ${storageRows.length}`);
  console.log(`  Vrais devis: ${devisRows.length}`);

  storageRows.forEach(r => {
    const d = r.data || {};
    console.log(`\n  📦 Row storage — user: ${r.user_id.slice(0,8)}...`);
    console.log(`     chantiers: ${(d.chantiers||[]).length}`);
    console.log(`     devis:     ${(d.devis||[]).length}`);
    console.log(`     factures:  ${(d.factures||[]).length}`);
    console.log(`     clients:   ${(d.clients||[]).length}`);
    console.log(`     created:   ${r.created_at}`);
  });

  // Lignes factures
  const { data: frows, error: ferr } = await supabase.from('factures').select('id, user_id, numero, data');
  if (ferr) { console.error('❌ factures:', ferr.message); return; }
  const fStorage = frows.filter(r => r.numero === MARKER);
  console.log(`\nTotal lignes dans factures: ${frows.length} (storage: ${fStorage.length})`);

  // Vérification real-time publication
  console.log('\n🔍 Vérification real-time (via RPC pg_publication_tables)...');
  const { data: pub, error: perr } = await supabase.rpc('pg_publication_tables', {});
  if (perr) {
    console.log('   ⚠️  Impossible de vérifier via RPC:', perr.message);
    console.log('   → Vérifier manuellement dans Supabase: Database > Replication');
  } else {
    const inPub = pub?.find(t => t.tablename === 'devis');
    console.log(inPub ? '   ✅ devis est dans supabase_realtime' : '   ❌ devis N\'est PAS dans supabase_realtime');
  }

  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
