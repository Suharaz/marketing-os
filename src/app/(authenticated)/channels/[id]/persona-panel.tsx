'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  accountId: string;
  personaJson: Record<string, unknown> | null;
}

export function PersonaPanel({ accountId, personaJson }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openModal() {
    setDraft(JSON.stringify(personaJson ?? {}, null, 2));
    setParseError(null);
    setOpen(true);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    // Clear error on edit
    if (parseError) setParseError(null);
  }

  async function handleSave() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'JSON không hợp lệ');
      return;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setParseError('Persona phải là một JSON object (không phải array hay primitive)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_json: parsed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Lưu thất bại.');
        return;
      }

      toast.success('Đã cập nhật persona.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Persona kênh</h2>
        <Button variant="outline" size="sm" onClick={openModal}>
          Sửa persona
        </Button>
      </div>

      {personaJson && Object.keys(personaJson).length > 0 ? (
        <pre className="text-xs text-zinc-700 bg-zinc-50 rounded-lg p-4 overflow-auto max-h-64 font-mono whitespace-pre-wrap">
          {JSON.stringify(personaJson, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-zinc-400 italic">Chưa có persona. Nhấn "Sửa persona" để thêm.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa persona</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <textarea
              className="w-full h-64 rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              spellCheck={false}
            />
            {parseError && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                {parseError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
