// node-pg-migrate configuration
// Reads DATABASE_URL from environment; loads .env.local then falls back to .env
'use strict';

try { require('dotenv').config({ path: '.env.local' }); } catch (_) {}
if (!process.env.DATABASE_URL) {
  try { require('dotenv').config({ path: '.env' }); } catch (_) {}
}

/** @type {import('node-pg-migrate').RunnerOption} */
module.exports = {
  databaseUrl: process.env.DATABASE_URL || '',
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
};
