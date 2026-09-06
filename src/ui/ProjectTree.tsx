import { useMemo, useState } from "react";
import { useEditorStore } from "../core/store";

interface TreeFolder {
  name: string;
  path: string;
  folders: Map<string, TreeFolder>;
  files: { id: string; name: string; path: string }[];
}

function buildTree(files: { id: string; path: string }[]): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop()!;
    let cursor = root;
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (!cursor.folders.has(part)) {
        cursor.folders.set(part, { name: part, path: acc, folders: new Map(), files: [] });
      }
      cursor = cursor.folders.get(part)!;
    }
    cursor.files.push({ id: file.id, name: fileName, path: file.path });
  }
  return root;
}

function FolderView({ folder, depth }: { folder: TreeFolder; depth: number }) {
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const renameFile = useEditorStore((s) => s.renameFile);
  const deleteFile = useEditorStore((s) => s.deleteFile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div>
      {[...folder.folders.values()].map((sub) => (
        <div key={sub.path}>
          <div
            className="px-2 py-1 text-xs uppercase tracking-wide text-[var(--md-on-surface-variant)]"
            style={{ paddingLeft: 10 + depth * 12 }}
          >
            {sub.name}
          </div>
          <FolderView folder={sub} depth={depth + 1} />
        </div>
      ))}
      {folder.files.map((f) => (
        <div
          key={f.id}
          className={`group flex items-center justify-between rounded-md mx-1 px-2 py-1 text-sm cursor-pointer ${
            activeFileId === f.id
              ? "bg-[var(--md-surface-container-highest)] text-[var(--md-primary)]"
              : "hover:bg-[var(--md-surface-container-high)] text-[var(--md-on-surface)]"
          }`}
          style={{ paddingLeft: 10 + depth * 12 }}
          onClick={() => setActiveFile(f.id)}
        >
          {editingId === f.id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                renameFile(f.id, draft || f.path);
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="mono flex-1 bg-transparent border-b border-[var(--md-primary)] outline-none text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="mono truncate">{f.name}</span>
          )}
          <span className="hidden group-hover:flex gap-1 text-[10px] text-[var(--md-on-surface-variant)]">
            <button
              title="Renomear"
              onClick={(e) => {
                e.stopPropagation();
                setDraft(f.path);
                setEditingId(f.id);
              }}
              className="hover:text-[var(--md-primary)]"
            >
              ✎
            </button>
            <button
              title="Excluir"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Excluir "${f.path}"?`)) deleteFile(f.id);
              }}
              className="hover:text-[var(--md-error)]"
            >
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProjectTree() {
  const files = useEditorStore((s) => s.project.files);
  const specSelected = useEditorStore((s) => s.activeFileId === "__spec__");
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const addFile = useEditorStore((s) => s.addFile);

  const tree = useMemo(() => buildTree(files.map((f) => ({ id: f.id, path: f.path }))), [files]);

  return (
    <div className="flex h-full flex-col bg-[var(--md-surface-container)] border-r border-[var(--md-outline-variant)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--md-outline-variant)]">
        <span className="text-xs font-semibold tracking-wide text-[var(--md-on-surface-variant)]">PROJETO</span>
        <button
          title="Novo arquivo"
          className="text-[var(--md-primary)] hover:opacity-80 text-sm"
          onClick={() => {
            const name = prompt("Caminho do novo arquivo (ex: src/items/Item.sds)", "src/Novo.sds");
            if (name) addFile(name, "");
          }}
        >
          +
        </button>
      </div>
      <div
        className={`mx-1 mt-2 mb-1 rounded-md px-2 py-1 text-sm cursor-pointer ${
          specSelected
            ? "bg-[var(--md-surface-container-highest)] text-[var(--md-primary)]"
            : "hover:bg-[var(--md-surface-container-high)]"
        }`}
        onClick={() => setActiveFile("__spec__")}
      >
        ⌘ SPEC_DRIVEN_DESIGN
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        <FolderView folder={tree} depth={0} />
      </div>
    </div>
  );
}
