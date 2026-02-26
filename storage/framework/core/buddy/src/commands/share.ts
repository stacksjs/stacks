import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, cyan, dim, green, intro, log, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

interface ShareOptions {
  port?: string
  verbose?: boolean
}

export function share(buddy: CLI): void {
  const descriptions = {
    share: 'Share your local development server via a public tunnel',
    port: 'Local port to share (overrides default for the given type)',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('share [type]', descriptions.share)
    .option('-p, --port <port>', descriptions.port)
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

      console.log()
      console.log(`  ${green('➜')}  ${bold('Sharing')}:  ${cyan(serviceType)} ${dim(`on port ${port}`)}`)
      console.log(`  ${dim('➜')}  ${dim('Connecting to tunnel server...')}`)
      console.log()

      try {
        const { localTunnel } = await import('@stacksjs/tunnel')
        const tunnel = await localTunnel({ port })

        console.log(`  ${green('➜')}  ${bold('Public URL')}:  ${cyan(tunnel.url)}`)
        console.log(`  ${green('➜')}  ${bold('Subdomain')}:   ${cyan(tunnel.subdomain)}`)
        console.log()
        console.log(`  ${dim(`Forwarding ${tunnel.url} → http://localhost:${port}`)}`)
        console.log()
        console.log(`  ${dim('Press Ctrl+C to stop sharing')}`)
        console.log()

        const cleanup = () => {
          console.log()
          log.info('Closing tunnel...')
          tunnel.close()
          outro('Stopped sharing', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        // Keep the process running
        await new Promise(() => {})
      }
      catch (error: any) {
        log.error(`Failed to create tunnel: ${error.message}`)

        if (options.verbose) {
          log.error(error.stack)
        }

        await outro('Share failed', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }
    })
}
