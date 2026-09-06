import type { Library, LibraryResourceRule } from "../core/types";

interface RawRuleEntry {
  name?: string;
  extends?: string;
  type?: string;
  Args?: Record<string, string>;
  Children?: string[];
  [key: string]: unknown;
}

/**
 * Compiles every JSON source file of a library into a flat list of resource
 * rules. Each top-level key in a JSON file is a free-form category (e.g.
 * "UI"); its array can contain rule objects or bare `$reference` strings
 * (treated as includes of another rule, kept as a lightweight marker rule so
 * they still show up in navigation/autocomplete).
 */
export function compileLibrarySource(sourceFiles: Record<string, string>): {
  rules: LibraryResourceRule[];
  errors: string[];
} {
  const rules: LibraryResourceRule[] = [];
  const errors: string[] = [];

  for (const [filename, text] of Object.entries(sourceFiles)) {
    if (!filename.endsWith(".json")) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      errors.push(`${filename}: JSON inválido (${(e as Error).message})`);
      continue;
    }
    for (const [category, entries] of Object.entries(parsed)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries as (RawRuleEntry | string)[]) {
        if (typeof entry === "string") {
          const ref = entry.startsWith("$") ? entry.slice(1) : entry;
          rules.push({ name: ref, type: "reference" });
          continue;
        }
        if (entry && typeof entry === "object") {
          rules.push({
            name: entry.name ?? `${category}.entry`,
            extends: entry.extends,
            type: entry.type ?? category,
            args: entry.Args,
            children: entry.Children,
          });
        }
      }
    }
  }
  return { rules, errors };
}

export function generateLibraryInfo(lib: Library): string {
  const lines: string[] = [];
  lines.push(`Library: ${lib.manifest.name}`);
  lines.push("");
  if (lib.manifest.purpose) {
    lines.push("Purpose:");
    lines.push(lib.manifest.purpose);
    lines.push("");
  }
  lines.push(`Version: ${lib.manifest.version}`);
  lines.push("");
  if (lib.manifest.dependencies.length) {
    lines.push("Dependencies:");
    for (const dep of lib.manifest.dependencies) lines.push(`- ${dep}`);
    lines.push("");
  }
  const byType = new Map<string, string[]>();
  for (const rule of lib.compiledRules) {
    const list = byType.get(rule.type ?? "Other") ?? [];
    list.push(rule.name);
    byType.set(rule.type ?? "Other", list);
  }
  if (byType.size) {
    lines.push("Available Resources / Types:");
    for (const [type, names] of byType) {
      lines.push(`- ${type}: ${names.join(", ")}`);
    }
    lines.push("");
  }
  lines.push("Usage:");
  lines.push(
    `Reference this library's types/resources from any .sds file once "${lib.manifest.name}" is present in lib/.`
  );
  return lines.join("\n");
}

export function recompileLibrary(lib: Library): Library {
  const { rules } = compileLibrarySource(lib.sourceFiles);
  const compiled: Library = { ...lib, compiledRules: rules };
  compiled.info = generateLibraryInfo(compiled);
  return compiled;
}

export function createEmptyLibrary(name: string): Library {
  const lib: Library = {
    id: crypto.randomUUID(),
    manifest: { name, version: "0.1.0", dependencies: [] },
    sourceFiles: {
      [`${name}.json`]: JSON.stringify(
        {
          Types: [{ name: "Example", type: "String", extends: undefined }],
        },
        null,
        2
      ),
    },
    compiledRules: [],
    info: "",
  };
  return recompileLibrary(lib);
}
