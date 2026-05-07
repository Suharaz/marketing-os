import bcrypt from 'bcryptjs';

// Cost 10 = ~80ms/hash trên CPU thường — đủ chậm để chống brute force,
// đủ nhanh để không block server khi tạo user.
const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
