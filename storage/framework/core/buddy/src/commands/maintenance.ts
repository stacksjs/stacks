import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export function maintenance(buddy: CLI): void {
  buddy
    .command('coming-soon', 'Put the application into coming soon mode')
    .option('--message [message]', 'The message to display', { default: false })
    .option('--secret [token]', 'The secret phrase to bypass coming soon mode', { default: false })
    .option('--allow [ip...]', 'IP addresses allowed to access the application', { default: false })
    .option('--status [code]', 'The HTTP status code to return', { default: '200' })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy coming-soon')
    .example('buddy coming-soon --secret=trailhead')
    .example('buddy coming-soon --message="Opening soon"')
    .action(async (options: {
      message?: string
      secret?: string
      allow?: string[]
      status?: string
      verbose?: boolean
    }) => {
      const perf = await intro('buddy coming-soon')

      try {
        const { comingSoon } = await import('@stacksjs/server')

        await comingSoon({
          message: options.message || undefined,
          secret: options.secret || undefined,
          allowed: Array.isArray(options.allow) ? options.allow : options.allow ? [options.allow] : undefined,
          status: options.status ? Number.parseInt(options.status, 10) : 200,
        })

        if (options.secret) {
          log.info('')
          log.info(`Preview URL: your-app.com/${options.secret}`)
        }

        await outro('Application is now in coming soon mode', {
          startTime: perf,
          useSeconds: true,
        })
      }
      catch (error) {
        log.error('Failed to enable coming soon mode:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('launch', 'Bring the application out of coming soon mode')
    .alias('coming-soon:off')
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy launch')
    .action(async () => {
      const perf = await intro('buddy launch')

      try {
        const { isComingSoon, launch } = await import('@stacksjs/server')

        if (!(await isComingSoon())) {
          log.info('Application is not in coming soon mode.')
          process.exit(ExitCode.Success)
        }

        await launch()

        await outro('Application is now launched', {
          startTime: perf,
          useSeconds: true,
        })
      }
      catch (error) {
        log.error('Failed to disable coming soon mode:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('coming-soon:status', 'Check if the application is in coming soon mode')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async () => {
      try {
        const { comingSoonPayload, isComingSoon } = await import('@stacksjs/server')

        if (await isComingSoon()) {
          const payload = await comingSoonPayload()
          log.warn('Application is in coming soon mode')

          if (payload) {
            if (payload.message) log.info(`Message: ${payload.message}`)
            if (payload.secret) log.info(`Secret: ${payload.secret}`)
            if (payload.allowed?.length) log.info(`Allowed IPs: ${payload.allowed.join(', ')}`)
            if (payload.time) log.info(`Started: ${new Date(payload.time).toLocaleString()}`)
          }
        }
        else {
          log.success('Application is launched')
        }
      }
      catch (error) {
        log.error('Failed to check coming soon status:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('down', 'Put the application into maintenance mode')
    .option('--message [message]', 'The message to display', { default: false })
    .option('--retry [seconds]', 'The number of seconds after which the request may be retried', { default: false })
    .option('--secret [token]', 'The secret phrase to bypass maintenance mode', { default: false })
    .option('--allow [ip...]', 'IP addresses allowed to access the application', { default: false })
    .option('--redirect [url]', 'Redirect all requests to a given URL', { default: false })
    .option('--status [code]', 'The HTTP status code to return', { default: '503' })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy down')
    .example('buddy down --message="Upgrading database"')
    .example('buddy down --secret=my-secret-token')
    .example('buddy down --retry=60')
    .example('buddy down --allow=192.168.1.1 --allow=192.168.1.2')
    .action(async (options: {
      message?: string
      retry?: string
      secret?: string
      allow?: string[]
      redirect?: string
      status?: string
      verbose?: boolean
    }) => {
      const perf = await intro('buddy down')

      try {
        const { down } = await import('@stacksjs/server')

        await down({
          message: options.message || undefined,
          retry: options.retry ? Number.parseInt(options.retry, 10) : undefined,
          secret: options.secret || undefined,
          allowed: Array.isArray(options.allow) ? options.allow : options.allow ? [options.allow] : undefined,
          redirect: options.redirect || undefined,
          status: options.status ? Number.parseInt(options.status, 10) : 503,
        })

        if (options.secret) {
          log.info('')
          log.info(`Bypass URL: your-app.com/${options.secret}`)
        }

        await outro('Application is now in maintenance mode', {
          startTime: perf,
          useSeconds: true,
        })
      }
      catch (error) {
        log.error('Failed to enable maintenance mode:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('up', 'Bring the application out of maintenance mode')
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy up')
    .action(async () => {
      const perf = await intro('buddy up')

      try {
        const { up, isDownForMaintenance } = await import('@stacksjs/server')

        if (!(await isDownForMaintenance())) {
          log.info('Application is already live.')
          process.exit(ExitCode.Success)
        }

        await up()

        await outro('Application is now live', {
          startTime: perf,
          useSeconds: true,
        })
      }
      catch (error) {
        log.error('Failed to bring application up:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('status', 'Check if the application is in maintenance mode')
    .alias('maintenance:status')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async () => {
      try {
        const { isDownForMaintenance, maintenancePayload } = await import('@stacksjs/server')

        const isDown = await isDownForMaintenance()

        if (isDown) {
          const payload = await maintenancePayload()
          log.warn('Application is in maintenance mode')

          if (payload) {
            if (payload.message) log.info(`Message: ${payload.message}`)
            if (payload.retry) log.info(`Retry-After: ${payload.retry} seconds`)
            if (payload.secret) log.info(`Secret: ${payload.secret}`)
            if (payload.allowed?.length) log.info(`Allowed IPs: ${payload.allowed.join(', ')}`)
            if (payload.time) log.info(`Started: ${new Date(payload.time).toLocaleString()}`)
          }
        }
        else {
          log.success('Application is live')
        }
      }
      catch (error) {
        log.error('Failed to check maintenance status:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })
}
