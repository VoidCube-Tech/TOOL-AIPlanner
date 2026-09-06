export type TemplateKind =
  | "module"
  | "class"
  | "interface"
  | "struct"
  | "enum"
  | "function"
  | "resource";

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  module: "Módulo",
  class: "Classe",
  interface: "Interface",
  struct: "Struct",
  enum: "Enum",
  function: "Função",
  resource: "Resource",
};

export function buildTemplate(kind: TemplateKind, name: string): string {
  switch (kind) {
    case "module":
      return `module ${name} {\n    Descreva o propósito desta pasta/módulo.\n\n    $NomeDoElemento\n}\n`;
    case "class":
      return `class ${name} {\n    Descreva a responsabilidade desta classe.\n\n    campo: String\n\n    function metodo(): Void {\n        Descreva o comportamento deste método.\n    }\n}\n`;
    case "interface":
      return `interface ${name} {\n    Descreva o contrato representado por esta interface.\n\n    function metodo(): Void {\n    }\n}\n`;
    case "struct":
      return `struct ${name} {\n    Descreva os dados agrupados por esta struct.\n\n    campo: String\n}\n`;
    case "enum":
      return `enum ${name} {\n    Descreva os valores possíveis.\n\n    Valor1: String\n    Valor2: String\n}\n`;
    case "function":
      return `function ${name}(): Void {\n    Descreva o que esta função faz.\n}\n`;
    case "resource":
      return `@Resource\n@Ui::Custom ${name} {\n    <args>\n        nome: String\n    </args>\n\n    Descreva o que este resource representa.\n}\n`;
    default:
      return "";
  }
}

export function suggestedPath(kind: TemplateKind, name: string): string {
  return `src/${name || TEMPLATE_LABELS[kind]}.sds`;
}
