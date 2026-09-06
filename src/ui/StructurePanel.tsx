import { useEditorStore } from "../core/store";
import type { SdsNode } from "../core/types";

const KIND_ICON: Record<string, string> = {
  module: "▤",
  class: "◆",
  interface: "◇",
  struct: "▦",
  enum: "▧",
  function: "ƒ",
  field: "•",
  resource: "◈",
  reference: "→",
  raw: "%",
};

function NodeRow({ node, depth, fileId }: { node: SdsNode; depth: number; fileId: string }) {
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[13px] cursor-pointer ${
          selectedNodeId === node.id
            ? "bg-[var(--md-surface-container-highest)] text-[var(--md-primary)]"
            : "hover:bg-[var(--md-surface-container-high)]"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          setActiveFile(fileId);
          setSelectedNode(node.id);
        }}
        title={node.description || undefined}
      >
        <span className="text-[var(--md-on-surface-variant)] w-3 text-center">{KIND_ICON[node.kind] ?? "·"}</span>
        <span className="mono truncate">{node.name}</span>
        {node.kind === "field" && (
          <span className="text-[var(--md-on-surface-variant)] mono text-[11px]">: {(node as any).type}</span>
        )}
      </div>
      {node.children?.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} fileId={fileId} />
      ))}
    </div>
  );
}

export function StructurePanel() {
  const files = useEditorStore((s) => s.project.files);

  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
      {files
        .filter((f) => f.nodes.length > 0)
        .map((file) => (
          <div key={file.id} className="mb-1">
            <div className="px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)] mono">
              {file.path}
            </div>
            {file.nodes.map((node) => (
              <NodeRow key={node.id} node={node} depth={0} fileId={file.id} />
            ))}
          </div>
        ))}
      {files.every((f) => f.nodes.length === 0) && (
        <div className="px-3 py-4 text-sm text-[var(--md-on-surface-variant)]">
          Nenhuma estrutura reconhecida ainda — comece escrevendo um <span className="mono">module</span> ou{" "}
          <span className="mono">class</span> no editor.
        </div>
      )}
    </div>
  );
}
