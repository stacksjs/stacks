import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'

export function about(buddy: CLI): void {
  buddy
    .command('about', 'Display diagnostic information about Stacks')
    .action(async () => {
      log.debug('Running `buddy about` ...')
      await intro('buddy about')

      try {
        const pkg = await storage.readPackageJson('./package.json')
        const stacksVersion = pkg.version || 'unknown'

        // Get Bun version
        const bunVersion = process.versions.bun || 'N/A'

        // Get Node version (if available)
        const nodeVersion = process.versions.node || 'N/A'

        // Get OS information
        const os = process.platform
        const arch = process.arch
        const osVersion = process.version

        // Get environment
        const env = process.env.NODE_ENV || process.env.APP_ENV || 'development'

        // Display information
        log.info('')
        log.info(green(bold('Stacks Framework')))
        log.info(dim('─'.repeat(50)))
        log.info('')

        log.info(bold('Version Information:'))
        log.info(`  Stacks:  ${dim(stacksVersion)}`)
        log.info(`  Bun:     ${dim(bunVersion)}`)
        if (nodeVersion !== 'N/A') {
          log.info(`  Node:    ${dim(nodeVersion)}`)
        }
        log.info('')

        log.info(bold('Environment:'))
        log.info(`  Mode:    ${dim(env)}`)
        log.info(`  OS:      ${dim(`${os} ${arch}`)}`)
        log.info(`  Runtime: ${dim(osVersion)}`)
        log.info('')

        log.info(bold('Configuration:'))
        log.info(`  Cache:   ${dim('file')}`)
        log.info(`  Debug:   ${dim(process.env.DEBUG ? 'enabled' : 'disabled')}`)
        log.info('')
      }
      catch (error) {
        log.error('Failed to retrieve system information:', error)
        process.exit(1)
      }
    })

  buddy.on('about:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
