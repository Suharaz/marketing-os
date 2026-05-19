// Opaque pagination cursor — base64url(JSON.stringify(payload)).
// Client treats as black box; server decodes + validates shape per use site.

export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

export function decodeCursor<T>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
