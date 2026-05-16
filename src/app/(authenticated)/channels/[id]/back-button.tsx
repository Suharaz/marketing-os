'use client';

// Back button — quay về trang trước.
// Fallback /channels khi user vào trực tiếp (mở tab mới, share link, F5 stuck...)
// → history.length === 1 nghĩa là không có entry nào để back.

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/channels');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
    >
      <ArrowLeftIcon />
      <span>Quay lại</span>
    </button>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
