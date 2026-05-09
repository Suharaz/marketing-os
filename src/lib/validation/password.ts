// Shared password schema — single source of truth.
// Min 8 ký tự theo NIST 800-63B; max 72 BYTES là giới hạn của bcrypt
// (không phải 72 ký tự — Vietnamese có dấu chiếm nhiều byte hơn 1).
// Reuse ở: change-password API, reset-password API, create-member, UI forms.

import { z } from 'zod';

const MAX_BCRYPT_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .refine(
    (v) => Buffer.byteLength(v, 'utf8') <= MAX_BCRYPT_BYTES,
    `Mật khẩu tối đa ${MAX_BCRYPT_BYTES} bytes (~72 ký tự ASCII hoặc ~24 ký tự tiếng Việt có dấu)`
  );
