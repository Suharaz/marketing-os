/**
 * hash-password.ts
 * CLI helper: takes a plaintext password from argv and prints bcrypt hash (cost 10).
 *
 * Usage:
 *   npx tsx scripts/hash-password.ts mypassword
 *
 * Copy the output into your .env as ADMIN_PASSWORD_HASH=<hash>
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npx tsx scripts/hash-password.ts <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
});
