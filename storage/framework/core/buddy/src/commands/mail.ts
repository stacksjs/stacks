import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { getErrorMessage } from '@stacksjs/utils'
import { CLI } from '@stacksjs/clapp'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { readFileSync, existsSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'

export function resolveDirectMailHost(env: NodeJS.ProcessEnv = process.env): string | undefined {
  let configured = env.MAIL_SERVER_HOST
    || ((env.HCLOUD_TOKEN || env.HETZNER_API_TOKEN) ? env.MAIL_HOST : undefined)
  if (configured && ['127.0.0.1', 'localhost', 'mailpit'].includes(configured))
    configured = env.MAIL_DOMAIN ? `mail.${env.MAIL_DOMAIN}` : undefined
  if (!configured || configured === '127.0.0.1' || configured === 'localhost')
    return undefined
  return configured.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0]
}

export function sanitizeLineCount(value?: string): string {
  const count = Number.parseInt(value || '50', 10)
  return String(Number.isFinite(count) ? Math.min(5000, Math.max(1, count)) : 50)
}

// eslint-disable-next-line pickier/no-unused-vars
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function resolveOperationalMailHost(): Promise<string | undefined> {
  if (process.env.MAIL_SERVER_HOST)
    return resolveDirectMailHost()
  const token = process.env.HCLOUD_TOKEN || process.env.HETZNER_API_TOKEN
  if (!token)
    return undefined
  const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  try {
    const response = await fetch(`https://api.hetzner.cloud/v1/servers?name=${encodeURIComponent(`${appName}-production-app`)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json() as any
    const ip = data.servers?.[0]?.public_net?.ipv4?.ip
    if (ip)
      return ip
  }
  catch {
    // Fall back to the configured mail hostname below.
  }
  const configured = resolveDirectMailHost()
  if (configured)
    return configured
  const { email } = await import('@stacksjs/config')
  return (email as any)?.domain ? `mail.${(email as any).domain}` : undefined
}

interface MailStorageOptions {
  host?: string
  secret?: string
  bucket?: string
  size?: string
  region?: string
  profile?: string
  force?: boolean
  slot?: string
}

interface MailStorageSecret {
  version: 1
  encoding: 'base64'
  key: string
  image: string
  mapper: string
  createdAt: string
}

const mailStorageRemote = '/usr/local/sbin/mail-storage-external'

function loadMailStorageAws(options: MailStorageOptions): { profile: string, region: string } {
  const profile = options.profile || process.env.AWS_PROFILE || 'default'
  const region = options.region || process.env.AWS_REGION || 'us-east-1'
  process.env.AWS_PROFILE = profile
  loadEnvFiles()

  // The application environment is the primary credential source for Buddy.
  // Reload it with precedence because the CLI bootstrap may have populated
  // stale shell/profile credentials before this command was dispatched.
  if (existsSync('.env.production')) {
    try {
      const { loadEnv } = require('@stacksjs/env') as typeof import('@stacksjs/env')
      loadEnv({ path: '.env.production', env: 'production', keysFile: '.env.keys', overload: true, quiet: true })
    }
    catch {
      // loadEnvFiles already loaded any usable plaintext entries.
    }
  }

  const home = process.env.HOME || process.env.USERPROFILE || ''
  const credentialsPath = `${home}/.aws/credentials`
  if ((!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) && existsSync(credentialsPath)) {
    const values: Record<string, string> = {}
    let inProfile = false
    for (const line of readFileSync(credentialsPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[')) {
        inProfile = trimmed === `[${profile}]`
        continue
      }
      if (!inProfile)
        continue
      const separator = trimmed.indexOf('=')
      if (separator > 0)
        values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim()
    }
    if (values.aws_access_key_id && values.aws_secret_access_key) {
      process.env.AWS_ACCESS_KEY_ID = values.aws_access_key_id
      process.env.AWS_SECRET_ACCESS_KEY = values.aws_secret_access_key
      if (values.aws_session_token)
        process.env.AWS_SESSION_TOKEN = values.aws_session_token
      else
        delete process.env.AWS_SESSION_TOKEN
    }
  }
  return { profile, region }
}

function mailStorageSecretId(options: MailStorageOptions): string {
  if (options.secret)
    return options.secret
  if (process.env.MAIL_STORAGE_SECRET_ID)
    return process.env.MAIL_STORAGE_SECRET_ID
  const app = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const environment = (process.env.APP_ENV || 'production').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return `${app}/${environment}/mail-storage-key`
}

async function mailStorageHost(options: MailStorageOptions): Promise<string> {
  const host = options.host || await resolveOperationalMailHost()
  if (!host)
    throw new Error('Could not resolve the mail host. Pass --host <hostname-or-ip>.')
  if (!/^[a-zA-Z0-9._:-]+$/.test(host))
    throw new Error(`Unsafe mail host: ${host}`)
  return host
}

function runMailStorageSsh(host: string, command: string, input?: Buffer): Buffer {
  const result = spawnSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    `root@${host}`,
    command,
  ], {
    input,
    maxBuffer: 32 * 1024 * 1024,
  })

  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr || []).toString('utf8').trim()
    throw new Error(stderr || `SSH command failed with status ${result.status}`)
  }
  return Buffer.from(result.stdout || [])
}

function readMailRecoveryKey(): Buffer {
  const result = spawnSync('/usr/bin/security', [
    'find-generic-password',
    '-a', 'mail-storage-recovery',
    '-s', 'com.stacks.production.mail.luks',
    '-w',
  ], {
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
  })
  if (result.status !== 0)
    throw new Error('macOS Keychain recovery-key read failed')
  const raw = Buffer.from(result.stdout || [])
  const text = raw.toString('ascii').trim()
  const key = /^[0-9a-f]{128}$/i.test(text)
    ? Buffer.from(text, 'hex')
    : raw.length === 65 && raw[64] === 0x0A
      ? Buffer.from(raw.subarray(0, 64))
      : Buffer.from(raw)
  raw.fill(0)
  if (key.length !== 64)
    throw new Error('macOS Keychain returned an invalid recovery key')
  return key
}

async function waitForHetznerAction(token: string, actionId: number): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.hetzner.cloud/v1/actions/${actionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json() as any
    if (!response.ok)
      throw new Error(data?.error?.message || `Hetzner action ${actionId} lookup failed`)
    if (data.action?.status === 'success')
      return
    if (data.action?.status === 'error')
      throw new Error(data.action?.error?.message || `Hetzner action ${actionId} failed`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`Hetzner action ${actionId} timed out`)
}

async function ensureMailStorageVolume(
  options: MailStorageOptions,
): Promise<{ device: string; host: string; id: number; name: string; size: number }> {
  loadEnvFiles()
  const token = process.env.HCLOUD_TOKEN || process.env.HETZNER_API_TOKEN
  if (!token)
    throw new Error('HCLOUD_TOKEN or HETZNER_API_TOKEN is required.')
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  const host = await mailStorageHost(options)
  const serverResponse = await fetch(`https://api.hetzner.cloud/v1/servers?name=${encodeURIComponent('stacks-production-app')}`, { headers })
  const serverData = await serverResponse.json() as any
  const server = serverData.servers?.[0]
  if (!server)
    throw new Error('Hetzner server stacks-production-app was not found.')

  const app = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const name = `${app}-production-mail`
  const requestedSize = Number.parseInt(options.size || '20', 10)
  if (!Number.isFinite(requestedSize) || requestedSize < 10 || requestedSize > 1024)
    throw new Error('Mail volume size must be between 10 and 1024 GiB.')

  const volumesResponse = await fetch(`https://api.hetzner.cloud/v1/volumes?name=${encodeURIComponent(name)}`, { headers })
  const volumesData = await volumesResponse.json() as any
  let volume = volumesData.volumes?.[0]
  if (!volume) {
    const createResponse = await fetch('https://api.hetzner.cloud/v1/volumes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        size: requestedSize,
        server: server.id,
        automount: false,
        labels: {
          application: app,
          environment: 'production',
          purpose: 'mail-storage',
        },
      }),
    })
    const createData = await createResponse.json() as any
    if (!createResponse.ok)
      throw new Error(createData?.error?.message || 'Hetzner volume creation failed.')
    volume = createData.volume
    if (createData.action?.id)
      await waitForHetznerAction(token, createData.action.id)
  }
  else if (!volume.server) {
    const attachResponse = await fetch(`https://api.hetzner.cloud/v1/volumes/${volume.id}/actions/attach`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ server: server.id, automount: false }),
    })
    const attachData = await attachResponse.json() as any
    if (!attachResponse.ok)
      throw new Error(attachData?.error?.message || 'Hetzner volume attach failed.')
    await waitForHetznerAction(token, attachData.action.id)
  }
  else if (volume.server !== server.id) {
    throw new Error(`Hetzner volume ${name} is attached to a different server.`)
  }

  const refreshed = await (await fetch(`https://api.hetzner.cloud/v1/volumes/${volume.id}`, { headers })).json() as any
  volume = refreshed.volume || volume
  if (!volume.linux_device)
    throw new Error(`Hetzner volume ${name} has no Linux device path yet.`)
  return { device: volume.linux_device, host, id: volume.id, name, size: volume.size }
}

async function ensureMailKmsKey(options: MailStorageOptions): Promise<{ alias: string; arn: string }> {
  const { region } = loadMailStorageAws(options)
  const { AWSClient } = await import('../../../cloud/src/imap/client')
  const { S3Client } = await import('../../../cloud/src/imap/s3')
  const { SecretsManagerClient } = await import('../../../cloud/src/imap/secrets-manager')
  const client = new AWSClient()
  const request = async (target: string, body: Record<string, unknown>): Promise<any> => client.request({
    service: 'kms',
    region,
    method: 'POST',
    path: '/',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `TrentService.${target}`,
    },
    body: JSON.stringify(body),
  })

  const alias = 'alias/stacks-production-mail'
  const aliases = await request('ListAliases', { Limit: 100 })
  let keyId = aliases.Aliases?.find((item: any) => item.AliasName === alias)?.TargetKeyId
  if (!keyId) {
    const created = await request('CreateKey', {
      Description: 'Customer-managed key for production mail secrets and backups',
      KeyUsage: 'ENCRYPT_DECRYPT',
      Origin: 'AWS_KMS',
      Tags: [
        { TagKey: 'Application', TagValue: 'stacks' },
        { TagKey: 'Environment', TagValue: 'production' },
        { TagKey: 'Purpose', TagValue: 'mail-storage' },
      ],
    })
    keyId = created.KeyMetadata?.KeyId
    if (!keyId)
      throw new Error('AWS KMS did not return a key ID.')
    await request('CreateAlias', { AliasName: alias, TargetKeyId: keyId })
    await request('EnableKeyRotation', { KeyId: keyId, RotationPeriodInDays: 90 })
  }
  const described = await request('DescribeKey', { KeyId: keyId })
  const arn = described.KeyMetadata?.Arn
  if (!arn)
    throw new Error('AWS KMS did not return a key ARN.')

  const secrets = new SecretsManagerClient(region)
  for (const secretId of ['stacks/production/mail-storage-key', 'stacks/production/mail-restic']) {
    try {
      await secrets.updateSecret({ SecretId: secretId, KmsKeyId: arn })
    }
    catch (error: any) {
      if (error?.code !== 'ResourceNotFoundException')
        throw new Error(`Could not re-encrypt secret ${secretId}: ${getErrorMessage(error)}`)
    }
  }
  const s3 = new S3Client(region)
  for (const bucket of ['stacks-production-s3-backups', 'stacks-production-s3-email', 'stacks-production-email']) {
    try {
      await s3.putBucketEncryption(bucket, 'aws:kms', arn)
    }
    catch (error) {
      throw new Error(`Could not apply KMS encryption to ${bucket}: ${getErrorMessage(error)}`)
    }
  }
  return { alias, arn }
}

async function configureMailRestic(options: MailStorageOptions): Promise<{ repository: string; secretId: string }> {
  const { region } = loadMailStorageAws(options)
  const host = await mailStorageHost(options)
  const bucket = options.bucket || 'stacks-production-s3-backups'
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))
    throw new Error(`Unsafe S3 bucket name: ${bucket}`)
  const kms = await ensureMailKmsKey(options)
  const { AWSClient } = await import('../../../cloud/src/imap/client')
  const { SecretsManagerClient } = await import('../../../cloud/src/imap/secrets-manager')
  const iam = new AWSClient()
  const iamRequest = async (action: string, params: Record<string, string> = {}): Promise<any> => iam.request({
    service: 'iam',
    region: 'us-east-1',
    method: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      Action: action,
      Version: '2010-05-08',
      ...params,
    }).toString(),
  })
  const userName = 'stacks-production-mail-backup'
  try {
    await iamRequest('GetUser', { UserName: userName })
  }
  catch (error: any) {
    if (error?.code !== 'NoSuchEntity')
      throw error
    await iamRequest('CreateUser', {
      UserName: userName,
      'Tags.member.1.Key': 'Application',
      'Tags.member.1.Value': 'stacks',
      'Tags.member.2.Key': 'Environment',
      'Tags.member.2.Value': 'production',
      'Tags.member.3.Key': 'Purpose',
      'Tags.member.3.Value': 'mail-backup',
    })
  }
  await iamRequest('PutUserPolicy', {
    UserName: userName,
    PolicyName: 'mail-restic-backup',
    PolicyDocument: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:ListBucket', 's3:GetBucketLocation'],
          Resource: `arn:aws:s3:::${bucket}`,
          Condition: { StringLike: { 's3:prefix': ['restic-mail', 'restic-mail/*'] } },
        },
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
          ],
          Resource: `arn:aws:s3:::${bucket}/restic-mail/*`,
        },
        {
          Effect: 'Allow',
          Action: ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
          Resource: kms.arn,
        },
      ],
    }),
  })

  const listedKeys = await iamRequest('ListAccessKeys', { UserName: userName })
  const listedMembers = listedKeys.ListAccessKeysResult?.AccessKeyMetadata?.member
  const oldKeys: any[] = listedMembers ? (Array.isArray(listedMembers) ? listedMembers : [listedMembers]) : []
  if (oldKeys.length > 0 && !options.force)
    throw new Error(`IAM user ${userName} already has a key. Pass --force to rotate it.`)
  if (oldKeys.length >= 2) {
    for (const old of oldKeys)
      await iamRequest('DeleteAccessKey', { UserName: userName, AccessKeyId: old.AccessKeyId })
  }
  const createdKey = await iamRequest('CreateAccessKey', { UserName: userName })
  const access = createdKey.CreateAccessKeyResult?.AccessKey
  if (!access?.AccessKeyId || !access?.SecretAccessKey)
    throw new Error('AWS IAM did not return the Restic access key.')
  const password = randomBytes(48).toString('base64url')
  const repository = `s3:s3.amazonaws.com/${bucket}/restic-mail`
  const secretId = 'stacks/production/mail-restic'
  const secretPayload = JSON.stringify({
    version: 1,
    repository,
    password,
    accessKeyId: access.AccessKeyId,
    secretAccessKey: access.SecretAccessKey,
    kmsKeyArn: kms.arn,
    createdAt: new Date().toISOString(),
  })
  const secrets = new SecretsManagerClient(region)
  try {
    await secrets.createSecret({
      Name: secretId,
      Description: 'Restic credentials for production mail backups',
      KmsKeyId: kms.arn,
      SecretString: secretPayload,
      Tags: [
        { Key: 'Application', Value: 'stacks' },
        { Key: 'Environment', Value: 'production' },
        { Key: 'Purpose', Value: 'mail-backup' },
      ],
    })
  }
  catch (error: any) {
    if (error?.code !== 'ResourceExistsException')
      throw error
    await secrets.updateSecret({ SecretId: secretId, KmsKeyId: kms.arn, SecretString: secretPayload })
  }

  const configDir = '/var/lib/mail-storage/data/restic'
  const passwordPath = `${configDir}/password`
  const envPayload = [
    `RESTIC_REPOSITORY=${repository}`,
    `RESTIC_PASSWORD_FILE=${passwordPath}`,
    `AWS_ACCESS_KEY_ID=${access.AccessKeyId}`,
    `AWS_SECRET_ACCESS_KEY=${access.SecretAccessKey}`,
    `AWS_DEFAULT_REGION=${region}`,
    '',
  ].join('\n')
  runMailStorageSsh(
    host,
    `install -d -m 0700 ${configDir}; umask 077; dd of=${configDir}/restic.env status=none`,
    Buffer.from(envPayload),
  )
  runMailStorageSsh(
    host,
    `umask 077; dd of=${passwordPath} status=none`,
    Buffer.from(`${password}\n`),
  )
  runMailStorageSsh(
    host,
    `set -a; . ${configDir}/restic.env; set +a; restic snapshots >/dev/null 2>&1 || restic init`,
  )
  runMailStorageSsh(host, 'systemctl enable --now mail-restic-backup.timer mail-storage-health.timer')
  runMailStorageSsh(host, 'systemctl start mail-restic-backup.service')
  runMailStorageSsh(host, '/usr/local/sbin/mail-restic-restore-check')

  for (const old of oldKeys) {
    if (old.AccessKeyId !== access.AccessKeyId)
      await iamRequest('DeleteAccessKey', { UserName: userName, AccessKeyId: old.AccessKeyId })
  }
  return { repository, secretId }
}

function decodeMailStorageSecret(secretString?: string): Buffer {
  if (!secretString)
    throw new Error('The mail storage secret has no SecretString value.')
  let parsed: MailStorageSecret
  try {
    parsed = JSON.parse(secretString) as MailStorageSecret
  }
  catch {
    throw new Error('The mail storage secret is not valid JSON.')
  }
  if (parsed.version !== 1 || parsed.encoding !== 'base64' || typeof parsed.key !== 'string')
    throw new Error('The mail storage secret uses an unsupported format.')
  const key = Buffer.from(parsed.key, 'base64')
  if (key.length < 32)
    throw new Error('The mail storage key is unexpectedly short.')
  return key
}

async function getMailStorageSecret(
  options: MailStorageOptions,
): Promise<{ key: Buffer; secretId: string }> {
  const { profile, region } = loadMailStorageAws(options)
  const secretId = mailStorageSecretId(options)
  const { SecretsManagerClient } = await import('../../../cloud/src/imap/secrets-manager')
  const secrets = new SecretsManagerClient(region, profile)
  const value = await secrets.getSecretValue({ SecretId: secretId })
  return { key: decodeMailStorageSecret(value.SecretString), secretId }
}

async function escrowMailStorageKey(
  options: MailStorageOptions,
): Promise<{ secretId: string; host: string }> {
  const { profile, region } = loadMailStorageAws(options)
  const host = await mailStorageHost(options)
  const secretId = mailStorageSecretId(options)
  const { SecretsManagerClient } = await import('../../../cloud/src/imap/secrets-manager')
  const secrets = new SecretsManagerClient(region, profile)

  const key = runMailStorageSsh(
    host,
    'systemd-creds decrypt --name=mail-storage-key /etc/credstore.encrypted/mail-storage-key.cred -',
  )
  if (key.length < 32)
    throw new Error('The machine-bound mail storage key is unexpectedly short.')

  let existing: Buffer | undefined
  try {
    const value = await secrets.getSecretValue({ SecretId: secretId })
    existing = decodeMailStorageSecret(value.SecretString)
  }
  catch (error: any) {
    if (error?.code !== 'ResourceNotFoundException')
      throw error
  }

  if (existing && (!timingSafeEqual(existing, key))) {
    existing.fill(0)
    if (!options.force) {
      key.fill(0)
      throw new Error(`Secret ${secretId} already contains a different key. Pass --force to replace it.`)
    }
  }
  existing?.fill(0)

  const payload: MailStorageSecret = {
    version: 1,
    encoding: 'base64',
    key: key.toString('base64'),
    image: '/var/lib/mail-storage.luks',
    mapper: 'mail-storage',
    createdAt: new Date().toISOString(),
  }

  if (existing) {
    await secrets.putSecretValue({ SecretId: secretId, SecretString: JSON.stringify(payload) })
  }
  else {
    try {
      await secrets.createSecret({
        Name: secretId,
        Description: `Externally escrowed LUKS2 key for ${host}`,
        SecretString: JSON.stringify(payload),
        Tags: [
          { Key: 'Application', Value: process.env.APP_NAME || 'stacks' },
          { Key: 'Environment', Value: process.env.APP_ENV || 'production' },
          { Key: 'Purpose', Value: 'mail-storage' },
        ],
      })
    }
    catch (error: any) {
      if (error?.code !== 'ResourceExistsException')
        throw error
      await secrets.putSecretValue({ SecretId: secretId, SecretString: JSON.stringify(payload) })
    }
  }

  const verify = await secrets.getSecretValue({ SecretId: secretId })
  const verifiedKey = decodeMailStorageSecret(verify.SecretString)
  const matches = verifiedKey.length === key.length && timingSafeEqual(verifiedKey, key)
  verifiedKey.fill(0)
  key.fill(0)
  if (!matches)
    throw new Error(`Secret ${secretId} did not verify after writing.`)
  return { secretId, host }
}

function addMailStorageOptions(command: any): any {
  return command
    .option('--host <host>', 'Mail server hostname or IP')
    .option('--secret <id>', 'AWS Secrets Manager secret ID')
    .option('--region <region>', 'AWS region', { default: 'us-east-1' })
    .option('--profile <profile>', 'AWS credential profile', { default: 'default' })
}

export function mailCommands(buddy: CLI): void {
  buddy
    .command('mail:provision', 'Provision this app\'s mail from config/email.ts onto the shared mail server (domain + DKIM + mailboxes + MX/SPF/DKIM/DMARC DNS). Reusable + idempotent; the same reconcile buddy deploy runs.')
    .option('--ip <ip>', 'Mail server IP (defaults to the A record of config.email.domain)')
    .action(async (options: { ip?: string, env?: string }) => {
      // Mailbox passwords come from `MAIL_PASSWORD_<LOCALPART>`, which belong in
      // the target environment's encrypted env file — but nothing here loaded
      // that file, so `mail:provision --env production` read the development
      // env, found no passwords, and skipped every mailbox while still
      // reporting success and advising you to set the very variables it had
      // just ignored. Load the target environment's decrypted secrets first,
      // exactly as `buddy deploy` does, so the two paths provision alike.
      const environment = options.env || process.env.APP_ENV || 'production'
      process.env.APP_ENV = environment
      const envFile = `.env.${environment}`
      if (existsSync(envFile)) {
        try {
          const { loadEnv } = await import('@stacksjs/env')
          loadEnv({ path: envFile, env: environment, keysFile: '.env.keys', overload: true, quiet: true })
        }
        catch (err) {
          log.warn(`Could not load ${envFile}: ${getErrorMessage(err)}`)
        }
      }

      const { email: emailConfig } = await import('@stacksjs/config')
      const domain: string | undefined = (emailConfig as any)?.domain
      if (!domain) {
        log.error('config/email.ts has no `domain` — set it (e.g. domain: \'bughq.org\') and add `mailboxes`.')
        process.exit(ExitCode.FatalError)
      }

      // The mailboxes live on the shared mail server, which is co-located with
      // the app on the same box — so the app domain's A record is the box IP.
      let ip = options.ip
      if (!ip) {
        try {
          const dns = await import('node:dns')
          ip = (await dns.promises.resolve4(domain))[0]
        }
        catch {
          log.error(`Could not resolve an IP for ${domain}. Deploy the site first, or pass --ip <mail-server-ip>.`)
          process.exit(ExitCode.FatalError)
        }
      }

      const { provisionMailTenant, reconcileMailDns } = await import('./deploy')
      log.info(`Provisioning mail for ${domain} on ${ip}...`)
      const res = await provisionMailTenant(ip!, log)
      if (res)
        await reconcileMailDns(res, ip!, log)
      log.success(`Mail provisioned for ${domain}. Add MAIL_PASSWORD_<LOCALPART> env vars to pin mailbox passwords.`)
      process.exit(ExitCode.Success)
    })

  addMailStorageOptions(
    buddy.command('mail:storage:status', 'Show encrypted mail storage and external-key status'),
  )
    .action(async (options: MailStorageOptions) => {
      loadEnvFiles()
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(host, `${mailStorageRemote} status`).toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to read mail storage status: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:kms:ensure', 'Create and apply the customer-managed production mail KMS key'),
  )
    .action(async (options: MailStorageOptions) => {
      try {
        const kms = await ensureMailKmsKey(options)
        console.log(`alias=${kms.alias}`)
        console.log(`arn=${kms.arn}`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to configure mail KMS: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:volume:migrate', 'Create a dedicated Hetzner volume and migrate encrypted mail storage'),
  )
    .option('--size <gib>', 'Hetzner volume size in GiB', { default: '20' })
    .action(async (options: MailStorageOptions) => {
      let key: Buffer | undefined
      let prepareAttempted = false
      try {
        const volume = await ensureMailStorageVolume(options)
        const secret = await getMailStorageSecret(options)
        key = secret.key
        runMailStorageSsh(
          volume.host,
          `for i in $(seq 1 60); do test -b ${shellQuote(volume.device)} && exit 0; sleep 1; done; exit 1`,
        )
        prepareAttempted = true
        runMailStorageSsh(
          volume.host,
          [
            'umask 077',
            'key_file=$(mktemp /run/mail-volume-migrate-key.XXXXXX)',
            'trap \'shred -u "$key_file" 2>/dev/null || rm -f "$key_file"\' EXIT',
            'dd of="$key_file" bs=64 count=1 iflag=fullblock status=none',
            `MAIL_ENCRYPTED_IMAGE_SIZE=16G /usr/local/sbin/mail-volume-migrate prepare ${shellQuote(volume.device)}`,
            `${mailStorageRemote} unlock < "$key_file"`,
            '/usr/local/sbin/mail-volume-migrate finalize',
          ].join(' && '),
          key,
        )
        const status = runMailStorageSsh(volume.host, `${mailStorageRemote} status`).toString('utf8').trim()
        console.log(`volume=${volume.name}`)
        console.log(`volume_id=${volume.id}`)
        console.log(`volume_size_gib=${volume.size}`)
        console.log(status)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        if (prepareAttempted && key) {
          const host = await mailStorageHost(options)
          try {
            runMailStorageSsh(host, '/usr/local/sbin/mail-volume-migrate rollback')
          }
          catch (rollbackError) {
            console.error(`Dedicated-volume rollback step failed: ${getErrorMessage(rollbackError)}`)
          }
          try {
            runMailStorageSsh(host, `${mailStorageRemote} unlock`, key)
          }
          catch (unlockError) {
            console.error(`Mail storage re-unlock failed: ${getErrorMessage(unlockError)}`)
          }
        }
        console.error(`Failed to migrate mail storage volume: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:key:recovery:add', 'Add an independent LUKS recovery key to macOS Keychain'),
  )
    .action(async (options: MailStorageOptions) => {
      let currentKey: Buffer | undefined
      let recoveryKey: Buffer | undefined
      try {
        const host = await mailStorageHost(options)
        const secret = await getMailStorageSecret(options)
        currentKey = secret.key
        recoveryKey = randomBytes(64)
        runMailStorageSsh(
          host,
          `${mailStorageRemote} add-recovery-key`,
          Buffer.concat([currentKey, recoveryKey]),
        )

        const account = 'mail-storage-recovery'
        const service = 'com.stacks.production.mail.luks'
        const encoded = recoveryKey.toString('base64')
        const keychainWriter = `
          import Foundation
          import Security

          let input = FileHandle.standardInput.readDataToEndOfFile()
          guard let encoded = String(data: input, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            let secret = Data(base64Encoded: encoded),
            secret.count == 64
          else { exit(2) }

          let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: "${account}",
            kSecAttrService: "${service}",
          ]
          var trustedApplications: [SecTrustedApplication] = []
          for path in ["/usr/bin/security", "/Library/Developer/CommandLineTools/usr/bin/swift-frontend"] {
            var application: SecTrustedApplication?
            guard SecTrustedApplicationCreateFromPath(path, &application) == errSecSuccess,
              let application
            else { exit(4) }
            trustedApplications.append(application)
          }
          var access: SecAccess?
          guard SecAccessCreate(
            "Stacks production mail LUKS recovery key" as CFString,
            trustedApplications as CFArray,
            &access
          ) == errSecSuccess, let access
          else { exit(5) }

          let attributes: [CFString: Any] = [
            kSecValueData: secret,
            kSecAttrLabel: "Stacks production mail LUKS recovery key",
            kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable: false,
            kSecAttrAccess: access,
          ]
          var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
          if status == errSecItemNotFound {
            var item = query
            for (key, value) in attributes { item[key] = value }
            status = SecItemAdd(item as CFDictionary, nil)
          }
          guard status == errSecSuccess else { exit(Int32(status)) }

          var verificationQuery = query
          verificationQuery[kSecReturnData] = true
          verificationQuery[kSecMatchLimit] = kSecMatchLimitOne
          var result: CFTypeRef?
          status = SecItemCopyMatching(verificationQuery as CFDictionary, &result)
          guard status == errSecSuccess, let stored = result as? Data, stored == secret
          else { exit(3) }
        `
        const stored = spawnSync('/usr/bin/swift', ['-e', keychainWriter], {
          input: `${encoded}\n`,
          maxBuffer: 1024 * 1024,
        })
        if (stored.status !== 0)
          throw new Error('macOS Keychain write failed')

        console.log(`keychain_service=${service}`)
        console.log('recovery_keyslot=verified')
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to add recovery key: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        currentKey?.fill(0)
        recoveryKey?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:key:recovery:verify', 'Verify the Keychain recovery key against the live LUKS header'),
  )
    .action(async (options: MailStorageOptions) => {
      let key: Buffer | undefined
      try {
        const host = await mailStorageHost(options)
        key = readMailRecoveryKey()
        runMailStorageSsh(
          host,
          'cryptsetup open --test-passphrase --type luks2 --key-file - /var/lib/mail-storage.luks',
          key,
        )
        console.log('Keychain recovery key unlocks the live mail volume.')
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Recovery key verification failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:key:slot:remove', 'Remove an unusable non-primary LUKS keyslot'),
  )
    .option('--slot <number>', 'LUKS keyslot number to remove')
    .action(async (options: MailStorageOptions) => {
      let key: Buffer | undefined
      try {
        const slot = Number.parseInt(options.slot || '', 10)
        if (!Number.isInteger(slot) || slot < 1 || slot > 31)
          throw new Error('Pass a non-primary keyslot from 1 through 31.')
        const host = await mailStorageHost(options)
        const secret = await getMailStorageSecret(options)
        key = secret.key
        const output = runMailStorageSsh(host, `${mailStorageRemote} remove-keyslot ${slot}`, key).toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to remove LUKS keyslot: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:restic:configure', 'Configure client-encrypted Restic backups to S3'),
  )
    .option('--force', 'Rotate an existing dedicated IAM access key', { default: false })
    .action(async (options: MailStorageOptions) => {
      try {
        const result = await configureMailRestic(options)
        console.log(`repository=${result.repository}`)
        console.log(`recovery_secret=${result.secretId}`)
        console.log('restore_check=ok')
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to configure Restic mail backups: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:restore:check', 'Restore and validate the newest off-host mail snapshot'),
  )
    .action(async (options: MailStorageOptions) => {
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(host, '/usr/local/sbin/mail-restic-restore-check').toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Mail restore check failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:maildir:migrate', 'Migrate live mailboxes to canonical Maildir++ layout'),
  )
    .action(async (options: MailStorageOptions) => {
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(host, '/usr/local/sbin/maildir-migrate migrate').toString('utf8').trim()
        console.log(output)
        const status = runMailStorageSsh(host, '/usr/local/sbin/maildir-migrate status').toString('utf8').trim()
        console.log(status)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Maildir++ migration failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:forward:compile', 'Compile and validate the live RFC 5228 forwarding script'),
  )
    .action(async (options: MailStorageOptions) => {
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(
          host,
          '/usr/local/sbin/mail-forward-compile /opt/mail/forwards.json /opt/mail/forwards.sieve && sed -n "1,160p" /opt/mail/forwards.sieve',
        ).toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Forwarding script compilation failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:escrow', 'Copy the machine-bound LUKS key to AWS Secrets Manager'),
  )
    .option('--force', 'Replace a different existing secret', { default: false })
    .action(async (options: MailStorageOptions) => {
      try {
        const result = await escrowMailStorageKey(options)
        console.log(`Mail storage key verified in AWS Secrets Manager: ${result.secretId}`)
        console.log(`Host: ${result.host}`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to escrow mail storage key: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:key:verify', 'Verify the external key against the LUKS2 header'),
  )
    .action(async (options: MailStorageOptions) => {
      let key: Buffer | undefined
      try {
        const host = await mailStorageHost(options)
        const secret = await getMailStorageSecret(options)
        key = secret.key
        runMailStorageSsh(
          host,
          'cryptsetup open --test-passphrase --type luks2 --key-file - /var/lib/mail-storage.luks',
          key,
        )
        console.log(`External key ${secret.secretId} unlocks the mail volume.`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Mail storage key verification failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:unlock', 'Unlock external mail storage and start mail'),
  )
    .action(async (options: MailStorageOptions) => {
      let key: Buffer | undefined
      try {
        const host = await mailStorageHost(options)
        const secret = await getMailStorageSecret(options)
        key = secret.key
        const output = runMailStorageSsh(host, `${mailStorageRemote} unlock`, key).toString('utf8').trim()
        console.log(output)
        console.log(`External key: ${secret.secretId}`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to unlock mail storage: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:lock', 'Stop mail and lock external mail storage'),
  )
    .action(async (options: MailStorageOptions) => {
      loadEnvFiles()
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(host, `${mailStorageRemote} lock`).toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to lock mail storage: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:backup', 'Create and verify an encrypted local mail backup'),
  )
    .action(async (options: MailStorageOptions) => {
      loadEnvFiles()
      try {
        const host = await mailStorageHost(options)
        const output = runMailStorageSsh(
          host,
          [
            'set -eu',
            'systemctl reset-failed mail-backup.service 2>/dev/null || true',
            'systemctl start mail-backup.service',
            'latest=$(find -L /opt/mail/backups -maxdepth 1 -type f -name "mail-backup-*.tgz" -printf "%T@ %p\\n" | sort -nr | head -1 | cut -d" " -f2-)',
            'test -n "$latest"',
            'tar -tzf "$latest" >/dev/null',
            'printf "backup=%s\\n" "$latest"',
            'stat -c "mode=%a owner=%U:%G size=%s" "$latest"',
          ].join('; '),
        ).toString('utf8').trim()
        console.log(output)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to create mail backup: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:header:backup', 'Stream a LUKS header backup to S3 with KMS encryption'),
  )
    .option('--bucket <bucket>', 'Recovery bucket (defaults to <app>-<env>-s3-backups)')
    .action(async (options: MailStorageOptions) => {
      try {
        const { region } = loadMailStorageAws(options)
        const host = await mailStorageHost(options)
        const app = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const environment = (process.env.APP_ENV || 'production').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const bucket = options.bucket || `${app}-${environment}-s3-backups`
        if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))
          throw new Error(`Unsafe S3 bucket name: ${bucket}`)

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        const objectKey = `luks-headers/mail-storage-${timestamp}.header`
        const { AWSClient } = await import('../../../cloud/src/imap/client')
        const { S3Client } = await import('../../../cloud/src/imap/s3')
        const kms = await ensureMailKmsKey(options)
        const s3 = new S3Client(region)
        await s3.putBucketEncryption(bucket, 'aws:kms', kms.arn)
        const uploadUrl = s3.generatePresignedPutUrl(bucket, objectKey, 'application/octet-stream', 600)
        const remoteCommand = [
          'set -eu',
          'tmp_dir=$(mktemp -d /run/mail-storage-header.XXXXXX)',
          'tmp="$tmp_dir/header"',
          'trap \'shred -u "$tmp" 2>/dev/null || rm -f "$tmp"; rmdir "$tmp_dir"\' EXIT',
          'cryptsetup luksHeaderBackup /var/lib/mail-storage.luks --header-backup-file "$tmp"',
          `curl --fail-with-body --silent --show-error -H 'Content-Type: application/octet-stream' --upload-file "$tmp" ${shellQuote(uploadUrl)} 1>&2`,
        ].join('; ')
        runMailStorageSsh(host, remoteCommand)
        const object = await s3.headObject(bucket, objectKey)
        if (!object?.ContentLength || object.ContentLength < 1024 * 1024)
          throw new Error('The uploaded LUKS header size did not verify.')
        const rawS3 = new AWSClient()
        const head = await rawS3.request({
          service: 's3',
          region,
          method: 'HEAD',
          path: `/${bucket}/${objectKey}`,
          returnHeaders: true,
        })
        const encryption = head?.headers?.['x-amz-server-side-encryption']
        if (encryption !== 'aws:kms')
          throw new Error(`The LUKS header object reported unexpected encryption: ${encryption || 'none'}`)
        const keyId = head?.headers?.['x-amz-server-side-encryption-aws-kms-key-id']
        if (keyId !== kms.arn)
          throw new Error(`The LUKS header object used an unexpected KMS key: ${keyId || 'none'}`)

        console.log(`header=s3://${bucket}/${objectKey}`)
        console.log('encryption=aws:kms')
        console.log(`kms_key=${kms.arn}`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        console.error(`Failed to back up the LUKS header: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  addMailStorageOptions(
    buddy.command('mail:storage:externalize', 'Move the LUKS key off-host and require external unlocks'),
  )
    .option('--force', 'Replace a different existing secret', { default: false })
    .action(async (options: MailStorageOptions) => {
      let configured = false
      let key: Buffer | undefined
      try {
        const escrow = await escrowMailStorageKey(options)
        const secret = await getMailStorageSecret(options)
        key = secret.key

        runMailStorageSsh(escrow.host, `${mailStorageRemote} configure-external`)
        configured = true
        runMailStorageSsh(escrow.host, `${mailStorageRemote} unlock`, key)
        runMailStorageSsh(escrow.host, `${mailStorageRemote} finalize-external`)

        const status = runMailStorageSsh(escrow.host, `${mailStorageRemote} status`).toString('utf8').trim()
        console.log(status)
        console.log(`External key: ${escrow.secretId}`)
        process.exit(ExitCode.Success)
      }
      catch (error) {
        if (configured) {
          try {
            const host = await mailStorageHost(options)
            runMailStorageSsh(host, `${mailStorageRemote} rollback-machine`)
          }
          catch (rollbackError) {
            console.error(`Automatic rollback also failed: ${getErrorMessage(rollbackError)}`)
          }
        }
        console.error(`Failed to externalize mail storage: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        key?.fill(0)
      }
    })

  buddy
    .command('mail:user:add <email>', 'Add a mail user')
    .option('--password <password>', 'User password (generated if not provided)')
    .action(async (email: string, options: { password?: string }) => {
      log.info(`Adding mail user: ${email}`)

      try {
        // Generate password if not provided
        const password = options.password || randomBytes(16).toString('base64').replace(/[+/=]/g, '').substring(0, 16)
        const passwordHash = createHash('sha256').update(password).digest('hex')

        // Get the table name from environment or use default
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        // Use ts-cloud DynamoDB client
        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        await dynamodb.putItem({
          TableName: tableName,
          Item: {
            email: { S: email.toLowerCase() },
            passwordHash: { S: passwordHash },
            createdAt: { S: new Date().toISOString() },
          },
        })

        log.success(`User ${email} added successfully!`)
        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('  MAIL CREDENTIALS')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')
        console.log(`  Email:    ${email}`)
        console.log(`  Password: ${password}`)
        console.log('')
        console.log('  To connect with Mail.app, run:')
        console.log('    buddy mail:proxy')
        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')

        if (!options.password) {
          log.warn('Save this password! It will not be shown again.')
        }

        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to add user: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:user:list', 'List mail users')
    .action(async () => {
      try {
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        const result = await dynamodb.scan({ TableName: tableName })

        console.log('')
        console.log('Mail Users:')
        console.log('───────────────────────────────────────')

        if (!result.Items || result.Items.length === 0) {
          console.log('  No users found')
        } else {
          for (const item of result.Items) {
            const email = item.email?.S || 'unknown'
            const createdAt = item.createdAt?.S || 'unknown'
            console.log(`  📧 ${email}`)
            console.log(`     Created: ${createdAt}`)
          }
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to list users: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:user:delete <email>', 'Delete a mail user')
    .action(async (email: string) => {
      try {
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        await dynamodb.deleteItem({
          TableName: tableName,
          Key: { email: { S: email.toLowerCase() } },
        })

        log.success(`User ${email} deleted`)
        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to delete user: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:proxy', 'Start local IMAP proxy for Mail.app')
    .option('--port <port>', 'IMAP proxy port', { default: '1993' })
    .option('--api <url>', 'Mail API URL')
    .action(async (options: { port: string; api?: string }) => {
      log.info('Starting IMAP proxy...')

      try {
        // Get the API URL from CloudFormation outputs if not provided
        let apiUrl = options.api

        if (!apiUrl) {
          const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
          const cfn = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')
          const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
          const stackName = `${appName}-cloud`

          try {
            const result = await cfn.describeStacks({ stackName })
            const outputs = result.Stacks?.[0]?.Outputs || []
            const mailApiOutput = outputs.find((o: any) => o.OutputKey === 'MailApiUrl')
            apiUrl = mailApiOutput?.OutputValue
          } catch (e) {
            // Stack might not exist yet
          }
        }

        if (!apiUrl) {
          log.error('Mail API URL not found. Run `buddy deploy` first to create the mail infrastructure.')
          process.exit(ExitCode.FatalError)
        }

        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('  IMAP PROXY')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')
        console.log(`  API URL:  ${apiUrl}`)
        console.log(`  Port:     ${options.port}`)
        console.log('')
        console.log('  Configure Mail.app with:')
        console.log('  ─────────────────────────────────────────────────────')
        console.log('  Account Type:     IMAP')
        console.log('  Incoming Server:  localhost')
        console.log(`  Incoming Port:    ${options.port}`)
        console.log('  SSL:              No (local connection)')
        console.log('  Outgoing Server:  localhost')
        console.log(`  Outgoing Port:    ${options.port}`)
        console.log('  Username:         your-email@stacksjs.com')
        console.log('  Password:         your-password')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')

        // Start the proxy
        process.env.MAIL_API_URL = apiUrl
        process.env.IMAP_PORT = options.port

        // Dynamic import of the proxy. The mail-server lives in a
        // sibling package that isn't always built when buddy commands
        // run from source — without a `.d.ts` at the resolved path,
        // tsc can't type-check the import. The runtime resolution
        // happens at command execution time, by which point the user
        // has explicitly opted in to running this command, so missing
        // mail-server support surfaces as a clean runtime error.
        // eslint-disable-next-line ts/ban-ts-comment
        // @ts-ignore — sibling package resolved at runtime
        const { ImapProxy } = await import('../../mail-server/src/proxy/imap-proxy')
        const proxy = new ImapProxy(Number.parseInt(options.port, 10), apiUrl)
        await proxy.start()

        // Keep running
        process.on('SIGINT', () => {
          console.log('\nShutting down proxy...')
          proxy.stop()
          process.exit(0)
        })
      } catch (error: unknown) {
        log.error(`Failed to start proxy: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:test', 'Test mail API connection')
    .action(async () => {
      try {
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const cfn = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const stackName = `${appName}-cloud`

        const result = await cfn.describeStacks({ stackName })
        const outputs = result.Stacks?.[0]?.Outputs || []
        const mailApiOutput = outputs.find((o: any) => o.OutputKey === 'MailApiUrl')

        if (!mailApiOutput?.OutputValue) {
          log.error('Mail API not deployed. Run `buddy deploy` first.')
          process.exit(ExitCode.FatalError)
        }

        const apiUrl = mailApiOutput.OutputValue
        log.info(`Testing Mail API at ${apiUrl}`)

        // Test the API
        const response = await fetch(`${apiUrl}/mailboxes`, {
          headers: {
            'Authorization': `Basic ${Buffer.from('test@stacksjs.com:test').toString('base64')}`,
          },
        })

        if (response.status === 401) {
          log.success('Mail API is responding (auth required)')
        } else if (response.ok) {
          log.success('Mail API is working!')
          const data = await response.json()
          console.log('Response:', JSON.stringify(data, null, 2))
        } else {
          log.warn(`Mail API returned status ${response.status}`)
        }

        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to test API: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:credentials [email]', 'Show SMTP credentials for email access')
    .action(async (emailAddress?: string) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const mailHost = `mail.${domain}`
      const email = emailAddress || `chris@${domain}`
      const localPart = email.includes('@') ? email.split('@')[0]! : email

      // The IMAP/SMTP username is the FULL address. Mailboxes are provisioned
      // per-domain (`user:local create <addr>`) precisely so two tenants can
      // both have a `chris`, so a bare local part authenticates as nobody here
      // and the client reports a bad password. Handing someone the wrong
      // username is worse than handing them nothing.
      const username = email

      // Matches the provisioner's key derivation: every character that cannot
      // appear in an env var name becomes `_`. Without this, `no-reply` looked
      // for `MAIL_PASSWORD_NO-REPLY`, which is not a legal name and never
      // matched the `MAIL_PASSWORD_NO_REPLY` the deploy actually reads.
      const envKey = `MAIL_PASSWORD_${localPart.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
      const rawPassword = process.env[envKey]

      // A value that is still ciphertext means this machine holds no private
      // key for `.env.production`. Printing it would look like a password and
      // fail every login attempt.
      const isCiphertext = typeof rawPassword === 'string' && rawPassword.replace(/^["']/, '').startsWith('encrypted:')
      const password = isCiphertext ? undefined : rawPassword


      console.log('')
      console.log('==========================================================')
      console.log(`  EMAIL CREDENTIALS — ${email}`)
      console.log('==========================================================')
      console.log('')
      console.log(`  Email:       ${email}`)
      console.log(`  Host:        ${mailHost}`)
      console.log(`  Port:        587`)
      console.log(`  Security:    STARTTLS`)
      console.log(`  Username:    ${username}`)

      if (password) {
        console.log(`  Password:    ${password}`)
      } else if (isCiphertext) {
        console.log(`  Password:    (encrypted — this machine has no private key for .env.production)`)
      } else {
        console.log(`  Password:    (not set — add ${envKey} to .env.production)`)
      }

      console.log('')
      console.log('==========================================================')
      console.log('')

      process.exit(ExitCode.Success)
    })

  buddy
    .command('mail:logs', 'Show mail server logs from production')
    .option('-n, --lines <count>', 'Number of log lines to show', { default: '50' })
    .option('-f, --follow', 'Follow log output (poll every 5s)')
    .option('--filter <pattern>', 'Filter logs by pattern (e.g. AUTH, LOGIN, error)')
    .action(async (options: { lines?: string; follow?: boolean; filter?: string }) => {
      loadEnvFiles()

      const directHost = await resolveOperationalMailHost()
      if (directHost) {
        const lines = sanitizeLineCount(options.lines)
        const filter = options.filter ? options.filter.replace(/[^a-zA-Z0-9_.@\s-]/g, '') : ''
        const command = `journalctl -u mail --no-pager -n ${lines}${filter ? ` | grep -iE ${shellQuote(filter)}` : ''}`
        try {
          const output = execSync(`ssh -o BatchMode=yes -o ConnectTimeout=10 root@${shellQuote(directHost)} ${shellQuote(command)}`, { encoding: 'utf8' })
          console.log(output)
          process.exit(ExitCode.Success)
        }
        catch (error) {
          log.error(`Failed to fetch logs from ${directHost}: ${getErrorMessage(error)}`)
          process.exit(ExitCode.FatalError)
        }
      }

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        // Find the mail server instance
        log.info('Finding mail server...')
        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          log.info(`Looked for instances tagged: ${appName}-mail-server`)
          process.exit(ExitCode.FatalError)
        }

        log.info(`Found instance: ${instanceId}`)

        const lines = sanitizeLineCount(options.lines)
        const sanitizedFilter = options.filter ? options.filter.replace(/[^a-zA-Z0-9_.@\s-]/g, '') : ''
        const filterCmd = sanitizedFilter
          ? ` | grep -iE '${sanitizedFilter}'`
          : ''

        // Check both service names (smtp-server for Zig mode, mail-server for serverless)
        const fetchLogs = async () => {
          const cmd = `journalctl -u smtp-server -u mail-server --no-pager -n ${lines} --since "10 minutes ago" 2>&1${filterCmd}`
          const result = await ssm.runShellCommand(instanceId, [cmd], {
            timeoutSeconds: 30,
            maxWaitMs: 30000,
            pollIntervalMs: 2000,
          })

          if (!result.success) {
            log.error(`Failed to fetch logs: ${result.error || 'Unknown error'}`)
            return false
          }

          if (result.output) {
            // Clear and print
            const logLines = result.output.trim().split('\n')
            for (const line of logLines) {
              // Color code different log levels
              if (line.includes('error') || line.includes('Error') || line.includes('AUTH failed')) {
                console.log(`  \x1b[31m${line}\x1b[0m`)
              } else if (line.includes('warning') || line.includes('Warning')) {
                console.log(`  \x1b[33m${line}\x1b[0m`)
              } else if (line.includes('AUTH success') || line.includes('LOGIN completed') || line.includes('authenticated')) {
                console.log(`  \x1b[32m${line}\x1b[0m`)
              } else {
                console.log(`  ${line}`)
              }
            }
          } else {
            console.log('  No log entries found.')
          }

          return true
        }

        console.log('')
        console.log('==========================================================')
        console.log('  MAIL SERVER LOGS')
        console.log('==========================================================')
        console.log('')

        await fetchLogs()

        if (options.follow) {
          console.log('')
          log.info('Following logs (Ctrl+C to stop)...')
          let polling = false
          const poll = setInterval(() => {
            if (polling) return
            polling = true
            console.log('')
            fetchLogs()
              .catch(e => log.error('Log polling failed:', e))
              .finally(() => { polling = false })
          }, 5000)

          await new Promise<void>((resolve) => {
            process.on('SIGINT', () => {
              clearInterval(poll)
              resolve()
            })
          })
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to fetch logs: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:status', 'Show mail server status')
    .action(async () => {
      loadEnvFiles()

      const directHost = await resolveOperationalMailHost()
      if (directHost) {
        const command = 'systemctl is-active mail; systemctl show mail -p NRestarts -p ActiveEnterTimestamp --value; ss -H -ltn | grep -E "(:(25|143|465|587|993))\\b"; systemctl is-enabled mail-health.timer; systemctl is-active mail-health.timer'
        try {
          const output = execSync(`ssh -o BatchMode=yes -o ConnectTimeout=10 root@${shellQuote(directHost)} ${shellQuote(command)}`, { encoding: 'utf8' })
          console.log(output)
          process.exit(ExitCode.Success)
        }
        catch (error) {
          log.error(`Mail server ${directHost} is unhealthy: ${getErrorMessage(error)}`)
          process.exit(ExitCode.FatalError)
        }
      }

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          log.info(`Looked for instances tagged: ${appName}-mail-server`)
          process.exit(ExitCode.FatalError)
        }

        const result = await ssm.runShellCommand(instanceId, [
          'echo === Service ===',
          '(systemctl status smtp-server --no-pager 2>&1 || systemctl status mail-server --no-pager 2>&1) | head -15',
          'echo === Ports ===',
          'ss -tlnp 2>&1 | grep -E "(25|587|465|993|143|110|995)" || echo "No mail ports listening"',
          'echo === Memory ===',
          'ps aux | grep -E "(smtp-server|bun|mail)" | grep -v grep | awk \'{print $6/1024 "MB", $11}\'',
        ], {
          timeoutSeconds: 30,
          maxWaitMs: 30000,
          pollIntervalMs: 2000,
        })

        console.log('')
        console.log('==========================================================')
        console.log('  MAIL SERVER STATUS')
        console.log('==========================================================')
        console.log('')

        if (result.success && result.output) {
          for (const line of result.output.trim().split('\n')) {
            console.log(`  ${line}`)
          }
        } else {
          log.error(`Failed: ${result.error}`)
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed to get status: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:port25:request', 'Request port 25 unblock for direct SMTP delivery')
    .option('--provider <provider>', 'Cloud provider: aws or hetzner', { default: 'aws' })
    .option('--instance-id <id>', 'AWS EC2 instance ID (auto-detected if not provided)')
    .option('--server-id <id>', 'Hetzner server ID (auto-detected if not provided)')
    .option('--elastic-ip <ip>', 'AWS Elastic IP address')
    .option('--rdns <hostname>', 'Reverse DNS hostname (e.g. mail.stacksjs.com)')
    .option('--use-case <text>', 'Description of email use case')
    .action(async (options: {
      provider: string
      instanceId?: string
      serverId?: string
      elasticIp?: string
      rdns?: string
      useCase?: string
    }) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const provider = options.provider.toLowerCase()

      if (provider === 'aws') {
        await requestAwsPort25(options, domain)
      } else if (provider === 'hetzner') {
        await requestHetznerPort25(options, domain)
      } else {
        log.error(`Unknown provider: ${provider}. Use 'aws' or 'hetzner'.`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:port25:status', 'Check outbound port 25 status on the mail server')
    .option('--provider <provider>', 'Cloud provider: aws or hetzner', { default: 'aws' })
    .action(async (options: { provider: string }) => {
      loadEnvFiles()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      if (options.provider === 'hetzner') {
        // For Hetzner, SSH directly
        const hetznerToken = process.env.HETZNER_API_TOKEN
        if (!hetznerToken) {
          log.error('HETZNER_API_TOKEN not set')
          process.exit(ExitCode.FatalError)
        }

        try {
          // Find server IP
          const res = await fetch('https://api.hetzner.cloud/v1/servers?label_selector=service=mail', {
            headers: { Authorization: `Bearer ${hetznerToken}` },
          })
          const data = await res.json() as any
          const server = data.servers?.[0]
          const ip = server?.public_net?.ipv4?.ip

          if (!ip) {
            // Try listing all servers
            const allRes = await fetch('https://api.hetzner.cloud/v1/servers', {
              headers: { Authorization: `Bearer ${hetznerToken}` },
            })
            const allData = await allRes.json() as any
            const mailServer = allData.servers?.find((s: any) => s.name?.includes('mail'))
            if (mailServer) {
              const serverIp = mailServer.public_net?.ipv4?.ip
              log.info(`Found Hetzner server: ${mailServer.name} (${serverIp})`)
              const result = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${serverIp} "timeout 5 bash -c 'echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25' 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED"`, { encoding: 'utf-8' })
              printPort25Status(result.trim(), 'Hetzner', serverIp)
            } else {
              log.error('No mail server found on Hetzner')
            }
          } else {
            const result = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${ip} "timeout 5 bash -c 'echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25' 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED"`, { encoding: 'utf-8' })
            printPort25Status(result.trim(), 'Hetzner', ip)
          }
        } catch (error: unknown) {
          log.error(`Failed: ${getErrorMessage(error)}`)
        }
        process.exit(ExitCode.Success)
      }

      // AWS: use SSM to test
      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instance = data.Reservations?.[0]?.Instances?.[0]
        const instanceId = instance?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          process.exit(ExitCode.FatalError)
        }

        const publicIp = instance?.PublicIpAddress || 'unknown'
        log.info(`Testing port 25 on ${instanceId} (${publicIp})...`)

        const result = await ssm.runShellCommand(instanceId, [
          'timeout 5 bash -c "echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25" 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED',
        ], { timeoutSeconds: 15, maxWaitMs: 20000, pollIntervalMs: 2000 })

        printPort25Status(result.output?.trim() || 'PORT_25_BLOCKED', 'AWS', publicIp)
        process.exit(ExitCode.Success)
      } catch (error: unknown) {
        log.error(`Failed: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:server', 'Start SMTP relay server')
    .option('--port <port>', 'SMTP port', { default: '587' })
    .action(async (options: { port: string }) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const port = Number.parseInt(options.port, 10)
      const mailboxes = ['chris', 'blake', 'glenn']

      // Build users map from env vars
      const users: Record<string, { password: string; email: string }> = {}
      const generated: string[] = []

      for (const name of mailboxes) {
        const envKey = `MAIL_PASSWORD_${name.toUpperCase()}`
        let password = process.env[envKey]

        if (!password) {
          password = randomBytes(16).toString('base64url')
          generated.push(`${envKey}=${password}`)
        }

        users[name] = { password, email: `${name}@${domain}` }
      }

      if (generated.length > 0) {
        console.log('')
        log.warn('Generated missing passwords. Add these to .env.production:')
        for (const line of generated) {
          console.log(`  ${line}`)
        }
      }

      console.log('')
      console.log('==========================================================')
      console.log('  SMTP RELAY SERVER')
      console.log('==========================================================')
      console.log('')
      console.log(`  Host:        mail.${domain}`)
      console.log(`  Port:        ${port}`)
      console.log(`  Domain:      ${domain}`)
      console.log('')
      console.log('  Mailboxes:')
      for (const [name, user] of Object.entries(users)) {
        console.log(`    ${name} (${user.email})`)
      }
      console.log('')
      console.log('  Relaying through AWS SES')
      console.log('==========================================================')
      console.log('')

      try {
        const { SmtpServer } = await import('../../../cloud/src/imap/smtp-server')
        const server = new SmtpServer({
          port,
          host: '0.0.0.0',
          domain,
          users,
          sentBucket: `stacks-production-email`,
          sentPrefix: 'sent/',
        })

        await server.start()

        // Keep the process alive until SIGINT
        await new Promise<void>((resolve) => {
          process.on('SIGINT', async () => {
            console.log('\nShutting down SMTP server...')
            await server.stop()
            resolve()
          })
        })

        process.exit(0)
      } catch (error: unknown) {
        log.error(`Failed to start SMTP server: ${getErrorMessage(error)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  // Preview-server companion (stacksjs/stacks#1900 A3). The preview
  // routes themselves live in `defaults/routes/core.ts` so they mount
  // automatically on any dev server (`./buddy dev:api`); this command
  // is a convenience that prints the URL + opens it. Reads the API
  // port from `config.ports.api` with the same env-var override the
  // dev server uses.
  buddy
    .command('mail:preview', 'Open the dev-only Mailable preview UI in your browser')
    .option('--no-open', 'Print the URL but skip the browser-open step', { default: false })
    .option('--port <port>', 'Override the API port (default: from config.ports.api / PORT_API)')
    .example('buddy mail:preview')
    .example('buddy mail:preview --no-open')
    .example('buddy mail:preview --port 4000')
    .action(async (options: { open?: boolean, port?: string }) => {
      const { config } = await import('@stacksjs/config')
      const portFromOption = options.port ? Number(options.port) : undefined
      const portFromEnv = process.env.PORT_API ? Number(process.env.PORT_API) : undefined
      const port = portFromOption || portFromEnv || config.ports?.api || 3008
      const url = `http://localhost:${port}/_stacks/mail/preview`

      log.info(`Mailable preview: ${url}`)
      log.info('(Make sure `./buddy dev:api` is running.)')

      if (options.open !== false) {
        try {
          execSync(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || true`, { encoding: 'utf-8' })
        }
        catch {
          /* Silent — printing the URL above is sufficient for headless envs. */
        }
      }

      process.exit(ExitCode.Success)
    })
}

/**
 * Load .env.production and ~/.aws/credentials into process.env
 */
function loadEnvFiles(): void {
  const envPath = '.env.production'
  if (existsSync(envPath)) {
    // Decrypt on the way in. This used to slice the file on `=` and assign the
    // raw right-hand side, which for an `encrypted:v2:...` value is the
    // CIPHERTEXT — so `mail:credentials` printed a 300-character blob where the
    // password goes, and anyone who pasted it into a mail client got a login
    // failure that looks like a wrong password. A mailbox password belongs in
    // the encrypted env; reading it back has to undo that.
    try {
      const { loadEnv } = require('@stacksjs/env') as typeof import('@stacksjs/env')
      loadEnv({ path: envPath, env: 'production', keysFile: '.env.keys', overload: false, quiet: true })
    }
    catch {
      // No private key on this machine (CI, a colleague's checkout): fall back
      // to the plain values so unencrypted entries still load. Encrypted ones
      // stay ciphertext, which the caller reports rather than prints as a
      // usable secret.
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0 && !line.startsWith('#')) {
          const key = line.slice(0, eq).trim()
          const value = line.slice(eq + 1).trim()
          if (!process.env[key])
            process.env[key] = value
        }
      }
    }
  }


  // Load AWS credentials from ~/.aws/credentials if not in env
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const awsCredsPath = `${home}/.aws/credentials`
    if (existsSync(awsCredsPath)) {
      const credsContent = readFileSync(awsCredsPath, 'utf-8')
      const profile = process.env.AWS_PROFILE || 'default'
      const lines = credsContent.split('\n')
      let inProfile = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('[')) {
          inProfile = trimmed === `[${profile}]`
          continue
        }
        if (inProfile && trimmed.includes('=')) {
          const eq = trimmed.indexOf('=')
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim()
          if (key === 'aws_access_key_id') process.env.AWS_ACCESS_KEY_ID = value
          if (key === 'aws_secret_access_key') process.env.AWS_SECRET_ACCESS_KEY = value
        }
      }
    }
  }
}

function printPort25Status(result: string, provider: string, ip: string): void {
  console.log('')
  console.log('==========================================================')
  console.log('  PORT 25 STATUS')
  console.log('==========================================================')
  console.log('')
  console.log(`  Provider:  ${provider}`)
  console.log(`  Server IP: ${ip}`)

  if (result.includes('PORT_25_OPEN')) {
    console.log(`  Port 25:   \x1b[32mOPEN\x1b[0m`)
    console.log('')
    console.log('  Direct SMTP delivery is available!')
    console.log('  Set SMTP_DELIVERY_METHOD=direct in your server env.')
  } else {
    console.log(`  Port 25:   \x1b[31mBLOCKED\x1b[0m`)
    console.log('')
    console.log(`  Run: buddy mail:port25:request --provider ${provider.toLowerCase()}`)
  }

  console.log('')
  console.log('==========================================================')
  console.log('')
}

/**
 * Request AWS to remove EC2 port 25 restriction.
 *
 * AWS requires this via their web form or Support API (Business plan+).
 * We try the Support API first, then fall back to opening the web form.
 */
async function requestAwsPort25(
  options: { instanceId?: string; elasticIp?: string; rdns?: string; useCase?: string },
  domain: string,
): Promise<void> {
  const region = process.env.AWS_REGION || 'us-east-1'
  const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

  // Auto-detect instance ID and Elastic IP if not provided
  let instanceId = options.instanceId
  let elasticIp = options.elasticIp

  if (!instanceId || !elasticIp) {
    try {
      const { EC2Client } = await import('@stacksjs/ts-cloud')
      const ec2 = new EC2Client(region)
      const data = await ec2.describeInstances({
        Filters: [
          { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
          { Name: 'instance-state-name', Values: ['running'] },
        ],
      })

      const instance = data.Reservations?.[0]?.Instances?.[0]
      if (instance) {
        instanceId = instanceId || instance.InstanceId
        elasticIp = elasticIp || instance.PublicIpAddress
      }
    } catch {
      // Continue without auto-detection
    }
  }

  const rdns = options.rdns || `mail.${domain}`
  const useCase = options.useCase || [
    `We run a self-hosted mail server (mail.${domain}) for our organization.`,
    'We send transactional emails (account notifications, password resets) and',
    'occasional team communication. Expected volume: <1000 emails/day.',
    'We have SPF, DKIM, and DMARC configured. We need outbound port 25',
    'to deliver email directly to recipient mail servers via MX records.',
  ].join(' ')

  console.log('')
  console.log('==========================================================')
  console.log('  AWS PORT 25 UNBLOCK REQUEST')
  console.log('==========================================================')
  console.log('')
  console.log(`  Instance:    ${instanceId || '(not detected)'}`)
  console.log(`  Elastic IP:  ${elasticIp || '(not detected)'}`)
  console.log(`  Reverse DNS: ${rdns}`)
  console.log(`  Region:      ${region}`)
  console.log('')

  // Try Support API first (requires Business/Enterprise support plan)
  try {
    const result = execSync(
      `aws support create-case \
        --subject "Request to remove email sending limitations" \
        --communication-body "${useCase}\n\nElastic IP: ${elasticIp || 'N/A'}\nInstance ID: ${instanceId || 'N/A'}\nReverse DNS: ${rdns}\nRegion: ${region}" \
        --service-code "amazon-ec2" \
        --category-code "port-25-throttle" \
        --severity-code "normal" \
        --cc-email-addresses "" \
        --language "en" \
        --region us-east-1 2>&1`,
      { encoding: 'utf-8' },
    )

    if (result.includes('caseId')) {
      try {
        const caseId = JSON.parse(result).caseId
        log.success(`Support case created: ${caseId}`)
        log.info('')
        log.info('  AWS will process this within 24-48 hours.')
        log.info('  Check status: aws support describe-cases --region us-east-1')
        log.info('')
        process.exit(ExitCode.Success)
      }
      catch {
        log.error('Failed to parse AWS support case response')
      }
    }
  } catch {
    // Support API not available (no Business plan) — fall back to web form
  }

  // Also set up Reverse DNS via the EC2 API (this is separate and always available)
  if (elasticIp) {
    log.info('Setting up reverse DNS (rDNS) for Elastic IP...')
    try {
      // First, get the allocation ID for the Elastic IP
      const allocResult = execSync(
        `aws ec2 describe-addresses --public-ips ${elasticIp} --region ${region} --query 'Addresses[0].AllocationId' --output text 2>&1`,
        { encoding: 'utf-8' },
      ).trim()

      if (allocResult && !allocResult.includes('error')) {
        // Request rDNS update
        execSync(
          `aws ec2 modify-address-attribute --allocation-id ${allocResult} --domain-name ${rdns} --region ${region} 2>&1`,
          { encoding: 'utf-8' },
        )
        log.success(`Reverse DNS requested: ${elasticIp} -> ${rdns}`)
        console.log('  (rDNS propagation may take a few minutes)')
      }
    } catch (error: unknown) {
      log.warn(`rDNS setup failed: ${getErrorMessage(error)}`)
      console.log('  You may need to set this up manually in the AWS console.')
    }
  }

  // Fall back to web form
  console.log('')
  console.log('  The Support API requires a Business or Enterprise support plan.')
  console.log('  Opening the AWS web form instead...')
  console.log('')
  console.log('  Fill in these details:')
  console.log('  ──────────────────────────────────────────────────────')
  console.log(`  Email address:    admin@${domain}`)
  console.log(`  Use case:         Sending outbound email from self-hosted mail server`)
  console.log(`  Elastic IP:       ${elasticIp || '(enter your Elastic IP)'}`)
  console.log(`  rDNS:             ${rdns}`)
  console.log(`  Region:           ${region}`)
  console.log('  ──────────────────────────────────────────────────────')
  console.log('')

  const formUrl = 'https://console.aws.amazon.com/support/contacts#/rdns-limits'
  try {
    execSync(`open "${formUrl}" 2>/dev/null || xdg-open "${formUrl}" 2>/dev/null || echo ""`, { encoding: 'utf-8' })
    log.info(`Opened: ${formUrl}`)
  } catch {
    console.log(`  Open this URL in your browser:`)
    console.log(`  ${formUrl}`)
  }

  console.log('')
  console.log('  After AWS approves (24-48 hours), verify with:')
  console.log('    buddy mail:port25:status')
  console.log('')

  process.exit(ExitCode.Success)
}

/**
 * Request Hetzner to unblock port 25.
 *
 * Uses Hetzner Robot API to create a support request.
 */
async function requestHetznerPort25(
  options: { serverId?: string; rdns?: string; useCase?: string },
  domain: string,
): Promise<void> {
  const hetznerToken = process.env.HETZNER_API_TOKEN
  if (!hetznerToken) {
    log.error('HETZNER_API_TOKEN not set. Add it to .env or set it as an environment variable.')
    process.exit(ExitCode.FatalError)
  }

  // Auto-detect server
  let serverId = options.serverId
  let serverIp = ''
  let serverName = ''

  try {
    const res = await fetch('https://api.hetzner.cloud/v1/servers', {
      headers: { Authorization: `Bearer ${hetznerToken}` },
    })
    const data = await res.json() as any
    const mailServer = data.servers?.find((s: any) => s.name?.includes('mail'))
      || data.servers?.[0]

    if (mailServer) {
      serverId = serverId || String(mailServer.id)
      serverIp = mailServer.public_net?.ipv4?.ip || ''
      serverName = mailServer.name || ''
    }
  } catch {
    // Continue without auto-detection
  }

  const rdns = options.rdns || `mail.${domain}`
  const useCase = options.useCase || [
    `Self-hosted mail server for ${domain}.`,
    'Transactional + team email, <1000 emails/day.',
    'SPF/DKIM/DMARC configured.',
  ].join(' ')

  console.log('')
  console.log('==========================================================')
  console.log('  HETZNER PORT 25 UNBLOCK REQUEST')
  console.log('==========================================================')
  console.log('')
  console.log(`  Server:     ${serverName} (ID: ${serverId || 'unknown'})`)
  console.log(`  Server IP:  ${serverIp || '(not detected)'}`)
  console.log(`  rDNS:       ${rdns}`)
  console.log('')

  // Step 1: Set reverse DNS on the server IP
  if (serverId && serverIp) {
    log.info('Setting reverse DNS...')
    try {
      const rdnsRes = await fetch(
        `https://api.hetzner.cloud/v1/servers/${serverId}/actions/change_dns_ptr`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hetznerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ip: serverIp, dns_ptr: rdns }),
        },
      )
      const rdnsData = await rdnsRes.json() as any

      if (rdnsData.action?.status === 'running' || rdnsData.action?.status === 'success') {
        log.success(`Reverse DNS set: ${serverIp} -> ${rdns}`)
      } else {
        log.warn(`rDNS response: ${JSON.stringify(rdnsData.error || rdnsData)}`)
      }
    } catch (error: unknown) {
      log.warn(`rDNS failed: ${getErrorMessage(error)}`)
    }
  }

  // Step 2: Hetzner doesn't have a public API for port 25 unblock requests.
  // The user needs to submit via the Hetzner Cloud Console or Robot.
  console.log('')
  console.log('  To request port 25 unblock from Hetzner:')
  console.log('  ──────────────────────────────────────────────────────')
  console.log('  1. Log in to https://console.hetzner.cloud')
  console.log(`  2. Select project containing server "${serverName}"`)
  console.log('  3. Go to Support (left sidebar) -> New support request')
  console.log('  4. Use this template:')
  console.log('')
  console.log('     Subject: Request to unblock outbound port 25 (SMTP)')
  console.log('')
  console.log('     Body:')
  console.log('     ─────')
  console.log(`     Server: ${serverName} (ID: ${serverId}, IP: ${serverIp})`)
  console.log(`     Use case: ${useCase}`)
  console.log(`     Reverse DNS: ${serverIp} -> ${rdns}`)
  console.log('     We comply with all anti-spam regulations (CAN-SPAM, GDPR).')
  console.log('     Please unblock outbound ports 25 and 465 for this server.')
  console.log('     ─────')
  console.log('')
  console.log('  ──────────────────────────────────────────────────────')

  // Try to open the console
  const consoleUrl = 'https://console.hetzner.cloud'
  try {
    execSync(`open "${consoleUrl}" 2>/dev/null || xdg-open "${consoleUrl}" 2>/dev/null || echo ""`, { encoding: 'utf-8' })
    log.info(`Opened: ${consoleUrl}`)
  } catch {
    console.log(`  Open: ${consoleUrl}`)
  }

  console.log('')
  console.log('  After Hetzner approves, verify with:')
  console.log('    buddy mail:port25:status --provider hetzner')
  console.log('')

  process.exit(ExitCode.Success)
}
