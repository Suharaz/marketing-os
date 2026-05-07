'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  accountId: string;
  currentOwnerId: string | null;
  members: MemberOption[] | undefined;
}

// Sentinel value cho option "Chưa gán" — base-ui Select không cho value rỗng
const UNASSIGNED = '__unassigned__';

export function OwnerSelector({ accountId, currentOwnerId, members }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<string>(currentOwnerId ?? UNASSIGNED);
  // Defensive: handle case server route chưa truyền members (HMR mismatch)
  const memberList = members ?? [];

  // Lookup map để render display label nhanh (O(1) thay vì find mỗi lần)
  const labelById = new Map(memberList.map((m) => [m.id, m.name]));

  async function handleChange(next: string | null) {
    if (!next || next === value || saving) return;

    const previous = value;
    setValue(next);
    setSaving(true);

    try {
      const res = await fetch(`/api/channels/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_member_id: next === UNASSIGNED ? null : next,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Cập nhật thất bại.');
        setValue(previous);
        return;
      }

      toast.success('Đã đổi người phụ trách.');
      router.refresh();
    } catch {
      toast.error('Lỗi kết nối. Thử lại sau.');
      setValue(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-7 w-56" size="sm">
        {/* base-ui SelectValue nhận function child để map raw value → display text.
            Nếu không có function này, dropdown sẽ hiện UUID thô. */}
        <SelectValue placeholder="Chọn người phụ trách">
          {(v: unknown) => {
            if (typeof v !== 'string' || v === UNASSIGNED) return 'Chưa gán';
            return labelById.get(v) ?? 'Không rõ';
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>
          <span className="italic text-zinc-400">Chưa gán</span>
        </SelectItem>
        {memberList.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
            <span className="text-xs text-zinc-400 ml-1">· {m.role}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
