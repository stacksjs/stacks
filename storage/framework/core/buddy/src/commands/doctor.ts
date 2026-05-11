import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log, onUnknownSubcommand, red, yellow } from "@stacksjs/cli"
import { storage } from '@stacksjs/storage'

interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

/**
 * Run a check that may throw, recording the result in `checks`. Each
 * probe gets a 2-second budget — long enough to catch transient
 * latency, short enough that `buddy doctor` returns in a few seconds
 * even when every dependency is dead.
 */
async function probe(
  checks: HealthCheck[],
  name: string,
  fn: () => Promise<string>,
): Promise<void> {
  const start = Date.now()
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 2000)
    const message = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => ac.signal.addEventListener('abort', () => rej(new Error('timed out (>2s)')))),
    ])
    clearTimeout(timer)
    checks.push({ name, status: 'pass', message: `${message} (${Date.now() - start}ms)` })
  }
  catch (err) {
    checks.push({
      name,
      status: 'fail',
      message: err instanceof Error ? err.message : String(err),
    })
  }
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
        const bunMajor = Number.parseInt(bunVersion.split('.')[0] || '0', 10)
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
        const nodeMajor = Number.parseInt(nodeVersion.split('.')[0] || '0', 10)
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
        if ((pkg as any).name) {
          checks.push({
            name: 'package.json',
            status: 'pass',
            message: `Found: ${(pkg as any).name}`,
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
          status: appKey.length >= 32 ? 'pass' : 'warn',
          message: appKey.length >= 32 ? 'Set (≥32 chars)' : `Set but short (${appKey.length} chars; ≥32 recommended)`,
        })
      }
      else {
        checks.push({
          name: 'APP_KEY',
          status: 'fail',
          message: 'Not set — features that depend on it (encrypted columns, signed URLs, env decryption) will refuse to run. Run `buddy key:generate`.',
        })
      }

      // Database connectivity
      await probe(checks, 'Database', async () => {
        const { db } = await import('@stacksjs/database')
        await (db as any).unsafe?.('SELECT 1')
        return 'Reachable'
      })

      // Cache connectivity
      await probe(checks, 'Cache', async () => {
        const { cache } = await import('@stacksjs/cache')
        const k = `__doctor_${Date.now()}`
        await cache.set(k, 1, 5)
        const v = await cache.get(k)
        await cache.del(k)
        if (v !== 1) throw new Error('round-trip failed')
        return 'Round-trip ok'
      })

      // Queue driver
      await probe(checks, 'Queue driver', async () => {
        const { config } = await import('@stacksjs/config')
        const driver = (config as { queue?: { default?: string } }).queue?.default ?? 'sync'
        return `Driver: ${driver}`
      })

      // Mail driver — just verify it's resolvable; don't actually send
      await probe(checks, 'Mail driver', async () => {
        const { config } = await import('@stacksjs/config')
        const driver = (config as { email?: { default?: string } }).email?.default ?? 'log'
        return `Driver: ${driver}`
      })

      // AWS credentials — check the env vars even without making a real call
      const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      const hasAwsRole = Boolean(process.env.AWS_PROFILE) || Boolean(process.env.AWS_ROLE_ARN)
      if (hasAwsCreds || hasAwsRole) {
        checks.push({
          name: 'AWS credentials',
          status: 'pass',
          message: hasAwsCreds ? 'Static keys in env' : 'IAM role configured',
        })
      }
      else {
        checks.push({
          name: 'AWS credentials',
          status: 'warn',
          message: 'Not configured (cloud / SES / S3 commands will fail)',
        })
      }

      // .env decryption — verify enc: values can be decrypted with the
      // configured private key, if any are present. No-op when there
      // are no encrypted values or no key.
      await probe(checks, '.env decryption', async () => {
        const fs = await import('node:fs')
        if (!fs.existsSync('.env')) return 'No .env (skipped)'
        const content = fs.readFileSync('.env', 'utf8')
        if (!/(?:^|=)(?:enc|encrypted):/m.test(content)) return 'No encrypted values'
        const privateKey = process.env.DOTENV_PRIVATE_KEY
        if (!privateKey) throw new Error('Encrypted values present but DOTENV_PRIVATE_KEY is unset')
        const { parse } = await import('@stacksjs/env')
        const { errors } = parse(content, { privateKey })
        if (errors.length > 0) throw new Error(errors.join('; '))
        return 'All encrypted values decrypt cleanly'
      })

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

  onUnknownSubcommand(buddy, "doctor")
}
