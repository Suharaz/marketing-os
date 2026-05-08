'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { AccountOption } from '@/lib/queries/revenue';

interface Props {
  accounts: AccountOption[];
}

const vndFmt = new Intl.NumberFormat('vi-VN');

/**
 * Today's date in Asia/Ho_Chi_Minh as 'YYYY-MM-DD' — matches form <input type="date">.
 * Computed once on render; user can change.
 */
function todayInVn(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export function RevenueForm({ accounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [occurredDate, setOccurredDate] = useState(todayInVn());
  const [note, setNote] = useState('');

  // Display amount with thousands separators while user types — strip commas
  // before sending to API. Easier on the eye than a raw 1500000 input.
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setAmountStr(digitsOnly);
  }

  const formattedAmount = amountStr ? vndFmt.format(Number(amountStr)) : '';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amountNum = Number(amountStr);
    if (!accountId) {
      toast.error('Chọn 1 kênh');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredDate)) {
      toast.error('Ngày không hợp lệ');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/revenue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: accountId,
            amount_vnd: amountNum,
            occurred_date: occurredDate,
            note: note.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error((data as { error?: string }).error ?? 'Thêm thất bại');
          return;
        }

        toast.success('Đã thêm');
        router.push('/revenue');
        router.refresh();
      } catch {
        toast.error('Lỗi mạng — thử lại sau');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white rounded-xl border p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account">Kênh *</Label>
        <select
          id="account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.platform})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Số tiền (VND) *</Label>
        <Input
          id="amount"
          type="text"
          inputMode="numeric"
          value={formattedAmount}
          onChange={handleAmountChange}
          placeholder="VD: 1.500.000"
          required
        />
        {amountStr && (
          <p className="text-xs text-zinc-500">
            = {vndFmt.format(Number(amountStr))} ₫
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Ngày *</Label>
        <Input
          id="date"
          type="date"
          value={occurredDate}
          onChange={(e) => setOccurredDate(e.target.value)}
          required
          max={todayInVn()}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Ghi chú</Label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Tùy chọn — VD: 'Đơn từ campaign Tết'"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none resize-none"
        />
      </div>

      <div className="flex gap-2 mt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/revenue')}
          disabled={isPending}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
