import type { CLI, DeployOptions } from '@stacksjs/types'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { italic, onUnknownSubcommand, outro, prompts, runCommand } from "@stacksjs/cli"
import { app, dns as dnsConfig, email as emailConfig, cloud as cloudConfig } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud, syncDnsConfig } from '@stacksjs/dns'
import { encryptEnv, env } from '@stacksjs/env'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { getErrorCode, getErrorMessage } from '@stacksjs/utils'
import { ensureAppKey, ensureEnvIsSet, ensurePantryDependencies, ensurePantryInstalled } from './setup'

// Use console.log for clean output without timestamps
const log = {
  info: (...args: any[]) => console.log('ℹ', ...args),
  success: (...args: any[]) => console.log('✓', ...args),
  warn: (...args: any[]) => console.log('⚠', ...args),
  error: (...args: any[]) => console.error('✗', ...args),
  debug: (...args: any[]) => {
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log('🔍', ...args)
    }
  },
}

const MAIL_PACKAGE_DOMAIN = 'github.com/mail-os/mail'
const MAIL_PACKAGE_SPEC = `${MAIL_PACKAGE_DOMAIN}@0.1.0`
const MAIL_TARGET_PLATFORM = 'linux-x86_64'
const MAIL_BINARY_NAMES = ['mail', 'mail-x86_64-linux', 'mail-x86_64-linux-gnu']

function collectMatchingFiles(root: string, names: string[], maxDepth = 8): string[] {
  const nameSet = new Set(names)
  const matches: string[] = []

  if (!existsSync(root)) return matches

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return

    for (const entry of readdirSync(dir)) {
      if (entry === '.git' || entry === 'node_modules') continue

      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
      } else if (stat.isFile() && nameSet.has(entry)) {
        matches.push(fullPath)
      }
    }
  }

  walk(root, 0)
  return matches
}

function isElfBinary(filePath: string): boolean {
  const header = readFileSync(filePath).slice(0, 4)
  return header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46
}

function resolvePantryInstallCommand(): { command: string, args: string[] } {
  const localPantryCli = join(homedir(), 'Code', 'Tools', 'pantry', 'packages', 'ts-pantry', 'bin', 'cli.ts')
  if (existsSync(localPantryCli)) {
    return { command: 'bun', args: [localPantryCli] }
  }

  const projectPantry = p.projectPath('pantry/.bin/pantry')
  if (existsSync(projectPantry)) {
    return { command: projectPantry, args: [] }
  }

  const globalPantry = join(homedir(), '.local', 'share', 'pantry', 'global', 'bin', 'pantry')
  if (existsSync(globalPantry)) {
    return { command: globalPantry, args: [] }
  }

  return { command: 'pantry', args: [] }
}

async function installMailBinaryWithPantry(): Promise<void> {
  const { execFileSync } = await import('node:child_process')
  const pantry = resolvePantryInstallCommand()

  execFileSync(pantry.command, [
    ...pantry.args,
    'install',
    MAIL_PACKAGE_SPEC,
    '--install-dir',
    p.projectPath('pantry'),
    '--platform',
    MAIL_TARGET_PLATFORM,
    '--quiet',
  ], {
    cwd: p.projectPath(),
    stdio: process.argv.includes('--verbose') || process.argv.includes('-v') ? 'inherit' : 'pipe',
    env: process.env,
  })
}

async function findPantryMailBinary(): Promise<string | null> {
  const directCandidates = [
    ...MAIL_BINARY_NAMES.map(name => p.projectPath(`pantry/.bin/${name}`)),
    ...MAIL_BINARY_NAMES.map(name => join(homedir(), '.local', 'share', 'pantry', 'global', 'bin', name)),
  ]

  for (const candidate of directCandidates) {
    if (existsSync(candidate) && isElfBinary(candidate)) return candidate
  }

  for (const root of [p.projectPath('pantry'), join(homedir(), '.local', 'share', 'pantry')]) {
    for (const candidate of collectMatchingFiles(root, MAIL_BINARY_NAMES)) {
      if (isElfBinary(candidate)) return candidate
    }
  }

  return null
}

async function ensureDeployPrerequisites(verbose = false): Promise<void> {
  const cwd = p.projectPath()

  await ensurePantryInstalled()
  await ensurePantryDependencies(cwd)

  await ensureEnvIsSet({ cwd, verbose })
  await ensureAppKey(cwd)
}

/**
 * Load AWS credentials from ~/.aws/credentials file
 * Returns credentials for the specified profile (or 'default'/'stacks')
 */
function loadAwsCredentialsFromFile(): { accessKeyId?: string, secretAccessKey?: string, region?: string } {
  const credentialsPath = join(homedir(), '.aws', 'credentials')
  const configPath = join(homedir(), '.aws', 'config')

  if (!existsSync(credentialsPath)) {
    return {}
  }

  try {
    const content = readFileSync(credentialsPath, 'utf-8')
    const lines = content.split('\n')

    // Try to find credentials in order: default profile, then stacks profile
    const profiles = ['default', 'stacks']
    let currentProfile = ''
    let credentials: { accessKeyId?: string, secretAccessKey?: string } = {}
    const profileCredentials: Record<string, { accessKeyId?: string, secretAccessKey?: string }> = {}

    for (const line of lines) {
      const trimmed = line.trim()

      // Check for profile header
      const profileMatch = trimmed.match(/^\[(.+)\]$/)
      if (profileMatch?.[1]) {
        currentProfile = profileMatch[1]
        profileCredentials[currentProfile] = {}
        continue
      }

      // Parse key=value
      const keyValue = trimmed.match(/^(\w+)\s*=\s*(.+)$/)
      if (keyValue && currentProfile) {
        const [, key, value] = keyValue
        const target = profileCredentials[currentProfile]
        if (!target || value === undefined) continue
        if (key === 'aws_access_key_id') {
          target.accessKeyId = value
        }
        else if (key === 'aws_secret_access_key') {
          target.secretAccessKey = value
        }
      }
    }

    // Try to find credentials in preferred order
    for (const profile of profiles) {
      if (profileCredentials[profile]?.accessKeyId && profileCredentials[profile]?.secretAccessKey) {
        credentials = profileCredentials[profile]
        log.debug(`Using AWS credentials from ~/.aws/credentials [${profile}] profile`)
        break
      }
    }

    // Fallback to any available profile
    if (!credentials.accessKeyId) {
      for (const [profile, creds] of Object.entries(profileCredentials)) {
        if (creds.accessKeyId && creds.secretAccessKey) {
          credentials = creds
          log.debug(`Using AWS credentials from ~/.aws/credentials [${profile}] profile`)
          break
        }
      }
    }

    // Try to load region from config file
    let region: string | undefined
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, 'utf-8')
      const regionMatch = configContent.match(/region\s*=\s*(.+)/)
      if (regionMatch?.[1]) {
        region = regionMatch[1].trim()
      }
    }

    return { ...credentials, region }
  }
  catch (error) {
    log.debug('Failed to read AWS credentials file:', error)
    return {}
  }
}

/**
 * Set up email DNS records (DKIM CNAMEs and MX record) after SES identity is created
 */
async function setupEmailDnsRecords(emailDomain: string, region: string, logger: typeof log, options?: { mode?: 'server' | 'serverless', mailSubdomain?: string }): Promise<void> {
  logger.info('Setting up email DNS records...')

  try {
    const { SESClient } = await import('@stacksjs/ts-cloud')
    const { Route53Client } = await import('@stacksjs/ts-cloud')

    const ses = new SESClient(region)
    const route53 = new Route53Client(region)

    // Get DKIM tokens from SES
    logger.info(`Getting DKIM tokens for ${emailDomain}...`)
    const identity = await ses.getEmailIdentity(emailDomain)
    const tokens = identity.DkimAttributes?.Tokens || []

    if (tokens.length === 0) {
      logger.warn('No DKIM tokens found - domain may not be set up in SES yet')
      return
    }

    logger.info(`Found ${tokens.length} DKIM tokens`)

    // Find the hosted zone for the domain
    const zones = await route53.listHostedZones()
    const zone = zones.HostedZones?.find((z: any) => z.Name === `${emailDomain}.`)

    if (!zone) {
      logger.warn(`Hosted zone not found for ${emailDomain} - DNS records must be added manually`)
      logger.info('DKIM records needed:')
      for (const token of tokens) {
        logger.info(`  CNAME: ${token}._domainkey.${emailDomain} -> ${token}.dkim.amazonses.com`)
      }
      logger.info(`  MX: ${emailDomain} -> 10 inbound-smtp.${region}.amazonaws.com`)
      return
    }

    const hostedZoneId = zone.Id?.replace('/hostedzone/', '')
    logger.info(`Found hosted zone: ${hostedZoneId}`)

    // Add DKIM CNAME records
    for (const token of tokens) {
      const recordName = `${token}._domainkey.${emailDomain}`
      const recordValue = `${token}.dkim.amazonses.com`

      try {
        await route53.changeResourceRecordSets({
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Changes: [{
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: recordName,
                Type: 'CNAME',
                TTL: 300,
                ResourceRecords: [{ Value: recordValue }],
              },
            }],
          },
        })
        logger.success(`Added DKIM record: ${token}._domainkey`)
      } catch (e: unknown) {
        logger.warn(`Failed to add DKIM record: ${getErrorMessage(e)}`)
      }
    }

    // Add MX record for receiving emails
    // In 'server' mode, MX points to the mail server itself
    // In 'serverless' mode, MX points to SES inbound
    const mailSubdomain = options?.mailSubdomain || 'mail'
    const mxTarget = options?.mode === 'server'
      ? `10 ${mailSubdomain}.${emailDomain}`
      : `10 inbound-smtp.${region}.amazonaws.com`

    try {
      await route53.changeResourceRecordSets({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [{
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: emailDomain,
              Type: 'MX',
              TTL: 300,
              ResourceRecords: [{ Value: mxTarget }],
            },
          }],
        },
      })
      logger.success(`Added MX record: ${mxTarget}`)
    } catch (e: unknown) {
      logger.warn(`Failed to add MX record: ${getErrorMessage(e)}`)
    }

    // Add SPF record
    try {
      await route53.changeResourceRecordSets({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [{
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: emailDomain,
              Type: 'TXT',
              TTL: 300,
              ResourceRecords: [{ Value: '"v=spf1 include:amazonses.com ~all"' }],
            },
          }],
        },
      })
      logger.success('Added SPF record')
    } catch (e: unknown) {
      logger.warn(`Failed to add SPF record: ${getErrorMessage(e)}`)
    }

    // Add DMARC record
    try {
      await route53.changeResourceRecordSets({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [{
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: `_dmarc.${emailDomain}`,
              Type: 'TXT',
              TTL: 300,
              ResourceRecords: [{ Value: `"v=DMARC1;p=quarantine;pct=25;rua=mailto:dmarcreports@${emailDomain}"` }],
            },
          }],
        },
      })
      logger.success('Added DMARC record')
    } catch (e: unknown) {
      logger.warn(`Failed to add DMARC record: ${getErrorMessage(e)}`)
    }

    // Activate the SES receipt rule set
    try {
      const appName = process.env.APP_NAME?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'stacks'
      const ruleSetName = `${appName}-email-rules`
      await ses.setActiveReceiptRuleSet(ruleSetName)
      logger.success(`Activated email receipt rule set: ${ruleSetName}`)
    } catch (e: unknown) {
      logger.warn(`Failed to activate receipt rule set: ${getErrorMessage(e)}`)
    }

    logger.success('Email DNS records configured!')
    logger.info('Note: DKIM verification may take 5-15 minutes to complete')
  } catch (error: unknown) {
    logger.warn(`Failed to set up email DNS records: ${getErrorMessage(error)}`)
    logger.info('You can manually set up DNS records using: buddy email:verify')
  }
}

/**
 * Create a default mail user in DynamoDB for testing
 */
async function createDefaultMailUser(appName: string, emailDomain: string, region: string, logger: typeof log): Promise<void> {
  try {
    const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
    const crypto = await import('crypto')

    const dynamodb = new DynamoDBClient(region)
    const tableName = `${appName}-mail-users`

    // Check if mailboxes are configured
    const mailboxes = emailConfig?.mailboxes || []

    if (mailboxes.length === 0) {
      // Create a default admin user
      const defaultEmail = `admin@${emailDomain}`
      const defaultPassword = crypto.randomBytes(16).toString('hex')
      const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex')

      try {
        await dynamodb.putItem({
          TableName: tableName,
          Item: {
            email: { S: defaultEmail },
            passwordHash: { S: passwordHash },
            createdAt: { S: new Date().toISOString() },
            displayName: { S: 'Admin' },
          },
        })

        logger.success(`Created default mail user: ${defaultEmail}`)
        logger.info(`Password: ${defaultPassword}`)
        logger.info('Save this password - it will not be shown again!')
      } catch (e: unknown) {
        const msg = getErrorMessage(e)
        if (msg.includes('ConditionalCheckFailedException') || msg.includes('already exists')) {
          logger.debug('Default mail user already exists')
        } else {
          throw e
        }
      }
    } else {
      // Create users from configured mailboxes
      for (const mailbox of mailboxes) {
        const mb = mailbox as any
        const email = typeof mailbox === 'string' ? `${mailbox}@${emailDomain}` : `${mb.name || mb.address?.split('@')[0]}@${emailDomain}`
        const password = typeof mailbox === 'object' && mb.password
          ? mb.password
          : crypto.randomBytes(16).toString('hex')
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

        try {
          await dynamodb.putItem({
            TableName: tableName,
            Item: {
              email: { S: email },
              passwordHash: { S: passwordHash },
              createdAt: { S: new Date().toISOString() },
              displayName: { S: typeof mailbox === 'object' ? mb.displayName || mb.name || email : mailbox },
            },
          })

          logger.success(`Created mail user: ${email}`)
          if (typeof mailbox !== 'object' || !mb.password) {
            logger.info(`  Password: ${password}`)
          }
        } catch (e: unknown) {
          const msg = getErrorMessage(e)
          if (msg.includes('ConditionalCheckFailedException')) {
            logger.debug(`Mail user ${email} already exists`)
          } else {
            logger.warn(`Failed to create mail user ${email}: ${msg}`)
          }
        }
      }
    }
  } catch (error: unknown) {
    logger.warn(`Failed to create mail users: ${getErrorMessage(error)}`)
  }
}

/**
 * Upload mail server binary/source to S3
 * For 'server' mode: uploads the Linux x86_64 binary installed by Pantry
 * For 'serverless' mode: uploads the TypeScript server code
 */
async function uploadMailServerToS3(bucketName: string, region: string, mode: string): Promise<void> {
  try {
    const { S3Client: S3 } = await import('@stacksjs/ts-cloud')
    const s3Client = new S3(region)

    if (mode === 'serverless') {
      // Upload TypeScript/Bun server code
      const serverTsPath = p.frameworkPath('core/mail-server/server.ts')
      if (existsSync(serverTsPath)) {
        const serverCode = readFileSync(serverTsPath, 'utf-8')
        await s3Client.putObject({
          bucket: bucketName,
          key: 'mail-server/server.ts',
          body: serverCode,
          contentType: 'text/typescript',
        })
        log.success('Uploaded serverless mail server code to S3')
      }

      const pkgPath = p.frameworkPath('core/mail-server/package.json')
      if (existsSync(pkgPath)) {
        const pkgJson = readFileSync(pkgPath, 'utf-8')
        await s3Client.putObject({
          bucket: bucketName,
          key: 'mail-server/package.json',
          body: pkgJson,
          contentType: 'application/json',
        })
      }
      return
    }

    // Server mode: install and upload the Linux x86_64 binary from Pantry.
    let binaryUploaded = false

    try {
      await installMailBinaryWithPantry()

      const linuxBinaryPath = await findPantryMailBinary()
      if (linuxBinaryPath && existsSync(linuxBinaryPath) && isElfBinary(linuxBinaryPath)) {
        log.info(`Uploading Pantry mail binary: ${linuxBinaryPath}`)
        const binaryContent = readFileSync(linuxBinaryPath)
        await s3Client.putObject({
          bucket: bucketName,
          key: 'mail-server/smtp-server',
          body: binaryContent,
          contentType: 'application/octet-stream',
        })
        log.success('Uploaded Linux x86_64 mail server binary to S3')
        binaryUploaded = true
      }
    }
    catch (error: unknown) {
      log.debug(`Pantry mail install failed: ${getErrorMessage(error)}`)
    }

    if (!binaryUploaded) {
      log.warn(`No Pantry-provided ${MAIL_TARGET_PLATFORM} mail binary found. Release ${MAIL_PACKAGE_DOMAIN}, then run the Pantry binary sync for that package.`)
    }
  }
  catch (uploadErr: any) {
    log.debug(`Could not upload mail server to S3 (bucket may not exist yet): ${uploadErr.message}`)
  }
}

/**
 * Load the `tsCloud` configuration object exported from `config/cloud.ts`.
 * Returns undefined if the project has no ts-cloud config (older projects /
 * pure AWS setups that only export the legacy `CloudConfig`).
 */
async function loadTsCloudConfig(envName?: string): Promise<any | undefined> {
  try {
    const base = p.projectPath('config/cloud.ts')
    // Always cache-bust when an environment is known so the config module
    // re-evaluates against the env-specific secrets just loaded into process.env
    // — including production, whose values must win over any .env.development the
    // env plugin auto-loaded at startup (bun caches the first import; a distinct
    // query string forces a fresh evaluation).
    const spec = envName ? `${base}?env=${envName}` : base
    const mod = await import(spec)
    return mod.tsCloud
  }
  catch (err) {
    log.debug('Could not load config/cloud.ts tsCloud export:', err)
    return undefined
  }
}

/**
 * Resolve the cloud provider from a ts-cloud config (defaults to aws).
 */
function resolveProvider(tsCloudConfig: any): string {
  return tsCloudConfig?.cloud?.provider
    || (process.env.CLOUD_PROVIDER as string | undefined)
    || 'aws'
}

/** Parse a positive-integer seconds env var, falling back to a default. */
function readWaitSecs(name: string, defaultSecs: number): number {
  const secs = process.env[name] ? Number.parseInt(process.env[name] as string, 10) : Number.NaN
  return Number.isFinite(secs) && secs > 0 ? secs : defaultSecs
}

/** Human-friendly duration, e.g. `8m` or `1m30s`. */
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m ? (s ? `${m}m${s}s` : `${m}m`) : `${s}s`
}

/**
 * Poll `check()` until it stops throwing or the timeout elapses, emitting a
 * heartbeat every ~30s so a multi-minute wait never looks frozen (and, when
 * backgrounded, so the caller can see it is still alive).
 */
async function pollUntil(opts: {
  label: string
  timeoutSecs: number
  intervalMs?: number
  check: () => void
  timeoutMessage: (elapsedSecs: number) => string
}): Promise<void> {
  log.info(`${opts.label} (up to ${fmtDuration(opts.timeoutSecs)})...`)
  const started = Date.now()
  const deadline = started + opts.timeoutSecs * 1000
  let lastHeartbeat = 0
  for (;;) {
    try {
      opts.check()
      return
    }
    catch {
      const elapsedSecs = Math.floor((Date.now() - started) / 1000)
      if (Date.now() > deadline)
        throw new Error(opts.timeoutMessage(elapsedSecs))
      if (elapsedSecs - lastHeartbeat >= 30) {
        log.info(`  … still waiting (${elapsedSecs}s elapsed)`)
        lastHeartbeat = elapsedSecs
      }
      await new Promise(r => setTimeout(r, opts.intervalMs ?? 5000))
    }
  }
}

/**
 * Wait until cloud-init finishes on the freshly provisioned host and the bun
 * runtime is on PATH. Cloud-init runs asynchronously after the server reports
 * "running", so deploying immediately would race the bun install and the
 * systemd unit's ExecStart (`/usr/local/bin/bun …`) would not exist yet.
 *
 * Timeouts are generous — cold Hetzner boots plus cloud-init installing
 * bun/caddy can take several minutes — and overridable per environment:
 *   TS_CLOUD_SSH_WAIT_SECS   (default 480 = 8m)  — SSH reachability
 *   TS_CLOUD_BOOT_WAIT_SECS  (default 720 = 12m) — cloud-init + bun on PATH
 */
async function waitForRemoteReady(ip: string, verbose: boolean): Promise<void> {
  const { execSync } = await import('node:child_process')
  // Cloud providers recycle IPs, so a freshly-provisioned box often reuses an IP
  // whose OLD host key is still in ~/.ssh/known_hosts. `accept-new` only accepts
  // brand-new hosts — a *changed* key fails verification and the readiness check
  // wrongly reports "SSH not reachable". Ignore the known_hosts file entirely for
  // this ephemeral check (matches the actual deploy's SSH args).
  const sshArgs = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    `root@${ip}`,
  ]

  const run = (remote: string): string =>
    execSync(`ssh ${sshArgs.map(a => `'${a}'`).join(' ')} '${remote.replace(/'/g, `'\\''`)}'`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', verbose ? 'inherit' : 'pipe'],
    })

  // 1) Wait for SSH to accept connections (server may still be booting).
  const sshWaitSecs = readWaitSecs('TS_CLOUD_SSH_WAIT_SECS', 8 * 60)
  await pollUntil({
    label: 'Waiting for SSH to come up',
    timeoutSecs: sshWaitSecs,
    check: () => { run('true') },
    timeoutMessage: elapsed =>
      `SSH did not become reachable on ${ip} within ${fmtDuration(sshWaitSecs)} (waited ${elapsed}s). `
      + `The box may still be booting — raise TS_CLOUD_SSH_WAIT_SECS and retry.`,
  })
  log.success('SSH is up')

  // 2) Block on cloud-init, then confirm bun landed on PATH.
  log.info('Waiting for cloud-init (installing bun + caddy)...')
  try {
    run('cloud-init status --wait || true')
  }
  catch (err) {
    log.debug('cloud-init status --wait returned non-zero (continuing):', err)
  }

  const bootWaitSecs = readWaitSecs('TS_CLOUD_BOOT_WAIT_SECS', 12 * 60)
  await pollUntil({
    label: 'Waiting for the bun runtime',
    timeoutSecs: bootWaitSecs,
    check: () => { run('test -x /usr/local/bin/bun') },
    timeoutMessage: elapsed =>
      `bun runtime did not appear at /usr/local/bin/bun within ${fmtDuration(bootWaitSecs)} (waited ${elapsed}s). `
      + `cloud-init may have failed — SSH in and check /var/log/cloud-init-output.log; `
      + `raise TS_CLOUD_BOOT_WAIT_SECS for slow regions.`,
  })
  log.success('Server is ready (bun installed)')
}

/**
 * Resolve (and decrypt) the deploy-target's environment file into a flat
 * key/value map, so its values can be shipped to the server as each site's
 * systemd `.env` content.
 *
 * ts-cloud's `buildSiteDeployScript` treats `site.env` as the COMPLETE
 * content of the deployed `.env` — it doesn't read or merge in anything
 * from the packaged release tarball (ts-cloud is a generic deploy tool; it
 * has no idea `.env.production`/dotenvx encryption exist, that's entirely a
 * Stacks convention). Left unaddressed, every Hetzner site deploys with
 * ONLY whatever's in that site's own `env` override (often nothing at all)
 * — confirmed against a real deploy (stacksjs/status#1 Phase 9): the `main`
 * site (no `env` override) came up logging "loaded 0 variables from .env",
 * and `api` (which only declares `{ HOST, APP_ENV }` to force the loopback
 * bind) came up with just those 2 keys and none of its real production
 * config, failing config validation on the still-`encrypted:...` APP_ENV
 * ciphertext it never had a chance to decrypt (no DOTENV_PRIVATE_KEY_* in
 * that 2-key set).
 *
 * Returns `{}` (not an error) when the file doesn't exist or fails to
 * parse — an app with no `.env.production` yet shouldn't block deploying
 * with whatever `site.env` overrides it does have.
 */
export async function resolveDeployEnvValues(environment: 'production' | 'staging' | 'development'): Promise<Record<string, string>> {
  const fileName = environment === 'production'
    ? '.env.production'
    : environment === 'staging'
      ? '.env.staging'
      : existsSync(p.projectPath('.env.development'))
        ? '.env.development'
        : '.env'
  const filePath = p.projectPath(fileName)
  if (!existsSync(filePath))
    return {}

  try {
    const { getEnv } = await import('@stacksjs/env')
    const result = getEnv(undefined, { file: fileName, format: 'json' })
    if (!result.success || !result.output) {
      log.debug(`[deploy] Could not read ${fileName} for site env merging: ${result.error ?? 'unknown error'}`)
      return {}
    }

    const parsed = JSON.parse(result.output) as Record<string, string>
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      // dotenvx crypto metadata, not application config — never ship it.
      if (/^DOTENV_(PUBLIC|PRIVATE)_KEY/.test(key))
        continue
      values[key] = String(value)
    }
    return values
  }
  catch (error) {
    log.debug(`[deploy] Failed to resolve ${fileName} for site env merging:`, error)
    return {}
  }
}

/**
 * Merge the deploy-target's resolved env values underneath each site's own
 * explicit `env` overrides, stripping a general `PORT` when the site
 * declares its own `port` (the generated systemd unit already sets
 * `Environment=PORT=${site.port}` — see buildSiteDeployScript in ts-cloud —
 * so a leftover PORT in the shipped `.env` would otherwise silently win
 * over it once the app's own dotenv loading applies file values on top of
 * the process env).
 */
export function mergeSiteDeployEnv(sites: Record<string, any>, resolvedDeployEnv: Record<string, string>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(sites).map(([siteName, site]) => {
      if (!site)
        return [siteName, site]

      const base = { ...resolvedDeployEnv }
      if (site.port !== undefined)
        delete base.PORT
      return [siteName, { ...site, env: { ...base, ...(site.env || {}) } }]
    }),
  )
}

/**
 * Prefix a public host for a non-production environment: `acme.com` →
 * `staging.acme.com`, and `www.acme.com` → `www.staging.acme.com` (keep the www
 * label leading). Idempotent — an already-prefixed host is returned unchanged.
 */
function prefixHostForEnv(host: string, prefix: string): string {
  if (host.startsWith(`${prefix}.`) || host.startsWith(`www.${prefix}.`))
    return host
  if (host.startsWith('www.'))
    return `www.${prefix}.${host.slice(4)}`
  return `${prefix}.${host}`
}

/**
 * Make the site model environment-aware. For a non-production environment that
 * declares a `domainPrefix` (staging → `staging`, development → `dev`), every
 * site's public domain becomes `<prefix>.<domain>`, and URL values that point at
 * those hosts (APP_URL, OAuth redirect URLs, redirect targets, …) are rewritten
 * to match — so one config drives prod + staging + dev from their own branches
 * without duplicating site blocks. Only `//<host>` URL occurrences are rewritten;
 * bare `user@host` (e.g. mail identities) is left alone. Production is untouched.
 */
export function applyEnvironmentToSites(sites: Record<string, any>, environment: string, config: any): Record<string, any> {
  const prefix: string | undefined = config?.environments?.[environment]?.domainPrefix
  if (!prefix || environment === 'production')
    return sites

  // Every site's public host(s), longest-first so a redirect/URL that points at
  // one site from another (e.g. www.stacksjs.com → https://stacksjs.com) is also
  // rewritten to the prefixed target, and the most-specific host wins.
  const allHosts: string[] = []
  for (const site of Object.values(sites)) {
    const d = (site as any)?.domain
    if (typeof d === 'string') allHosts.push(d)
    else if (Array.isArray(d)) for (const x of d) if (typeof x === 'string') allHosts.push(x)
  }
  allHosts.sort((a, b) => b.length - a.length)

  const rewrite = (val: string): string => {
    let r = val
    for (const h of allHosts) {
      const esc = h.replace(/[.]/g, '\\.')
      r = r.replace(new RegExp(`//${esc}(?=[/:?#]|$)`, 'g'), `//${prefixHostForEnv(h, prefix)}`)
    }
    return r
  }

  const out: Record<string, any> = {}
  for (const [name, site] of Object.entries(sites)) {
    if (!site) {
      out[name] = site
      continue
    }
    const s: any = { ...site }
    if (typeof s.domain === 'string')
      s.domain = prefixHostForEnv(s.domain, prefix)
    else if (Array.isArray(s.domain))
      s.domain = s.domain.map((d: any) => (typeof d === 'string' ? prefixHostForEnv(d, prefix) : d))
    if (typeof s.redirect === 'string')
      s.redirect = rewrite(s.redirect)
    if (s.env && typeof s.env === 'object') {
      const e: Record<string, any> = { ...s.env }
      for (const k of Object.keys(e)) if (typeof e[k] === 'string') e[k] = rewrite(e[k])
      s.env = e
    }
    out[name] = s
  }
  return out
}

/**
 * Forge-style deploy to a Hetzner Cloud server via ts-cloud:
 *   1. provision (or reuse) the compute server + firewall + SSH key,
 *   2. wait for cloud-init to finish installing bun,
 *   3. package each configured site and ship it over SSH as a systemd service.
 *
 * The app is served directly on the server's public IP (no domain required).
 */
async function deployToHetzner(tsCloudConfig: any, deployEnv: string, options: DeployOptions): Promise<void> {
  const verbose = options.verbose === true
  const environment = (deployEnv === 'prod' ? 'production' : deployEnv) as 'production' | 'staging' | 'development'

  const apiToken = tsCloudConfig.hetzner?.apiToken || process.env.HCLOUD_TOKEN || process.env.HETZNER_API_TOKEN
  if (!apiToken) {
    log.error('No Hetzner API token found. Set HCLOUD_TOKEN in your .env (or hetzner.apiToken in config/cloud.ts).')
    process.exit(ExitCode.FatalError)
  }

  // Confirm the local SSH public key the driver will register on the server.
  const sshPubKey = join(homedir(), '.ssh', 'id_ed25519.pub')
  if (!existsSync(sshPubKey)) {
    log.error(`SSH public key not found at ${sshPubKey}.`)
    log.info('ts-cloud deploys to Hetzner over SSH and registers this key on the server.')
    log.info('Generate one with:  ssh-keygen -t ed25519')
    process.exit(ExitCode.FatalError)
  }

  const { createCloudDriver, deployAllComputeSites, resolveSiteKind } = await import('@stacksjs/ts-cloud')

  try {
    await runHetznerDeploy({ tsCloudConfig, environment, verbose, docker: (options as any).docker === true, createCloudDriver, deployAllComputeSites, resolveSiteKind, onlySite: (options as any).site || undefined })
  }
  catch (err) {
    log.error('Hetzner deploy failed:')
    console.error(err instanceof Error ? (err.stack || err.message) : err)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * Loopback-bound server-app sites (e.g. the `api` site: env.HOST=127.0.0.1,
 * reached only through `buddy serve`'s same-origin /api proxy on :3000 —
 * stacksjs/stacks#1950) must NOT have their port opened to the internet.
 * ts-cloud's Hetzner provisioning opens EVERY numeric `site.port` to
 * 0.0.0.0/0 + ::/0 (collectUpstreamPorts → buildHetznerFirewallRules), which
 * would leave only the process bind between the public internet and the full
 * bun-router API. Hand the provision step a copy of the config with those
 * ports stripped — the unmodified config still drives deployAllComputeSites,
 * so the systemd unit (ExecStart, Environment=PORT) is unaffected.
 *
 * Domain-less sites only: a loopback site WITH a domain feeds the rpx
 * gateway's route table (which proxies to 127.0.0.1:port on-box), so its
 * port declaration is left alone.
 */
export function scrubLoopbackSitePortsForFirewall(tsCloudConfig: any): any {
  const sites = tsCloudConfig?.sites
  if (!sites)
    return tsCloudConfig

  const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost'])
  const scrubbed: Record<string, any> = {}
  for (const [siteName, site] of Object.entries<any>(sites)) {
    const host = String(site?.env?.HOST ?? '').toLowerCase()
    if (site && typeof site.port === 'number' && !site.domain && loopbackHosts.has(host)) {
      const rest = { ...site }
      delete rest.port
      scrubbed[siteName] = rest
    }
    else {
      scrubbed[siteName] = site
    }
  }
  return { ...tsCloudConfig, sites: scrubbed }
}

/**
 * GitHub Deployments integration for the Hetzner deploy path (best-effort).
 *
 * Records each server-* site's release as a GitHub Deployment against the repo
 * that produced it — derived from the site's own git worktree (`root`), so no
 * per-site config is needed: a site whose files come from `../adblock/dist/site`
 * records against `chrisbbreuer/very-good-adblock`, a stacks-served site against
 * `stacksjs/stacks`, etc. Deploys then show up under the repo's Deployments tab
 * and the Deployments API — for MANUAL local deploys too, not just CI.
 *
 * Uses the `gh` CLI (already authenticated on the deploying machine). Skipped when
 * running inside GitHub Actions (the workflow's own `environment:` records the
 * deployment natively, so doing it here would duplicate), when opted out with
 * `TS_CLOUD_GITHUB_DEPLOYMENTS=0`, or when `gh`/a GitHub remote is unavailable.
 * Every failure is logged and swallowed — recording a deployment must never fail
 * an otherwise-successful release.
 */
interface GithubDeploymentRecord {
  repo: string
  id: number
  environment: string
  environmentUrl?: string
}

function githubDeploymentsEnabled(): boolean {
  return process.env.GITHUB_ACTIONS !== 'true' && process.env.TS_CLOUD_GITHUB_DEPLOYMENTS !== '0'
}

async function ghCliAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process')
    execSync('gh --version', { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
}

/**
 * owner/repo + HEAD sha for the git worktree a site's files come from, or null
 * when `root` is missing or has no GitHub remote. Git resolves from any subdir of
 * a worktree, including a gitignored build dir like `../adblock/dist/site`.
 */
async function resolveSiteGithubSource(root: string): Promise<{ repo: string, ref: string } | null> {
  try {
    const { execSync } = await import('node:child_process')
    const run = (cmd: string) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const match = run('git config --get remote.origin.url').match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
    if (!match?.[1])
      return null
    return { repo: match[1], ref: run('git rev-parse HEAD') }
  }
  catch {
    return null
  }
}

/** POST a deployment status. Best-effort; a failure here never fails the deploy. */
async function setGithubDeploymentStatus(record: GithubDeploymentRecord, state: 'in_progress' | 'success' | 'failure'): Promise<void> {
  try {
    const { execSync } = await import('node:child_process')
    const body = JSON.stringify({
      state,
      environment: record.environment,
      ...(record.environmentUrl ? { environment_url: record.environmentUrl } : {}),
      description: state === 'success' ? 'Deployed' : state === 'failure' ? 'Deploy failed' : 'Deploying',
    })
    execSync(`gh api -X POST repos/${record.repo}/deployments/${record.id}/statuses --input -`, { input: body, stdio: ['pipe', 'ignore', 'ignore'] })
  }
  catch (err) {
    log.warn(`GitHub deployment status (${state}) skipped for ${record.repo}: ${getErrorMessage(err)}`)
  }
}

/** POST a GitHub deployment + mark it in_progress. Best-effort → null on failure. */
async function startGithubDeployment(source: { repo: string, ref: string }, environment: string, environmentUrl?: string): Promise<GithubDeploymentRecord | null> {
  try {
    const { execSync } = await import('node:child_process')
    const body = JSON.stringify({
      ref: source.ref,
      environment,
      description: `buddy deploy (${environment})`,
      auto_merge: false,
      required_contexts: [],
      production_environment: environment === 'production',
    })
    const out = execSync(`gh api -X POST repos/${source.repo}/deployments --input - --jq '.id'`, { input: body, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
    const id = Number(out)
    if (!out || !Number.isInteger(id) || id <= 0)
      return null
    const record: GithubDeploymentRecord = { repo: source.repo, id, environment, environmentUrl }
    await setGithubDeploymentStatus(record, 'in_progress')
    return record
  }
  catch (err) {
    log.warn(`GitHub deployment record skipped for ${source.repo}: ${getErrorMessage(err)}`)
    return null
  }
}

/**
 * Record a GitHub Deployment for each server-* site being shipped, against the
 * repo its files come from (deduped by repo+ref so the apex/www pair, or several
 * stacks-served sites, collapse to one). Returns the records to finalize once the
 * release succeeds or fails. See {@link githubDeploymentsEnabled}.
 */
async function startGithubDeployments(args: {
  sites: Record<string, any>
  onlySite: string | undefined
  environment: string
  resolveSiteKind: (site: any) => 'bucket' | 'server-app' | 'server-static' | 'server-php' | 'redirect'
}): Promise<GithubDeploymentRecord[]> {
  const { sites, onlySite, environment, resolveSiteKind } = args
  const records: GithubDeploymentRecord[] = []
  if (!githubDeploymentsEnabled() || !(await ghCliAvailable()))
    return records

  const seen = new Set<string>()
  for (const [siteName, site] of Object.entries<any>(sites)) {
    if (!site || (onlySite && siteName !== onlySite))
      continue
    const kind = resolveSiteKind(site)
    if (kind === 'bucket' || kind === 'redirect')
      continue
    const source = await resolveSiteGithubSource(site.root || '.')
    if (!source)
      continue
    const key = `${source.repo}@${source.ref}`
    if (seen.has(key))
      continue
    seen.add(key)
    const record = await startGithubDeployment(source, environment, site.domain ? `https://${site.domain}` : undefined)
    if (record) {
      records.push(record)
      log.info(`GitHub deployment ${record.repo}#${record.id} → ${environment}`)
    }
  }
  return records
}

async function runHetznerDeploy(args: {
  tsCloudConfig: any
  environment: 'production' | 'staging' | 'development'
  verbose: boolean
  docker: boolean
  createCloudDriver: any
  deployAllComputeSites: any
  resolveSiteKind: (site: any) => 'bucket' | 'server-app' | 'server-static' | 'server-php' | 'redirect'
  /** Deploy ONLY this site (multi-tenant surgical add). Provisioning still uses
   *  the full config so rpx keeps every existing route; only this site's files
   *  are rebuilt/shipped and only its domain gets a DNS record. */
  onlySite?: string
}): Promise<void> {
  const { tsCloudConfig, environment, verbose, docker, createCloudDriver, deployAllComputeSites, resolveSiteKind, onlySite } = args

  const startTime = performance.now()
  console.log('')
  console.log('🚀 Deploy → Hetzner Cloud')
  console.log('')
  log.info(`Project: ${tsCloudConfig.project?.slug}`)
  log.info(`Environment: ${environment}`)
  log.info(`Location: ${tsCloudConfig.hetzner?.location || process.env.HCLOUD_LOCATION || 'fsn1'}`)
  log.info(`Size: ${tsCloudConfig.infrastructure?.compute?.size || 'small'}`)

  // Auto-inject the ts-cloud management dashboard (a `dashboard.<apex>` site,
  // behind Basic auth) BEFORE provisioning, so the dashboard flows through the
  // WHOLE deploy: rpx routing + on-demand TLS, the DNS A record, the release
  // tarball, and the file deploy. (ts-cloud's deployAllComputeSites would inject
  // it too, but only AFTER provisioning/DNS, leaving it unreachable.) Idempotent
  // and best-effort: a UI-resolution hiccup or an older ts-cloud without the
  // export never blocks the app deploy. Set TS_CLOUD_UI_DISABLE=1 to opt out.
  try {
    const { ensureManagementDashboard } = (await import('@stacksjs/ts-cloud')) as any
    if (typeof ensureManagementDashboard === 'function') {
      ensureManagementDashboard(tsCloudConfig, {
        cwd: process.cwd(),
        logger: { info: (m: string) => log.info(m), warn: (m: string) => log.warn(m) },
      })
    }
  }
  catch (err) {
    log.warn(`Management dashboard injection skipped: ${getErrorMessage(err)}`)
  }

  const driver = createCloudDriver({ config: tsCloudConfig, provider: 'hetzner' })
  if (!driver.provisionComputeInfrastructure) {
    log.error('Hetzner driver does not support compute provisioning (update @stacksjs/ts-cloud).')
    process.exit(ExitCode.FatalError)
  }

  // Attach mode: this project deploys ITS sites onto a box owned by another
  // project (`cloud.attachTo`), instead of provisioning its own. The owner
  // (e.g. stacks) manages the box, gateway, firewall and shared services; we
  // only ship our site(s), add our own rpx `sites.d/<slug>.json` (additive —
  // rpx merges every project's fragment) and our domain's DNS. Site ports are
  // localhost-only (rpx is the sole public entry), so no firewall change is
  // needed. Implemented purely by pinning the shared box in THIS project's
  // ts-cloud driver state, which getComputeOutputs/findComputeTargets already
  // honour ("record its serverId there" — for a shared box).
  const attachTo: string | undefined = tsCloudConfig.cloud?.attachTo
  let ip: string | undefined
  if (attachTo) {
    const box = await resolveAttachTargetBox(attachTo, environment)
    if (!box?.publicIp) {
      log.error(`Attach target '${attachTo}' has no reachable box for '${environment}'. Is '${attachTo}-${environment}-app' provisioned (by its owner)?`)
      process.exit(ExitCode.FatalError)
    }
    ip = box.publicIp
    log.info(`Attaching to '${attachTo}' box '${box.serverName}' (${ip}) — skipping provisioning`)

    // The attached-to box is fronted by the owner's rpx gateway (it owns :80/:443
    // and terminates TLS). Force rpx for our sites regardless of what the config
    // says, so we NEVER try to stand up our own nginx + certbot — on a shared box
    // that collides with rpx (`bind() 0.0.0.0:80: Address already in use`) and
    // fails the deploy even though rpx already serves the site. Applies to both
    // server-app and server-static sites: static sites become additive rpx
    // file_server routes, not a separate nginx vhost.
    //
    // Also default managed TLS ON (a tenant can still opt out with an explicit
    // `proxy.onDemandTls: false`). ts-cloud's rpx provisioning only emits the
    // per-project cert issuance/renewal units (`/etc/rpx/renew-certs-<slug>.sh`
    // + `rpx-cert-renew-<slug>.{service,timer}`, one idempotent set per tenant
    // slug covering that tenant's site domains) when `proxy.onDemandTls` is set.
    // Owner deploys set it in their own config, so their domains get certs —
    // but an attached tenant that didn't declare it got only the sites.d
    // fragment: its routes worked while its domain served the box's fallback
    // cert forever, with no unit to ever issue the real one.
    const compute = ((tsCloudConfig.infrastructure ??= {}).compute ??= {}) as Record<string, any>
    compute.webServer = 'rpx'
    compute.proxy = { onDemandTls: true, ...(compute.proxy ?? {}), engine: 'rpx' }
    // Pin the shared box in OUR own driver state so ts-cloud's deploy targets it
    // (keyed by our project's stack name — we never touch the owner's state file).
    // This is the exact shape ts-cloud's readDriverState expects; writing it
    // directly avoids depending on a ts-cloud export.
    //
    // The name MUST match ts-cloud's `resolveProjectStackName` (`<slug>-<env>`,
    // or an explicit `project.stackName`) — that's the key findComputeTargets
    // reads. A previous `<slug>-<env>-app` name mismatched, so the pin was never
    // found: staging still deployed (findComputeTargets adopts the unique
    // env=staging box) but production failed whenever a second env=production
    // ts-cloud app server existed (e.g. uptime-status), making adoption
    // ambiguous and leaving the pin the only resolver.
    const stackName = tsCloudConfig.project?.stackName || `${tsCloudConfig.project?.slug || 'app'}-${environment}`
    const stateDir = join(process.cwd(), '.ts-cloud', 'state')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, `${stackName}.json`), `${JSON.stringify({
      stackName,
      serverId: box.serverId,
      serverName: box.serverName,
      publicIp: ip,
      sshUser: 'root',
      deployStoragePath: '/var/ts-cloud/staging',
    }, null, 2)}\n`)
  }
  else {
    log.info('Provisioning Hetzner compute infrastructure...')
    // Provision with loopback-only site ports stripped so the firewall never
    // exposes them (#1950); the full config still drives deployAllComputeSites.
    const outputs = await driver.provisionComputeInfrastructure({ config: scrubLoopbackSitePortsForFirewall(tsCloudConfig), environment })
    ip = outputs.appPublicIp
    log.success('Hetzner compute infrastructure ready')
    if (outputs.appInstanceId)
      log.info(`Server ID: ${outputs.appInstanceId}`)
  }

  if (ip)
    log.info(`Server IP: ${ip}`)
  if (!ip) {
    log.error('Provisioned server has no public IP — cannot deploy over SSH.')
    process.exit(ExitCode.FatalError)
  }

  await waitForRemoteReady(ip, verbose)

  // Package each site as source-only: dependencies are NOT shipped. They are
  // installed on the server from the committed lockfile via the site's
  // `preStart` hook (`bun install --frozen-lockfile`), which keeps the upload
  // tiny (tens of MB instead of ~800MB of node_modules + pantry).
  const { execSync } = await import('node:child_process')
  const { tmpdir } = await import('node:os')
  // Environment-aware site model: staging/dev get `<prefix>.<domain>` hosts (+
  // rewritten URL env values), so one config serves prod + staging + dev.
  const sites = applyEnvironmentToSites(tsCloudConfig.sites || {}, environment, tsCloudConfig)
  const slug = tsCloudConfig.project?.slug || 'app'
  let sha: string
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  }
  catch {
    sha = Date.now().toString(36)
  }

  // Excluded from the release tarball. `node_modules`/`pantry` are reinstalled
  // on the server; the rest is dev-only noise that production never needs.
  // Patterns cover both top-level (`./x`) and nested (`*/x`) occurrences.
  const tarExcludes = [
    'node_modules',
    'pantry',
    '.git',
    '.github',
    '.cache',
    // Compiled CLI binaries (e.g. storage/framework/core/buddy/bin/buddy-linux-x64,
    // ~110MB each × platforms = ~680MB): release/distribution artifacts, never a
    // runtime dep — server-app sites launch from source (`bun … cli.ts serve`).
    // Shipping them made the stacks self-deploy tarball ~476MB and stall uploads.
    'bin',
    // Build outputs. server-app sites ship source and (re)build on the box via
    // preStart; server-static sites are packaged from INSIDE their built root
    // (`-C dist/<site>/… .`), so excluding `dist` never drops a static site's
    // files — it only strips the ~130MB of built docs/blog from source tarballs
    // that never serve them. (frontend-dist is kept: `dist` != `frontend-dist`.)
    'dist',
    // stx's build cache + generated route manifest (`.stx/routes.ts`). It MUST
    // be regenerated on the server from the shipped `resources/views` — shipping
    // a stale/empty manifest makes production `stx serve` trust it and serve 404
    // on every view route (e.g. `/`). Absent, stx-serve rescans and rebuilds it.
    '.stx',
    'tmp',
    'temp',
    '.DS_Store',
    '*.log',
    '.env.local',
    '.env.production.bak',
  ].flatMap(p => [`--exclude='${p}'`, `--exclude='*/${p}'`])

  if (onlySite && !sites[onlySite]) {
    log.error(`--site '${onlySite}' is not a configured site. Available: ${Object.keys(sites).join(', ')}`)
    process.exit(ExitCode.FatalError)
  }

  const tarballs = new Map<string, string>()
  for (const [siteName, site] of Object.entries<any>(sites)) {
    if (!site)
      continue
    // Surgical single-site deploy: build/ship only the requested site (the box
    // already holds every other site; provisioning above kept their rpx routes).
    if (onlySite && siteName !== onlySite)
      continue
    // ts-cloud's deployAllComputeSites deploys BOTH server-app sites (`start`)
    // and server-static sites (no `start`, has `root`) — and it calls
    // tarballForSite() for each. Bucket and redirect sites are NOT shipped (it
    // filters them out), so we produce a tarball for every server-* site but
    // skip bucket/redirect below.
    const kind = resolveSiteKind(site)
    if (kind === 'bucket')
      continue

    // Redirect-only sites (a `redirect` with no `root`/`build`/`start`, e.g.
    // veryGoodAdblock, wwwStacksjs) ship NOTHING: deployAllComputeSites filters
    // them out (never calls tarballForSite) and the rpx gateway answers their
    // domain with a 301. Packaging one would tar the entire repo (~73MB) that is
    // uploaded but never served — pure wasted bandwidth and deploy time. Skip.
    if (kind === 'redirect')
      continue

    // server-static: build the site locally first so the tarball contains the
    // FINAL static files (served verbatim by the reverse proxy's file_server at
    // /var/www/<site>). server-app sites ship source and build via preStart on
    // the box, so they are NOT built here.
    if (kind === 'server-static' && site.build) {
      log.info(`Building static site '${siteName}': ${site.build}`)
      execSync(site.build, { stdio: verbose ? 'inherit' : 'pipe' })
    }

    const root = site.root || '.'
    const tarballPath = join(tmpdir(), `${slug}-${siteName}-${sha}.tar.gz`)
    log.info(`Packaging ${root} → ${tarballPath}...`)
    // COPYFILE_DISABLE stops macOS bsdtar from embedding AppleDouble (._*)
    // resource-fork files — on the server those shadow real files and break
    // anything that globs a directory (e.g. `._0001-….sql` crashes migrate).
    execSync(
      `tar czf "${tarballPath}" ${tarExcludes.join(' ')} -C "${root}" .`,
      { stdio: verbose ? 'inherit' : 'pipe', env: { ...process.env, COPYFILE_DISABLE: '1' } },
    )
    const sizeMb = Math.max(1, Math.round((statSync(tarballPath).size) / 1048576))
    log.info(`Release tarball: ~${sizeMb} MB`)
    tarballs.set(siteName, tarballPath)
  }

  // `--docker` builds an OCI container image with pantry's native builder
  // (no Docker daemon, no deps) from `storage/framework/Dockerfile`, and pushes
  // it to the pantry registry when a token is present. The site itself still
  // runs dep-free via bun + systemd below, so the box stays daemon-less.
  if (docker)
    await buildContainerImageWithPantry({ slug, sites, verbose })

  // Merge each site's real production config underneath its own explicit
  // `env` overrides — see resolveDeployEnvValues' doc comment for why this
  // has to happen here (ts-cloud has no idea .env.production/decryption
  // exist) rather than inside ts-cloud itself.
  const resolvedDeployEnv = await resolveDeployEnvValues(environment)
  const sitesWithResolvedEnv = mergeSiteDeployEnv(sites, resolvedDeployEnv)

  // Also apply the decrypted values to THIS (local, deploying) process' env —
  // not just the env shipped to the remote sites above. reconcileHetznerDns
  // below (and any other local-side deploy logic) reads credentials like
  // PORKBUN_API_KEY/PORKBUN_SECRET_KEY straight from `process.env`, so a
  // secret stored (correctly) as encrypted config in .env.production would
  // otherwise never reach it — only a value manually exported in the shell
  // would work. Never clobber a value the shell already set explicitly.
  for (const [envKey, envValue] of Object.entries(resolvedDeployEnv)) {
    if (process.env[envKey] === undefined)
      process.env[envKey] = envValue
  }

  // Open a GitHub Deployment per shipped site (best-effort, non-fatal). Done here
  // — after the static builds ran (so each site's `root` exists to derive its
  // repo/ref) and before shipping — so the deployment shows as `in_progress`
  // while the release is uploaded, then success/failure below.
  const githubDeployments = await startGithubDeployments({ sites, onlySite, environment, resolveSiteKind })

  log.info(onlySite ? `Shipping site '${onlySite}' to the server...` : 'Shipping release to the server...')
  // For a single-site deploy, hand ts-cloud a config whose sites are narrowed to
  // just that one so it ships only it (provisioning already reloaded rpx with the
  // full route set, so nothing else is touched).
  const deployConfig = onlySite
    ? { ...tsCloudConfig, sites: { [onlySite]: sitesWithResolvedEnv[onlySite] } }
    : { ...tsCloudConfig, sites: sitesWithResolvedEnv }
  const ok = await deployAllComputeSites({
    config: deployConfig,
    // The rpx gateway is ALWAYS regenerated from the full site model, never the
    // narrowed single-site `deployConfig`, so a `--site` deploy can never drop the
    // other sites' routes (the production-incident guard). Use the environment-
    // aware full model so staging/dev route their `<prefix>.<domain>` hosts.
    rpxConfig: { ...tsCloudConfig, sites: sitesWithResolvedEnv },
    environment,
    driver,
    sha,
    runtime: tsCloudConfig.infrastructure?.compute?.runtime || 'bun',
    tarballForSite: (siteName: string) => {
      const path = tarballs.get(siteName)
      if (!path)
        throw new Error(`Missing tarball for site '${siteName}'`)
      return path
    },
    logger: {
      info: (m: string) => log.info(m),
      warn: (m: string) => log.warn(m),
      error: (m: string) => log.error(m),
      step: (m: string) => log.info(m),
      success: (m: string) => log.success(m),
    },
  })

  // Reconcile DNS for every site that declares a public domain. Hetzner deploys
  // historically had NO DNS step (Route53 reconciliation only ran on the AWS
  // path), so domains had to be pointed by hand. We now resolve a DNS provider
  // per-domain via ts-cloud's factory (Porkbun/Route53/Cloudflare/GoDaddy from
  // env) and upsert A records → the box IP. Non-fatal: a DNS hiccup shouldn't
  // fail an otherwise-successful release.
  if (ok)
    await reconcileHetznerDns(onlySite ? { [onlySite]: sites[onlySite] } : sites, ip, log)

  // Reconcile the app's declared DNS records (config/dns.ts) beyond the apex/www
  // A records above — e.g. verification TXT, extra CNAMEs. Strictly additive:
  // only creates declared records that are missing (and never a private IP),
  // never deletes or overwrites. Best-effort, same as the reconcilers around it.
  if (ok)
    await reconcileConfigDns(onlySite ? { [onlySite]: sites[onlySite] } : sites, log)

  // Reconcile this app's mail routing onto the (shared) mail server from
  // config/email.ts: register its local domain and provision its auto-forward
  // rules (forwards.json). Idempotent, merge-based and best-effort — it never
  // removes another tenant's domains/forwards and never fails the release.
  if (ok) {
    const mailRes = await provisionMailTenant(ip, log)
    // Publish the domain's mail DNS (MX/SPF/DKIM/DMARC) so the mailboxes can
    // actually send + receive. Best-effort, same as the tenant reconcile.
    if (mailRes)
      await reconcileMailDns(mailRes, ip, log)
  }

  // Close out every GitHub Deployment we opened (before the failure branch's
  // process.exit below, so a failed release is recorded as failed, not left
  // dangling in_progress).
  for (const record of githubDeployments)
    await setGithubDeploymentStatus(record, ok ? 'success' : 'failure')

  console.log('')
  if (ok) {
    await outro(`Deployed to Hetzner. Your site is live at http://${ip}:3000`, { startTime, useSeconds: true })
    log.info(`Coming-soon page: http://${ip}:3000  (bypass with ?secret=…)`)
  }
  else {
    await outro('Hetzner deploy reported a failure — see the per-instance output above.', { startTime, useSeconds: true })
    process.exit(ExitCode.FatalError)
  }
}

/** A mailbox resolved from `config/email.ts` to a concrete address + password. */
interface ResolvedMailbox {
  /** Full address, always `<local-part>@<domain>` (per-domain isolated mailbox). */
  address: string
  /** Local-part, uppercased for the `MAIL_PASSWORD_<LP>` env lookup. */
  localPart: string
  /** Plaintext password (from config/env, else freshly generated). */
  password: string
  /** True when the password was generated here (so the caller reports it). */
  generated: boolean
}

/**
 * Resolve `config.email.mailboxes` — which may be bare local-parts (`'chris'`),
 * full addresses (`'chris@app.com'`), or objects (`{ email, password }`) — into
 * concrete `<local-part>@<domain>` mailboxes with a password each. A password is
 * taken from the entry, else `MAIL_PASSWORD_<LOCALPART>` in the env, else a
 * strong one is generated (and flagged so the deploy prints it once).
 */
function resolveMailboxes(mailboxes: unknown, domain: string): ResolvedMailbox[] {
  if (!Array.isArray(mailboxes))
    return []
  const out: ResolvedMailbox[] = []
  for (const entry of mailboxes) {
    let raw: string | undefined
    let explicitPw: string | undefined
    if (typeof entry === 'string')
      raw = entry
    else if (entry && typeof entry === 'object') {
      raw = (entry as any).email ?? (entry as any).username
      explicitPw = (entry as any).password
    }
    if (!raw || typeof raw !== 'string')
      continue
    const localPart = (raw.includes('@') ? raw.split('@')[0] ?? '' : raw).trim()
    if (!localPart)
      continue
    const address = `${localPart}@${domain}`
    const envPw = explicitPw || process.env[`MAIL_PASSWORD_${localPart.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
    // Only provision a mailbox whose password is explicitly supplied (config
    // object or MAIL_PASSWORD_<LOCALPART> env). A routine deploy must never
    // conjure random-password mailboxes the operator never asked for and can't
    // retrieve — declare the password to opt a mailbox in.
    if (!envPw)
      continue
    out.push({ address, localPart: localPart.toUpperCase(), password: envPw, generated: false })
  }
  return out
}

/** What a mail-tenant reconcile resolved + provisioned, for the DNS step. */
export interface MailTenantResult {
  domain: string
  /** The mail server's own hostname (SMTP_HOSTNAME) — the MX target. */
  mailHost: string
  /** base64(DER) of the domain's DKIM public key, for the `mail._domainkey` TXT. */
  dkimPubB64?: string
  /** Mailboxes newly created this run (address + password), for reporting. */
  created: Array<{ address: string, password: string }>
}

/**
 * Reconcile this app's mail configuration onto the mail server running on the
 * box, straight from `config/email.ts`. Declarative, additive, idempotent:
 *
 *   1. `config.email.domain` → registered as a local delivery domain
 *      (`SMTP_LOCAL_DOMAINS` in `/etc/mail/mail.env`).
 *   2. A per-domain DKIM key is generated on first sight (`/opt/mail/dkim/<domain>.private`)
 *      and registered in `DKIM_EXTRA_KEYS` so outbound mail is signed AS the domain.
 *   3. `config.email.mailboxes` → created as per-domain isolated users
 *      (`mail-server user:local create <lp>@<domain>`), skipping any that exist.
 *   4. `config.email.forwards` → merged into `forwards.json` (live-reloaded).
 *
/**
 * Resolve the shared box owned by another project (`cloud.attachTo`) so this
 * project can deploy its sites onto it without provisioning. Looks the box up
 * by the owner's ts-cloud labels (`ts-cloud/project=<owner>`,
 * `environment=<env>`, `role=app`) — the same labels ts-cloud stamps on every
 * app server — falling back to the conventional `<owner>-<env>-app` name. Needs
 * only read access via HCLOUD_TOKEN (the same token the owner provisions with).
 */
async function resolveAttachTargetBox(
  owner: string,
  environment: string,
): Promise<{ serverId: number, serverName: string, publicIp?: string } | null> {
  const token = process.env.HCLOUD_TOKEN
  if (!token)
    return null
  const pick = (servers: any[]): any | undefined =>
    servers.find(s => s?.status !== 'off' && s?.public_net?.ipv4?.ip) || servers[0]
  const req = async (qs: string): Promise<any[]> => {
    try {
      const res = await fetch(`https://api.hetzner.cloud/v1/servers?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok)
        return []
      return ((await res.json()) as any).servers || []
    }
    catch {
      return []
    }
  }
  // Label match first (robust to renames), then the conventional name.
  const byLabel = await req(`label_selector=${encodeURIComponent(`ts-cloud/project=${owner},ts-cloud/environment=${environment},ts-cloud/role=app`)}`)
  const chosen = pick(byLabel) || pick(await req(`name=${encodeURIComponent(`${owner}-${environment}-app`)}`))
  if (!chosen)
    return null
  return { serverId: chosen.id, serverName: chosen.name, publicIp: chosen.public_net?.ipv4?.ip }
}

/**
 * Everything is MERGE-based so a shared mail server keeps every other tenant's
 * domains, keys, users, and forward rules untouched. Best-effort — a hiccup is
 * logged, never fails the release. Returns what the DNS step needs (mail host +
 * DKIM public key), or null when there is nothing to reconcile / it failed.
 */
export async function provisionMailTenant(ip: string, logger: typeof log): Promise<MailTenantResult | null> {
  const cfg: any = emailConfig || {}
  const domain: string | undefined = cfg.domain
    || (typeof cfg.from?.address === 'string' && cfg.from.address.includes('@') ? cfg.from.address.split('@')[1] : undefined)
  const forwards: Record<string, string[]> = (cfg.forwards && typeof cfg.forwards === 'object') ? cfg.forwards : {}
  const hasForwards = Object.keys(forwards).length > 0
  const boxes = domain ? resolveMailboxes(cfg.mailboxes, domain) : []

  // Nothing declarative to reconcile — skip silently (most apps).
  if (!domain && !hasForwards)
    return null

  const { execSync } = await import('node:child_process')
  const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', `root@${ip}`]

  // Compact forwards JSON, base64'd so it survives the SSH shell hop untouched.
  const forwardsB64 = hasForwards ? Buffer.from(JSON.stringify(forwards)).toString('base64') : ''
  const readme = 'Auto-forwarding rules, re-read on every message (edits take effect immediately, no restart). '
    + 'KEY = the delivered mailbox: the FULL address for per-domain isolated mailboxes (e.g. no-reply@app.com), '
    + 'or a bare local-part for legacy role mailboxes. VALUE = list of destination addresses; targets on a local '
    + 'domain are written straight to that mailbox Maildir, external targets are relayed. Managed by buddy deploy '
    + 'from config/email.ts (merge-based — hand edits to other keys are preserved).'
  const readmeB64 = Buffer.from(readme).toString('base64')
  // address<TAB>password per mailbox, base64'd as one blob for the shell hop.
  const boxesB64 = boxes.length ? Buffer.from(boxes.map(b => `${b.address}\t${b.password}`).join('\n')).toString('base64') : ''

  // One idempotent, merge-based reconcile script. Emits keyed lines the caller
  // parses: MAILHOST:, DKIMPUB:, MADE:<addr>, and a final MAILTENANT:<state>.
  const script = `set -e
DOMAIN=${domain ? `'${domain}'` : "''"}
FWD_B64='${forwardsB64}'
README_B64='${readmeB64}'
BOXES_B64='${boxesB64}'
ENVF=/etc/mail/mail.env
FJSON=/opt/mail/forwards.json
DKIMDIR=/opt/mail/dkim
MS=/opt/mail/mail-server
ENV_CHANGED=0
# The 'user:local' CLI is direct-DB and does NOT read /etc/mail/mail.env, so
# without SMTP_DB_PATH it writes to ./smtp.db (the SSH cwd) — a phantom DB the
# running server never reads, and auth silently 535s. Point it at the real DB.
export SMTP_DB_PATH="$(grep -E '^SMTP_DB_PATH=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- || true)"
[ -z "$SMTP_DB_PATH" ] && export SMTP_DB_PATH=/opt/mail/smtp.db
echo "MAILHOST:$(grep -E '^SMTP_HOSTNAME=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- || true)"
# 1) Register the local delivery domain (merge into SMTP_LOCAL_DOMAINS).
if [ -n "$DOMAIN" ] && [ -f "$ENVF" ]; then
  cur=$(grep -E '^SMTP_LOCAL_DOMAINS=' "$ENVF" | head -1 | cut -d= -f2- || true)
  case ",$cur," in
    *",$DOMAIN,"*) : ;;
    *) if grep -qE '^SMTP_LOCAL_DOMAINS=' "$ENVF"; then
        sed -i "s|^SMTP_LOCAL_DOMAINS=.*|SMTP_LOCAL_DOMAINS=\${cur:+$cur,}$DOMAIN|" "$ENVF"
      else
        echo "SMTP_LOCAL_DOMAINS=$DOMAIN" >> "$ENVF"
      fi
      ENV_CHANGED=1 ;;
  esac
fi
# 2) Per-domain DKIM key: generate on first sight, register in DKIM_EXTRA_KEYS.
if [ -n "$DOMAIN" ] && [ -f "$ENVF" ]; then
  mkdir -p "$DKIMDIR"
  KEY="$DKIMDIR/$DOMAIN.private"
  if [ ! -f "$KEY" ]; then
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEY" 2>/dev/null
    chown mail-server:mail-server "$KEY" 2>/dev/null || true
    chmod 600 "$KEY" 2>/dev/null || true
  fi
  ex=$(grep -E '^DKIM_EXTRA_KEYS=' "$ENVF" | head -1 | cut -d= -f2- || true)
  ENTRY="$DOMAIN:mail:$KEY"
  case ",$ex," in
    *"$DOMAIN:mail:"*) : ;;
    *) if grep -qE '^DKIM_EXTRA_KEYS=' "$ENVF"; then
        sed -i "s|^DKIM_EXTRA_KEYS=.*|DKIM_EXTRA_KEYS=\${ex:+$ex,}$ENTRY|" "$ENVF"
      else
        echo "DKIM_EXTRA_KEYS=$ENTRY" >> "$ENVF"
      fi
      ENV_CHANGED=1 ;;
  esac
  echo "DKIMPUB:$(openssl rsa -in "$KEY" -pubout -outform DER 2>/dev/null | base64 -w0)"
fi
# 3) Create the configured mailboxes as per-domain isolated users (skip existing).
if [ -n "$BOXES_B64" ] && [ -x "$MS" ]; then
  echo "$BOXES_B64" | base64 -d | while IFS=$'\t' read -r addr pw; do
    [ -z "$addr" ] && continue
    # NOTE: 'user:local info' exits 0 even when the user is absent (it only
    # prints "not found"), so existence is decided from the OUTPUT, not $?.
    if "$MS" user:local info "$addr" 2>&1 | grep -qi 'not found'; then
      if "$MS" user:local create "$addr" "$pw" "$addr" >/dev/null 2>&1; then echo "MADE:$addr"; else echo "FAIL:$addr"; fi
    else
      echo "EXISTS:$addr"
    fi
  done
fi
# 4) Merge auto-forward rules into forwards.json (live-reloaded; no restart).
if [ -n "$FWD_B64" ] && [ -x /usr/local/bin/bun ]; then
  echo "$FWD_B64" | base64 -d > /tmp/.mailtenant-fwd.json
  echo "$README_B64" | base64 -d > /tmp/.mailtenant-readme.txt
  /usr/local/bin/bun --bun -e '
    const fs=require("fs"); const f="/opt/mail/forwards.json";
    const cur={}; try{cur=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}
    const add=JSON.parse(fs.readFileSync("/tmp/.mailtenant-fwd.json","utf8"));
    const readme=fs.readFileSync("/tmp/.mailtenant-readme.txt","utf8");
    const merged={...cur}; delete merged._readme;
    for(const [k,v] of Object.entries(add)) merged[k]=v;
    const out={_readme:readme,...merged};
    const s=JSON.stringify(out,null,2)+"\\n";
    const prev=""; try{prev=fs.readFileSync(f,"utf8")}catch{}
    if(s!==prev){ fs.writeFileSync(f,s); process.stdout.write("FWDCHANGED"); }
  ' > /tmp/.mailtenant-res 2>/dev/null || true
  chown mail-server:mail-server "$FJSON" 2>/dev/null || true
  chmod 644 "$FJSON" 2>/dev/null || true
  rm -f /tmp/.mailtenant-fwd.json /tmp/.mailtenant-readme.txt
fi
FWD_STATE=nochange; grep -q FWDCHANGED /tmp/.mailtenant-res 2>/dev/null && FWD_STATE=updated; rm -f /tmp/.mailtenant-res
# 5) Restart only when the startup-read env actually changed (domain or DKIM key).
if [ "$ENV_CHANGED" = 1 ]; then systemctl restart mail 2>/dev/null || true; echo "MAILTENANT:env-changed+restarted,forwards=$FWD_STATE"; else echo "MAILTENANT:current,forwards=$FWD_STATE"; fi`

  try {
    const out = execSync(`ssh ${sshArgs.map(a => `'${a}'`).join(' ')} bash -s`, {
      input: script,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const line = (out.match(/MAILTENANT:[^\n]*/) || [])[0] || 'MAILTENANT:done'
    const mailHost = (out.match(/MAILHOST:([^\n]*)/) || [])[1]?.trim() || `mail.${domain}`
    const dkimPubB64 = (out.match(/DKIMPUB:([^\n]*)/) || [])[1]?.trim() || undefined
    const madeAddrs = new Set([...out.matchAll(/MADE:([^\n]+)/g)].flatMap(m => m[1] ? [m[1].trim()] : []))
    const created = boxes.filter(b => madeAddrs.has(b.address)).map(b => ({ address: b.address, password: b.password }))

    logger.success(`Mail routing reconciled (${line.replace('MAILTENANT:', '')})`)
    if (created.length) {
      logger.info(`Mail: created ${created.length} mailbox(es) — credentials below (save them; shown once):`)
      for (const b of created)
        logger.info(`  ${b.address}  ${b.password}`)
    }
    return domain ? { domain, mailHost, dkimPubB64, created } : null
  }
  catch (err) {
    // Never fail a release on a mail-reconcile hiccup — it's additive config.
    logger.warn(`Mail routing reconcile skipped: ${getErrorMessage(err)}`)
    return null
  }
}

/**
 * Publish the mail DNS for a hosted domain via Porkbun (idempotent delete+create
 * per record): MX → the mail host, SPF authorizing the box IP, the domain's DKIM
 * public key at `mail._domainkey`, and a DMARC policy. Best-effort — logged, not
 * thrown. No-op without Porkbun credentials (the records are printed to add by
 * hand). MX targets the tenant's own `mail.<domain>` when that name already
 * resolves to the box (own-brand mail host; requires the mail cert to cover it
 * as a SAN), and falls back to the shared mail host (`mail.stacksjs.com`)
 * otherwise, where no per-domain mail A record or extra TLS SAN is needed.
 */
export async function reconcileMailDns(res: MailTenantResult, ip: string, logger: typeof log): Promise<void> {
  const { domain, dkimPubB64 } = res
  let { mailHost } = res

  // Prefer the tenant's own mail hostname when it already points at this box.
  try {
    const dns = await import('node:dns')
    const own = `mail.${domain}`
    if (own !== mailHost && (await dns.promises.resolve4(own)).includes(ip))
      mailHost = own
  }
  catch { /* keep the shared mail host */ }

  const spf = `v=spf1 ip4:${ip} ~all`
  // DMARC aggregate reports go to the configured from-address (falling back to
  // the first declared mailbox, then chris@) so reports reach a real inbox.
  const cfg: any = emailConfig || {}
  const firstBox = resolveMailboxes(cfg.mailboxes, domain)[0]?.address
  const fromAddress = typeof cfg.from?.address === 'string' && cfg.from.address.includes('@') ? cfg.from.address : undefined
  const rua = fromAddress || firstBox || `chris@${domain}`
  const dmarc = `v=DMARC1; p=quarantine; rua=mailto:${rua}`
  const dkim = dkimPubB64 ? `v=DKIM1; k=rsa; p=${dkimPubB64}` : undefined

  const apiKey = process.env.PORKBUN_API_KEY
  const secretKey = process.env.PORKBUN_SECRET_KEY
  if (!apiKey || !secretKey) {
    logger.warn(`Mail DNS: no Porkbun credentials — add these records for ${domain} by hand:`)
    logger.info(`  MX    @                 10 ${mailHost}`)
    logger.info(`  TXT   @                 ${spf}`)
    if (dkim) logger.info(`  TXT   mail._domainkey   ${dkim}`)
    logger.info(`  TXT   _dmarc            ${dmarc}`)
    return
  }

  const auth = { apikey: apiKey, secretapikey: secretKey }
  const call = async (path: string, body: Record<string, unknown>): Promise<any> => {
    const r = await fetch(`https://api.porkbun.com/api/json/v3/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, ...body }),
    })
    return r.json().catch(() => ({}))
  }
  // Idempotent upsert: delete every record of this name+type, then recreate.
  const upsert = async (type: string, name: string, content: string, extra: Record<string, unknown> = {}): Promise<void> => {
    const sub = name === '@' ? '' : `/${name}`
    await call(`dns/deleteByNameType/${domain}/${type}${sub}`, {})
    const created = await call(`dns/create/${domain}`, { name: name === '@' ? '' : name, type, content, ttl: '600', ...extra })
    if (created?.status !== 'SUCCESS')
      throw new Error(`${type} ${name}: ${created?.message || 'unknown Porkbun error'}`)
  }

  try {
    await upsert('MX', '@', mailHost, { prio: '10' })
    await upsert('TXT', '@', spf)
    if (dkim)
      await upsert('TXT', 'mail._domainkey', dkim)
    await upsert('TXT', '_dmarc', dmarc)
    logger.success(`Mail DNS published for ${domain} (MX→${mailHost}, SPF, DKIM, DMARC)`)
  }
  catch (err) {
    logger.warn(`Mail DNS reconcile skipped for ${domain}: ${getErrorMessage(err)}`)
  }
}

/**
 * Point every site's public domain (apex + `www`) at the Hetzner box via the
 * appropriate DNS provider. Providers are resolved per-domain from the
 * environment (Porkbun, Route53, Cloudflare, GoDaddy) using ts-cloud's
 * `detectDnsProvider`, so whichever registrar actually hosts the zone is used.
 * Idempotent (upsert) and best-effort — failures are logged, not thrown.
 */
// Additively reconcile the app's config/dns.ts records (verification TXT, extra
// records) for every site domain, using the shared provider-agnostic
// syncDnsConfig from @stacksjs/dns. Create-only and never destructive, so it is
// safe to run on every deploy; a no-op when config/dns.ts declares no records.
async function reconcileConfigDns(sites: Record<string, any>, logger: typeof log): Promise<void> {
  const declared = (['a', 'aaaa', 'cname', 'mx', 'txt'] as const)
    .reduce((total, key) => total + (Array.isArray((dnsConfig as any)?.[key]) ? (dnsConfig as any)[key].length : 0), 0)
  if (declared === 0)
    return

  const domains = new Set<string>()
  for (const site of Object.values(sites)) {
    if (site?.domain && typeof site.domain === 'string')
      domains.add(site.domain.replace(/^www\./, ''))
  }

  for (const domain of domains) {
    try {
      const result = await syncDnsConfig(domain, dnsConfig)
      if (!result.provider)
        continue // no registrar credentials resolved for this domain; skip quietly
      if (result.created || result.failed)
        logger.info(`DNS (config/dns.ts) ${domain}: ${result.created} created, ${result.kept} kept${result.failed ? `, ${result.failed} failed` : ''}`)
    }
    catch (err) {
      logger.warn(`DNS (config/dns.ts) reconcile for ${domain} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

async function reconcileHetznerDns(sites: Record<string, any>, ip: string, logger: typeof log): Promise<void> {
  // Collect the apex domains declared by sites (skip loopback/domain-less sites).
  const domains = new Set<string>()
  for (const site of Object.values(sites)) {
    if (site?.domain && typeof site.domain === 'string')
      domains.add(site.domain.replace(/^www\./, ''))
  }
  if (domains.size === 0)
    return

  // Candidate provider configs, built from whatever credentials are present.
  const providerConfigs: any[] = []
  if (process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY)
    providerConfigs.push({ provider: 'porkbun', apiKey: process.env.PORKBUN_API_KEY, secretKey: process.env.PORKBUN_SECRET_KEY })
  if (process.env.CLOUDFLARE_API_TOKEN)
    providerConfigs.push({ provider: 'cloudflare', apiToken: process.env.CLOUDFLARE_API_TOKEN })
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)
    providerConfigs.push({ provider: 'route53' })

  if (providerConfigs.length === 0) {
    logger.warn('DNS: no DNS provider credentials found (PORKBUN_API_KEY/…); skipping DNS reconciliation.')
    for (const d of domains)
      logger.info(`  Point manually:  A ${d} → ${ip}   and   A www.${d} → ${ip}`)
    return
  }

  const { detectDnsProvider } = await import('@stacksjs/ts-cloud') as any
  logger.info('Reconciling DNS records...')

  // Best-effort A-record lookup so externally managed domains that already
  // point at the box read as healthy instead of warning on every deploy.
  const resolveA = async (fqdn: string): Promise<string[]> => {
    try {
      const { resolve4 } = await import('node:dns/promises')
      return await resolve4(fqdn)
    }
    catch {
      return []
    }
  }

  for (const domain of domains) {
    try {
      const provider = await detectDnsProvider(domain, providerConfigs)
      if (!provider) {
        // No configured provider owns this zone — the records may still be
        // correct (managed at the registrar). Only warn when they aren't.
        for (const sub of ['', 'www']) {
          const fqdn = sub ? `${sub}.${domain}` : domain
          const current = await resolveA(fqdn)
          if (current.includes(ip))
            logger.success(`  DNS: ${fqdn} → ${ip} (externally managed, already correct)`)
          else if (current.length === 0)
            logger.warn(`  DNS: ${fqdn} does not resolve and no configured provider manages ${domain} — create it manually: A ${fqdn} → ${ip}`)
          else
            logger.warn(`  DNS: ${fqdn} resolves to ${current.join(', ')} but this deploy targets ${ip}, and no configured provider manages ${domain} — update it manually: A ${fqdn} → ${ip}`)
        }
        continue
      }
      for (const sub of ['', 'www']) {
        const fqdn = sub ? `${sub}.${domain}` : domain
        const res = await provider.upsertRecord(domain, { name: sub, type: 'A', content: ip, ttl: 600 })
        if (res?.success === false)
          logger.warn(`  DNS: ${fqdn} → ${ip} failed: ${res.error || 'unknown error'}`)
        else
          logger.success(`  DNS: ${fqdn} → ${ip} (${provider.name})`)
      }
    }
    catch (err: any) {
      logger.warn(`  DNS: ${domain} reconciliation failed: ${err?.message || err}`)
    }
  }
}

/**
 * Build an OCI container image for each site using pantry's native, daemon-less
 * builder — no Docker dependency. The image is built from the framework's
 * generated `storage/framework/Dockerfile` and pushed to the pantry registry
 * when `PANTRY_REGISTRY_TOKEN`/`PANTRY_TOKEN` is set, so the container can be
 * consumed by registries, CDK, or ts-cloud. The site continues to run on the
 * server via bun + systemd, keeping the box dependency-free.
 */
async function buildContainerImageWithPantry(args: {
  slug: string
  sites: Record<string, any>
  verbose: boolean
}): Promise<void> {
  const { slug, sites, verbose } = args
  const { execSync } = await import('node:child_process')

  // Resolve the pantry CLI (system install preferred; falls back to ts-pantry).
  let cli: string | undefined
  for (const candidate of ['pantry', 'ts-pantry']) {
    try {
      execSync(`command -v ${candidate}`, { stdio: 'pipe' })
      cli = candidate
      break
    }
    catch { /* not on PATH */ }
  }
  if (!cli) {
    log.warn('pantry CLI not found on PATH — skipping container image build. Install pantry to enable `--docker`.')
    return
  }

  const dockerfile = 'storage/framework/Dockerfile'
  const canPush = Boolean(process.env.PANTRY_REGISTRY_TOKEN || process.env.PANTRY_TOKEN)

  for (const [siteName, site] of Object.entries(sites)) {
    if (!site?.start)
      continue
    const tag = `${slug}-${siteName}:latest`
    log.info(`[${siteName}] building image ${tag} with pantry (native, no Docker daemon)...`)
    const flags = [
      'build', '.',
      '-t', tag,
      '-f', dockerfile,
      '--run-mode', 'skip', // build runs locally; deps install on the server
    ]
    if (canPush)
      flags.push('--push')
    execSync(`${cli} ${flags.map(f => (f.includes(' ') ? `'${f}'` : f)).join(' ')}`, {
      stdio: verbose ? 'inherit' : 'pipe',
      maxBuffer: 1024 * 1024 * 512,
    })
    log.success(`[${siteName}] image built${canPush ? ' + pushed to the pantry registry' : ''}`)
  }
}

export function deploy(buddy: CLI): void {
  const descriptions = {
    deploy: 'Deploy your project',
    project: 'Target a specific project',
    production: 'Deploy to production',
    development: 'Deploy to development',
    staging: 'Deploy to staging',
    yes: 'Confirm all prompts by default',
    domain: 'Specify a domain to deploy to',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy [env]', descriptions.deploy)
    .option('--domain', descriptions.domain, { default: undefined })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--prod', descriptions.production, { default: true })
    .option('--dev', descriptions.development, { default: false })
    .option('--yes', descriptions.yes, { default: false })
    .option('--site <name>', 'Deploy only this one site to the existing server (multi-tenant surgical add)', { default: undefined })
    .option('--staging', descriptions.staging, { default: false })
    .option('--docker', 'Also build an OCI image with pantry (native, no Docker daemon) and push it to the pantry registry', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (envArg: string | undefined, options: DeployOptions & { docker?: boolean }) => {
      log.debug('Running `buddy deploy` ...', options)

      await ensureDeployPrerequisites(options.verbose === true)

      // Resolve the target environment from the positional arg or the
      // --staging/--dev/--prod flags (the flags were previously ignored, so
      // `buddy deploy --staging` silently deployed production).
      const deployEnv = envArg
        || (options.staging ? 'staging' : options.dev ? 'development' : 'production')
      const deployEnvName = deployEnv === 'prod' ? 'production' : deployEnv === 'dev' ? 'development' : deployEnv

      // Deterministic, environment-aware secret resolution. Explicitly load the
      // TARGET environment's decrypted secrets into process.env BEFORE the config
      // is evaluated, overriding whatever the env plugin auto-loaded at startup
      // (which prefers .env.development when present). This is what makes each
      // app's per-env APP_KEY/DB/Stripe come from `.env.<environment>` — and,
      // crucially, keeps a plain `buddy deploy` pinned to `.env.production`
      // regardless of which .env* files exist locally.
      process.env.APP_ENV = deployEnvName
      {
        const envFile = deployEnvName === 'production' ? '.env.production' : `.env.${deployEnvName}`
        if (existsSync(p.projectPath(envFile))) {
          try {
            const { loadEnv } = await import('@stacksjs/env')
            loadEnv({ path: envFile, env: deployEnvName, keysFile: '.env.keys', overload: true, quiet: true })
          }
          catch (err) {
            log.warn(`Could not load ${envFile}: ${getErrorMessage(err)}`)
          }
        }
      }

      // Non-AWS providers (currently Hetzner) provision + deploy over SSH via
      // ts-cloud and have nothing to do with the AWS CloudFormation path below.
      // Route them off early, before any AWS credential / domain checks run.
      const tsCloudConfig = await loadTsCloudConfig(deployEnvName)
      if (tsCloudConfig && resolveProvider(tsCloudConfig) === 'hetzner') {
        await deployToHetzner(tsCloudConfig, deployEnv, options)
        return
      }

      // Clear AWS_PROFILE to prevent credential conflicts when static credentials are provided
      // AWS SDK's defaultProvider prefers profile over static credentials, causing InvalidClientTokenId errors
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        delete process.env.AWS_PROFILE
      }

      const startTime = performance.now()
      console.log('')
      console.log('🚀 Deploy')
      console.log('')

      // For production deploy, explicitly load .env.production to get the correct domain
      // This ensures we use production settings even if .env.local has different values
      let productionUrl: string | undefined
      if (deployEnv === 'production' || deployEnv === 'prod') {
        const prodEnvPath = p.projectPath('.env.production')
        if (existsSync(prodEnvPath)) {
          const prodEnvContent = readFileSync(prodEnvPath, 'utf-8')
          const urlMatch = prodEnvContent.match(/^APP_URL=(.+)$/m)
          if (urlMatch?.[1]) {
            productionUrl = urlMatch[1].trim()
            log.debug('Using APP_URL from .env.production:', productionUrl)
          }
        }
      }

      // Get domain from options, production env, env, or config
      const envUrl = env.APP_URL
      const domain = options.domain || productionUrl || envUrl || app.url

      if ((options.prod || deployEnv === 'production' || deployEnv === 'prod') && !options.yes)
        await confirmProductionDeployment()

      if (!domain) {
        log.info('No domain found in your .env.production or ./config/app.ts')
        log.info('Please ensure your domain is properly configured.')
        log.info('For more info, check out the docs or join our Discord.')
        process.exit(ExitCode.FatalError)
      }

      log.info(`Deploying to ${italic(domain)} (${deployEnv})`)

      // Skip AWS config check - we'll handle credentials in checkIfAwsIsBootstrapped
      await checkIfAwsIsBootstrapped(options)

      options.domain = await configureDomain(domain, options, startTime)

      const result = await runAction(Action.Deploy, options)

      if (result.isErr) {
        await outro(
          'While running the `buddy deploy`, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Project deployed.', { startTime, useSeconds: true })
    })

  onUnknownSubcommand(buddy, "deploy")
}

async function confirmProductionDeployment() {
  // In a non-interactive shell (CI, a background job, piped stdin) there is no
  // one to answer the prompt — `prompts.confirm` would hang forever. Fail fast
  // with a clear instruction instead of stalling the pipeline.
  if (!process.stdin.isTTY) {
    log.error('Refusing to deploy to production from a non-interactive shell without confirmation.')
    log.info('   ➡️  Re-run with `--yes` to confirm (e.g. in CI): `buddy deploy --prod --yes`')
    process.exit(ExitCode.InvalidArgument)
  }

  const confirmed = await prompts.confirm({
    message: 'Are you sure you want to deploy to production?',
    initial: true,
  })

  if (!confirmed) {
    log.info('Aborting deployment...')
    process.exit(ExitCode.InvalidArgument)
  }
}

async function configureDomain(domain: string, options: DeployOptions, startTime: number) {
  log.debug('Configuring domain...', domain)
  if (!domain) {
    log.info('We could not identify a domain to deploy to.')
    log.warn('Please set your .env or ./config/app.ts properly.')
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  // TODO: we can improve this check at some point, otherwise domains that legitimately include the word localhost will fail
  // TODO: add check for whether the local APP_ENV is getting deployed, if so, ask if the user meant to deploy `dev`
  if (domain.includes('localhost')) {
    log.info('You are deploying to a local environment.')
    log.warn(
      'Please set your .env or ./config/app.ts properly. The domain we are deploying cannot be a `localhost` domain.',
    )
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  if (await hasUserDomainBeenAddedToCloud(domain)) {
    log.info('Domain is properly configured')
    log.info('Your cloud is deploying...')

    log.info(`${italic('This may take a while...')}`)

    return domain
  }

  // if the domain hasn't been added to the user's (AWS) cloud, we will add it for them
  // and then exit the process with prompts for the user to update their nameservers
  console.log('')
  log.info(`  👋  It appears to be your first ${italic(domain)} deployment.`)
  console.log('')
  log.info(italic('Let’s ensure it is all connected properly.'))
  log.info(italic('One moment...'))
  console.log('')

  const result = await addDomain({
    ...options,
    deploy: true,
    startTime,
  })

  if (result.isErr) {
    await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  await outro('Added your domain.', { startTime, useSeconds: true })
  process.exit(ExitCode.Success)
}

async function promptAndSaveCredentials() {
  // Prompt for AWS credentials
  const accessKeyId = await prompts.text({
    message: 'AWS Access Key ID:',
    validate: (value: string) => value.length > 0 ? true : 'Access Key ID is required',
  })

  if (!accessKeyId) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  const secretAccessKey = await prompts.password({
    message: 'AWS Secret Access Key:',
    validate: (value: string) => value.length > 0 ? true : 'Secret Access Key is required',
  })

  if (!secretAccessKey) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  const region = await prompts.text({
    message: 'AWS Region:',
    initial: 'us-east-1',
  })

  if (!region) {
    log.info('Deployment cancelled')
    process.exit(ExitCode.Success)
  }

  // Save credentials to .env.production with encryption
  const { setEnv } = await import('@stacksjs/env')

  // Set and encrypt the credentials
  await setEnv('AWS_ACCESS_KEY_ID', accessKeyId, { file: '.env.production', encrypt: true } as any)
  await setEnv('AWS_SECRET_ACCESS_KEY', secretAccessKey, { file: '.env.production', encrypt: true } as any)
  await setEnv('AWS_REGION', region || 'us-east-1', { file: '.env.production' })

  // Update process.env
  process.env.AWS_ACCESS_KEY_ID = accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey
  process.env.AWS_REGION = region || 'us-east-1'

  log.success('AWS credentials saved securely to .env.production')
  console.log('')
}

/**
 * Load AWS credentials from environment-specific .env file
 * Returns credentials if found, otherwise empty object
 */
function loadAwsCredentialsFromEnv(): { accessKeyId?: string, secretAccessKey?: string, region?: string, accountId?: string } {
  // Determine environment from APP_ENV
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

  // Try environment-specific file first (e.g., .env.staging, .env.production)
  const envFiles = [
    p.projectPath(`.env.${environment}`),
    p.projectPath('.env'),
  ]

  for (const envPath of envFiles) {
    if (!existsSync(envPath)) {
      continue
    }

    try {
      const content = readFileSync(envPath, 'utf-8')
      const lines = content.split('\n')

      let accessKeyId: string | undefined
      let secretAccessKey: string | undefined
      let region: string | undefined
      let accountId: string | undefined

      for (const line of lines) {
        const trimmed = line.trim()

        // Skip comments and empty lines
        if (trimmed.startsWith('#') || !trimmed.includes('=')) {
          continue
        }

        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim()

        if (key === 'AWS_ACCESS_KEY_ID' && value) {
          accessKeyId = value
        }
        else if (key === 'AWS_SECRET_ACCESS_KEY' && value) {
          secretAccessKey = value
        }
        else if (key === 'AWS_REGION' && value) {
          region = value
        }
        else if (key === 'AWS_ACCOUNT_ID' && value) {
          accountId = value
        }
      }

      if (accessKeyId && secretAccessKey) {
        log.debug(`Found AWS credentials in ${envPath}`)
        return { accessKeyId, secretAccessKey, region, accountId }
      }
    }
    catch (error) {
      log.debug(`Failed to read ${envPath} file:`, error)
    }
  }

  return {}
}

async function checkIfAwsIsBootstrapped(options?: DeployOptions) {
  let handlingAlreadyExists = false

  try {
    log.info('Ensuring AWS cloud stack exists...')

    // Check if AWS credentials are configured in env vars (non-empty values)
    let hasCredentials: any = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY

    // Try to load from environment-specific .env file first
    if (!hasCredentials) {
      const envCredentials = loadAwsCredentialsFromEnv()

      if (envCredentials.accessKeyId && envCredentials.secretAccessKey) {
        process.env.AWS_ACCESS_KEY_ID = envCredentials.accessKeyId
        process.env.AWS_SECRET_ACCESS_KEY = envCredentials.secretAccessKey
        if (envCredentials.region && !process.env.AWS_REGION) {
          process.env.AWS_REGION = envCredentials.region
        }
        if (envCredentials.accountId && !process.env.AWS_ACCOUNT_ID) {
          process.env.AWS_ACCOUNT_ID = envCredentials.accountId
        }
        hasCredentials = true
        const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'
        log.success(`Using AWS credentials from .env.${environment}`)
      }
    }

    // If still no credentials, try to load from ~/.aws/credentials
    if (!hasCredentials) {
      const fileCredentials = loadAwsCredentialsFromFile()

      if (fileCredentials.accessKeyId && fileCredentials.secretAccessKey) {
        // Set credentials in process.env for downstream use
        process.env.AWS_ACCESS_KEY_ID = fileCredentials.accessKeyId
        process.env.AWS_SECRET_ACCESS_KEY = fileCredentials.secretAccessKey
        if (fileCredentials.region && !process.env.AWS_REGION) {
          process.env.AWS_REGION = fileCredentials.region
        }
        hasCredentials = true
        log.success('Using AWS credentials from ~/.aws/credentials')
      }
    }

    if (!hasCredentials) {
      log.info('AWS credentials not found in .env or ~/.aws/credentials.')
      log.info('You can either:')
      log.info('  1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.production')
      log.info('  2. Add credentials to ~/.aws/credentials')
      log.info('  3. Configure them interactively below')
      console.log('')

      // If --yes flag is used, skip prompting and just inform the user
      if (options?.yes) {
        log.info('Skipping credential setup (--yes flag provided)')
        process.exit(ExitCode.FatalError)
      }

      const setupCredentials = await prompts.confirm({
        message: 'Would you like to configure AWS credentials now?',
        initial: true,
      })

      log.debug('setupCredentials response:', setupCredentials, typeof setupCredentials)

      // Handle user cancellation (Ctrl+C or ESC) or explicit "no"
      if (setupCredentials === undefined || setupCredentials === false) {
        if (setupCredentials === undefined) {
          console.log('')
          log.info('Deployment cancelled')
          process.exit(ExitCode.Success)
        }
        console.log('')
        log.info('Skipping cloud infrastructure check')
        log.info('You can configure AWS credentials later by running: buddy configure:aws')
        return true
      }

      await promptAndSaveCredentials()
    }
    else {
      log.success('AWS credentials found')
    }

    // Generate stack name from app name and environment
    const appName = (process.env.APP_NAME || app.name || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const stackName = `${appName}-cloud`

    // Use ts-cloud's CloudFormation client
    const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')

    // Don't pass AWS_PROFILE when we have static credentials to avoid conflicts
    const cfnClient = new AWSCloudFormationClient(
      process.env.AWS_REGION || 'us-east-1'
    )

    // Check if stack exists and if it needs updating
    let stackExists = false
    let needsEmailUpdate = false

    try {
      const stack = (await cfnClient.describeStacks({ stackName })).Stacks?.[0]

      if (stack) {
        stackExists = true
        log.success('Cloud stack exists')

        // Check if email infrastructure is already deployed and matches config
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const awsCfnClient = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')
        const resources = await awsCfnClient.listStackResources(stackName)
        const hasEmailBucket = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailBucket'
        )
        const hasOutboundLambda = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'OutboundEmailLambda'
        )
        const hasConversionLambda = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailConversionLambda'
        )
        const hasNotificationTopic = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'EmailNotificationTopic'
        )
        const hasMailApiLambda = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'MailApiLambda'
        )
        const hasMailUsersTable = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'MailUsersTable'
        )
        const hasMailServerInstance = resources.StackResourceSummaries?.some(
          (r: any) => r.LogicalResourceId === 'MailServerInstance'
        )

        // Get current email domain from stack outputs to check if it needs updating
        const currentEmailDomain = stack.Outputs?.find(
          (o: any) => o.OutputKey === 'EmailDomain'
        )?.OutputValue

        const configuredDomain = (emailConfig?.from?.address?.includes('@') ? emailConfig.from.address.split('@')[1] : undefined) || 'stacksjs.com'

        if (!hasEmailBucket && emailConfig?.server?.scan !== undefined) {
          log.info('Email infrastructure not found in stack, will update...')
          needsEmailUpdate = true
        }
        else if (currentEmailDomain && currentEmailDomain !== configuredDomain) {
          log.info(`Email domain changed: ${currentEmailDomain} -> ${configuredDomain}, will update...`)
          needsEmailUpdate = true
        }
        else if (hasEmailBucket && (!hasOutboundLambda || !hasConversionLambda || !hasNotificationTopic)) {
          log.info('Email infrastructure incomplete, will update...')
          needsEmailUpdate = true
        }
        else if (hasEmailBucket && (!hasMailApiLambda || !hasMailUsersTable)) {
          log.info('Mail API infrastructure missing, will update...')
          needsEmailUpdate = true
        }
        else if (hasEmailBucket && !hasMailServerInstance && emailConfig?.server?.enabled) {
          log.info('Mail server EC2 instance missing, will update...')
          needsEmailUpdate = true
        }

        // Always update if mail server mode changed or instance needs replacement
        const currentMode = (stack.Outputs || []).find(
          (o: any) => o.OutputKey === 'MailServerMode'
        )?.OutputValue
        const configuredMode = emailConfig?.server?.mode || 'serverless'
        if (currentMode && currentMode !== configuredMode) {
          log.info(`Mail server mode changed: ${currentMode} -> ${configuredMode}, will update...`)
          needsEmailUpdate = true
        }

        // Force update if mail server instance is terminated
        if (hasMailServerInstance && emailConfig?.server?.enabled) {
          // Check if we need to force update due to terminated instance
          const forceMailUpdate = process.env.FORCE_MAIL_UPDATE === 'true'
          if (forceMailUpdate) {
            log.info('Forcing mail server update...')
            needsEmailUpdate = true
          }
        }

        if (!needsEmailUpdate) {
          return true
        }
      }
    }
    catch (error: unknown) {
      const caught = error && typeof error === 'object'
        ? error as { message?: string, code?: string }
        : { message: String(error) }
      log.debug(`Stack not found: ${getErrorMessage(error)}`)
      // Stack doesn't exist, we'll create it below
    }

    if (!stackExists) {
      log.info('Cloud stack not found, will be created by deploy action')
    }

    // Stack creation/update is handled by the deploy action's deployStack() function
    // which uses InfrastructureGenerator and handles large templates via S3 upload
    return true

    // Legacy template generation below - kept for reference but no longer used
    log.info('Creating/updating cloud infrastructure. This may take a few moments...')

    // Get email configuration
    const emailDomain = emailConfig?.from?.address?.split('@')?.[1] || 'stacksjs.com'
    const emailBucketName = `${appName}-emails`
    const region = process.env.AWS_REGION || 'us-east-1'
    const enableEmailServer = emailConfig?.server?.scan !== undefined

    log.info(`Email domain: ${emailDomain}`)
    log.info(`Email server enabled: ${enableEmailServer}`)

    // Get hosted zone ID from cloud config or use a lookup
    const hostedZoneId = (cloudConfig as any)?.tsCloud?.infrastructure?.dns?.hostedZoneId
      || (cloudConfig as any)?.infrastructure?.dns?.hostedZoneId
      || process.env.AWS_HOSTED_ZONE_ID
      || 'Z01455702Q7952O6RCY37' // Default for stacksjs.com

    // Create CloudFormation template for Stacks cloud infrastructure with email support
    const template: any = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `${appName} Cloud Infrastructure with Email Server`,
      Resources: {
        // Assets bucket
        StacksBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: `${appName}-${process.env.APP_ENV || 'production'}-assets`,
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: false,
              BlockPublicPolicy: false,
              IgnorePublicAcls: false,
              RestrictPublicBuckets: false,
            },
            WebsiteConfiguration: {
              IndexDocument: 'index.html',
              ErrorDocument: 'error.html',
            },
          },
        },
      },
      Outputs: {
        BucketName: {
          Description: 'Name of the S3 bucket',
          Value: { Ref: 'StacksBucket' },
          Export: {
            Name: `${appName}BucketName`,
          },
        },
        BucketWebsiteURL: {
          Description: 'URL of the S3 bucket website',
          Value: { 'Fn::GetAtt': ['StacksBucket', 'WebsiteURL'] },
        },
      },
    }

    // Add email infrastructure if email server is enabled
    if (enableEmailServer) {
      log.info('Adding email server infrastructure...')

      // Email storage bucket
      template.Resources.EmailBucket = {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: emailBucketName,
          LifecycleConfiguration: {
            Rules: [
              {
                Id: 'ArchiveOldEmails',
                Status: 'Enabled',
                Transitions: [
                  {
                    StorageClass: 'GLACIER',
                    TransitionInDays: 90,
                  },
                ],
              },
            ],
          },
          Tags: [
            { Key: 'Purpose', Value: 'EmailStorage' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // S3 bucket policy to allow SES to write emails
      template.Resources.EmailBucketPolicy = {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          Bucket: { Ref: 'EmailBucket' },
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'AllowSESPuts',
                Effect: 'Allow',
                Principal: {
                  Service: 'ses.amazonaws.com',
                },
                Action: 's3:PutObject',
                Resource: { 'Fn::Sub': 'arn:aws:s3:::${EmailBucket}/*' },
                Condition: {
                  StringEquals: {
                    'AWS:SourceAccount': { Ref: 'AWS::AccountId' },
                  },
                },
              },
            ],
          },
        },
      }

      // SES Domain Identity
      template.Resources.EmailIdentity = {
        Type: 'AWS::SES::EmailIdentity',
        Properties: {
          EmailIdentity: emailDomain,
          DkimSigningAttributes: {
            NextSigningKeyLength: 'RSA_2048_BIT',
          },
          FeedbackAttributes: {
            EmailForwardingEnabled: true,
          },
        },
      }

      // SES Configuration Set
      template.Resources.EmailConfigurationSet = {
        Type: 'AWS::SES::ConfigurationSet',
        Properties: {
          Name: `${appName}-email-config`,
          ReputationOptions: {
            ReputationMetricsEnabled: true,
          },
          SendingOptions: {
            SendingEnabled: true,
          },
          SuppressionOptions: {
            SuppressedReasons: ['BOUNCE', 'COMPLAINT'],
          },
        },
      }

      // IAM Role for Email Lambda functions
      template.Resources.EmailLambdaRole = {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: `${appName}-email-lambda-role`,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'lambda.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          ManagedPolicyArns: [
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
          Policies: [
            {
              PolicyName: 'EmailLambdaPolicy',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      's3:GetObject',
                      's3:PutObject',
                      's3:DeleteObject',
                      's3:ListBucket',
                    ],
                    Resource: [
                      { 'Fn::GetAtt': ['EmailBucket', 'Arn'] },
                      { 'Fn::Sub': '${EmailBucket.Arn}/*' },
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'ses:SendEmail',
                      'ses:SendRawEmail',
                    ],
                    Resource: '*',
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'dynamodb:GetItem',
                      'dynamodb:PutItem',
                      'dynamodb:UpdateItem',
                      'dynamodb:DeleteItem',
                      'dynamodb:Query',
                      'dynamodb:Scan',
                    ],
                    Resource: { 'Fn::Sub': `arn:aws:dynamodb:\${AWS::Region}:\${AWS::AccountId}:table/${appName}-mail-users` },
                  },
                ],
              },
            },
          ],
          Tags: [
            { Key: 'Purpose', Value: 'EmailProcessing' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Inbound Email Lambda Function
      template.Resources.InboundEmailLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-inbound-email`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 60,
          MemorySize: 512,
          Environment: {
            Variables: {
              S3_BUCKET: emailBucketName,
              ORGANIZED_PREFIX: 'organized/',
            },
          },
          Code: {
            ZipFile: `
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({});

exports.handler = async (event) => {
  console.log('Processing inbound email:', JSON.stringify(event));
  const bucket = process.env.S3_BUCKET;
  const organizedPrefix = process.env.ORGANIZED_PREFIX || 'organized/';

  for (const record of event.Records || []) {
    if (!record.ses) continue;
    const mail = record.ses.mail;
    const from = mail.commonHeaders?.from?.[0] || mail.source || 'unknown';
    const to = mail.commonHeaders?.to || mail.destination || [];
    const subject = mail.commonHeaders?.subject || 'No Subject';
    const date = mail.timestamp || new Date().toISOString();
    const dateFolder = date.slice(0, 10).replace(/-/g, '/');

    for (const recipient of to) {
      const recipientEmail = recipient.replace(/<|>/g, '').toLowerCase().trim();
      const organizedKey = organizedPrefix + 'by-recipient/' + recipientEmail + '/' + dateFolder + '/' + mail.messageId + '.json';
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: organizedKey,
        Body: JSON.stringify({ from, to: recipientEmail, subject, date, messageId: mail.messageId }, null, 2),
        ContentType: 'application/json'
      }));
    }
    console.log('Organized email from ' + from + ' to ' + to.join(', ') + ': ' + subject);
  }
  return { statusCode: 200, body: 'Emails organized successfully' };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'InboundEmail' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Lambda permission for SES to invoke
      template.Resources.InboundEmailLambdaPermission = {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: { Ref: 'InboundEmailLambda' },
          Action: 'lambda:InvokeFunction',
          Principal: 'ses.amazonaws.com',
          SourceAccount: { Ref: 'AWS::AccountId' },
        },
      }

      // SES Receipt Rule Set
      template.Resources.EmailReceiptRuleSet = {
        Type: 'AWS::SES::ReceiptRuleSet',
        Properties: {
          RuleSetName: `${appName}-email-rules`,
        },
      }

      // SES Receipt Rule for inbound emails
      template.Resources.EmailReceiptRule = {
        Type: 'AWS::SES::ReceiptRule',
        DependsOn: ['EmailReceiptRuleSet', 'InboundEmailLambda', 'EmailBucket', 'EmailBucketPolicy'],
        Properties: {
          RuleSetName: { Ref: 'EmailReceiptRuleSet' },
          Rule: {
            Name: `${appName}-inbound-rule`,
            Enabled: true,
            ScanEnabled: emailConfig?.server?.scan || true,
            Recipients: [emailDomain],
            Actions: [
              {
                S3Action: {
                  BucketName: { Ref: 'EmailBucket' },
                  ObjectKeyPrefix: 'inbound/',
                },
              },
              {
                LambdaAction: {
                  FunctionArn: { 'Fn::GetAtt': ['InboundEmailLambda', 'Arn'] },
                  InvocationType: 'Event',
                },
              },
            ],
          },
        },
      }

      // Outbound Email Lambda Function
      template.Resources.OutboundEmailLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-outbound-email`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 30,
          MemorySize: 256,
          Environment: {
            Variables: {
              DOMAIN: emailDomain,
              CONFIGURATION_SET: `${appName}-email-config`,
            },
          },
          Code: {
            ZipFile: `
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const ses = new SESClient({});

exports.handler = async (event) => {
  console.log('Processing outbound email:', JSON.stringify(event));
  const { to, from, subject, html, text, cc, bcc, replyTo, attachments = [] } = event;
  const domain = process.env.DOMAIN;
  const configSet = process.env.CONFIGURATION_SET;

  const boundary = 'NextPart_' + Date.now().toString(16);
  const fromAddress = from || 'noreply@' + domain;

  let rawEmail = '';
  rawEmail += 'From: ' + fromAddress + '\\r\\n';
  rawEmail += 'To: ' + (Array.isArray(to) ? to.join(', ') : to) + '\\r\\n';
  if (cc) rawEmail += 'Cc: ' + (Array.isArray(cc) ? cc.join(', ') : cc) + '\\r\\n';
  if (bcc) rawEmail += 'Bcc: ' + (Array.isArray(bcc) ? bcc.join(', ') : bcc) + '\\r\\n';
  if (replyTo) rawEmail += 'Reply-To: ' + replyTo + '\\r\\n';
  rawEmail += 'Subject: ' + subject + '\\r\\n';
  rawEmail += 'MIME-Version: 1.0\\r\\n';
  rawEmail += 'Content-Type: multipart/mixed; boundary="' + boundary + '"\\r\\n\\r\\n';

  rawEmail += '--' + boundary + '\\r\\n';
  rawEmail += 'Content-Type: multipart/alternative; boundary="alt_boundary"\\r\\n\\r\\n';

  if (text) {
    rawEmail += '--alt_boundary\\r\\n';
    rawEmail += 'Content-Type: text/plain; charset=UTF-8\\r\\n\\r\\n';
    rawEmail += text + '\\r\\n\\r\\n';
  }
  if (html) {
    rawEmail += '--alt_boundary\\r\\n';
    rawEmail += 'Content-Type: text/html; charset=UTF-8\\r\\n\\r\\n';
    rawEmail += html + '\\r\\n\\r\\n';
  }
  rawEmail += '--alt_boundary--\\r\\n';

  for (const att of attachments) {
    rawEmail += '--' + boundary + '\\r\\n';
    rawEmail += 'Content-Type: ' + (att.contentType || 'application/octet-stream') + '; name="' + att.filename + '"\\r\\n';
    rawEmail += 'Content-Transfer-Encoding: base64\\r\\n';
    rawEmail += 'Content-Disposition: attachment; filename="' + att.filename + '"\\r\\n\\r\\n';
    rawEmail += att.content + '\\r\\n';
  }
  rawEmail += '--' + boundary + '--\\r\\n';

  const params = {
    RawMessage: { Data: Buffer.from(rawEmail) },
    Source: fromAddress,
    Destinations: [...(Array.isArray(to) ? to : [to]), ...(cc ? (Array.isArray(cc) ? cc : [cc]) : []), ...(bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [])]
  };
  if (configSet) params.ConfigurationSetName = configSet;

  const result = await ses.send(new SendRawEmailCommand(params));
  return { statusCode: 200, body: JSON.stringify({ messageId: result.MessageId }) };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'OutboundEmail' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Email Conversion Lambda Function
      template.Resources.EmailConversionLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-email-conversion`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 60,
          MemorySize: 512,
          Environment: {
            Variables: {
              S3_BUCKET: emailBucketName,
              CONVERTED_PREFIX: 'converted/',
            },
          },
          Code: {
            ZipFile: `
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({});

exports.handler = async (event) => {
  console.log('Converting email:', JSON.stringify(event));
  const bucket = process.env.S3_BUCKET;
  const convertedPrefix = process.env.CONVERTED_PREFIX || 'converted/';

  for (const record of event.Records || []) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));
    if (!key.startsWith('inbound/')) continue;

    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getCmd);
    const rawEmail = await response.Body.transformToString();

    // Simple email parsing (headers + body)
    const [headerSection, ...bodyParts] = rawEmail.split('\\r\\n\\r\\n');
    const body = bodyParts.join('\\r\\n\\r\\n');
    const headers = {};
    for (const line of headerSection.split('\\r\\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const name = line.slice(0, colonIdx).toLowerCase();
        headers[name] = line.slice(colonIdx + 1).trim();
      }
    }

    const metadata = {
      from: headers.from || '',
      to: headers.to || '',
      subject: headers.subject || '',
      date: headers.date || new Date().toISOString(),
      contentType: headers['content-type'] || 'text/plain',
    };

    const baseName = key.replace('inbound/', '').replace(/\\.[^.]+$/, '');
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: convertedPrefix + baseName + '.json',
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json'
    }));

    if (body) {
      const isHtml = metadata.contentType.includes('html');
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: convertedPrefix + baseName + (isHtml ? '.html' : '.txt'),
        Body: body,
        ContentType: isHtml ? 'text/html' : 'text/plain'
      }));
    }
    console.log('Converted email:', key);
  }
  return { statusCode: 200, body: 'Emails converted' };
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'EmailConversion' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // S3 trigger for email conversion Lambda
      template.Resources.EmailConversionLambdaPermission = {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: { Ref: 'EmailConversionLambda' },
          Action: 'lambda:InvokeFunction',
          Principal: 's3.amazonaws.com',
          SourceArn: { 'Fn::GetAtt': ['EmailBucket', 'Arn'] },
          SourceAccount: { Ref: 'AWS::AccountId' },
        },
      }

      // SNS Topic for email notifications
      template.Resources.EmailNotificationTopic = {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: `${appName}-email-notifications`,
          DisplayName: `${appName} Email Notifications`,
          Tags: [
            { Key: 'Purpose', Value: 'EmailNotifications' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Mail API Lambda - provides REST API for email operations
      template.Resources.MailApiLambda = {
        Type: 'AWS::Lambda::Function',
        DependsOn: ['EmailLambdaRole'],
        Properties: {
          FunctionName: `${appName}-mail-api`,
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['EmailLambdaRole', 'Arn'] },
          Timeout: 30,
          MemorySize: 256,
          Environment: {
            Variables: {
              EMAIL_BUCKET: emailBucketName,
              USERS_TABLE: `${appName}-mail-users`,
              EMAIL_DOMAIN: emailDomain,
            },
          },
          Code: {
            ZipFile: `
const { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const s3 = new S3Client({});
const ses = new SESv2Client({});
const dynamodb = new DynamoDBClient({});

const BUCKET = process.env.EMAIL_BUCKET;
const USERS_TABLE = process.env.USERS_TABLE;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const response = (code, body) => ({ statusCode: code, headers: CORS, body: JSON.stringify(body) });

async function authenticate(email, password) {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: USERS_TABLE,
      Key: { email: { S: email.toLowerCase() } },
    }));
    if (!result.Item) return false;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return result.Item.passwordHash?.S === hash;
  } catch (e) { return false; }
}

async function getAuthUser(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization;
  if (!auth) return null;
  if (auth.startsWith('Basic ') || auth.startsWith('Bearer ')) {
    try {
      const authParts = auth.split(' ')
      if (!authParts[1]) return null;
      const creds = Buffer.from(authParts[1], 'base64').toString('utf-8');
      const colonIdx = creds.indexOf(':');
      if (colonIdx < 0) return null;
      const email = creds.slice(0, colonIdx);
      const password = creds.slice(colonIdx + 1);
      if (email && password && await authenticate(email, password)) return email;
    } catch (e) {
      log.debug('Operation failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  return null;
}

function parseHeaders(content) {
  const headers = {};
  const end = content.indexOf('\\r\\n\\r\\n');
  const section = end > 0 ? content.substring(0, end) : content.substring(0, 2000);
  for (const line of section.split('\\r\\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) headers[line.substring(0, idx).toLowerCase()] = line.substring(idx + 1).trim();
  }
  return headers;
}

async function listMessages(userEmail, mailbox = 'INBOX') {
  const prefix = mailbox === 'INBOX' ? 'incoming/' : mailbox.toLowerCase() + '/';
  const result = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  const messages = [];
  let uid = 1;
  for (const obj of result.Contents || []) {
    if (obj.Key.includes('AMAZON_SES_SETUP')) continue;
    try {
      const getResult = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      const content = await getResult.Body.transformToString();
      const headers = parseHeaders(content);
      const to = (headers.to || '').toLowerCase();
      if (to.includes(userEmail.toLowerCase()) || to.includes(userEmail.split('@')[0])) {
        messages.push({
          id: obj.Key.split('/').pop(),
          uid: uid++,
          from: headers.from || '',
          to: headers.to || '',
          subject: headers.subject || '(No Subject)',
          date: headers.date || obj.LastModified?.toISOString(),
          size: obj.Size,
          s3Key: obj.Key,
        });
      }
    } catch (e) {
      log.debug('Operation failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  return messages.sort((a, b) => new Date(b.date) - new Date(a.date));
}

exports.handler = async (event) => {
  // Support both API Gateway v1 (REST) and v2 (HTTP) event formats
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;

  if (method === 'OPTIONS') return response(200, {});

  // Auth endpoint
  if (path === '/auth' && method === 'POST') {
    let body: any;
    try { body = JSON.parse(event.body || '{}'); } catch { return response(400, { error: 'Invalid JSON body' }); }
    if (!body.email || !body.password) return response(400, { error: 'Email and password required' });
    const valid = await authenticate(body.email, body.password);
    if (!valid) return response(401, { error: 'Invalid credentials' });
    const token = Buffer.from(body.email + ':' + body.password).toString('base64');
    return response(200, { token, email: body.email });
  }

  const userEmail = await getAuthUser(event);
  if (!userEmail) return response(401, { error: 'Unauthorized' });

  try {
    // List mailboxes
    if (path === '/mailboxes' && method === 'GET') {
      const messages = await listMessages(userEmail);
      return response(200, { mailboxes: [
        { name: 'INBOX', messages: messages.length, unseen: messages.length },
        { name: 'Sent', messages: 0, unseen: 0 },
        { name: 'Drafts', messages: 0, unseen: 0 },
        { name: 'Trash', messages: 0, unseen: 0 },
      ]});
    }

    // List messages
    if (path === '/messages' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const messages = await listMessages(userEmail, params.mailbox || 'INBOX');
      return response(200, { messages, total: messages.length });
    }

    // Get message
    if (path.startsWith('/messages/') && method === 'GET') {
      const id = path.split('/').pop();
      const messages = await listMessages(userEmail);
      const msg = messages.find(m => m.id === id);
      if (!msg) return response(404, { error: 'Not found' });
      const getResult = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: msg.s3Key }));
      const content = await getResult.Body.transformToString();
      return response(200, { message: msg, content });
    }

    // Delete message
    if (path.startsWith('/messages/') && method === 'DELETE') {
      const id = path.split('/').pop();
      const messages = await listMessages(userEmail);
      const msg = messages.find(m => m.id === id);
      if (!msg) return response(404, { error: 'Not found' });
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: msg.s3Key }));
      return response(200, { success: true });
    }

    // Send message
    if (path === '/messages' && method === 'POST') {
      let body: any;
      try { body = JSON.parse(event.body || '{}'); } catch { return response(400, { error: 'Invalid JSON body' }); }
      if (!body.to || !body.subject) return response(400, { error: 'To and subject required' });
      const result = await ses.send(new SendEmailCommand({
        FromEmailAddress: userEmail,
        Destination: { ToAddresses: Array.isArray(body.to) ? body.to : [body.to] },
        Content: { Simple: { Subject: { Data: body.subject }, Body: { Text: { Data: body.text || '' } } } },
      }));
      return response(200, { messageId: result.MessageId });
    }

    return response(404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return response(500, { error: e.message });
  }
};
`,
          },
          Tags: [
            { Key: 'Purpose', Value: 'MailAPI' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // API Gateway for Mail API
      template.Resources.MailApiGateway = {
        Type: 'AWS::ApiGatewayV2::Api',
        Properties: {
          Name: `${appName}-mail-api`,
          ProtocolType: 'HTTP',
          CorsConfiguration: {
            AllowOrigins: ['*'],
            AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            AllowHeaders: ['Content-Type', 'Authorization'],
          },
        },
      }

      // API Gateway Integration
      template.Resources.MailApiIntegration = {
        Type: 'AWS::ApiGatewayV2::Integration',
        Properties: {
          ApiId: { Ref: 'MailApiGateway' },
          IntegrationType: 'AWS_PROXY',
          IntegrationUri: { 'Fn::GetAtt': ['MailApiLambda', 'Arn'] },
          PayloadFormatVersion: '2.0',
        },
      }

      // API Gateway Route - catch all
      template.Resources.MailApiRoute = {
        Type: 'AWS::ApiGatewayV2::Route',
        Properties: {
          ApiId: { Ref: 'MailApiGateway' },
          RouteKey: '$default',
          Target: { 'Fn::Join': ['/', ['integrations', { Ref: 'MailApiIntegration' }]] },
        },
      }

      // API Gateway Stage
      template.Resources.MailApiStage = {
        Type: 'AWS::ApiGatewayV2::Stage',
        Properties: {
          ApiId: { Ref: 'MailApiGateway' },
          StageName: '$default',
          AutoDeploy: true,
        },
      }

      // Lambda permission for API Gateway
      template.Resources.MailApiLambdaPermission = {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: { Ref: 'MailApiLambda' },
          Action: 'lambda:InvokeFunction',
          Principal: 'apigateway.amazonaws.com',
          SourceArn: { 'Fn::Sub': 'arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${MailApiGateway}/*' },
        },
      }

      // DynamoDB table for mail users
      template.Resources.MailUsersTable = {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: `${appName}-mail-users`,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' },
          ],
          Tags: [
            { Key: 'Purpose', Value: 'MailUsers' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // ========================================================================
      // Mail Server EC2 Instance (IMAP/SMTP)
      // ========================================================================

      // Get mail server config from email config
      const mailServerConfig = emailConfig?.server?.instance || {}
      const mailServerMode = emailConfig?.server?.mode || 'server'
      // For 'server' mode, use x86_64 instance (Zig compilation), for 'serverless' use ARM
      const instanceType = mailServerConfig.type || (mailServerMode === 'server' ? 't3.small' : 't4g.nano')
      const _useSpot = mailServerConfig.spot || false
      const diskSize = mailServerConfig.diskSize || (mailServerMode === 'server' ? 30 : 8)
      const mailSubdomain = emailConfig?.server?.subdomain || 'mail'
      // Port configuration
      const smtpPort = emailConfig?.server?.ports?.smtp || 25
      const smtpsPort = emailConfig?.server?.ports?.smtps || 465
      const submissionPort = emailConfig?.server?.ports?.submission || emailConfig?.server?.ports?.smtpStartTls || 587
      const imapPort = emailConfig?.server?.ports?.imap || 143
      const imapsPort = emailConfig?.server?.ports?.imaps || 993
      const pop3Port = emailConfig?.server?.ports?.pop3 || 110
      const pop3sPort = emailConfig?.server?.ports?.pop3s || 995

      log.info(`Mail server mode: ${mailServerMode}`)

      // Use existing VPC from the stacks-cloud stack (vpc-0d5b3d953b516a107)
      // This avoids hitting the VPC limit
      const existingVpcId = 'vpc-0d5b3d953b516a107'

      // Internet Gateway for the VPC (needed for public IP access)
      template.Resources.MailServerIGW = {
        Type: 'AWS::EC2::InternetGateway',
        Properties: {
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-igw` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Attach Internet Gateway to VPC
      template.Resources.MailServerIGWAttachment = {
        Type: 'AWS::EC2::VPCGatewayAttachment',
        Properties: {
          VpcId: existingVpcId,
          InternetGatewayId: { Ref: 'MailServerIGW' },
        },
      }

      // Route Table for the mail server subnet
      template.Resources.MailServerRouteTable = {
        Type: 'AWS::EC2::RouteTable',
        Properties: {
          VpcId: existingVpcId,
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-rt` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Route to Internet Gateway
      template.Resources.MailServerRoute = {
        Type: 'AWS::EC2::Route',
        DependsOn: ['MailServerIGWAttachment'],
        Properties: {
          RouteTableId: { Ref: 'MailServerRouteTable' },
          DestinationCidrBlock: '0.0.0.0/0',
          GatewayId: { Ref: 'MailServerIGW' },
        },
      }

      // Public Subnet for the mail server (in existing VPC)
      template.Resources.MailServerSubnet = {
        Type: 'AWS::EC2::Subnet',
        Properties: {
          VpcId: existingVpcId,
          CidrBlock: '10.0.100.0/24', // Use a different CIDR that doesn't conflict
          MapPublicIpOnLaunch: true,
          AvailabilityZone: { 'Fn::Select': ['0', { 'Fn::GetAZs': '' }] },
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-subnet` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Associate Route Table with Subnet
      template.Resources.MailServerSubnetRouteTableAssociation = {
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
        Properties: {
          SubnetId: { Ref: 'MailServerSubnet' },
          RouteTableId: { Ref: 'MailServerRouteTable' },
        },
      }

      // Security Group for Mail Server
      template.Resources.MailServerSecurityGroup = {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: `${appName} mail server security group for IMAP/SMTP`,
          VpcId: existingVpcId,
          SecurityGroupIngress: [
            // SMTP ports
            {
              IpProtocol: 'tcp',
              FromPort: smtpPort,
              ToPort: smtpPort,
              CidrIp: '0.0.0.0/0',
              Description: 'SMTP',
            },
            {
              IpProtocol: 'tcp',
              FromPort: smtpsPort,
              ToPort: smtpsPort,
              CidrIp: '0.0.0.0/0',
              Description: 'SMTP over TLS',
            },
            {
              IpProtocol: 'tcp',
              FromPort: submissionPort,
              ToPort: submissionPort,
              CidrIp: '0.0.0.0/0',
              Description: 'SMTP Submission (STARTTLS)',
            },
            // IMAP ports
            {
              IpProtocol: 'tcp',
              FromPort: imapPort,
              ToPort: imapPort,
              CidrIp: '0.0.0.0/0',
              Description: 'IMAP',
            },
            {
              IpProtocol: 'tcp',
              FromPort: imapsPort,
              ToPort: imapsPort,
              CidrIp: '0.0.0.0/0',
              Description: 'IMAP over TLS',
            },
            // POP3 ports (only for server mode)
            ...(mailServerMode === 'server' ? [
              {
                IpProtocol: 'tcp',
                FromPort: pop3Port,
                ToPort: pop3Port,
                CidrIp: '0.0.0.0/0',
                Description: 'POP3',
              },
              {
                IpProtocol: 'tcp',
                FromPort: pop3sPort,
                ToPort: pop3sPort,
                CidrIp: '0.0.0.0/0',
                Description: 'POP3 over TLS',
              },
            ] : []),
            // SSH and HTTP
            {
              IpProtocol: 'tcp',
              FromPort: 22,
              ToPort: 22,
              CidrIp: '0.0.0.0/0',
              Description: 'SSH access',
            },
            {
              IpProtocol: 'tcp',
              FromPort: 80,
              ToPort: 80,
              CidrIp: '0.0.0.0/0',
              Description: 'HTTP for LetsEncrypt certificate validation',
            },
            {
              IpProtocol: 'tcp',
              FromPort: 443,
              ToPort: 443,
              CidrIp: '0.0.0.0/0',
              Description: 'HTTPS for API/WebMail',
            },
          ],
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-server-sg` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // IAM Role for Mail Server EC2
      template.Resources.MailServerRole = {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: `${appName}-mail-server-role`,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: 'ec2.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          ManagedPolicyArns: [
            'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
          ],
          Policies: [
            {
              PolicyName: 'MailServerPolicy',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      's3:GetObject',
                      's3:PutObject',
                      's3:DeleteObject',
                      's3:ListBucket',
                    ],
                    Resource: [
                      { 'Fn::GetAtt': ['EmailBucket', 'Arn'] },
                      { 'Fn::Sub': '${EmailBucket.Arn}/*' },
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'ses:SendEmail',
                      'ses:SendRawEmail',
                    ],
                    Resource: '*',
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'dynamodb:GetItem',
                      'dynamodb:PutItem',
                      'dynamodb:UpdateItem',
                      'dynamodb:DeleteItem',
                      'dynamodb:Query',
                      'dynamodb:Scan',
                    ],
                    Resource: { 'Fn::GetAtt': ['MailUsersTable', 'Arn'] },
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'acm:GetCertificate',
                      'acm:DescribeCertificate',
                    ],
                    Resource: '*',
                  },
                  {
                    Effect: 'Allow',
                    Action: [
                      'secretsmanager:GetSecretValue',
                    ],
                    Resource: { 'Fn::Sub': `arn:aws:secretsmanager:\${AWS::Region}:\${AWS::AccountId}:secret:${appName}-mail-*` },
                  },
                ],
              },
            },
          ],
          Tags: [
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Instance Profile for Mail Server
      template.Resources.MailServerInstanceProfile = {
        Type: 'AWS::IAM::InstanceProfile',
        Properties: {
          InstanceProfileName: `${appName}-mail-server-profile`,
          Roles: [{ Ref: 'MailServerRole' }],
        },
      }

      // User data script to bootstrap the mail server
      // Supports both 'serverless' (Bun/TypeScript) and 'server' (Zig) modes
      const serverlessUserData = `#!/bin/bash
set -e
export HOME=/root
exec > >(tee /var/log/mail-server-setup.log) 2>&1
echo "Starting mail server setup (serverless mode) at $(date)"

# Configuration
export REGION="${region}"
export EMAIL_BUCKET="${emailBucketName}"
export USERS_TABLE="${appName}-mail-users"
export EMAIL_DOMAIN="${emailDomain}"
export IMAP_PORT=${imapsPort}
export SMTP_PORT=${smtpsPort}
export MAIL_SUBDOMAIN="${mailSubdomain}"

# Install dependencies
dnf update -y
dnf install -y nodejs npm git certbot awscli
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /root/.bashrc

mkdir -p /opt/mail-server && cd /opt/mail-server

# Download server code from S3
aws s3 cp s3://${emailBucketName}/mail-server/server.ts ./server.ts --region ${region} || echo "Server code not in S3 yet"
aws s3 cp s3://${emailBucketName}/mail-server/package.json ./package.json --region ${region} || cat > package.json << 'PKGJSON'
{"name":"mail-server","type":"module","dependencies":{"@aws-sdk/client-s3":"^3.0.0","@aws-sdk/client-sesv2":"^3.0.0","@aws-sdk/client-dynamodb":"^3.0.0"}}
PKGJSON

# If server.ts doesn't exist, create minimal placeholder
if [ ! -f server.ts ]; then
cat > server.ts << 'SERVERCODE'
import*as net from'net';const IP=+(process.env.IMAP_PORT||993),SP=+(process.env.SMTP_PORT||465);
console.log('Placeholder server starting...');
net.createServer(s=>{s.write('* OK IMAP ready\\r\\n');s.on('data',()=>s.write('* BAD Placeholder\\r\\n'));}).listen(IP);
net.createServer(s=>{s.write('220 SMTP ready\\r\\n');s.on('data',()=>s.write('421 Placeholder\\r\\n'));}).listen(SP);
SERVERCODE
fi

/root/.bun/bin/bun install

# Create environment file
cat > /opt/mail-server/.env << EOF
REGION=${region}
EMAIL_BUCKET=${emailBucketName}
USERS_TABLE=${appName}-mail-users
EMAIL_DOMAIN=${emailDomain}
IMAP_PORT=${imapsPort}
SMTP_PORT=${smtpsPort}
MAIL_SUBDOMAIN=${mailSubdomain}
EOF

# Create systemd service
cat > /etc/systemd/system/mail-server.service << 'SYSTEMD'
[Unit]
Description=Stacks Mail Server (Serverless)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mail-server
EnvironmentFile=/opt/mail-server/.env
ExecStart=/root/.bun/bin/bun run server.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD

# Get TLS certificate
certbot certonly --standalone -d ${mailSubdomain}.${emailDomain} --non-interactive --agree-tos --email admin@${emailDomain} || true

systemctl daemon-reload
systemctl enable mail-server
systemctl start mail-server

echo "Mail server setup complete at $(date)"
`

      // Zig mail server user data (full-featured server mode)
      const serverUserData = `#!/bin/bash
set -e
export HOME=/root
exec > >(tee /var/log/mail-server-setup.log) 2>&1
echo "Starting mail server setup (server mode - Zig) at $(date)"

# Update system
dnf update -y
dnf install -y git wget curl htop vim openssl sqlite certbot awscli python3 python3-pip fail2ban

# Install Zig (0.15.1 - matches build.zig.zon requirement)
echo "Installing Zig..."
ZIG_VERSION="0.15.1"
cd /tmp
wget https://ziglang.org/download/\${ZIG_VERSION}/zig-linux-x86_64-\${ZIG_VERSION}.tar.xz
tar -xf zig-linux-x86_64-\${ZIG_VERSION}.tar.xz
mv zig-linux-x86_64-\${ZIG_VERSION} /usr/local/zig
ln -sf /usr/local/zig/zig /usr/local/bin/zig
zig version

# Create smtp-server user
useradd -r -s /bin/bash -d /opt/smtp-server -m smtp-server || true

# Set up SMTP server directory
mkdir -p /opt/smtp-server && cd /opt/smtp-server

# Try to download pre-built Linux binary from S3 first
aws s3 cp s3://${emailBucketName}/mail-server/smtp-server ./smtp-server --region ${region} && chmod +x ./smtp-server && {
  # Verify it's actually a Linux ELF binary
  file ./smtp-server | grep -q "ELF" || {
    echo "Downloaded binary is not a Linux ELF binary, building from source..."
    rm -f ./smtp-server
    false
  }
} || {
  echo "Pre-built binary not found or invalid, building from source..."
  # Download source from S3 or clone from GitHub
  aws s3 cp s3://${emailBucketName}/mail-server/source.tar.gz ./source.tar.gz --region ${region} && tar -xzf source.tar.gz || {
    git clone https://github.com/stacksjs/mail.git .
  }
  chown -R smtp-server:smtp-server /opt/smtp-server
  zig build -Doptimize=ReleaseFast
  cp zig-out/bin/smtp-server ./smtp-server
}

# Create directories
mkdir -p /var/lib/smtp-server /var/log/smtp-server /var/spool/mail /etc/smtp-server /var/lib/smtp-server/backups
chown -R smtp-server:smtp-server /var/lib/smtp-server /var/log/smtp-server /var/spool/mail

# Generate TLS certificates via Let's Encrypt (preferred) or self-signed fallback
certbot certonly --standalone -d ${mailSubdomain}.${emailDomain} --non-interactive --agree-tos --email admin@${emailDomain} || {
  echo "Let's Encrypt failed, generating self-signed certificates..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout /etc/smtp-server/smtp-server.key \\
    -out /etc/smtp-server/smtp-server.crt \\
    -subj "/C=US/ST=State/L=City/O=Organization/CN=${mailSubdomain}.${emailDomain}"
}

# Link Let's Encrypt certs if available
if [ -d "/etc/letsencrypt/live/${mailSubdomain}.${emailDomain}" ]; then
  ln -sf /etc/letsencrypt/live/${mailSubdomain}.${emailDomain}/fullchain.pem /etc/smtp-server/smtp-server.crt
  ln -sf /etc/letsencrypt/live/${mailSubdomain}.${emailDomain}/privkey.pem /etc/smtp-server/smtp-server.key
fi

chmod 600 /etc/smtp-server/smtp-server.key 2>/dev/null || true
chown smtp-server:smtp-server /etc/smtp-server/smtp-server.* 2>/dev/null || true

# Set up certbot auto-renewal cron
cat > /etc/cron.d/certbot-renew << 'CRON'
0 3 * * * root certbot renew --quiet --deploy-hook "systemctl restart smtp-server" >> /var/log/certbot-renew.log 2>&1
CRON
chmod 644 /etc/cron.d/certbot-renew

# Create environment configuration
cat > /etc/smtp-server/smtp-server.env << EOF
# SMTP Server Configuration
SMTP_PROFILE=production
SMTP_HOST=0.0.0.0
SMTP_PORT=${smtpPort}
SMTP_HOSTNAME=${mailSubdomain}.${emailDomain}

# TLS Configuration
SMTP_ENABLE_TLS=true
SMTP_TLS_CERT=/etc/smtp-server/smtp-server.crt
SMTP_TLS_KEY=/etc/smtp-server/smtp-server.key

# Authentication
SMTP_ENABLE_AUTH=true
SMTP_DB_PATH=/var/lib/smtp-server/smtp.db

# AWS Integration
AWS_S3_BUCKET=${emailBucketName}
AWS_REGION=${region}
SMTP_USERS_TABLE=${appName}-mail-users

# Logging
SMTP_ENABLE_JSON_LOGGING=true
SMTP_LOG_LEVEL=info

# Paths
SMTP_MAILBOX_PATH=/var/spool/mail
SMTP_BACKUP_PATH=/var/lib/smtp-server/backups

# Limits
SMTP_MAX_CONNECTIONS=1000
SMTP_MAX_MESSAGE_SIZE=52428800
SMTP_MAX_RECIPIENTS=100
SMTP_RATE_LIMIT_PER_IP=100
SMTP_RATE_LIMIT_PER_USER=200
EOF

chmod 600 /etc/smtp-server/smtp-server.env
chown smtp-server:smtp-server /etc/smtp-server/smtp-server.env

# Create systemd service
cat > /etc/systemd/system/smtp-server.service << 'SYSTEMD'
[Unit]
Description=Stacks Mail Server (Zig)
After=network.target

[Service]
Type=simple
User=smtp-server
Group=smtp-server
WorkingDirectory=/opt/smtp-server
EnvironmentFile=/etc/smtp-server/smtp-server.env
ExecStart=/opt/smtp-server/smtp-server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smtp-server

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/smtp-server /var/log/smtp-server /var/spool/mail /etc/smtp-server

# Allow binding to privileged ports
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
SYSTEMD

# Configure fail2ban for SMTP
systemctl enable fail2ban
systemctl start fail2ban

# Enable and start SMTP server
systemctl daemon-reload
systemctl enable smtp-server
systemctl start smtp-server

# Wait and verify the server is running
sleep 5
systemctl status smtp-server || true

# Health check - verify ports are listening
echo "Checking listening ports..."
ss -tlnp | grep -E "(${smtpPort}|${smtpsPort}|${submissionPort})" || echo "Warning: mail ports not yet listening"

echo "Mail server setup complete at $(date)"
`

      const userDataScript = mailServerMode === 'server' ? serverUserData : serverlessUserData

      // Mail Server EC2 Instance
      // Use ARM64 for serverless (t4g instances), x86_64 for server mode (t3 instances for Zig)
      const amiArch = mailServerMode === 'server' ? 'x86_64' : 'arm64'
      // Use versioned resource name to force replacement when config changes
      const instanceResourceName = `MailServerInstance${mailServerMode === 'server' ? 'Zig' : 'Bun'}`
      template.Resources[instanceResourceName] = {
        Type: 'AWS::EC2::Instance',
        DependsOn: ['MailServerInstanceProfile', 'MailServerSecurityGroup', 'MailUsersTable', 'MailServerSubnetRouteTableAssociation'],
        Properties: {
          InstanceType: instanceType,
          ImageId: { 'Fn::Sub': `{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-${amiArch}}}` },
          IamInstanceProfile: { Ref: 'MailServerInstanceProfile' },
          SubnetId: { Ref: 'MailServerSubnet' },
          SecurityGroupIds: [{ 'Fn::GetAtt': ['MailServerSecurityGroup', 'GroupId'] }],
          BlockDeviceMappings: [
            {
              DeviceName: '/dev/xvda',
              Ebs: {
                VolumeSize: diskSize,
                VolumeType: 'gp3',
                Encrypted: true,
              },
            },
          ],
          UserData: { 'Fn::Base64': userDataScript },
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-server` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
            { Key: 'ServerMode', Value: mailServerMode },
            { Key: 'DeployedAt', Value: new Date().toISOString() },
          ],
        },
      }

      // Elastic IP for Mail Server (stable IP for DNS)
      template.Resources.MailServerEIP = {
        Type: 'AWS::EC2::EIP',
        Properties: {
          Domain: 'vpc',
          Tags: [
            { Key: 'Name', Value: `${appName}-mail-server-eip` },
            { Key: 'Purpose', Value: 'MailServer' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        },
      }

      // Associate EIP with Mail Server
      template.Resources.MailServerEIPAssociation = {
        Type: 'AWS::EC2::EIPAssociation',
        Properties: {
          InstanceId: { Ref: instanceResourceName },
          EIP: { Ref: 'MailServerEIP' },
        },
      }

      // Route53 record for mail server
      template.Resources.MailServerDnsRecord = {
        Type: 'AWS::Route53::RecordSet',
        DependsOn: ['MailServerEIP'],
        Properties: {
          HostedZoneId: hostedZoneId,
          Name: `${mailSubdomain}.${emailDomain}`,
          Type: 'A',
          TTL: '300',
          ResourceRecords: [{ Ref: 'MailServerEIP' }],
        },
      }

      // Add email outputs
      template.Outputs.EmailBucketName = {
        Description: 'Name of the email storage bucket',
        Value: { Ref: 'EmailBucket' },
      }
      template.Outputs.EmailDomain = {
        Description: 'Email domain configured',
        Value: emailDomain,
      }
      template.Outputs.EmailRuleSetName = {
        Description: 'SES Receipt Rule Set name',
        Value: { Ref: 'EmailReceiptRuleSet' },
      }
      template.Outputs.OutboundEmailLambdaArn = {
        Description: 'Outbound email Lambda ARN',
        Value: { 'Fn::GetAtt': ['OutboundEmailLambda', 'Arn'] },
      }
      template.Outputs.EmailNotificationTopicArn = {
        Description: 'Email notification SNS topic ARN',
        Value: { Ref: 'EmailNotificationTopic' },
      }
      template.Outputs.MailApiUrl = {
        Description: 'Mail API URL for IMAP proxy',
        Value: { 'Fn::GetAtt': ['MailApiGateway', 'ApiEndpoint'] },
      }
      template.Outputs.MailUsersTable = {
        Description: 'DynamoDB table for mail users',
        Value: { Ref: 'MailUsersTable' },
      }
      template.Outputs.MailServerIP = {
        Description: 'Mail server public IP address',
        Value: { Ref: 'MailServerEIP' },
      }
      template.Outputs.MailServerHostname = {
        Description: 'Mail server hostname for IMAP/SMTP',
        Value: `${emailConfig?.server?.subdomain || 'mail'}.${emailDomain}`,
      }
      template.Outputs.MailServerInstanceId = {
        Description: 'Mail server EC2 instance ID',
        Value: { Ref: instanceResourceName },
      }
      template.Outputs.MailServerMode = {
        Description: 'Mail server mode (serverless or server)',
        Value: mailServerMode,
      }

      log.success(`Email infrastructure added to template (mode: ${mailServerMode})`)

      // Upload mail server code/binary to S3 (if bucket exists)
      await uploadMailServerToS3(emailBucketName, region, mailServerMode)
    }

    try {
      if (stackExists && needsEmailUpdate) {
        // Update existing stack with email infrastructure
        log.info('Updating stack with email infrastructure...')
        const stackId = await cfnClient.updateStack({
          stackName,
          templateBody: JSON.stringify(template),
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          tags: [
            { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        })

        log.info(`Stack update initiated: ${stackId}`)
        log.info('Waiting for stack update to complete...')

        // Wait for stack update to complete
        await cfnClient.waitForStack(stackName, 'stack-update-complete')

        log.success('Cloud infrastructure updated with email server!')

        // Set up email DNS records after stack update
        if (enableEmailServer) {
          const serverMode = emailConfig?.server?.mode || 'server'
          const mailSubdomain = emailConfig?.server?.subdomain || 'mail'
          await setupEmailDnsRecords(emailDomain, region, log, { mode: serverMode, mailSubdomain })

          // Create default mail user if configured
          await createDefaultMailUser(appName, emailDomain, region, log)

          // Upload mail server code/binary to S3 now that bucket exists
          await uploadMailServerToS3(emailBucketName, region, serverMode)
        }

        return true
      }
      else {
        // Create new stack
        const stackId = await cfnClient.createStack({
          stackName,
          templateBody: JSON.stringify(template),
          capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          tags: [
            { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
            { Key: 'ManagedBy', Value: 'Stacks' },
          ],
        })

        log.info(`Stack creation initiated: ${stackId}`)
        log.info('Waiting for stack creation to complete...')

        // Wait for stack creation to complete
        await cfnClient.waitForStack(stackName, 'stack-create-complete')

        log.success('Cloud infrastructure created successfully')

        // Set up email DNS records after stack creation
        if (enableEmailServer) {
          const serverMode = emailConfig?.server?.mode || 'server'
          const mailSubdomain = emailConfig?.server?.subdomain || 'mail'
          await setupEmailDnsRecords(emailDomain, region, log, { mode: serverMode, mailSubdomain })

          // Upload mail server code/binary to S3 now that bucket exists
          await uploadMailServerToS3(emailBucketName, region, serverMode)
        }

        return true
      }
    }
    catch (error: unknown) {
      const caught = error && typeof error === 'object'
        ? error as { message?: string, code?: string }
        : { message: String(error) }
      // Handle case where stack already exists (shouldn't happen now with our check)
      if (getErrorCode(error) === 'AlreadyExistsException') {
        handlingAlreadyExists = true
        console.log('')
        log.error(`A cloud stack named "${stackName}" already exists`)
        log.info('This stack may be from a previous incomplete deployment.')
        console.log('')
        log.info('To resolve this, run one of the following commands:')
        console.log('')
        log.info('  buddy cloud:cleanup           # Clean up all cloud resources')
        log.info('  buddy cloud:remove            # Remove the entire cloud stack')
        console.log('')
        log.info('Or manually delete it in the AWS Console:')
        log.info('  https://console.aws.amazon.com/cloudformation')
        console.log('')
        process.exit(ExitCode.FatalError)
      }

      // Handle no updates needed
      if (caught.message?.includes('No updates are to be performed')) {
        log.success('Stack is already up to date')
        return true
      }

      // Handle other errors
      log.error('Failed to create/update cloud infrastructure')
      log.error(`Error: ${caught.message || String(error)}`)

      if (caught.code) {
        log.error(`AWS Error Code: ${caught.code}`)
      }

      if (options?.verbose) {
        console.error(error)
      }

      process.exit(ExitCode.FatalError)
    }
  }
  catch (err: unknown) {
    // Don't log error details if we're already handling AlreadyExistsException
    if (!handlingAlreadyExists) {
      log.error('Error checking cloud infrastructure')
      log.error(`Error: ${getErrorMessage(err)}`)
      if (options?.verbose) {
        console.error(err)
      }
    }
    process.exit(ExitCode.FatalError)
  }
}
