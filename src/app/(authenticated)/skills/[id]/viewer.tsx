'use client';

// Viewer panel cho 1 file đang chọn trong cây.
//
// Strategy theo file kind (detect bằng extension):
//   - markdown (.md, .markdown)  → fetch text + render ReactMarkdown
//   - image (.png, .jpg, .svg, …) → <img src="/raw"> (browser tự load)
//   - text                        → fetch text + render <pre>
//   - binary (text route báo isBinary) → CTA download
//
// Toàn bộ nội dung wrap trong max-h scrollable container → page không
// bị dãn theo file dài.

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';

type FileKind = 'markdown' | 'image' | 'text';

function detectKind(path: string): FileKind {
  const lower = path.toLowerCase();
  if (/\.(md|markdown|mdx)$/.test(lower)) return 'markdown';
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(lower)) return 'image';
  return 'text';
}

interface TextResult {
  content: string;
  truncated: boolean;
  isBinary: boolean;
  size: number;
}

interface ViewerProps {
  skillId: string;
  path: string;
}

export function Viewer({ skillId, path }: ViewerProps) {
  const kind = detectKind(path);
  const [text, setText] = useState<TextResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Image kind không cần text — skip fetch
    if (kind === 'image') {
      setText(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setText(null);

    fetch(`/api/skills/${skillId}/file?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (!cancelled) {
          setText(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Lỗi đọc file');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [skillId, path, kind]);

  const downloadUrl = `/api/skills/${skillId}/raw?path=${encodeURIComponent(path)}`;

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Header sticky */}
      <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-500 gap-2 shrink-0">
        <span className="font-mono truncate min-w-0">{path}</span>
        <div className="flex items-center gap-2 shrink-0">
          {text?.truncated && (
            <span className="text-amber-600">(đã cắt — file lớn hơn 1MB)</span>
          )}
          <a href={downloadUrl} download>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" />
              Tải xuống
            </Button>
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {kind === 'image' && <ImageView url={downloadUrl} path={path} />}
        {kind !== 'image' && loading && <LoadingView />}
        {kind !== 'image' && !loading && text?.isBinary && (
          <BinaryView downloadUrl={downloadUrl} />
        )}
        {kind !== 'image' && !loading && text && !text.isBinary && (
          kind === 'markdown'
            ? <MarkdownView source={text.content} />
            : <TextView source={text.content} />
        )}
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-zinc-500">
      <Loader2 className="size-4 animate-spin mr-2" />
      Đang tải...
    </div>
  );
}

function BinaryView({ downloadUrl }: { downloadUrl: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-zinc-500 p-6">
      <p>File binary — không hiển thị inline được.</p>
      <a href={downloadUrl} download>
        <Button variant="outline" size="sm">
          <Download className="size-3.5" />
          Tải xuống để xem
        </Button>
      </a>
    </div>
  );
}

function ImageView({ url, path }: { url: string; path: string }) {
  return (
    <div className="p-3 flex items-center justify-center bg-zinc-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={path}
        className="max-w-full max-h-[60vh] object-contain bg-white shadow-sm rounded"
      />
    </div>
  );
}

function TextView({ source }: { source: string }) {
  return (
    <pre className="px-3 py-2 text-xs leading-relaxed font-mono text-zinc-800 whitespace-pre">
      {source}
    </pre>
  );
}

// Custom Tailwind styling cho ReactMarkdown (thay cho @tailwindcss/typography
// — tránh thêm plugin/config cho 1 tính năng nhỏ).
function MarkdownView({ source }: { source: string }) {
  return (
    <div className="px-4 py-3 text-sm text-zinc-800 leading-relaxed
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2
                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                    [&_p]:my-2
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                    [&_li]:my-0.5
                    [&_a]:text-blue-600 [&_a]:underline
                    [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:p-3 [&_pre]:rounded [&_pre]:my-3 [&_pre]:overflow-auto
                    [&_pre>code]:bg-transparent [&_pre>code]:text-inherit [&_pre>code]:p-0
                    [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-zinc-600
                    [&_table]:border-collapse [&_table]:my-3
                    [&_th]:border [&_th]:border-zinc-300 [&_th]:bg-zinc-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
                    [&_td]:border [&_td]:border-zinc-300 [&_td]:px-2 [&_td]:py-1
                    [&_hr]:my-4 [&_hr]:border-zinc-200
                    [&_img]:max-w-full [&_img]:my-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
