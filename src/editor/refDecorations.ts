import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { tokenize } from "../core/lexer";

const refMark = Decoration.mark({ class: "sds-ref-token" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = view.state.doc.toString();
  const tokens = tokenize(text);
  for (const tok of tokens) {
    if (tok.type === "REF" && tok.end > tok.start) {
      // token.start points at '$', so include it: real span is start-1..end
      const from = Math.max(0, tok.start - 1);
      builder.add(from, tok.end, refMark);
    }
  }
  return builder.finish();
}

export function referenceNavigation(onNavigate: (target: string) => void) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(event, view) {
          if (!event.shiftKey) return false;
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos == null) return false;
          const text = view.state.doc.toString();
          const tokens = tokenize(text);
          const hit = tokens.find(
            (tok) => tok.type === "REF" && pos >= tok.start - 1 && pos <= tok.end
          );
          if (hit) {
            onNavigate(hit.value);
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    }
  );
}
