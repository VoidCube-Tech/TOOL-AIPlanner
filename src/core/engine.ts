import { parseFile } from "./parser";
import { buildIndex, resolveReferences, type ResolvedIndex } from "./resolver";
import { validateProject } from "./validator";
import type { ParseIssue, SdsProject } from "./types";

export interface CompileResult {
  project: SdsProject;
  index: ResolvedIndex;
  issuesByFile: Map<string, ParseIssue[]>;
  totalErrors: number;
  totalWarnings: number;
}

/** Re-parses every text file, resolves references, and runs validation. Pure — returns a new project object. */
export function compileProject(project: SdsProject): CompileResult {
  const files = project.files.map((file) => {
    if (file.binaryMeta) return { ...file, nodes: [], issues: [] };
    const { nodes, issues } = parseFile(file);
    return { ...file, nodes, issues };
  });
  const next: SdsProject = { ...project, files };
  const index = buildIndex(next);
  resolveReferences(next, index);
  const issuesByFile = validateProject(next, index);

  // merge parse-time issues (syntax-ish warnings) with validation issues
  for (const file of files) {
    if (file.issues.length) {
      const existing = issuesByFile.get(file.id) ?? [];
      issuesByFile.set(file.id, [...file.issues, ...existing]);
    }
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  for (const list of issuesByFile.values()) {
    for (const issue of list) {
      if (issue.severity === "error") totalErrors++;
      else totalWarnings++;
    }
  }

  return { project: next, index, issuesByFile, totalErrors, totalWarnings };
}
