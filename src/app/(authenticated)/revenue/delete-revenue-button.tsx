'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface Props {
  id: string;
}

export function DeleteRevenueButton({ id }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function handleClick() {
    // Two-tap confirmation pattern: first click arms, second click deletes.
    // Avoids a full Dialog component for a low-risk inline action.
    if (!confirmed) {
      setConfirmed(true);
      // Auto-disarm after 3s if user walks away
      setTimeout(() => setConfirmed(false), 3_000);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/revenue/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error((data as { error?: string }).error ?? 'Xóa thất bại');
          return;
        }
        toast.success('Đã xóa');
        router.refresh();
      } catch {
        toast.error('Lỗi mạng — thử lại sau');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        confirmed
          ? 'inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50'
          : 'inline-flex items-center text-zinc-400 hover:text-red-600 disabled:opacity-50'
      }
      title={confirmed ? 'Bấm lần nữa để xác nhận xóa' : 'Xóa'}
    >
      <Trash2 className="size-4" />
      {confirmed && <span>Xác nhận?</span>}
    </button>
  );
}
