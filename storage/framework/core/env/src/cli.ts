/**
 * CLI commands for .env encryption/decryption
 */

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { decryptValue, encryptValue, generateKeypair } from './crypto'
import { parse } from './parser'

export interface EncryptOptions {
  file?: string
  keysFile?: string
  key?: string // Specific key to encrypt
  excludeKey?: string // Key pattern to exclude
  stdout?: boolean
  cwd?: string
}

export interface DecryptOptions {
  file?: string
  keysFile?: string
  key?: string // Specific key to decrypt
  stdout?: boolean
  cwd?: string
}

export interface SetOptions {
  file?: string
  keysFile?: string
  plain?: boolean // Don't encrypt the value
  cwd?: string
}

export interface GetOptions {
  file?: string
  keysFile?: string
  all?: boolean
  format?: 'json' | 'shell' | 'eval'
  prettyPrint?: boolean
  cwd?: string
}

/**
 * Decide which env file a command should act on.
 *
 * `buddy` carries a global `--env <environment>` flag, and reaching for it is
 * the obvious way to say "this secret belongs to production". The env commands
 * only ever read `-f/--file` though, so `buddy env:set KEY value --env
 * production` wrote to `.env` — accepted, no warning, wrong file. The value
 * then sat in the development env encrypted against a production key nobody
 * holds locally, which surfaces much later as a decryption warning rather than
 * as the mis-targeted write it actually was.
 *
 * `--file` still wins when given, since it names a path outright. `development`
 * (and an unset environment) keeps the plain `.env` convention, and returns the
 * empty string so callers fall through to their own defaults unchanged.
 */
export function resolveEnvFile(file?: string, environment?: string): string {
  if (file)
    return file

  const name = String(environment ?? '').trim()
  if (!name || name === 'development' || name === 'dev' || name === 'local')
    return ''

  // Environments name files, so anything that could escape the project root or
  // name a different file entirely is not an environment.
  if (!/^[\w.-]+$/.test(name))
    return ''

  return `.env.${name}`
}

/**
 * Whether `--key` / `--exclude-key` select this variable.
 *
 * Shared so `env:rotate --dry-run` counts exactly the values a real rotation
 * would re-encrypt, rather than a second opinion that can drift from it.
 */
function inEncryptScope(key: string, options: Pick<EncryptOptions, 'key' | 'excludeKey'>): boolean {
  return (!options.key || key.includes(options.key)) && (!options.excludeKey || !key.includes(options.excludeKey))
}

/** The variables in a decrypted env body that an encrypt pass would rewrite. */
function encryptableKeys(envContent: string, options: Pick<EncryptOptions, 'key' | 'excludeKey'>): string[] {
  const keys: string[] = []
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('DOTENV_PUBLIC_KEY')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match || match[1] === undefined) continue
    const key = match[1].trim()
    if (inEncryptScope(key, options)) keys.push(key)
  }
  return keys
}

function encryptedEnvContent(envContent: string, publicKey: string, publicKeyName: string, options: Pick<EncryptOptions, 'key' | 'excludeKey'>): string {
  const encryptedLines: string[] = [
    '#/-------------------[DOTENV_PUBLIC_KEY]--------------------/',
    '#/       versioned X25519 encryption for .env files         /',
    '#/       [how it works](https://stacksjs.com/encryption)   /',
    '#/----------------------------------------------------------/',
    `${publicKeyName}="${publicKey}"`,
    '',
  ]

  // Encrypting is not a one-time act: `env:set` re-encrypts, and so does every
  // deploy. Anything this function ADDS has to be removed from its own output
  // first, or the file grows a little on each pass — the header stacked up once
  // per run, and a blank line after it every time on top of that.
  let seenBody = false

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#/')) continue
    if (trimmed.startsWith('DOTENV_PUBLIC_KEY')) continue
    // The blank the header block already ends with.
    if (!trimmed && !seenBody) continue
    if (!trimmed || trimmed.startsWith('#')) {
      seenBody = true
      encryptedLines.push(line)
      continue
    }
    seenBody = true
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match || match[1] === undefined || match[2] === undefined) {
      encryptedLines.push(line)
      continue
    }
    const key = match[1].trim()
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith(`'`) && value.endsWith(`'`)))
      value = value.slice(1, -1)
    const selected = inEncryptScope(key, options)
    if (selected && !value.startsWith('encrypted:')) value = encryptValue(value, publicKey)
    encryptedLines.push(`${key}="${value}"`)
  }
  return encryptedLines.join('\n')
}

/**
 * The key names an env file's keypair is stored under: `.env.production` →
 * `DOTENV_{PUBLIC,PRIVATE}_KEY_PRODUCTION`, plain `.env` → the unsuffixed pair.
 *
 * One helper because it was two, and they disagreed. The keys file was written
 * from the basename (`.env` → no suffix, `secrets/.env.production` →
 * `_PRODUCTION`), while the header written INTO the encrypted file was derived
 * from the raw option (`.env` → `_.ENV`, a path → `_SECRETS/.ENV.PRODUCTION`).
 * A file encrypted that way names a public key that does not exist in
 * `.env.keys`, so nothing can find the private half and every value in it is
 * lost — and only for callers who passed `--file` explicitly, which is why it
 * survived: the default path agreed with itself.
 */
export function envKeyNames(file?: string): { publicKeyName: string, privateKeyName: string } {
  const baseName = (file || '.env').split('/').pop() || ''
  const suffix = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()

  return {
    publicKeyName: suffix ? `DOTENV_PUBLIC_KEY_${suffix}` : 'DOTENV_PUBLIC_KEY',
    privateKeyName: suffix ? `DOTENV_PRIVATE_KEY_${suffix}` : 'DOTENV_PRIVATE_KEY',
  }
}

/**
 * The public key an env file's existing ciphertext was encrypted under.
 *
 * Encrypting needs only the PUBLIC half, and an encrypted env file already
 * carries it on its `DOTENV_PUBLIC_KEY*` line. Resolving the keypair from
 * `.env.keys` instead is what let one file end up holding two generations at
 * once (stacksjs/stacks#2348):
 *
 *   `.env.keys` is gitignored, so on a CI runner it does not exist. The private
 *   key arrives as `DOTENV_PRIVATE_KEY_<ENV>` in the environment, which this
 *   path never consulted. A file with any plaintext line therefore got a
 *   BRAND NEW keypair, its four plaintext values encrypted under generation 2,
 *   its public-key line replaced with generation 2's, and a fresh `.env.keys`
 *   written. The thirty-three values already encrypted under generation 1 were
 *   left behind, decryptable by a key the file no longer names.
 *
 * Reusing the file's own public key makes that structurally impossible: every
 * value in the file stays under one key, and the operator's existing private
 * key keeps working.
 *
 * Only reused when the file actually holds ciphertext. A scaffolded file can
 * ship a demo `DOTENV_PUBLIC_KEY` whose private half was never generated, and
 * encrypting real secrets under that would make them permanently unreadable.
 * With no ciphertext there is nothing to stay consistent with, so a fresh
 * keypair is both safe and correct.
 */
export function reusableEnvPublicKey(envContent: string, publicKeyName: string): string | undefined {
  let publicKey: string | undefined
  let hasCiphertext = false

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue

    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match?.[1] || match[2] === undefined)
      continue

    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')

    if (key === publicKeyName)
      publicKey = value
    else if (value.startsWith('encrypted:') || value.startsWith('enc:'))
      hasCiphertext = true
  }

  return publicKey && hasCiphertext ? publicKey : undefined
}

/**
 * Encrypt .env file
 */
export function encryptEnv(options: EncryptOptions = {}): { success: boolean, output?: string, error?: string } {
  const cwd = options.cwd || process.cwd()
  const envPath = resolve(cwd, options.file || '.env')
  const keysPath = resolve(cwd, options.keysFile || '.env.keys')

  if (!existsSync(envPath)) {
    return { success: false, error: `File not found: ${envPath}` }
  }

  try {
    // Load or generate keys
    let publicKey: string
    let privateKey: string

    // The file's own public key wins. See reusableEnvPublicKey: resolving from
    // `.env.keys` alone is what produced a file holding two key generations.
    const existingPublicKey = reusableEnvPublicKey(
      readFileSync(envPath, 'utf-8'),
      envKeyNames(options.file).publicKeyName,
    )

    if (existingPublicKey) {
      // Deliberately no write to `.env.keys`: we hold only the public half, and
      // inventing a private key to sit beside it would be a lie on disk.
      publicKey = existingPublicKey
    }
    else if (existsSync(keysPath)) {
      const keysContent = readFileSync(keysPath, 'utf-8')
      const { parsed } = parse(keysContent)

      const { publicKeyName, privateKeyName } = envKeyNames(options.file)

      publicKey = parsed[publicKeyName] || ''
      privateKey = parsed[privateKeyName] || ''

      if (!publicKey || !privateKey) {
        // Generate new keypair
        const keypair = generateKeypair()
        publicKey = keypair.publicKey
        privateKey = keypair.privateKey

        // Append to keys file
        const newKeys = `\n${publicKeyName}="${publicKey}"\n${privateKeyName}="${privateKey}"\n`
        writeFileSync(keysPath, keysContent + newKeys, 'utf-8')
      }
    }
    else {
      // Generate new keypair
      const keypair = generateKeypair()
      publicKey = keypair.publicKey
      privateKey = keypair.privateKey

      // Create keys file
      const { publicKeyName, privateKeyName } = envKeyNames(options.file)

      const keysContent = `# .env.keys - Keep this file secure and never commit to source control\n${publicKeyName}="${publicKey}"\n${privateKeyName}="${privateKey}"\n`
      writeFileSync(keysPath, keysContent, 'utf-8')
    }

    const envContent = readFileSync(envPath, 'utf-8')
    // The SAME name the keypair was stored under above — see envKeyNames.
    const output = encryptedEnvContent(envContent, publicKey, envKeyNames(options.file).publicKeyName, options)

    if (options.stdout) {
      return { success: true, output }
    }

    // Write encrypted content back to file
    writeFileSync(envPath, output, 'utf-8')

    return {
      success: true,
      output: `✔ encrypted (${options.file || '.env'})\n✔ key added to ${options.keysFile || '.env.keys'}`,
    }
  }
  catch (error) {
    return {
      success: false,
      error: `Failed to encrypt: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Decrypt .env file
 */
export function decryptEnv(options: DecryptOptions = {}): { success: boolean, output?: string, error?: string } {
  const cwd = options.cwd || process.cwd()
  const envPath = resolve(cwd, options.file || '.env')
  const keysPath = resolve(cwd, options.keysFile || '.env.keys')

  if (!existsSync(envPath)) {
    return { success: false, error: `File not found: ${envPath}` }
  }

  if (!existsSync(keysPath)) {
    return { success: false, error: `Keys file not found: ${keysPath}` }
  }

  try {
    // Load private key
    const keysContent = readFileSync(keysPath, 'utf-8')
    const { parsed: keys } = parse(keysContent)

    // Extract environment name from file path (basename only)
    const envFileName = options.file || '.env'
    const baseName = envFileName.split('/').pop() || ''
    const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
    const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'
    const privateKey = keys[privateKeyName]

    if (!privateKey) {
      return { success: false, error: `Private key not found: ${privateKeyName}` }
    }

    // Older production files could be encrypted partly with the unsuffixed
    // project key and partly with the environment-specific key. Keep both
    // candidates available so `env:rotate` can migrate that mixed file into
    // one current keypair without ever writing its plaintext to disk.
    const privateKeys = [privateKey]
    if (privateKeyName !== 'DOTENV_PRIVATE_KEY' && keys.DOTENV_PRIVATE_KEY && keys.DOTENV_PRIVATE_KEY !== privateKey)
      privateKeys.push(keys.DOTENV_PRIVATE_KEY)

    // Load and decrypt .env file
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    const decryptedLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Keep comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        decryptedLines.push(line)
        continue
      }

      // Skip public key lines
      if (trimmed.startsWith('DOTENV_PUBLIC_KEY')) {
        continue
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (!match || match[1] === undefined || match[2] === undefined) {
        decryptedLines.push(line)
        continue
      }

      const key = match[1].trim()
      let value = match[2].trim()

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith(`'`) && value.endsWith(`'`))) {
        value = value.slice(1, -1)
      }

      // Check if key should be decrypted
      let shouldDecrypt = value.startsWith('encrypted:')

      if (options.key && !key.includes(options.key)) {
        shouldDecrypt = false
      }

      if (shouldDecrypt) {
        let decrypted: string | undefined
        let lastError: unknown
        for (const candidate of privateKeys) {
          try {
            decrypted = decryptValue(value, candidate)
            break
          }
          catch (error) {
            lastError = error
          }
        }
        if (decrypted === undefined)
          throw lastError instanceof Error ? lastError : new Error(`Unable to decrypt ${key}`)
        value = decrypted
      }

      decryptedLines.push(`${key}="${value}"`)
    }

    const output = decryptedLines.join('\n')

    if (options.stdout) {
      return { success: true, output }
    }

    // Write decrypted content back to file
    writeFileSync(envPath, output, 'utf-8')

    return {
      success: true,
      output: `✔ decrypted (${options.file || '.env'})`,
    }
  }
  catch (error) {
    return {
      success: false,
      error: `Failed to decrypt: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Set an environment variable
 */
export function setEnv(
  key: string,
  value: string,
  options: SetOptions = {},
): { success: boolean, output?: string, error?: string } {
  const cwd = options.cwd || process.cwd()
  const envPath = resolve(cwd, options.file || '.env')
  const keysPath = resolve(cwd, options.keysFile || '.env.keys')

  try {
    let content = ''
    if (existsSync(envPath)) {
      content = readFileSync(envPath, 'utf-8')
    }

    const lines = content.split('\n')
    let found = false
    let publicKey: string | undefined

    // Extract environment name from file path (basename only), matching the
    // naming scheme encryptEnv/decryptEnv use (e.g. `.env.production` ->
    // `DOTENV_PUBLIC_KEY_PRODUCTION`), so we look for the right key line
    // instead of only ever matching the bare, unsuffixed `DOTENV_PUBLIC_KEY=`.
    const envFileName = options.file || '.env'
    const baseName = envFileName.split('/').pop() || ''
    const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
    const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
    const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

    // First pass: find public key for this file
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`${publicKeyName}=`)) {
        const match = trimmed.match(/^[^=]+=["']?([^"'\n]+)["']?/)
        if (match) {
          publicKey = match[1]
        }
        break
      }
    }

    // A public key found in the .env file is only usable if its matching
    // private key is actually saved in the keys file. Reusing a public key
    // whose private key was never generated/saved (e.g. a scaffolded .env
    // that ships a demo DOTENV_PUBLIC_KEY with no .env.keys, or a lost
    // .env.keys) would silently encrypt the value with a key nobody can
    // ever decrypt again.
    if (publicKey) {
      let hasMatchingPrivateKey = false
      if (existsSync(keysPath)) {
        const keysContent = readFileSync(keysPath, 'utf-8')
        const { parsed: keys } = parse(keysContent)
        hasMatchingPrivateKey = Boolean(keys[privateKeyName])
      }

      // Missing locally is not the same as missing. `.env.keys` is gitignored,
      // so it is absent on every CI runner, where the private key arrives as
      // `DOTENV_PRIVATE_KEY_<ENV>` in the environment instead. Discarding the
      // file's public key on that evidence regenerates a keypair and leaves the
      // file holding two generations, which is exactly the state that made 33
      // committed values undecryptable in stacksjs/stacks#2348.
      //
      // So the file's own ciphertext is the better witness: if there is any,
      // this public key is the one the rest of the file already uses and it has
      // to stay. Only when the file carries no ciphertext, and no private key is
      // reachable either way, is a fresh keypair the safe answer.
      if (!hasMatchingPrivateKey && !process.env[privateKeyName]
        && !reusableEnvPublicKey(content, publicKeyName)) {
        publicKey = undefined
      }
    }

    // If no usable keypair and encryption requested, generate one
    if (!options.plain && !publicKey) {
      const keypair = generateKeypair()
      publicKey = keypair.publicKey

      // Save keys
      let keysContent = ''
      if (existsSync(keysPath)) {
        keysContent = readFileSync(keysPath, 'utf-8')
      }

      keysContent += `\n${publicKeyName}="${keypair.publicKey}"\n${privateKeyName}="${keypair.privateKey}"\n`
      writeFileSync(keysPath, keysContent, 'utf-8')

      // Drop any stale/orphaned public key line(s) for this file before
      // adding the fresh one, so repeated regeneration can't pile up
      // duplicate DOTENV_PUBLIC_KEY* lines.
      for (let i = lines.length - 1; i >= 0; i--) {
        const lineEntry = lines[i]
        if (lineEntry !== undefined && lineEntry.trim().startsWith(`${publicKeyName}=`))
          lines.splice(i, 1)
      }

      // Add public key to .env file
      lines.unshift(`${publicKeyName}="${publicKey}"`)
    }

    // Encrypt value if needed
    let finalValue = value
    if (!options.plain && publicKey) {
      finalValue = encryptValue(value, publicKey)
    }

    // Second pass: update or add key
    for (let i = 0; i < lines.length; i++) {
      const lineEntry = lines[i]
      if (lineEntry === undefined) continue
      const line = lineEntry.trim()
      if (line.startsWith(`${key}=`)) {
        lines[i] = `${key}="${finalValue}"`
        found = true
        break
      }
    }

    if (!found) {
      lines.push(`${key}="${finalValue}"`)
    }

    const output = lines.join('\n')
    writeFileSync(envPath, output, 'utf-8')

    return {
      success: true,
      output: `set ${key}${options.plain ? '' : ' with encryption'} (${options.file || '.env'})`,
    }
  }
  catch (error) {
    return {
      success: false,
      error: `Failed to set: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get environment variable(s)
 */
export function getEnv(
  key?: string,
  options: GetOptions = {},
): { success: boolean, output?: string, error?: string } {
  const cwd = options.cwd || process.cwd()
  const envPath = resolve(cwd, options.file || '.env')

  if (!existsSync(envPath)) {
    return { success: false, error: `File not found: ${envPath}` }
  }

  try {
    // Load private key if available
    let privateKey: string | undefined
    const keysPath = resolve(cwd, options.keysFile || '.env.keys')

    const envFileName = options.file || '.env'
    const baseName = envFileName.split('/').pop() || ''
    const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
    const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

    if (existsSync(keysPath)) {
      const keysContent = readFileSync(keysPath, 'utf-8')
      const { parsed: keys } = parse(keysContent)
      privateKey = keys[privateKeyName]
    }

    // No .env.keys (or it lacks this env's key): fall back to the process
    // env, the dotenvx convention for CI runners and servers, where
    // .env.keys must never exist (it's the one file that can't be
    // committed). Without this fallback, `buddy deploy` from GitHub
    // Actions shipped still-encrypted `encrypted:...` ciphertext as every
    // site's .env and the app crash-looped on config validation
    // (stacksjs/status, 2026-07-04).
    if (!privateKey)
      privateKey = process.env[privateKeyName]

    // Load and parse .env file
    const envContent = readFileSync(envPath, 'utf-8')
    const { parsed } = parse(envContent, { privateKey })

    // Get specific key
    if (key && !options.all) {
      const value = parsed[key]
      if (value === undefined) {
        return { success: false, error: `Key not found: ${key}` }
      }

      return { success: true, output: value }
    }

    // Get all keys
    const result = options.all ? { ...process.env, ...parsed } : parsed

    // Format output
    let output: string

    switch (options.format) {
      case 'shell':
        output = Object.entries(result)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
        break

      case 'eval':
        output = Object.entries(result)
          .map(([k, v]) => `${k}="${v}"`)
          .join('\n')
        break

      case 'json':
      default:
        output = options.prettyPrint
          ? JSON.stringify(result, null, 2)
          : JSON.stringify(result)
        break
    }

    return { success: true, output }
  }
  catch (error) {
    return {
      success: false,
      error: `Failed to get: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get keypair for .env file
 */
export function getKeypair(
  keyName?: string,
  options: { file?: string, keysFile?: string, format?: 'json' | 'shell', cwd?: string } = {},
): { success: boolean, output?: string, error?: string } {
  const cwd = options.cwd || process.cwd()
  const keysPath = resolve(cwd, options.keysFile || '.env.keys')

  if (!existsSync(keysPath)) {
    return { success: false, error: `Keys file not found: ${keysPath}` }
  }

  try {
    const keysContent = readFileSync(keysPath, 'utf-8')
    const { parsed } = parse(keysContent)

    const envFileName = options.file || '.env'
    const baseName = envFileName.split('/').pop() || ''
    const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
    const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
    const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

    // Get specific key
    if (keyName) {
      const value = parsed[keyName]
      if (!value) {
        return { success: false, error: `Key not found: ${keyName}` }
      }

      return { success: true, output: value }
    }

    // Get keypair
    const keypair = {
      [publicKeyName]: parsed[publicKeyName],
      [privateKeyName]: parsed[privateKeyName],
    }

    const output = options.format === 'shell'
      ? `${publicKeyName}=${keypair[publicKeyName]} ${privateKeyName}=${keypair[privateKeyName]}`
      : JSON.stringify(keypair)

    return { success: true, output }
  }
  catch (error) {
    return {
      success: false,
      error: `Failed to get keypair: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export interface RotateOptions {
  file?: string
  keysFile?: string
  key?: string // Specific key to re-encrypt
  excludeKey?: string // Key pattern to exclude
  /**
   * Print the rotation instead of applying it. Writes nothing at all: the new
   * env content comes back as `output`, the new keypair as `notice`.
   */
  stdout?: boolean
  /** Report what would change. Writes nothing and generates no key material. */
  dryRun?: boolean
  cwd?: string
}

export interface RotateResult {
  success: boolean
  output?: string
  error?: string
  /**
   * Text for stderr rather than stdout, so a caller redirecting `--stdout`
   * captures only the env file while the keypair still reaches the operator.
   */
  notice?: string
}

/** Replace (or add) this file's keypair in a `.env.keys` body. */
function rotatedKeysContent(
  keysContent: string,
  keypair: { publicKey: string, privateKey: string },
  publicKeyName: string,
  privateKeyName: string,
): string {
  const lines = keysContent.split('\n')
  let replacedPublic = false
  let replacedPrivate = false
  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i]
    if (entry === undefined) continue
    if (entry.startsWith(`${publicKeyName}=`)) {
      lines[i] = `${publicKeyName}="${keypair.publicKey}"`
      replacedPublic = true
    }
    else if (entry.startsWith(`${privateKeyName}=`)) {
      lines[i] = `${privateKeyName}="${keypair.privateKey}"`
      replacedPrivate = true
    }
  }
  if (!replacedPublic) lines.push(`${publicKeyName}="${keypair.publicKey}"`)
  if (!replacedPrivate) lines.push(`${privateKeyName}="${keypair.privateKey}"`)
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

/**
 * Rotate an env file's keypair and re-encrypt every value under the new one.
 *
 * A rotation is only meaningful as a PAIR: the re-encrypted file and the
 * keypair that opens it have to land together, or one of them is useless.
 * `--stdout` used to break that pair - it replaced the keypair in `.env.keys`
 * and printed the new env content instead of writing it, so the file left on
 * disk was still encrypted under a private key that had just been overwritten,
 * and every value in it was unrecoverable (stacksjs/stacks#2398). It now writes
 * nothing and hands back both halves. `--dry-run` writes nothing either, and
 * does not even generate a keypair: a preview that produced real key material
 * and threw it away would be a rotation, not a preview.
 */
export function rotateKeypair(options: RotateOptions = {}): RotateResult {
  // Decrypt into memory. The `stdout: true` here is what keeps the plaintext
  // off disk, and is unrelated to this function's own `stdout` option.
  const decryptResult = decryptEnv({
    file: options.file,
    keysFile: options.keysFile,
    stdout: true,
    cwd: options.cwd,
  })

  if (!decryptResult.success) {
    return decryptResult
  }

  if (decryptResult.output === undefined) return { success: false, error: 'Rotation produced no decrypted content' }

  const cwd = options.cwd || process.cwd()
  const envFileName = options.file || '.env'
  const keysFileName = options.keysFile || '.env.keys'
  const envPath = resolve(cwd, envFileName)
  const keysPath = resolve(cwd, keysFileName)
  const { publicKeyName, privateKeyName } = envKeyNames(options.file)

  // Checked before `--stdout`, so asking for both gets the safer one.
  if (options.dryRun) {
    const values = encryptableKeys(decryptResult.output, options)
    return {
      success: true,
      output: [
        'Dry run: nothing was written.',
        `${envFileName}: ${values.length} value${values.length === 1 ? '' : 's'} would be re-encrypted under a new ${publicKeyName}.`,
        `${keysFileName}: ${publicKeyName} and ${privateKeyName} would be replaced.`,
        `The current ${privateKeyName} decrypts nothing once that happens, so keep a copy until the rotation is verified.`,
      ].join('\n'),
    }
  }

  const keypair = generateKeypair()
  const nextEnv = encryptedEnvContent(decryptResult.output, keypair.publicKey, publicKeyName, options)

  if (options.stdout) {
    return {
      success: true,
      output: nextEnv,
      notice: [
        `Nothing was written. To adopt the output above, put this keypair in ${keysFileName}:`,
        '',
        `${publicKeyName}="${keypair.publicKey}"`,
        `${privateKeyName}="${keypair.privateKey}"`,
        '',
        `Without it that output cannot be decrypted. Run without --stdout to have both applied together.`,
      ].join('\n'),
    }
  }

  const originalEnv = readFileSync(envPath)
  const originalKeys = readFileSync(keysPath)
  const nextKeys = rotatedKeysContent(originalKeys.toString('utf8'), keypair, publicKeyName, privateKeyName)

  const token = `${process.pid}-${Date.now()}`
  const envTemp = resolve(dirname(envPath), `.${basename(envPath)}.${token}.rotate`)
  const keysTemp = resolve(dirname(keysPath), `.${basename(keysPath)}.${token}.rotate`)
  try {
    writeFileSync(envTemp, nextEnv, { encoding: 'utf8', mode: 0o600 })
    writeFileSync(keysTemp, nextKeys, { encoding: 'utf8', mode: 0o600 })
    renameSync(envTemp, envPath)
    try {
      renameSync(keysTemp, keysPath)
    }
    catch (error) {
      writeFileSync(envPath, originalEnv)
      throw error
    }
    return { success: true, output: `✔ rotated (${envFileName}) to encrypted:v2` }
  }
  catch (error) {
    if (!existsSync(keysPath)) writeFileSync(keysPath, originalKeys, { mode: 0o600 })
    return { success: false, error: `Failed to rotate without exposing plaintext: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
  finally {
    rmSync(envTemp, { force: true })
    rmSync(keysTemp, { force: true })
  }
}
