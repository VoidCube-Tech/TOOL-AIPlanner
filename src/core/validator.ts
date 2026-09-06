import type { ResolvedIndex } from "./resolver";
import type { Library, ParseIssue, SdsNode, SdsProject } from "./types";

const PRIMITIVE_TYPES = new Set([
  "String",
  "Int",
  "Integer",
  "Number",
  "Float",
  "Boolean",
  "Void",
  "Any",
]);

function libraryTypeNames(libraries: Library[]): Set<string> {
  const names = new Set<string>();
  for (const lib of libraries) {
    for (const rule of lib.compiledRules) {
      names.add(rule.name);
      if (rule.extends) names.add(rule.extends);
    }
  }
  return names;
}

function baseTypeName(type: string): string {
  const idx = type.indexOf("<");
  return (idx === -1 ? type : type.slice(0, idx)).trim();
}

export function validateProject(project: SdsProject, index: ResolvedIndex): Map<string, ParseIssue[]> {
  const issuesByFile = new Map<string, ParseIssue[]>();
  const pushIssue = (fileId: string, issue: ParseIssue) => {
    const list = issuesByFile.get(fileId) ?? [];
    list.push(issue);
    issuesByFile.set(fileId, list);
  };

  const knownTypeNames = new Set<string>([...PRIMITIVE_TYPES, ...libraryTypeNames(project.libraries)]);
  for (const { node } of index.allNodes.values()) {
    if (node.kind === "class" || node.kind === "interface" || node.kind === "struct" || node.kind === "enum") {
      knownTypeNames.add(node.name);
    }
  }

  const visit = (nodes: SdsNode[], fileId: string) => {
    const seenNames = new Map<string, number>();
    for (const node of nodes) {
      const count = (seenNames.get(node.name) ?? 0) + 1;
      seenNames.set(node.name, count);
      if (count === 2 && node.name !== "(unnamed)" && node.name !== "(unnamed module)") {
        pushIssue(fileId, {
          severity: "warning",
          message: `"${node.name}" já foi declarado neste escopo.`,
          fileId,
          span: node.span,
        });
      }

      if (node.kind === "reference") {
        const ref = (node as any).reference;
        if (!ref.resolvedNodeId && !ref.resolvedFileId) {
          pushIssue(fileId, {
            severity: "warning",
            message: `Referência "$${ref.target}" não pôde ser resolvida.`,
            fileId,
            span: node.span,
          });
        }
      }

      if (node.kind === "field") {
        const type = baseTypeName((node as any).type || "");
        if (type && !knownTypeNames.has(type)) {
          pushIssue(fileId, {
            severity: "warning",
            message: `Tipo desconhecido "${type}" no campo "${node.name}".`,
            fileId,
            span: node.span,
          });
        }
      }

      if (node.kind === "function") {
        const params = (node as any).params as { name: string; type: string }[];
        const returnType = (node as any).returnType as string | undefined;
        const seenParams = new Set<string>();
        for (const p of params) {
          if (seenParams.has(p.name)) {
            pushIssue(fileId, {
              severity: "error",
              message: `Parâmetro duplicado "${p.name}" em "${node.name}".`,
              fileId,
              span: node.span,
            });
          }
          seenParams.add(p.name);
          const t = baseTypeName(p.type);
          if (t && !knownTypeNames.has(t)) {
            pushIssue(fileId, {
              severity: "warning",
              message: `Tipo desconhecido "${t}" no parâmetro "${p.name}" de "${node.name}".`,
              fileId,
              span: node.span,
            });
          }
        }
        if (returnType) {
          const t = baseTypeName(returnType);
          if (t && !knownTypeNames.has(t)) {
            pushIssue(fileId, {
              severity: "warning",
              message: `Tipo de retorno desconhecido "${t}" em "${node.name}".`,
              fileId,
              span: node.span,
            });
          }
        }
      }

      if (node.kind === "class") {
        const extendsRef = (node as any).extendsRef as string | undefined;
        if (extendsRef && !index.byName.has(extendsRef)) {
          pushIssue(fileId, {
            severity: "error",
            message: `Classe base "${extendsRef}" não encontrada (extends inválido).`,
            fileId,
            span: node.span,
          });
        }
        const implementsRefs = (node as any).implementsRefs as string[];
        for (const impl of implementsRefs ?? []) {
          if (!index.byName.has(impl)) {
            pushIssue(fileId, {
              severity: "error",
              message: `Interface "${impl}" não encontrada (implements inválido).`,
              fileId,
              span: node.span,
            });
          }
        }
      }

      if (node.children?.length) visit(node.children, fileId);
    }
  };

  for (const file of project.files) visit(file.nodes, file.id);
  return issuesByFile;
}
