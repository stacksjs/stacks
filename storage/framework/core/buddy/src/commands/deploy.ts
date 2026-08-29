import type { CLI, DeploymentPreview, DeploymentSiteKind, DeployOptions } from '@stacksjs/types'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runAction } from '@stacksjs/actions'
import { italic, onUnknownSubcommand, outro, prompts } from "@stacksjs/cli"
import { app, dns as dnsConfig, email as emailConfig, cloud as cloudConfig } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud, syncDnsConfig } from '@stacksjs/dns'
import { loadProjectDnsConfig } from '../config'
import { env } from '@stacksjs/env'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { getErrorCode, getErrorMessage } from '@stacksjs/utils'
import { withDeployNotification } from '../deploy-notify'
import { ensureAppKey, ensureDeployEnvIsSet, ensureEnvIsSet } from './setup'
import { resultFailed } from '../result'
import { findUnbackedManagedServices, unbackedDataMessage } from '../unbacked-data'
import { applyDeploymentDomainOverride, createDeploymentPreview, deploymentPreviewJsonPrefix, formatDeploymentPreview, resolveDeploymentEnvironment } from './deploy-preview'

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

export interface DeployRollbackOptions {
  env?: string
  to?: string
  dryRun?: boolean
  verbose?: boolean
}

export function resolveTsCloudCliPath(tsCloudEntry = import.meta.resolve('@stacksjs/ts-cloud')): string {
  return resolve(dirname(new URL(tsCloudEntry).pathname), 'bin/cli.js')
}

export async function runDeployRollback(
  site: string | undefined,
  options: DeployRollbackOptions,
  execute: (command: string[]) => Promise<number> = async (command) => {
    const child = Bun.spawn(command, {
      cwd: p.projectPath(),
      env: process.env,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })

    return await child.exited
  },
): Promise<number> {
  const environment = resolveDeploymentEnvironment({ option: options.env })
  const command = [process.execPath, resolveTsCloudCliPath(), 'deploy:rollback']

  if (site) command.push(site)
  command.push('--env', environment)
  if (options.to) command.push('--to', options.to)
  if (options.dryRun) command.push('--dry-run')
  if (options.verbose) command.push('--verbose')

  return await execute(command)
}

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

async function ensureDeployPrerequisites(verbose = false, environment = 'production'): Promise<void> {
  const cwd = p.projectPath()

  await ensureEnvIsSet({ cwd, verbose })
  await ensureDeployEnvIsSet(cwd, environment)
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
        // Narrowed to a binding the compiler can follow. `mb` used to be
        // `mailbox`, so every `typeof mailbox === 'object'` guard beside
        // it proved nothing about the reads that followed - the guards are
        // right, they just could not reach through the alias.
        const mb = typeof mailbox === 'object' && mailbox !== null ? mailbox : null
        // `mb.email`, which is the only address field MailboxConfig has. This
        // read `mb.name || mb.address`, neither of which exists on it, so a
        // mailbox configured as an OBJECT rather than a bare string produced
        // the literal address `undefined@<domain>`. Both reads were behind
        // `mailbox`, so nothing said so.
        //
        // The field is documented as a full address; a bare local part is
        // still accepted and given the deploy's domain.
        const configured = mb?.email
        const email = mb
          ? (configured?.includes('@') ? configured : `${configured ?? ''}@${emailDomain}`)
          : `${mailbox}@${emailDomain}`
        const password = mb?.password
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
              displayName: { S: mb ? mb.displayName || email : String(mailbox) },
            },
          })

          logger.success(`Created mail user: ${email}`)
          if (!mb?.password) {
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
export async function loadTsCloudConfig(envName?: string): Promise<TsCloudConfig | undefined> {
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
 * Why the last attempt failed, as one line fit for an error message.
 *
 * `sshExecOrThrow` already puts the remote stderr in its message
 * (``ssh `true` on 1.2.3.4 failed (255): Permission denied (publickey).``), so
 * the diagnosis exists on every attempt and only needs carrying out of the loop.
 * Newlines are collapsed because ssh spreads one refusal over several lines, and
 * the result is capped so a chatty banner cannot bury the summary above it.
 */
export function pollFailureDetail(error: unknown): string | undefined {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed)
    return undefined
  return collapsed.length > 300 ? `${collapsed.slice(0, 297)}...` : collapsed
}

/**
 * What to print when SSH never came up.
 *
 * The old text named one cause for a condition with several: "The box may still
 * be booting - raise TS_CLOUD_SSH_WAIT_SECS and retry." A rejected key and a
 * fail2ban ban produce exactly that line, and waiting longer fixes neither, which
 * is how a one-line answer turns into a multi-hour misdiagnosis
 * (stacksjs/stacks#2342).
 *
 * So it leads with what the last attempt actually said and then maps the three
 * causes that look identical from here onto their different fixes, instead of
 * asserting the one that happens to be most common.
 */
export function sshUnreachableMessage(opts: {
  ip: string
  waitSecs: number
  elapsedSecs: number
  lastError?: unknown
}): string {
  const detail = pollFailureDetail(opts.lastError)
  return `SSH did not become reachable on ${opts.ip} within ${fmtDuration(opts.waitSecs)} (waited ${opts.elapsedSecs}s).`
    + (detail ? `\nLast attempt: ${detail}` : '')
    + `\nA connection timeout means the box is probably still booting, so raise TS_CLOUD_SSH_WAIT_SECS and retry. `
    + `"Permission denied" means the key is not authorized, and a refused or reset connection (especially after earlier attempts got further) `
    + `usually means fail2ban banned this IP. Waiting longer fixes neither.`
}

/** What to print when cloud-init never put bun on the box. */
export function bunRuntimeMissingMessage(opts: {
  waitSecs: number
  elapsedSecs: number
  lastError?: unknown
}): string {
  const detail = pollFailureDetail(opts.lastError)
  return `bun runtime did not appear at /usr/local/bin/bun within ${fmtDuration(opts.waitSecs)} (waited ${opts.elapsedSecs}s).`
    + (detail ? `\nLast attempt: ${detail}` : '')
    + `\ncloud-init may have failed: SSH in and check /var/log/cloud-init-output.log. `
    + `Raise TS_CLOUD_BOOT_WAIT_SECS for slow regions.`
}

/**
 * Poll `check()` (awaited each attempt, so it may be sync or async) until it
 * stops throwing or the timeout elapses, emitting a heartbeat every ~30s so a
 * multi-minute wait never looks frozen (and, when backgrounded, so the caller
 * can see it is still alive).
 *
 * The last error is kept and handed to `timeoutMessage`. Discarding it is what
 * made every reachability failure read as the same "the box may still be booting"
 * guess: a rejected key and a fail2ban ban produced that identical line, and the
 * advice it gave (wait longer) is useless for both.
 */
export async function pollUntil(opts: {
  label: string
  timeoutSecs: number
  intervalMs?: number
  check: () => unknown | Promise<unknown>
  timeoutMessage: (elapsedSecs: number, lastError: unknown) => string
}): Promise<void> {
  log.info(`${opts.label} (up to ${fmtDuration(opts.timeoutSecs)})...`)
  const started = Date.now()
  const deadline = started + opts.timeoutSecs * 1000
  let lastHeartbeat = 0
  let lastError: unknown
  for (;;) {
    try {
      await opts.check()
      return
    }
    catch (err) {
      lastError = err
      const elapsedSecs = Math.floor((Date.now() - started) / 1000)
      if (Date.now() > deadline)
        throw new Error(opts.timeoutMessage(elapsedSecs, lastError))
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
async function waitForRemoteReady(ip: string): Promise<void> {
  const { sshExecOrThrow } = await import('@stacksjs/ts-cloud')

  // Delegate the SSH exec to ts-cloud's helper. It disables host-key checking
  // (StrictHostKeyChecking=no, UserKnownHostsFile=/dev/null), the same args the
  // real deploy uses. That also covers the recycled-IP case: cloud providers
  // reuse an IP whose OLD host key still sits in ~/.ssh/known_hosts, and a
  // changed key would otherwise fail verification and wrongly report "SSH not
  // reachable". ConnectTimeout=10 matches the previous inline check.
  const run = (remote: string): Promise<string> =>
    sshExecOrThrow(ip, remote, { user: 'root', connectTimeoutSec: 10 })

  // 1) Wait for SSH to accept connections (server may still be booting).
  const sshWaitSecs = readWaitSecs('TS_CLOUD_SSH_WAIT_SECS', 8 * 60)
  await pollUntil({
    label: 'Waiting for SSH to come up',
    timeoutSecs: sshWaitSecs,
    check: () => run('true'),
    timeoutMessage: (elapsed, lastError) =>
      sshUnreachableMessage({ ip, waitSecs: sshWaitSecs, elapsedSecs: elapsed, lastError }),
  })
  log.success('SSH is up')

  // 2) Block on cloud-init, then confirm bun landed on PATH.
  log.info('Waiting for cloud-init (installing bun + caddy)...')
  try {
    await run('cloud-init status --wait || true')
  }
  catch (err) {
    log.debug('cloud-init status --wait returned non-zero (continuing):', err)
  }

  const bootWaitSecs = readWaitSecs('TS_CLOUD_BOOT_WAIT_SECS', 12 * 60)
  await pollUntil({
    label: 'Waiting for the bun runtime',
    timeoutSecs: bootWaitSecs,
    check: () => run('test -x /usr/local/bin/bun'),
    timeoutMessage: (elapsed, lastError) =>
      bunRuntimeMissingMessage({ waitSecs: bootWaitSecs, elapsedSecs: elapsed, lastError }),
  })
  log.success('Server is ready (bun installed)')
}

/**
 * The projects attached to this box, from `cloud.tenants` in `config/cloud.ts`.
 *
 * Each deploys from its own repository with its own env file, so none of their
 * values belong in this project's. This list is what makes a `TENANT_` prefix
 * meaningful — with nothing declared, nothing is ever treated as foreign,
 * because `STRIPE_` and `AWS_` are indistinguishable from a slug prefix.
 */
async function resolveDeclaredTenants(): Promise<string[]> {
  try {
    const { config } = await import('@stacksjs/config')
    const tenants = (config as { cloud?: { tenants?: unknown } }).cloud?.tenants
    return Array.isArray(tenants) ? tenants.filter((slug): slug is string => typeof slug === 'string') : []
  }
  catch {
    // A cloud config that will not load is the deploy's problem to report, not
    // this helper's — fall back to shipping everything, as before.
    return []
  }
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
 * Keys namespaced to another tenant on this box (`cloud.tenants` in
 * `config/cloud.ts`) are dropped here, before anything is shipped. Those
 * projects deploy from their own repositories with their own env files and
 * never need the owner's copy — and because ts-cloud treats `site.env` as the
 * complete `.env`, leaving them in writes one tenant's secrets into an
 * unrelated site's `.env` on disk.
 *
 * Returns `{}` (not an error) when the file doesn't exist or fails to
 * parse — an app with no `.env.production` yet shouldn't block deploying
 * with whatever `site.env` overrides it does have.
 *
 * @param environment - Which `.env.<environment>` to read.
 * @param tsCloudConfig - The deploy target's ts-cloud config, read for `project.slug`.
 */
/** Trim, lowercase and drop the empties from a list of hostnames. */
export function normalizeDomains(domains: readonly unknown[]): string[] {
  return domains
    .map(domain => String(domain ?? '').trim().toLowerCase())
    .filter(Boolean)
}

/**
 * The domains an existing gateway fragment serves that this project has not
 * accounted for - neither declared as a site nor listed as retired.
 *
 * Pure, because the interesting part is the decision and the rest of
 * `assertFragmentIsOurs` is an ssh call. `www.` is matched loosely in both
 * directions: the gateway adds a `www` route for an apex on its own, so a
 * project that declares (or retires) `example.com` has accounted for
 * `www.example.com` too.
 *
 * @param fragment - Raw contents of `/etc/rpx/sites.d/<slug>.json`.
 * @param ours - Domains this project declares as sites.
 * @param retired - Domains this project used to serve and deliberately no longer does.
 */
export function orphanedFragmentDomains(
  fragment: string,
  ours: Iterable<string>,
  retired: Iterable<string> = [],
): string[] {
  const declared = new Set(normalizeDomains([...ours]))
  const givenUp = new Set(normalizeDomains([...retired]))
  const accountedFor = (domain: string, set: Set<string>): boolean =>
    set.has(domain) || set.has(domain.replace(/^www\./, ''))

  const existing = new Set(
    [...fragment.matchAll(/"(?:domain|to|from)"\s*:\s*"([a-z0-9.*-]+\.[a-z]{2,})"/gi)]
      .map(match => String(match[1]).toLowerCase())
      .filter(Boolean),
  )

  return [...existing].filter(domain => !accountedFor(domain, declared) && !accountedFor(domain, givenUp))
}

/**
 * Refuse to overwrite a gateway fragment that is serving somebody else.
 *
 * `/etc/rpx/sites.d/<slug>.json` is replaced wholesale by a tenant deploy. If
 * the copy already on the box declares domains this project does not, then the
 * slug belongs to a different project and writing ours deletes their routes.
 *
 * Best-effort on the read (an unreachable box or an absent fragment is the
 * normal first-deploy case and must not block it) but hard on the answer: a
 * fragment that clearly belongs to someone else stops the deploy.
 *
 * `cloud.retiredDomains` is how a project says "this host WAS ours and
 * deliberately is not any more". Without it the guard has no false branch:
 * declaring the domain keeps serving it and not declaring it is refused, so
 * retiring a hostname is unexpressible and the only ways through are a hand
 * edit of the fragment on the box or renaming the slug - which strands the old
 * fragment still serving a dead release. It is config rather than a flag so
 * the decision stays in git, next to the sites it used to sit among.
 */
export async function assertFragmentIsOurs(
  ip: string,
  tsCloudConfig: any,
  log: { error: (m: string) => void, info: (m: string) => void },
): Promise<void> {
  const slug = tsCloudConfig.project?.slug || 'app'
  const ours = new Set(
    Object.values((tsCloudConfig.sites ?? {}) as Record<string, { domain?: string }>)
      .map(site => String(site?.domain ?? '').toLowerCase())
      .filter(Boolean),
  )

  let remote = ''
  try {
    const { execSync } = await import('node:child_process')
    const args = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', `root@${ip}`]
    remote = execSync(`ssh ${args.map(a => `'${a}'`).join(' ')} bash -s`, {
      input: `cat /etc/rpx/sites.d/${slug}.json 2>/dev/null || true`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }
  catch {
    // No fragment, no box access, no ssh — all fine. The deploy itself will
    // fail later on anything that actually matters.
    return
  }

  if (!remote.trim())
    return

  const retired = normalizeDomains(
    Array.isArray(tsCloudConfig.cloud?.retiredDomains) ? tsCloudConfig.cloud.retiredDomains : [],
  )
  const orphaned = orphanedFragmentDomains(remote, ours, retired)

  if (orphaned.length === 0) {
    if (retired.length > 0)
      log.info(`Retiring ${retired.length} domain(s) this project no longer serves: ${retired.join(', ')}`)

    return
  }

  log.error(`/etc/rpx/sites.d/${slug}.json on the box already serves ${orphaned.length} domain(s) this project does not declare:`)
  for (const domain of orphaned.slice(0, 8))
    log.error(`  ${domain}`)
  log.error(`Deploying would replace that fragment and take those domains down.`)
  log.info(`Either the slug '${slug}' belongs to another project (pick a different project.slug), or those domains belong here and should be in config/cloud.ts sites.`)
  log.info(`If you mean to stop serving them, list them in \`cloud.retiredDomains\` in config/cloud.ts.`)
  process.exit(ExitCode.FatalError)
}

/**
 * Refuse to start a site on a port another tenant is already serving.
 *
 * Two processes CAN bind the same port here: ts-cloud's units do not set
 * exclusive binding, so the kernel load-balances between them instead of
 * failing. Nothing errors, both services look healthy, and each domain serves
 * the other tenant's site on roughly half its requests.
 *
 * That is exactly what happened when a storefront picked 3070 by reading other
 * tenants' config files rather than the box: predicthq.org had been on 3070 for
 * a day and a half, and after the deploy it answered with the storefront.
 *
 * Ports already held by THIS project's own units are fine — that is a redeploy
 * replacing itself.
 */
export async function assertPortsAreFree(
  ip: string,
  tsCloudConfig: any,
  log: { error: (m: string) => void, info: (m: string) => void },
): Promise<void> {
  const slug = tsCloudConfig.project?.slug || 'app'
  const wanted = new Map<number, string>()

  for (const [name, site] of Object.entries((tsCloudConfig.sites ?? {}) as Record<string, { port?: number }>)) {
    const port = Number(site?.port)
    if (Number.isFinite(port) && port > 0)
      wanted.set(port, name)
  }

  if (wanted.size === 0)
    return

  let listing = ''
  try {
    const { execSync } = await import('node:child_process')
    const args = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', `root@${ip}`]
    // `ss -lntp` gives port plus the owning pid; the unit name resolves the
    // owner, which is what tells a redeploy apart from a collision.
    listing = execSync(`ssh ${args.map(a => `'${a}'`).join(' ')} bash -s`, {
      input: `for p in ${[...wanted.keys()].join(' ')}; do
  pid=$(ss -lntpH "sport = :$p" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  [ -n "$pid" ] || continue
  unit=$(systemctl status "$pid" 2>/dev/null | head -1 | grep -oE '[a-zA-Z0-9_.@-]+\\.service' | head -1)
  echo "$p \${unit:-unknown}"
done`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }
  catch {
    // No access, no `ss`, no answer: the deploy's own failures are louder.
    return
  }

  const clashes: string[] = []
  for (const line of listing.split('\n')) {
    const [portText, unit = 'unknown'] = line.trim().split(/\s+/)
    const port = Number(portText)
    if (!Number.isFinite(port) || !wanted.has(port))
      continue

    // Our own unit holding the port is a redeploy, not a collision.
    if (unit.startsWith(`${slug}-`))
      continue

    clashes.push(`  ${port} (site '${wanted.get(port)}') is held by ${unit}`)
  }

  if (clashes.length === 0)
    return

  log.error('Another service on the box is already listening on a port this project wants:')
  for (const clash of clashes)
    log.error(clash)
  log.error('Two services on one port do not error: the kernel load-balances, and each domain serves the other\'s site about half the time.')
  log.info('Pick free ports in config/cloud.ts. `ss -lntp` on the box lists what is taken.')
  process.exit(ExitCode.FatalError)
}

export async function resolveDeployEnvValues(
  environment: 'production' | 'staging' | 'development',
  tsCloudConfig?: { project?: { slug?: string } },
): Promise<Record<string, string>> {
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
    const undecrypted: string[] = []
    for (const [key, value] of Object.entries(parsed)) {
      // dotenvx crypto metadata, not application config — never ship it.
      if (/^DOTENV_(PUBLIC|PRIVATE)_KEY/.test(key))
        continue
      values[key] = String(value)
      if (/^(?:encrypted|enc):/.test(values[key]))
        undecrypted.push(key)
    }

    // A value that could not be decrypted comes back as its own ciphertext, and
    // a ciphertext is a perfectly valid string: it would be written into the
    // site's .env and the app would boot with `APP_KEY=encrypted:BEd1…`, failing
    // at whatever first tried to use it, hours later, in a message about that
    // feature rather than about the key. Almost always a missing `.env.keys`
    // (a fresh clone, or CI without DOTENV_PRIVATE_KEY_PRODUCTION), and it is
    // not recoverable here — the private key is the only thing that would help.
    if (undecrypted.length > 0) {
      log.error(`${undecrypted.length} value(s) in ${fileName} could not be decrypted: ${undecrypted.join(', ')}`)
      log.info(`The private key for this environment lives in .env.keys, which is not committed. Restore it, or set DOTENV_PRIVATE_KEY_${environment.toUpperCase()} in the environment running the deploy.`)
      process.exit(ExitCode.FatalError)
    }

    const { foreignTenantKeys, partitionTenantEnv } = await import('@stacksjs/env')
    const partition = partitionTenantEnv(values, {
      self: tsCloudConfig?.project?.slug,
      tenants: await resolveDeclaredTenants(),
    })

    for (const { tenant, keys } of foreignTenantKeys(partition)) {
      log.warn(
        `[deploy] Skipping ${keys.length} '${tenant}' key(s) in ${fileName} - they belong to that tenant's own `
        + `repository, and shipping them writes its secrets into this project's site .env files. `
        + `Remove them with: buddy env:check --file ${fileName}. Keys: ${keys.join(', ')}`,
      )
    }

    return partition.own
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

/** A `DB_DATABASE` value that names a FILE (SQLite) rather than a database. */
function looksLikeSqliteFile(value: unknown): value is string {
  return typeof value === 'string' && /\.(?:sqlite3?|db)$/i.test(value.trim())
}

/**
 * The SQLite file a site will open, relative to its release root — or `null`
 * when the site is not on SQLite, or its database already lives outside the
 * release tree (an absolute `DB_DATABASE_PATH` is the operator saying "I have
 * placed this somewhere persistent myself").
 *
 * Mirrors config/database.ts' resolution order. `DB_DATABASE` is only a path
 * when it looks like one — for every other driver it is a database NAME, and
 * linking `stacks` as a file would be nonsense.
 */
export function siteSqlitePath(siteEnv: Record<string, any> = {}): string | null {
  const connection = String(siteEnv.DB_CONNECTION ?? 'sqlite').trim().toLowerCase()
  if (connection !== 'sqlite')
    return null

  const configured = typeof siteEnv.DB_DATABASE_PATH === 'string' && siteEnv.DB_DATABASE_PATH.trim()
    ? siteEnv.DB_DATABASE_PATH
    : looksLikeSqliteFile(siteEnv.DB_DATABASE)
      ? siteEnv.DB_DATABASE
      : 'database/stacks.sqlite'

  const path = String(configured).trim().replace(/^\.\//, '')
  // Absolute (or `~`) paths are already outside the release; `..` cannot be
  // expressed as a release-relative shared path at all.
  if (!path || path.startsWith('/') || path.startsWith('~') || path.split('/').includes('..'))
    return null
  return path
}

/**
 * Does the loaded ts-cloud actually keep persistent state the way
 * {@link applyPersistentStatePaths} assumes?
 *
 * Declaring shared paths against a ts-cloud that lacks these is worse than not
 * declaring them at all — it is the difference between "the database dies with
 * its release" and "the deploy places an empty database over the live one and
 * migrates into it". So this probes the two capabilities the declaration
 * depends on and lets the caller refuse the deploy.
 *
 * Probed by generating a script and reading what it DOES, not by a version
 * number or an exported symbol name: a version range goes stale the moment
 * someone installs a fork, and an internal helper can be renamed without
 * changing behaviour.
 *
 * @param buildSiteDeployScript ts-cloud's script builder, as loaded at runtime.
 */
export function tsCloudPersistentStateSupport(buildSiteDeployScript: unknown): { ok: boolean, missing: string[] } {
  const missing: string[] = []
  if (typeof buildSiteDeployScript !== 'function')
    return { ok: false, missing: ['buildSiteDeployScript'] }

  const target = '/var/www/probe-shared/database/probe.sqlite'
  let script = ''
  try {
    script = (buildSiteDeployScript as (o: any) => string[])({
      siteName: 'probe',
      slug: 'probe',
      appDir: '/var/www/probe-probe',
      artifactFetch: [],
      releaseId: 'probe',
      execStart: '/bin/true',
      envEntries: {},
      port: 3000,
      sharedPaths: [{ path: 'database/probe.sqlite', target, seed: true }],
    }).join('\n')
  }
  catch {
    // A ts-cloud that only knows string shared paths throws on the spec form
    // (it treats every entry as a string). That IS the answer.
    return { ok: false, missing: ['shared paths with an explicit target'] }
  }

  // Adoption: the layout seeds a newly-shared path from the live release.
  if (!(script.includes('cp -a') && script.includes('/current/')))
    missing.push('adoption of existing state into shared/')
  // Project-level targets: the release links at the given absolute path rather
  // than at the site's own shared/ dir.
  if (!script.includes(`ln -sfn ${target} `))
    missing.push('shared paths with an explicit target')

  return { ok: missing.length === 0, missing }
}

/**
 * Where a project's app database lives on the box: one directory per project,
 * outside every site's release tree.
 *
 * Deliberately derived from the project slug ALONE. ts-cloud installs each site
 * under `/var/www/<slug>-<site>`, so anything derived from the site name gives
 * each site a database of its own — which is exactly how `main` and `api` ended
 * up on separate files, with only `main` ever migrated. Two sites of one project
 * cannot disagree about a path that does not mention which site is asking.
 */
export function projectDatabaseTarget(slug: string, relativePath: string): string {
  return `/var/www/${slug}-shared/${relativePath}`
}

/**
 * Where `migrate` sits in this site's preStart, or -1.
 *
 * One definition, because {@link applyPreMigrationBackup} splices ahead of this
 * index and {@link runsMigrations} decides whether to: two regexes that agreed
 * today would eventually disagree, and the failure mode is a dump inserted at
 * the wrong place rather than an error.
 */
function migrateIndex(site: any): number {
  if (!Array.isArray(site?.preStart))
    return -1
  return site.preStart.findIndex((cmd: unknown) => typeof cmd === 'string' && migratesDatabase(cmd))
}

/**
 * Does this command run migrations, as opposed to merely mentioning them?
 *
 * The word alone is not enough. Apps put progress markers between preStart
 * steps, because the remote log runs every command together with no delimiters,
 * and `echo "preStart: migrate"` matched before the invocation it announces. The
 * backup was then derived from the echo, could not be, and was skipped with a
 * warning: a deploy migrating a production database with no dump in front of
 * it, because of a log line.
 *
 * So quoted text is removed before looking. What a command SAYS is not what it
 * DOES, and a message is exactly the place the word will appear innocently. An
 * invocation that quotes the subcommand itself (`buddy "migrate"`) is unusual
 * but legal, so the original is still consulted for anything that is not purely
 * an echo.
 */
function migratesDatabase(command: string): boolean {
  const withoutMessages = command.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')

  if (/\bmigrate\b/.test(withoutMessages))
    return true

  // Nothing outside the quotes migrates. Only a command that does something
  // besides print gets the benefit of the doubt.
  return !/^\s*(?:echo|printf)\b/.test(command) && /\bmigrate\b/.test(command)
}

/** Does this site run `migrate`? That site owns the database. */
function runsMigrations(site: any): boolean {
  return migrateIndex(site) !== -1
}

/**
 * Declare the paths a Stacks server-app WRITES at runtime as ts-cloud shared
 * paths, so they are symlinked into each release instead of dying with it.
 *
 * Two separate failures are closed here.
 *
 * **A release owns the database.** `releases/<sha>/database/stacks.sqlite` was a
 * real file inside the release the deploy had just unpacked: `migrate` (in
 * preStart) built a brand new empty database, the release went live against it,
 * and every production row written since the previous deploy was gone the moment
 * the old release was pruned — silently, with nothing in the deploy output to
 * say so. Verified on a live box: a sentinel row was gone after the next deploy.
 *
 * **A site owns the database.** Each site installs under its own base, so `main`
 * and `api` both opened `database/stacks.sqlite` relative to their OWN release
 * — two files, only one of them ever migrated. The database is therefore pointed
 * at a project-level target ({@link projectDatabaseTarget}) that no site's name
 * appears in, so siblings share one file by construction. Only the site that
 * runs `migrate` may create or seed it; the rest link at it (`seed: false`), so
 * deploy order cannot decide whose data wins.
 *
 * Logs stay site-scoped — `main` and `api` are different services and their logs
 * should not interleave.
 *
 * Additive: a site's own `sharedPaths` in config/cloud.ts always survive, so an
 * app can persist its own state (upload dirs, generated assets) the same way.
 */
export function applyPersistentStatePaths(sites: Record<string, any>, slug: string): Record<string, any> {
  const isServerApp = (site: any): boolean => !!site && typeof site.start === 'string'
  // The single database owner. `migrate` is the marker: it is the one command
  // that must run against the real database. Falling back to the first
  // server-app site keeps a project that migrates elsewhere (or not at all)
  // from having no owner, in which case nothing would ever create the file.
  const appSites = Object.entries(sites).filter(([, site]) => isServerApp(site))
  const owner = (appSites.find(([, site]) => runsMigrations(site)) ?? appSites[0])?.[0]

  const out: Record<string, any> = {}
  for (const [name, site] of Object.entries(sites)) {
    // server-app sites only: static sites are pure build output, and bucket
    // sites never touch the box's disk.
    if (!isServerApp(site)) {
      out[name] = site
      continue
    }

    const sqlite = siteSqlitePath(site.env || {})
    const framework: any[] = [
      // Deploy-to-deploy log continuity: logs written under the release root
      // are pruned along with the release that wrote them.
      'storage/logs',
    ]
    if (sqlite) {
      framework.unshift({
        path: sqlite,
        target: projectDatabaseTarget(slug, sqlite),
        seed: name === owner,
      })
    }

    // Framework entries are applied LAST, so a site that hand-declares
    // `database/stacks.sqlite` as a plain (site-scoped) shared path gets the
    // project-level target anyway. Opting a site onto its own database is done
    // by giving it its own DB_DATABASE_PATH — a deliberate act — not by a
    // shared-path declaration that reads identical to the accident.
    const declared: any[] = Array.isArray(site.sharedPaths) ? site.sharedPaths.filter(Boolean) : []
    const byPath = new Map<string, any>()
    for (const entry of [...declared, ...framework])
      byPath.set(typeof entry === 'string' ? entry : entry.path, entry)

    out[name] = { ...site, sharedPaths: [...byPath.values()] }
  }
  return out
}

/**
 * The project's per-environment env files — `.env.production`, `.env.staging`,
 * and whatever else an app has named — which a release must not carry.
 *
 * Read from disk rather than listed, because the set is open: an app may deploy
 * an environment the framework has never heard of, and an exclude list that
 * enumerates the ones it knows would ship that app's secrets file anyway.
 *
 * `.env.example` is kept. It holds no values, and it is the one file on the box
 * that documents what the app expects to be configured with.
 */
export function encryptedEnvFileNames(projectRoot: string): string[] {
  try {
    return readdirSync(projectRoot).filter(name => /^\.env\.[\w-]+$/.test(name) && name !== '.env.example')
  }
  catch {
    return []
  }
}

/**
 * Does this file declare any scheduled work?
 *
 * The scaffold ships an `app/Scheduler.ts` whose body is entirely commented
 * out except for the example job, so "the file exists" is not the question —
 * "does it schedule anything" is. A `schedule.` call outside a comment is the
 * marker: it is what the scheduler action iterates over, and an app with none
 * has nothing for a daemon to do.
 */
export function declaresScheduledWork(schedulerFile: string): boolean {
  if (!existsSync(schedulerFile))
    return false

  const source = readFileSync(schedulerFile, 'utf8')
    // Strip comments first. The scaffold's own file mentions `schedule.action`
    // and `schedule.command` in commented-out examples, and counting those
    // would put a daemon on every app that never uncommented one.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  return /\bschedule\s*\.\s*(?:job|action|command|call|exec)\b/.test(source)
}

/**
 * Turn on the scheduler for the one site that should run it.
 *
 * `app/Scheduler.ts` is the Laravel-shaped place to declare recurring work, and
 * a deploy shipped it to a box where nothing ran it. ts-cloud has known how to
 * run it all along — `scheduler: true` on a site installs
 * `<slug>-<site>-scheduler.service`, and for Stacks it runs as a daemon rather
 * than Laravel's every-minute cron, because `buddy schedule:run` registers
 * timers on the event loop and stays up where `artisan schedule:run` exits. The
 * missing piece was that nothing ever set the flag, so every schedule any app
 * declared was inert in production — silently, because a task that never fires
 * looks exactly like a task with nothing to do. One dispensary's nightly menu
 * import sat unrun while its storefront served the previous week's catalogue,
 * and the only reason anyone noticed was a customer looking at the site.
 *
 * On for exactly ONE site, the same owner {@link applyPersistentStatePaths}
 * picks: the site that runs migrations, else the first server app. An app that
 * deploys `main` and `api` from one codebase has one `app/Scheduler.ts` between
 * them, and turning it on per-site would fire every job twice — two of every
 * email, two menu imports racing each other over one SQLite file.
 *
 * A site that says `scheduler` itself is left alone, in both directions: an app
 * that wants the scheduler somewhere else has said so, and one that has turned
 * it off has said that too.
 */
export function applyScheduledWork(sites: Record<string, any>, schedulerFile: string): Record<string, any> {
  if (Object.values(sites).some(site => site?.scheduler !== undefined))
    return sites

  if (!declaresScheduledWork(schedulerFile))
    return sites

  const appSites = Object.entries(sites).filter(([, site]) => typeof site?.start === 'string')
  const owner = (appSites.find(([, site]) => runsMigrations(site)) ?? appSites[0])?.[0]

  if (!owner)
    return sites

  return { ...sites, [owner]: { ...sites[owner], scheduler: true } }
}

/**
 * How a site's `start` says it is the API.
 *
 * Two spellings, because both are legitimate and only the first was recognised:
 *
 *   `buddy serve:api`                                    the script alias
 *   `bun node_modules/@stacksjs/actions/dist/serve/api.js`  the entrypoint itself
 *
 * The second is what a generated config actually contains once it resolves the
 * package rather than going through a bin shim, and matching only the
 * colon-separated alias classified it as a page server (stacksjs/stacks#2349).
 */
const apiStartPattern = /\bserve:api\b|(?:^|[\s/])serve\/api\.[cm]?[jt]s\b/

/**
 * Whether a site is the API process the page server proxies `/api/**` to.
 *
 * By name, because that is what the docs and every generated config call it,
 * or by what it actually runs - a site called something else that starts the
 * API is still the API, whichever way it spells it.
 */
function servesApi(name: string, site: any): boolean {
  return name === 'api' || (typeof site?.start === 'string' && apiStartPattern.test(site.start))
}

/**
 * Whether a site can receive an HTTP request at all.
 *
 * A server app is only reachable if something routes to it: its own listening
 * port, or a domain the gateway sends traffic to. `bun buddy queue:work` and
 * `bun buddy schedule:run` have neither - they are long-running processes with
 * no listener, so nothing can request `/api/**` from them and nothing can 502.
 *
 * The classifier used to treat any site with a `start` string as a page
 * server, which refused whole deploys over a proxy relationship a headless
 * worker cannot have (stacksjs/stacks#2367). Note that the API site itself is
 * deliberately domain-less, loopback-only on its own port, so a port alone has
 * to count.
 */
function servesHttp(site: any): boolean {
  return Boolean(site?.port || site?.domain)
}

/**
 * How each site was classified, for the error message.
 *
 * The old messages asserted a conclusion the operator could see was false ("no
 * site serves them", with an API site right there) and gave no way to find out
 * what the classifier had decided. Diagnosing it meant reading the bundled
 * source. Showing the verdict per site makes a misclassification obvious on the
 * line that reports it.
 */
function describeSiteClassification(sites: Record<string, any>): string {
  const described = Object.entries(sites)
    .filter(([, site]) => typeof site?.start === 'string')
    .map(([name, site]) => {
      if (servesApi(name, site))
        return `\`${name}\` (api)`
      if (!servesHttp(site))
        return `\`${name}\` (headless, no HTTP surface)`
      const env = (site?.env ?? {}) as Record<string, unknown>
      const wiring = env.API_URL ? 'API_URL set' : env.PORT_API ? 'PORT_API set' : 'no API_URL or PORT_API'
      return `\`${name}\` (page, ${wiring})`
    })

  return described.length > 0 ? `Sites examined: ${described.join(', ')}.` : 'No server-app sites were examined.'
}

/**
 * Refuse to ship a deploy whose `/api/**` would answer 502.
 *
 * Stacks serves the API as its own process: the page server proxies same-origin
 * `/api` requests to it, and `resolveApiBase` deliberately returns null on a
 * deployed box unless the operator has said where it is - proxying into
 * whatever else happens to hold port 3008 on a shared box is worse than
 * failing. So a working deploy needs *two* declarations that nothing checks
 * were both made: an `api` site, and `PORT_API` (or `API_URL`) in the page
 * server's environment.
 *
 * Make one and not the other and the deploy succeeds, the site serves, and
 * every `/api` request answers 502 - health checks, the OpenAPI document, the
 * MCP endpoint, on-demand social cards, and every `fetch('/api/...')` the app
 * makes. reviewos.org shipped in that state and nobody noticed until somebody
 * asked why a link preview was blank: the front page was 200 throughout, which
 * is what a deploy's own verification looks at.
 *
 * This is the check that was missing. A project with no API surface is
 * untouched - the routes file is the signal, and an app without one has
 * nothing to serve.
 */
/**
 * ts-cloud's own dashboard site, which this project declares nothing about.
 *
 * Matches the naming the deploy path already keys off when it reconciles those
 * sites' live ports: `dashboard`, or `dashboard-<host>`.
 */
function isDashboardSite(name: string): boolean {
  return name === 'dashboard' || name.startsWith('dashboard-')
}

export function apiDeploymentProblem(sites: Record<string, any>, hasApiRoutes: boolean): string | undefined {
  if (!hasApiRoutes)
    return undefined

  const entries = Object.entries(sites)
  const appSites = entries.filter(([, site]) => typeof site?.start === 'string')
  if (appSites.length === 0)
    return undefined

  const api = entries.find(([name, site]) => servesApi(name, site))
  // The page servers: every server app that is not the API itself, and not
  // ts-cloud's own dashboard.
  //
  // The dashboard is not this project's site. It is adopted from whatever is
  // already running on the box - the same reason its port is reconciled from
  // `livePorts` rather than declared here - and it serves ts-cloud's admin UI,
  // not `routes/api.ts`. Holding it to "must proxy to the project's API" asks
  // it to wire up routes it does not serve, and refuses every deploy of a box
  // that has a dashboard on it.
  //
  // And not a headless process. A site with no port and no domain has no HTTP
  // surface to proxy from, so requiring it to declare `PORT_API` records a
  // relationship that does not exist and refuses deploys that were correct
  // (stacksjs/stacks#2367).
  const pages = appSites.filter(([name, site]) =>
    !servesApi(name, site) && !isDashboardSite(name) && servesHttp(site))

  // Somebody has pointed the proxy somewhere explicitly. That is intent, and
  // it covers the API living on another host entirely.
  const configured = (site: any): boolean => {
    const env = (site?.env ?? {}) as Record<string, unknown>
    return Boolean(env.API_URL || env.PORT_API)
  }

  if (!api) {
    if (pages.every(([, site]) => configured(site)))
      return undefined

    return 'This project declares API routes and no site serves them. `/api/**` will answer 502 on every request.\n'
      + `${describeSiteClassification(sites)}\n`
      + 'Add an `api` site to config/cloud.ts running `buddy serve:api` on its own port, and set `PORT_API` on the site that serves the pages so its proxy can find it.\n'
      + 'Set `API_URL` on the page site instead when the API lives on another host.'
  }

  const unwired = pages.filter(([, site]) => !configured(site))
  if (unwired.length === 0)
    return undefined

  const port = api[1]?.port

  return `The \`${api[0]}\` site serves the API, but ${unwired.map(([name]) => `\`${name}\``).join(', ')} will not proxy to it: neither \`PORT_API\` nor \`API_URL\` is set in its environment, so \`/api/**\` answers 502.\n`
    + `${describeSiteClassification(sites)}\n`
    + `Set \`PORT_API: '${port ?? '<the api site\'s port>'}'\` in that site's \`env\` in config/cloud.ts.`
}

/**
 * The database each site will migrate against, once its env is resolved.
 *
 * A site's `DB_CONNECTION` comes from its own `env` merged over
 * `.env.<environment>`, so it is knowable locally and need not match whatever
 * the operator has exported in their shell. Deduplicated, because the audit is
 * per corpus and two sites on sqlite is one thing to check.
 *
 * Only sites that actually run migrations are considered. A static or proxy
 * site ships no schema, and failing a deploy over the database a site never
 * opens would be a refusal nobody can act on.
 */
export function siteDatabaseDrivers(sites: Record<string, any>): string[] {
  const drivers = new Set<string>()

  for (const site of Object.values(sites ?? {})) {
    if (typeof site?.start !== 'string')
      continue

    // `migrateToken` matches one token, not a whole command line, so the step
    // has to be split the way buddyInvocationFrom splits it.
    const preStart = Array.isArray(site?.preStart) ? site.preStart : []
    const migrates = preStart.some((step: unknown) =>
      typeof step === 'string' && step.trim().split(/\s+/).some(token => migrateToken.test(token)))
    if (!migrates)
      continue

    // Deliberately NOT falling back to the deploying shell's DB_CONNECTION. By
    // this point the site's env already has .env.<environment> merged in, so it
    // is what the box will run with; the operator's local value describes their
    // laptop and auditing against it would refuse correct deploys and pass
    // broken ones. Absent means the framework default, exactly as
    // validateMigrationDialect reads it.
    const env = (site?.env ?? {}) as Record<string, unknown>
    drivers.add(String(env.DB_CONNECTION || 'sqlite').toLowerCase())
  }

  return [...drivers]
}

/**
 * How a preStart string can be invoking buddy: the monorepo's own source entry,
 * an installed package's built CLI, or one of the bin names on PATH.
 */
const buddyEntrypoint = /(?:^|\/)(?:cli\.[cm]?[jt]s|buddy|bud|stacks)$/

/** The `migrate`, `db:migrate`, `migrate:fresh`… token, whatever it is called. */
const migrateToken = /(?:^|:)migrate(?::|$)/

/**
 * The way THIS site invokes buddy, taken from its own migrate step: everything
 * ahead of the migrate subcommand, when what it lands on is a buddy entrypoint.
 *
 * Reading it off the site is the whole point. This used to hard-code the
 * monorepo's `bun --conditions development storage/framework/core/buddy/src/
 * cli.ts`, on the reasoning that a release tree has no built binary — true of
 * Stacks' own apps, and false of every app that installs Stacks from npm, where
 * that path does not exist. Those deploys died in preStart with "Module not
 * found", before migrate, so the release was never promoted. The migrate step
 * is the one command already proven to work on that box, so its invocation is
 * the one to reuse.
 *
 * Returns undefined when the migrate step is not a buddy call at all (`bun run
 * migrate`, a shell script, a container exec). Guessing there is how the
 * hard-coded path failed in the first place.
 *
 * Only the invocation, never the shell around it. A migrate step is often
 * wrapped — a retry loop, a `cd &&`, a guard — and taking *everything* before
 * the subcommand used to swallow that wrapper: `ok=0; for i in 1 2 3; do
 * ./buddy migrate` yielded the invocation `ok=0; for i in 1 2 3; do ./buddy`,
 * and the backup command built from it opened a `for … do` that nothing closed.
 * Spliced into the deploy script, that made bash reject the whole thing with
 * `syntax error: unexpected end of file` — pointing at the end of the file,
 * hundreds of lines from the fragment responsible, after the release had
 * already installed and built. So walk back from the subcommand and stop at the
 * first thing that is shell rather than argument.
 */
export function buddyInvocationFrom(migrateCommand: unknown): string | undefined {
  if (typeof migrateCommand !== 'string')
    return undefined

  const tokens = migrateCommand.trim().split(/\s+/)
  // `./buddy migrate; done` and `./buddy migrate && echo ok` are ordinary ways
  // to write the step. Matching the bare word only meant those sites quietly
  // got no pre-migration dump at all.
  const at = tokens.findIndex(token => migrateToken.test(token.replace(/[;&|]+$/, '')))
  if (at < 1)
    return undefined

  let from = at
  while (from > 0 && !isShellToken(tokens[from - 1]!))
    from--

  const invocation = tokens.slice(from, at)
  const entrypoint = invocation[invocation.length - 1]
  if (!entrypoint || !buddyEntrypoint.test(entrypoint))
    return undefined

  return invocation.join(' ')
}

/**
 * Does this token belong to the shell rather than to the command?
 *
 * Operators and separators (`;`, `&&`, `|`, redirections, subshells), the
 * keywords that open a compound command, and leading `VAR=value` assignments —
 * everything that makes a line more than one invocation. Copying any of them
 * into a new command produces a fragment, not a command.
 */
function isShellToken(token: string): boolean {
  if (/[;&|<>()`]/.test(token))
    return true

  if (/^[A-Za-z_][\w]*=/.test(token))
    return true

  return SHELL_KEYWORDS.has(token)
}

const SHELL_KEYWORDS = new Set([
  'do',
  'done',
  'then',
  'else',
  'elif',
  'fi',
  'if',
  'for',
  'while',
  'until',
  'case',
  'esac',
  'in',
  'function',
  '{',
  '}',
  '!',
])

/**
 * The command a site's preStart runs to dump the database before `migrate`
 * touches it, invoking buddy exactly as that site's own migrate step does.
 */
export function preMigrationBackupCommand(backupsDir: string, migrateCommand: unknown): string | undefined {
  const invocation = buddyInvocationFrom(migrateCommand)
  if (!invocation)
    return undefined

  return `${invocation} db:backup --before-migrations --out ${backupsDir}`
}

/**
 * Dump the database immediately before the deploy migrates it.
 *
 * `buddy deploy` runs `migrate` against production on every release, and until
 * now there was nothing to go back to if a migration did something nobody meant
 * (stacksjs/stacks#2313). The dump goes in right before the migrate step in the
 * OWNER site's preStart — the same site {@link applyPersistentStatePaths} picks,
 * because that is the one that runs `migrate` and therefore the one whose
 * database is about to change.
 *
 * The destination is a project-level directory outside every release tree, for
 * the same reason the database itself is: a dump written under
 * `releases/<sha>/` is deleted by the release pruner, so the backup would
 * disappear at exactly the moment the previous release did.
 *
 * Deliberately NOT offsite. This survives a bad migration; it does not survive
 * losing the box, and `buddy doctor` keeps saying so.
 *
 * Idempotent: a site that already runs `db:backup` in preStart is left alone, so
 * an app that placed the dump itself keeps its own ordering.
 *
 * A site whose migrate step is not a recognisable buddy call is left alone too,
 * with a warning. Not backing up a database is bad; guessing an invocation and
 * failing the preStart takes the whole release down instead, which is worse.
 */
export function applyPreMigrationBackup(sites: Record<string, any>, backupsDir: string): Record<string, any> {
  const out: Record<string, any> = {}

  for (const [name, site] of Object.entries(sites)) {
    // Before the FIRST migrate command. A preStart that migrates twice still
    // gets its dump taken while the schema is the one the release inherited.
    const at = migrateIndex(site)
    if (at === -1) {
      out[name] = site
      continue
    }

    const preStart: any[] = [...site.preStart]
    if (preStart.some(cmd => typeof cmd === 'string' && /\bdb:backup\b/.test(cmd))) {
      out[name] = site
      continue
    }

    const backup = preMigrationBackupCommand(backupsDir, preStart[at])
    if (!backup) {
      log.warn(`No pre-migration backup for "${name}": its migrate step (${String(preStart[at])}) is not a buddy invocation this can reuse. Add a \`db:backup\` command to its preStart to take one.`)
      out[name] = site
      continue
    }

    preStart.splice(at, 0, backup)

    out[name] = { ...site, preStart }
  }

  return out
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
 * The project's ts-cloud config, as this command reads it.
 *
 * Written out rather than left as `any`, with every field optional because the
 * file is user-authored and each read below already guards for absence. The
 * index signature keeps any other key a project carries legal.
 *
 * The point is not to constrain what a config may contain. It is that
 * `config.infrastructure.dsn` - a typo for `dns` - used to typecheck and answer
 * `undefined`, which is indistinguishable from a provider that was never
 * declared, and this command chooses a DNS provider off exactly that read.
 */
export interface TsCloudSite {
  port?: number
  /** One host, or several. Both spellings appear in real configs. */
  domain?: string | string[]
  env?: Record<string, string>
  [key: string]: unknown
}

export interface TsCloudInfrastructure {
  compute?: {
    runtime?: unknown
    size?: unknown
    proxy?: {
      autoWww?: unknown
      cdn?: { provider?: string }
    }
  }
  dns?: { provider?: string, hostedZoneId?: string }
}

export interface TsCloudConfig {
  project?: { name?: string, slug?: string, region?: string }
  cloud?: { attachTo?: string, retiredDomains?: unknown, provider?: string }
  hetzner?: { apiToken?: string, location?: string }
  infrastructure?: TsCloudInfrastructure
  /** A site entry may be absent; `applyEnvironmentToSites` guards for it. */
  sites?: Record<string, TsCloudSite | null | undefined>
  environments?: Record<string, { domainPrefix?: string, region?: string } | undefined>
  mode?: string
  /** Some call sites are handed the outer config, which nests the above. */
  tsCloud?: { infrastructure?: TsCloudInfrastructure }
  [key: string]: unknown
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
export function applyEnvironmentToSites(sites: Record<string, TsCloudSite | null | undefined>, environment: string, config: TsCloudConfig): Record<string, TsCloudSite | null | undefined> {
  const prefix: string | undefined = config?.environments?.[environment]?.domainPrefix
  if (!prefix || environment === 'production')
    return sites

  // Every site's public host(s), longest-first so a redirect/URL that points at
  // one site from another (e.g. www.stacksjs.com → https://stacksjs.com) is also
  // rewritten to the prefixed target, and the most-specific host wins.
  const allHosts: string[] = []
  for (const site of Object.values(sites)) {
    const d = site?.domain
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

  const apiToken = resolveHetznerApiToken(tsCloudConfig)
  const persistedAttachBox = resolvePersistedAttachTargetBox(tsCloudConfig, environment)
  if (!apiToken && !persistedAttachBox) {
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

  const { createCloudDriver, deployAllComputeSites, ensureManagementDashboard, resolveSiteKind, buildSiteDeployScript } = await loadTsCloudDeployApi()

  // Refuse rather than deploy a release that would place an empty database over
  // the live one. See tsCloudPersistentStateSupport — an older ts-cloud honours
  // the shared-path declaration without the adoption step, which is the one
  // combination that destroys data instead of merely failing to protect it.
  const support = tsCloudPersistentStateSupport(buildSiteDeployScript)
  if (!support.ok) {
    log.error('This ts-cloud cannot keep your database across deploys, and deploying anyway would destroy it.')
    log.error(`Missing: ${support.missing.join(', ')}.`)
    log.error('Upgrade @stacksjs/ts-cloud (bun update @stacksjs/ts-cloud), or point TS_CLOUD_MODULE at a build that has it.')
    process.exit(ExitCode.FatalError)
  }

  // Say it before the deploy, not after: this run is about to `migrate` against
  // data that has no restore path, and a schema change is the likeliest way an
  // app loses it. Not a refusal - the operator may know, and a deploy is the
  // wrong place to argue - but it will not happen silently, which is how it
  // went unnoticed in the app that opened stacksjs/stacks#2313.
  const unbacked = findUnbackedManagedServices(tsCloudConfig)
  if (unbacked.length > 0)
    log.warn(`[deploy] ${unbackedDataMessage(unbacked)}`)

  try {
    await runHetznerDeploy({ tsCloudConfig, environment, verbose, docker: (options).docker === true, createCloudDriver, deployAllComputeSites, ensureManagementDashboard, resolveSiteKind, onlySite: (options).site || undefined, persistedAttachBox })
  }
  catch (err) {
    log.error('Hetzner deploy failed:')
    console.error(err instanceof Error ? (err.stack || err.message) : err)
    // Rethrow rather than exit: the command's own handler owns notifying and
    // setting the exit code, so a deploy failure reports the same way whatever
    // provider raised it. process.exit() here would skip the notification.
    throw err
  }
}

/**
 * Resolve the app's direct ts-cloud dependency before Buddy's own dependency.
 * Package managers may retain a stale nested copy below Buddy even after the
 * app explicitly updates ts-cloud; resolving from the project manifest keeps
 * the deploy engine selected by the application authoritative.
 */
export function resolveProjectTsCloudModule(projectRoot = process.cwd()): string | undefined {
  const manifestPath = join(projectRoot, 'node_modules', '@stacksjs', 'ts-cloud', 'package.json')
  if (!existsSync(manifestPath)) return undefined

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    module?: string
    exports?: { '.'?: string | { import?: string } }
  }
  const rootExport = manifest.exports?.['.']
  const entry = manifest.module
    ?? (typeof rootExport === 'string' ? rootExport : rootExport?.import)

  if (!entry) return undefined
  const modulePath = resolve(dirname(manifestPath), entry)
  return existsSync(modulePath) ? modulePath : undefined
}

/**
 * Load the ts-cloud driver used by Buddy. An explicit TS_CLOUD_MODULE remains
 * available for framework development; published apps otherwise use their
 * direct dependency before falling back to Buddy's declared dependency.
 */
export async function loadTsCloudDeployApi(): Promise<typeof import('@stacksjs/ts-cloud')> {
  const requested = process.env.TS_CLOUD_MODULE?.trim()
  if (!requested) {
    const projectModule = resolveProjectTsCloudModule()
    return projectModule
      ? import(pathToFileURL(projectModule).href) as Promise<typeof import('@stacksjs/ts-cloud')>
      : import('@stacksjs/ts-cloud')
  }

  const modulePath = isAbsolute(requested) ? requested : resolve(process.cwd(), requested)
  if (!existsSync(modulePath)) throw new Error(`TS_CLOUD_MODULE points to a missing module: ${modulePath}`)
  return import(pathToFileURL(modulePath).href) as Promise<typeof import('@stacksjs/ts-cloud')>
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
export function shouldInjectManagementDashboard(tsCloudConfig: TsCloudConfig): boolean {
  return !tsCloudConfig.cloud?.attachTo
}

export function reconcilePartialDeployManagementDashboards(
  tsCloudConfig: TsCloudConfig,
  livePorts: Record<string, number>,
): { preserved: string[], removed: string[] } {
  const sites = tsCloudConfig.sites as Record<string, any> | undefined
  const preserved: string[] = []
  const removed: string[] = []
  if (!sites) return { preserved, removed }

  for (const [siteName, site] of Object.entries(sites)) {
    if (siteName !== 'dashboard' && !siteName.startsWith('dashboard-'))
      continue

    const livePort = livePorts[siteName]
    if (typeof livePort !== 'number' || !Number.isInteger(livePort) || livePort < 1 || livePort > 65535) {
      delete sites[siteName]
      removed.push(siteName)
      continue
    }

    const next = { ...site, port: livePort }
    if (typeof next.start === 'string')
      next.start = next.start.replace(/(--port(?:=|\s+))\d+/, `$1${livePort}`)
    sites[siteName] = next
    preserved.push(siteName)
  }

  return { preserved, removed }
}

async function reconcilePartialDeployManagementDashboardsWithLiveBox(
  tsCloudConfig: any,
  ip: string,
): Promise<void> {
  const slug = String(tsCloudConfig.project?.slug || 'app').replace(/[^a-z0-9._-]+/gi, '-')
  const siteNames = Object.keys(tsCloudConfig.sites ?? {})
    .filter(name => name === 'dashboard' || name.startsWith('dashboard-'))
  if (siteNames.length === 0) return

  const units = siteNames.map(siteName => ({
    siteName,
    unit: `${slug}-${siteName}.service`,
  }))
  const probe = `
const units = ${JSON.stringify(units)}
const text = bytes => new TextDecoder().decode(bytes).trim()
const run = args => text(Bun.spawnSync(args).stdout)
const ports = {}
for (const entry of units) {
  if (run(['systemctl', 'show', entry.unit, '--property=ActiveState', '--value']) !== 'active')
    continue
  const command = run(['systemctl', 'show', entry.unit, '--property=ExecStart', '--value'])
  const match = command.match(/--port(?:=|\\s+)(\\d+)/)
  if (match)
    ports[entry.siteName] = Number(match[1])
}
console.log(JSON.stringify(ports))
`.trim()
  const encoded = Buffer.from(probe).toString('base64')
  const { sshExecOrThrow } = await import('@stacksjs/ts-cloud')
  const output = await sshExecOrThrow(
    ip,
    `/usr/local/bin/bun -e "eval(Buffer.from('${encoded}','base64').toString())"`,
    { user: 'root', connectTimeoutSec: 10 },
  )
  const line = output.trim().split('\n').at(-1) || '{}'
  const livePorts = JSON.parse(line) as Record<string, number>
  const result = reconcilePartialDeployManagementDashboards(tsCloudConfig, livePorts)

  for (const siteName of result.preserved)
    log.info(`Partial deploy: preserving the live management dashboard service '${siteName}' on port ${livePorts[siteName]}`)
  for (const siteName of result.removed)
    log.info(`Partial deploy: omitting management dashboard route '${siteName}' because no active service owns it`)
}

interface AttachedComputeBox {
  serverId: number
  serverName: string
  publicIp: string
  publicIpv6?: string
}

/**
 * Read a tenant's existing shared-server pin without requiring provider API
 * credentials. The pin contains only compute metadata and is sufficient for
 * an SSH release to a box that the owner project already provisioned.
 */
export function resolvePersistedAttachTargetBox(
  tsCloudConfig: any,
  environment: string,
  cwd = process.cwd(),
): AttachedComputeBox | null {
  const owner = tsCloudConfig.cloud?.attachTo
  if (!owner)
    return null

  const stackName = tsCloudConfig.project?.stackName || `${tsCloudConfig.project?.slug || 'app'}-${environment}`
  const statePath = join(cwd, 'storage', 'cloud', 'state', `${stackName}.json`)
  if (!existsSync(statePath))
    return null

  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>
    if (
      state.stackName !== stackName ||
      typeof state.serverId !== 'number' ||
      typeof state.publicIp !== 'string' ||
      !state.publicIp.trim()
    ) {
      return null
    }

    return {
      serverId: state.serverId,
      serverName: typeof state.serverName === 'string' && state.serverName
        ? state.serverName
        : `${owner}-${environment}-app`,
      publicIp: state.publicIp,
      publicIpv6: typeof state.publicIpv6 === 'string' ? state.publicIpv6 : undefined,
    }
  }
  catch {
    return null
  }
}

export function scrubLoopbackSitePortsForFirewall(tsCloudConfig: TsCloudConfig): TsCloudConfig {
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
  resolveSiteKind: (site: any) => DeploymentSiteKind
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
  ensureManagementDashboard?: (config: any, options: any) => any
  resolveSiteKind: (site: any) => DeploymentSiteKind
  persistedAttachBox?: AttachedComputeBox | null
  /** Deploy ONLY this site (multi-tenant surgical add). Provisioning still uses
   *  the full config so rpx keeps every existing route; only this site's files
   *  are rebuilt/shipped and only its domain gets a DNS record. */
  onlySite?: string
}): Promise<void> {
  const { tsCloudConfig, environment, verbose, docker, createCloudDriver, deployAllComputeSites, ensureManagementDashboard, resolveSiteKind, onlySite, persistedAttachBox } = args

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
    if (shouldInjectManagementDashboard(tsCloudConfig) && typeof ensureManagementDashboard === 'function') {
      ensureManagementDashboard(tsCloudConfig, {
        cwd: process.cwd(),
        logger: { info: (m: string) => log.info(m), warn: (m: string) => log.warn(m) },
      })
    }
    else if (tsCloudConfig.cloud?.attachTo) {
      log.info(`Management dashboard: using the '${tsCloudConfig.cloud.attachTo}' server owner's dashboard`)
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
  // Set when the box has a public IPv6. The DNS reconciler publishes AAAA
  // records alongside the A records so the sites are reachable on both stacks;
  // left undefined, it simply skips them.
  let ipv6: string | undefined
  if (attachTo) {
    // Kept so the error below can name what actually went wrong. A persisted box
    // means no lookup ran at all, which is itself worth not misreporting.
    let lookup: AttachLookupResult | undefined
    let box: AttachTargetBox | null | undefined = persistedAttachBox
    if (!box) {
      lookup = await resolveAttachTargetBox(attachTo, environment, tsCloudConfig)
      box = lookup.box
    }
    // A state file written before publicIpv6 was persisted pins the tenant to
    // IPv4 forever: the cached box short-circuits the Hetzner lookup, the AAAA
    // pass is skipped for want of an address, and the deploy then rewrites the
    // same v6-less file. Re-resolve when the cache is missing v6 so an existing
    // tenant heals itself on its next deploy instead of needing the file
    // deleted by hand.
    if (box && !box.publicIpv6) {
      const resolved = await resolveAttachTargetBox(attachTo, environment, tsCloudConfig)
      if (resolved.box?.publicIpv6)
        box = { ...box, publicIpv6: resolved.box.publicIpv6 }
    }
    if (!box?.publicIp) {
      log.error(describeAttachLookupFailure(attachTo, environment, lookup?.failure))
      process.exit(ExitCode.FatalError)
    }
    ip = box.publicIp
    ipv6 = box.publicIpv6

    // A tenant's slug names the files its deploy OWNS on the shared box: the
    // rpx gateway fragment `/etc/rpx/sites.d/<slug>.json` and the per-tenant
    // cert units. Colliding with the box owner means the tenant's deploy
    // rewrites the OWNER's fragment — every one of the owner's routes replaced
    // by the tenant's, and, because that file also carries the gateway's
    // global TLS block, TLS broken for every domain on the box.
    //
    // This is not hypothetical: a storefront that kept the template's default
    // slug took stacksjs.com down exactly this way.
    if ((tsCloudConfig.project?.slug || 'app') === attachTo) {
      log.error(`This project's slug is '${attachTo}', which is the slug of the box it attaches to.`)
      log.error(`A tenant's deploy owns /etc/rpx/sites.d/<slug>.json, so deploying would overwrite '${attachTo}'s own gateway fragment and take its sites down.`)
      log.info(`Set a distinct project.slug in config/cloud.ts (e.g. '${p.projectPath().split('/').pop()}') and deploy again.`)
      process.exit(ExitCode.FatalError)
    }

    log.info(`Attaching to '${attachTo}' box '${box.serverName}' (${ip}) - skipping provisioning`)

    // Even a unique slug can collide with a tenant that got there first. The
    // fragment on the box is the source of truth for what this slug currently
    // serves: if it declares domains this project does not, writing ours would
    // silently drop them. Read before write.
    await assertFragmentIsOurs(ip, tsCloudConfig, log)
    await assertPortsAreFree(ip, tsCloudConfig, log)

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
    const stateDir = join(process.cwd(), 'storage', 'cloud', 'state')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, `${stackName}.json`), `${JSON.stringify({
      stackName,
      serverId: box.serverId,
      serverName: box.serverName,
      publicIp: ip,
      // Persisted because the next deploy short-circuits the Hetzner lookup and
      // reads this file instead (resolvePersistedAttachTargetBox). Omitting it
      // silently downgraded every deploy after the first to IPv4-only: the box
      // has a public v6 and serves on it, but the AAAA pass is skipped when
      // this is undefined, so tenants ended up reachable over v4 alone.
      ...(ipv6 ? { publicIpv6: ipv6 } : {}),
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
    ipv6 = outputs.appPublicIpv6
    log.success('Hetzner compute infrastructure ready')
    if (outputs.appInstanceId)
      log.info(`Server ID: ${outputs.appInstanceId}`)
  }

  if (ip)
    log.info(`Server IP: ${ip}`)
  if (!ip) {
    log.error('Provisioned server has no public IP - cannot deploy over SSH.')
    process.exit(ExitCode.FatalError)
  }

  await waitForRemoteReady(ip)

  // A narrowed app deploy intentionally leaves the management dashboard unit
  // untouched. Resolve its REAL systemd port before regenerating rpx so a stale
  // local TS_CLOUD_UI_PORT override cannot point the route at a service this
  // deploy never started. If no dashboard service is active, omit its route
  // rather than publishing a guaranteed 502.
  if (onlySite && !attachTo)
    await reconcilePartialDeployManagementDashboardsWithLiveBox(tsCloudConfig, ip)

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
    // stx's build cache + generated route manifest (`routes.ts`). It MUST be
    // regenerated on the server from the shipped `resources/views` — shipping a
    // stale/empty manifest makes production `stx serve` trust it and serve 404
    // on every view route (e.g. `/`). Absent, stx-serve rescans and rebuilds it.
    // (`.stx` too: a checkout that predates the move to storage/ still has one.)
    relative(p.projectPath(), p.stxPath()).replace(/\/$/, ''),
    '.stx',
    // ts-cloud's local state: the dashboard credentials and session signing key
    // live here. They belong to the machine running the deploy and must never
    // ride along in the tarball — the box mints its own under the dashboard
    // site's shared directory.
    relative(p.projectPath(), p.cloudStatePath()).replace(/\/$/, ''),
    '.ts-cloud',
    // Migration lock, temp bundles, CLI scratch — machine-local, never useful
    // on the box.
    relative(p.projectPath(), p.frameworkRuntimePath()).replace(/\/$/, ''),
    'tmp',
    'temp',
    '.DS_Store',
    '*.log',
    // Local env files are machine-local secrets — never ship them. The box
    // gets its env from ts-cloud's generated EnvironmentFile (merged decrypted
    // .env.production + site env), symlinked over release/.env at deploy time.
    '.env',
    '.env.local',
    '.env.keys',
    '.env.production.bak',
    '.env.production.plain',
    // …and the encrypted ones, which are useless on the box and actively
    // harmful there. The private key never leaves the machine running the
    // deploy, so nothing on the server can read `.env.production` — but Bun
    // loads `.env.<mode>` on top of `.env`, and the mode-specific file WINS.
    // A process that reads its own env rather than taking systemd's
    // EnvironmentFile — the scheduler, a queue worker, any `./buddy` command
    // run on the box — therefore came up with `APP_KEY=encrypted:v2:…`, a
    // perfectly valid string that fails at whatever first tried to use it.
    // Verified on a live box: the scheduler saw ciphertext for every secret
    // while the site beside it, fed by EnvironmentFile, saw the real values.
    ...encryptedEnvFileNames(p.projectPath()),
    // Local SQLite files. Shipping one overwrites the box's database with
    // whatever the developer happened to have on disk, silently, on every
    // deploy — the production rows are simply gone, and nothing in the output
    // says so. It is not a hypothetical: a row written while testing a feature
    // locally arrived in production this way.
    //
    // The server's database is built by `migrate` in the site's preStart and
    // owned by the box from then on. A local file is never the right thing to
    // put on top of it. `-wal`/`-shm` are the write-ahead log and shared-memory
    // sidecars; a `.sqlite` restored without them is fine, but shipping them
    // alongside a stale main file is how you get a corrupt-looking database.
    '*.sqlite',
    '*.sqlite-wal',
    '*.sqlite-shm',
  ]

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

    // Paths the SERVER owns, declared per site.
    //
    // The list above is machine-local dev noise. This is the other kind: state
    // that lives on the box and would be destroyed by shipping a local copy
    // over it. A git forge keeps its bare repositories under `storage/repos`;
    // packaging those made a 2 MB release a 195 MB one, stalled the upload for
    // an hour, and would have replaced live repository storage with whatever
    // the developer happened to have checked out.
    //
    // Per site rather than a framework-wide constant, because only the
    // application knows which of its directories are authoritative on the box.
    const siteExcludes: string[] = Array.isArray((site).exclude)
      ? (site).exclude.filter((entry: unknown) => typeof entry === 'string' && entry.length > 0)
      : []

    const excludeArgs = [...tarExcludes, ...siteExcludes]
      .flatMap(pattern => [`--exclude='${pattern}'`, `--exclude='*/${pattern}'`])

    if (siteExcludes.length > 0)
      log.info(`Excluding server-owned paths: ${siteExcludes.join(', ')}`)

    log.info(`Packaging ${root} → ${tarballPath}...`)
    // COPYFILE_DISABLE stops macOS bsdtar from embedding AppleDouble (._*)
    // resource-fork files — on the server those shadow real files and break
    // anything that globs a directory (e.g. `._0001-….sql` crashes migrate).
    execSync(
      `tar czf "${tarballPath}" ${excludeArgs.join(' ')} -C "${root}" .`,
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
  const resolvedDeployEnv = await resolveDeployEnvValues(environment, tsCloudConfig)
  // Persistent-state paths are declared AFTER the env merge: which file (or
  // whether any file) the app opens is decided by the site's resolved
  // DB_CONNECTION/DB_DATABASE_PATH, not by config/cloud.ts. Requires a ts-cloud
  // that can adopt existing state and honour explicit targets — checked once,
  // fatally, in deployToHetzner (tsCloudPersistentStateSupport).
  // The pre-migration dump is spliced in LAST, so it lands in a preStart that
  // is already final, and it goes to the same project-level directory the
  // database itself lives under - outside every release tree, so the release
  // pruner cannot take the backup with it (stacksjs/stacks#2313).
  const sitesWithResolvedEnv = applyPreMigrationBackup(
    applyScheduledWork(
      applyPersistentStatePaths(mergeSiteDeployEnv(sites, resolvedDeployEnv), slug),
      p.projectPath('app/Scheduler.ts'),
    ),
    projectDatabaseTarget(slug, 'backups'),
  )

  /*
   * Checked here rather than earlier: `env` is only final after the merge
   * above, so a `PORT_API` that arrives from .env.production counts.
   *
   * Fatal, because the alternative is what already happened - a deploy that
   * reports success while the entire API surface answers 502, on a site whose
   * front page is 200 and whose health check therefore passes.
   */
  const apiProblem = apiDeploymentProblem(sitesWithResolvedEnv, existsSync(p.projectPath('routes/api.ts')))
  if (apiProblem) {
    log.error(apiProblem)
    throw new Error('Refusing to deploy: the API would not be reachable.')
  }

  /*
   * Can the committed migrations actually run against the database each site is
   * configured to open?
   *
   * Checked here, with the rest of the preventable refusals, because the answer
   * is entirely local and the alternative is what already happened: the deploy
   * succeeds, TLS is issued, DNS reconciles, the site answers 200, and the
   * migrate step on the box fails with a wrong-dialect corpus. The scaffolded
   * workflow runs that step with `|| echo "::warning::"`, so the job stays
   * green and the app serves publicly with no tables (stacksjs/stacks#2347).
   *
   * `validateMigrationDialect` is the same gate `buddy migrate` uses, so a
   * deploy cannot pass something the box will then reject. Same escape hatch
   * too: STACKS_ALLOW_DIALECT_MISMATCH=1.
   */
  const { validateMigrationDialect } = await import('./migrate')
  for (const driver of siteDatabaseDrivers(sitesWithResolvedEnv)) {
    const dialect = validateMigrationDialect(p.projectPath(), { driver })
    if (!dialect.valid) {
      log.error(dialect.error ?? `The committed migrations cannot run on ${driver}.`)
      throw new Error(`Refusing to deploy: the migrations cannot run on ${driver}.`)
    }
  }

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
    // Full deploys let ts-cloud reconcile the one-dashboard-per-server
    // invariant. A narrowed --site deployment must not add or remove dashboard
    // state because it intentionally touches one application site only.
    managementDashboard: !onlySite,
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
  let publishedDns: string[] = []
  if (ok) {
    // The same autoWww setting the gateway was built with, so the hostnames DNS
    // publishes and the routes rpx serves stay one set.
    const autoWww = tsCloudConfig.infrastructure?.compute?.proxy?.autoWww
    publishedDns = await reconcileHetznerDns(onlySite ? { [onlySite]: sites[onlySite] } : sites, ip, log, ipv6, autoWww)
  }

  // A brand-new subdomain does not resolve until the step above runs, and ACME
  // cannot issue for a name that does not resolve — so the certificate the
  // gateway loaded moments earlier does not cover it, and the box answers TLS
  // with another tenant's certificate as the SNI fallback. Re-issue and reload
  // once records have actually landed. Skipped entirely when nothing was
  // published, which is the steady state for every redeploy.
  if (ok && publishedDns.length > 0) {
    log.info(`Issuing TLS for ${publishedDns.length} newly published record(s)...`)
    try {
      // Run the per-tenant issuance unit this same deploy installs
      // (`rpx-cert-renew-<slug>.{service,timer}`, see the provisioning step
      // above). It shells out to tlsx over the http-01 webroot and reloads
      // the gateway on success.
      //
      // This used to call `renewRpxCertificates` out of @stacksjs/ts-cloud.
      // No such export exists — the package ships `CertificateManager`, which
      // is the AWS ACM/CloudFormation surface and has nothing to do with the
      // rpx gateway or Let's Encrypt. So every first deploy of a new domain
      // threw "renewRpxCertificates is not a function", fell into the
      // best-effort catch, and left the name answering TLS with another
      // tenant's certificate until the daily timer happened to fire.
      //
      // The unit is idempotent and skips anything not expiring within 30
      // days, so re-running it costs one ACME no-op.
      const { execSync } = await import('node:child_process')
      const slug = tsCloudConfig.project?.slug || 'app'
      const unit = `rpx-cert-renew-${slug}.service`
      const certSshArgs = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', `root@${ip}`]
      const out = execSync(`ssh ${certSshArgs.map(a => `'${a}'`).join(' ')} bash -s`, {
        input: `systemctl start ${unit} 2>&1 || true\nsystemctl is-active ${unit} >/dev/null 2>&1 && echo TLSUNIT:running || echo TLSUNIT:done\njournalctl -u ${unit} -n 20 --no-pager 2>/dev/null | grep -E 'Certificate written|Skipping|error|Error' | tail -5 || true`,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      for (const line of out.split('\n')) {
        if (/Certificate written|Skipping/.test(line))
          log.info(`  ${line.replace(/^.*?\]:\s*/, '').trim()}`)
      }

      log.success('TLS issued and gateway reloaded for the new record(s)')
    }
    catch (err: any) {
      // Best-effort, like the reconcilers around it: the release is already
      // live, and the daily renewal timer picks the certificate up regardless.
      log.warn(`TLS issuance after DNS failed: ${err?.message || err}`)
      log.warn(`  Until it succeeds, ${publishedDns.join(', ')} serves a fallback certificate.`)
    }
  }

  // Reconcile the app's declared DNS records (config/dns.ts) beyond the apex/www
  // A records above — e.g. verification TXT, extra CNAMEs. Strictly additive:
  // only creates declared records that are missing (and never a private IP),
  // never deletes or overwrites. Best-effort, same as the reconcilers around it.
  if (ok)
    await reconcileConfigDns(onlySite ? { [onlySite]: sites[onlySite] } : sites, log)

  // Put the frontends behind Cloudflare's edge, and bust the cache.
  //
  // Deliberately AFTER DNS and after TLS issuance above. Cloudflare's proxy is
  // the DNS record, so orange-clouding a host makes it resolve to Cloudflare
  // instead of the box — and an ACME http-01 challenge for a name that no
  // longer reaches the box on :80 cannot complete. ts-cloud probes the origin
  // before flipping each record for exactly this reason, but the probe can only
  // pass if issuance has already had its turn.
  //
  // This is also where a release becomes visible: HTML is cached at the edge,
  // so without the purge at the tail of this step a deploy would ship new
  // assets that nobody is served until the TTL lapses.
  if (ok)
    await reconcileCloudflareCdnForDeploy(tsCloudConfig, ip, ipv6, log)

  // Reconcile this app's mail routing onto the (shared) mail server from
  // config/email.ts: register its local domain and provision its auto-forward
  // rules (forwards.json + compiled RFC 5228 Sieve). Idempotent, merge-based and best-effort — it never
  // removes another tenant's domains/forwards and never fails the release.
  if (ok) {
    const mailOwner = mailServerOwnerFromConfig(emailConfig)
    let mailIp: string | undefined = ip
    if (mailOwner) {
      const mailLookup = await resolveAttachTargetBox(mailOwner, environment, tsCloudConfig)
      if (mailLookup.box?.publicIp) {
        mailIp = mailLookup.box.publicIp
        log.info(`Mail: reconciling on '${mailOwner}' box '${mailLookup.box.serverName}' (${mailIp})`)
      }
      else {
        mailIp = undefined
        log.warn(`Mail: ${describeAttachLookupFailure(mailOwner, environment, mailLookup.failure)}`)
        log.warn('Mail: skipping mail reconciliation; the application deploy remains live.')
      }
    }

    const mailRes = mailIp ? await provisionMailTenant(mailIp, log) : null
    if (mailOwner && mailIp && mailIp !== ip)
      await cleanupDetachedMailHealth(ip, log)
    // Publish the domain's mail DNS (MX/SPF/DKIM/DMARC) so the mailboxes can
    // actually send + receive. Best-effort, same as the tenant reconcile.
    if (mailRes)
      await reconcileMailDns(mailRes, mailIp!, log)
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
    await outro('Hetzner deploy reported a failure - see the per-instance output above.', { startTime, useSeconds: true })
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
 * concrete `<local-part>@<domain>` mailboxes with a password each.
 *
 * A password comes from the entry, else `MAIL_PASSWORD_<LOCALPART>` in the env.
 * **A mailbox with neither is skipped**, deliberately: a routine deploy must
 * never conjure random-password mailboxes the operator never asked for and
 * cannot retrieve. Declaring the password is how a mailbox opts in.
 *
 * `skipped` carries the ones that were left out so the caller can say so. This
 * used to be silent, and silence is the wrong answer here: declaring mailboxes
 * in `config/email.ts` and watching a deploy report success while creating none
 * of them looks exactly like the mail server being broken. It cost two
 * provisioning runs and an SSH session to find out otherwise, and the docstring
 * above this function claimed the opposite behaviour while it did.
 */
function resolveMailboxes(mailboxes: unknown, domain: string, generatePassword = false): ResolvedMailbox[] {
  return resolveMailboxesWithSkipped(mailboxes, domain, generatePassword).boxes
}

/**
 * A password for a mailbox the project asked us to generate.
 *
 * From the platform CSPRNG, because this IS the credential for a real mailbox
 * on a real server. Base64url so it survives being pasted into a mail client,
 * a systemd unit, and a dovecot userdb without quoting rules mangling it.
 */
function generateMailboxPassword(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
}

/** `resolveMailboxes`, plus the addresses left out for want of a password. */
function resolveMailboxesWithSkipped(mailboxes: unknown, domain: string, generatePassword = false): { boxes: ResolvedMailbox[], skipped: string[] } {
  if (!Array.isArray(mailboxes))
    return { boxes: [], skipped: [] }
  const out: ResolvedMailbox[] = []
  const skipped: string[] = []
  for (const entry of mailboxes) {
    let raw: string | undefined
    let explicitPw: string | undefined
    if (typeof entry === 'string')
      raw = entry
    else if (entry && typeof entry === 'object') {
      raw = (entry).email ?? (entry).username
      explicitPw = (entry).password
      if ((entry).generate === true)
        generatePassword = true
    }
    if (!raw || typeof raw !== 'string')
      continue
    const localPart = (raw.includes('@') ? raw.split('@')[0] ?? '' : raw).trim()
    if (!localPart)
      continue
    const address = `${localPart}@${domain}`
    const envKey = `MAIL_PASSWORD_${localPart.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
    const envPw = explicitPw || process.env[envKey]
    // Only provision a mailbox whose password is explicitly supplied (config
    // object or MAIL_PASSWORD_<LOCALPART> env). A routine deploy must never
    // conjure random-password mailboxes the operator never asked for and can't
    // retrieve — declare the password to opt a mailbox in.
    //
    // `generate: true` IS that declaration. The objection above is retrieval,
    // not randomness: a generated password the operator can never read is a
    // mailbox nobody can open. So a generated one is written straight back to
    // the environment file as MAIL_PASSWORD_<LOCALPART>, encrypted, before it
    // is used — which also makes the next deploy a no-op instead of a rotation.
    if (!envPw) {
      if (generatePassword) {
        out.push({
          address,
          localPart: localPart.toUpperCase(),
          password: generateMailboxPassword(),
          generated: true,
        })
        continue
      }
      skipped.push(address)
      continue
    }
    out.push({ address, localPart: localPart.toUpperCase(), password: envPw, generated: false })
  }
  return { boxes: out, skipped }
}

/** What a mail-tenant reconcile resolved + provisioned, for the DNS step. */
export interface MailTenantResult {
  domain: string
  /** The mail server's own hostname (SMTP_HOSTNAME) — the MX target. */
  mailHost: string
  /**
   * base64(DER) of the public half of the key the mail server will actually
   * sign this domain's outbound mail with — which is the domain's own key only
   * when it is not also the server's global `DKIM_DOMAIN`. See the provisioning
   * script's DKIM step.
   */
  dkimPubB64?: string
  /**
   * The selector that key signs under, published as `<selector>._domainkey`.
   * Per-domain keys use `mail`; a domain that collides with the global signer
   * inherits its `DKIM_SELECTOR`, which need not be `mail`.
   */
  dkimSelector?: string
  /** Mailboxes newly created this run (address + password), for reporting. */
  created: Array<{ address: string, password: string }>
}

/**
 * Mail tenancy is an explicit deployment capability. The merged Stacks config
 * always contains framework email defaults, so checking `emailConfig` alone
 * would register the framework's own default domain for every application that
 * does not provide `config/email.ts`.
 */
export function hasExplicitEmailConfig(projectRoot = p.projectPath()): boolean {
  return existsSync(join(projectRoot, 'config', 'email.ts'))
}

export function mailServerOwnerFromConfig(config: { server?: { attachTo?: unknown } } | null | undefined): string | undefined {
  const owner = config?.server?.attachTo
  return typeof owner === 'string' && owner.trim() ? owner.trim() : undefined
}

async function cleanupDetachedMailHealth(ip: string, logger: typeof log): Promise<void> {
  const { execSync } = await import('node:child_process')
  const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', `root@${ip}`]
  const script = `set -e
if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx mail.service; then
  exit 0
fi
systemctl disable --now mail-health.timer >/dev/null 2>&1 || true
systemctl stop mail-health.service >/dev/null 2>&1 || true
systemctl reset-failed mail-health.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/mail-health.service /etc/systemd/system/mail-health.timer
rm -f /usr/local/sbin/mail-health-check /etc/systemd/system/mail.service.d/reliability.conf
rmdir /etc/systemd/system/mail.service.d 2>/dev/null || true
systemctl daemon-reload
systemctl reset-failed`

  try {
    execSync(`ssh ${sshArgs.map(a => `'${a}'`).join(' ')} bash -s`, {
      input: script,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    logger.success('Mail: removed the detached health timer from the application box')
  }
  catch (err) {
    logger.warn(`Mail: could not remove the detached health timer: ${getErrorMessage(err)}`)
  }
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
 *   4. `config.email.forwards` → merged into `forwards.json` and compiled to
 *      RFC 5228 `forwards.sieve` (live-reloaded).
 *
/**
 * The Hetzner token, resolved the same way everywhere.
 *
 * `deployToHetzner` accepted `hetzner.apiToken` from the config or either env
 * var, while `resolveAttachTargetBox` read only `process.env.HCLOUD_TOKEN`. A
 * project that configured the token in `config/cloud.ts`, or set only
 * `HETZNER_API_TOKEN`, therefore passed the token check at the top of the deploy
 * and then failed attach resolution with no request made and no reason given
 * (stacksjs/stacks#2344). One resolver, so the two cannot drift again.
 */
export function resolveHetznerApiToken(tsCloudConfig?: TsCloudConfig): string | undefined {
  return tsCloudConfig?.hetzner?.apiToken || process.env.HCLOUD_TOKEN || process.env.HETZNER_API_TOKEN
}

/**
 * A shared box as the Hetzner API just described it.
 *
 * Distinct from {@link AttachedComputeBox}, which is the persisted pin: that one
 * is validated on read and so guarantees a `publicIp`, whereas a live lookup can
 * legitimately turn up a server that has no IPv4 yet. Collapsing the two would
 * mean either lying about the pin or re-checking it at every use.
 */
export interface AttachTargetBox {
  serverId: number
  serverName: string
  publicIp?: string
  publicIpv6?: string
}

/**
 * Why an attach lookup produced no box.
 *
 * These three were previously indistinguishable: every one of them ended as an
 * empty array, and the caller reported the same "is it provisioned?" for all of
 * them. Only `no-match` actually justifies that question.
 */
export type AttachLookupFailure =
  | { kind: 'no-token' }
  | { kind: 'request-failed', status: number, detail?: string }
  | { kind: 'no-match' }

export interface AttachLookupResult {
  box: AttachTargetBox | null
  failure?: AttachLookupFailure
}

/**
 * What to tell the operator when no box came back.
 *
 * The old message named one cause for four conditions: "Is
 * '<owner>-<env>-app' provisioned (by its owner)?" A missing token, a 401, and a
 * network error all printed that, while the box sat there running, which is how
 * this became a multi-hour diagnosis rather than a one-line one. Each cause now
 * gets its own answer, and the provisioning question is only asked when nothing
 * matched.
 */
export function describeAttachLookupFailure(
  owner: string,
  environment: string,
  failure: AttachLookupFailure | undefined,
): string {
  if (failure?.kind === 'no-token') {
    return `Attach target '${owner}': no Hetzner API token to look it up with, so no lookup was attempted. `
      + `Set HCLOUD_TOKEN (or HETZNER_API_TOKEN, or hetzner.apiToken in config/cloud.ts).`
  }

  if (failure?.kind === 'request-failed') {
    const where = failure.status > 0 ? `returned HTTP ${failure.status}` : 'could not be reached'
    return `Attach target '${owner}': the Hetzner API ${where}, so whether the box exists is unknown.`
      + (failure.detail ? ` ${failure.detail}` : '')
      + (failure.status === 401 || failure.status === 403
        ? ' That is an auth failure, not a missing server: check the token is valid for this Hetzner project.'
        : '')
  }

  return `Attach target '${owner}' has no reachable box for '${environment}'. `
    + `Nothing matched ts-cloud/project=${owner},ts-cloud/environment=${environment},ts-cloud/role=app, `
    + `and no server is named '${owner}-${environment}-app'. Is it provisioned (by its owner)?`
}

/**
 * Resolve the shared box owned by another project (`cloud.attachTo`) so this
 * project can deploy its sites onto it without provisioning. Looks the box up
 * by the owner's ts-cloud labels (`ts-cloud/project=<owner>`,
 * `environment=<env>`, `role=app`) - the same labels ts-cloud stamps on every
 * app server - falling back to the conventional `<owner>-<env>-app` name. Needs
 * only read access via the Hetzner token.
 *
 * Returns why it found nothing, rather than just nothing. Every failure used to
 * collapse into an empty array inside `req()`: a 401, a network error and a
 * genuinely empty result were indistinguishable, and none were logged.
 */
export async function resolveAttachTargetBox(
  owner: string,
  environment: string,
  tsCloudConfig?: any,
): Promise<AttachLookupResult> {
  const token = resolveHetznerApiToken(tsCloudConfig)
  if (!token)
    return { box: null, failure: { kind: 'no-token' } }

  const pick = (servers: any[]): any | undefined =>
    servers.find(s => s?.status !== 'off' && s?.public_net?.ipv4?.ip) || servers[0]

  // Kept from the FIRST failing request: by the time the name fallback also
  // comes back empty, the label query's 401 is the more useful thing to report.
  let requestFailure: AttachLookupFailure | undefined

  const req = async (qs: string): Promise<any[]> => {
    try {
      const res = await fetch(`https://api.hetzner.cloud/v1/servers?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        requestFailure ??= { kind: 'request-failed', status: res.status, detail: pollFailureDetail(body) }
        return []
      }
      return ((await res.json())).servers || []
    }
    catch (err) {
      // status 0: the request never got an answer at all.
      requestFailure ??= { kind: 'request-failed', status: 0, detail: pollFailureDetail(getErrorMessage(err)) }
      return []
    }
  }

  // Label match first (robust to renames), then the conventional name.
  const byLabel = await req(`label_selector=${encodeURIComponent(`ts-cloud/project=${owner},ts-cloud/environment=${environment},ts-cloud/role=app`)}`)
  const chosen = pick(byLabel) || pick(await req(`name=${encodeURIComponent(`${owner}-${environment}-app`)}`))
  if (!chosen)
    return { box: null, failure: requestFailure ?? { kind: 'no-match' } }

  // Hetzner reports the routed block (`2a01:4f8:c014:6186::/64`), not the
  // address the interface holds - normalizePublicIpv6 narrows it to something
  // an AAAA record can actually point at.
  //
  // This used to call `hetznerBoxIpv6?.(…)`, a name ts-cloud no longer exports.
  // The optional call turned that into `undefined` silently, so every attached
  // tenant resolved no IPv6, the AAAA pass was skipped, and the whole shared box
  // quietly served IPv4 only - with nothing in the deploy log to say so. The
  // call is unconditional now, and a missing export warns instead of vanishing.
  const { normalizePublicIpv6 } = await import('@stacksjs/ts-cloud')
  if (typeof normalizePublicIpv6 !== 'function')
    log.warn('DNS: @stacksjs/ts-cloud does not export normalizePublicIpv6 - AAAA records will be skipped. Upgrade ts-cloud.')
  const reportedIpv6 = chosen.public_net?.ipv6?.ip
  return {
    box: {
      serverId: chosen.id,
      serverName: chosen.name,
      publicIp: chosen.public_net?.ipv4?.ip,
      publicIpv6: typeof normalizePublicIpv6 === 'function' ? normalizePublicIpv6(reportedIpv6) : undefined,
    },
  }
}

/**
 * Everything is MERGE-based so a shared mail server keeps every other tenant's
 * domains, keys, users, and forward rules untouched. Best-effort — a hiccup is
 * logged, never fails the release. Returns what the DNS step needs (mail host +
 * DKIM public key), or null when there is nothing to reconcile / it failed.
 */
export async function provisionMailTenant(ip: string, logger: typeof log): Promise<MailTenantResult | null> {
  if (!hasExplicitEmailConfig())
    return null

  const cfg: any = emailConfig || {}
  // Mail explicitly disabled for this app (config/email.ts `server.enabled:
  // false`): skip the shared-mail tenant reconcile entirely — no local-domain
  // registration, DKIM key, mailboxes, or mail DNS. Without this gate the
  // reconcile keyed off `cfg.domain`/`from.address` alone, so an app with no
  // mail intent still mutated the SHARED mail server + its own MX records.
  if (cfg.server?.enabled === false)
    return null

  const domain: string | undefined = cfg.domain
    || (typeof cfg.from?.address === 'string' && cfg.from.address.includes('@') ? cfg.from.address.split('@')[1] : undefined)
  const declaredForwards: Record<string, string[]> = (cfg.forwards && typeof cfg.forwards === 'object') ? cfg.forwards : {}

  /*
   * An alias with no mailbox of its own needs its bare local part as the key.
   *
   * The server looks a forward up by the mailbox it delivered to: the full
   * address when that address is a registered mailbox, and the bare local
   * part when it is not. So `'akki@example.com': ['someone@example.com']`
   * — the obvious way to write an alias — silently did nothing, and the mail
   * piled up in a mailbox nobody reads.
   *
   * Both keys are written for an address that has no declared mailbox. The
   * bare one is not domain-scoped, so it is only added when nothing else has
   * claimed it: on a shared server another tenant may already own that local
   * part.
   */
  const forwards: Record<string, string[]> = { ...declaredForwards }
  const declaredBoxes = new Set(domain ? resolveMailboxes(cfg.mailboxes, domain).map(b => b.address) : [])
  for (const [key, targets] of Object.entries(declaredForwards)) {
    const at = key.indexOf('@')
    if (at === -1 || declaredBoxes.has(key))
      continue

    const localPart = key.slice(0, at)
    if (key.slice(at + 1) !== domain || forwards[localPart])
      continue

    forwards[localPart] = targets
  }
  const hasForwards = Object.keys(forwards).length > 0
  // `email.server.generatePasswords: true` opts every declared mailbox into a
  // generated password, so a project does not have to invent five secrets by
  // hand before its first deploy can create the addresses it already declared.
  // Each one is persisted (encrypted) below, which is what makes it safe.
  const generatePasswords = cfg.server?.generatePasswords === true
  const resolved = domain ? resolveMailboxesWithSkipped(cfg.mailboxes, domain, generatePasswords) : { boxes: [], skipped: [] }
  const boxes = resolved.boxes

  // Persist generated passwords BEFORE provisioning uses them.
  //
  // A generated credential nobody can read is a mailbox nobody can open, and
  // one that is regenerated every deploy silently rotates the password out
  // from under every configured client. Writing it back to .env.production
  // encrypted fixes both: it is retrievable, and the next deploy reads it back
  // as an explicit password and changes nothing.
  const generated = boxes.filter(box => box.generated)
  if (generated.length > 0) {
    try {
      const { setEnv } = await import('@stacksjs/env')
      for (const box of generated) {
        await setEnv(`MAIL_PASSWORD_${box.localPart.replace(/[^A-Z0-9]/g, '_')}`, box.password, {
          file: '.env.production',
          // No `encrypt` option: `setEnv` encrypts by default and `plain: true`
          // is how you opt OUT. Passing `encrypt` did not typecheck, and would
          // have been a no-op if it had - the value was already written
          // encrypted, which is what the log line below promises.
        })
      }
      logger.success(`Mail: generated and saved ${generated.length} mailbox password(s) to .env.production (encrypted)`)
    }
    catch (err) {
      logger.warn(`Mail: could not save the generated password(s) to .env.production - they are printed below and will otherwise be regenerated next deploy: ${getErrorMessage(err)}`)
    }
  }

  // Said out loud. A mailbox declared in config and not created is the sort of
  // thing somebody discovers weeks later, when the address they printed on a
  // website turns out to bounce.
  if (resolved.skipped.length > 0) {
    logger.warn(`Mail: ${resolved.skipped.length} declared mailbox(es) were not created because no password was supplied: ${resolved.skipped.join(', ')}`)
    logger.info(`Set MAIL_PASSWORD_<LOCALPART> in the target environment (e.g. ${resolved.skipped[0]?.split('@')[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '_')}) and run this again.`)
  }

  // Nothing declarative to reconcile — skip silently (most apps).
  if (!domain && !hasForwards)
    return null

  const { execSync } = await import('node:child_process')
  const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', `root@${ip}`]

  // Compact forwarding manifest, base64'd so it survives the SSH shell hop.
  const forwardsB64 = hasForwards ? Buffer.from(JSON.stringify(forwards)).toString('base64') : ''
  const readme = 'Auto-forwarding rules, re-read on every message (edits take effect immediately, no restart). '
    + 'KEY = the delivered mailbox: the FULL address for per-domain isolated mailboxes (e.g. no-reply@app.com), '
    + 'or a bare local-part for legacy role mailboxes. VALUE = list of destination addresses; targets on a local '
    + 'domain are written straight to that mailbox Maildir, external targets are relayed. Managed by buddy deploy '
    + 'from config/email.ts (merge-based - hand edits to other keys are preserved).'
  const readmeB64 = Buffer.from(readme).toString('base64')
  // address<TAB>password per mailbox, base64'd as one blob for the shell hop.
  //
  // The trailing newline matters: `while read` returns non-zero on a final
  // line with no terminator and leaves the loop before the body runs, so the
  // LAST mailbox in config/email.ts was silently never created. It reported
  // success either way, because the caller only counts the MADE lines.
  const boxesB64 = boxes.length ? Buffer.from(`${boxes.map(b => `${b.address}\t${b.password}`).join('\n')}\n`).toString('base64') : ''

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
MAIL_DB_PATH="$(grep -E '^SMTP_DB_PATH=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- || true)"
[ -z "$MAIL_DB_PATH" ] && MAIL_DB_PATH=/opt/mail/smtp.db
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
# 2) DKIM: decide which key signs THIS domain, then register and publish that
#    one key. Read the server's global signer first, because it wins.
#
#    mail's \`configureDkim\` registers the DKIM_DOMAIN signer before any
#    DKIM_EXTRA_KEYS entry and *silently drops* an entry for a domain that
#    already has one. So for the domain that IS DKIM_DOMAIN, the global key
#    signs and nothing this script generates is ever used.
#
#    This used to generate a per-domain key anyway and register it anyway,
#    leaving a dead 2048-bit key on disk, an inert env entry, and a warning on
#    every deploy that no action could clear. Worse, the entry named a key
#    whose public half was never published: the moment DKIM_DOMAIN moved to
#    another domain, this entry would start signing with a key no record
#    matched, and every message would fail DKIM with nothing in the logs.
#    Registering the key that actually signs makes the handover a no-op.
if [ -n "$DOMAIN" ] && [ -f "$ENVF" ]; then
  mkdir -p "$DKIMDIR"
  gdom=$(grep -E '^DKIM_DOMAIN=' "$ENVF" | head -1 | cut -d= -f2- || true)
  gkey=$(grep -E '^DKIM_PRIVATE_KEY_PATH=' "$ENVF" | head -1 | cut -d= -f2- || true)
  gsel=$(grep -E '^DKIM_SELECTOR=' "$ENVF" | head -1 | cut -d= -f2- || true)
  PERDOMAIN_KEY="$DKIMDIR/$DOMAIN.private"

  if [ -n "$gdom" ] && [ "$gdom" = "$DOMAIN" ] && [ -n "$gkey" ] && [ -f "$gkey" ]; then
    KEY="$gkey"
    SEL="\${gsel:-mail}"
    echo "DKIMGLOBAL:$KEY"
    # An earlier deploy may have left the unused per-domain key behind. Say
    # where it is; removing a private key is the operator's call, not ours.
    [ -f "$PERDOMAIN_KEY" ] && echo "DKIMSTALE:$PERDOMAIN_KEY"
  else
    KEY="$PERDOMAIN_KEY"
    SEL=mail
    if [ ! -f "$KEY" ]; then
      openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEY" 2>/dev/null
      chown mail-server:mail-server "$KEY" 2>/dev/null || true
      chmod 600 "$KEY" 2>/dev/null || true
    fi
  fi

  # Register the effective key, replacing any earlier entry for this domain
  # (which may name the dead per-domain file). Rebuilt as a list rather than
  # appended, so the domain can never hold two entries.
  ex=$(grep -E '^DKIM_EXTRA_KEYS=' "$ENVF" | head -1 | cut -d= -f2- || true)
  ENTRY="$DOMAIN:$SEL:$KEY"
  # Split on commas with IFS and glob-match the domain. A tr/grep pipeline is
  # the obvious way to write this and the wrong one here: the separator would
  # have to be a newline written as \\n inside a JS template literal, and the
  # domain would become a regex whose dots match anything.
  OTHERS=""
  OLDIFS="$IFS"
  IFS=','
  for entry in $ex; do
    case "$entry" in
      "$DOMAIN:"*|"") : ;;
      *) OTHERS="\${OTHERS:+$OTHERS,}$entry" ;;
    esac
  done
  IFS="$OLDIFS"
  NEWEX="\${OTHERS:+$OTHERS,}$ENTRY"
  if [ "$NEWEX" != "$ex" ]; then
    if grep -qE '^DKIM_EXTRA_KEYS=' "$ENVF"; then
      sed -i "s|^DKIM_EXTRA_KEYS=.*|DKIM_EXTRA_KEYS=$NEWEX|" "$ENVF"
    else
      echo "DKIM_EXTRA_KEYS=$NEWEX" >> "$ENVF"
    fi
    ENV_CHANGED=1
  fi

  echo "DKIMSEL:$SEL"
  echo "DKIMPUB:$(openssl rsa -in "$KEY" -pubout -outform DER 2>/dev/null | base64 -w0)"
fi
# 3) Create the configured mailboxes as per-domain isolated users (skip existing).
if [ -n "$BOXES_B64" ] && [ -x "$MS" ]; then
  echo "$BOXES_B64" | base64 -d | while IFS=$'\t' read -r addr pw; do
    [ -z "$addr" ] && continue
    # NOTE: 'user:local info' exits 0 even when the user is absent (it only
    # prints "not found"), so existence is decided from the OUTPUT, not $?.
    if SMTP_DB_PATH="$MAIL_DB_PATH" "$MS" user:local info "$addr" 2>&1 | grep -qi 'not found'; then
      legacy="\${addr%%@*}"
      # Older single-domain installs used a bare username whose email is this
      # full address. Creating the isolated address then hits users.email's
      # UNIQUE constraint while the CLI still exits zero. Perform mail's
      # documented username migration transactionally, including every
      # username-keyed table, before falling back to a true create.
      migrated=$(MAIL_DB_PATH="$MAIL_DB_PATH" OLD_USERNAME="$legacy" NEW_USERNAME="$addr" /usr/local/bin/bun --bun -e '
        const { Database } = require("bun:sqlite")
        const db = new Database(process.env.MAIL_DB_PATH)
        const oldName = process.env.OLD_USERNAME
        const newName = process.env.NEW_USERNAME
        const oldUser = db.query("SELECT 1 AS found FROM users WHERE username=? AND email=?").get(oldName, newName)
        const newUser = db.query("SELECT 1 AS found FROM users WHERE username=?").get(newName)
        if (oldUser && !newUser) {
          db.transaction(() => {
            for (const table of ["users", "imap_mailboxes", "imap_uids", "webmail_sessions"])
              db.query("UPDATE " + table + " SET username=? WHERE username=?").run(newName, oldName)
          })()
          process.stdout.write("yes")
        }
        db.close()
      ' 2>/dev/null || true)
      if [ "$migrated" = yes ]; then
        if [ -d "/opt/mail/mail/$legacy" ] && [ ! -e "/opt/mail/mail/$addr" ]; then
          mv -- "/opt/mail/mail/$legacy" "/opt/mail/mail/$addr"
          chown -R mail-server:mail-server "/opt/mail/mail/$addr"
        fi
        # The declared config password becomes authoritative after migration.
        SMTP_DB_PATH="$MAIL_DB_PATH" "$MS" user:local change-password "$addr" "$pw" >/dev/null 2>&1 || true
      else
        # The CLI action historically returned zero even when an internal
        # create failed. Pin the live DB for both calls and verify the row.
        SMTP_DB_PATH="$MAIL_DB_PATH" "$MS" user:local create "$addr" "$pw" "$addr" >/dev/null 2>&1 || true
      fi
      if SMTP_DB_PATH="$MAIL_DB_PATH" "$MS" user:local info "$addr" 2>&1 | grep -qi 'not found'; then
        echo "FAIL:$addr"
      elif [ "$migrated" = yes ]; then
        echo "MIGRATED:$addr"
      else
        echo "MADE:$addr"
      fi
    else
      echo "EXISTS:$addr"
    fi
  done
fi
# 3b) Put the tenant's own mail hostname on the mail certificate.
#
# A person setting up Mail.app types mail.<their domain>, not the shared host.
# Without that name on the certificate the client says "unable to verify
# account name or password", which sounds like a wrong password and is really
# a wrong hostname.
#
# acme:renew cannot do this: it renews an existing certificate with the SAN
# list already inside it and skips names that have no certificate file of
# their own. Adding a name takes an acme:issue for the union of the names
# already on the certificate plus this one.
#
# --cert-name pins where that union lands. Without it tlsx names the output
# after the FIRST --domains entry, and $CURRENT is read back from the
# certificate, where openssl prints the SANs sorted. So the union was written
# to whichever hostname sorted first (autodiscover.chrisbreuer.me, on the box
# this was found on) while the mail server went on reading the untouched
# mail.stacksjs.com.crt. The issuance succeeded, the deploy reported success,
# and the certificate was correct - just not in the file anyone was serving.
#
# Nothing is appended to the scheduled renewal script, deliberately. The
# renewal renews mail.stacksjs.com.crt using the SAN list inside that file, so
# a name added here is renewed by construction. The previous code tried to
# splice the hostname into that script's --domains list with
#   sed -i "s|acme:renew -d \"|..."
# whose quotes close before the | in the JS template literal, leaving sed the
# unterminated expression 's|acme:renew -d ' and a shell pipe. That aborted the
# whole mail step. Adding names there was never necessary and, until tlsx
# renewed in place, was actively harmful: each extra name made the renewal open
# another certificate file, and two files sharing a CN meant one overwrote the
# other.
#
# The CLI is resolved rather than hardcoded. This step used to run
# 'cd /opt/tlsx && bun run packages/tlsx/bin/cli.ts', which requires a source
# checkout at one exact path and silently does nothing when it is absent -
# there is no other way to satisfy the guard. On the box this was found on, that
# checkout had been pinned to a two-month-old tag nobody was updating, so the
# deploy kept invoking a build whose renewal logic had a known data-loss bug.
# Preferring an installed 'tlsx' on PATH lets a package manager own the version;
# the checkout stays as the fallback so existing boxes keep working.
tlsx_cli() {
  if command -v tlsx >/dev/null 2>&1; then
    tlsx "$@"
  else
    (cd /opt/tlsx && /usr/local/bin/bun run packages/tlsx/bin/cli.ts "$@")
  fi
}
have_tlsx() {
  command -v tlsx >/dev/null 2>&1 || { [ -x /usr/local/bin/bun ] && [ -f /opt/tlsx/packages/tlsx/bin/cli.ts ]; }
}
CERTFILE=/etc/bun-gateway/certs/mail.stacksjs.com.crt
if [ -n "$DOMAIN" ] && [ -f "$CERTFILE" ] && have_tlsx; then
  MAILHOSTNAME="mail.$DOMAIN"
  CERTNAME=$(basename "$CERTFILE" .crt)
  CERTKEY=/etc/bun-gateway/certs/mail.stacksjs.com.key
  CURRENT=$(openssl x509 -in "$CERTFILE" -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name' | tail -1 | tr -d ' ' | sed 's/DNS://g')
  case ",$CURRENT," in
    *",$MAILHOSTNAME,"*) : ;;
    *)
      ALL="$CURRENT,$MAILHOSTNAME"
      # acme:issue overwrites the certificate in place, so keep a copy: this is
      # a certificate other tenants are served from, and a partial result must
      # not be what they get.
      SAFE=$(mktemp -d)
      cp -a "$CERTFILE" "$SAFE/cert" 2>/dev/null || true
      cp -a "$CERTKEY" "$SAFE/key" 2>/dev/null || true
      if tlsx_cli acme:issue -d "$ALL" --cert-name "$CERTNAME" --method http-01 --webroot /var/www/acme-challenge --dir /etc/bun-gateway/certs --prod >/tmp/.mailtenant-cert 2>&1; then
        # Verify rather than assume. The old code reported CERTHOST on a zero
        # exit alone, which is how an issuance that wrote somewhere else was
        # reported as "added to the mail certificate" for weeks.
        UPDATED=$(openssl x509 -in "$CERTFILE" -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name' | tail -1 | tr -d ' ' | sed 's/DNS://g')
        MISSING=
        for n in $(echo "$ALL" | tr ',' ' '); do
          case ",$UPDATED," in *",$n,"*) : ;; *) MISSING="$MISSING $n" ;; esac
        done
        if [ -n "$MISSING" ]; then
          [ -f "$SAFE/cert" ] && cp -a "$SAFE/cert" "$CERTFILE"
          [ -f "$SAFE/key" ] && cp -a "$SAFE/key" "$CERTKEY"
          echo "CERTFAIL:issued certificate does not carry$MISSING - previous certificate kept"
        else
          install -m 644 "$CERTFILE" /etc/letsencrypt/live/mail.stacksjs.com/fullchain.pem
          install -m 640 -g mail-server "$CERTKEY" /etc/letsencrypt/live/mail.stacksjs.com/privkey.pem
          systemctl restart mail || true
          echo "CERTHOST:$MAILHOSTNAME"
        fi
      else
        echo "CERTFAIL:$(tail -c 200 /tmp/.mailtenant-cert | tr '\\n' ' ')"
      fi
      rm -rf "$SAFE"
      rm -f /tmp/.mailtenant-cert
      ;;
  esac
fi
# 4) Merge auto-forward rules and compile the canonical RFC 5228 runtime script
# (live-reloaded; no restart).
if [ -n "$FWD_B64" ] && [ -x /usr/local/bin/bun ]; then
  echo "$FWD_B64" | base64 -d > /tmp/.mailtenant-fwd.json
  echo "$README_B64" | base64 -d > /tmp/.mailtenant-readme.txt
  # \`let\`, not \`const\`: both of these were const with an assignment inside a
  # try, which Bun rejects at parse time ("this assignment will throw because
  # X is a constant"). The whole snippet therefore never ran, stderr was sent
  # to /dev/null, and every reconcile since has reported forwards=nochange
  # while forwards.json sat untouched.
  /usr/local/bin/bun --bun -e '
    const fs=require("fs"); const f="/opt/mail/forwards.json";
    let cur={}; try{cur=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}
    const add=JSON.parse(fs.readFileSync("/tmp/.mailtenant-fwd.json","utf8"));
    const readme=fs.readFileSync("/tmp/.mailtenant-readme.txt","utf8");
    const merged={...cur}; delete merged._readme;
    for(const [k,v] of Object.entries(add)) merged[k]=v;
    const out={_readme:readme,...merged};
    const s=JSON.stringify(out,null,2)+"\\n";
    let prev=""; try{prev=fs.readFileSync(f,"utf8")}catch{}
    if(s!==prev){ fs.writeFileSync(f,s); process.stdout.write("FWDCHANGED"); }
  ' > /tmp/.mailtenant-res 2>/tmp/.mailtenant-err || true
# A merge that failed is worth one line, not silence: the rules decide where
# mail goes.
if [ -s /tmp/.mailtenant-err ]; then echo "FWDERR:$(head -c 200 /tmp/.mailtenant-err | tr '\\n' ' ')"; fi
rm -f /tmp/.mailtenant-err
  chown mail-server:mail-server "$FJSON" 2>/dev/null || true
  chmod 644 "$FJSON" 2>/dev/null || true
  if [ -x /usr/local/sbin/mail-forward-compile ]; then
    if ! /usr/local/sbin/mail-forward-compile "$FJSON" /opt/mail/forwards.sieve 2>/tmp/.mailtenant-sieve-err; then
      echo "SIEVEERR:$(head -c 200 /tmp/.mailtenant-sieve-err | tr '\\n' ' ')"
    fi
    rm -f /tmp/.mailtenant-sieve-err
  fi
  rm -f /tmp/.mailtenant-fwd.json /tmp/.mailtenant-readme.txt
fi
FWD_STATE=nochange; grep -q FWDCHANGED /tmp/.mailtenant-res 2>/dev/null && FWD_STATE=updated; rm -f /tmp/.mailtenant-res
# 5) Keep the shared daemon recoverable if it crashes or stops accepting mail.
mkdir -p /etc/systemd/system/mail.service.d
cat > /etc/systemd/system/mail.service.d/reliability.conf <<'EOF'
[Unit]
StartLimitIntervalSec=60
StartLimitBurst=10

[Service]
Restart=always
RestartSec=2
TimeoutStartSec=30
TimeoutStopSec=30
LimitCORE=infinity
EOF
cat > /usr/local/sbin/mail-health-check <<'EOF'
#!/bin/sh
set -eu
exec 9>/run/mail-health-check.lock
flock -n 9 || exit 0
systemctl is-active --quiet mail || { systemctl restart mail; exit 0; }
for port in 25 143 587 993; do
  ss -H -ltn "sport = :$port" | grep -q . || {
    logger -t mail-health "required TCP port $port is not listening; restarting mail"
    systemctl restart mail
    exit 0
  }
done
EOF
chmod 755 /usr/local/sbin/mail-health-check
cat > /etc/systemd/system/mail-health.service <<'EOF'
[Unit]
Description=Check the Stacks mail daemon listeners
After=mail.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/mail-health-check
EOF
cat > /etc/systemd/system/mail-health.timer <<'EOF'
[Unit]
Description=Check the Stacks mail daemon every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now mail-health.timer >/dev/null 2>&1
# 6) Restart only when the startup-read env actually changed (domain or DKIM key).
if [ "$ENV_CHANGED" = 1 ]; then systemctl restart mail 2>/dev/null || true; echo "MAILTENANT:env-changed+restarted,forwards=$FWD_STATE"; else echo "MAILTENANT:current,forwards=$FWD_STATE"; fi`

  try {
    const out = execSync(`ssh ${sshArgs.map(a => `'${a}'`).join(' ')} bash -s`, {
      input: script,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const line = (out.match(/MAILTENANT:[^\n]*/) || [])[0] || 'MAILTENANT:done'
    const mailHostFromOut = (out.match(/MAILHOST:([^\n]*)/) || [])[1]?.trim()
    const mailHost = mailHostFromOut || `mail.${domain}`
    const dkimPubB64 = (out.match(/DKIMPUB:([^\n]*)/) || [])[1]?.trim() || undefined
    const dkimSelector = (out.match(/DKIMSEL:([^\n]*)/) || [])[1]?.trim() || undefined

    // This domain is the server's global DKIM_DOMAIN, so the mail daemon signs
    // it with the global key; the script registers and publishes that same key
    // rather than minting a second one. Stating which key signs is useful (it
    // is the one to rotate); it is not a warning, because there is nothing to
    // fix — that used to fire on every deploy with no action that could clear
    // it, which is how a log trains people to ignore it.
    const dkimGlobalKey = (out.match(/DKIMGLOBAL:([^\n]*)/) || [])[1]?.trim()
    if (dkimGlobalKey)
      logger.info(`Mail: ${domain} signs with the server's global DKIM key (${dkimGlobalKey}) — rotate that one.`)

    // A dead per-domain key from before the above: nothing reads it, and it is
    // a private key sitting on disk. Removing one is the operator's call.
    const dkimStaleKey = (out.match(/DKIMSTALE:([^\n]*)/) || [])[1]?.trim()
    if (dkimStaleKey)
      logger.warn(`Mail: ${dkimStaleKey} is an unused DKIM key left by an earlier deploy — nothing signs with it. Remove it with: rm ${dkimStaleKey}`)
    const madeAddrs = new Set([...out.matchAll(/MADE:([^\n]+)/g)].flatMap(m => m[1] ? [m[1].trim()] : []))
    const migratedAddrs = new Set([...out.matchAll(/MIGRATED:([^\n]+)/g)].flatMap(m => m[1] ? [m[1].trim()] : []))
    const created = boxes.filter(b => madeAddrs.has(b.address)).map(b => ({ address: b.address, password: b.password }))

    logger.success(`Mail routing reconciled (${line.replace('MAILTENANT:', '')})`)

    // A mailbox the server refused is worth saying out loud. This used to be
    // swallowed: only MADE lines were read, so a declared mailbox that never
    // appeared looked exactly like one that already existed.
    const failed = [...out.matchAll(/FAIL:([^\n]+)/g)].flatMap(m => m[1] ? [m[1].trim()] : [])
    if (failed.length)
      logger.warn(`Mail: the server refused ${failed.length} mailbox(es): ${failed.join(', ')}`)

    const forwardError = (out.match(/FWDERR:([^\n]*)/) || [])[1]?.trim()
    if (forwardError)
      logger.warn(`Mail: the forward rules were not merged: ${forwardError}`)

    const certHost = (out.match(/CERTHOST:([^\n]*)/) || [])[1]?.trim()
    if (certHost)
      logger.success(`Mail: ${certHost} added to the mail certificate - clients can use it as the server name`)

    const certError = (out.match(/CERTFAIL:([^\n]*)/) || [])[1]?.trim()
    if (certError)
      logger.warn(`Mail: could not issue a certificate for mail.${domain} (clients should use ${mailHostFromOut || 'the shared mail host'}): ${certError}`)

    // Declared, not created, not reported as existing: the reconcile never
    // saw it. Silence here is how a missing mailbox reaches production.
    const seen = new Set([...madeAddrs, ...migratedAddrs, ...[...out.matchAll(/EXISTS:([^\n]+)/g)].flatMap(m => m[1] ? [m[1].trim()] : [])])
    const unaccounted = boxes.filter(b => !seen.has(b.address)).map(b => b.address)
    if (unaccounted.length)
      logger.warn(`Mail: ${unaccounted.length} declared mailbox(es) were not reconciled: ${unaccounted.join(', ')}`)

    if (created.length) {
      logger.info(`Mail: created ${created.length} mailbox(es) - credentials below (save them; shown once):`)
      for (const b of created)
        logger.info(`  ${b.address}  ${b.password}`)
    }
    if (migratedAddrs.size)
      logger.success(`Mail: migrated ${migratedAddrs.size} legacy mailbox username(s) to isolated full addresses`)
    return domain ? { domain, mailHost, dkimPubB64, dkimSelector, created } : null
  }
  catch (err) {
    // Never fail a release on a mail-reconcile hiccup — it's additive config.
    logger.warn(`Mail routing reconcile skipped: ${getErrorMessage(err)}`)
    return null
  }
}

/**
 * Candidate DNS provider configs, built from whatever credentials the
 * environment carries. Shared by every DNS path in a deploy so they agree on
 * which registrars are usable — mail DNS used to read `PORKBUN_API_KEY`
 * directly and was therefore the one path that could not publish to a Route53,
 * Cloudflare or GoDaddy zone.
 */
/**
 * One registrar's credentials, as this deploy builds them from the
 * environment. The credential fields differ per provider, so each is optional
 * and `provider` is what says which of them to expect.
 */
export interface DnsProviderConfig {
  provider: 'porkbun' | 'cloudflare' | 'godaddy' | 'route53'
  apiKey?: string
  secretKey?: string
  apiToken?: string
  apiSecret?: string
  environment?: string
}

/** The env vars each DNS provider needs, for messages that name the fix. */
const DNS_PROVIDER_CREDENTIALS: Record<string, string[]> = {
  porkbun: ['PORKBUN_API_KEY', 'PORKBUN_SECRET_KEY'],
  cloudflare: ['CLOUDFLARE_API_TOKEN'],
  godaddy: ['GODADDY_API_KEY', 'GODADDY_API_SECRET'],
  route53: ['AWS_ACCESS_KEY_ID (or AWS_PROFILE)'],
}

/**
 * The DNS provider the project declared, if any.
 *
 * `config/cloud.ts` can say `infrastructure.dns.provider`, and that statement
 * is about who actually administers the zone — it is not a preference to be
 * weighed against whatever credentials happen to be in the environment.
 */
// Accepts an absent config, which is what both callers pass: they load it with
// `.catch(() => undefined)` because a project without one still needs DNS
// guidance. The body always read it with `config?.`; only the signature had
// never said so, and `any` is what let the two disagree.
export function declaredDnsProvider(config: TsCloudConfig | null | undefined): string | undefined {
  const provider = config?.tsCloud?.infrastructure?.dns?.provider
    ?? config?.infrastructure?.dns?.provider
  return typeof provider === 'string' && provider ? provider.toLowerCase() : undefined
}

/**
 * Build the DNS provider credentials to try, in priority order.
 *
 * When the project declares a provider, ONLY that provider is returned. It
 * used to return every provider whose credentials happened to be present and
 * probe them in array order, which meant a project that had declared Porkbun
 * but whose production environment carried AWS keys (for S3, SES, anything)
 * silently tried Route53, failed with `InvalidClientTokenId`, and reported
 * "ignoring a configured provider ... credentials were rejected" — naming an
 * AWS error for a provider the project never asked for. The domain was at
 * Porkbun the whole time; nothing was misconfigured except this function.
 *
 * A declared provider with no credentials returns an empty list rather than
 * falling through to a different registrar. Writing DNS into the wrong zone
 * is not a lesser failure than writing none.
 */
export function dnsProviderConfigsFromEnv(declared?: string): DnsProviderConfig[] {
  const configs: DnsProviderConfig[] = []
  if (process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY)
    configs.push({ provider: 'porkbun', apiKey: process.env.PORKBUN_API_KEY, secretKey: process.env.PORKBUN_SECRET_KEY })
  if (process.env.CLOUDFLARE_API_TOKEN)
    configs.push({ provider: 'cloudflare', apiToken: process.env.CLOUDFLARE_API_TOKEN })
  if (process.env.GODADDY_API_KEY && process.env.GODADDY_API_SECRET)
    configs.push({ provider: 'godaddy', apiKey: process.env.GODADDY_API_KEY, apiSecret: process.env.GODADDY_API_SECRET, environment: process.env.GODADDY_ENVIRONMENT })
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)
    configs.push({ provider: 'route53' })

  if (!declared)
    return configs

  return configs.filter(config => config.provider === declared)
}

/**
 * Why a declared provider produced no usable credentials, phrased as the fix.
 * Returns undefined when nothing is wrong.
 */
export function declaredDnsProviderProblem(declared: string | undefined, configs: readonly DnsProviderConfig[]): string | undefined {
  if (!declared || configs.length > 0)
    return undefined

  const needed = DNS_PROVIDER_CREDENTIALS[declared]
  if (!needed)
    return `config/cloud.ts declares the DNS provider '${declared}', which is not one this deploy knows how to drive (${Object.keys(DNS_PROVIDER_CREDENTIALS).join(', ')}).`

  return `config/cloud.ts declares '${declared}' as the DNS provider for this project, but ${needed.join(' and ')} ${needed.length > 1 ? 'are' : 'is'} not set in this environment. `
    + `Set ${needed.length > 1 ? 'them' : 'it'} in .env.production (\`buddy env:set\`) so the records land at the registrar that actually administers the zone. `
    + `Refusing to try another provider: writing DNS into the wrong zone is not better than writing none.`
}

/**
 * Resolve the provider that actually holds `domain`: probe the configured
 * credentials, and fall back to inferring from the zone's authoritative
 * nameservers when every probe declines (some registrars disable the record
 * API per-domain, which is not the same as not owning the zone).
 *
 * Returns undefined when nothing configured owns it — the caller prints the
 * records for a human rather than writing into a zone it does not administer.
 */
async function resolveZoneDnsProvider(domain: string, providerConfigs: any[], logger: typeof log): Promise<any | undefined> {
  if (providerConfigs.length === 0)
    return undefined

  const { createDnsProvider, detectDnsProvider } = await import('@stacksjs/ts-cloud')

  const provider = await detectDnsProvider(domain, providerConfigs).catch((err: any) => {
    logger.warn(`  DNS: ignoring a configured provider for ${domain} - its credentials were rejected (${err?.message || err})`)
    return undefined
  })
  if (provider)
    return provider

  let nameservers: string[] = []
  try {
    const { resolveNs } = await import('node:dns/promises')
    nameservers = await resolveNs(domain)
  }
  catch { /* zone may not resolve yet */ }

  const providerName = dnsProviderNameFromNameservers(nameservers)
  const providerConfig = providerConfigs.find(config => config.provider === providerName)
  return providerConfig ? createDnsProvider(providerConfig) : undefined
}

/**
 * The DMARC policy to publish, from `email.server.dmarc.policy`.
 *
 * `quarantine` is the default because it is right for a domain that already
 * sends. It is the wrong default for one that does not yet: the first deploy
 * that authorizes a brand-new domain would also start diverting its mail on any
 * alignment hiccup, which is how a launch quietly loses its confirmation
 * emails. Young domains declare `none`, read the aggregate reports, then
 * tighten.
 *
 * Anything unrecognised falls back to the default rather than reaching the
 * zone. The value is interpolated straight into a TXT record, so a typo like
 * `p=quaranine` would publish a malformed policy that receivers ignore —
 * failing open, invisibly, which is the worst way for this to be wrong.
 */
export function resolveDmarcPolicy(policy: unknown): 'none' | 'quarantine' | 'reject' {
  return policy === 'none' || policy === 'quarantine' || policy === 'reject' ? policy : 'quarantine'
}

/**
 * Normalize a provider's record name to a lowercase FQDN.
 *
 * Providers disagree: some return `_dmarc`, some `_dmarc.example.com.`, some
 * `@` or `''` for the apex. Comparing raw names across them silently matches
 * nothing, which reads as "no existing record" and duplicates it.
 */
export function zoneFqdn(name: unknown, zone: string): string {
  const apex = zone.replace(/\.$/, '').toLowerCase()
  const n = String(name ?? '').replace(/\.$/, '').toLowerCase()
  if (!n || n === '@')
    return apex
  return n === apex || n.endsWith(`.${apex}`) ? n : `${n}.${apex}`
}

/**
 * Pick every record at one name and type out of a FULL zone listing.
 *
 * Separated out because the failure it guards is invisible: a provider's
 * `listRecords(domain, type)` is not a portable filter — Porkbun scopes it to
 * the apex — so selecting from a type-filtered listing finds no `_dmarc` or
 * `<selector>._domainkey` record and the caller adds a duplicate rather than
 * replacing. Selection must happen here, over everything the zone holds.
 */
export function selectRecordsAt<T extends { name?: unknown, type?: unknown }>(records: T[], fqdn: string, type: string, zone: string): T[] {
  const target = zoneFqdn(fqdn, zone)
  return records.filter(r => String(r.type).toUpperCase() === type.toUpperCase() && zoneFqdn(r.name, zone) === target)
}

/** A name+type this deploy expects to end up holding exactly one record. */
export interface MailDnsExpectation {
  label: string
  fqdn: string
  type: string
  /** Narrows the check to the records this deploy owns at a shared name. */
  owns?: (content: string) => boolean
}

/**
 * Read the zone back and report any name that did not end up holding exactly
 * one of the records this deploy is responsible for.
 *
 * This exists because the failure it catches is silent by construction. A
 * publisher that trusts its own writes cannot tell a replaced record from a
 * duplicated one, and the duplicate is invisible: the zone looks *more*
 * configured, every individual record is well-formed, and the deploy logs
 * success. That is exactly how `p=none` came to be published beside an existing
 * `p=quarantine` here — and two DMARC records is not a stricter policy, it is
 * no policy at all (RFC 7489 §6.6.3 has receivers discard the record set
 * entirely), so the domain lost DMARC while appearing to have gained it.
 *
 * Checking the result rather than the intent catches any cause: a provider that
 * scopes a listing differently than expected, a delete that fails, a record
 * added by hand, or another tool writing the same zone. Pure, so the reporting
 * is testable without touching a registrar.
 */
export function findMailDnsAnomalies<T extends { name?: unknown, type?: unknown, content?: unknown, value?: unknown }>(
  records: T[],
  expectations: MailDnsExpectation[],
  zone: string,
): string[] {
  const problems: string[] = []

  for (const expectation of expectations) {
    const at = selectRecordsAt(records, expectation.fqdn, expectation.type, zone)
    const ours = expectation.owns ? at.filter(record => expectation.owns!(txtContent(record))) : at

    if (ours.length === 0)
      problems.push(`${expectation.label}: nothing published at ${expectation.fqdn}`)
    else if (ours.length > 1)
      problems.push(`${expectation.label}: ${ours.length} records at ${expectation.fqdn}, expected 1 - receivers treat a duplicated ${expectation.type} here as unconfigured, so remove the stale one`)
  }

  return problems
}

/** The TXT content a provider returned, unquoted and trimmed for comparison. */
export function txtContent(record: { content?: unknown, value?: unknown }): string {
  return String(record.content ?? record.value ?? '').replace(/^"|"$/g, '')
}

/**
 * Decide which TXT records at one name to remove and whether to write a new
 * one, given the records already there and a predicate for the ones this
 * deploy owns.
 *
 * Pure, and separated out because the property that matters is a negative one:
 * a record this deploy does not own must never appear in `remove`. The previous
 * implementation deleted every TXT at the name before recreating one, so
 * publishing SPF at the apex silently destroyed site-verification records for
 * Google, Microsoft, Atlassian and anyone else — no error, nothing in the
 * deploy output, and nobody notices until a third party re-checks ownership.
 */
export function planTxtReplacement<T extends { content?: unknown, value?: unknown }>(
  existing: T[],
  content: string,
  owns: (existingContent: string) => boolean,
): { remove: T[], create: boolean } {
  const ours = existing.filter(record => owns(txtContent(record)))
  // Already exactly right: touch nothing, so a no-op deploy is a no-op.
  if (ours.length === 1 && txtContent(ours[0]!) === content)
    return { remove: [], create: false }
  return { remove: ours, create: true }
}

/**
 * Publish a hosted domain's mail DNS through whichever provider holds the zone:
 * MX → the mail host, SPF authorizing the box IP, the DKIM public key at the
 * selector the server actually signs under, a DMARC policy, and `mail.<domain>`
 * → the box.
 *
 * Best-effort: every failure is logged with the records printed for a human,
 * never thrown, because mail DNS is additive config and must not fail a
 * release.
 *
 * MX targets the tenant's own `mail.<domain>` when that name already resolves
 * to the box (own-brand mail host; requires the mail cert to cover it as a
 * SAN), and falls back to the shared mail host otherwise, where no per-domain
 * mail A record or extra TLS SAN is needed.
 *
 * Writes are surgical. This routine used to delete every record of a name+type
 * before recreating one, which at the apex destroyed unrelated TXT records, and
 * it spoke only Porkbun, which silently skipped every zone held anywhere else.
 */
export async function reconcileMailDns(res: MailTenantResult, ip: string, logger: typeof log): Promise<void> {
  const { domain, dkimPubB64 } = res
  let { mailHost } = res
  // Whatever the server told us it signs under. `mail` only as a last resort,
  // for a tenant provisioned before the selector was reported.
  const dkimName = `${res.dkimSelector || 'mail'}._domainkey`

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
  const dmarcCfg: any = cfg.server?.dmarc || {}
  const rua = dmarcCfg.reportTo || fromAddress || firstBox || `chris@${domain}`
  const dmarc = `v=DMARC1; p=${resolveDmarcPolicy(dmarcCfg.policy)}; rua=mailto:${rua}`
  const dkim = dkimPubB64 ? `v=DKIM1; k=rsa; p=${dkimPubB64}` : undefined

  const byHand = (reason: string): void => {
    logger.warn(`Mail DNS not published for ${domain}: ${reason}`)
    logger.info(`Add these records by hand, or point a configured provider at the zone:`)
    logger.info(`  MX    @                 10 ${mailHost}`)
    logger.info(`  TXT   @                 ${spf}`)
    if (dkim) logger.info(`  TXT   ${dkimName.padEnd(17)}${dkim}`)
    logger.info(`  TXT   _dmarc            ${dmarc}`)
    logger.info(`  A     mail              ${ip}`)
  }

  const declared = declaredDnsProvider(await loadTsCloudConfig(process.env.APP_ENV || 'production').catch(() => undefined))
  const providerConfigs = dnsProviderConfigsFromEnv(declared)
  const declaredProblem = declaredDnsProviderProblem(declared, providerConfigs)
  if (declaredProblem) {
    logger.warn(`  DNS: ${declaredProblem}`)
    return byHand(`the declared provider '${declared}' has no credentials in this environment`)
  }
  if (providerConfigs.length === 0)
    return byHand('no DNS provider credentials are configured')

  // Whichever registrar actually holds the zone — not whichever one this
  // function used to hardcode. Mail domains are frequently not in the same
  // account as the app's apex (this project's own redirect set spans a Porkbun
  // zone and a Route53 zone in a different cloud account), and a mail domain in
  // any provider but Porkbun was silently skipped with four records dumped for
  // a human who never added them.
  const provider = await resolveZoneDnsProvider(domain, providerConfigs, logger)
  if (!provider)
    return byHand(`no configured DNS provider administers this zone`)

  // Names are written as FQDNs; providers derive the zone root from `domain`
  // and strip it back off. Records come back either way, so `zoneFqdn`
  // normalizes both sides before anything is compared.
  const apex = domain.toLowerCase()
  const dkimFqdn = `${dkimName}.${domain}`
  const dmarcFqdn = `_dmarc.${domain}`
  const mailFqdn = `mail.${domain}`

  /**
   * Every record at one name and type, read from a FULL zone listing.
   *
   * `listRecords(domain, type)` must not be used here. It is not a portable
   * server-side filter: Porkbun implements it as `retrieveByNameType` scoped to
   * the zone apex, so asking for TXT returns the apex TXT records and silently
   * omits every subdomain one — `_dmarc` and `<selector>._domainkey` come back
   * as "not present". A replacement that cannot see the existing record does
   * not replace it, it adds a second one beside it. Two DMARC records is not a
   * redundant policy: RFC 7489 has receivers ignore the policy entirely, so the
   * domain silently loses DMARC while the zone looks more configured than
   * before. Observed in production on the deploy that introduced this function.
   *
   * Re-read per call rather than cached, because the writes below change the
   * answer and a stale listing reintroduces exactly the bug above.
   */
  const recordsAt = async (fqdn: string, type: string): Promise<any[]> => {
    const res = await provider.listRecords(domain)
    return selectRecordsAt(res?.success ? (res.records || []) : [], fqdn, type, domain)
  }

  /**
   * Replace only the records this deploy owns at `fqdn`, leaving every other
   * record at that name untouched.
   *
   * The previous implementation deleted every record of a name+type before
   * recreating one. At the apex that meant `TXT` — so publishing SPF silently
   * destroyed every other apex TXT in the zone: Google/Microsoft site
   * verification, Atlassian, Stripe, domain-ownership proofs. They vanish
   * without an error, and nothing notices until a third party re-checks
   * ownership weeks later. SPF is one record among many at the apex and has to
   * be replaced surgically.
   */
  const replaceTxt = async (fqdn: string, content: string, owns: (existing: string) => boolean): Promise<void> => {
    const existing = await recordsAt(fqdn, 'TXT')
    const { remove, create } = planTxtReplacement(existing, content, owns)
    if (!create)
      return

    // A delete that fails must not be followed by a create: the old record
    // stays, the new one lands beside it, and for `_dmarc` two records mean no
    // policy at all (RFC 7489). Failing loudly leaves the zone as it was, which
    // is always better than half-replacing it.
    for (const record of remove) {
      const removed = await provider.deleteRecord(domain, { ...record, name: fqdn, type: 'TXT' })
      if (removed && removed.success === false)
        throw new Error(`TXT ${fqdn}: could not remove the record being replaced (${removed.message || 'provider refused the delete'})`)
    }

    const created = await provider.createRecord(domain, { name: fqdn, type: 'TXT', content, ttl: 600 })
    if (!created?.success)
      throw new Error(`TXT ${fqdn}: ${created?.message || 'provider rejected the record'}`)
  }

  try {
    // MX: this domain's mail is hosted on our box, so our host replaces the
    // set. Anything else pointing elsewhere is named as it is removed — a
    // silently dropped MX is how a domain stops receiving mail entirely.
    const mxRecords = await recordsAt(apex, 'MX')
    const staleMx = mxRecords.filter(r => String(r.content ?? r.value ?? '').replace(/\.$/, '').toLowerCase() !== mailHost.toLowerCase())
    for (const record of staleMx) {
      logger.warn(`  Mail DNS: replacing an existing MX for ${domain} → ${record.content ?? record.value}`)
      await provider.deleteRecord(domain, { ...record, name: apex, type: 'MX' })
    }
    if (mxRecords.length === staleMx.length) {
      const created = await provider.createRecord(domain, { name: apex, type: 'MX', content: mailHost, ttl: 600, priority: 10 })
      if (!created?.success)
        throw new Error(`MX ${domain}: ${created?.message || 'provider rejected the record'}`)
    }

    await replaceTxt(apex, spf, existing => existing.toLowerCase().startsWith('v=spf1'))
    if (dkim)
      await replaceTxt(dkimFqdn, dkim, () => true)
    await replaceTxt(dmarcFqdn, dmarc, existing => existing.toLowerCase().startsWith('v=dmarc1'))

    // `mail.<domain>` pointing at the box, because that is the hostname a
    // person types into Mail.app or Outlook. Without it the name resolved to
    // the registrar's parking page and the client reported "unable to verify
    // account name or password" — which sounds like a bad password and is
    // really a bad hostname. The certificate for it is arranged separately;
    // until it exists, clients should use the shared host.
    const mailA = await provider.upsertRecord(domain, { name: mailFqdn, type: 'A', content: ip, ttl: 600 })
    if (!mailA?.success)
      throw new Error(`A ${mailFqdn}: ${mailA?.message || 'provider rejected the record'}`)

    // Read the zone back. Publishing reports what was attempted; this reports
    // what is actually there, which is the only thing a receiver will see.
    const verifyRes = await provider.listRecords(domain)
    const anomalies = verifyRes?.success
      ? findMailDnsAnomalies(verifyRes.records || [], [
          { label: 'MX', fqdn: apex, type: 'MX' },
          { label: 'SPF', fqdn: apex, type: 'TXT', owns: content => content.toLowerCase().startsWith('v=spf1') },
          ...(dkim ? [{ label: 'DKIM', fqdn: dkimFqdn, type: 'TXT' }] : []),
          { label: 'DMARC', fqdn: dmarcFqdn, type: 'TXT', owns: content => content.toLowerCase().startsWith('v=dmarc1') },
        ], domain)
      : []

    for (const anomaly of anomalies)
      logger.warn(`  Mail DNS: ${anomaly}`)

    logger.success(`Mail DNS published for ${domain} via ${provider.name} (MX→${mailHost}, SPF, DKIM at ${dkimName}, DMARC, ${mailFqdn}→${ip})`)
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
/**
 * Return the application zones that should receive config/dns.ts records.
 *
 * Redirect-only domains still receive their managed apex/www A records through
 * reconcileHetznerDns, but must not inherit the primary app's MX, SPF, or site
 * verification records.
 *
 * Neither may a site that is a HOST inside a zone this app already owns.
 * config/dns.ts describes one zone; applying it to every site hostname made
 * the deploy try to create `www.mta-sts.stacksjs.com` from the scaffold's
 * `{ name: 'www' }` entry, which is a record for a zone that does not exist
 * and a host nobody asked for. A site whose domain sits under another site's
 * domain gets its records from that parent zone's reconcile, not its own.
 */
export function configDnsDomains(sites: Record<string, any>): string[] {
  const domains = new Set<string>()
  for (const site of Object.values(sites)) {
    if (!site?.redirect && site?.domain && typeof site.domain === 'string')
      domains.add(site.domain.replace(/^www\./, ''))
  }

  const all = [...domains]
  return all.filter(domain => !all.some(other => other !== domain && domain.endsWith(`.${other}`)))
}

/**
 * Reconcile the Cloudflare proxy CDN in front of the box, and purge its cache.
 *
 * Opt-in through `infrastructure.compute.proxy.cdn.provider === 'cloudflare'`
 * in the app's `config/cloud.ts`; a project without that block pays one config
 * read and returns.
 *
 * Non-fatal throughout, like every reconciler around it. By the time this runs
 * the release is already live and serving from the box — a zone setting gated
 * behind a paid plan, or an API token missing the Cache Rules scope, is worth
 * reporting loudly but is not worth turning a good deploy into a failed one.
 */
async function reconcileCloudflareCdnForDeploy(
  tsCloudConfig: any,
  ip: string | undefined,
  ipv6: string | undefined,
  logger: typeof log,
): Promise<void> {
  let resolveCloudflareCdnPlan: any
  let reconcileCloudflareCdn: any
  let CloudflareProvider: any
  let normalizePublicIpv6: any

  try {
    ({ resolveCloudflareCdnPlan, reconcileCloudflareCdn, CloudflareProvider, normalizePublicIpv6 }
      = await import('@stacksjs/ts-cloud'))
  }
  catch {
    return
  }

  // An older ts-cloud has no CDN surface at all. Saying so beats throwing
  // "resolveCloudflareCdnPlan is not a function" from inside a deploy that
  // otherwise succeeded — and beats silently never proxying anything, which is
  // what a bare optional-call would do.
  if (typeof resolveCloudflareCdnPlan !== 'function' || typeof reconcileCloudflareCdn !== 'function') {
    if (tsCloudConfig?.infrastructure?.compute?.proxy?.cdn?.provider === 'cloudflare')
      logger.warn('Cloudflare CDN: installed @stacksjs/ts-cloud is too old to manage it — upgrade to ^0.9.4.')
    return
  }

  const { plan, errors } = resolveCloudflareCdnPlan(tsCloudConfig)
  for (const error of errors) logger.warn(`Cloudflare CDN: ${error}`)
  if (!plan) return

  if (!ip) {
    logger.warn('Cloudflare CDN: no box IP resolved — skipping.')
    return
  }

  logger.info(`Cloudflare CDN: reconciling ${plan.hosts.length} host(s) on ${plan.zone}...`)

  try {
    const provider = new CloudflareProvider(plan.apiToken, { zoneId: plan.zoneId, accountId: plan.accountId })
    const report = await reconcileCloudflareCdn({
      provider,
      zone: plan.zone,
      hosts: plan.hosts,
      ipv4: ip,
      ipv6: typeof normalizePublicIpv6 === 'function' ? normalizePublicIpv6(ipv6) : ipv6,
      proxied: plan.proxied,
      settings: plan.settings,
      cache: plan.cache,
      originGuard: plan.originGuard,
      purge: plan.purge,
      skipOriginProbe: plan.skipOriginProbe,
    })

    for (const record of report.records)
      logger.success(`  ${record.host} ${record.type} → ${record.content}${record.proxied ? ' (proxied)' : ' (DNS-only)'}`)
    for (const setting of report.settingsChanged)
      logger.info(`  ${setting.id}: ${JSON.stringify(setting.from)} → ${JSON.stringify(setting.to)}`)
    if (report.cacheRules > 0) logger.success(`  ${report.cacheRules} cache rule(s) applied`)
    if (report.originGuard) logger.success('  origin guard header applied')
    if (report.purged) logger.success('  edge cache purged')

    // A host left grey because the origin could not yet prove a certificate is
    // the normal first-deploy outcome, not an error — but it has to be said, or
    // the site looks CDN-fronted when it is not.
    for (const deferred of report.deferredProxy || [])
      logger.warn(`  ${deferred.host} left DNS-only: ${deferred.reason} — re-run the deploy once TLS is issued.`)
    for (const warning of report.warnings) logger.warn(`  ${warning}`)
  }
  catch (err: any) {
    logger.warn(`Cloudflare CDN: ${err?.message || err}`)
  }
}

/**
 * Infer a DNS provider from a zone's authoritative nameservers.
 *
 * Provider API probes are intentionally the primary detection mechanism, but
 * some registrars disable record API access per-domain. In that state the
 * provider still owns the zone and should receive the attempted write so the
 * deploy reports the real authorization error instead of incorrectly calling
 * the zone externally managed.
 */
export function dnsProviderNameFromNameservers(nameservers: string[]): 'porkbun' | 'cloudflare' | 'route53' | 'godaddy' | null {
  const normalized = nameservers.map(name => name.toLowerCase().replace(/\.$/, ''))

  if (normalized.some(name => name.endsWith('.porkbun.com')))
    return 'porkbun'
  if (normalized.some(name => name.endsWith('.ns.cloudflare.com')))
    return 'cloudflare'
  if (normalized.some(name => /(^|\.)awsdns-\d+\.(?:com|net|org|co\.uk)$/.test(name)))
    return 'route53'
  if (normalized.some(name => name.endsWith('.domaincontrol.com')))
    return 'godaddy'

  return null
}

async function reconcileConfigDns(sites: Record<string, any>, logger: typeof log): Promise<void> {
  const projectDnsConfig = await loadProjectDnsConfig(dnsConfig)
  const declared = (['a', 'aaaa', 'cname', 'mx', 'txt'] as const)
    .reduce((total, key) => total + (Array.isArray((projectDnsConfig)?.[key]) ? (projectDnsConfig)[key].length : 0), 0)
  if (declared === 0)
    return

  for (const domain of configDnsDomains(sites)) {
    try {
      const result = await syncDnsConfig(domain, projectDnsConfig)
      if (!result.provider)
        continue // no registrar credentials resolved for this domain; skip quietly
      if (result.created || result.failed)
        logger.info(`DNS (config/dns.ts) ${domain}: ${result.created} created, ${result.kept} kept${result.failed ? `, ${result.failed} failed` : ''}`)

      // The count is the headline; these are the two lines that can be acted
      // on. A summary saying "1 failed" and nothing else was a bug report with
      // the evidence removed.
      for (const failure of result.failures)
        logger.warn(`  ${failure.record.type} ${failure.record.name} → ${failure.record.content}: ${failure.reason}`)
      for (const skipped of result.skipped)
        logger.info(`  skipped ${skipped.record.type} ${skipped.record.name}: ${skipped.reason}`)
    }
    catch (err) {
      logger.warn(`DNS (config/dns.ts) reconcile for ${domain} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

async function reconcileHetznerDns(sites: Record<string, any>, ip: string, logger: typeof log, ipv6?: string, autoWww?: boolean): Promise<string[]> {
  // FQDNs this run actually published, so the caller can re-issue TLS for
  // names that did not resolve when the gateway was last reloaded.
  const published: string[] = []

  // Ask ts-cloud which hostnames the gateway will actually answer, rather than
  // re-deriving them here. The two used to be computed independently and
  // drifted: this function collapsed every domain to its apex
  // (`.replace(/^www\./, '')`) and then re-added a `www` only for two-label
  // apexes, so an explicitly declared `www.<sub>.<apex>` site — which does get
  // a real route and a real cert entry — was published as nothing at all. The
  // name then resolved with no certificate of its own and rpx answered it with
  // the fallback cert, which on a shared box belongs to another tenant.
  // `gatewayHostnames` is the same function the gateway builds its route table
  // from, and a test in ts-cloud pins the two together.
  const { gatewayHostnames } = await import('@stacksjs/ts-cloud')
  const hostnames: string[] = gatewayHostnames(sites, { autoWww })

  // Group by the zone-ish base each hostname belongs to. The base is what gets
  // handed to provider detection and to `reconcileAddressRecords`'s `zone`
  // argument, exactly as before, so provider resolution behaves identically for
  // every tenant already deployed; only the set of FQDNs under each base grew.
  const byBase = new Map<string, Set<string>>()
  for (const fqdn of hostnames) {
    const base = fqdn.replace(/^www\./, '')
    const group = byBase.get(base) ?? new Set<string>()
    group.add(fqdn)
    byBase.set(base, group)
  }
  if (byBase.size === 0)
    return published

  // Candidate provider configs, built from whatever credentials are present.
  const declared = declaredDnsProvider(await loadTsCloudConfig(process.env.APP_ENV || 'production').catch(() => undefined))
  const providerConfigs = dnsProviderConfigsFromEnv(declared)
  const declaredProblem = declaredDnsProviderProblem(declared, providerConfigs)
  if (declaredProblem)
    logger.warn(`DNS: ${declaredProblem}`)

  if (providerConfigs.length === 0) {
    if (!declaredProblem)
      logger.warn('DNS: no DNS provider credentials found (PORKBUN_API_KEY/…); skipping DNS reconciliation.')
    for (const fqdn of hostnames)
      logger.info(`  Point manually:  A ${fqdn} → ${ip}`)
    return published
  }

  const { reconcileAddressRecords } = await import('@stacksjs/ts-cloud')
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

  for (const [domain, group] of byBase) {
    // Exactly the hostnames the gateway routes for this base — the apex, the
    // `www` variant it synthesizes for a two-label apex, and any `www` host a
    // site declared for itself. Never a name the gateway does not answer: that
    // is the record that resolves and then serves the wrong certificate.
    const fqdns = [...group].sort()

    try {
      // Credential rejection, nameserver fallback and the "nothing owns this
      // zone" case all live in resolveZoneDnsProvider, so the mail path and
      // this one cannot drift apart on which registrar holds a zone — the
      // divergence that let mail DNS reach only Porkbun.
      const provider = await resolveZoneDnsProvider(domain, providerConfigs, logger)
      if (!provider) {
        // No configured provider owns this zone — the records may still be
        // correct (managed at the registrar). Only warn when they aren't.
        for (const fqdn of fqdns) {
          const current = await resolveA(fqdn)
          if (current.includes(ip))
            logger.success(`  DNS: ${fqdn} → ${ip} (externally managed, already correct)`)
          else if (current.length === 0)
            logger.warn(`  DNS: ${fqdn} does not resolve and no configured provider manages ${domain} - create it manually: A ${fqdn} → ${ip}`)
          else
            logger.warn(`  DNS: ${fqdn} resolves to ${current.join(', ')} but this deploy targets ${ip}, and no configured provider manages ${domain} - update it manually: A ${fqdn} → ${ip}`)
        }
        continue
      }
      for (const fqdn of fqdns) {
        // Pass the full fqdn as the record name — the provider derives the
        // zone root from `domain` and strips it back off the name. Passing
        // '' for the apex made subdomain sites (dashboard.hq.training)
        // upsert the ZONE APEX instead of their own record: the provider
        // edited hq.training's A record, returned success, and deploy
        // printed a phantom ✓ for a record that never existed (this was
        // the hq.training production TLS blocker — LE could not resolve
        // the host to validate http-01).
        //
        // Upsert, stale-record cleanup, post-write verification and the
        // IPv4/IPv6 split all live in ts-cloud's reconcileAddressRecords, so
        // every driver and every caller applies the same rules — including
        // the ones learned the hard way here (phantom successes, duplicate
        // addresses round-robining onto a dead host, mail hosts that must
        // stay IPv4-only).
        const report = await reconcileAddressRecords({ provider, zone: domain, fqdn, ipv4: ip, ipv6 })
        for (const record of report.published) {
          logger.success(`  DNS: ${record.fqdn} → ${record.content} (${provider.name})`)
          published.push(record.fqdn)
        }
        for (const warning of report.warnings)
          logger.warn(`  DNS: ${warning}`)
      }
    }
    catch (err: any) {
      logger.warn(`  DNS: ${domain} reconciliation failed: ${err?.message || err}`)
    }
  }

  return published
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
    log.warn('pantry CLI not found on PATH - skipping container image build. Install pantry to enable `--docker`.')
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
    .option('--domain <domain>', descriptions.domain, { default: undefined })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--prod', descriptions.production, { default: false })
    .option('--dev', descriptions.development, { default: false })
    .option('--yes', descriptions.yes, { default: false })
    .option('--site <name>', 'Deploy only this one site to the existing server (multi-tenant surgical add)', { default: undefined })
    .option('--staging', descriptions.staging, { default: false })
    .option('--docker', 'Also build an OCI image with pantry (native, no Docker daemon) and push it to the pantry registry', { default: false })
    .option('-J, --json', 'Emit a machine-readable deployment preview', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(withDeployNotification(async (envArg: string | undefined, options: DeployOptions) => {
      log.debug('Running `buddy deploy` ...', options)

      // Read argv in addition to the parsed option. Which key a global flag
      // lands on is clapp's business and has changed before; the literal argv
      // check guarantees that a requested preview can never fall through into
      // the mutating deployment pipeline.
      const askedForDryRun = process.argv.includes('--dry-run')
        || options.dryRun === true

      // Resolve the target environment from the positional arg or the
      // --staging/--dev/--prod flags (the flags were previously ignored, so
      // `buddy deploy --staging` silently deployed production).
      const optionEnvironment = (options as unknown as { env?: string }).env
      const deployEnvName = resolveDeploymentEnvironment({
        positional: envArg,
        option: optionEnvironment,
        staging: options.staging,
        development: options.dev,
      })
      const deployEnv = deployEnvName

      try {
        applyDeploymentDomainOverride({}, options.domain)
      }
      catch (error) {
        log.error(getErrorMessage(error))
        process.exit(ExitCode.InvalidArgument)
      }

      if (askedForDryRun) {
        // A preview evaluates the target environment and cloud model, then
        // exits before prerequisites, builds, packaging, hooks, providers,
        // persistence, DNS, or TLS can mutate anything.
        process.env.APP_ENV = deployEnvName
        const envFile = deployEnvName === 'production' ? '.env.production' : `.env.${deployEnvName}`
        if (existsSync(p.projectPath(envFile))) {
          try {
            const { loadEnv } = await import('@stacksjs/env')
            loadEnv({ path: envFile, env: deployEnvName, keysFile: '.env.keys', overload: true, quiet: true })
          }
          catch (error) {
            log.debug(`Could not load ${envFile} for preview: ${getErrorMessage(error)}`)
          }
        }

        const tsCloudConfig = await loadTsCloudConfig(deployEnvName)
        const { resolveSiteKind } = await loadTsCloudDeployApi()
        const unbacked = tsCloudConfig ? findUnbackedManagedServices(tsCloudConfig) : []
        let plan: DeploymentPreview
        try {
          plan = createDeploymentPreview({
            config: tsCloudConfig,
            environment: deployEnvName,
            site: options.site,
            domain: options.domain,
            docker: options.docker === true,
            fallbackProjectName: app.name,
            fallbackProjectSlug: app.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'app',
            fallbackProvider: 'aws',
            fallbackMode: (cloudConfig as { mode?: string }).mode || 'server',
            fallbackRegion: process.env.AWS_REGION || 'us-east-1',
            resolveSiteKind,
            applyEnvironmentToSites,
            warnings: unbacked.length > 0 ? [unbackedDataMessage(unbacked)] : [],
          })
        }
        catch (error) {
          log.error(getErrorMessage(error))
          process.exit(ExitCode.InvalidArgument)
        }

        if (options.json || process.argv.includes('--json'))
          console.log(`${deploymentPreviewJsonPrefix}${JSON.stringify(plan)}`)
        else
          process.stdout.write(formatDeploymentPreview(plan))
        return
      }

      // Resolved BEFORE the prerequisites, because which env file has to be in
      // place is the first thing they check.
      await ensureDeployPrerequisites(options.verbose === true, deployEnvName)

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
        await deployToHetzner(applyDeploymentDomainOverride(tsCloudConfig, options.domain), deployEnv, options)
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

      if (deployEnvName === 'production' && !options.yes)
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

      if (resultFailed(result)) {
        await outro(
          'While running the `buddy deploy`, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Project deployed.', { startTime, useSeconds: true })
    }))

  buddy
    .command('deploy:rollback [site]', 'Roll back a deployment to a preserved release')
    .option('--env <environment>', 'Environment to roll back', { default: 'production' })
    .option('--to <release>', 'Preserved release id to activate', { default: undefined })
    .option('--dry-run', 'Preview the rollback without changing the active release', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (site: string | undefined, options: DeployRollbackOptions) => {
      const exitCode = await runDeployRollback(site, options)
      if (exitCode !== ExitCode.Success)
        process.exit(exitCode)
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

  if (resultFailed(result)) {
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
  await setEnv('AWS_ACCESS_KEY_ID', accessKeyId, { file: '.env.production', encrypt: true })
  await setEnv('AWS_SECRET_ACCESS_KEY', secretAccessKey, { file: '.env.production', encrypt: true })
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
    const cloud = cloudConfig as TsCloudConfig | undefined
    const hostedZoneId = cloud?.tsCloud?.infrastructure?.dns?.hostedZoneId
      || cloud?.infrastructure?.dns?.hostedZoneId
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
      const submissionPort = emailConfig?.server?.ports?.submission || 587
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
