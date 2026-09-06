import type { SdsProject } from "../core/types";

export function exportProjectJson(project: SdsProject): string {
  // Strip derived-only fields (nodes/issues are recomputed by the parser on
  // import) so the JSON stays focused on the editable source of truth.
  const slim: SdsProject = {
    ...project,
    files: project.files.map((f) => ({ ...f, nodes: [], issues: [] })),
  };
  return JSON.stringify(slim, null, 2);
}

export function importProjectJson(text: string): SdsProject {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.files)) {
    throw new Error("JSON não corresponde ao formato de um projeto SDS.");
  }
  return {
    id: parsed.id ?? crypto.randomUUID(),
    name: parsed.name ?? "Projeto Importado",
    createdAt: parsed.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    files: parsed.files.map((f: any) => ({
      id: f.id ?? crypto.randomUUID(),
      path: f.path ?? "src/untitled.sds",
      content: f.content ?? "",
      binaryMeta: f.binaryMeta,
      nodes: [],
      issues: [],
    })),
    libraries: Array.isArray(parsed.libraries) ? parsed.libraries : [],
    specDrivenDesign: parsed.specDrivenDesign ?? "",
  };
}
