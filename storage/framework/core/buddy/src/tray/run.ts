import type { RegisteredProject } from '@stacksjs/path'
import { randomUUID } from 'node:crypto'
import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { daemonStatus, openProjectDashboard, startDaemon } from '@stacksjs/actions/daemon/client'
import { daemonDir } from '@stacksjs/actions/daemon/paths'
import { acquireMigrationLock } from '@stacksjs/database/migration-lock'
import { craftDevCommand, resolveCraftExecutable } from '@stacksjs/desktop-build'
import { isCompiledBinary, listProjects, projectCliEntry } from '@stacksjs/path'
import { generateCss, renderTemplateString } from '@stacksjs/stx'
import { createTrayApi } from './api'
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
  })
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 4096,
    fetch(request, server) {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/'))
        return api(request, server.url.origin)
      if (url.pathname !== '/' || request.method !== 'GET')
        return new Response('Not found', { status: 404 })
      return new Response(document, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    },
  })
  process.once('SIGINT', quit)
  process.once('SIGTERM', quit)
  try {
    const url = new URL(server.url)
    url.hash = token
    const command = craftDevCommand(server.port!, {
      craftBin: craft,
      url: url.href,
      title: 'Buddy',
      width: 376,
      height: 488,
      trayPopover: true,
      hotReload: false,
      devTools: false,
    })
    // Craft logs the launch URL, including its private fragment.
    child = Bun.spawn(command, { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
    const code = await child.exited
    if (code !== 0 && child.signalCode === null)
      throw new Error(`Craft exited with status ${code}. Use a Craft build with --tray-popover support.`)
  }
  finally {
    process.off('SIGINT', quit)
    process.off('SIGTERM', quit)
    await server.stop(true)
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
