import { useEditorStore } from "../core/store";

export function ProblemsPanel() {
  const compiled = useEditorStore((s) => s.compiled);
  const files = useEditorStore((s) => s.project.files);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode);

  const rows: { fileId: string; path: string; severity: string; message: string; line: number }[] = [];
  for (const file of files) {
    const issues = compiled.issuesByFile.get(file.id) ?? [];
    for (const issue of issues) {
      rows.push({ fileId: file.id, path: file.path, severity: issue.severity, message: issue.message, line: issue.span.line });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-sm text-[var(--md-on-surface-variant)]">
          Nenhum problema encontrado. ✓
        </div>
      ) : (
        rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1 text-[13px] cursor-pointer hover:bg-[var(--md-surface-container-high)]"
            onClick={() => {
              setActiveFile(r.fileId);
              setSelectedNode(null);
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: r.severity === "error" ? "var(--md-error)" : "var(--md-warning)" }}
            />
            <span className="mono text-[var(--md-on-surface-variant)] shrink-0">
              {r.path}:{r.line}
            </span>
            <span className="truncate">{r.message}</span>
          </div>
        ))
      )}
    </div>
  );
}
