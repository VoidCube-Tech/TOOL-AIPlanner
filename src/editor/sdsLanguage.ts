import { StreamLanguage, type StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

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

const PRIMITIVES = new Set(["String", "Int", "Integer", "Number", "Float", "Boolean", "Void", "Any"]);

interface SdsStreamState {
  inString: string | null; // active quote char, if inside a multi-line-safe string (we don't support multi-line strings, but keep shape)
}

export const sdsStreamParser = {
  name: "sds",
  startState(): SdsStreamState {
    return { inString: null };
  },
  token(stream: StringStream, _state: SdsStreamState) {
    if (stream.eatSpace()) return null;

    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    const ch = stream.peek();

    if (ch === '"' || ch === "'" || ch === "`") {
      stream.next();
      while (!stream.eol()) {
        const c = stream.next();
        if (c === ch) break;
      }
      return "string";
    }

    if (ch === "%") {
      stream.next();
      while (!stream.eol()) {
        const c = stream.next();
        if (c === "%") break;
      }
      return "meta"; // raw/explicit code block
    }

    if (ch === "@") {
      stream.next();
      stream.eatWhile(/[A-Za-z0-9_:]/);
      return "annotation";
    }

    if (ch === "$") {
      stream.next();
      stream.eatWhile(/[A-Za-z0-9_./:\-]/);
      return "reference";
    }

    if (/[A-Za-z_]/.test(ch ?? "")) {
      stream.eatWhile(/[A-Za-z0-9_]/);
      const word = stream.current();
      if (KEYWORDS.has(word)) return "keyword";
      if (PRIMITIVES.has(word)) return "typeName";
      // Heuristic: Capitalized identifier immediately followed by '(' or '<' or standalone -> treat as type/class name
      if (/^[A-Z]/.test(word)) return "className";
      return "variableName";
    }

    if (/[{}()<>:,]/.test(ch ?? "")) {
      stream.next();
      return "punctuation";
    }

    stream.next();
    return null;
  },
};

export const sdsLanguage = StreamLanguage.define({
  ...sdsStreamParser,
  tokenTable: {
    annotation: t.annotation,
    reference: t.link,
    meta: t.special(t.string),
    className: t.className,
    punctuation: t.punctuation,
  },
});
