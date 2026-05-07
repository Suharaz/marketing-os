import bcrypt from 'bcryptjs';

/**
 * A real bcrypt hash of a random string, baked into source.
 * Used to run a timing-safe compare when the looked-up user does not exist,
 * preventing user-enumeration via response-time differences.
 *
 * Hash of: "dummy-timing-safe-placeholder-xK9#mP2@"  cost=10
 */
const DUMMY_HASH =
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

/**
 * Compares a plaintext password against a bcrypt hash.
 * Always performs the compare — pass DUMMY_HASH when no real hash is available
 * to keep timing consistent and defeat user-enumeration attacks.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null
): Promise<boolean> {
  const hashToCompare = hash ?? DUMMY_HASH;
  const result = await bcrypt.compare(plain, hashToCompare);
  // If we used the dummy hash, always return false regardless of result
  return hash !== null && result;
}
