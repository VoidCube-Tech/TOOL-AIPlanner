import type { ReferenceNode, SdsFile, SdsNode, SdsProject } from "./types";

export interface ResolvedIndex {
  /** name -> nodes with that name (names aren't guaranteed unique) */
  byName: Map<string, { node: SdsNode; fileId: string }[]>;
  /** file path (and basename) -> file */
  byPath: Map<string, SdsFile>;
  allNodes: Map<string, { node: SdsNode; fileId: string }>;
}

function walk(nodes: SdsNode[], fileId: string, out: ResolvedIndex) {
  for (const node of nodes) {
    out.allNodes.set(node.id, { node, fileId });
    const list = out.byName.get(node.name) ?? [];
    list.push({ node, fileId });
    out.byName.set(node.name, list);
    if (node.children?.length) walk(node.children, fileId, out);
  }
}

export function buildIndex(project: SdsProject): ResolvedIndex {
  const index: ResolvedIndex = {
    byName: new Map(),
    byPath: new Map(),
    allNodes: new Map(),
  };
  for (const file of project.files) {
    index.byPath.set(file.path, file);
    index.byPath.set(file.path.split("/").pop() ?? file.path, file);
    walk(file.nodes, file.id, index);
  }
  return index;
}

/** Mutates reference nodes in place, filling resolvedNodeId / resolvedFileId. */
export function resolveReferences(project: SdsProject, index: ResolvedIndex) {
  const visit = (nodes: SdsNode[]) => {
    for (const node of nodes) {
      if (node.kind === "reference") {
        resolveOne(node as ReferenceNode, index);
      }
      if (node.children?.length) visit(node.children);
    }
  };
  for (const file of project.files) visit(file.nodes);
}

function resolveOne(node: ReferenceNode, index: ResolvedIndex) {
  const target = node.reference.target;
  // path-like reference: contains '/' or a file extension
  if (target.includes("/") || /\.[a-zA-Z0-9]+$/.test(target)) {
    const file = index.byPath.get(target) ?? index.byPath.get(target.split("/").pop() ?? target);
    if (file) {
      node.reference.resolvedFileId = file.id;
      return;
    }
  }
  // namespaced reference lib.symbol or ns:Name — try the last segment as a name
  const lastSegment = target.split(/[./:]/).pop() ?? target;
  const candidates = index.byName.get(target) ?? index.byName.get(lastSegment);
  if (candidates && candidates.length > 0) {
    node.reference.resolvedNodeId = candidates[0].node.id;
    node.reference.resolvedFileId = candidates[0].fileId;
  }
}
