#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Migration Generator Script
 *
 * Generates the SupaSaaSy database migrations based on your configuration.
 * Run this script after updating your supasaasy.config.ts to regenerate migrations.
 *
 * Usage:
 *   deno task generate-migrations
 *   # or
 *   deno run --allow-read --allow-write scripts/generate-migrations.ts
 */

import { getMigrations } from 'supasaasy';
import config from '../supasaasy.config.ts';

const MIGRATION_FILE = 'supabase/migrations/00000000000001_supasaasy.sql';

async function main() {
  console.log('Generating SupaSaaSy migrations...');

  // Generate the SQL
  const sql = await getMigrations(config);

  // Write to file
  await Deno.writeTextFile(MIGRATION_FILE, sql);

  console.log(`✓ Migration file written: ${MIGRATION_FILE}`);
  console.log('\nNext steps:');
  console.log('  1. Review the generated migration file');
  console.log('  2. Apply migrations with: supabase db push --local');
  console.log('  3. Or reset the database with: supabase db reset');
}

main().catch((error) => {
  console.error('Error generating migrations:', error);
  Deno.exit(1);
});
