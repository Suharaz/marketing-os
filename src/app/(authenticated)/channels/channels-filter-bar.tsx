'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ChannelsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const platform: string = searchParams.get('platform') ?? 'all';
  const status: string = searchParams.get('status') ?? 'all';
  const sort: string = searchParams.get('sort') ?? 'name';

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push('?' + params.toString());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={platform} onValueChange={(v) => update('platform', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Nền tảng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nền tảng</SelectItem>
          <SelectItem value="facebook">Facebook</SelectItem>
          <SelectItem value="instagram">Instagram</SelectItem>
          <SelectItem value="tiktok">TikTok</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => update('status', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả trạng thái</SelectItem>
          <SelectItem value="active">Hoạt động</SelectItem>
          <SelectItem value="token_expired">Token hết hạn</SelectItem>
          <SelectItem value="disconnected">Đã ngắt kết nối</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => update('sort', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Sắp xếp" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Theo tên</SelectItem>
          <SelectItem value="health">Theo health score</SelectItem>
          <SelectItem value="followers">Theo followers</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
