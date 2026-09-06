import type { Diagnostic } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";
import type { ParseIssue } from "../core/types";

export function issuesToDiagnostics(state: EditorState, issues: ParseIssue[]): Diagnostic[] {
  const docLength = state.doc.length;
  return issues.map((issue) => {
    const from = Math.max(0, Math.min(issue.span.start, docLength));
    let to = Math.max(from, Math.min(issue.span.end, docLength));
    if (to === from) to = Math.min(docLength, from + 1);
    return {
      from,
      to,
      severity: issue.severity === "error" ? "error" : "warning",
      message: issue.message,
    };
  });
}
