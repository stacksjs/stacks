/**
 * The controller in src/stacks.ts, driven through a fake `vscode` API and a
 * fake host - no editor, processes or sockets. The real `vscode` module only
 * exists inside the editor, which is why the controller takes the API as an
 * argument instead of importing it.
 */
import type { Host } from '../src/stacks'
import { describe, expect, it } from 'bun:test'
import { BUDDY_TERMINAL, COMMANDS, createStacksExtension, DEV_TERMINAL } from '../src/stacks'

type Listener<T> = (event: T) => unknown

function emitter<T>() {
  const listeners = new Set<Listener<T>>()
  const event = (listener: Listener<T>) => {
    listeners.add(listener)
    return { dispose: () => listeners.delete(listener) }
  }
  const fire = (value: T) => {
    for (const listener of [...listeners]) listener(value)
  }
  return { event, fire }
}

interface FakeTerminal {
  name: string
  exitStatus: { code: number | undefined } | undefined
  shellIntegration: any
  options: any
  sent: string[]
  executions: unknown[]
  shown: number
  show: () => void
  sendText: (text: string) => void
  dispose: () => void
}

interface Options {
  root?: string
  files?: Record<string, string>
  settings?: Record<string, unknown>
  open?: string[]
  listJson?: string
  listText?: string
  answers?: Array<string | undefined>
  shellIntegration?: boolean
  noBuddy?: boolean
}

function setup(options: Options = {}) {
  const root = options.root ?? '/work/app'
  const files: Record<string, string> = { ...(options.noBuddy ? {} : { [`${root}/buddy`]: '#!/bin/sh' }), ...options.files }
  const settings: Record<string, unknown> = options.settings ?? {}
  const answers = [...(options.answers ?? [])]

  const executed: Array<{ command: string, args: unknown[] }> = []
  const handlers = new Map<string, (...args: any[]) => any>()
  const messages: string[] = []
  const terminals: FakeTerminal[] = []
  const execs: string[][] = []
  const pickers: any[] = []
  const inputs: any[] = []

  const closeTerminal = emitter<FakeTerminal>()
  const shellIntegrationChanged = emitter<any>()
  const executionEnded = emitter<any>()

  const message = (text: string) => {
    messages.push(text)
    return Promise.resolve(answers.shift())
  }

  const api = {
    Uri: { parse: (value: string) => ({ value, toString: () => value }) },
    ViewColumn: { Active: -1, Beside: -2, One: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    commands: {
      registerCommand: (id: string, handler: (...args: any[]) => any) => {
        handlers.set(id, handler)
        return { dispose: () => handlers.delete(id) }
      },
      executeCommand: (command: string, ...args: unknown[]) => {
        executed.push({ command, args })
        return Promise.resolve(undefined)
      },
    },
    env: {
      asExternalUri: (uri: unknown) => Promise.resolve(uri),
      openExternal: () => Promise.resolve(true),
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: root }, name: 'app', index: 0 }],
      getWorkspaceFolder: () => undefined,
      getConfiguration: () => ({ get: (key: string, fallback: unknown) => key in settings ? settings[key] : fallback }),
      onDidChangeConfiguration: emitter<any>().event,
      createFileSystemWatcher: () => ({
        onDidCreate: emitter<any>().event,
        onDidChange: emitter<any>().event,
        onDidDelete: emitter<any>().event,
        dispose: () => {},
      }),
    },
    window: {
      activeTextEditor: undefined,
      terminals,
      onDidCloseTerminal: closeTerminal.event,
      onDidChangeTerminalShellIntegration: shellIntegrationChanged.event,
      onDidEndTerminalShellExecution: executionEnded.event,
      createTerminal: (terminalOptions: any) => {
        const terminal: FakeTerminal = {
          name: terminalOptions.name,
          exitStatus: undefined,
          shellIntegration: undefined,
          options: terminalOptions,
          sent: [],
          executions: [],
          shown: 0,
          show: () => { terminal.shown++ },
          sendText: (text: string) => { terminal.sent.push(text) },
          dispose: () => {
            terminal.exitStatus = { code: undefined }
            terminals.splice(terminals.indexOf(terminal), 1)
            closeTerminal.fire(terminal)
          },
        }
        if (options.shellIntegration) {
          terminal.shellIntegration = {
            executeCommand: (commandLine: string) => {
              terminal.sent.push(commandLine)
              const execution = {
                async* read() {
                  yield 'Starting...\n'
                  yield '  ➜  App     :    https://stacks.localhost/dashboard\n'
                },
              }
              terminal.executions.push(execution)
              return execution
            },
          }
        }
        terminals.push(terminal)
        return terminal
      },
      createStatusBarItem: () => ({ text: '', tooltip: undefined, command: undefined, name: undefined, visible: false, show() { this.visible = true }, hide() { this.visible = false }, dispose() {} }),
      createQuickPick: () => {
        const changed = emitter<string>()
        const accepted = emitter<void>()
        const hidden = emitter<void>()
        const picker = {
          value: '',
          title: undefined,
          placeholder: undefined,
          items: [] as any[],
          selectedItems: [] as any[],
          busy: false,
          matchOnDescription: false,
          onDidChangeValue: changed.event,
          onDidAccept: accepted.event,
          onDidHide: hidden.event,
          show: () => {},
          hide: () => hidden.fire(),
          dispose: () => {},
          type(value: string) {
            picker.value = value
            changed.fire(value)
          },
          accept(item?: any) {
            picker.selectedItems = item ? [item] : []
            accepted.fire()
          },
        }
        pickers.push(picker)
        return picker
      },
      showInputBox: (inputOptions: any) => {
        inputs.push(inputOptions)
        return Promise.resolve(answers.shift())
      },
      showInformationMessage: message,
      showWarningMessage: message,
      showErrorMessage: message,
    },
  }

  const host: Host = {
    exists: path => path in files,
    read: path => files[path],
    exec: async (file, args) => {
      execs.push([file, ...args])
      if (args.includes('--json')) {
        if (options.listJson === undefined)
          throw new Error('unknown option --json')
        return options.listJson
      }
      return options.listText ?? ''
    },
    probe: async (host, port) => (options.open ?? []).includes(`${host}:${port}`),
    sleep: () => new Promise(resolve => setTimeout(resolve, 1)),
  }

  // Short waits, so a test never sits out the real 3s/120s timeouts.
  const extension = createStacksExtension(api as any, host, { shellIntegrationMs: 5, devReadyMs: 200, bannerGraceMs: 50 })
  const context = { subscriptions: [] as Array<{ dispose: () => unknown }> }
  extension.activate(context)

  const run = (id: string) => handlers.get(id)!()
  const previews = () => executed.filter(call => call.command.startsWith('simpleBrowser')).map(call => String(call.args[0]))
  const flush = () => new Promise(resolve => setTimeout(resolve, 20))

  return { api, context, executed, handlers, messages, terminals, execs, pickers, inputs, run, previews, flush, closeTerminal, executionEnded }
}

describe('activation', () => {
  it('registers the three commands and marks the workspace as a Stacks project', () => {
    const { handlers, executed } = setup()
    expect([...handlers.keys()].sort()).toEqual([COMMANDS.openPreview, COMMANDS.runBuddyCommand, COMMANDS.startDevServer].sort())
    expect(executed).toContainEqual({ command: 'setContext', args: ['stacks.isProject', true] })
  })

  it('stays out of the way in a workspace that is not a Stacks project', () => {
    // The extension also activates for .stx files anywhere, for its stx support.
    const { handlers, executed, context } = setup({ noBuddy: true })
    expect(executed).toContainEqual({ command: 'setContext', args: ['stacks.isProject', false] })
    expect(handlers.size).toBe(3)
    expect(context.subscriptions.some((item: any) => 'text' in item)).toBeFalse()
  })
})

describe('Stacks: Open Preview', () => {
  it('opens the pretty URL beside the editor when the server and proxy answer', async () => {
    const { run, executed } = setup({ open: ['localhost:3000', 'stacks.localhost:443'] })
    await run(COMMANDS.openPreview)

    const call = executed.find(entry => entry.command === 'simpleBrowser.api.open')!
    expect(String(call.args[0])).toBe('https://stacks.localhost')
    expect(call.args[1]).toEqual({ viewColumn: -2, preserveFocus: true })
  })

  it('reads PORT and APP_URL from the project env files', async () => {
    const { run, previews } = setup({
      files: { '/work/app/.env': 'APP_URL=http://localhost\nPORT=3140' },
      open: ['localhost:3140'],
    })
    await run(COMMANDS.openPreview)
    expect(previews()).toEqual(['http://localhost:3140'])
  })

  it('uses the stacks.preview.url override without probing', async () => {
    const { run, previews } = setup({ settings: { 'preview.url': 'http://localhost:4000/admin' } })
    await run(COMMANDS.openPreview)
    expect(previews()).toEqual(['http://localhost:4000/admin'])
  })

  it('offers to start the dev server when nothing is listening', async () => {
    const { run, messages, previews, terminals } = setup({ answers: ['Open Anyway'] })
    await run(COMMANDS.openPreview)

    expect(messages[0]).toContain('nothing is listening on localhost:3000')
    expect(previews()).toEqual(['https://stacks.localhost'])
    expect(terminals).toHaveLength(0)
  })

  it('falls back to simpleBrowser.show when the api command is unavailable', async () => {
    const env = setup({ open: ['localhost:3000'], settings: { 'preview.preferLocalhost': true } })
    env.api.commands.executeCommand = (command: string, ...args: unknown[]) => {
      env.executed.push({ command, args })
      return command === 'simpleBrowser.api.open' ? Promise.reject(new Error('not found')) : Promise.resolve(undefined)
    }
    await env.run(COMMANDS.openPreview)
    expect(env.executed.at(-1)).toEqual({ command: 'simpleBrowser.show', args: ['http://localhost:3000'] })
  })
})

describe('Stacks: Start Dev Server', () => {
  it('runs ./buddy dev in a named terminal at the project root, without the system browser', async () => {
    const { run, terminals } = setup({ settings: { 'devServer.openPreview': true } })
    await run(COMMANDS.startDevServer)

    expect(terminals).toHaveLength(1)
    expect(terminals[0]!.name).toBe(DEV_TERMINAL)
    expect(terminals[0]!.options).toMatchObject({ cwd: '/work/app', env: { STACKS_DEV_NO_OPEN: '1' } })
    // No shell integration, so the command is typed in.
    expect(terminals[0]!.sent).toEqual(['./buddy dev'])
  })

  it('opens the preview once the frontend port answers when output cannot be read', async () => {
    const { run, previews, flush } = setup({ open: ['localhost:3000'], settings: { 'preview.preferLocalhost': true } })
    await run(COMMANDS.startDevServer)
    await flush()
    expect(previews()).toEqual(['http://localhost:3000'])
  })

  it('passes stacks.devServer.args and lets buddy open the browser when previews are off', async () => {
    const { run, terminals } = setup({ shellIntegration: true, settings: { 'devServer.args': ['frontend'], 'devServer.openPreview': false } })
    await run(COMMANDS.startDevServer)
    expect(terminals[0]!.sent).toEqual(['./buddy dev frontend'])
    expect(terminals[0]!.options.env).toBeUndefined()
  })

  it('opens the exact URL from the dev banner once it is printed', async () => {
    const { run, previews, flush } = setup({ shellIntegration: true })
    await run(COMMANDS.startDevServer)
    await flush()
    expect(previews()).toEqual(['https://stacks.localhost/dashboard'])
  })

  it('does not type into a dev terminal that may still be serving', async () => {
    const { run, terminals, messages } = setup({ shellIntegration: true, settings: { 'devServer.openPreview': false } })
    await run(COMMANDS.startDevServer)
    await run(COMMANDS.startDevServer)

    expect(terminals).toHaveLength(1)
    expect(terminals[0]!.sent).toEqual(['./buddy dev'])
    expect(messages.at(-1)).toContain('already open')
  })

  it('restarts in a fresh terminal on request', async () => {
    const { run, terminals } = setup({ shellIntegration: true, settings: { 'devServer.openPreview': false }, answers: ['Restart'] })
    await run(COMMANDS.startDevServer)
    const first = terminals[0]
    await run(COMMANDS.startDevServer)

    expect(terminals).toHaveLength(1)
    expect(terminals[0]).not.toBe(first)
    expect(terminals[0]!.sent).toEqual(['./buddy dev'])
  })

  it('reuses the terminal once the dev command has ended', async () => {
    const { run, terminals, executionEnded } = setup({ shellIntegration: true, settings: { 'devServer.openPreview': false } })
    await run(COMMANDS.startDevServer)
    executionEnded.fire({ terminal: terminals[0], execution: terminals[0]!.executions[0], exitCode: 130 })
    await run(COMMANDS.startDevServer)

    expect(terminals).toHaveLength(1)
    expect(terminals[0]!.sent).toEqual(['./buddy dev', './buddy dev'])
  })

  it('refuses to run without a ./buddy at the root', async () => {
    // config/app.ts alone makes it a Stacks project, but there is no CLI to run.
    const { run, terminals, messages } = setup({ noBuddy: true, files: { '/work/app/config/app.ts': 'export default {}' } })
    await run(COMMANDS.startDevServer)

    expect(terminals).toHaveLength(0)
    expect(messages[0]).toContain('there is no ./buddy in /work/app')
  })
})

describe('Stacks: Run Buddy Command...', () => {
  const listJson = JSON.stringify({
    commands: [
      { name: 'migrate', description: 'Migrates your database', arguments: [] },
      { name: 'make:model', description: 'Create a new Model', usage: '$ buddy make:model <name>', arguments: [{ name: 'name', required: true, variadic: false }] },
    ],
  })

  it('lists commands from ./buddy list --json at the project root, never a buddy off the PATH', async () => {
    const { run, pickers, execs } = setup({ listJson })
    await run(COMMANDS.runBuddyCommand)

    expect(execs).toEqual([['/work/app/buddy', 'list', '--json']])
    expect(pickers[0].items.map((item: any) => item.label)).toEqual(['make:model', 'migrate'])
    expect(pickers[0].busy).toBe(false)
  })

  it('falls back to parsing the text listing', async () => {
    const { run, pickers, execs } = setup({ listText: 'Available Commands:\n\nGeneral:\n  inspire   Inspire yourself\n' })
    await run(COMMANDS.runBuddyCommand)

    expect(execs).toEqual([['/work/app/buddy', 'list', '--json'], ['/work/app/buddy', 'list']])
    expect(pickers[0].items.map((item: any) => item.label)).toEqual(['inspire'])
  })

  it('runs a picked command in the Stacks Buddy terminal', async () => {
    const { run, pickers, terminals, flush } = setup({ listJson })
    await run(COMMANDS.runBuddyCommand)
    pickers[0].accept(pickers[0].items.find((item: any) => item.label === 'migrate'))
    await flush()

    expect(terminals.map(terminal => [terminal.name, terminal.options.cwd, terminal.sent])).toEqual([[BUDDY_TERMINAL, '/work/app', ['./buddy migrate']]])
  })

  it('asks for the arguments a command declares', async () => {
    const { run, pickers, terminals, inputs, flush } = setup({ listJson, answers: ['Post'] })
    await run(COMMANDS.runBuddyCommand)
    pickers[0].accept(pickers[0].items.find((item: any) => item.label === 'make:model'))
    await flush()

    expect(inputs[0].placeHolder).toBe('<name>')
    expect(inputs[0].validateInput('')).toContain('<name>')
    expect(terminals[0]!.sent).toEqual(['./buddy make:model Post'])
  })

  it('runs typed text as a command, appended after the matches', async () => {
    const { run, pickers, terminals, flush } = setup({ listJson })
    await run(COMMANDS.runBuddyCommand)
    pickers[0].type('buddy migrate --diff')

    const last = pickers[0].items.at(-1)
    expect(last.label).toBe('./buddy migrate --diff')
    pickers[0].accept(last)
    await flush()
    expect(terminals[0]!.sent).toEqual(['./buddy migrate --diff'])
  })

  it('still accepts free text when ./buddy list fails', async () => {
    const { run, pickers, terminals, flush } = setup()
    await run(COMMANDS.runBuddyCommand)
    expect(pickers[0].placeholder).toContain('Could not read ./buddy list')

    pickers[0].type('test --unit')
    pickers[0].accept()
    await flush()
    expect(terminals[0]!.sent).toEqual(['./buddy test --unit'])
  })

  it('reuses the Stacks Buddy terminal', async () => {
    const { run, pickers, terminals, flush } = setup({ listJson })
    await run(COMMANDS.runBuddyCommand)
    pickers[0].accept(pickers[0].items[1])
    await flush()
    await run(COMMANDS.runBuddyCommand)
    pickers[1].accept(pickers[1].items[1])
    await flush()

    expect(terminals).toHaveLength(1)
    expect(terminals[0]!.sent).toEqual(['./buddy migrate', './buddy migrate'])
  })
})
