// Lexer for SDS. Produces a flat token stream. Structural tokens (braces,
// keywords, identifiers, annotations, references, generics markers, raw
// %code% blocks, string literals) are recognized explicitly. Everything else
// becomes WORD tokens that the parser folds into free-text descriptions.

export type TokenType =
  | "LBRACE"
  | "RBRACE"
  | "LPAREN"
  | "RPAREN"
  | "LANGLE"
  | "RANGLE"
  | "COLON"
  | "COMMA"
  | "AT" // annotation, value includes the name e.g. "@Resource" -> value "Resource"
  | "REF" // $reference, value is text after $
  | "RAW" // %code% block, value is inner text
  | "STRING"
  | "KEYWORD"
  | "IDENT"
  | "WORD" // fallback prose token
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  "module",
  "class",
  "interface",
  "struct",
  "enum",
  "function",
  "public",
  "private",
  "protected",
  "static",
  "abstract",
  "extends",
  "implements",
]);

function isIdentStart(ch: string) {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch: string) {
  return /[A-Za-z0-9_]/.test(ch);
}
function isRefPart(ch: string) {
  return /[A-Za-z0-9_./:\-]/.test(ch);
}
/** A trailing '.' or '/' is almost always sentence punctuation, not part of the
 * reference itself (SDS references never end in a separator). Trim it back. */
function trimTrailingSeparators(value: string): { value: string; trimmed: number } {
  let end = value.length;
  while (end > 0 && (value[end - 1] === "." || value[end - 1] === "/")) end--;
  return { value: value.slice(0, end), trimmed: value.length - end };
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const push = (type: TokenType, value: string, start: number, sLine: number, sCol: number) => {
    tokens.push({ type, value, start, end: i, line: sLine, col: sCol });
  };

  while (i < src.length) {
    const ch = src[i];
    const startLine = line;
    const startCol = col;
    const start = i;

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance();
      continue;
    }

    // line comment: // ...
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") advance();
      continue;
    }

    // string literals: " ' `  — content is opaque, $ inside is NOT a reference
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      advance();
      let value = "";
      while (i < src.length && src[i] !== quote) {
        value += src[i];
        advance();
      }
      advance(); // closing quote
      push("STRING", value, start, startLine, startCol);
      continue;
    }

    // raw explicit code block: %...%
    if (ch === "%") {
      advance();
      let value = "";
      while (i < src.length && src[i] !== "%") {
        value += src[i];
        advance();
      }
      advance(); // closing %
      push("RAW", value, start, startLine, startCol);
      continue;
    }

    // annotation: @Name or @Name::Name
    if (ch === "@") {
      advance();
      let value = "";
      while (i < src.length && /[A-Za-z0-9_:]/.test(src[i])) {
        value += src[i];
        advance();
      }
      push("AT", value, start, startLine, startCol);
      continue;
    }

    // reference: $path.to/thing
    if (ch === "$") {
      advance();
      let value = "";
      while (i < src.length && isRefPart(src[i])) {
        value += src[i];
        advance();
      }
      const { value: trimmedValue, trimmed } = trimTrailingSeparators(value);
      if (trimmed > 0) {
        // give back the trailing punctuation so it's tokenized normally (e.g. as prose)
        i -= trimmed;
        col -= trimmed;
      }
      push("REF", trimmedValue, start, startLine, startCol);
      continue;
    }

    if (ch === "{") { advance(); push("LBRACE", "{", start, startLine, startCol); continue; }
    if (ch === "}") { advance(); push("RBRACE", "}", start, startLine, startCol); continue; }
    if (ch === "(") { advance(); push("LPAREN", "(", start, startLine, startCol); continue; }
    if (ch === ")") { advance(); push("RPAREN", ")", start, startLine, startCol); continue; }
    if (ch === "<") { advance(); push("LANGLE", "<", start, startLine, startCol); continue; }
    if (ch === ">") { advance(); push("RANGLE", ">", start, startLine, startCol); continue; }
    if (ch === ":") { advance(); push("COLON", ":", start, startLine, startCol); continue; }
    if (ch === ",") { advance(); push("COMMA", ",", start, startLine, startCol); continue; }

    if (isIdentStart(ch)) {
      let value = "";
      while (i < src.length && isIdentPart(src[i])) {
        value += src[i];
        advance();
      }
      const type: TokenType = KEYWORDS.has(value) ? "KEYWORD" : "IDENT";
      push(type, value, start, startLine, startCol);
      continue;
    }

    // anything else (punctuation of prose, etc.) becomes a WORD token
    let value = "";
    while (
      i < src.length &&
      !/[\s{}()<>:,@$%"'`]/.test(src[i])
    ) {
      value += src[i];
      advance();
    }
    if (value.length === 0) {
      // stray punctuation character, e.g. '.' or '!' on its own
      value = src[i];
      advance();
    }
    push("WORD", value, start, startLine, startCol);
  }

  tokens.push({ type: "EOF", value: "", start: i, end: i, line, col });
  return tokens;
}
