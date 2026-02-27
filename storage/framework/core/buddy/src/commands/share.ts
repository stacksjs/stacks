import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import {
  runApiDevServer,
  runDashboardDevServer,
  runDesktopDevServer,
  runDocsDevServer,
  runFrontendDevServer,
} from '@stacksjs/actions'
import { bold, cyan, dim, green, intro, log, outro, spinner } from '@stacksjs/cli'
import { ports as configPorts } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'

interface ShareOptions {
  port?: string
  server?: string
  subdomain?: string
  verbose?: boolean
}

interface TunnelInfo {
  url: string
  subdomain: string
  close: () => Promise<void>
}

// Suppress all stdout/stderr noise from dev servers during startup
const originalStdoutWrite = process.stdout.write.bind(process.stdout)
const originalStderrWrite = process.stderr.write.bind(process.stderr)
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info
let _muted = false
let _verboseBuffer: string[] = []

function muteOutput(): void {
  _muted = true
  _verboseBuffer = []

  const filter = (fn: typeof process.stdout.write): typeof process.stdout.write => {
    return function (chunk: any, ...args: any[]) {
      if (_muted) {
        _verboseBuffer.push(String(chunk))
        return true
      }
      return fn(chunk, ...args)
    } as typeof process.stdout.write
  }

  process.stdout.write = filter(originalStdoutWrite)
  process.stderr.write = filter(originalStderrWrite)
  console.log = (...args: any[]) => { if (!_muted) originalConsoleLog(...args) }
  console.error = (...args: any[]) => { if (!_muted) originalConsoleError(...args) }
  console.warn = (...args: any[]) => { if (!_muted) originalConsoleWarn(...args) }
  console.info = (...args: any[]) => { if (!_muted) originalConsoleInfo(...args) }
}

function unmuteOutput(): void {
  _muted = false
  process.stdout.write = originalStdoutWrite
  process.stderr.write = originalStderrWrite
  console.log = originalConsoleLog
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
  console.info = originalConsoleInfo
}

async function waitForPort(port: number, host = 'localhost', timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${host}:${port}`, { signal: AbortSignal.timeout(1000) })
      await res.arrayBuffer()
      return
    }
    catch {
      await Bun.sleep(300)
    }
  }
  throw new Error(`Timed out waiting for server on port ${port}`)
}

const devServerRunners: Record<string, (opts: any) => Promise<any>> = {
  frontend: runFrontendDevServer,
  api: runApiDevServer,
  backend: runApiDevServer,
  admin: runDashboardDevServer,
  dashboard: runDashboardDevServer,
  desktop: runDesktopDevServer,
  docs: runDocsDevServer,
}

interface CompanionDef {
  port: number
  suffix: string
  label: string
  runner: (opts: any) => Promise<any>
}

const companionServices: Record<string, CompanionDef[]> = {
  frontend: [
    { port: configPorts?.api || 3008, suffix: 'api', label: 'API', runner: runApiDevServer },
    { port: configPorts?.docs || 3006, suffix: 'docs', label: 'Docs', runner: runDocsDevServer },
  ],
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function share(buddy: CLI): void {
  buddy
    .command('share [type]', 'Share your local development server via a public tunnel')
    .option('-p, --port <port>', 'Local port to share')
    .option('--server <url>', 'Tunnel server URL', { default: 'api.localtunnel.dev' })
    .option('--subdomain <name>', 'Request a specific subdomain')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async (type: string | undefined, options: ShareOptions) => {
      const perf = await intro('buddy share')

      const serviceType = type || 'frontend'
      const defaultPorts: Record<string, number> = {
        frontend: configPorts?.frontend || 3000,
        api: configPorts?.api || 3008,
        backend: configPorts?.backend || 3001,
        admin: configPorts?.admin || 3002,
        dashboard: configPorts?.admin || 3002,
        library: configPorts?.library || 3003,
        desktop: configPorts?.desktop || 3004,
        email: configPorts?.email || 3005,
        docs: configPorts?.docs || 3006,
        inspect: configPorts?.inspect || 3007,
      }

      const port = options.port
        ? Number.parseInt(options.port)
        : defaultPorts[serviceType] || 3000

      if (Number.isNaN(port) || port < 1 || port > 65535) {
        log.error(`Invalid port: ${options.port}`)
        process.exit(ExitCode.InvalidArgument)
      }

      const server = options.server || 'api.localtunnel.dev'
      const tunnels: TunnelInfo[] = []
      const companions = companionServices[serviceType] || []
      const s = spinner()

      try {
        const { localTunnel } = await import('@stacksjs/tunnel')

        // --- Phase 1: Start dev servers (mute their noisy output) ---
        console.log()

        const runner = devServerRunners[serviceType]
        if (runner) {
          s.start(`Starting ${serviceType} dev server...`)
          muteOutput()
          runner({ verbose: options.verbose ?? false } as any).catch(() => {})
          await waitForPort(port)
          unmuteOutput()
          s.succeed(`${bold(capitalize(serviceType))} ready ${dim(`on :${port}`)}`)
        }

        // Start companion servers in parallel
        const startedCompanions: CompanionDef[] = []

        if (companions.length > 0) {
          s.start(`Starting companion services...`)
          muteOutput()

          // Fire all runners
          for (const companion of companions) {
            companion.runner({ verbose: options.verbose ?? false } as any).catch(() => {})
          }

          // Wait for each, track which started (60s timeout — API can be slow to boot)
          const results = await Promise.allSettled(
            companions.map(c => waitForPort(c.port, 'localhost', 60_000)),
          )

          unmuteOutput()

          for (let i = 0; i < companions.length; i++) {
            if (results[i].status === 'fulfilled') {
              startedCompanions.push(companions[i])
              s.succeed(`${bold(companions[i].label)} ready ${dim(`on :${companions[i].port}`)}`)
            }
            else {
              s.fail(`${companions[i].label} failed to start ${dim(`on :${companions[i].port}`)}`)
            }
          }
        }

        // --- Phase 2: Create tunnels ---
        console.log()
        s.start('Creating tunnel...')

        const primaryTunnel = await localTunnel({
          port,
          server,
          subdomain: options.subdomain,
          verbose: options.verbose,
          onRequest: (req) => {
            if (options.verbose)
              console.log(`  ${dim(`${req.method} ${req.url}`)}`)
          },
          onReconnecting: (info) => {
            s.start(`Reconnecting... (attempt ${info.attempt})`)
          },
        })
        tunnels.push(primaryTunnel)

        // Create companion tunnels only for services that actually started
        const baseSubdomain = primaryTunnel.subdomain
        for (const companion of startedCompanions) {
          try {
            const companionTunnel = await localTunnel({
              port: companion.port,
              server,
              subdomain: `${baseSubdomain}-${companion.suffix}`,
              verbose: options.verbose,
              onReconnecting: (info) => {
                s.start(`${companion.label}: reconnecting... (attempt ${info.attempt})`)
              },
            })
            tunnels.push(companionTunnel)
          }
          catch {
            // non-fatal
          }
        }

        s.succeed(`Connected ${dim(`to ${server}`)}`)

        // --- Phase 3: Print summary ---
        const entries: Array<{ label: string, url: string, local: string }> = [
          { label: capitalize(serviceType), url: primaryTunnel.url, local: `localhost:${port}` },
        ]

        for (const companion of startedCompanions) {
          const tunnel = tunnels.find(t => t.subdomain === `${baseSubdomain}-${companion.suffix}`)
          if (tunnel)
            entries.push({ label: companion.label, url: tunnel.url, local: `localhost:${companion.port}` })
        }

        const maxLabel = Math.max(...entries.map(e => e.label.length))

        console.log()
        for (const entry of entries) {
          const padding = ' '.repeat(maxLabel - entry.label.length + 1)
          console.log(`  ${green('➜')}  ${bold(entry.label)}${padding} ${cyan(entry.url)}`)
        }

        console.log()
        for (const entry of entries) {
          const padding = ' '.repeat(maxLabel - entry.label.length + 1)
          console.log(`     ${dim(entry.label)}${dim(padding)}${dim(entry.url)} ${dim('→')} ${dim(entry.local)}`)
        }

        console.log()
        console.log(`  ${dim('press Ctrl+C to stop')}`)
        console.log()

        // --- Cleanup ---
        const cleanup = async () => {
          console.log()
          s.start('Closing tunnels...')
          await Promise.all(tunnels.map(t => t.close()))
          s.succeed('Tunnels closed')
          outro('Stopped sharing', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        process.on('SIGINT', () => cleanup())
        process.on('SIGTERM', () => cleanup())

        await new Promise(() => {})
      }
      catch (error: any) {
        unmuteOutput()
        s.fail(error.message)

        if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
          log.error(`Could not reach tunnel server at ${server}`)
          log.info(`Verify with: curl -sk https://${server}/status`)
        }
        else {
          log.error(`Failed to create tunnel: ${error.message}`)
        }

        if (options.verbose)
          log.error(error.stack)

        for (const t of tunnels) t.close()
        await outro('Share failed', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }
    })
}
