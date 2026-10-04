/**
 * Pickier, built in: lint diagnostics, a formatter, `source.fixAll.pickier`
 * and quick fixes, all from the project's own pickier and config - the same
 * ones `./buddy lint` and `./buddy format` use.
 *
 * Pickier itself runs in a Bun process per project (./pickier-worker.ts), so
 * this module only manages those processes and turns their answers into
 * editor features. Everything it needs from the machine comes through
 * `PickierHost`, so tests drive it with fakes.
 */
import type * as vscode from 'vscode'
import type { PickierIssue, PickierOperation, PickierReady, PickierRequest, PickierResponse, PickierResult } from './pickier-protocol'
import { join, relative, sep } from 'node:path'
import { isLintablePath } from '../../../../core/actions/src/lint/files'

type Vscode = typeof vscode

export interface PickierProcess {
  write: (line: string) => void
  onLine: (listener: (line: string) => void) => void
  onExit: (listener: () => void) => void
  kill: () => void
}

export interface PickierHost {
  exists: (path: string) => boolean
  /** Start `bun <script>` in `cwd`; stdout is delivered line by line. */
  spawnBun: (bun: string, script: string, cwd: string) => PickierProcess
}

export interface PickierOptions {
  /** Absolute path of dist/pickier-worker.js. */
  workerPath: string
  lintDelayMs?: number
}

export const PICKIER_COMMANDS = {
  fixAll: 'stacks.pickier.fixAll',
  restart: 'stacks.pickier.restart',
} as const

/** The language ids of the files `buddy lint` covers (core/actions/src/lint/files.ts). */
export const PICKIER_LANGUAGES = ['typescript', 'javascript', 'json', 'jsonc', 'markdown', 'yaml'] as const

/** Comment syntax for `pickier-disable-next-line`, where the language has line comments. */
const LINE_COMMENT: Record<string, string> = { typescript: '//', javascript: '//', jsonc: '//' }

/**
 * The Bun that runs pickier: the setting, then the project's pinned Bun
 * (`pantry/.bin/bun`, the one `./buddy` itself runs on), then `bun` on the PATH.
 */
export function chooseBun(setting: string, root: string, exists: (path: string) => boolean): string {
  if (setting.trim())
    return setting.trim()
  const pinned = join(root, 'pantry', '.bin', 'bun')
  return exists(pinned) ? pinned : 'bun'
}

/** Whether saving this file changes the config a running pickier has loaded. */
export function isPickierConfigPath(path: string): boolean {
  return /(?:^|[/\\])(?:pickier\.config|\.config[/\\]pickier|config[/\\]code-style)\.(?:[cm]?[jt]s|json)$/.test(path)
}

/** The comment that silences `ruleId` on the line below, indented to match it. */
export function disableNextLineComment(lineText: string, ruleId: string, comment: string): string {
  const indent = lineText.match(/^\s*/)?.[0] ?? ''
  return `${indent}${comment} pickier-disable-next-line ${ruleId}\n`
}

/** Whether `buddy lint` would lint `file`, given the project it belongs to. */
export function isLintedFile(root: string, file: string): boolean {
  const rel = relative(root, file)
  if (!rel || rel.startsWith('..'))
    return false
  return isLintablePath(rel.split(sep).join('/'))
}

/** One pickier worker process, for one project root. */
export class PickierClient {
  private process: PickierProcess | undefined
  private nextId = 1
  private pending = new Map<number, (response: PickierResponse | undefined) => void>()
  private readyWaiters: Array<(ready: PickierReady | undefined) => void> = []
  /** Set once the worker has said whether it found pickier. */
  status: 'starting' | 'ready' | 'unavailable' = 'starting'
  info: PickierReady | undefined
  unavailableReason = ''
  private exits = 0

  constructor(
    readonly root: string,
    private readonly start: () => PickierProcess,
    private readonly log: (message: string) => void,
  ) {}

  private ensureProcess(): PickierProcess | undefined {
    if (this.status === 'unavailable')
      return undefined
    if (this.process)
      return this.process

    const child = this.start()
    this.process = child
    this.status = 'starting'

    child.onLine((line) => {
      let message: any
      try {
        message = JSON.parse(line)
      }
      catch {
        return
      }

      if ('ready' in message) {
        if (message.ready) {
          this.status = 'ready'
          this.info = message as PickierReady
          this.log(`pickier ${this.info.version} ready for ${this.root}`)
        }
        else {
          this.status = 'unavailable'
          this.unavailableReason = message.error
          this.log(`pickier is not available in ${this.root}, so it is not linted: ${message.error}`)
        }
        for (const waiter of this.readyWaiters.splice(0))
          waiter(this.info)
        return
      }

      const resolve = this.pending.get(message.id)
      if (resolve) {
        this.pending.delete(message.id)
        resolve(message as PickierResponse)
      }
    })

    child.onExit(() => {
      if (this.process !== child)
        return
      this.process = undefined
      for (const resolve of this.pending.values())
        resolve(undefined)
      this.pending.clear()
      for (const waiter of this.readyWaiters.splice(0))
        waiter(undefined)

      // A worker that keeps dying (a broken Bun, a config that throws) would
      // otherwise be restarted on every keystroke.
      if (this.status !== 'unavailable' && ++this.exits >= 3) {
        this.status = 'unavailable'
        this.unavailableReason = 'the pickier process exited three times'
        this.log(`pickier keeps exiting in ${this.root}; run "Stacks: Restart Pickier" after fixing it`)
      }
    })

    return child
  }

  private whenReady(): Promise<PickierReady | undefined> {
    if (this.status === 'ready')
      return Promise.resolve(this.info)
    if (this.status === 'unavailable')
      return Promise.resolve(undefined)
    return new Promise(resolve => this.readyWaiters.push(resolve))
  }

  async request(op: PickierOperation, file: string, text: string): Promise<PickierResult | undefined> {
    const child = this.ensureProcess()
    if (!child || !(await this.whenReady()) || !this.process)
      return undefined

    const id = this.nextId++
    const request: PickierRequest = { id, op, file, text }
    const response = await new Promise<PickierResponse | undefined>((resolve) => {
      this.pending.set(id, resolve)
      this.process!.write(`${JSON.stringify(request)}\n`)
    })

    if (!response)
      return undefined
    if (!response.ok) {
      this.log(`pickier could not ${op} ${file}: ${response.error}`)
      return undefined
    }
    return response.result
  }

  dispose(): void {
    const child = this.process
    this.process = undefined
    child?.kill()
    for (const resolve of this.pending.values())
      resolve(undefined)
    this.pending.clear()
  }
}

export function createPickierSupport(api: Vscode, host: PickierHost, options: PickierOptions): {
  activate: (context: { subscriptions: Array<{ dispose: () => unknown }> }) => void
  deactivate: () => void
} {
  const clients = new Map<string, PickierClient>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const output = api.window.createOutputChannel('Stacks: Pickier')
  const diagnostics = api.languages.createDiagnosticCollection('pickier')
  const fixAllKind = api.CodeActionKind.SourceFixAll.append('pickier')
  const settings = () => api.workspace.getConfiguration('stacks')

  const enabled = () => settings().get<boolean>('pickier.enable', true)

  function rootOf(document: vscode.TextDocument): string | undefined {
    if (document.uri.scheme !== 'file')
      return undefined
    const folder = api.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    if (!folder || !(host.exists(join(folder, 'buddy')) || host.exists(join(folder, 'config', 'app.ts'))))
      return undefined
    return isLintedFile(folder, document.uri.fsPath) ? folder : undefined
  }

  function client(root: string): PickierClient {
    let existing = clients.get(root)
    if (!existing) {
      existing = new PickierClient(
        root,
        () => host.spawnBun(chooseBun(settings().get<string>('bunPath', ''), root, host.exists), options.workerPath, root),
        message => output.appendLine(message),
      )
      clients.set(root, existing)
    }
    return existing
  }

  async function run(document: vscode.TextDocument, op: PickierOperation): Promise<PickierResult | undefined> {
    const root = enabled() ? rootOf(document) : undefined
    if (!root)
      return undefined
    return client(root).request(op, document.uri.fsPath, document.getText())
  }

  function toDiagnostic(document: vscode.TextDocument, issue: PickierIssue): vscode.Diagnostic {
    const line = Math.min(Math.max(issue.line - 1, 0), Math.max(document.lineCount - 1, 0))
    const start = new api.Position(line, Math.max(issue.column - 1, 0))
    const range = document.getWordRangeAtPosition(start) ?? new api.Range(start, start.translate(0, 1))
    const diagnostic = new api.Diagnostic(
      range,
      issue.help ? `${issue.message}\n${issue.help}` : issue.message,
      issue.severity === 'error' ? api.DiagnosticSeverity.Error : api.DiagnosticSeverity.Warning,
    )
    diagnostic.source = 'pickier'
    diagnostic.code = issue.ruleId
    return diagnostic
  }

  async function lint(document: vscode.TextDocument): Promise<void> {
    const version = document.version
    const result = await run(document, 'lint')
    if (document.isClosed || document.version !== version)
      return
    if (!result || result.op !== 'lint') {
      diagnostics.delete(document.uri)
      return
    }
    diagnostics.set(document.uri, result.issues.map(issue => toDiagnostic(document, issue)))
  }

  function scheduleLint(document: vscode.TextDocument, delay = options.lintDelayMs ?? 300): void {
    const key = document.uri.toString()
    clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => {
      timers.delete(key)
      void lint(document)
    }, delay))
  }

  function wholeDocument(document: vscode.TextDocument): vscode.Range {
    return new api.Range(new api.Position(0, 0), document.lineAt(Math.max(document.lineCount - 1, 0)).range.end)
  }

  async function fixedText(document: vscode.TextDocument): Promise<string | undefined> {
    const result = await run(document, 'fix')
    if (!result || result.op === 'lint' || result.text === null || result.text === document.getText())
      return undefined
    return result.text
  }

  async function fixAllEdit(document: vscode.TextDocument): Promise<vscode.WorkspaceEdit | undefined> {
    const text = await fixedText(document)
    if (text === undefined)
      return undefined
    const edit = new api.WorkspaceEdit()
    edit.replace(document.uri, wholeDocument(document), text)
    return edit
  }

  function relintOpenDocuments(): void {
    diagnostics.clear()
    for (const document of api.workspace.textDocuments)
      scheduleLint(document, 0)
  }

  function stopClients(root?: string): void {
    for (const [key, existing] of clients) {
      if (root && key !== root)
        continue
      existing.dispose()
      clients.delete(key)
    }
  }

  function restart(root?: string): void {
    stopClients(root)
    relintOpenDocuments()
  }

  function stop(): void {
    for (const timer of timers.values())
      clearTimeout(timer)
    timers.clear()
    stopClients()
  }

  const codeActions: vscode.CodeActionProvider = {
    async provideCodeActions(document, range, context) {
      const actions: vscode.CodeAction[] = []
      const only = context.only

      if (only && (only.contains(fixAllKind) || fixAllKind.contains(only))) {
        const edit = await fixAllEdit(document)
        if (edit) {
          const action = new api.CodeAction('Fix all pickier problems', fixAllKind)
          action.edit = edit
          actions.push(action)
        }
        return actions
      }

      if (only && !only.contains(api.CodeActionKind.QuickFix))
        return actions

      const ours = context.diagnostics.filter(diagnostic => diagnostic.source === 'pickier')
      if (!ours.length)
        return actions

      const edit = await fixAllEdit(document)
      if (edit) {
        const action = new api.CodeAction('Fix all pickier problems', api.CodeActionKind.QuickFix)
        action.edit = edit
        action.diagnostics = ours
        actions.push(action)
      }

      const comment = LINE_COMMENT[document.languageId]
      if (comment) {
        for (const diagnostic of ours) {
          const ruleId = String(diagnostic.code ?? '')
          if (!ruleId)
            continue
          const line = document.lineAt(diagnostic.range.start.line)
          const disable = new api.CodeAction(`Disable ${ruleId} for this line`, api.CodeActionKind.QuickFix)
          disable.edit = new api.WorkspaceEdit()
          disable.edit.insert(document.uri, new api.Position(line.lineNumber, 0), disableNextLineComment(line.text, ruleId, comment))
          disable.diagnostics = [diagnostic]
          actions.push(disable)
        }
      }

      return actions
    },
  }

  const formatter: vscode.DocumentFormattingEditProvider = {
    async provideDocumentFormattingEdits(document) {
      const result = await run(document, 'format')
      if (!result || result.op === 'lint' || result.text === null || result.text === document.getText())
        return []
      return [api.TextEdit.replace(wholeDocument(document), result.text)]
    },
  }

  return {
    activate(context) {
      const selector = PICKIER_LANGUAGES.map(language => ({ language, scheme: 'file' }))

      context.subscriptions.push(
        output,
        diagnostics,
        api.languages.registerCodeActionsProvider(selector, codeActions, {
          providedCodeActionKinds: [fixAllKind, api.CodeActionKind.QuickFix],
        }),
        api.languages.registerDocumentFormattingEditProvider(selector, formatter),
        api.commands.registerCommand(PICKIER_COMMANDS.fixAll, async () => {
          const document = api.window.activeTextEditor?.document
          if (!document)
            return
          const edit = await fixAllEdit(document)
          if (edit)
            await api.workspace.applyEdit(edit)
          else
            void api.window.showInformationMessage('Stacks: pickier has nothing to fix in this file.')
        }),
        api.commands.registerCommand(PICKIER_COMMANDS.restart, () => restart()),
        api.workspace.onDidOpenTextDocument(document => scheduleLint(document, 0)),
        api.workspace.onDidChangeTextDocument((event) => {
          if (settings().get<string>('pickier.run', 'onType') === 'onType')
            scheduleLint(event.document)
        }),
        api.workspace.onDidSaveTextDocument((document) => {
          if (isPickierConfigPath(document.uri.fsPath)) {
            const folder = api.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
            restart(folder)
            return
          }
          scheduleLint(document, 0)
        }),
        api.workspace.onDidCloseTextDocument((document) => {
          clearTimeout(timers.get(document.uri.toString()))
          diagnostics.delete(document.uri)
        }),
        api.workspace.onDidChangeConfiguration((event) => {
          if (event.affectsConfiguration('stacks.pickier') || event.affectsConfiguration('stacks.bunPath'))
            restart()
        }),
        { dispose: stop },
      )

      for (const document of api.workspace.textDocuments)
        scheduleLint(document, 0)
    },

    deactivate: stop,
  }
}
