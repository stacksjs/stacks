import type * as vscode from 'vscode'
import type { BuddyCommand, PreviewPlan, Probe } from './project'
import { join } from 'node:path'
import {
  argumentHint,
  buddyCommandLine,
  choosePreviewUrl,
  freeTextCommandLine,
  isLoopbackUrl,
  loadProjectEnv,
  parseBuddyListJson,
  parseBuddyListText,
  parseDevBannerUrl,
  pickProjectRoot,
  planPreview,
  requiresArguments,
} from './project'

type Vscode = typeof vscode

/**
 * What the extension needs from the machine, injected so the controller can
 * be tested with a fake `vscode` and no real processes, sockets or files.
 */
export interface Host {
  exists: (path: string) => boolean
  /** Decrypt an env file's `encrypted:` value for the preview; ./env.ts builds it. */
  decryptEnv?: (root: string) => (file: string, value: string) => string | undefined
  /** File contents, or `undefined` when the file does not exist. */
  read: (path: string) => string | undefined
  /** Run `file` with `args` in `cwd` and resolve its stdout. */
  exec: (file: string, args: string[], cwd: string) => Promise<string>
  probe: Probe
  sleep: (ms: number) => Promise<void>
}

export const COMMANDS = {
  openPreview: 'stacks.openPreview',
  startDevServer: 'stacks.startDevServer',
  runBuddyCommand: 'stacks.runBuddyCommand',
} as const

export const DEV_TERMINAL = 'Stacks Dev'
export const BUDDY_TERMINAL = 'Stacks Buddy'

export interface Timing {
  /** How long to wait for a new terminal's shell integration before typing blind. */
  shellIntegrationMs: number
  /** How long `Start Dev Server` waits for the server before giving up on the preview. */
  devReadyMs: number
  /** How long to trust the banner alone before also probing ports. */
  bannerGraceMs: number
}

const DEFAULT_TIMING: Timing = {
  shellIntegrationMs: 3000,
  devReadyMs: 120_000,
  bannerGraceMs: 15_000,
}

interface DevRun {
  terminal: vscode.Terminal
  running: boolean
  /** Whether output is being read through shell integration (so the banner URL will arrive). */
  capturing: boolean
  url?: string
}

interface CommandItem extends vscode.QuickPickItem {
  command?: BuddyCommand
  freeText?: string
}

export function createStacksExtension(api: Vscode, host: Host, timingOverrides: Partial<Timing> = {}): {
  activate: (context: { subscriptions: Array<{ dispose: () => unknown }> }) => void
  deactivate: () => void
} {
  const timing: Timing = { ...DEFAULT_TIMING, ...timingOverrides }
  let devRun: DevRun | undefined
  let statusItem: vscode.StatusBarItem | undefined
  const commandLists = new Map<string, Promise<BuddyCommand[]>>()

  const settings = () => api.workspace.getConfiguration('stacks')

  function isProject(folder: string): boolean {
    return host.exists(join(folder, 'buddy')) || host.exists(join(folder, 'config', 'app.ts'))
  }

  function projectRoot(): string | undefined {
    const folders = (api.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath)
    const activeUri = api.window.activeTextEditor?.document.uri
    const preferred = activeUri ? api.workspace.getWorkspaceFolder(activeUri)?.uri.fsPath : undefined
    const root = pickProjectRoot(folders, preferred, isProject)

    if (!root)
      void api.window.showErrorMessage('Stacks: open a Stacks project folder (one containing ./buddy) first.')

    return root
  }

  /** The root, if it has the `./buddy` the command is about to run. */
  function buddyRoot(): string | undefined {
    const root = projectRoot()
    if (root && !host.exists(join(root, 'buddy'))) {
      void api.window.showErrorMessage(`Stacks: there is no ./buddy in ${root}. Run the command from the project root, or run \`buddy install\` there first.`)
      return undefined
    }

    return root
  }

  function previewPlan(root: string): PreviewPlan {
    return planPreview({
      env: loadProjectEnv(file => host.read(join(root, file)), undefined, host.decryptEnv?.(root)),
      appConfigSource: host.read(join(root, 'config', 'app.ts')),
      preferLocalhost: settings().get<boolean>('preview.preferLocalhost', false),
    })
  }

  async function openInSimpleBrowser(url: string): Promise<void> {
    let target = api.Uri.parse(url)
    // In a remote window (SSH, WSL, Codespaces) the dev server's localhost is
    // the remote machine's; this forwards the port and returns the local URL.
    if (isLoopbackUrl(url))
      target = await api.env.asExternalUri(target)

    try {
      // The Simple Browser's extension-facing command, which takes a column,
      // so the preview opens beside the editor instead of replacing it.
      await api.commands.executeCommand('simpleBrowser.api.open', target, {
        viewColumn: api.ViewColumn.Beside,
        preserveFocus: true,
      })
    }
    catch {
      await api.commands.executeCommand('simpleBrowser.show', target.toString(true))
    }
  }

  async function openPreview(): Promise<void> {
    const override = settings().get<string>('preview.url', '').trim()
    if (override)
      return openInSimpleBrowser(override)

    const root = projectRoot()
    if (!root)
      return

    if (devRun?.running && devRun.url)
      return openInSimpleBrowser(devRun.url)

    const plan = previewPlan(root)
    const url = await choosePreviewUrl(plan, host.probe)
    if (url)
      return openInSimpleBrowser(url)

    const choice = await api.window.showWarningMessage(
      `Stacks: nothing is listening on ${plan.server.host}:${plan.server.port}. Is the dev server running?`,
      'Start Dev Server',
      'Open Anyway',
    )

    if (choice === 'Start Dev Server')
      await startDevServer({ openPreview: true })
    else if (choice === 'Open Anyway')
      await openInSimpleBrowser(plan.candidates[0]!.url)
  }

  function findTerminal(name: string): vscode.Terminal | undefined {
    return api.window.terminals.find(terminal => terminal.name === name && terminal.exitStatus === undefined)
  }

  function waitForShellIntegration(terminal: vscode.Terminal): Promise<vscode.TerminalShellIntegration | undefined> {
    if (terminal.shellIntegration)
      return Promise.resolve(terminal.shellIntegration)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        subscription.dispose()
        resolve(undefined)
      }, timing.shellIntegrationMs)

      const subscription = api.window.onDidChangeTerminalShellIntegration((event) => {
        if (event.terminal !== terminal)
          return

        clearTimeout(timer)
        subscription.dispose()
        resolve(event.shellIntegration)
      })
    })
  }

  /**
   * Run the dev server in `run.terminal`. With shell integration, the output is
   * read to pick up the banner URL and the end of the command; without it the
   * command is typed into the terminal and the ports are probed instead.
   */
  async function launchDevServer(run: DevRun, commandLine: string): Promise<void> {
    const integration = await waitForShellIntegration(run.terminal)
    if (!integration) {
      run.terminal.sendText(commandLine)
      return
    }

    const execution = integration.executeCommand(commandLine)
    run.capturing = true

    const ended = api.window.onDidEndTerminalShellExecution((event) => {
      if (event.execution !== execution)
        return

      run.running = false
      run.url = undefined
      ended.dispose()
      updateStatus()
    })

    void (async () => {
      let tail = ''
      for await (const chunk of execution.read()) {
        if (run.url)
          continue

        tail = (tail + chunk).slice(-16_384)
        run.url = parseDevBannerUrl(tail)
      }
    })().catch(() => {
      run.capturing = false
    })
  }

  async function openWhenReady(run: DevRun, root: string): Promise<void> {
    const plan = previewPlan(root)
    const startedAt = Date.now()
    updateStatus('starting')

    try {
      while (devRun === run && run.running && Date.now() - startedAt < timing.devReadyMs) {
        if (run.url)
          return await openInSimpleBrowser(run.url)

        if (!run.capturing || Date.now() - startedAt > timing.bannerGraceMs) {
          const url = await choosePreviewUrl(plan, host.probe)
          if (url)
            return await openInSimpleBrowser(url)
        }

        await host.sleep(1000)
      }
    }
    finally {
      updateStatus()
    }
  }

  async function startDevServer(options: { openPreview?: boolean } = {}): Promise<void> {
    const root = buddyRoot()
    if (!root)
      return

    const existing = findTerminal(DEV_TERMINAL)
    const knownFinished = existing !== undefined && devRun?.terminal === existing && !devRun.running

    // A dev terminal this extension did not see finish may still be serving:
    // it was started earlier in this window, or revived with the window.
    // Typing `./buddy dev` into it would go to the running server's stdin.
    if (existing && !knownFinished) {
      existing.show(true)
      const choice = await api.window.showInformationMessage(
        'Stacks: the dev server terminal is already open.',
        'Open Preview',
        'Restart',
      )

      if (choice === 'Open Preview')
        return openPreview()
      if (choice !== 'Restart')
        return

      existing.dispose()
      devRun = undefined
    }

    const shouldOpenPreview = options.openPreview ?? settings().get<boolean>('devServer.openPreview', true)
    const terminal = knownFinished && existing
      ? existing
      : api.window.createTerminal({
          name: DEV_TERMINAL,
          cwd: root,
          // The preview opens inside VS Code, so `buddy dev` should not also
          // open the system browser (core/buddy/src/commands/dev.ts).
          env: shouldOpenPreview ? { STACKS_DEV_NO_OPEN: '1' } : undefined,
        })

    terminal.show(true)

    const run: DevRun = { terminal, running: true, capturing: false }
    devRun = run
    await launchDevServer(run, buddyCommandLine('dev', settings().get<string[]>('devServer.args', [])))

    if (shouldOpenPreview)
      void openWhenReady(run, root)
  }

  function listBuddyCommands(root: string): Promise<BuddyCommand[]> {
    const cached = commandLists.get(root)
    if (cached)
      return cached

    const buddy = join(root, 'buddy')
    const listing = (async () => {
      const json = await host.exec(buddy, ['list', '--json'], root).catch(() => '')
      const fromJson = parseBuddyListJson(json)
      if (fromJson?.length)
        return fromJson

      const fromText = parseBuddyListText(await host.exec(buddy, ['list'], root))
      if (!fromText.length)
        throw new Error('`./buddy list` printed no commands')

      return fromText
    })()

    commandLists.set(root, listing)
    listing.catch(() => commandLists.delete(root))
    return listing
  }

  function runInBuddyTerminal(root: string, commandLine: string): void {
    const terminal = findTerminal(BUDDY_TERMINAL) ?? api.window.createTerminal({ name: BUDDY_TERMINAL, cwd: root })
    terminal.show()
    terminal.sendText(commandLine)
  }

  async function runPickedCommand(root: string, item: CommandItem): Promise<void> {
    if (item.freeText !== undefined) {
      const commandLine = freeTextCommandLine(item.freeText)
      if (commandLine)
        runInBuddyTerminal(root, commandLine)
      return
    }

    const command = item.command
    if (!command)
      return

    let args = ''
    if (command.arguments.length) {
      const required = requiresArguments(command)
      const answer = await api.window.showInputBox({
        title: buddyCommandLine(command.name),
        prompt: command.usage ? `Usage: ${command.usage}` : command.description,
        placeHolder: argumentHint(command),
        ignoreFocusOut: true,
        validateInput: value => required && !value.trim() ? `Arguments: ${argumentHint(command)}` : undefined,
      })

      if (answer === undefined)
        return

      args = answer
    }

    runInBuddyTerminal(root, buddyCommandLine(command.name, args))
  }

  async function runBuddyCommand(): Promise<void> {
    const root = buddyRoot()
    if (!root)
      return

    const picker = api.window.createQuickPick<CommandItem>()
    picker.title = 'Run Buddy Command'
    picker.placeholder = 'Loading ./buddy list ... or type any command, e.g. migrate --diff'
    picker.matchOnDescription = true
    picker.busy = true

    let commands: BuddyCommand[] = []
    const render = () => {
      const value = picker.value.trim()
      const items: CommandItem[] = commands.map(command => ({
        label: command.name,
        description: command.description,
        detail: command.arguments.length ? `${command.name} ${argumentHint(command)}` : undefined,
        command,
      }))

      // Typed text that is not exactly a command name runs as typed. It goes
      // last so Enter on a partial name still picks the filtered command.
      if (value && !commands.some(command => command.name === value))
        items.push({ label: freeTextCommandLine(value) ?? value, description: 'Run as typed', alwaysShow: true, freeText: value })

      picker.items = items
    }

    picker.onDidChangeValue(render)
    picker.onDidHide(() => picker.dispose())
    picker.onDidAccept(() => {
      const typed = picker.value.trim()
      const item = picker.selectedItems[0] ?? (typed ? { label: typed, freeText: typed } : undefined)
      picker.hide()
      if (item)
        void runPickedCommand(root, item)
    })
    picker.show()

    try {
      commands = await listBuddyCommands(root)
      picker.placeholder = 'Pick a buddy command, or type one with arguments'
    }
    catch {
      picker.placeholder = 'Could not read ./buddy list - type a command to run, e.g. migrate --diff'
    }
    finally {
      picker.busy = false
      render()
    }
  }

  function updateStatus(state: 'idle' | 'starting' = 'idle'): void {
    if (!statusItem)
      return

    if (!settings().get<boolean>('statusBar.enabled', true)) {
      statusItem.hide()
      return
    }

    statusItem.text = state === 'starting' ? '$(loading~spin) Stacks' : '$(globe) Stacks'
    statusItem.tooltip = state === 'starting'
      ? 'Waiting for the Stacks dev server...'
      : 'Open the Stacks dev server in the Simple Browser'
    statusItem.show()
  }

  function activate(context: { subscriptions: Array<{ dispose: () => unknown }> }): void {
    // The extension also activates for `.stx` files outside Stacks projects
    // (it provides stx support everywhere), so the Stacks commands and the
    // status item only appear when a workspace folder is a Stacks project.
    const project = (api.workspace.workspaceFolders ?? []).some(folder => isProject(folder.uri.fsPath))
    void api.commands.executeCommand('setContext', 'stacks.isProject', project)

    if (project) {
      statusItem = api.window.createStatusBarItem('stacks.preview', api.StatusBarAlignment.Left, 0)
      statusItem.name = 'Stacks Preview'
      statusItem.command = COMMANDS.openPreview
      context.subscriptions.push(statusItem)
      updateStatus()
    }

    // Custom commands live in app/Commands and need no registration, so a new
    // file there is a new buddy command: forget the cached list.
    const commandFiles = api.workspace.createFileSystemWatcher('**/app/Commands/**')
    const forgetCommands = () => commandLists.clear()

    context.subscriptions.push(
      commandFiles,
      commandFiles.onDidCreate(forgetCommands),
      commandFiles.onDidChange(forgetCommands),
      commandFiles.onDidDelete(forgetCommands),
      api.commands.registerCommand(COMMANDS.openPreview, openPreview),
      api.commands.registerCommand(COMMANDS.startDevServer, () => startDevServer()),
      api.commands.registerCommand(COMMANDS.runBuddyCommand, runBuddyCommand),
      api.window.onDidCloseTerminal((terminal) => {
        if (devRun?.terminal === terminal)
          devRun = undefined
      }),
      api.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('stacks.statusBar'))
          updateStatus()
      }),
    )
  }

  function deactivate(): void {
    devRun = undefined
    commandLists.clear()
  }

  return { activate, deactivate }
}
