// Parses URLSearchParams (or Next.js searchParams) into a typed LibraryFilter.
// All validation happens here — downstream code receives clean, typed values.

export type LibrarySortT = 'recent' | 'er' | 'reach';

export interface LibraryFilter {
  q?: string;
  platforms?: string[];
  accounts?: string[];
  types?: string[];
  from?: string;
  to?: string;
  tag?: string;
  sort: LibrarySortT;
  cursor?: string;
}

const ALLOWED_SORTS: LibrarySortT[] = ['recent', 'er', 'reach'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RawParams = Record<string, string | string[] | undefined>;

function firstString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Parse comma-separated or repeated param into string array. */
function parseMulti(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  const arr = Array.isArray(v) ? v : v.split(',');
  const clean = arr.flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean);
  return clean.length > 0 ? clean : undefined;
}

function isValidSort(s: string): s is LibrarySortT {
  return (ALLOWED_SORTS as string[]).includes(s);
}

/**
 * Parse Next.js async searchParams (Record) or URLSearchParams into LibraryFilter.
 * Accepts both shapes so it can be used in server components and API routes.
 */
export function parseFilterParams(raw: RawParams | URLSearchParams): LibraryFilter {
  const get = (key: string): string | string[] | undefined => {
    if (raw instanceof URLSearchParams) {
      const all = raw.getAll(key);
      if (all.length === 0) return undefined;
      return all.length === 1 ? all[0] : all;
    }
    return raw[key];
  };

  const sortRaw = firstString(get('sort')) ?? 'recent';
  const sort: LibrarySortT = isValidSort(sortRaw) ? sortRaw : 'recent';

  const q = firstString(get('q'))?.trim() || undefined;
  const tag = firstString(get('tag'))?.trim() || undefined;
  const cursor = firstString(get('cursor'))?.trim() || undefined;

  const fromRaw = firstString(get('from'));
  const toRaw = firstString(get('to'));
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined;
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : undefined;

  const platforms = parseMulti(get('platform'));
  const accounts = parseMulti(get('account'));
  const types = parseMulti(get('type'));

  return { q, platforms, accounts, types, from, to, tag, sort, cursor };
}
