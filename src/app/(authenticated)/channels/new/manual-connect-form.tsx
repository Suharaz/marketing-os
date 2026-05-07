'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DbPreview } from './db-preview';

/**
 * Manual page connect form (Cách A — bypass OAuth).
 * User pastes pageId + name + pageToken from Graph API Explorer
 * (https://developers.facebook.com/tools/explorer/), submits to /api/channels.
 * Optionally tests the token via FB /debug_token before saving.
 */

interface TestResult {
  valid: boolean;
  error?: string;
  page?: { id: string; name: string; fanCount: number | null; category: string | null };
  token?: { type: string; expiresAt: number; scopes: string[] };
  diagnostics?: {
    metricStatus: Array<{ metric: string; ok: boolean; error: string | null }>;
    postsError: string | null;
  };
  preview?: {
    account_metric_daily: Array<{
      date: string;
      followers: number | null;
      follower_growth: number;
      total_reach: number;
      total_engagement: number;
    }>;
    social_post: Array<{
      external_id: string;
      content: string | null;
      media_url: string | null;
      post_type: string;
      published_at: string | null;
      permalink: string | null;
    }>;
    post_metric_daily: Array<{
      external_id: string;
      date: string;
      reactions: number;
      comments: number;
      shares: number;
      reach: number;
      impressions: number;
      clicks: number;
      video_views: number;
    }>;
  };
}

const REQUIRED_SCOPES = ['pages_read_engagement'];

function formatExpiry(expiresAt: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (expiresAt === 0) return { label: 'Vĩnh viễn', tone: 'good' };
  const diffMs = expiresAt * 1000 - Date.now();
  if (diffMs < 0) return { label: 'Đã hết hạn', tone: 'bad' };
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return { label: `Còn ${days} ngày`, tone: 'warn' };
  return { label: `Còn ${days} ngày`, tone: 'good' };
}

export function ManualConnectForm() {
  const router = useRouter();
  const [pageId, setPageId] = useState('');
  const [name, setName] = useState('');
  const [pageToken, setPageToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Reset test result when any input changes
  function onChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setResult(null);
    };
  }

  async function onTest() {
    if (!pageId.trim() || !pageToken.trim()) {
      toast.error('Cần Page ID + Page Token');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/channels/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageId.trim(), pageToken: pageToken.trim() }),
      });
      const data: TestResult = await res.json();
      setResult(data);
      if (data.valid && data.page) {
        // Auto-fill name if empty
        if (!name.trim()) setName(data.page.name);
        toast.success('Token hợp lệ');
      } else {
        toast.error(data.error || 'Token không hợp lệ');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pageId.trim() || !name.trim() || !pageToken.trim()) {
      toast.error('Vui lòng điền đủ 3 trường');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: pageId.trim(),
          pageToken: pageToken.trim(),
          name: name.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || `Lỗi ${res.status}`);
        return;
      }

      const { accountId } = await res.json();
      toast.success('Đã kết nối page');
      router.push(`/channels/${accountId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-4 shadow-sm"
    >
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 leading-relaxed">
        Lấy 3 thông tin tại{' '}
        <a
          href="https://developers.facebook.com/tools/explorer/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold"
        >
          Graph API Explorer
        </a>
        : query{' '}
        <code className="bg-white px-1 rounded">
          /me/accounts?fields=id,name,access_token
        </code>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pageId">Page ID</Label>
        <Input
          id="pageId"
          value={pageId}
          onChange={(e) => onChange(setPageId)(e.target.value)}
          placeholder="1234567890"
          autoComplete="off"
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tên page</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="TAKI Travel"
          autoComplete="off"
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pageToken">Page Access Token</Label>
        <textarea
          id="pageToken"
          value={pageToken}
          onChange={(e) => onChange(setPageToken)(e.target.value)}
          placeholder="EAAxxx..."
          rows={3}
          autoComplete="off"
          disabled={submitting}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono break-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-zinc-500">
          Token được mã hóa trước khi lưu DB (pgcrypto).
        </p>
      </div>

      {/* Test result panel */}
      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {result.valid && result.page && result.token ? (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold flex items-center gap-2">
                <span>✓ Token hợp lệ</span>
                <span className="text-xs font-normal opacity-70">
                  ({result.token.type})
                </span>
              </div>
              <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-emerald-700">Page:</span>
                <span className="font-medium">{result.page.name}</span>
                <span className="text-emerald-700">Followers:</span>
                <span className="font-medium">
                  {result.page.fanCount?.toLocaleString('vi-VN') ?? '—'}
                </span>
                <span className="text-emerald-700">Category:</span>
                <span className="font-medium">{result.page.category ?? '—'}</span>
                <span className="text-emerald-700">Hết hạn:</span>
                <span
                  className={`font-medium ${
                    formatExpiry(result.token.expiresAt).tone === 'warn'
                      ? 'text-amber-700'
                      : formatExpiry(result.token.expiresAt).tone === 'bad'
                      ? 'text-red-700'
                      : ''
                  }`}
                >
                  {formatExpiry(result.token.expiresAt).label}
                </span>
                <span className="text-emerald-700">Scopes:</span>
                <span className="font-mono text-[11px] break-all">
                  {result.token.scopes.join(', ') || '—'}
                </span>
              </div>
              {(() => {
                const missing = REQUIRED_SCOPES.filter(
                  (s) => !result.token!.scopes.includes(s)
                );
                if (missing.length === 0) return null;
                return (
                  <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠ Thiếu scope: <code>{missing.join(', ')}</code> — sync data có thể fail
                  </div>
                );
              })()}

              {/* DB-shape preview: exactly what cron will UPSERT */}
              {result.preview && result.diagnostics && (
                <DbPreview preview={result.preview} diagnostics={result.diagnostics} />
              )}
            </div>
          ) : (
            <div>
              <div className="font-semibold mb-1">✗ Token không hợp lệ</div>
              <div className="text-xs">{result.error}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={testing || submitting}
        >
          {testing ? 'Đang kiểm tra...' : 'Kiểm tra token'}
        </Button>
        <Button type="submit" disabled={submitting || testing}>
          {submitting ? 'Đang kết nối...' : 'Kết nối page'}
        </Button>
      </div>
    </form>
  );
}
