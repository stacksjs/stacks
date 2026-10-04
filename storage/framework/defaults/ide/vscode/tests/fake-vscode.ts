/**
 * Just enough of the `vscode` API for ./pickier.test.ts and ./env.test.ts:
 * documents, diagnostics, code actions, hovers and the provider registries,
 * recorded so tests can call the providers the way the editor would.
 */

type Listener<T> = (event: T) => unknown

export function emitter<T>() {
  const listeners = new Set<Listener<T>>()
  return {
    event: (listener: Listener<T>) => {
      listeners.add(listener)
      return { dispose: () => listeners.delete(listener) }
    },
    fire: (value: T) => {
      for (const listener of [...listeners]) listener(value)
    },
  }
}

export class Position {
  constructor(readonly line: number, readonly character: number) {}
  translate(lines = 0, characters = 0) {
    return new Position(this.line + lines, this.character + characters)
  }
}

export class Range {
  readonly start: Position
  readonly end: Position
  constructor(a: Position | number, b: Position | number, c?: number, d?: number) {
    this.start = typeof a === 'number' ? new Position(a, b as number) : a
    this.end = typeof a === 'number' ? new Position(c as number, d as number) : b as Position
  }
}

export class CodeActionKind {
  static readonly QuickFix = new CodeActionKind('quickfix')
  static readonly SourceFixAll = new CodeActionKind('source.fixAll')
  constructor(readonly value: string) {}
  append(part: string) {
    return new CodeActionKind(`${this.value}.${part}`)
  }

  contains(other: CodeActionKind) {
    return other.value === this.value || other.value.startsWith(`${this.value}.`)
  }
}

export class WorkspaceEdit {
  readonly edits: Array<{ uri: unknown, range?: Range, position?: Position, text: string }> = []
  replace(uri: unknown, range: Range, text: string) {
    this.edits.push({ uri, range, text })
  }

  insert(uri: unknown, position: Position, text: string) {
    this.edits.push({ uri, position, text })
  }
}

export class MarkdownString {
  value = ''
  appendMarkdown(text: string) {
    this.value += text
    return this
  }

  appendCodeblock(code: string, language = '') {
    this.value += `\n\`\`\`${language}\n${code}\n\`\`\`\n`
    return this
  }
}

export interface FakeDocument {
  uri: { fsPath: string, scheme: string, toString: () => string }
  languageId: string
  version: number
  isClosed: boolean
  lineCount: number
  getText: () => string
  lineAt: (line: number) => { text: string, lineNumber: number, range: Range }
  getWordRangeAtPosition: (position: Position) => Range | undefined
}

export function document(path: string, text: string, languageId = 'typescript'): FakeDocument {
  const lines = text.split('\n')
  return {
    uri: { fsPath: path, scheme: 'file', toString: () => `file://${path}` },
    languageId,
    version: 1,
    isClosed: false,
    lineCount: lines.length,
    getText: () => text,
    lineAt: (line: number) => ({ text: lines[line] ?? '', lineNumber: line, range: new Range(line, 0, line, (lines[line] ?? '').length) }),
    getWordRangeAtPosition: (position: Position) => {
      const line = lines[position.line] ?? ''
      const match = /\w+/.exec(line.slice(position.character))
      return match && match.index === 0 ? new Range(position.line, position.character, position.line, position.character + match[0].length) : undefined
    },
  }
}

export function fakeVscode(options: { folders: string[], settings?: Record<string, unknown>, documents?: FakeDocument[] }) {
  const settings = options.settings ?? {}
  const diagnostics = new Map<string, any[]>()
  const handlers = new Map<string, (...args: any[]) => any>()
  const codeActionProviders: any[] = []
  const formatters: any[] = []
  const hovers: any[] = []
  const messages: string[] = []
  const answers: Array<string | undefined> = []
  const inputs: any[] = []
  const output: string[] = []
  const applied: WorkspaceEdit[] = []
  const clipboard: string[] = []
  const opened = emitter<FakeDocument>()
  const changed = emitter<{ document: FakeDocument }>()
  const saved = emitter<FakeDocument>()
  const closed = emitter<FakeDocument>()

  const message = (text: string) => {
    messages.push(text)
    return Promise.resolve(answers.shift())
  }

  const api = {
    Position,
    Range,
    CodeActionKind,
    WorkspaceEdit,
    MarkdownString,
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    Diagnostic: class {
      source?: string
      code?: string
      constructor(readonly range: Range, readonly message: string, readonly severity: number) {}
    },
    CodeAction: class {
      edit?: WorkspaceEdit
      diagnostics?: unknown[]
      constructor(readonly title: string, readonly kind: CodeActionKind) {}
    },
    Hover: class {
      constructor(readonly contents: MarkdownString, readonly range?: Range) {}
    },
    TextEdit: { replace: (range: Range, newText: string) => ({ range, newText }) },
    commands: {
      registerCommand: (id: string, handler: (...args: any[]) => any) => {
        handlers.set(id, handler)
        return { dispose: () => handlers.delete(id) }
      },
    },
    env: { clipboard: { writeText: async (text: string) => { clipboard.push(text) } } },
    languages: {
      createDiagnosticCollection: () => ({
        set: (uri: { toString: () => string }, list: any[]) => diagnostics.set(uri.toString(), list),
        delete: (uri: { toString: () => string }) => diagnostics.delete(uri.toString()),
        clear: () => diagnostics.clear(),
        dispose: () => {},
      }),
      registerCodeActionsProvider: (_selector: unknown, provider: unknown) => {
        codeActionProviders.push(provider)
        return { dispose: () => {} }
      },
      registerDocumentFormattingEditProvider: (_selector: unknown, provider: unknown) => {
        formatters.push(provider)
        return { dispose: () => {} }
      },
      registerHoverProvider: (_selector: unknown, provider: unknown) => {
        hovers.push(provider)
        return { dispose: () => {} }
      },
    },
    window: {
      activeTextEditor: undefined as undefined | { document: FakeDocument },
      createOutputChannel: () => ({ appendLine: (line: string) => output.push(line), dispose: () => {} }),
      showInformationMessage: message,
      showWarningMessage: message,
      showErrorMessage: message,
      showInputBox: (inputOptions: unknown) => {
        inputs.push(inputOptions)
        return Promise.resolve(answers.shift())
      },
      showQuickPick: (items: string[], pickOptions: unknown) => {
        inputs.push({ items, ...pickOptions as object })
        return Promise.resolve(answers.shift())
      },
    },
    workspace: {
      workspaceFolders: options.folders.map((folder, index) => ({ uri: { fsPath: folder }, name: folder, index })),
      textDocuments: options.documents ?? [],
      getConfiguration: () => ({ get: (key: string, fallback: unknown) => key in settings ? settings[key] : fallback }),
      getWorkspaceFolder: (uri: { fsPath: string }) => {
        const folder = options.folders.find(candidate => uri.fsPath.startsWith(`${candidate}/`))
        return folder ? { uri: { fsPath: folder } } : undefined
      },
      applyEdit: async (edit: WorkspaceEdit) => {
        applied.push(edit)
        return true
      },
      onDidOpenTextDocument: opened.event,
      onDidChangeTextDocument: changed.event,
      onDidSaveTextDocument: saved.event,
      onDidCloseTextDocument: closed.event,
      onDidChangeConfiguration: emitter<any>().event,
    },
  }

  return {
    api,
    diagnostics,
    handlers,
    codeActionProviders,
    formatters,
    hovers,
    messages,
    answers,
    inputs,
    output,
    applied,
    clipboard,
    events: { opened, changed, saved, closed },
    context: { subscriptions: [] as Array<{ dispose: () => unknown }> },
  }
}

export const flush = () => new Promise(resolve => setTimeout(resolve, 10))
