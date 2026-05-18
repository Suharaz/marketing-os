'use client';

// Dialog upload skill file. Drag & drop + click-to-pick. Stream upload
// qua fetch — không dùng <form> mặc định vì cần custom header X-File-Name
// và progress hiển thị.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, Loader2, FileArchive } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ACCEPT = '.zip,.skill,application/zip';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setUploading(false);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPick = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.zip') && !lower.endsWith('.skill')) {
      toast.error('Chỉ chấp nhận file .zip hoặc .skill');
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onPick(e.dataTransfer.files[0] ?? null);
  };

  const onSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch('/api/skills/upload', {
        method: 'POST',
        headers: {
          'X-File-Name': encodeURIComponent(file.name),
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Upload thất bại');
      }
      toast.success(`Đã upload "${file.name}"`);
      onOpenChange(false);
      reset();
      // Navigate vào detail page mới
      router.push(`/skills/${data.id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast.error(msg);
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (uploading) return; // chặn close khi đang upload
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Skill</DialogTitle>
          <DialogDescription>
            Chọn file <code className="px-1 py-0.5 bg-zinc-100 rounded">.zip</code> hoặc{' '}
            <code className="px-1 py-0.5 bg-zinc-100 rounded">.skill</code> để lưu vào thư viện.
            Không giới hạn dung lượng.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`mt-2 border-2 border-dashed rounded-lg px-4 py-8 cursor-pointer transition-colors text-center ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-700">
              <FileArchive className="size-5 text-blue-600" />
              <span className="font-medium truncate max-w-[20rem]">{file.name}</span>
              <span className="text-xs text-zinc-500">({formatBytes(file.size)})</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <Upload className="size-6" />
              <p className="text-sm">Kéo thả file vào đây, hoặc click để chọn</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Huỷ
          </Button>
          <Button onClick={onSubmit} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
