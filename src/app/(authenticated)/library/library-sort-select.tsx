'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mới nhất' },
  { value: 'er',     label: 'ER cao nhất' },
  { value: 'reach',  label: 'Reach cao nhất' },
] as const;

export function LibrarySortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('sort') ?? 'recent';

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    // Reset cursor when sort changes
    params.delete('cursor');
    router.push('/library?' + params.toString());
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Sắp xếp theo" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
