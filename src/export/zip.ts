import JSZip from "jszip";
import type { CompileResult } from "../core/engine";
import type { SdsNode, SdsProject } from "../core/types";

function countKinds(nodes: SdsNode[], counts: Record<string, number>) {
  for (const n of nodes) {
    counts[n.kind] = (counts[n.kind] ?? 0) + 1;
    if (n.children?.length) countKinds(n.children, counts);
  }
}

function buildProjectInfo(project: SdsProject, compiled: CompileResult): string {
  const counts: Record<string, number> = {};
  for (const file of project.files) countKinds(file.nodes, counts);
  const lines = [
    `Project: ${project.name}`,
    "",
    "Summary:",
    `- files: ${project.files.length}`,
    `- modules: ${counts.module ?? 0}`,
    `- classes: ${counts.class ?? 0}`,
    `- interfaces: ${counts.interface ?? 0}`,
    `- structs: ${counts.struct ?? 0}`,
    `- enums: ${counts.enum ?? 0}`,
    `- functions: ${counts.function ?? 0}`,
    `- resources: ${counts.resource ?? 0}`,
    `- diagnostics: ${compiled.totalErrors} error(s), ${compiled.totalWarnings} warning(s)`,
    "",
  ];
  if (project.libraries.length) {
    lines.push("Libraries used (see docs/libraries/*.info for full context):");
    for (const lib of project.libraries) lines.push(`- ${lib.manifest.name}@${lib.manifest.version}`);
    lines.push("");
  }
  lines.push("See SPEC_DRIVEN_DESIGN for the full project context.");
  return lines.join("\n");
}

function buildDocsSteps(project: SdsProject): { filename: string; content: string }[] {
  // One step per top-level file, in project order — a simple, predictable
  // sequencing an AI agent can follow module by module.
  const docs: { filename: string; content: string }[] = [];
  project.files.forEach((file, idx) => {
    if (file.binaryMeta) return;
    const n = String(idx + 1).padStart(2, "0");
    const topLevelNames = file.nodes.map((node) => `${node.kind} ${node.name}`);
    const content = [
      `# Etapa ${idx + 1}: ${file.path}`,
      "",
      topLevelNames.length
        ? `Declarações neste arquivo:\n${topLevelNames.map((t) => `- ${t}`).join("\n")}`
        : "(sem declarações estruturadas — apenas contexto textual)",
      "",
      "Descrição:",
      file.nodes.map((node) => node.description).filter(Boolean).join("\n\n") || "(ver conteúdo fonte)",
    ].join("\n");
    docs.push({ filename: `docs/${n}-${file.path.replace(/[\\/]/g, "_")}.md`, content });
  });
  return docs;
}

export async function buildProjectZip(project: SdsProject, compiled: CompileResult): Promise<Blob> {
  const zip = new JSZip();
  zip.file("SPEC_DRIVEN_DESIGN", project.specDrivenDesign);
  zip.file("info", buildProjectInfo(project, compiled));

  for (const doc of buildDocsSteps(project)) {
    zip.file(doc.filename, doc.content);
  }

  for (const file of project.files) {
    if (file.binaryMeta) {
      zip.file(`assets/${file.path}.meta.json`, JSON.stringify(file.binaryMeta, null, 2));
    } else {
      zip.file(`src/${file.path.replace(/^src\//, "")}`, file.content);
    }
  }

  if (project.libraries.length) {
    for (const lib of project.libraries) {
      zip.file(`docs/libraries/${lib.manifest.name}.info`, lib.info);
    }
  }

  return zip.generateAsync({ type: "blob" });
}
