import { useRef, useState } from "react";
import { useEditorStore } from "../core/store";
import { buildTemplate, suggestedPath, TEMPLATE_LABELS, type TemplateKind } from "../editor/templates";
import { exportProjectJson, importProjectJson } from "../export/json";
import { buildProjectZip } from "../export/zip";
import { buildLibraryZip, validateProjectAsLibrary } from "../export/lib";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Toolbar() {
  const project = useEditorStore((s) => s.project);
  const compiled = useEditorStore((s) => s.compiled);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const addFile = useEditorStore((s) => s.addFile);
  const replaceProject = useEditorStore((s) => s.replaceProject);
  const newProject = useEditorStore((s) => s.newProject);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const kinds: TemplateKind[] = ["module", "class", "interface", "struct", "enum", "function", "resource"];

  const handleNewTemplate = (kind: TemplateKind) => {
    const name = prompt(`Nome d${kind === "interface" || kind === "enum" ? "a" : "o"} novo ${TEMPLATE_LABELS[kind]}`, "Novo");
    if (!name) return;
    addFile(suggestedPath(kind, name), buildTemplate(kind, name));
    setNewMenuOpen(false);
  };

  const handleExportJson = () => {
    download(new Blob([exportProjectJson(project)], { type: "application/json" }), `${project.name}.json`);
    setExportMenuOpen(false);
  };

  const handleExportZip = async () => {
    const blob = await buildProjectZip(project, compiled);
    download(blob, `${project.name}.zip`);
    setExportMenuOpen(false);
  };

  const handleExportLib = async () => {
    const issues = validateProjectAsLibrary(project, compiled);
    if (issues.length) {
      const proceed = confirm(
        `Avisos de validação da library:\n\n${issues.map((i) => "- " + i.message).join("\n")}\n\nExportar mesmo assim?`
      );
      if (!proceed) return;
    }
    const blob = await buildLibraryZip(project);
    download(blob, `${project.name}.lib`);
    setExportMenuOpen(false);
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importProjectJson(String(reader.result));
        replaceProject(imported);
      } catch (e) {
        alert(`Falha ao importar: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--md-outline-variant)] bg-[var(--md-surface-container)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--md-primary)] text-lg select-none">◈</span>
        <input
          value={project.name}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-[var(--md-primary)] px-1"
        />
      </div>

      <div className="relative">
        <button
          className="text-sm px-3 py-1.5 rounded-md bg-[var(--md-primary)] text-[var(--md-on-primary)] font-medium hover:opacity-90"
          onClick={() => setNewMenuOpen((v) => !v)}
        >
          + Novo
        </button>
        {newMenuOpen && (
          <div
            className="absolute z-20 mt-1 w-44 rounded-md border border-[var(--md-outline)] bg-[var(--md-surface-container-high)] shadow-xl overflow-hidden"
            onMouseLeave={() => setNewMenuOpen(false)}
          >
            {kinds.map((k) => (
              <button
                key={k}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--md-surface-container-highest)]"
                onClick={() => handleNewTemplate(k)}
              >
                {TEMPLATE_LABELS[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-[var(--md-outline)] hover:bg-[var(--md-surface-container-high)]"
          onClick={() => setExportMenuOpen((v) => !v)}
        >
          Exportar ▾
        </button>
        {exportMenuOpen && (
          <div
            className="absolute z-20 mt-1 w-48 rounded-md border border-[var(--md-outline)] bg-[var(--md-surface-container-high)] shadow-xl overflow-hidden"
            onMouseLeave={() => setExportMenuOpen(false)}
          >
            <button className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--md-surface-container-highest)]" onClick={handleExportJson}>
              .json (reimportável)
            </button>
            <button className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--md-surface-container-highest)]" onClick={handleExportZip}>
              .zip (para IA)
            </button>
            <button className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--md-surface-container-highest)]" onClick={handleExportLib}>
              .lib (como library)
            </button>
          </div>
        )}
      </div>

      <button
        className="text-sm px-3 py-1.5 rounded-md border border-[var(--md-outline)] hover:bg-[var(--md-surface-container-high)]"
        onClick={() => importInputRef.current?.click()}
      >
        Importar .json
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportJson(file);
          e.target.value = "";
        }}
      />

      <button
        className="text-sm px-3 py-1.5 rounded-md hover:bg-[var(--md-surface-container-high)] text-[var(--md-on-surface-variant)]"
        onClick={() => {
          if (confirm("Criar um novo projeto vazio? O projeto atual salvo localmente será substituído.")) {
            newProject();
          }
        }}
      >
        Novo projeto
      </button>

      <div className="ml-auto flex items-center gap-3 text-[12px] text-[var(--md-on-surface-variant)]">
        {compiled.totalErrors > 0 && (
          <span className="flex items-center gap-1" style={{ color: "var(--md-error)" }}>
            ● {compiled.totalErrors} erro(s)
          </span>
        )}
        {compiled.totalWarnings > 0 && (
          <span className="flex items-center gap-1" style={{ color: "var(--md-warning)" }}>
            ● {compiled.totalWarnings} aviso(s)
          </span>
        )}
        {compiled.totalErrors === 0 && compiled.totalWarnings === 0 && (
          <span style={{ color: "var(--md-success)" }}>● sem problemas</span>
        )}
        <span>salvo localmente</span>
      </div>
    </div>
  );
}
