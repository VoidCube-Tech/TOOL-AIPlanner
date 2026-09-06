# SPEC-Driven-System Editor (SDS)

IDE local (React + TypeScript + Vite + Tailwind, sem backend) para escrever a
linguagem de especificação **SDS**: uma forma de descrever módulos, classes,
interfaces, structs, enums, funções, resources, referências e libraries de um
projeto de software, para que uma IA consiga entendê-lo sem precisar de
código-fonte tradicional.

## Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento
npm run build     # build de produção (pasta dist/)
npm run preview   # serve o build de produção
```

100% client-side. O projeto atual fica salvo automaticamente no IndexedDB do
navegador (chave única, estilo Excalidraw) — feche e reabra a aba que o
trabalho continua de onde parou.

## O que já funciona (núcleo)

- **Linguagem/parser real** (`src/core/lexer.ts`, `src/core/parser.ts`): `{}`
  corpo, `:` tipagem, `()` argumentos, `<T>` generics, `@Annotation`
  extensíveis, `$referência` (ignorado dentro de strings), `%código%` como
  bloco explícito não validado, `<args>...</args>` para resources, texto livre
  dentro de qualquer corpo vira `description`.
- **Modelo de projeto** (`src/core/types.ts`): module, class, interface,
  struct, enum, function, field, resource, reference — com annotations,
  modifiers, generics, extends/implements.
- **Resolução de referências** (`src/core/resolver.ts`): `$Nome`,
  `$caminho/Arquivo.sds` e `$lib.simbolo` são resolvidos contra os nomes e
  caminhos do projeto inteiro.
- **Validação** (`src/core/validator.ts`): referência não resolvida, tipo
  desconhecido, `extends`/`implements` inválido, parâmetro duplicado, nome
  duplicado no mesmo escopo — aparecem como erro/aviso no editor e no painel
  de Problemas.
- **Sistema de libraries extensível** (`src/library/loader.ts`): compila os
  JSONs editáveis de `lib/` (schema do documento original: categorias com
  regras `name/extends/type/Args/Children` ou referências `$...`) para uma
  tabela de regras em memória, e gera o `info` resumido para IA.
- **Persistência** (`src/persistence/db.ts`): IndexedDB via Dexie, autosave.
- **Exportação `.json`** (`src/export/json.ts`): formato completo,
  reimportável, reconstrói o projeto exatamente.
- **Exportação `.zip`** (`src/export/zip.ts`): `SPEC_DRIVEN_DESIGN`, `info`,
  `docs/NN-arquivo.md` (uma etapa por arquivo, em ordem), `src/`, e libraries
  resumidas em `docs/libraries/*.info` (não copiadas por inteiro).
- **Exportação `.lib`** (`src/export/lib.ts`): `source/`, `compiled/` (AST em
  JSON), `info`, `manifest.json`; com validação prévia (avisa se o projeto tem
  erros ou falta descrição em tipos públicos).

## O que já funciona (editor)

- Layout de 3 painéis + barra de problemas: árvore de projeto | editor |
  estrutura/libraries | problemas (`src/App.tsx`).
- Editor real (CodeMirror 6) com: syntax highlighting da linguagem SDS,
  autocomplete (keywords, tipos primitivos, símbolos do projeto,
  `$referências`), diagnósticos inline (sublinhado) vindos do validador,
  **Shift+Click numa `$referência` navega até a definição**.
- Árvore estrutural do projeto inteiro sincronizada com o editor — clicar em
  um nó abre o arquivo e posiciona o cursor nele.
- Criação de arquivo/módulo/classe/interface/struct/enum/função/resource via
  menu "+ Novo" (gera um arquivo com um scaffold pronto para editar).
- Gerenciamento de libraries: criar, editar os JSONs fonte, ver regras
  compiladas e o `info` gerado.
- Editor dedicado do `SPEC_DRIVEN_DESIGN` (contexto geral do projeto).

## O que ficou como próximo passo (auxiliar, conforme prioridade pedida)

Isto foi propositalmente deixado para depois do núcleo + editor, sem
simplificar a linguagem em si:

- Importação de `.lib` de volta para `lib/` (hoje só a exportação está pronta).
- "Export Project as Library" com fluxo de correção guiado dentro da UI (hoje
  a validação já roda e lista os problemas, mas ainda é um `confirm()` simples
  em vez de um painel dedicado).
- Redimensionamento dos painéis (larguras hoje são fixas).
- Autocomplete ciente do schema de uma library específica (hoje ele sugere
  `@Resource`/`@Lib` genéricos; ele já lista os símbolos do próprio projeto,
  mas não os tipos declarados dentro das libraries importadas).
- Arquivos binários (`.png`, `.mp3`, etc.) só têm suporte ao *metadado*
  (extensão/tamanho) no modelo — upload real de bytes não foi implementado,
  já que não há backend para armazená-los além do IndexedDB.

## Estrutura de pastas

```
src/
  core/        modelo de dados, lexer, parser, resolver, validator, engine, store (zustand)
  editor/      integração com CodeMirror 6 (linguagem, tema, autocomplete, lint, navegação)
  library/     compilação dos JSONs de lib/ em regras
  export/      .json, .zip, .lib
  persistence/ IndexedDB (Dexie)
  ui/          Toolbar, ProjectTree, StructurePanel, ProblemsPanel, LibrariesPanel
```
