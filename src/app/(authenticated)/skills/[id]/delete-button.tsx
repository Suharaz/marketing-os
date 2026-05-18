'use client';

// Nút Delete cho detail page. Hiển thị nếu user là owner hoặc admin —
// trang server đã check permission, chỉ truyền `canDelete` xuống.

import { useState } from 'react';
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
}

export function DeleteButton({ skillId, skillName }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onConfirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Xoá thất bại');
      toast.success(`Đã xoá "${skillName}"`);
      router.push('/skills');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        Xoá
      </Button>
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
