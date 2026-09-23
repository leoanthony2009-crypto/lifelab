// Runs db/migrations/*.sql (and db/demo_seed.sql with --demo) against NETLIFY_DATABASE_URL.
// Statements are executed one at a time (the Neon HTTP driver runs a single statement per call).
import { readFileSync, readdirSync } from 'node:fs';
import { neon } from '@netlify/neon';
const sql = neon();
const demo = process.argv.includes('--demo');
async function run(file) {
  const text = readFileSync(file, 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  const stmts = text.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const s of stmts) await sql.query(s);
  console.log('applied', file, '(' + stmts.length + ' statements)');
}
for (const f of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort()) await run('db/migrations/' + f);
if (demo) { console.log('seeding DEMONSTRATION DATA — NOT REAL PUPILS'); await run('db/demo_seed.sql'); }
console.log('done');
