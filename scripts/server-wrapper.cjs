// Standalone server bootstrap that forces instrumentation to load in-process.
//
// Why: Next.js 16 + standalone + Turbopack build can fail to invoke
// instrumentation.register() at server start. We've observed in Coolify
// production (test-mkt2.taki.vn) that the container logs neither
// `[instrumentation] register() called` nor `[cron] 4 jobs scheduled`,
// meaning the hook never fires and node-cron is never armed.
//
// Workaround: require the compiled instrumentation module ourselves in the
// SAME process that runs server.js, before the Next server starts handling
// requests. node-cron schedules survive because they share the event loop.

'use strict';

const path = require('path');

const candidatePaths = [
  './instrumentation.js',
  './.next/server/instrumentation.js',
  path.join(__dirname, '..', 'instrumentation.js'),
  path.join(__dirname, '..', '.next', 'server', 'instrumentation.js'),
];

let loaded = false;
for (const p of candidatePaths) {
  try {
    const mod = require(p);
    const register = mod.register ?? mod.default?.register;
    if (typeof register === 'function') {
      console.log(`[server-wrapper] Loading instrumentation from ${p}`);
      Promise.resolve(register()).catch((err) =>
        console.error('[server-wrapper] instrumentation.register() threw:', err)
      );
      loaded = true;
      break;
    }
  } catch (err) {
    // MODULE_NOT_FOUND is expected for paths that don't exist — keep trying.
    if (err && err.code !== 'MODULE_NOT_FOUND') {
      console.warn(`[server-wrapper] Error loading ${p}:`, err.message);
    }
  }
}

if (!loaded) {
  console.warn(
    '[server-wrapper] No instrumentation module found — cron will NOT run. ' +
      `Tried: ${candidatePaths.join(', ')}`
  );
}

// Hand off to the standalone Next.js server. server.js is the entry point
// Next.js generates in `.next/standalone/`. It binds the HTTP listener and
// starts serving immediately — no need to await anything here.
require('./server.js');
