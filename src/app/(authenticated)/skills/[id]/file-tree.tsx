'use client';

// Tree view bên trái + Viewer bên phải. Tree quản state `expanded` +
// `selectedPath`. Viewer (file riêng) tự handle fetch + render theo kind.

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import type { ZipEntryNode } from '@/lib/skill-lib/zip-reader';
import { Viewer } from './viewer';

// Tree node được build từ flat list. children dùng Map để dedupe nhanh
// khi insert; convert sang array khi render.
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

export function FileTree({ skillId, entries }: FileTreeProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const toggle = (path: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4">
      {/* Tree panel */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-2 max-h-[70vh] overflow-auto">
        <TreeChildren
          nodes={sortedChildren(tree)}
          depth={0}
          expanded={expanded}
          activePath={selectedPath}
          onToggle={toggle}
          onOpenFile={setSelectedPath}
        />
      </div>

      {/* Viewer panel — fixed max height, internal scroll */}
      <div className="rounded-xl bg-white ring-1 ring-zinc-200 max-h-[70vh] overflow-hidden flex flex-col">
        {selectedPath ? (
          <Viewer skillId={skillId} path={selectedPath} />
        ) : (
          <ViewerPlaceholder />
        )}
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
    <div className="h-full min-h-[20rem] flex items-center justify-center text-sm text-zinc-400">
      Chọn 1 file từ cây bên trái để xem nội dung
    </div>
  );
}
