'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface Props {
  id: string;
  /** Display name shown in confirmation toast — helps avoid accidental wrong-row delete */
  name: string;
}

/**
 * Two-tap confirm pattern: first tap arms (3s timeout), second tap fires.
 * Avoids a full Dialog component for what's already a low-frequency action.
 */
export function DeleteMemberButton({ id, name }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 3_000);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/team-members/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error((data as { error?: string }).error ?? 'Xoá thất bại');
          setConfirmed(false);
          return;
        }
        toast.success(`Đã xoá ${name}`);
        router.refresh();
      } catch {
        toast.error('Lỗi mạng — thử lại sau');
        setConfirmed(false);
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
          ? 'inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50'
          : 'inline-flex items-center text-zinc-400 hover:text-red-600 disabled:opacity-50'
      }
      title={confirmed ? `Bấm lần nữa để xoá ${name}` : `Xoá ${name}`}
    >
      <Trash2 className="size-3.5" />
      {confirmed && <span>Xác nhận?</span>}
    </button>
  );
}
