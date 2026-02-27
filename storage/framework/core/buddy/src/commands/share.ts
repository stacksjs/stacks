import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import {
  runApiDevServer,
  runDashboardDevServer,
  runDesktopDevServer,
  runDocsDevServer,
  runFrontendDevServer,
} from '@stacksjs/actions'
import { bold, cyan, dim, green, intro, log, outro } from '@stacksjs/cli'
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
  close: () => void
}

async function waitForPort(port: number, host = 'localhost', timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${host}:${port}`, { signal: AbortSignal.timeout(1000) })
      await res.arrayBuffer() // consume body
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

// Services that are always started alongside the primary service
const companionServices: Record<string, { port: number, suffix: string, runner: (opts: any) => Promise<any> }[]> = {
  frontend: [
    { port: Number(process.env.PORT_API) || 3001, suffix: 'api', runner: runApiDevServer },
    { port: Number(process.env.PORT_DOCS) || 3006, suffix: 'docs', runner: runDocsDevServer },
  ],
}

export function share(buddy: CLI): void {
  const descriptions = {
    share: 'Share your local development server via a public tunnel',
    port: 'Local port to share (overrides default for the given type)',
    server: 'Tunnel server URL (default: localtunnel.dev)',
    subdomain: 'Request a specific subdomain',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('share [type]', descriptions.share)
    .option('-p, --port <port>', descriptions.port)
    .option('--server <url>', descriptions.server, { default: 'localtunnel.dev' })
    .option('--subdomain <name>', descriptions.subdomain)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (type: string | undefined, options: ShareOptions) => {
      const perf = await intro('buddy share')

      const serviceType = type || 'frontend'
      const defaultPorts: Record<string, number> = {
        frontend: Number(process.env.PORT) || 3000,
        api: Number(process.env.PORT_API) || 3001,
        backend: Number(process.env.PORT_API) || 3001,
        admin: Number(process.env.PORT_ADMIN) || 3002,
        dashboard: Number(process.env.PORT_ADMIN) || 3002,
        library: Number(process.env.PORT_LIBRARY) || 3003,
        desktop: Number(process.env.PORT_DESKTOP) || 3004,
        email: Number(process.env.PORT_EMAIL) || 3005,
        docs: Number(process.env.PORT_DOCS) || 3006,
        inspect: Number(process.env.PORT_INSPECT) || 3007,
      }

      const port = options.port
        ? Number.parseInt(options.port)
        : defaultPorts[serviceType] || 3000

      if (Number.isNaN(port) || port < 1 || port > 65535) {
        log.error(`Invalid port: ${options.port}`)
        process.exit(ExitCode.InvalidArgument)
      }

      const server = options.server || 'localtunnel.dev'
      const tunnels: TunnelInfo[] = []

      console.log()

      try {
        const { localTunnel } = await import('@stacksjs/tunnel')

        // Start the primary dev server
        const runner = devServerRunners[serviceType]
        if (runner) {
          console.log(`  ${green('➜')}  ${bold('Starting')}:  ${cyan(serviceType)} ${dim(`dev server on port ${port}`)}`)
          runner({ verbose: options.verbose ?? false } as any).catch((err: any) => {
            if (options.verbose)
              console.log(`  ${dim(`Dev server error: ${err.message}`)}`)
          })
          await waitForPort(port)
        }

        // Start companion services (api, docs, etc.)
        const companions = companionServices[serviceType] || []
        for (const companion of companions) {
          console.log(`  ${green('➜')}  ${bold('Starting')}:  ${cyan(companion.suffix)} ${dim(`dev server on port ${companion.port}`)}`)
          companion.runner({ verbose: options.verbose ?? false } as any).catch((err: any) => {
            if (options.verbose)
              console.log(`  ${dim(`${companion.suffix} dev server error: ${err.message}`)}`)
          })
        }

        // Wait for companion servers in parallel
        await Promise.all(companions.map(c => waitForPort(c.port).catch(() => {
          if (options.verbose)
            console.log(`  ${dim(`Warning: ${c.suffix} server on port ${c.port} did not start`)}`)
        })))

        console.log(`  ${dim('➜')}  ${dim(`Connecting to ${server}...`)}`)

        // Create the primary tunnel
        const primaryTunnel = await localTunnel({
          port,
          server,
          subdomain: options.subdomain,
          verbose: options.verbose,
          onConnect: (info) => {
            if (options.verbose)
              console.log(`  ${dim(`Connected: ${info.url}`)}`)
          },
          onRequest: (req) => {
            if (options.verbose)
              console.log(`  ${dim('→')} ${req.method} ${req.url}`)
          },
          onResponse: (res) => {
            if (options.verbose)
              console.log(`  ${dim('←')} ${res.status} ${dim(`(${res.size} bytes, ${res.duration}ms)`)}`)
          },
          onError: (error) => {
            if (options.verbose)
              console.log(`  ${dim('✗')} ${error.message}`)
          },
          onReconnecting: (info) => {
            console.log(`  ${dim('↻')} Reconnecting... (attempt ${info.attempt})`)
          },
        })
        tunnels.push(primaryTunnel)

        // Create companion tunnels with suffixed subdomains
        const baseSubdomain = primaryTunnel.subdomain
        for (const companion of companions) {
          try {
            const companionTunnel = await localTunnel({
              port: companion.port,
              server,
              subdomain: `${baseSubdomain}-${companion.suffix}`,
              verbose: options.verbose,
              onError: (error) => {
                if (options.verbose)
                  console.log(`  ${dim(`✗ ${companion.suffix}: ${error.message}`)}`)
              },
              onReconnecting: (info) => {
                console.log(`  ${dim(`↻ ${companion.suffix}: reconnecting... (attempt ${info.attempt})`)}`)
              },
            })
            tunnels.push(companionTunnel)
          }
          catch (err: any) {
            if (options.verbose)
              console.log(`  ${dim(`Warning: could not create tunnel for ${companion.suffix}: ${err.message}`)}`)
          }
        }

        // Print all tunnel URLs
        console.log()
        console.log(`  ${green('➜')}  ${bold('Frontend')}:  ${cyan(primaryTunnel.url)}`)
        for (let i = 0; i < companions.length; i++) {
          const companion = companions[i]
          const tunnel = tunnels[i + 1] // +1 because primary is at index 0
          if (tunnel) {
            const label = companion.suffix.charAt(0).toUpperCase() + companion.suffix.slice(1)
            console.log(`  ${green('➜')}  ${bold(`${label}`)}:${' '.repeat(Math.max(1, 10 - label.length))}${cyan(tunnel.url)}`)
          }
        }

        console.log()
        console.log(`  ${dim('Forwarding:')}`)
        console.log(`  ${dim(`  ${primaryTunnel.url} → http://localhost:${port}`)}`)
        for (let i = 0; i < companions.length; i++) {
          const companion = companions[i]
          const tunnel = tunnels[i + 1]
          if (tunnel)
            console.log(`  ${dim(`  ${tunnel.url} → http://localhost:${companion.port}`)}`)
        }

        console.log()
        console.log(`  ${dim('Press Ctrl+C to stop sharing')}`)
        console.log()

        if (options.verbose) {
          console.log(`  ${dim('Verbose mode — showing all requests')}`)
          console.log()
        }

        const cleanup = () => {
          console.log()
          log.info('Closing tunnels...')
          for (const t of tunnels) t.close()
          // Kill child processes (dev servers)
          try { process.kill(0, 'SIGKILL') }
          catch { /* ignore */ }
          outro('Stopped sharing', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        // Keep the process running
        await new Promise(() => {})
      }
      catch (error: any) {
        if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
          log.error(`Could not reach tunnel server at ${server}`)
          log.info('Check that the server is running and accessible.')
          log.info(`You can verify with: curl -sk https://${server}/status`)
        }
        else {
          log.error(`Failed to create tunnel: ${error.message}`)
        }

        if (options.verbose) {
          log.error(error.stack)
        }

        // Clean up any tunnels that were created before the error
        for (const t of tunnels) t.close()

        await outro('Share failed', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }
    })
}
