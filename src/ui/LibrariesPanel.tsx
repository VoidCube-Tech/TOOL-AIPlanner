import { useState } from "react";
import { useEditorStore } from "../core/store";
import { createEmptyLibrary } from "../library/loader";

export function LibrariesPanel() {
  const libraries = useEditorStore((s) => s.project.libraries);
  const addLibrary = useEditorStore((s) => s.addLibrary);
  const updateLibrarySourceFile = useEditorStore((s) => s.updateLibrarySourceFile);
  const removeLibrary = useEditorStore((s) => s.removeLibrary);
  const [openLibId, setOpenLibId] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--md-outline-variant)]">
        <span className="text-xs font-semibold tracking-wide text-[var(--md-on-surface-variant)]">
          BIBLIOTECAS (lib/)
        </span>
        <button
          className="text-[var(--md-primary)] text-sm hover:opacity-80"
          onClick={() => {
            const name = prompt("Nome da nova library", "MinhaLib");
            if (name) addLibrary(createEmptyLibrary(name));
          }}
        >
          +
        </button>
      </div>
      {libraries.length === 0 && (
        <div className="px-3 py-4 text-sm text-[var(--md-on-surface-variant)]">
          Nenhuma library adicionada. Libraries estendem o sistema (tipos, resources, annotations) via arquivos JSON
          editáveis, sem modificar o núcleo.
        </div>
      )}
      {libraries.map((lib) => {
        const open = openLibId === lib.id;
        return (
          <div key={lib.id} className="border-b border-[var(--md-outline-variant)]">
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--md-surface-container-high)]"
              onClick={() => setOpenLibId(open ? null : lib.id)}
            >
              <div>
                <div className="text-sm font-medium">{lib.manifest.name}</div>
                <div className="text-[11px] text-[var(--md-on-surface-variant)]">
                  v{lib.manifest.version} · {lib.compiledRules.length} regra(s) compilada(s)
                </div>
              </div>
              <button
                className="text-[var(--md-error)] text-xs hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remover a library "${lib.manifest.name}"?`)) removeLibrary(lib.id);
                }}
              >
                remover
              </button>
            </div>
            {open && (
              <div className="px-3 pb-3 space-y-2">
                {Object.entries(lib.sourceFiles).map(([filename, content]) => (
                  <div key={filename}>
                    <div className="mono text-[11px] text-[var(--md-on-surface-variant)] mb-1">{filename}</div>
                    <textarea
                      className="mono w-full h-32 rounded-md bg-[var(--md-surface)] border border-[var(--md-outline)] p-2 text-[12px] outline-none focus:border-[var(--md-primary)]"
                      defaultValue={content}
                      onBlur={(e) => {
                        try {
                          JSON.parse(e.target.value);
                          setJsonError(null);
                          updateLibrarySourceFile(lib.id, filename, e.target.value);
                        } catch (err) {
                          setJsonError(`${filename}: ${(err as Error).message}`);
                        }
                      }}
                    />
                  </div>
                ))}
                {jsonError && <div className="text-[12px] text-[var(--md-error)]">{jsonError}</div>}
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-[var(--md-on-surface-variant)]">
                    info (gerado — contexto para IA)
                  </summary>
                  <pre className="mono whitespace-pre-wrap text-[11px] mt-1 bg-[var(--md-surface)] rounded-md p-2 border border-[var(--md-outline-variant)]">
                    {lib.info}
                  </pre>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
