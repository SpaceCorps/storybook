import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Code } from "lucide-react";
import { rovingTarget } from "../keyboard/roving";
import { findByTypeahead, isTypeaheadKey, useTypeahead } from "../keyboard/typeahead";
import {
  PlanDiffView,
  getBasename,
  useIsNarrow,
  type DraftComment,
  type IvyEventHandler,
} from "./PlanDiffView";
import { getWidth, getHeight } from "@/lib/styles";
import "./plan-diff.css";

export interface ChangedFile {
  filePath: string;
  diff: string;
  additions: number;
  deletions: number;
}

export interface PlanChangesViewProps {
  id: string;
  width?: string;
  height?: string;
  eventHandler?: IvyEventHandler;
  onIvyEvent?: IvyEventHandler;
  events?: string[];
  files?: ChangedFile[];
  comments?: DraftComment[];
  currentAuthor?: string;
  showTree?: boolean;
}

export interface TreeFolder {
  name: string;
  path: string;
  folders: TreeFolder[];
  files: ChangedFile[];
}

const INDENT_PX = 12;
const ROW_LEAD_PX = 4;

function compareNames(a: string, b: string): number {
  const left = a.toUpperCase();
  const right = b.toUpperCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function buildFileTree(files: ChangedFile[]): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], files: [] };
  for (const file of files) {
    const segments = normalizePath(file.filePath).split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let child = node.folders.find((f) => compareNames(f.name, segment) === 0);
      if (!child) {
        child = {
          name: segment,
          path: node.path ? `${node.path}/${segment}` : segment,
          folders: [],
          files: [],
        };
        node.folders.push(child);
      }
      node = child;
    }
    node.files.push(file);
  }
  sortTree(root);
  return root;
}

function sortTree(node: TreeFolder) {
  node.folders.sort((a, b) => compareNames(a.name, b.name));
  node.files.sort((a, b) => compareNames(getBasename(a.filePath), getBasename(b.filePath)));
  for (const folder of node.folders) sortTree(folder);
}

export function flattenTreeOrder(node: TreeFolder): ChangedFile[] {
  const result: ChangedFile[] = [];
  for (const folder of node.folders) result.push(...flattenTreeOrder(folder));
  result.push(...node.files);
  return result;
}

export function collapseFolderChain(folder: TreeFolder): { label: string; node: TreeFolder } {
  let label = folder.name;
  let node = folder;
  while (node.files.length === 0 && node.folders.length === 1) {
    const only = node.folders[0];
    label = `${label}/${only.name}`;
    node = only;
  }
  return { label, node };
}

function FileStats({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions <= 0 && deletions <= 0) return null;
  return (
    <span className="ivy-changes-tree-stats">
      {additions > 0 && <span className="ivy-text-success">+{additions}</span>}
      {deletions > 0 && <span className="ivy-text-destructive">-{deletions}</span>}
    </span>
  );
}

/** One visible row of the tree, flattened so the keyboard can walk them in order. */
interface TreeRowModel {
  key: string;
  kind: "folder" | "file";
  depth: number;
  parentKey: string | null;
  /** The text a typed letter is matched against, and the row's visible name. */
  label: string;
  /** Folder path or file path: what a click toggles or selects. */
  path: string;
  expanded?: boolean;
  file?: ChangedFile;
  setSize: number;
  posInSet: number;
}

function collectVisibleRows(
  node: TreeFolder,
  depth: number,
  parentKey: string | null,
  collapsed: Record<string, boolean>,
  out: TreeRowModel[],
) {
  const setSize = node.folders.length + node.files.length;
  node.folders.forEach((folder, index) => {
    const { label, node: target } = collapseFolderChain(folder);
    const isCollapsed = collapsed[target.path] ?? false;
    const key = `folder:${target.path}`;
    out.push({
      key,
      kind: "folder",
      depth,
      parentKey,
      label,
      path: target.path,
      expanded: !isCollapsed,
      setSize,
      posInSet: index + 1,
    });
    if (!isCollapsed) collectVisibleRows(target, depth + 1, key, collapsed, out);
  });
  node.files.forEach((file, index) => {
    out.push({
      key: `file:${file.filePath}`,
      kind: "file",
      depth,
      parentKey,
      label: getBasename(file.filePath),
      path: file.filePath,
      file,
      setSize,
      posInSet: node.folders.length + index + 1,
    });
  });
}

interface FileTreeProps {
  root: TreeFolder;
  selectedPath: string | null;
  collapsed: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
}

/**
 * The changed-files tree as an APG tree view: one tab stop that follows focus, Up/Down walk the
 * visible rows, Right opens a folder or steps into it, Left closes it or steps out to its parent,
 * Home/End jump to the ends, and a typed letter jumps to the next row starting with it.
 */
function FileTree({ root, selectedPath, collapsed, onToggleFolder, onSelectFile }: FileTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const typeahead = useTypeahead();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: TreeRowModel[] = [];
    collectVisibleRows(root, 0, null, collapsed, out);
    return out;
  }, [root, collapsed]);

  // The tab stop is the row last focused; before any, the selected file, else the first row. It
  // falls back the same way when its row leaves the tree because a folder above it was closed.
  const stopKey =
    (rows.some((row) => row.key === activeKey) ? activeKey : null) ??
    rows.find((row) => row.kind === "file" && row.path === selectedPath)?.key ??
    rows[0]?.key ??
    null;

  const focusRow = (index: number) => {
    const el = treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')[index];
    el?.focus();
  };

  const activate = (row: TreeRowModel) => {
    if (row.kind === "folder") onToggleFolder(row.path);
    else onSelectFile(row.path);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const key = target?.dataset.key;
    const index = rows.findIndex((row) => row.key === key);
    if (index === -1) return;
    const row = rows[index];

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        activate(row);
        return;
      case "ArrowRight":
        event.preventDefault();
        if (row.kind !== "folder") return;
        if (!row.expanded) onToggleFolder(row.path);
        else if (rows[index + 1]?.parentKey === row.key) focusRow(index + 1);
        return;
      case "ArrowLeft": {
        event.preventDefault();
        if (row.kind === "folder" && row.expanded) {
          onToggleFolder(row.path);
          return;
        }
        const parent = rows.findIndex((candidate) => candidate.key === row.parentKey);
        if (parent !== -1) focusRow(parent);
        return;
      }
      default:
        break;
    }

    const next = rovingTarget(event.key, index, rows.length, {
      orientation: "vertical",
      wrap: false,
    });
    if (next !== null) {
      event.preventDefault();
      focusRow(next);
      return;
    }

    if (isTypeaheadKey(event.nativeEvent, typeahead.searching)) {
      event.preventDefault();
      const found = findByTypeahead(
        rows.map((candidate) => candidate.label),
        typeahead.push(event.key),
        index,
      );
      if (found !== -1) focusRow(found);
    }
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Changed files"
      className="ivy-changes-tree"
      onKeyDown={handleKeyDown}
    >
      {rows.map((row) => {
        const isSelected = row.kind === "file" && selectedPath === row.path;
        return (
          <div
            key={row.key}
            role="treeitem"
            data-key={row.key}
            aria-expanded={row.kind === "folder" ? row.expanded : undefined}
            aria-selected={row.kind === "file" ? isSelected : undefined}
            aria-level={row.depth + 1}
            aria-setsize={row.setSize}
            aria-posinset={row.posInSet}
            tabIndex={row.key === stopKey ? 0 : -1}
            className={`ivy-changes-tree-row${isSelected ? " ivy-changes-tree-row-selected" : ""}`}
            style={{ paddingLeft: ROW_LEAD_PX + row.depth * INDENT_PX }}
            title={row.path}
            onFocus={() => setActiveKey(row.key)}
            onClick={() => activate(row)}
          >
            {row.kind === "folder" ? (
              <>
                {row.expanded ? (
                  <ChevronDown className="ivy-changes-tree-chevron" />
                ) : (
                  <ChevronRight className="ivy-changes-tree-chevron" />
                )}
                <span className="ivy-changes-tree-name">{row.label}</span>
              </>
            ) : (
              <>
                <Code className="ivy-changes-tree-icon" />
                <span className="ivy-changes-tree-name">{row.label}</span>
                <FileStats additions={row.file!.additions} deletions={row.file!.deletions} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const PlanChangesView: React.FC<PlanChangesViewProps> = ({
  id,
  width,
  height,
  eventHandler,
  onIvyEvent,
  files = [],
  comments = [],
  currentAuthor,
  showTree = true,
}) => {
  const dispatchEvent = eventHandler || onIvyEvent;
  const [containerRef, isNarrow] = useIsNarrow();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => buildFileTree(files), [files]);
  const orderedFiles = useMemo(() => flattenTreeOrder(tree), [tree]);

  useEffect(() => {
    setSelectedPath(null);
    setCollapsed({});
  }, [id]);

  const commentsByFile = useMemo(() => {
    const map: Record<string, DraftComment[]> = {};
    for (const c of comments) {
      (map[c.filePath] ??= []).push(c);
    }
    return map;
  }, [comments]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsed((prev) => ({ ...prev, [path]: !(prev[path] ?? false) }));
  }, []);

  const selectFile = useCallback((path: string) => {
    setSelectedPath(path);
    if (typeof document === "undefined") return;
    document.getElementById(path)?.scrollIntoView({ block: "start" });
  }, []);

  const style: React.CSSProperties = {
    ...getWidth(width),
    ...getHeight(height),
  };

  if (orderedFiles.length === 0) {
    return (
      <div ref={containerRef} style={style} className="text-[var(--muted-foreground)] p-4 text-sm">
        No file changes.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className={`ivy-changes-view${isNarrow ? " ivy-changes-view-narrow" : ""}`}
    >
      {!isNarrow && showTree && (
        <FileTree
          root={tree}
          selectedPath={selectedPath}
          collapsed={collapsed}
          onToggleFolder={toggleFolder}
          onSelectFile={selectFile}
        />
      )}
      {isNarrow && (
        <div className="ivy-changes-jump">
          <span className="text-xs text-[var(--muted-foreground)] shrink-0">
            {orderedFiles.length} files
          </span>
          <select
            aria-label="Jump to file"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)]"
            value={selectedPath ?? ""}
            onChange={(e) => {
              if (e.target.value) selectFile(e.target.value);
            }}
          >
            <option value="" disabled>
              Jump to file…
            </option>
            {orderedFiles.map((file) => (
              <option key={file.filePath} value={file.filePath}>
                {file.filePath}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="ivy-changes-diffs">
        {orderedFiles.map((file) => (
          <PlanDiffView
            key={file.filePath}
            id={id}
            eventHandler={dispatchEvent}
            diff={file.diff}
            filePath={file.filePath}
            collapsible
            comments={commentsByFile[file.filePath] ?? []}
            currentAuthor={currentAuthor}
          />
        ))}
      </div>
    </div>
  );
};
