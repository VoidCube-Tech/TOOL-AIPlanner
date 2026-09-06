import Dexie, { type Table } from "dexie";
import type { SdsProject } from "../core/types";

interface StoredProject {
  id: string; // fixed key "current" — single active project, matching the local-first "Excalidraw-like" model
  project: SdsProject;
  savedAt: number;
}

class SdsDatabase extends Dexie {
  projects!: Table<StoredProject, string>;

  constructor() {
    super("sds-editor-db");
    this.version(1).stores({
      projects: "id",
    });
  }
}

export const db = new SdsDatabase();

const CURRENT_KEY = "current";

export async function saveProjectToIndexedDb(project: SdsProject): Promise<void> {
  await db.projects.put({ id: CURRENT_KEY, project, savedAt: Date.now() });
}

export async function loadProjectFromIndexedDb(): Promise<SdsProject | null> {
  const row = await db.projects.get(CURRENT_KEY);
  return row?.project ?? null;
}

export async function clearProjectFromIndexedDb(): Promise<void> {
  await db.projects.delete(CURRENT_KEY);
}
