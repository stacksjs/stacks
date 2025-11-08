/**
 * CLI commands for .env encryption/decryption
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

    // Load and encrypt .env file
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    const encryptedLines: string[] = []

    // Add header with public key
    const env = options.file ? options.file.replace(/^\.env\./, '').toUpperCase() : ''
    const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'

    encryptedLines.push('#/-------------------[DOTENV_PUBLIC_KEY]--------------------/')
    encryptedLines.push('#/            public-key encryption for .env files          /')
    encryptedLines.push('#/       [how it works](https://stacksjs.org/encryption)   /')
    encryptedLines.push('#/----------------------------------------------------------/')
    encryptedLines.push(`${publicKeyName}="${publicKey}"`)
    encryptedLines.push('')

    for (const line of lines) {
      const trimmed = line.trim()

      // Keep comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        encryptedLines.push(line)
        continue
      }

      // Skip existing public key lines
      if (trimmed.startsWith('DOTENV_PUBLIC_KEY')) {
        continue
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (!match) {
        encryptedLines.push(line)
        continue
      }

      const key = match[1].trim()
      let value = match[2].trim()

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      // Check if key should be encrypted
      let shouldEncrypt = true

      if (options.key && !key.match(new RegExp(options.key))) {
        shouldEncrypt = false
      }

      if (options.excludeKey && key.match(new RegExp(options.excludeKey))) {
        shouldEncrypt = false
      }

      // Skip if already encrypted
      if (value.startsWith('encrypted:')) {
        shouldEncrypt = false
      }

      if (shouldEncrypt) {
        value = encryptValue(value, publicKey)
      }

      encryptedLines.push(`${key}="${value}"`)
    }

    const output = encryptedLines.join('\n')

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
      if (!match) {
        decryptedLines.push(line)
        continue
      }

      const key = match[1].trim()
      let value = match[2].trim()

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      // Check if key should be decrypted
      let shouldDecrypt = value.startsWith('encrypted:')

      if (options.key && !key.match(new RegExp(options.key))) {
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

  try {
    let content = ''
    if (existsSync(envPath)) {
      content = readFileSync(envPath, 'utf-8')
    }

    const lines = content.split('\n')
    let found = false
    let publicKey: string | undefined

    // First pass: find public key
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('DOTENV_PUBLIC_KEY=')) {
        const match = trimmed.match(/^DOTENV_PUBLIC_KEY=["']?([^"'\n]+)["']?/)
        if (match) {
          publicKey = match[1]
        }
        break
      }
    }

    // If no public key and encryption requested, generate one
    if (!options.plain && !publicKey) {
      const keysPath = resolve(cwd, options.keysFile || '.env.keys')
      const keypair = generateKeypair()
      publicKey = keypair.publicKey

      // Save keys
      let keysContent = ''
      if (existsSync(keysPath)) {
        keysContent = readFileSync(keysPath, 'utf-8')
      }

      const envFileName = options.file || '.env'
      const baseName = envFileName.split('/').pop() || ''
      const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
      const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
      const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

      keysContent += `\n${publicKeyName}="${keypair.publicKey}"\n${privateKeyName}="${keypair.privateKey}"\n`
      writeFileSync(keysPath, keysContent, 'utf-8')

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
      const line = lines[i].trim()
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

    if (existsSync(keysPath)) {
      const keysContent = readFileSync(keysPath, 'utf-8')
      const { parsed: keys } = parse(keysContent)

      const envFileName = options.file || '.env'
      const baseName = envFileName.split('/').pop() || ''
      const env = baseName.replace(/^\.env\./, '').replace(/^\.env$/, '').toUpperCase()
      const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'
      privateKey = keys[privateKeyName]
    }

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

  // Write decrypted content temporarily
  if (decryptResult.output) {
    writeFileSync(envPath, decryptResult.output, 'utf-8')
  }

  // Generate new keypair
  const keypair = generateKeypair()

  // Update keys file
  const keysContent = readFileSync(keysPath, 'utf-8')
  const lines = keysContent.split('\n')

  const env = options.file ? options.file.replace(/^\.env\./, '').toUpperCase() : ''
  const publicKeyName = env ? `DOTENV_PUBLIC_KEY_${env}` : 'DOTENV_PUBLIC_KEY'
  const privateKeyName = env ? `DOTENV_PRIVATE_KEY_${env}` : 'DOTENV_PRIVATE_KEY'

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${publicKeyName}=`)) {
      lines[i] = `${publicKeyName}="${keypair.publicKey}"`
    }
    else if (lines[i].startsWith(`${privateKeyName}=`)) {
      lines[i] = `${privateKeyName}="${keypair.privateKey}"`
    }
  }

  writeFileSync(keysPath, lines.join('\n'), 'utf-8')

  // Re-encrypt with new keypair
  return encryptEnv({
    file: options.file,
    keysFile: options.keysFile,
    key: options.key,
    excludeKey: options.excludeKey,
    stdout: options.stdout,
    cwd: options.cwd,
  })
}
