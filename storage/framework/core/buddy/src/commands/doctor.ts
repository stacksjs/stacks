import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log, onUnknownSubcommand, red, yellow } from "@stacksjs/cli"
import { feature } from '@stacksjs/config'
import { storage } from '@stacksjs/storage'
import { FEATURE_NAMES, featurePathsPresent } from './features'

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
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now()
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const message = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => ac.signal.addEventListener('abort', () => rej(new Error(`timed out (>${Math.round(timeoutMs / 1000)}s)`)))),
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
    .option('--no-fail', 'Print results but always exit 0 (CI ramp-up)')
    .action(async (options?: { fail?: boolean }) => {
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

      // Foreign-key integrity (stacksjs/stacks#1916). Walks each
      // model's `belongsTo`, computes the implied FK, queries the
      // live database for the actual FK list, and reports any
      // declared-but-missing FK. Catches the silent fallout from
      // the pre-fix SQLite preprocessing pass — apps deployed on
      // SQLite have FK declarations in their models but no FKs in
      // the live schema. After the fix, this should always pass on
      // a freshly-migrated app.
      await probe(checks, 'Database FKs', async () => {
        const { auditForeignKeys } = await import('@stacksjs/database')
        const result = await auditForeignKeys()
        if (result.declared.length === 0) return 'No belongsTo declarations'
        if (result.missing.length === 0) return `${result.declared.length} declared FKs all present`
        // Compact list of the worst offenders — full output would
        // dwarf the rest of the doctor results on a large app.
        const sample = result.missing
          .slice(0, 5)
          .map(fk => `${fk.fromTable}.${fk.fromColumn} → ${fk.toTable}.${fk.toColumn}`)
          .join(', ')
        const more = result.missing.length > 5 ? ` (+${result.missing.length - 5} more)` : ''
        throw new Error(`${result.missing.length}/${result.declared.length} declared FKs missing from live schema: ${sample}${more}. Run \`buddy migrate:fresh\` (will reset data) or \`buddy migrate\` against a clean DB.`)
      })

      // Unique-index drift (stacksjs/stacks#1952). Compares each
      // model's declared uniqueness (`unique: true` attributes /
      // indexes) against the live UNIQUE indexes, matched by column
      // set. Catches apps scaffolded during the stub era whose
      // unique-index migrations never ran. 10s budget — the audit
      // imports every model file, so cold caches exceed the 2s default.
      await probe(checks, 'Unique indexes', async () => {
        const { auditUniqueIndexes } = await import('@stacksjs/database')
        const result = await auditUniqueIndexes()
        if (!result.supported) return 'Dialect not audited (skipped)'
        const skipped = result.skippedTables.length > 0 ? `, ${result.skippedTables.length} tables skipped (not migrated)` : ''
        if (result.missing.length === 0) return `${result.declared.length} declared unique constraints all indexed${skipped}`
        const sample = result.missing
          .slice(0, 5)
          .map(u => `${u.table}.${u.columns.join('+')}`)
          .join(', ')
        const more = result.missing.length > 5 ? ` (+${result.missing.length - 5} more)` : ''
        const first = result.missing[0]
        if (!first) throw new Error('Unique-index audit reported missing entries without details')
        const example = `CREATE UNIQUE INDEX IF NOT EXISTS "${first.table}_${first.columns.join('_')}_unique" ON "${first.table}" ("${first.columns.join('", "')}")`
        throw new Error(`${result.missing.length}/${result.declared.length} declared unique constraints have no UNIQUE index: ${sample}${more}. Run \`buddy migrate\` (re-queues missing unique-index migrations, #1952) — dedupe duplicate rows first or migrate hard-fails; if no migration file exists run \`buddy generate:migrations\`, or create manually: ${example}`)
      }, 10000)

      // FK orphans (stacksjs/stacks#1951). FK enforcement flipped ON
      // against databases written under `foreign_keys = OFF`, so legacy
      // rows can reference parents that no longer exist. READ-ONLY scan
      // via `PRAGMA foreign_key_check`. 10s budget — O(all child rows).
      await probe(checks, 'FK orphans', async () => {
        const { findFkOrphans } = await import('@stacksjs/database')
        const result = await findFkOrphans()
        if (!result.supported) return 'Dialect not audited (skipped)'
        if (result.total === 0) return 'No orphan rows (PRAGMA foreign_key_check clean)'
        const sample = result.orphans
          .slice(0, 5)
          .map(o => `${o.table}.${o.column} → ${o.parent} (${o.count})`)
          .join(', ')
        const more = result.orphans.length > 5 ? ` (+${result.orphans.length - 5} more)` : ''
        const first = result.orphans[0]
        if (!first) throw new Error('Foreign-key audit reported orphan rows without details')
        throw new Error(`${result.total} orphan rows violate FKs: ${sample}${more}. Legacy rows written under foreign_keys=OFF (#1951). Review and clean manually, e.g. DELETE FROM ${first.table} WHERE ${first.column} IS NOT NULL AND ${first.column} NOT IN (SELECT id FROM ${first.parent}) — doctor never deletes data.`)
      }, 10000)

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

      // Storage credentials — if the default disk is `s3`, the AWS env vars
      // need to be present, otherwise every upload action throws on first
      // use. Warn loudly so the developer notices before the first upload
      // attempt rather than in a stacktrace. See stacksjs/stacks#1856.
      try {
        const { filesystems } = await import('@stacksjs/config')
        const driver = (filesystems as { driver?: string }).driver ?? 'local'
        if (driver === 's3') {
          const bucket = process.env.S3_BUCKET ?? (filesystems as { s3?: { bucket?: string } }).s3?.bucket
          const accessKeyId = process.env.AWS_ACCESS_KEY_ID
          const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
          const missing: string[] = []
          if (!bucket) missing.push('S3_BUCKET')
          if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID')
          if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY')
          if (missing.length > 0) {
            checks.push({
              name: 'Storage credentials',
              status: 'warn',
              message: `Default disk is 's3' but missing: ${missing.join(', ')}. Uploads will throw on first use.`,
            })
          }
          else {
            checks.push({
              name: 'Storage credentials',
              status: 'pass',
              message: 's3 default disk has bucket + AWS credentials',
            })
          }
        }
        else {
          checks.push({
            name: 'Storage credentials',
            status: 'pass',
            message: `Default disk is '${driver}' (no remote credentials required)`,
          })
        }
      }
      catch (err) {
        checks.push({
          name: 'Storage credentials',
          status: 'warn',
          message: `Could not audit storage config: ${err instanceof Error ? err.message : String(err)}`,
        })
      }

      // Dev-domain overrides (rpx). A `buddy dev` session maps custom
      // domains to loopback through /etc/hosts lines and /etc/resolver
      // files. When a session dies without cleanup, those overrides
      // persist and keep hijacking the domain (production traffic
      // included) even though the proxy is long gone. Read-only audit:
      // doctor never edits system files, it only points at the exact
      // leftovers and their removal commands.
      try {
        if (process.platform !== 'darwin') {
          checks.push({ name: 'Dev domains (rpx)', status: 'pass', message: 'Not macOS (skipped)' })
        }
        else {
          const fs = await import('node:fs')
          const os = await import('node:os')
          const path = await import('node:path')

          const isAlive = (pid: number): boolean => {
            try {
              process.kill(pid, 0)
              return true
            }
            catch (err) {
              return (err as NodeJS.ErrnoException).code === 'EPERM'
            }
          }

          // Hosts a live dev session currently owns (registry is the
          // source of truth the rpx daemon routes from).
          const registryDir = path.join(os.homedir(), '.stacks', 'rpx', 'registry.d')
          const registered = new Set<string>()
          const deadRegistryFiles: string[] = []
          if (fs.existsSync(registryDir)) {
            for (const file of fs.readdirSync(registryDir)) {
              if (!file.endsWith('.json')) continue
              try {
                const entry = JSON.parse(fs.readFileSync(path.join(registryDir, file), 'utf8')) as { to?: string, pid?: number }
                if (entry.to && (entry.pid === undefined || isAlive(entry.pid)))
                  registered.add(entry.to.toLowerCase())
                if (typeof entry.pid === 'number' && !isAlive(entry.pid))
                  deadRegistryFiles.push(file)
              }
              catch { /* malformed entry: the daemon prunes it on its next sweep */ }
            }
          }

          const staleHosts = new Set<string>()
          const staleResolvers: string[] = []

          // /etc/hosts: rpx-owned loopback lines, pid-stamped
          // (`# rpx:pid=N`) or legacy `# Added by rpx` blocks.
          const hostsPath = '/etc/hosts'
          const hostsLines = fs.existsSync(hostsPath) ? fs.readFileSync(hostsPath, 'utf8').split('\n') : []
          for (let i = 0; i < hostsLines.length; i++) {
            const line = hostsLines[i] as string
            if (line.trim() === '# Added by rpx') {
              for (let j = i + 1; j < hostsLines.length; j++) {
                const blockLine = (hostsLines[j] as string).trim()
                if (blockLine === '' || blockLine.startsWith('#')) break
                const names = blockLine.split('#')[0]?.trim().split(/\s+/).slice(1) ?? []
                for (const name of names) {
                  if (!registered.has(name.toLowerCase()))
                    staleHosts.add(name)
                }
              }
              continue
            }
            const hash = line.indexOf('#')
            if (hash === -1) continue
            const marker = /^rpx(?::pid=(\d+))?$/.exec(line.slice(hash + 1).trim())
            if (!marker) continue
            const names = line.slice(0, hash).trim().split(/\s+/).slice(1)
            const pid = marker[1] ? Number.parseInt(marker[1], 10) : null
            const stale = pid !== null ? !isAlive(pid) : names.every(n => !registered.has(n.toLowerCase()))
            if (stale) {
              for (const name of names) staleHosts.add(name)
            }
          }

          // /etc/resolver/<domain>: rpx DNS files (nameserver 127.0.0.1,
          // port 15353) whose domain no live registry entry claims.
          const resolverDir = '/etc/resolver'
          if (fs.existsSync(resolverDir)) {
            for (const file of fs.readdirSync(resolverDir)) {
              try {
                const content = fs.readFileSync(path.join(resolverDir, file), 'utf8')
                if (!content.includes('127.0.0.1') || !content.includes('15353')) continue
                const domain = file.toLowerCase()
                const claimed = [...registered].some(host => host === domain || host.endsWith(`.${domain}`))
                if (!claimed)
                  staleResolvers.push(file)
              }
              catch { /* unreadable resolver file: skip */ }
            }
          }

          if (staleHosts.size > 0 || staleResolvers.length > 0 || deadRegistryFiles.length > 0) {
            const parts: string[] = []
            if (staleHosts.size > 0) parts.push(`hosts(${[...staleHosts].join(', ')})`)
            if (staleResolvers.length > 0) parts.push(`resolver(${staleResolvers.join(', ')})`)
            if (deadRegistryFiles.length > 0) parts.push(`registry(${deadRegistryFiles.join(', ')})`)
            checks.push({
              name: 'Dev domains (rpx)',
              status: 'warn',
              message: `Stale loopback overrides from dead dev sessions: ${parts.join(' ')}. These keep pointing the domain at 127.0.0.1. Remove with: sudo nano /etc/hosts; sudo rm /etc/resolver/<name>; rm ~/.stacks/rpx/registry.d/<file>. Updating @stacksjs/rpx lets the daemon sweep pid-stamped entries automatically.`,
            })
          }
          else {
            checks.push({ name: 'Dev domains (rpx)', status: 'pass', message: 'No stale dev-domain overrides' })
          }
        }
      }
      catch (err) {
        checks.push({
          name: 'Dev domains (rpx)',
          status: 'warn',
          message: `Could not audit dev-domain overrides: ${err instanceof Error ? err.message : String(err)}`,
        })
      }

      // Feature scaffolding orphans — files belonging to a disabled feature
      // are still on disk. Spec: `./buddy doctor` should warn so the user
      // can decide whether to `<feature>:uninstall` (delete them) or
      // `<feature>:install` (re-enable). See stacksjs/stacks#1854.
      try {
        const orphans: Array<{ feature: string, count: number }> = []
        for (const name of FEATURE_NAMES) {
          if (feature(name)) continue
          const present = featurePathsPresent(name)
          if (present.length > 0) orphans.push({ feature: name, count: present.length })
        }
        if (orphans.length > 0) {
          const summary = orphans
            .map(o => `${o.feature} (${o.count} path${o.count === 1 ? '' : 's'})`)
            .join(', ')
          checks.push({
            name: 'Feature scaffolding',
            status: 'warn',
            message: `Stamped files remain for disabled features: ${summary}. Run \`./buddy <feature>:uninstall\` to remove or \`<feature>:install\` to re-enable.`,
          })
        }
        else {
          checks.push({
            name: 'Feature scaffolding',
            status: 'pass',
            message: 'No orphan files for disabled features',
          })
        }
      }
      catch (err) {
        // Reading config can throw if the project's config tree is incomplete
        // (e.g., during scaffolding). Surface as a warn so doctor still
        // finishes the remaining probes.
        checks.push({
          name: 'Feature scaffolding',
          status: 'warn',
          message: `Could not audit feature scaffolding: ${err instanceof Error ? err.message : String(err)}`,
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
        // `--no-fail` (options.fail === false) keeps exit 0 for CI ramp-up;
        // default behavior exits 1 so doctor gates upgrades/CI out of the box.
        if (options?.fail !== false) process.exit(1)
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
