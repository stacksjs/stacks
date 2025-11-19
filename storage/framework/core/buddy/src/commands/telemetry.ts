import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log } from '@stacksjs/cli'
import { telemetry } from '@stacksjs/clapp/telemetry'

export function telemetryCommand(buddy: CLI): void {
  buddy
    .command('telemetry', 'Manage telemetry settings')
    .option('--enable', 'Enable telemetry')
    .option('--disable', 'Disable telemetry')
    .option('--status', 'Show telemetry status')
    .example('buddy telemetry --status')
    .example('buddy telemetry --enable')
    .example('buddy telemetry --disable')
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy telemetry` ...', options)
      await intro('buddy telemetry')

      try {
        // Handle enable
        if (options.enable) {
          await telemetry.enable()
          log.success('Telemetry enabled')
          log.info('')
          log.info(dim('Anonymous usage statistics will be collected'))
          log.info(dim('to help improve Buddy CLI.'))
          log.info('')
          log.info(dim('You can disable telemetry anytime with:'))
          log.info(dim('  buddy telemetry --disable'))
          log.info('')
          return
        }

        // Handle disable
        if (options.disable) {
          await telemetry.disable()
          log.success('Telemetry disabled')
          log.info('')
          log.info(dim('No usage statistics will be collected.'))
          log.info('')
          return
        }

        // Handle status (default action)
        const status = await telemetry.status()

        log.info('')
        log.info(green(bold('Telemetry Status')))
        log.info(dim('─'.repeat(50)))
        log.info('')

        log.info(bold('Configuration:'))
        log.info(`  Enabled:         ${dim(status.enabled ? 'Yes' : 'No')}`)
        log.info(`  DO_NOT_TRACK:    ${dim(status.doNotTrack ? 'Yes (respected)' : 'No')}`)
        log.info(`  Events queued:   ${dim(status.eventsQueued)}`)
        if (status.lastSent) {
          const lastSent = new Date(status.lastSent)
          log.info(`  Last sent:       ${dim(lastSent.toLocaleString())}`)
        }
        else {
          log.info(`  Last sent:       ${dim('Never')}`)
        }
        log.info('')

        log.info(bold('Privacy:'))
        log.info(`  ${dim('• Opt-in only (disabled by default)')}`)
        log.info(`  ${dim('• No personal information collected')}`)
        log.info(`  ${dim('• Anonymous user IDs only')}`)
        log.info(`  ${dim('• Respects DO_NOT_TRACK environment variable')}`)
        log.info('')

        if (!status.enabled) {
          log.info(dim('To enable telemetry: buddy telemetry --enable'))
          log.info('')
        }
        else {
          log.info(dim('To disable telemetry: buddy telemetry --disable'))
          log.info('')
        }
      }
      catch (error) {
        log.error('Failed to manage telemetry:', error)
        process.exit(1)
      }
    })

  buddy.on('telemetry:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
