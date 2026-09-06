import JSZip from "jszip";
import type { CompileResult } from "../core/engine";
import type { Library, LibraryManifest, SdsProject } from "../core/types";
import { generateLibraryInfo } from "../library/loader";

export interface LibraryValidationIssue {
  message: string;
}

/** Checks whether a project is structured enough to be exported as a library. */
export function validateProjectAsLibrary(project: SdsProject, compiled: CompileResult): LibraryValidationIssue[] {
  const issues: LibraryValidationIssue[] = [];
  if (compiled.totalErrors > 0) {
    issues.push({ message: `O projeto possui ${compiled.totalErrors} erro(s) de validação — corrija antes de exportar.` });
  }
  const hasAnyPublicStructure = project.files.some((f) => f.nodes.length > 0);
  if (!hasAnyPublicStructure) {
    issues.push({ message: "O projeto não possui nenhuma declaração estruturada (classes, módulos, funções, etc)." });
  }
  for (const file of project.files) {
    for (const node of file.nodes) {
      if ((node.kind === "class" || node.kind === "interface" || node.kind === "struct") && !node.description) {
        issues.push({
          message: `"${node.name}" (${file.path}) não possui descrição — recomendável para consumo por outros projetos.`,
        });
      }
    }
  }
  return issues;
}

export async function buildLibraryZip(project: SdsProject, manifestOverride?: Partial<LibraryManifest>): Promise<Blob> {
  const zip = new JSZip();
  const manifest: LibraryManifest = {
    name: manifestOverride?.name ?? project.name,
    version: manifestOverride?.version ?? "0.1.0",
    dependencies: manifestOverride?.dependencies ?? project.libraries.map((l) => l.manifest.name),
    purpose: manifestOverride?.purpose,
  };

  for (const file of project.files) {
    if (!file.binaryMeta) zip.file(`source/${file.path}`, file.content);
  }
  for (const file of project.files) {
    if (!file.binaryMeta) {
      zip.file(`compiled/${file.path}.json`, JSON.stringify(file.nodes, null, 2));
    }
  }

  const asLibrary: Library = {
    id: crypto.randomUUID(),
    manifest,
    sourceFiles: {},
    compiledRules: [],
    info: "",
  };
  zip.file("info", generateLibraryInfo(asLibrary) + `\n\n${project.specDrivenDesign}`);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "blob" });
}
