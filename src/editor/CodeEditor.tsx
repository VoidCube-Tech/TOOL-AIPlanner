import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { sdsLanguage } from "./sdsLanguage";
import { sdsEditorTheme, sdsSyntaxHighlighting } from "./theme";
import { referenceNavigation } from "./refDecorations";
import { makeSdsCompletionSource } from "./autocomplete";
import { issuesToDiagnostics } from "./lint";
import type { ResolvedIndex } from "../core/resolver";
import type { ParseIssue } from "../core/types";

interface CodeEditorProps {
  fileId: string;
  content: string;
  issues: ParseIssue[];
  getIndex: () => ResolvedIndex;
  onChange: (content: string) => void;
  onNavigateReference: (target: string) => void;
  cursorRequest?: { offset: number; nonce: number } | null;
}

export function CodeEditor({
  fileId,
  content,
  issues,
  getIndex,
  onChange,
  onNavigateReference,
  cursorRequest,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onNavRef = useRef(onNavigateReference);
  onNavRef.current = onNavigateReference;

  // (Re)create the editor whenever the active file changes.
  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        closeBrackets(),
        lintGutter(),
        autocompletion({ override: [makeSdsCompletionSource(getIndex)] }),
        sdsLanguage,
        sdsSyntaxHighlighting,
        sdsEditorTheme,
        referenceNavigation((target) => onNavRef.current(target)),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Push external content changes (e.g. from import/undo elsewhere) without fighting local typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: content } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, fileId]);

  // Push diagnostics whenever issues change.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, issuesToDiagnostics(view.state, issues)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, fileId]);

  // Move the caret / scroll into view when asked (structure panel / ref navigation).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !cursorRequest) return;
    const pos = Math.max(0, Math.min(cursorRequest.offset, view.state.doc.length));
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorRequest?.nonce]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />;
}
