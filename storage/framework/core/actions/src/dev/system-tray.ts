import { homedir, networkInterfaces } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { openDevWindow } from '@stacksjs/desktop'
import { projectPath, storagePath } from '@stacksjs/path'
import { findStacksProjects } from '@stacksjs/utils'
import { findAvailablePort, waitForServer } from './dashboard-utils'

interface TrayActionRequest {
  action?: string
  project?: string
  confirmed?: boolean
}

const preferredPort = Number(process.env.PORT_SYSTEM_TRAY) || 3009
const port = await findAvailablePort(preferredPort)
const trayViews = storagePath('framework/defaults/views/system-tray')
const appUrl = process.env.APP_URL || 'stacks.test'
const domain = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
const hasPrettyDomain = !domain.includes('localhost:') && domain !== 'localhost'
const trayDomain = hasPrettyDomain ? `tray.${domain}` : null
const localUrl = `http://localhost:${port}`

let cachedProjects: string[] | undefined
async function discoverProjects(refresh = false): Promise<string[]> {
  if (cachedProjects && !refresh)
    return cachedProjects

  const discovered = await findStacksProjects(join(homedir(), 'Code'), { quiet: true }).catch(() => [])
  const candidates = [...new Set([projectPath(), ...discovered])]
  const checks = await Promise.all(candidates.map(async project => ({
    project,
    valid: await Bun.file(join(project, 'buddy')).exists(),
  })))
  cachedProjects = checks
    .filter(check => check.valid)
    .map(check => check.project)
    .sort((a, b) => basename(a).localeCompare(basename(b)))
  return cachedProjects
}

async function runBuddy(project: string, args: string[]): Promise<{ output: string, exitCode: number }> {
  const child = Bun.spawn([join(project, 'buddy'), ...args, '--no-interaction'], {
    cwd: project,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { output: [stdout, stderr].filter(Boolean).join('\n').trim(), exitCode }
}

function openPath(path: string): void {
  const command = process.platform === 'darwin'
    ? ['open', path]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', path]
      : ['xdg-open', path]
  Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' }).unref()
}

function openTerminal(project: string): void {
  const command = process.platform === 'darwin'
    ? ['open', '-a', 'Terminal', project]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', 'cmd', '/K', `cd /d ${project}`]
      : ['x-terminal-emulator', '--working-directory', project]
  Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' }).unref()
}

function localIpAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal)
        return address.address
    }
  }
  return '127.0.0.1'
}

function dashboardUrl(path = ''): string {
  const base = hasPrettyDomain ? `https://dashboard.${domain}` : `http://localhost:${Number(process.env.PORT_ADMIN) || 3002}`
  return `${base}${path}`
}

async function handleAction(input: TrayActionRequest): Promise<Response> {
  const projects = await discoverProjects()
  const project = input.project || projectPath()
  if (!projects.includes(project))
    return Response.json({ ok: false, error: 'Unknown Stacks project' }, { status: 400 })

  switch (input.action) {
    case 'refresh':
      return Response.json({ ok: true, projects: await discoverProjects(true) })
    case 'open-terminal':
      openTerminal(project)
      return Response.json({ ok: true, message: `Opened Terminal in ${basename(project)}` })
    case 'env-check': {
      const result = await runBuddy(project, ['doctor'])
      return Response.json({ ok: result.exitCode === 0, ...result })
    }
    case 'settings':
      openPath(dashboardUrl('/settings'))
      return Response.json({ ok: true, message: 'Opened dashboard settings' })
    case 'check-updates': {
      const result = await runBuddy(project, ['outdated'])
      return Response.json({ ok: result.exitCode === 0, ...result })
    }
    case 'copy-ip':
      return Response.json({ ok: true, value: localIpAddress(), message: 'IP address ready to copy' })
    case 'open-dashboard':
      openPath(dashboardUrl())
      return Response.json({ ok: true, message: 'Opened dashboard' })
    case 'buddy-commands': {
      const result = await runBuddy(project, ['list'])
      return Response.json({ ok: result.exitCode === 0, ...result })
    }
    case 'deploy': {
      if (!input.confirmed)
        return Response.json({ ok: false, confirmationRequired: true, error: 'Deployment confirmation required' }, { status: 409 })
      const child = Bun.spawn([join(project, 'buddy'), 'deploy', '--no-interaction'], {
        cwd: project,
        stdout: 'inherit',
        stderr: 'inherit',
      })
      child.unref()
      return Response.json({ ok: true, message: `Deployment started for ${basename(project)}` })
    }
    case 'deploy-logs':
      openPath(join(project, 'storage/logs'))
      return Response.json({ ok: true, message: 'Opened deployment logs' })
    case 'site-logs':
      openPath(join(project, 'storage/logs'))
      return Response.json({ ok: true, message: 'Opened site logs' })
    case 'error-logs':
      openPath(join(project, 'storage/logs'))
      return Response.json({ ok: true, message: 'Opened error logs' })
    case 'edit-env':
      openPath(join(project, '.env'))
      return Response.json({ ok: true, message: 'Opened .env' })
    case 'edit-dns':
      openPath(join(project, 'config/dns.ts'))
      return Response.json({ ok: true, message: 'Opened DNS configuration' })
    case 'edit-email':
      openPath(join(project, 'config/email.ts'))
      return Response.json({ ok: true, message: 'Opened email configuration' })
    case 'ask-buddy':
      openPath(dashboardUrl('/buddy'))
      return Response.json({ ok: true, message: 'Opened Ask Buddy' })
    default:
      return Response.json({ ok: false, error: 'Unknown tray action' }, { status: 400 })
  }
}

const { serve } = await import('bun-plugin-stx/serve')
const serverPromise = serve({
  patterns: [trayViews],
  port,
  componentsDir: storagePath('framework/defaults/resources/components'),
  quiet: true,
  auth: false,
  routes: {
    '/api/tray/projects': async () => Response.json({ ok: true, projects: await discoverProjects() }),
    '/api/tray/action': async (request: Request) => {
      if (request.method !== 'POST')
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      return handleAction(await request.json() as TrayActionRequest)
    },
  },
} as any)
serverPromise.catch((error: Error) => {
  console.error(`System tray server failed: ${error.message}`)
  process.exit(1)
})

let proxyStarted = false
if (trayDomain && !process.env.STACKS_PROXY_MANAGED) {
  try {
    const { startProxies } = await import('@stacksjs/rpx')
    await startProxies({
      proxies: [{ from: `localhost:${port}`, to: trayDomain, cleanUrls: false }],
      https: { basePath: `${process.env.HOME}/.stacks/ssl`, validityDays: 825 },
      regenerateUntrustedCerts: false,
    })
    proxyStarted = true
  }
  catch {
    proxyStarted = false
  }
}

await waitForServer(port, 2_000)
const url = trayDomain && proxyStarted ? `https://${trayDomain}` : localUrl
console.log()
console.log(`  ${bold(cyan('stacks tray'))}`)
console.log()
console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(url)}`)
if (trayDomain) console.log(`  ${dim('➜')}  ${dim('Origin')}:  ${dim(localUrl)}`)
console.log()

await openDevWindow(port, {
  url,
  title: 'Stacks',
  width: 440,
  height: 680,
  systemTray: true,
  hideDockIcon: true,
  hotReload: true,
})

const stop = () => {
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
await new Promise(() => {})
