import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log, red, yellow } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'

interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export function doctor(buddy: CLI): void {
  buddy
    .command('doctor', 'Run health checks on your Stacks installation')
    .action(async () => {
      log.debug('Running `buddy doctor` ...')
      await intro('buddy doctor')

      const checks: HealthCheck[] = []

      // Check Bun version
      const bunVersion = process.versions.bun
      if (bunVersion) {
        const bunMajor = Number.parseInt(bunVersion.split('.')[0])
        if (bunMajor >= 1) {
          checks.push({
            name: 'Bun Runtime',
            status: 'pass',
            message: `v${bunVersion}`,
          })
        }
        else {
          checks.push({
            name: 'Bun Runtime',
            status: 'warn',
            message: `v${bunVersion} (v1.0+ recommended)`,
          })
        }
      }
      else {
        checks.push({
          name: 'Bun Runtime',
          status: 'fail',
          message: 'Not found',
        })
      }

      // Check Node version (optional but nice to have)
      const nodeVersion = process.versions.node
      if (nodeVersion) {
        const nodeMajor = Number.parseInt(nodeVersion.split('.')[0])
        if (nodeMajor >= 18) {
          checks.push({
            name: 'Node.js',
            status: 'pass',
            message: `v${nodeVersion}`,
          })
        }
        else {
          checks.push({
            name: 'Node.js',
            status: 'warn',
            message: `v${nodeVersion} (v18+ recommended)`,
          })
        }
      }

      // Check package.json exists
      try {
        const pkg = await storage.readPackageJson('./package.json')
        if (pkg.name) {
          checks.push({
            name: 'package.json',
            status: 'pass',
            message: `Found: ${pkg.name}`,
          })
        }
      }
      catch {
        checks.push({
          name: 'package.json',
          status: 'fail',
          message: 'Not found in current directory',
        })
      }

      // Check for .env file
      try {
        await storage.readTextFile('.env')
        checks.push({
          name: '.env file',
          status: 'pass',
          message: 'Found',
        })
      }
      catch {
        checks.push({
          name: '.env file',
          status: 'warn',
          message: 'Not found (optional)',
        })
      }

      // Check APP_KEY
      const appKey = process.env.APP_KEY
      if (appKey && appKey.length > 0) {
        checks.push({
          name: 'APP_KEY',
          status: 'pass',
          message: 'Set',
        })
      }
      else {
        checks.push({
          name: 'APP_KEY',
          status: 'warn',
          message: 'Not set (run: buddy key:generate)',
        })
      }

      // Display results
      log.info('')
      log.info(bold('Health Check Results:'))
      log.info(dim('─'.repeat(60)))
      log.info('')

      let hasFailures = false
      let hasWarnings = false

      for (const check of checks) {
        let statusIcon = ''
        let statusColor = (text: string) => text

        if (check.status === 'pass') {
          statusIcon = '✓'
          statusColor = green
        }
        else if (check.status === 'warn') {
          statusIcon = '⚠'
          statusColor = yellow
          hasWarnings = true
        }
        else {
          statusIcon = '✗'
          statusColor = red
          hasFailures = true
        }

        log.info(`${statusColor(statusIcon)} ${bold(check.name.padEnd(20))} ${dim(check.message)}`)
      }

      log.info('')
      log.info(dim('─'.repeat(60)))
      log.info('')

      // Summary
      if (hasFailures) {
        log.error('Some critical checks failed. Please address the issues above.')
        process.exit(1)
      }
      else if (hasWarnings) {
        log.info(yellow('Some checks have warnings. Your system should work but may have issues.'))
      }
      else {
        log.success(green('All checks passed! Your Stacks installation looks healthy.'))
      }

      log.info('')
    })

  buddy.on('doctor:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
