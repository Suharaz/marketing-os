'use client';

// Nút Delete skill — 2 variant:
//   - 'full':  button text "Xoá" (default; dùng cho detail page header/warning)
//   - 'icon':  icon-only trash (dùng cho card list page, hover-shown)
//
// Cả 2 variant share confirm dialog + DELETE logic. Phép check permission
// vẫn ở server-side; UI hide button = best-effort UX, server returns 403
// nếu user không có quyền.

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteButtonProps {
  skillId: string;
  skillName: string;
  variant?: 'full' | 'icon';
  /** Nếu true (default cho variant='full'), redirect về /skills sau khi xoá.
   *  Với variant='icon' (dùng trong list), set false để chỉ refresh router. */
  redirectAfter?: boolean;
}

export function DeleteButton({
  skillId,
  skillName,
  variant = 'full',
  redirectAfter,
}: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const shouldRedirect = redirectAfter ?? variant === 'full';

  const onConfirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Xoá thất bại');
      toast.success(`Đã xoá "${skillName}"`);
      if (shouldRedirect) router.push('/skills');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
      setDeleting(false);
    }
  };

  // Click handler dùng cho cả 2 variant — icon variant cần stop propagation
  // vì button có thể nằm bên trong card có Link wrapper.
  const onTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={onTriggerClick}
          aria-label={`Xoá ${skillName}`}
          className="p-1.5 rounded-md text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={onTriggerClick}
          className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
        >
          <Trash2 className="size-4" />
          Xoá
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (deleting) return;
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xoá skill?</DialogTitle>
            <DialogDescription>
              Hành động này sẽ xoá vĩnh viễn <strong>{skillName}</strong> khỏi DB và file
              trên disk. Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Huỷ
            </Button>
            <Button
              onClick={onConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang xoá...
                </>
              ) : (
                'Xoá vĩnh viễn'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
