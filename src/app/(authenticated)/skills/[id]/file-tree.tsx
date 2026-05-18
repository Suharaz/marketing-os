'use client';

// Tree view bên trái + content viewer bên phải.
// Click vào file → fetch /api/skills/[id]/file?path=... → hiện text trong panel.

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ZipEntryNode } from '@/lib/skill-lib/zip-reader';

// Tree node được build từ flat list. children dùng object để dedupe nhanh
// khi insert; sẽ convert sang array khi render.
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children: Map<string, TreeNode>;
}

function buildTree(entries: ZipEntryNode[]): TreeNode {
  const root: TreeNode = {
    name: '/', path: '', isDirectory: true, size: 0, children: new Map(),
  };

  for (const e of entries) {
    const parts = e.path.split('/').filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const isDir = !isLast || e.isDirectory;
      const childPath = parts.slice(0, i + 1).join('/') + (isDir && !isLast ? '/' : '');
      let next = cur.children.get(part);
      if (!next) {
        next = {
          name: part,
          path: isLast ? e.path : childPath,
          isDirectory: isDir,
          size: isLast ? e.size : 0,
          children: new Map(),
        };
        cur.children.set(part, next);
      }
      cur = next;
    }
  }

  return root;
}

// Sort: folders trước, sau đó alpha
function sortedChildren(node: TreeNode): TreeNode[] {
  return Array.from(node.children.values()).sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface FileTreeProps {
  skillId: string;
  entries: ZipEntryNode[];
}

interface ViewerState {
  path: string;
  loading: boolean;
  content: string;
  truncated: boolean;
  isBinary: boolean;
  size: number;
}

export function FileTree({ skillId, entries }: FileTreeProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const toggle = (path: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openFile = async (path: string) => {
    setViewer({ path, loading: true, content: '', truncated: false, isBinary: false, size: 0 });
    try {
      const res = await fetch(
        `/api/skills/${skillId}/file?path=${encodeURIComponent(path)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setViewer({ path, loading: false, ...data });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đọc được file');
      setViewer(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4">
      {/* Tree panel */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-2 max-h-[70vh] overflow-auto">
        <TreeChildren
          nodes={sortedChildren(tree)}
          depth={0}
          expanded={expanded}
          activePath={viewer?.path ?? null}
          onToggle={toggle}
          onOpenFile={openFile}
        />
      </div>

      {/* Viewer panel */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 min-h-[20rem] flex flex-col">
        {!viewer && <ViewerPlaceholder />}
        {viewer && <Viewer state={viewer} />}
      </div>
    </div>
  );
}

interface TreeChildrenProps {
  nodes: TreeNode[];
  depth: number;
  expanded: Set<string>;
  activePath: string | null;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
}

function TreeChildren({ nodes, depth, expanded, activePath, onToggle, onOpenFile }: TreeChildrenProps) {
  return (
    <ul className="text-sm">
      {nodes.map((n) => {
        const isOpen = expanded.has(n.path);
        const isActive = activePath === n.path;
        return (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => (n.isDirectory ? onToggle(n.path) : onOpenFile(n.path))}
              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left hover:bg-zinc-100 ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-zinc-700'
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {n.isDirectory ? (
                <>
                  {isOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                  {isOpen ? <FolderOpen className="size-4 shrink-0 text-amber-600" /> : <Folder className="size-4 shrink-0 text-amber-600" />}
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  <File className="size-4 shrink-0 text-zinc-400" />
                </>
              )}
              <span className="truncate">{n.name}</span>
            </button>
            {n.isDirectory && isOpen && n.children.size > 0 && (
              <TreeChildren
                nodes={sortedChildren(n)}
                depth={depth + 1}
                expanded={expanded}
                activePath={activePath}
                onToggle={onToggle}
                onOpenFile={onOpenFile}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ViewerPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
      Chọn 1 file từ cây bên trái để xem nội dung
    </div>
  );
}

function Viewer({ state }: { state: ViewerState }) {
  if (state.loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (state.isBinary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sm text-zinc-500 gap-1">
        <p className="font-medium text-zinc-700">{state.path}</p>
        <p>File binary — không hiển thị text.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
        <span className="font-mono truncate">{state.path}</span>
        {state.truncated && (
          <span className="text-amber-600">(đã cắt — file lớn hơn 1MB)</span>
        )}
      </div>
      <pre className="flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed font-mono text-zinc-800 whitespace-pre">
        {state.content}
      </pre>
    </div>
  );
}
