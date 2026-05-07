// Encrypt/decrypt Page Access Tokens via Postgres pgcrypto.
// Using DB-side encryption avoids implementing AES in Node and leverages
// the pgcrypto extension already enabled in the schema (Phase 02).
//
// SECURITY: Never log the plaintext token, encrypted buffer, or ENCRYPTION_KEY.

import { db } from '@/lib/db';

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return key;
}

/**
 * Encrypt a plaintext access token using pgp_sym_encrypt (pgcrypto).
 * Returns the bytea Buffer to store in social_account.access_token_encrypted.
 */
export async function encryptToken(plain: string): Promise<Buffer> {
  const key = getEncryptionKey();
  const result = await db.query<{ enc: Buffer }>(
    `SELECT pgp_sym_encrypt($1::text, $2::text) AS enc`,
    [plain, key]
  );
  const enc = result.rows[0]?.enc;
  if (!enc) throw new Error('encryptToken: pgp_sym_encrypt returned no result');
  return enc;
}

/**
 * Decrypt a bytea Buffer back to the plaintext access token.
 * The `encrypted` argument must be the raw Buffer from Postgres (not a string).
 */
export async function decryptToken(encrypted: Buffer): Promise<string> {
  const key = getEncryptionKey();
  const result = await db.query<{ plain: string }>(
    `SELECT pgp_sym_decrypt($1::bytea, $2::text)::text AS plain`,
    [encrypted, key]
  );
  const plain = result.rows[0]?.plain;
  if (plain === undefined || plain === null) {
    throw new Error('decryptToken: pgp_sym_decrypt returned no result');
  }
  return plain;
}
