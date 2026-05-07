import { Pool } from 'pg';

// Singleton pg Pool — shared across the entire Next.js process.
// In development, HMR recreates modules; globalThis caching prevents
// exhausting connection limits on hot reloads.

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Timezone của app — đảm bảo CURRENT_DATE / NOW() / to_char() đều trả về theo giờ VN.
// Nếu DATABASE_URL trỏ tới Postgres ở UTC, không set ở đây sẽ khiến các filter
// như `date < CURRENT_DATE` lệch +/- 1 ngày vào khoảng 17:00–24:00 giờ VN.
const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Set timezone qua startup `options` thay vì 'connect' event handler.
  // Lý do: handler chạy `client.query()` async → race với query đầu của user
  // → "client is already executing a query" warning ở pg@8+, sẽ thành error ở pg@9.
  // Option `-c timezone=...` được gửi cùng connect handshake, không race.
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    options: `-c timezone=${APP_TIMEZONE}`,
  });

  return pool;
}

export const db: Pool =
  globalThis.__pgPool ?? (globalThis.__pgPool = createPool());

// Graceful shutdown — only relevant in non-Next contexts (scripts, tests)
process.on('SIGTERM', () => {
  db.end().catch(console.error);
});
