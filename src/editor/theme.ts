import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const sdsEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--md-surface)",
      color: "var(--md-on-surface)",
    },
    ".cm-content": {
      caretColor: "var(--md-primary)",
      padding: "12px 0",
    },
    ".cm-gutters": {
      backgroundColor: "var(--md-surface)",
      color: "var(--md-on-surface-variant)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "#ffffff08" },
    ".cm-activeLineGutter": { backgroundColor: "#ffffff08" },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "#6ee7ff33",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--md-surface-container-high)",
      border: "1px solid var(--md-outline)",
      color: "var(--md-on-surface)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--md-primary-dim)",
      color: "var(--md-on-primary)",
    },
    ".sds-ref-token": {
      cursor: "pointer",
      textDecoration: "underline dotted",
    },
    ".cm-lintRange-error": {
      textDecoration: "underline wavy var(--md-error)",
    },
    ".cm-lintRange-warning": {
      textDecoration: "underline wavy var(--md-warning)",
    },
  },
  { dark: true }
);

export const sdsHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#b9a6ff", fontWeight: "600" },
  { tag: t.annotation, color: "#7ef2b0" },
  { tag: t.link, color: "#6ee7ff" },
  { tag: t.special(t.string), color: "#ffcf6e", fontStyle: "italic" },
  { tag: t.string, color: "#f6b17a" },
  { tag: t.typeName, color: "#6ee7ff" },
  { tag: t.className, color: "#8fd1ff" },
  { tag: t.variableName, color: "var(--md-on-surface)" },
  { tag: t.comment, color: "var(--md-on-surface-variant)", fontStyle: "italic" },
  { tag: t.punctuation, color: "var(--md-on-surface-variant)" },
]);

export const sdsSyntaxHighlighting = syntaxHighlighting(sdsHighlightStyle);
