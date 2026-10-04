/**
 * The extension entry VS Code loads (`main` in package.json, bundled to
 * dist/extension.js). It wires the real machine into the controllers and
 * starts each part; the behavior lives in the modules it imports:
 *
 * - ./stacks.ts   preview, dev server and buddy commands
 * - ./pickier.ts  lint diagnostics, formatting and fix-all from the project's pickier
 * - ./env.ts      decrypted env values on hover, missing keys, `buddy env:*` commands
 * - stx           the stx extension's language support, built in from `@stacksjs/stx-vscode`,
 *                 and its TypeScript server plugin, which type-checks `.stx` files
 *
 * Nothing here depends on another extension being installed.
 */
import type { PickierProcess } from './pickier'
import type { Host } from './stacks'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { activateStxLanguage, configureTypeScriptPlugin, deactivateStxLanguage, STX_EXTENSION_ID } from '@stacksjs/stx-vscode'
import * as vscode from 'vscode'
import { createEnvSupport, projectDecryptor } from './env'
import { createPickierSupport } from './pickier'
import { createStacksExtension } from './stacks'

const PROBE_TIMEOUT_MS = 500

function read(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  }
  catch {
    return undefined
  }
}

function exec(file: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, {
      cwd,
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    }, (error, stdout) => error ? reject(error) : resolve(String(stdout)))
  })
}

const envHost = { exists: existsSync, read, exec, environment: process.env }

const host: Host = {
  exists: path => existsSync(path),
  read,
  exec,

  probe(hostname, port) {
    return new Promise((resolve) => {
      const socket = connect({ host: hostname, port })
      const finish = (open: boolean) => {
        socket.destroy()
        resolve(open)
      }

      socket.setTimeout(PROBE_TIMEOUT_MS)
      socket.once('connect', () => finish(true))
      socket.once('timeout', () => finish(false))
      socket.once('error', () => finish(false))
    })
  },

  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),

  decryptEnv: root => projectDecryptor(envHost, root),
}

/**
 * `bun --config=<empty> dist/pickier-worker.js` in the project root. The
 * explicit config keeps the project's bunfig.toml out: its `preload` boots the
 * framework (env decryption, auto-imports), which pickier does not need.
 */
function spawnBun(bun: string, script: string, cwd: string): PickierProcess {
  const child = spawn(bun, [`--config=${join(script, '..', 'pickier-worker.bunfig.toml')}`, script], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  const lines = createInterface({ input: child.stdout })
  let exited = false
  const exitListeners: Array<() => void> = []
  const exit = () => {
    if (exited)
      return
    exited = true
    for (const listener of exitListeners)
      listener()
  }
  child.once('exit', exit)
  child.once('error', exit)
  child.stderr.resume()

  return {
    write: line => child.stdin.write(line),
    onLine: listener => lines.on('line', listener),
    onExit: listener => exitListeners.push(listener),
    kill: () => child.kill(),
  }
}

const stacks = createStacksExtension(vscode, host)
const env = createEnvSupport(vscode, envHost)
let pickier: ReturnType<typeof createPickierSupport> | undefined

/**
 * What `activate` resolves to. The stx extension (Stacks.vscode-stx) reads
 * `stx.active` and stands down when it is true, so the two never register
 * stx support twice in one window.
 */
export interface StacksExtensionApi {
  stx: { active: boolean }
}

async function startStx(context: vscode.ExtensionContext): Promise<boolean> {
  try {
    await activateStxLanguage(context, {
      assetsPath: join(context.extensionPath, 'dist', 'stx'),
      // The stx extension contributes the snippets in its manifest; offering
      // them here as well would show each one twice.
      snippets: !vscode.extensions.getExtension(STX_EXTENSION_ID),
    })
    return true
  }
  catch (error) {
    console.error('Stacks: stx support failed to start', error)
    return false
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<StacksExtensionApi> {
  // The manifest contributes the stx TypeScript server plugin. VS Code's
  // TypeScript extension does not activate on `stx` by itself, so this starts
  // it, and forwards `stxTypescriptPlugin.enabled` to the plugin. The stx
  // extension, when installed, does the same; the plugin decorates a project
  // once however many extensions contribute it.
  configureTypeScriptPlugin(vscode, context.subscriptions).catch((error) => {
    console.error('Stacks: could not configure the stx TypeScript plugin', error)
  })

  stacks.activate(context)
  env.activate(context)
  pickier = createPickierSupport(vscode, { exists: existsSync, spawnBun }, {
    workerPath: join(context.extensionPath, 'dist', 'pickier-worker.js'),
  })
  pickier.activate(context)

  return { stx: { active: await startStx(context) } }
}

export function deactivate(): void {
  stacks.deactivate()
  pickier?.deactivate()
  deactivateStxLanguage()
}
