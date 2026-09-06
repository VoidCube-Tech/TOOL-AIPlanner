import { tokenize, type Token, type TokenType } from "./lexer";
import type {
  Annotation,
  FieldNode,
  FunctionNode,
  Generic,
  ModuleNode,
  Modifier,
  Param,
  ParseIssue,
  RawNode,
  Reference,
  ReferenceNode,
  ResourceNode,
  SdsFile,
  SdsNode,
  SourceSpan,
  TypeDeclNode,
} from "./types";

let idCounter = 0;
function nextId(prefix: string) {
  idCounter++;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

const MODIFIER_KEYWORDS = new Set(["public", "private", "protected", "static", "abstract"]);
const TYPE_KEYWORDS = new Set(["class", "interface", "struct", "enum"]);

class Cursor {
  tokens: Token[];
  pos = 0;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  next(): Token {
    const t = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }
  at(type: TokenType): boolean {
    return this.peek().type === type;
  }
  atKeyword(word: string): boolean {
    const t = this.peek();
    return t.type === "KEYWORD" && t.value === word;
  }
  isEOF(): boolean {
    return this.peek().type === "EOF";
  }
}

function spanOf(t: Token): SourceSpan {
  return { start: t.start, end: t.end, line: t.line, col: t.col };
}

interface ParseCtx {
  fileId: string;
  issues: ParseIssue[];
}

/** Parses a `<args> field: Type ... </args>` block, cursor positioned at LANGLE for "args". */
function parseArgsBlock(c: Cursor, _ctx: ParseCtx): Param[] {
  const params: Param[] = [];
  c.next(); // LANGLE
  c.next(); // IDENT "args"
  c.next(); // RANGLE
  while (!c.isEOF()) {
    if (c.at("LANGLE") && c.peek(1).type === "WORD" && c.peek(1).value === "/args") {
      c.next(); // LANGLE
      c.next(); // "/args"
      if (c.at("RANGLE")) c.next();
      break;
    }
    if (c.at("IDENT") && c.peek(1).type === "COLON") {
      const nameTok = c.next();
      c.next(); // COLON
      const type = readTypeRef(c);
      params.push({ name: nameTok.value, type, span: spanOf(nameTok) });
      continue;
    }
    // unrecognized content inside args — skip token to avoid infinite loop
    c.next();
  }
  return params;
}

function readTypeRef(c: Cursor): string {
  let out = "";
  if (c.at("IDENT") || c.at("KEYWORD")) {
    out += c.next().value;
  }
  // Only treat '<' as generics if it isn't actually a closing "</tag>" marker
  // (e.g. the </args> that ends an <args> block) — that shows up as
  // LANGLE, WORD("/xxx") in our token stream.
  const looksLikeClosingTag = c.peek(1).type === "WORD" && c.peek(1).value.startsWith("/");
  if (c.at("LANGLE") && !looksLikeClosingTag) {
    out += "<";
    c.next();
    let depth = 1;
    while (!c.isEOF() && depth > 0) {
      if (c.at("LANGLE")) depth++;
      if (c.at("RANGLE")) depth--;
      if (depth === 0) {
        c.next();
        break;
      }
      out += c.next().value;
    }
    out += ">";
  }
  return out;
}

function parseParamList(c: Cursor): Param[] {
  const params: Param[] = [];
  c.next(); // LPAREN
  while (!c.isEOF() && !c.at("RPAREN")) {
    if (c.at("COMMA")) {
      c.next();
      continue;
    }
    if (c.at("IDENT")) {
      const nameTok = c.next();
      let type = "";
      if (c.at("COLON")) {
        c.next();
        type = readTypeRef(c);
      }
      params.push({ name: nameTok.value, type, span: spanOf(nameTok) });
    } else {
      c.next();
    }
  }
  if (c.at("RPAREN")) c.next();
  return params;
}

function parseGenerics(c: Cursor): Generic[] {
  const generics: Generic[] = [];
  if (!c.at("LANGLE")) return generics;
  c.next();
  while (!c.isEOF() && !c.at("RANGLE")) {
    if (c.at("IDENT")) {
      generics.push({ name: c.next().value });
    } else if (c.at("COMMA")) {
      c.next();
    } else {
      c.next();
    }
  }
  if (c.at("RANGLE")) c.next();
  return generics;
}

// Prose accumulation and reference capture are threaded through a shared
// mutable context object instead of return values, since a single body scan
// produces both structured child nodes and loose description text.
interface BodyAccumulator {
  proseWords: string[];
  references: Reference[];
}

function parseStatementInto(
  c: Cursor,
  ctx: ParseCtx,
  fileId: string,
  parentId: string,
  acc: BodyAccumulator
): SdsNode | null {
  // Collect leading annotations
  const annotations: Annotation[] = [];
  while (c.at("AT")) {
    const t = c.next();
    annotations.push({ name: t.value, span: spanOf(t) });
  }

  // Collect leading modifiers
  const modifiers: Modifier[] = [];
  while (c.at("KEYWORD") && MODIFIER_KEYWORDS.has(c.peek().value)) {
    modifiers.push(c.next().value as Modifier);
  }

  // module
  if (c.atKeyword("module")) {
    c.next();
    const declTok = c.peek();
    const nameTok = c.at("IDENT") ? c.next() : null;
    const id = nextId("mod");
    const nested = parseNestedBody(c, ctx, fileId, id);
    const node: ModuleNode = {
      id,
      kind: "module",
      name: nameTok?.value ?? "(unnamed module)",
      span: nameTok ? spanOf(nameTok) : spanOf(declTok),
      fileId,
      parentId,
      annotations,
      description: nested.description,
      children: nested.children,
      modifiers,
      references: nested.references,
    };
    return node;
  }

  // class / interface / struct / enum
  if (c.at("KEYWORD") && TYPE_KEYWORDS.has(c.peek().value)) {
    const kind = c.next().value as "class" | "interface" | "struct" | "enum";
    const declTok = c.peek();
    const nameTok = c.at("IDENT") ? c.next() : null;
    const generics = parseGenerics(c);
    let extendsRef: string | undefined;
    const implementsRefs: string[] = [];
    if (c.at("COLON")) {
      c.next();
      if (c.at("IDENT")) extendsRef = c.next().value;
    }
    if (c.atKeyword("implements")) {
      c.next();
      while (c.at("IDENT")) {
        implementsRefs.push(c.next().value);
        if (c.at("COMMA")) c.next();
        else break;
      }
    }
    const id = nextId(kind);
    const nested = parseNestedBody(c, ctx, fileId, id);
    const node: TypeDeclNode = {
      id,
      kind,
      name: nameTok?.value ?? "(unnamed)",
      span: nameTok ? spanOf(nameTok) : spanOf(declTok),
      fileId,
      parentId,
      annotations,
      description: nested.description,
      children: nested.children,
      modifiers,
      extendsRef,
      implementsRefs,
      generics,
    };
    return node;
  }

  // function
  if (c.atKeyword("function")) {
    c.next();
    const declTok = c.peek();
    const nameTok = c.at("IDENT") ? c.next() : null;
    const generics = parseGenerics(c);
    const params = c.at("LPAREN") ? parseParamList(c) : [];
    let returnType: string | undefined;
    if (c.at("COLON")) {
      c.next();
      returnType = readTypeRef(c);
    }
    const id = nextId("fn");
    const nested = parseNestedBody(c, ctx, fileId, id);
    const node: FunctionNode = {
      id,
      kind: "function",
      name: nameTok?.value ?? "(unnamed function)",
      span: nameTok ? spanOf(nameTok) : spanOf(declTok),
      fileId,
      parentId,
      annotations,
      description: nested.description,
      children: nested.children,
      modifiers,
      params,
      returnType,
      generics,
    };
    return node;
  }

  // resource block introduced purely by annotation(s) + `{` (optionally + name)
  if (annotations.length > 0 && (c.at("LBRACE") || (c.at("IDENT") && c.peek(1).type === "LBRACE"))) {
    const declTok = c.peek();
    let nameTok: Token | null = null;
    if (c.at("IDENT")) nameTok = c.next();
    const resourceType =
      [...annotations].reverse().find((a) => a.name !== "Resource")?.name ??
      annotations[annotations.length - 1].name;
    const id = nextId("res");
    c.next(); // LBRACE
    let args: Param[] = [];
    const children: SdsNode[] = [];
    const proseWords: string[] = [];
    while (!c.isEOF() && !c.at("RBRACE")) {
      if (c.at("LANGLE") && c.peek(1).type === "IDENT" && c.peek(1).value === "args") {
        args = parseArgsBlock(c, ctx);
        continue;
      }
      const localAcc: BodyAccumulator = { proseWords: [], references: [] };
      const child = parseStatementInto(c, ctx, fileId, id, localAcc);
      if (child) children.push(child);
      proseWords.push(...localAcc.proseWords);
    }
    if (c.at("RBRACE")) c.next();
    const node: ResourceNode = {
      id,
      kind: "resource",
      name: nameTok?.value ?? resourceType,
      span: nameTok ? spanOf(nameTok) : spanOf(declTok),
      fileId,
      parentId,
      annotations,
      description: proseWords.join(" ").trim(),
      children,
      modifiers,
      resourceType,
      args,
    };
    return node;
  }

  // field: IDENT COLON Type  (not followed by a body)
  if (c.at("IDENT") && c.peek(1).type === "COLON") {
    const nameTok = c.next();
    c.next(); // COLON
    const type = readTypeRef(c);
    const node: FieldNode = {
      id: nextId("field"),
      kind: "field",
      name: nameTok.value,
      span: spanOf(nameTok),
      fileId,
      parentId,
      annotations,
      description: "",
      children: [],
      modifiers,
      type,
    };
    return node;
  }

  // reference statement: $Something on its own
  if (c.at("REF")) {
    const t = c.next();
    acc.references.push({ target: t.value, span: spanOf(t) });
    return {
      id: nextId("ref"),
      kind: "reference",
      name: `$${t.value}`,
      span: spanOf(t),
      fileId,
      parentId,
      annotations,
      description: "",
      children: [],
      modifiers,
      reference: { target: t.value, span: spanOf(t) },
    } as ReferenceNode;
  }

  // raw explicit code: %...%
  if (c.at("RAW")) {
    const t = c.next();
    return {
      id: nextId("raw"),
      kind: "raw",
      name: "%code%",
      span: spanOf(t),
      fileId,
      parentId,
      annotations,
      description: "",
      children: [],
      modifiers,
      code: t.value,
    } as RawNode;
  }

  // otherwise: prose. Consume exactly one token and fold into description.
  if (annotations.length > 0) {
    // annotation with nothing structured after it — record as a marker word
    acc.proseWords.push(`@${annotations.map((a) => a.name).join(" @")}`);
    return null;
  }
  const t = c.next();
  if (t.type === "EOF") return null;
  acc.proseWords.push(t.value);
  return null;
}

function parseNestedBody(
  c: Cursor,
  ctx: ParseCtx,
  fileId: string,
  parentId: string
): { children: SdsNode[]; description: string; references: Reference[] } {
  if (!c.at("LBRACE")) {
    return { children: [], description: "", references: [] };
  }
  c.next(); // LBRACE
  const children: SdsNode[] = [];
  const acc: BodyAccumulator = { proseWords: [], references: [] };
  let guard = 0;
  while (!c.isEOF() && !c.at("RBRACE")) {
    guard++;
    if (guard > 200000) break;
    const before = c.pos;
    const node = parseStatementInto(c, ctx, fileId, parentId, acc);
    if (node) children.push(node);
    if (c.pos === before) c.next(); // never get stuck
  }
  if (c.at("RBRACE")) c.next();
  return { children, description: acc.proseWords.join(" ").trim(), references: acc.references };
}

export function parseFile(file: SdsFile): { nodes: SdsNode[]; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const tokens = tokenize(file.content);
  const c = new Cursor(tokens);
  const ctx: ParseCtx = { fileId: file.id, issues };
  const nodes: SdsNode[] = [];
  const acc: BodyAccumulator = { proseWords: [], references: [] };
  let guard = 0;
  while (!c.isEOF()) {
    guard++;
    if (guard > 500000) break;
    const before = c.pos;
    const node = parseStatementInto(c, ctx, file.id, "", acc);
    if (node) nodes.push(node);
    if (c.pos === before) c.next();
  }
  // Top-level stray prose becomes a synthetic description note (rare — most
  // files start directly with a module/class declaration).
  if (acc.proseWords.length > 0 && nodes.length === 0) {
    issues.push({
      severity: "warning",
      message: "Arquivo contém apenas texto livre, nenhuma declaração reconhecida.",
      fileId: file.id,
      span: { start: 0, end: 0, line: 1, col: 1 },
    });
  }
  return { nodes, issues };
}
