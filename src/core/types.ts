// Core data model for the SPEC-Driven-System (SDS) language.
// This file defines *what a project is made of*, independent of parsing or UI.

export type NodeKind =
  | "module"
  | "class"
  | "interface"
  | "struct"
  | "enum"
  | "function"
  | "field"
  | "resource"
  | "reference"
  | "raw"; // %code% blocks

export type Modifier = "public" | "private" | "protected" | "static" | "abstract";

export interface SourceSpan {
  /** Absolute character offset in the owning file's source text. */
  start: number;
  end: number;
  line: number; // 1-based
  col: number; // 1-based
}

export interface Annotation {
  /** e.g. "Resource" or "Ui::React" */
  name: string;
  /** Raw args block content, if the annotation carried one (rare — most args live on the node itself). */
  span: SourceSpan;
}

export interface Reference {
  /** Raw text after '$', e.g. "Item" or "src/items/Item.sdd" or "lib.transform_json" */
  target: string;
  span: SourceSpan;
  /** Resolved node id, filled in by the resolver. Undefined = unresolved. */
  resolvedNodeId?: string;
  resolvedFileId?: string;
}

export interface Param {
  name: string;
  type: string;
  span: SourceSpan;
}

export interface Generic {
  name: string;
}

export interface SdsNodeBase {
  id: string; // stable synthetic id, unique within the project
  kind: NodeKind;
  name: string;
  span: SourceSpan;
  fileId: string;
  parentId?: string;
  annotations: Annotation[];
  /** Free-text human description gathered from prose lines inside the body. */
  description: string;
  children: SdsNode[];
  modifiers: Modifier[];
}

export interface ModuleNode extends SdsNodeBase {
  kind: "module";
  references: Reference[];
}

export interface TypeDeclNode extends SdsNodeBase {
  kind: "class" | "interface" | "struct" | "enum";
  extendsRef?: string; // name after ':'
  implementsRefs: string[]; // names after 'implements'
  generics: Generic[];
}

export interface FieldNode extends SdsNodeBase {
  kind: "field";
  type: string;
}

export interface FunctionNode extends SdsNodeBase {
  kind: "function";
  params: Param[];
  returnType?: string;
  generics: Generic[];
}

export interface ResourceNode extends SdsNodeBase {
  kind: "resource";
  /** e.g. "Ui::React" taken from the annotation that defined the resource type */
  resourceType: string;
  args: Param[];
}

export interface ReferenceNode extends SdsNodeBase {
  kind: "reference";
  reference: Reference;
}

export interface RawNode extends SdsNodeBase {
  kind: "raw";
  code: string;
}

export type SdsNode =
  | ModuleNode
  | TypeDeclNode
  | FieldNode
  | FunctionNode
  | ResourceNode
  | ReferenceNode
  | RawNode;

export interface ParseIssue {
  severity: "error" | "warning";
  message: string;
  fileId: string;
  span: SourceSpan;
}

export interface SdsFile {
  id: string;
  /** Path relative to project root, e.g. "src/items/Item.sdd" */
  path: string;
  /** Raw text content. For binary files this is empty and `binaryMeta` is set instead. */
  content: string;
  binaryMeta?: { extension: string; size: number };
  /** Top-level nodes parsed from this file (usually zero or more modules/classes/etc). */
  nodes: SdsNode[];
  issues: ParseIssue[];
}

export interface LibraryManifest {
  name: string;
  version: string;
  dependencies: string[];
  purpose?: string;
}

export interface LibraryResourceRule {
  name: string;
  extends?: string;
  type?: string;
  args?: Record<string, string>;
  children?: string[];
}

export interface Library {
  id: string;
  manifest: LibraryManifest;
  /** Raw editable JSON rule files, keyed by filename. */
  sourceFiles: Record<string, string>;
  /** Parsed/compiled resource + type rules, flattened. */
  compiledRules: LibraryResourceRule[];
  info: string;
}

export interface SdsProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: SdsFile[];
  libraries: Library[];
  /** The project-level SPEC_DRIVEN_DESIGN context document (free text, user-editable). */
  specDrivenDesign: string;
}

export function createEmptyProject(name = "Untitled Project"): SdsProject {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    files: [
      {
        id: crypto.randomUUID(),
        path: "src/main.sds",
        content:
          "module Main {\n    Ponto de entrada conceitual do projeto.\n}\n",
        nodes: [],
        issues: [],
      },
    ],
    libraries: [],
    specDrivenDesign:
      "# SPEC_DRIVEN_DESIGN\n\nDescreva aqui o objetivo, foco, arquitetura e convenções do projeto para que uma IA consiga entendê-lo antes de implementar qualquer parte.\n",
  };
}
