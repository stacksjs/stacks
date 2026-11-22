import type { RegisteredProject } from '@stacksjs/path'
import { randomUUID } from 'node:crypto'
import { accessSync, constants, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { daemonStatus, openProjectDashboard, startDaemon } from '@stacksjs/actions/daemon/client'
import { daemonDir } from '@stacksjs/actions/daemon/paths'
import { acquireMigrationLock } from '@stacksjs/database/migration-lock'
import { craftDevCommand, resolveCraftExecutable } from '@stacksjs/desktop-build'
import { isCompiledBinary, listProjects, projectCliEntry } from '@stacksjs/path'
import { generateCss, renderTemplateString } from '@stacksjs/stx'
import { createTrayApi } from './api'
import { createTrayPantry } from './pantry'
import { createSystemSampler } from './system'
import view from './view.stx' with { type: 'text' }

function shellArgument(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function reviewScript(path: string, command: string[]): string {
  return `#!/bin/sh\nrm -f -- "$0"\ncd -- ${shellArgument(path)} || exit 1\nexec ${command.map(shellArgument).join(' ')} generate:review\n`
}

function reviewCommand(project: RegisteredProject): string[] {
  const shim = join(project.path, 'buddy')
  try {
    accessSync(shim, constants.X_OK)
    return [shim]
  }
  catch {
    const entry = projectCliEntry(project.path)
    if (!entry)
      throw new Error('Install Stacks in this project before opening its review.')
    const bun = isCompiledBinary() ? Bun.which('bun') : process.execPath
    if (!bun)
      throw new Error('Install Bun before opening this project’s review.')
    return [bun, '--no-install', ...(entry.endsWith('.ts') ? ['--conditions=development'] : []), entry]
  }
}

async function openMac(...args: string[]): Promise<void> {
  const child = Bun.spawn(['/usr/bin/open', ...args], { stdout: 'ignore', stderr: 'pipe' })
  const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()])
  if (code !== 0)
    throw new Error(error.trim() || 'macOS could not open this item.')
}

async function openReview(project: RegisteredProject): Promise<void> {
  const script = reviewScript(project.path, reviewCommand(project))
  const directory = daemonDir('tray-reviews')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, `Buddy Review ${randomUUID()}.command`)
  writeFileSync(path, script, { flag: 'wx', mode: 0o700 })
  try {
    await openMac('-a', 'Terminal', path)
  }
  catch (error) {
    rmSync(path, { force: true })
    throw error
  }
}

export async function renderTray(): Promise<string> {
  const path = join(import.meta.dir, 'view.stx')
  const [html, css] = await Promise.all([
    renderTemplateString(view, path, { title: 'Buddy', wrapInDocument: true, processClientScripts: true }),
    generateCss(view, import.meta.dir),
  ])
  return html.replace('</head>', `<style>${css}</style></head>`)
}

async function launchTray(craft: string): Promise<void> {
  const document = await renderTray()
  const token = randomUUID()
  let child: ReturnType<typeof Bun.spawn> | undefined
  const quit = () => child?.kill()
  const api = createTrayApi(token, {
    status: daemonStatus,
    projects: listProjects,
    start: startDaemon,
    dashboard: async ({ path }) => openMac((await openProjectDashboard(path)).url),
    review: openReview,
    quit: () => setTimeout(quit, 50),
    system: createSystemSampler(),
    pantry: createTrayPantry(),
  }, 'http://localhost') // Craft uses this base origin for inline HTML.
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 4096,
    fetch(request, server) {
      const url = new URL(request.url)
      return url.pathname.startsWith('/api/') ? api(request, server.url.origin) : new Response('Not found', { status: 404 })
    },
  })
  process.once('SIGINT', quit)
  process.once('SIGTERM', quit)
  let directory: string | undefined
  try {
    directory = mkdtempSync(daemonDir('tray-window-'))
    const htmlFile = join(directory, 'index.html')
    const origin = server.url.origin
    const policy = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data:; connect-src ${origin}; base-uri 'none'; form-action 'none'`
    const launch = JSON.stringify({ origin, token })
    const head = `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><script>globalThis.buddyTray = ${launch}</script>`
    // Other local users can see process arguments. Give Craft a private file
    // instead of putting the capability in a URL on its command line.
    writeFileSync(htmlFile, document.replace('<head>', head), { flag: 'wx', mode: 0o600 })
    const command = craftDevCommand(server.port!, {
      craftBin: craft,
      htmlFile,
      title: 'Buddy',
      width: 396,
      height: 506,
      trayPopover: true,
      hotReload: false,
      devTools: false,
    })
    child = Bun.spawn(command, { stdin: 'ignore', stdout: 'ignore', stderr: 'inherit' })
    const code = await child.exited
    if (code !== 0 && child.signalCode === null)
      throw new Error(`Craft exited with status ${code}. Use a Craft build with --tray-popover support.`)
  }
  finally {
    process.off('SIGINT', quit)
    process.off('SIGTERM', quit)
    await server.stop(true)
    if (directory) rmSync(directory, { recursive: true, force: true })
  }
}

export async function runTray(): Promise<void> {
  if (process.platform !== 'darwin')
    throw new Error('Buddy’s native menu-bar app requires macOS.')

  const craft = resolveCraftExecutable()
  mkdirSync(daemonDir(), { recursive: true, mode: 0o700 })
  const lock = await acquireMigrationLock('sqlite', null, { sqliteLockPath: daemonDir('tray.lock'), timeoutMs: 0 })
    .catch((error: Error) => {
      if (error.message.includes('another migration is in progress'))
        throw new Error('The Buddy menu-bar app is already running.')
      throw error
    })
  try {
    await launchTray(craft)
  }
  finally {
    await lock.release()
  }
}
