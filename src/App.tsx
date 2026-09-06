import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "./core/store";
import { Toolbar } from "./ui/Toolbar";
import { ProjectTree } from "./ui/ProjectTree";
import { StructurePanel } from "./ui/StructurePanel";
import { ProblemsPanel } from "./ui/ProblemsPanel";
import { LibrariesPanel } from "./ui/LibrariesPanel";
import { CodeEditor } from "./editor/CodeEditor";

type RightTab = "structure" | "libraries";

function App() {
  const hydrated = useEditorStore((s) => s.hydrated);
  const hydrate = useEditorStore((s) => s.hydrate);
  const project = useEditorStore((s) => s.project);
  const compiled = useEditorStore((s) => s.compiled);
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const updateSpecDrivenDesign = useEditorStore((s) => s.updateSpecDrivenDesign);

  const [rightTab, setRightTab] = useState<RightTab>("structure");
  const [cursorRequest, setCursorRequest] = useState<{ offset: number; nonce: number } | null>(null);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a node is selected (from the Structure panel), scroll the editor to it.
  useEffect(() => {
    if (!selectedNodeId) return;
    const entry = compiled.index.allNodes.get(selectedNodeId);
    if (entry) {
      setCursorRequest({ offset: entry.node.span.start, nonce: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const activeFile = useMemo(
    () => (activeFileId && activeFileId !== "__spec__" ? project.files.find((f) => f.id === activeFileId) ?? null : null),
    [activeFileId, project.files]
  );

  const handleNavigateReference = (target: string) => {
    const index = compiled.index;
    const lastSegment = target.split(/[./:]/).pop() ?? target;
    const candidates = index.byName.get(target) ?? index.byName.get(lastSegment);
    if (candidates && candidates.length > 0) {
      setActiveFile(candidates[0].fileId);
      setSelectedNode(candidates[0].node.id);
      return;
    }
    const file = index.byPath.get(target) ?? index.byPath.get(target.split("/").pop() ?? target);
    if (file) {
      setActiveFile(file.id);
      setSelectedNode(null);
    }
  };

  if (!hydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-[var(--md-on-surface-variant)]">
        Carregando projeto…
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <Toolbar />
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "220px 1fr 280px" }}>
        <ProjectTree />

        <div className="flex flex-col overflow-hidden border-r border-[var(--md-outline-variant)]">
          <div className="px-3 py-1.5 border-b border-[var(--md-outline-variant)] text-[12px] mono text-[var(--md-on-surface-variant)] flex items-center justify-between">
            <span>{activeFileId === "__spec__" ? "SPEC_DRIVEN_DESIGN" : activeFile?.path ?? "Nenhum arquivo aberto"}</span>
            <span className="text-[10px]">
              {activeFileId !== "__spec__" && "Shift+Click em uma $referência para navegar"}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {activeFileId === "__spec__" ? (
              <textarea
                className="mono w-full h-full bg-[var(--md-surface)] p-4 text-[13.5px] outline-none resize-none"
                value={project.specDrivenDesign}
                onChange={(e) => updateSpecDrivenDesign(e.target.value)}
                spellCheck={false}
              />
            ) : activeFile ? (
              <CodeEditor
                key={activeFile.id}
                fileId={activeFile.id}
                content={activeFile.content}
                issues={compiled.issuesByFile.get(activeFile.id) ?? []}
                getIndex={() => compiled.index}
                onChange={(content) => updateFileContent(activeFile.id, content)}
                onNavigateReference={handleNavigateReference}
                cursorRequest={cursorRequest}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--md-on-surface-variant)] text-sm">
                Selecione ou crie um arquivo para começar.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden bg-[var(--md-surface-container)]">
          <div className="flex border-b border-[var(--md-outline-variant)] text-xs">
            <button
              className={`flex-1 py-2 ${rightTab === "structure" ? "text-[var(--md-primary)] border-b-2 border-[var(--md-primary)]" : "text-[var(--md-on-surface-variant)]"}`}
              onClick={() => setRightTab("structure")}
            >
              ESTRUTURA
            </button>
            <button
              className={`flex-1 py-2 ${rightTab === "libraries" ? "text-[var(--md-primary)] border-b-2 border-[var(--md-primary)]" : "text-[var(--md-on-surface-variant)]"}`}
              onClick={() => setRightTab("libraries")}
            >
              LIBRARIES
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightTab === "structure" ? <StructurePanel /> : <LibrariesPanel />}
          </div>
        </div>
      </div>

      <div className="h-40 border-t border-[var(--md-outline-variant)] bg-[var(--md-surface-container)] flex flex-col">
        <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--md-on-surface-variant)] border-b border-[var(--md-outline-variant)]">
          Problemas
        </div>
        <div className="flex-1 overflow-hidden">
          <ProblemsPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
