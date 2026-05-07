// Next.js 16 instrumentation hook — stable, no experimental flag needed.
// Runs once when the server process starts (not on every request).
// Guards against Edge runtime: cron jobs require Node.js APIs.

export async function register(): Promise<void> {
  // Skip in Edge runtime — node-cron and pg require Node.js APIs
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { initCrons } = await import('./src/lib/cron/init');
  initCrons();
}
