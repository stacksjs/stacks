/**
 * Stacks env files, built in: decrypted values on hover, keys missing against
 * `.env.example`, and the `buddy env:*` commands from the Command Palette.
 *
 * Plaintext only ever exists in memory and on screen. The hover decrypts with
 * `@stacksjs/env`'s own code (./env-file.ts) and nothing is cached, logged or
 * written; the commands run the project's `./buddy` directly (no shell, so a
 * value typed for `env:set` does not land in shell history).
 */
import type * as vscode from 'vscode'
import { basename, dirname, join, relative } from 'node:path'
import { decryptEnvValue, envEntryAt, isEncrypted, isEnvFile, missingKeys } from './env-file'

type Vscode = typeof vscode

export interface EnvHost {
  exists: (path: string) => boolean
  read: (path: string) => string | undefined
  exec: (file: string, args: string[], cwd: string) => Promise<string>
  environment: Record<string, string | undefined>
}

export const ENV_COMMANDS = {
  get: 'stacks.env.get',
  set: 'stacks.env.set',
  encrypt: 'stacks.env.encrypt',
  decrypt: 'stacks.env.decrypt',
  rotate: 'stacks.env.rotate',
} as const

function isProject(host: EnvHost, folder: string): boolean {
  return host.exists(join(folder, 'buddy')) || host.exists(join(folder, 'config', 'app.ts'))
}

/**
 * The `.env.keys` for an env file: beside it, else at the project root, where
 * `./buddy env:*` looks for it.
 */
export function keysFileFor(host: EnvHost, envFile: string, root: string | undefined): string | undefined {
  for (const dir of [dirname(envFile), root]) {
    if (!dir)
      continue
    const source = host.read(join(dir, '.env.keys'))
    if (source !== undefined)
      return source
  }
  return undefined
}

/**
 * A decryptor for `loadProjectEnv`, so the preview can read an encrypted
 * `APP_URL` or `PORT` with the same keys the hover uses.
 */
export function projectDecryptor(host: EnvHost, root: string): (file: string, value: string) => string | undefined {
  return (file, value) => {
    const path = join(root, file)
    const result = decryptEnvValue(path, value, keysFileFor(host, path, root), host.environment)
    return result.ok ? result.value : undefined
  }
}

export function createEnvSupport(api: Vscode, host: EnvHost): {
  activate: (context: { subscriptions: Array<{ dispose: () => unknown }> }) => void
} {
  const diagnostics = api.languages.createDiagnosticCollection('stacks-env')
  const settings = () => api.workspace.getConfiguration('stacks')

  function rootFor(uri: vscode.Uri): string | undefined {
    const folder = api.workspace.getWorkspaceFolder(uri)?.uri.fsPath
    return folder && isProject(host, folder) ? folder : undefined
  }

  function projectRoot(): string | undefined {
    const active = api.window.activeTextEditor?.document.uri
    const fromActive = active ? rootFor(active) : undefined
    if (fromActive)
      return fromActive
    return (api.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath).find(folder => isProject(host, folder))
  }

  const hover: vscode.HoverProvider = {
    provideHover(document, position) {
      if (!isEnvFile(document.uri.fsPath) || !settings().get<boolean>('env.decryptOnHover', true))
        return undefined

      const entry = envEntryAt(document.lineAt(position.line).text)
      if (!entry || !isEncrypted(entry.value) || position.character < entry.start - 1 || position.character > entry.end + 1)
        return undefined

      const root = rootFor(document.uri)
      const result = decryptEnvValue(document.uri.fsPath, entry.value, keysFileFor(host, document.uri.fsPath, root), host.environment)
      const markdown = new api.MarkdownString()
      const range = new api.Range(position.line, entry.start, position.line, entry.end)

      if (result.ok) {
        markdown.appendMarkdown(`**${entry.key}**, decrypted with \`${result.key.name}\` from ${result.key.from === '.env.keys' ? '`.env.keys`' : 'the environment'}:`)
        markdown.appendCodeblock(result.value, 'text')
      }
      else if (result.reason === 'no-key') {
        markdown.appendMarkdown(`**${entry.key}** is encrypted. No private key to decrypt it: looked for ${result.looked.map(name => `\`${name}\``).join(' and ')} in \`.env.keys\` and the environment.`)
      }
      else {
        markdown.appendMarkdown(`**${entry.key}** did not decrypt with \`${result.key.name}\`. The value or the key is wrong, or it was encrypted for another key.`)
      }

      return new api.Hover(markdown, range)
    },
  }

  function checkMissingKeys(document: vscode.TextDocument): void {
    const path = document.uri.fsPath
    if (basename(path) === '.env.example') {
      const env = api.workspace.textDocuments.find(open => open.uri.fsPath === join(dirname(path), '.env'))
      if (env)
        checkMissingKeys(env)
      return
    }

    if (basename(path) !== '.env' || !settings().get<boolean>('env.missingKeys', true)) {
      diagnostics.delete(document.uri)
      return
    }

    const example = host.read(join(dirname(path), '.env.example'))
    if (example === undefined) {
      diagnostics.delete(document.uri)
      return
    }

    const top = new api.Range(0, 0, 0, Math.max(document.lineAt(0).text.length, 1))
    diagnostics.set(document.uri, missingKeys(example, document.getText()).map((key) => {
      const diagnostic = new api.Diagnostic(top, `${key} is in .env.example but not set here.`, api.DiagnosticSeverity.Information)
      diagnostic.source = 'stacks'
      diagnostic.code = 'missing-env-key'
      return diagnostic
    }))
  }

  /** The env file a command acts on: the open one, or `.env`. */
  function targetFile(root: string): string {
    const active = api.window.activeTextEditor?.document.uri.fsPath
    return active && isEnvFile(active) && !relative(root, active).startsWith('..') ? relative(root, active) : '.env'
  }

  async function buddy(root: string, args: string[]): Promise<string | undefined> {
    try {
      return await host.exec(join(root, 'buddy'), args, root)
    }
    catch (error) {
      // The error carries the command's stderr, never the value: values are
      // only ever arguments, and execFile does not echo arguments.
      void api.window.showErrorMessage(`Stacks: ./buddy ${args[0]} failed. ${error instanceof Error ? error.message.split('\n')[0] : ''}`)
      return undefined
    }
  }

  async function askKey(root: string, file: string, prompt: string): Promise<string | undefined> {
    const keys = Object.keys(parseKeys(host.read(join(root, file))))
    if (keys.length) {
      const picked = await api.window.showQuickPick(keys, { title: `${prompt} (${file})`, placeHolder: 'Key' })
      return picked
    }
    return (await api.window.showInputBox({ title: `${prompt} (${file})`, prompt: 'Key' }))?.trim() || undefined
  }

  function parseKeys(source: string | undefined): Record<string, true> {
    const keys: Record<string, true> = {}
    for (const line of (source ?? '').split(/\r?\n/)) {
      const entry = envEntryAt(line)
      if (entry && !entry.key.startsWith('DOTENV_PUBLIC_KEY'))
        keys[entry.key] = true
    }
    return keys
  }

  async function getValue(): Promise<void> {
    const root = projectRoot()
    if (!root)
      return
    const file = targetFile(root)
    const key = await askKey(root, file, 'Get an env value')
    if (!key)
      return
    const value = await buddy(root, ['env:get', key, '--file', file])
    if (value === undefined)
      return
    const choice = await api.window.showInformationMessage(`${key} is set in ${file}.`, 'Copy Value')
    if (choice === 'Copy Value')
      await api.env.clipboard.writeText(value.replace(/\r?\n$/, ''))
  }

  async function setValue(): Promise<void> {
    const root = projectRoot()
    if (!root)
      return
    const file = targetFile(root)
    const key = (await api.window.showInputBox({ title: `Set an env value (${file})`, prompt: 'Key', validateInput: value => /^[A-Z_a-z][\w.-]*$/.test(value.trim()) ? undefined : 'Letters, digits and underscores, not starting with a digit' }))?.trim()
    if (!key)
      return
    const value = await api.window.showInputBox({ title: `Set ${key} (${file})`, prompt: 'Value. It is encrypted when the file is.', password: true })
    if (value === undefined)
      return
    if (await buddy(root, ['env:set', key, value, '--file', file]) !== undefined)
      void api.window.showInformationMessage(`Stacks: set ${key} in ${file}.`)
  }

  async function wholeFile(command: 'env:encrypt' | 'env:decrypt' | 'env:rotate', warning?: string): Promise<void> {
    const root = projectRoot()
    if (!root)
      return
    const file = targetFile(root)
    if (warning) {
      const confirmed = await api.window.showWarningMessage(warning.replace('{file}', file), { modal: true }, 'Continue')
      if (confirmed !== 'Continue')
        return
    }
    if (await buddy(root, [command, '--file', file]) !== undefined)
      void api.window.showInformationMessage(`Stacks: ./buddy ${command} finished for ${file}.`)
  }

  return {
    activate(context) {
      context.subscriptions.push(
        diagnostics,
        api.languages.registerHoverProvider([{ scheme: 'file', pattern: '**/.env*' }, { language: 'dotenv' }], hover),
        api.workspace.onDidOpenTextDocument(checkMissingKeys),
        api.workspace.onDidChangeTextDocument(event => checkMissingKeys(event.document)),
        api.workspace.onDidSaveTextDocument(checkMissingKeys),
        api.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)),
        api.commands.registerCommand(ENV_COMMANDS.get, getValue),
        api.commands.registerCommand(ENV_COMMANDS.set, setValue),
        api.commands.registerCommand(ENV_COMMANDS.encrypt, () => wholeFile('env:encrypt')),
        api.commands.registerCommand(ENV_COMMANDS.decrypt, () => wholeFile('env:decrypt', 'This writes every value in {file} to disk in plaintext. Encrypt it again before committing.')),
        api.commands.registerCommand(ENV_COMMANDS.rotate, () => wholeFile('env:rotate', 'This generates a new keypair for {file} and re-encrypts every value with it. Deployments still holding the old private key will no longer decrypt it.')),
      )

      for (const document of api.workspace.textDocuments)
        checkMissingKeys(document)
    },
  }
}
