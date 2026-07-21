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

function encryptedEnvContent(envContent: string, publicKey: string, publicKeyName: string, options: Pick<EncryptOptions, 'key' | 'excludeKey'>): string {
  const encryptedLines: string[] = [
    '#/-------------------[DOTENV_PUBLIC_KEY]--------------------/',
    '#/       versioned X25519 encryption for .env files         /',
    '#/       [how it works](https://stacksjs.com/encryption)   /',
    '#/----------------------------------------------------------/',
    `${publicKeyName}="${publicKey}"`,
    '',
  ]

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      encryptedLines.push(line)
      continue
    }
    if (trimmed.startsWith('DOTENV_PUBLIC_KEY')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match || match[1] === undefined || match[2] === undefined) {
      encryptedLines.push(line)
      continue
    }
    const key = match[1].trim()
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith(`'`) && value.endsWith(`'`)))
      value = value.slice(1, -1)
    const selected = (!options.key || key.includes(options.key)) && (!options.excludeKey || !key.includes(options.excludeKey))
    if (selected && !value.startsWith('encrypted:')) value = encryptValue(value, publicKey)
    encryptedLines.push(`${key}="${value}"`)
  }
  return encryptedLines.join('\n')
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

    if (existsSync(keysPath)) {
      const keysContent = readFileSync(keysPath, 'utf-8')
      const { parsed } = parse(keysContent)

      // Extract environment name from file path (basename only)
      const envFileName = options.file || '.env'
      const baseName = envFileName.split('/').pop() || ''
      const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
      const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
      const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

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
      const envFileName = options.file || '.env'
      const baseName = envFileName.split('/').pop() || ''
      const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
      const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
      const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

      const keysContent = `# .env.keys - Keep this file secure and never commit to source control\n${publicKeyName}="${publicKey}"\n${privateKeyName}="${privateKey}"\n`
      writeFileSync(keysPath, keysContent, 'utf-8')
    }

    const envContent = readFileSync(envPath, 'utf-8')
    const env = options.file ? options.file.replace(/^\.env\./, '').toUpperCase() : ''
    const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
    const output = encryptedEnvContent(envContent, publicKey, publicKeyName, options)

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
        value = decryptValue(value, privateKey)
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

      if (!hasMatchingPrivateKey) {
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

/**
 * Rotate keypair and re-encrypt all values
 */
export function rotateKeypair(
  options: { file?: string, keysFile?: string, key?: string, excludeKey?: string, stdout?: boolean, cwd?: string } = {},
): { success: boolean, output?: string, error?: string } {
  // First decrypt
  const decryptResult = decryptEnv({
    file: options.file,
    keysFile: options.keysFile,
    stdout: true,
    cwd: options.cwd,
  })

  if (!decryptResult.success) {
    return decryptResult
  }

  const cwd = options.cwd || process.cwd()
  const envPath = resolve(cwd, options.file || '.env')
  const keysPath = resolve(cwd, options.keysFile || '.env.keys')

  if (decryptResult.output === undefined) return { success: false, error: 'Rotation produced no decrypted content' }
  const keypair = generateKeypair()
  const originalEnv = readFileSync(envPath)
  const originalKeys = readFileSync(keysPath)
  const lines = originalKeys.toString('utf8').split('\n')
  const envFileName = options.file || '.env'
  const env = basename(envFileName).replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
  const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
  const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'
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
  const nextKeys = `${lines.join('\n').replace(/\n+$/, '')}\n`
  const nextEnv = encryptedEnvContent(decryptResult.output, keypair.publicKey, publicKeyName, options)

  const token = `${process.pid}-${Date.now()}`
  const envTemp = resolve(dirname(envPath), `.${basename(envPath)}.${token}.rotate`)
  const keysTemp = resolve(dirname(keysPath), `.${basename(keysPath)}.${token}.rotate`)
  try {
    writeFileSync(envTemp, nextEnv, { encoding: 'utf8', mode: 0o600 })
    writeFileSync(keysTemp, nextKeys, { encoding: 'utf8', mode: 0o600 })
    if (options.stdout) {
      renameSync(keysTemp, keysPath)
      return { success: true, output: nextEnv }
    }
    renameSync(envTemp, envPath)
    try {
      renameSync(keysTemp, keysPath)
    }
    catch (error) {
      writeFileSync(envPath, originalEnv)
      throw error
    }
    return { success: true, output: `✔ rotated (${options.file || '.env'}) to encrypted:v2` }
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
