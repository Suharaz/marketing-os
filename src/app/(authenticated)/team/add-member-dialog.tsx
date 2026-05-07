'use client';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateMemberForm } from './create-member-form';

// Bọc CreateMemberForm trong dialog. CreateMemberForm tự gọi router.refresh()
// sau khi tạo thành công nhưng không emit callback — để giữ component nguyên vẹn,
// dialog không auto-close: user đóng thủ công sau khi thấy toast success.
export function AddMemberDialog() {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          buttonVariants({ size: 'lg' }),
          'bg-orange-500 text-white hover:bg-orange-600'
        )}
      >
        + Thêm thành viên
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo thành viên mới</DialogTitle>
        </DialogHeader>
        <CreateMemberForm />
      </DialogContent>
    </Dialog>
  );
}
