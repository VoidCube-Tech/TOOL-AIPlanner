import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { ResolvedIndex } from "../core/resolver";

const KEYWORDS = [
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
];

const PRIMITIVES = ["String", "Int", "Integer", "Number", "Float", "Boolean", "Void", "Any"];

export function makeSdsCompletionSource(getIndex: () => ResolvedIndex) {
  return (context: CompletionContext): CompletionResult | null => {
    // annotation: complete after '@'
    const annotationMatch = context.matchBefore(/@[A-Za-z0-9_:]*/);
    if (annotationMatch) {
      const known = new Set<string>(["Resource", "Lib"]);
      return {
        from: annotationMatch.from,
        options: [...known].map((name) => ({ label: `@${name}`, type: "class" })),
      };
    }

    // reference: complete after '$'
    const refMatch = context.matchBefore(/\$[A-Za-z0-9_./:\-]*/);
    if (refMatch) {
      const index = getIndex();
      const names = [...index.byName.keys()];
      const paths = [...index.byPath.keys()];
      return {
        from: refMatch.from,
        options: [
          ...names.map((n) => ({ label: `$${n}`, type: "variable" })),
          ...paths.map((p) => ({ label: `$${p}`, type: "text" })),
        ],
      };
    }

    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const index = getIndex();
    const symbolNames = [...index.byName.keys()];

    const options = [
      ...KEYWORDS.map((k) => ({ label: k, type: "keyword" })),
      ...PRIMITIVES.map((p) => ({ label: p, type: "type" })),
      ...symbolNames.map((n) => ({ label: n, type: "class" })),
    ];

    return { from: word.from, options };
  };
}
