// Next.js instrumentation hook — runs once when the server process starts
// (not on every request). Bootstraps node-cron scheduler.
//
// Runtime guard: only skip if EXPLICITLY edge — undefined/empty NEXT_RUNTIME
// has been observed in some Coolify/standalone deployments and would
// otherwise silently disable cron entirely.

export async function register(): Promise<void> {
  console.log(
    `[instrumentation] register() called (NEXT_RUNTIME=${process.env.NEXT_RUNTIME ?? 'unset'})`
  );

  if (process.env.NEXT_RUNTIME === 'edge') {
    console.log('[instrumentation] edge runtime — skip cron init');
    return;
  }

  try {
    const { initCrons } = await import('./src/lib/cron/init');
    initCrons();
  } catch (err) {
    // Surface the failure loudly — silent failure is what got us here.
    console.error('[instrumentation] Cron init failed:', err);
  }
}
