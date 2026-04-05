const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await db.query(sql);
  // eslint-disable-next-line no-console
  console.log('Schema initialized.');
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize schema:', err);
  process.exit(1);
});
