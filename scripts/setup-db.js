/**
 * CYNA — Création de la table user_data dans Supabase
 * Usage : node scripts/setup-db.js
 */

const path = require('path');
const os   = require('os');
const fs   = require('fs');
const https = require('https');

const PROJECT_REF = 'hzsgudmnxcvoxltzuriv';

// Lire le token Supabase CLI
const tokenPath = path.join(os.homedir(), '.supabase', 'access-token');
if (!fs.existsSync(tokenPath)) {
  console.error('\n❌  Token Supabase CLI introuvable.');
  console.error('   Lance d\'abord : npx supabase login\n');
  process.exit(1);
}
const token = fs.readFileSync(tokenPath, 'utf8').trim();

const SQL = `
-- Table principale : une ligne par utilisateur, contient toutes ses données
CREATE TABLE IF NOT EXISTS user_data (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  chantiers  jsonb       NOT NULL DEFAULT '[]',
  devis      jsonb       NOT NULL DEFAULT '[]',
  factures   jsonb       NOT NULL DEFAULT '[]',
  clients    jsonb       NOT NULL DEFAULT '[]',
  parametres jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data_own" ON user_data;
CREATE POLICY "user_data_own" ON user_data
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
`;

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path:     `/v1/projects/${PROJECT_REF}/database/query`,
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n🔧  Création de la table user_data...\n');
  try {
    await runSQL(SQL);
    console.log('✅  Table user_data créée avec RLS.\n');
    console.log('   Chaque utilisateur ne voit que ses propres données.');
    console.log('   Sync multi-appareils activé.\n');
  } catch (e) {
    console.error('❌  Erreur :', e.message);
    process.exit(1);
  }
}

main();
