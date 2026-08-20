import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, onUnknownSubcommand } from "@stacksjs/cli"
import { decryptEnv, encryptEnv, getEnv, getKeypair, resolveEnvFile, rotateKeypair, setEnv } from '@stacksjs/env'
import { ExitCode } from '@stacksjs/types'

interface EnvOptions {
  get: string
  set: string
  encrypt: string
  decrypt: string
  pretty: boolean
  keypair: string
  fileKeys: string
  excludeKey: string
  rotate: string
  format: string
  stdout: boolean
  all: boolean
  project: string
  verbose: boolean
  file: string
  plain: boolean
  /** `env:check`: report EVERY unencrypted value, not just secret-shaped names. */
  strict: boolean
  /** The global `--env <environment>` flag, e.g. `production`. */
  env: string
}

export function env(buddy: CLI): void {
  const descriptions = {
    env: 'Interact with your environment variables',
    get: 'Get an environment variable',
    set: 'Set an environment variable',
    encrypt: 'Encrypt a value',
    decrypt: 'Decrypt a value',
    check: 'Check environment configuration and validate setup',
    pretty: 'Pretty print the result',
    stdout: 'Output the result to stdout',
    keypair: 'Generate a keypair',
    fileKeys: 'The path to the file containing the keys',
    excludeKey: 'The key to exclude from encryption',
    rotate: 'Rotate a keypair',
    format: 'The format to output the result (json, shell, eval)',
    all: 'Get all environment variables',
    file: 'The environment file to use',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('env:get [key]', descriptions.get)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('--format [format]', descriptions.format, { default: 'json' })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-p, --pretty', descriptions.pretty, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy env:get SECRET')
    .example('buddy env:get SECRET --file .env.production')
    .example('buddy env:get --all --pretty')
    .example('buddy env:get --format shell')
    .example('buddy env:get --format eval')
    .example('buddy env:get --format json')
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:get` ...', options)

      const result = getEnv(key, {
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        all: options.all,
        format: options.format as 'json' | 'shell' | 'eval',
        prettyPrint: options.pretty,
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:set [key] [value]', descriptions.set)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('--plain', 'Don\'t encrypt the value', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy env:set SECRET=value')
    .example('buddy env:set SECRET value')
    .example('buddy env:set SECRET value --file .env.production')
    .example('buddy env:set SECRET value --plain')
    .action(async (key: string, value: string, options: EnvOptions) => {
      log.debug('Running `buddy env:set` ...', options)

      // `value === ''` is a value: "this variable exists and is deliberately
      // empty" is a normal state for an app whose billing or mail is not
      // configured yet. Rejecting it as a missing argument left hand-editing the
      // file as the only way to express it, and hand-writing a plaintext line
      // into a committed encrypted env file is what the preflight then tried to
      // re-encrypt (stacksjs/stacks#2348).
      if (!key) {
        console.error('A key is required. Pass an empty value to clear it: `buddy env:set KEY \'\'`')
        process.exit(ExitCode.FatalError)
      }

      if (value === undefined) {
        console.error(`No value given for ${key}. Pass one, or an empty string to clear it: \`buddy env:set ${key} ''\``)
        process.exit(ExitCode.FatalError)
      }

      const result = setEnv(key, value, {
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        plain: options.plain,
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:encrypt [key]', descriptions.encrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .option('-ek, --exclude-key [excludeKey]', descriptions.excludeKey, { default: '' })
    .example('buddy env:encrypt')
    .example('buddy env:encrypt --file .env.production')
    .example('buddy env:encrypt -k "SECRET_*"')
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:encrypt` ...', options)

      const result = encryptEnv({
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        key,
        excludeKey: options.excludeKey,
        stdout: options.stdout,
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:decrypt [key]', descriptions.decrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .example('buddy env:decrypt')
    .example('buddy env:decrypt --file .env.production')
    .example('buddy env:decrypt -k "SECRET_*"')
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:decrypt` ...', options)

      const result = decryptEnv({
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        key,
        stdout: options.stdout,
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:keypair [key]', descriptions.keypair)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('--format [format]', descriptions.format, { default: 'json' })
    .example('buddy env:keypair')
    .example('buddy env:keypair --file .env.production')
    .example('buddy env:keypair DOTENV_PRIVATE_KEY')
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:keypair` ...', options)

      const result = getKeypair(key, {
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        format: options.format as 'json' | 'shell',
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:rotate [key]', descriptions.rotate)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .option('-ek, --exclude-key [excludeKey]', descriptions.excludeKey, { default: '' })
    .example('buddy env:rotate')
    .example('buddy env:rotate --file .env.production')
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:rotate` ...', options)

      const result = rotateKeypair({
        file: resolveEnvFile(options.file, options.env),
        keysFile: options.fileKeys,
        key,
        excludeKey: options.excludeKey,
        stdout: options.stdout,
      })

      if (result.success) {
        console.log(result.output)
        process.exit(ExitCode.Success)
      }
      else {
        console.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:check', descriptions.check)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('--strict', 'Require every value in a committed env file to be encrypted, not just secret-shaped ones', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy env:check')
    .example('buddy env:check --file .env.production')
    .example('buddy env:check --file .env.production --strict')
    .action(async (options: EnvOptions) => {
      log.debug('Running `buddy env:check` ...', options)

      const { bold, dim, green, red, yellow, intro } = await import('@stacksjs/cli')
      const { storage } = await import('@stacksjs/storage')
      const { existsSync } = await import('node:fs')
      const { resolve } = await import('node:path')

      await intro('buddy env:check')

      interface EnvCheck {
        name: string
        status: 'pass' | 'warn' | 'fail'
        message: string
      }

      const checks: EnvCheck[] = []
      const envFile = options.file || '.env'
      const envPath = resolve(process.cwd(), envFile)

      // Check if .env file exists
      if (existsSync(envPath)) {
        checks.push({
          name: `${envFile} file`,
          status: 'pass',
          message: 'Found',
        })

        // Read and validate .env contents
        try {
          // `readTextFile` resolves a `{ path, data }` TextFile, so `String(…)`
          // on it yields "[object Object]" — a 15-char string with no newlines.
          // Every check below then ran against that one bogus line, which is why
          // a 67-key .env.production reported "1 variables defined", no APP_KEY
          // and no encryption keys.
          const envContent = await storage.readTextFile(envPath)
          const contentStr = typeof envContent === 'string' ? envContent : envContent.data
          const values = parseEnvAssignments(contentStr)
          const keys = Object.keys(values)
          const varCount = keys.length

          checks.push({
            name: 'Environment variables',
            status: 'pass',
            message: `${varCount} variables defined`,
          })

          // Check for APP_KEY
          const hasAppKey = 'APP_KEY' in values
          if (hasAppKey) {
            const appKeyValue = values.APP_KEY ?? ''
            if (appKeyValue.length > 0) {
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
                message: 'Empty (run: buddy key:generate)',
              })
            }
          }
          else {
            checks.push({
              name: 'APP_KEY',
              status: 'warn',
              message: 'Not found (run: buddy key:generate)',
            })
          }

          // Check for encryption keys. The private half lives in .env.keys, so
          // an encrypted env file legitimately carries only the public one.
          const hasPublicKey = keys.some(key => key.startsWith('DOTENV_PUBLIC_KEY'))
          const hasPrivateKey = keys.some(key => key.startsWith('DOTENV_PRIVATE_KEY'))
            || existsSync(resolve(process.cwd(), '.env.keys'))

          if (hasPublicKey && hasPrivateKey) {
            checks.push({
              name: 'Encryption keys',
              status: 'pass',
              message: 'Public and private keys configured',
            })
          }
          else if (hasPublicKey || hasPrivateKey) {
            checks.push({
              name: 'Encryption keys',
              status: 'warn',
              message: 'Incomplete keypair (run: buddy env:keypair)',
            })
          }
          else {
            checks.push({
              name: 'Encryption keys',
              status: 'warn',
              message: 'Not configured (optional)',
            })
          }

          // Foreign-tenant keys. On a shared box each project deploys from its
          // own repository with its own env file, so another tenant's values
          // have no reader here — and `buddy deploy` ships this file to every
          // site, which would write that tenant's secrets into an unrelated
          // site's `.env` on disk. Only reported when `cloud.tenants` declares
          // who is attached; prefixes are never guessed.
          const declaredTenants = await resolveDeclaredTenants()

          if (declaredTenants.tenants.length === 0) {
            checks.push({
              name: 'Tenant isolation',
              status: 'pass',
              message: 'No tenants declared (cloud.tenants)',
            })
          }
          else {
            const { foreignTenantKeys, partitionTenantEnv } = await import('@stacksjs/env')
            const foreign = foreignTenantKeys(partitionTenantEnv(values, declaredTenants))

            // `.env` is machine-local: gitignored, and excluded from the
            // deploy tarball. Foreign keys there are inert, and it is where
            // `env:check` tells you to move them, so flagging it would be
            // self-contradictory. Only `.env.<environment>` gets shipped.
            const isShipped = /^\.env\.[a-z]+$/.test(envFile)
            const total = foreign.reduce((sum, entry) => sum + entry.keys.length, 0)

            if (foreign.length === 0) {
              checks.push({
                name: 'Tenant isolation',
                status: 'pass',
                message: `No foreign keys (checked ${declaredTenants.tenants.join(', ')})`,
              })
            }
            else if (!isShipped) {
              checks.push({
                name: 'Tenant isolation',
                status: 'pass',
                message: `${total} archived key(s) - ${envFile} is local-only and never deployed`,
              })
            }
            else {
              checks.push({
                name: 'Tenant isolation',
                status: 'warn',
                message: `${total} key(s) belong to another tenant - move them to .env`,
              })
              for (const { tenant, keys } of foreign) {
                checks.push({
                  name: `  ${tenant}`,
                  status: 'warn',
                  message: keys.join(', '),
                })
              }
            }
          }

          // Unencrypted secrets in a COMMITTED env file.
          //
          // Encrypting in place and un-ignoring the file is a good design with
          // one failure mode: a value that was never encrypted looks exactly
          // like one that was. It has already happened here — `.env.production`
          // carried three SMTP passwords and the coming-soon secret in
          // plaintext on a public repository (removed in a57c8ed69b, #2211),
          // and nothing in the toolchain could have said so.
          //
          // Scoped to git-tracked files: a gitignored `.env` is machine-local
          // and plaintext there is the normal case.
          const { plaintextSecrets, trackedEnvFiles } = await import('@stacksjs/env')
          const tracked = trackedEnvFiles(gitLsFiles())

          if (!tracked.includes(envFile)) {
            checks.push({
              name: 'Committed secrets',
              status: 'pass',
              message: `${envFile} is not committed; plaintext here stays local`,
            })
          }
          else {
            // `.env.example` is the project's own statement of what a
            // non-secret default looks like, so a value identical to its
            // counterpart there is a documented placeholder, not a leak.
            let placeholders: Record<string, string> = {}
            try {
              const examplePath = resolve(process.cwd(), '.env.example')
              if (existsSync(examplePath))
                placeholders = parseEnvAssignments(await storage.readTextFile(examplePath).then(f => f.data))
            }
            catch { /* no example file; every secret-shaped value is then reported */ }

            const leaked = plaintextSecrets(values, { placeholders, strict: options.strict })

            if (leaked.length === 0) {
              checks.push({
                name: 'Committed secrets',
                status: 'pass',
                message: `No unencrypted secrets in ${envFile}`,
              })
            }
            else {
              // Key names only. Printing the value would copy the secret into
              // CI logs and terminal scrollback — the thing being prevented.
              checks.push({
                name: 'Committed secrets',
                status: 'fail',
                message: `${leaked.length} unencrypted secret${leaked.length === 1 ? '' : 's'} in committed ${envFile}: ${leaked.map(f => f.key).join(', ')}. Run \`buddy env:encrypt\`, then rotate them - they are in git history.`,
              })
            }
          }
        }
        catch (error) {
          checks.push({
            name: `${envFile} content`,
            status: 'fail',
            message: `Cannot read file: ${error}`,
          })
        }
      }
      else {
        checks.push({
          name: `${envFile} file`,
          status: 'fail',
          message: 'Not found',
        })
      }

      // Check for .env.keys file
      const keysPath = resolve(process.cwd(), '.env.keys')
      if (existsSync(keysPath)) {
        checks.push({
          name: '.env.keys file',
          status: 'pass',
          message: 'Found',
        })
      }
      else {
        checks.push({
          name: '.env.keys file',
          status: 'warn',
          message: 'Not found (optional for encryption)',
        })
      }

      // Display results
      console.log('')
      console.log(bold('Environment Configuration Check:'))
      console.log(dim('─'.repeat(60)))
      console.log('')

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

        console.log(`${statusColor(statusIcon)} ${bold(check.name.padEnd(25))} ${dim(check.message)}`)
      }

      console.log('')
      console.log(dim('─'.repeat(60)))
      console.log('')

      // Summary
      if (hasFailures) {
        console.log(red('✗ Some critical checks failed. Please address the issues above.'))
        process.exit(ExitCode.FatalError)
      }
      else if (hasWarnings) {
        console.log(yellow('⚠ Some checks have warnings. Your environment should work but may have issues.'))
        process.exit(ExitCode.Success)
      }
      else {
        console.log(green('✓ All checks passed! Your environment configuration looks healthy.'))
        process.exit(ExitCode.Success)
      }
    })

  onUnknownSubcommand(buddy, "env")
}

/**
 * Reads `project.slug` and `cloud.tenants` out of the project's cloud config.
 *
 * `cloud.tenants` lists the projects that attach to this box with their own
 * `cloud.attachTo`. It is the only thing that makes a `TENANT_` prefix
 * meaningful - without it nothing is ever treated as foreign, because
 * `STRIPE_`, `AWS_` and friends look identical to a slug prefix.
 *
 * Returns empty on any failure: a config that will not load is the cloud
 * commands' problem to report, not `env:check`'s.
 */
async function resolveDeclaredTenants(): Promise<{ self?: string, tenants: string[] }> {
  try {
    const { config } = await import('@stacksjs/config')
    const cloud = (config as { cloud?: { tenants?: unknown } }).cloud
    const app = (config as { app?: { name?: string } }).app
    const tenants = Array.isArray(cloud?.tenants)
      ? cloud.tenants.filter((slug): slug is string => typeof slug === 'string')
      : []

    return { self: app?.name, tenants }
  }
  catch {
    return { tenants: [] }
  }
}

/**
 * Parses `KEY=value` assignments out of a dotenv file into a flat map.
 *
 * Deliberately tolerant of what real `.env` files contain: comments, blank
 * lines, `export ` prefixes, quoted values, and - the case that matters here -
 * dotenvx ciphertext, which wraps across many lines inside its quotes. A naive
 * `split('\n')` treats each wrapped fragment as its own line and loses the key
 * it belongs to.
 *
 * Values are returned raw (still encrypted, if they were). `env:check` only
 * needs the key names and whether a value is non-empty, so nothing here has to
 * decrypt - which also means it works without the private key present.
 */
/**
 * The repository's tracked files, or an empty string when git cannot answer.
 *
 * `git ls-files` rather than a hardcoded `.env.production` / `.env.staging` /
 * `.env.ci` list: `.gitignore` un-ignores exactly those three, but
 * `.env.development` is tracked as well — no ignore rule happens to match it —
 * so a hardcoded list would skip a file just as public as the rest.
 *
 * Failing open (empty string) means a non-git checkout reports "not committed"
 * and skips the check, rather than erroring. That is the right direction: this
 * check exists to catch a file that IS shared, and a directory git knows
 * nothing about is not shared by this mechanism.
 */
function gitLsFiles(): string {
  try {
    const result = Bun.spawnSync(['git', 'ls-files'], { cwd: process.cwd(), stdout: 'pipe', stderr: 'ignore' })
    return result.success ? result.stdout.toString() : ''
  }
  catch {
    return ''
  }
}

export function parseEnvAssignments(content: string): Record<string, string> {
  const values: Record<string, string> = {}
  const assignment = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i

  const lines = content.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim() || line.trimStart().startsWith('#'))
      continue

    const match = line.match(assignment)
    if (!match)
      continue

    const [, key, first] = match
    let raw = first!.trim()

    // A value opening with a quote runs until the matching close, which may be
    // several lines down (wrapped ciphertext).
    const quote = raw[0] === '"' || raw[0] === "'" ? raw[0] : undefined
    if (quote) {
      raw = raw.slice(1)
      while (!raw.endsWith(quote) && i + 1 < lines.length) {
        i++
        raw += lines[i]
      }
      raw = raw.endsWith(quote) ? raw.slice(0, -1) : raw
    }
    else {
      // Unquoted values end at an inline comment.
      raw = raw.replace(/\s+#.*$/, '').trim()
    }

    values[key!] = raw
  }

  return values
}
