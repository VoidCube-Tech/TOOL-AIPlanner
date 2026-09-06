import { create } from "zustand";
import { compileProject, type CompileResult } from "./engine";
import { createEmptyProject, type Library, type SdsFile, type SdsProject } from "./types";
import { loadProjectFromIndexedDb, saveProjectToIndexedDb } from "../persistence/db";
import { recompileLibrary } from "../library/loader";

interface EditorState {
  project: SdsProject;
  compiled: CompileResult;
  activeFileId: string | null;
  selectedNodeId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setActiveFile: (fileId: string | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  updateFileContent: (fileId: string, content: string) => void;
  addFile: (path: string, content?: string) => string;
  deleteFile: (fileId: string) => void;
  renameFile: (fileId: string, newPath: string) => void;
  updateSpecDrivenDesign: (text: string) => void;
  setProjectName: (name: string) => void;
  addLibrary: (lib: Library) => void;
  updateLibrarySourceFile: (libId: string, filename: string, content: string) => void;
  removeLibrary: (libId: string) => void;
  replaceProject: (project: SdsProject) => void;
  newProject: (name?: string) => void;
}

function recompile(project: SdsProject): CompileResult {
  return compileProject(project);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(project: SdsProject) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveProjectToIndexedDb(project).catch(() => {
      /* best-effort autosave */
    });
  }, 400);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  compiled: compileProject(createEmptyProject()),
  activeFileId: null,
  selectedNodeId: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await loadProjectFromIndexedDb();
      if (stored) {
        const compiled = recompile(stored);
        set({
          project: stored,
          compiled,
          activeFileId: stored.files[0]?.id ?? null,
          hydrated: true,
        });
        return;
      }
    } catch {
      /* fall through to fresh project */
    }
    const project = get().project;
    set({ activeFileId: project.files[0]?.id ?? null, hydrated: true });
  },

  setActiveFile: (fileId) => set({ activeFileId: fileId, selectedNodeId: null }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateFileContent: (fileId, content) => {
    const project = get().project;
    const files = project.files.map((f) => (f.id === fileId ? { ...f, content } : f));
    const next = { ...project, files, updatedAt: Date.now() };
    const compiled = recompile(next);
    set({ project: next, compiled });
    scheduleSave(next);
  },

  addFile: (path, content = "") => {
    const project = get().project;
    const file: SdsFile = { id: crypto.randomUUID(), path, content, nodes: [], issues: [] };
    const next = { ...project, files: [...project.files, file], updatedAt: Date.now() };
    const compiled = recompile(next);
    set({ project: next, compiled, activeFileId: file.id });
    scheduleSave(next);
    return file.id;
  },

  deleteFile: (fileId) => {
    const project = get().project;
    const files = project.files.filter((f) => f.id !== fileId);
    const next = { ...project, files, updatedAt: Date.now() };
    const compiled = recompile(next);
    const activeFileId = get().activeFileId === fileId ? files[0]?.id ?? null : get().activeFileId;
    set({ project: next, compiled, activeFileId });
    scheduleSave(next);
  },

  renameFile: (fileId, newPath) => {
    const project = get().project;
    const files = project.files.map((f) => (f.id === fileId ? { ...f, path: newPath } : f));
    const next = { ...project, files, updatedAt: Date.now() };
    set({ project: next, compiled: recompile(next) });
    scheduleSave(next);
  },

  updateSpecDrivenDesign: (text) => {
    const project = get().project;
    const next = { ...project, specDrivenDesign: text, updatedAt: Date.now() };
    set({ project: next });
    scheduleSave(next);
  },

  setProjectName: (name) => {
    const project = get().project;
    const next = { ...project, name, updatedAt: Date.now() };
    set({ project: next });
    scheduleSave(next);
  },

  addLibrary: (lib) => {
    const project = get().project;
    const next = { ...project, libraries: [...project.libraries, lib], updatedAt: Date.now() };
    const compiled = recompile(next);
    set({ project: next, compiled });
    scheduleSave(next);
  },

  updateLibrarySourceFile: (libId, filename, content) => {
    const project = get().project;
    const libraries = project.libraries.map((lib) => {
      if (lib.id !== libId) return lib;
      const updated = { ...lib, sourceFiles: { ...lib.sourceFiles, [filename]: content } };
      return recompileLibrary(updated);
    });
    const next = { ...project, libraries, updatedAt: Date.now() };
    const compiled = recompile(next);
    set({ project: next, compiled });
    scheduleSave(next);
  },

  removeLibrary: (libId) => {
    const project = get().project;
    const next = {
      ...project,
      libraries: project.libraries.filter((l) => l.id !== libId),
      updatedAt: Date.now(),
    };
    const compiled = recompile(next);
    set({ project: next, compiled });
    scheduleSave(next);
  },

  replaceProject: (project) => {
    const compiled = recompile(project);
    set({ project, compiled, activeFileId: project.files[0]?.id ?? null, selectedNodeId: null });
    scheduleSave(project);
  },

  newProject: (name) => {
    const project = createEmptyProject(name);
    const compiled = recompile(project);
    set({ project, compiled, activeFileId: project.files[0]?.id ?? null, selectedNodeId: null });
    scheduleSave(project);
  },
}));
