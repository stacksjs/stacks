import type { CliOptions } from '@stacksjs/types'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'

const HOSTS_FILE = process.platform === 'win32'
  ? path.join(process.env.windir || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts'

const SSL_DIR = path.join(os.homedir(), '.stacks', 'ssl')

/**
 * Check if we're running in an interactive terminal
 */
function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

/**
 * Get sudo password from environment variable if set
 */
function getSudoPassword(): string | undefined {
  return process.env.SUDO_PASSWORD
}

/**
 * Check if we can run sudo commands (either interactive or have SUDO_PASSWORD)
 */
function canRunSudo(): boolean {
  return isInteractiveTerminal() || !!getSudoPassword()
}

export interface SSLSetupOptions extends CliOptions {
  domain?: string
  skipHosts?: boolean
  skipTrust?: boolean
}

/**
 * Check if a domain is in the hosts file
 */
export function isDomainInHosts(domain: string): boolean {
  try {
    const hostsContent = fs.readFileSync(HOSTS_FILE, 'utf-8')
    return hostsContent.includes(`127.0.0.1 ${domain}`) || hostsContent.includes(`::1 ${domain}`)
  }
  catch {
    // /etc/hosts may not be readable without sudo — use sudo cat if SUDO_PASSWORD is available
    if (process.platform !== 'win32') {
      const sudoPassword = getSudoPassword()
      if (sudoPassword) {
        try {
          const result = execSync(`echo '${sudoPassword}' | sudo -S cat "${HOSTS_FILE}" 2>/dev/null`, { encoding: 'utf-8' })
          return result.includes(`127.0.0.1 ${domain}`) || result.includes(`::1 ${domain}`)
        }
        catch {
          return false
        }
      }
    }
    return false
  }
}

/**
 * Add a domain to the hosts file (requires sudo on Unix)
 */
export async function addDomainToHosts(domain: string, verbose?: boolean): Promise<boolean> {
  if (isDomainInHosts(domain)) {
    if (verbose)
      log.info(`${domain} already in hosts file`)
    return true
  }

  const hostsEntry = `\n# Added by Stacks\n127.0.0.1 ${domain}\n::1 ${domain}\n`

  if (process.platform === 'win32') {
    // Windows: need to run as admin
    log.warn('Please add this to your hosts file manually:')
    log.warn(`127.0.0.1 ${domain}`)
    log.warn(`::1 ${domain}`)
    log.warn(`File location: ${HOSTS_FILE}`)
    return false
  }

  // Check if we can run sudo (either interactive or have password)
  if (!canRunSudo()) {
    if (verbose) {
      log.warn(`Cannot add ${domain} to hosts file (non-interactive mode and no SUDO_PASSWORD set)`)
      log.info('Run `buddy setup:ssl` in a terminal or set SUDO_PASSWORD environment variable')
    }
    return false
  }

  const sudoPassword = getSudoPassword()

  // Unix: use sudo
  return new Promise((resolve) => {

    let child
    if (sudoPassword) {
      // Use sudo -S to read password from stdin
      child = spawn('sh', ['-c', `echo '${sudoPassword}' | sudo -S sh -c "echo '${hostsEntry}' >> '${HOSTS_FILE}'"`], {
        stdio: ['pipe', 'inherit', 'inherit'],
      })
    }
    else {
      // Interactive mode - let user enter password
      child = spawn('sudo', ['sh', '-c', `echo '${hostsEntry}' >> "${HOSTS_FILE}"`], {
        stdio: 'inherit',
      })
    }

    child.on('close', (code) => {
      if (code === 0) {
        if (verbose)
          log.success(`Added ${domain} to hosts file`)
        resolve(true)
      }
      else {
        if (verbose) {
          log.error(`Failed to add ${domain} to hosts file`)
          log.warn(`Manually add: 127.0.0.1 ${domain}`)
        }
        resolve(false)
      }
    })

    child.on('error', () => {
      log.error('Failed to run sudo command')
      resolve(false)
    })
  })
}

/**
 * Check if SSL certificates exist for a domain
 */
export function sslCertificatesExist(domain: string): boolean {
  const certPath = path.join(SSL_DIR, `${domain}.crt`)
  const keyPath = path.join(SSL_DIR, `${domain}.key`)
  const caPath = path.join(SSL_DIR, `${domain}.ca.crt`)

  return fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caPath)
}

/**
 * Check if a certificate is trusted (macOS only for now)
 */
export function isCertificateTrusted(domain: string): boolean {
  if (process.platform !== 'darwin')
    return true // Assume trusted on other platforms

  const certPath = path.join(SSL_DIR, `${domain}.crt`)

  if (!fs.existsSync(certPath))
    return false

  try {
    // Get certificate fingerprint
    const fingerprint = execSync(`openssl x509 -noout -fingerprint -sha256 -in "${certPath}"`, { encoding: 'utf-8' })
    const fingerprintValue = fingerprint.split('=')[1]?.trim() || ''

    if (!fingerprintValue)
      return false

    // Check if fingerprint exists in keychain
    const keychainOutput = execSync('security find-certificate -a -Z -p | openssl x509 -noout -fingerprint -sha256 2>/dev/null || true', { encoding: 'utf-8' })

    return keychainOutput.includes(fingerprintValue)
  }
  catch {
    return false
  }
}

/**
 * Trust a certificate on macOS
 */
export async function trustCertificate(domain: string, verbose?: boolean): Promise<boolean> {
  const caCertPath = path.join(SSL_DIR, `${domain}.ca.crt`)
  const certPath = path.join(SSL_DIR, `${domain}.crt`)

  if (!fs.existsSync(caCertPath)) {
    log.error(`CA certificate not found: ${caCertPath}`)
    return false
  }

  // First check if already trusted to avoid unnecessary sudo prompts
  if (isCertificateTrusted(domain)) {
    if (verbose)
      log.info('Certificate is already trusted, skipping trust step')
    return true
  }

  // Check if we can run sudo (either interactive or have password)
  if (!canRunSudo()) {
    if (verbose) {
      log.warn('Cannot trust certificate (non-interactive mode and no SUDO_PASSWORD set)')
      log.info('Run `buddy setup:ssl` in a terminal or set SUDO_PASSWORD environment variable')
    }
    return false
  }

  const sudoPassword = getSudoPassword()

  if (process.platform === 'darwin') {
    return new Promise((resolve) => {

      // Combine both CA and host cert trust into a single sudo command to minimize password prompts
      const combinedCommand = `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '${caCertPath}' && security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '${certPath}'`

      let child
      if (sudoPassword) {
        // Use sudo -S to read password from stdin
        child = spawn('sh', ['-c', `echo '${sudoPassword}' | sudo -S sh -c "${combinedCommand}"`], {
          stdio: ['pipe', 'inherit', 'inherit'],
        })
      }
      else {
        // Interactive mode - combine both operations into a single sudo call
        child = spawn('sudo', ['sh', '-c', combinedCommand], {
          stdio: 'inherit',
        })
      }

      child.on('close', (code) => {
        if (code === 0) {
          // Also add host cert to login keychain (no sudo needed)
          try {
            execSync(`security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db "${certPath}" 2>/dev/null || true`)
          }
          catch {
            // Ignore login keychain errors
          }

          resolve(true)
        }
        else {
          if (verbose) {
            log.warn('Could not trust certificate automatically')
            log.info(`  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`)
          }
          resolve(false)
        }
      })

      child.on('error', () => {
        log.error('Failed to run sudo command')
        resolve(false)
      })
    })
  }
  else if (process.platform === 'linux') {
    return new Promise((resolve) => {

      const linuxCommands = `mkdir -p /usr/local/share/ca-certificates/stacks && cp '${caCertPath}' /usr/local/share/ca-certificates/stacks/ && update-ca-certificates`

      let child
      if (sudoPassword) {
        child = spawn('sh', ['-c', `echo '${sudoPassword}' | sudo -S sh -c "${linuxCommands}"`], {
          stdio: ['pipe', 'inherit', 'inherit'],
        })
      }
      else {
        child = spawn('sudo', ['sh', '-c', linuxCommands], {
          stdio: 'inherit',
        })
      }

      child.on('close', (code) => {
        if (code === 0) {
          log.success('Certificate trusted')
          resolve(true)
        }
        else {
          log.warn('Could not trust certificate automatically')
          resolve(false)
        }
      })

      child.on('error', () => resolve(false))
    })
  }
  else if (process.platform === 'win32') {
    log.warn('Please manually trust the certificate in Windows:')
    log.warn(`  1. Double-click: ${caCertPath}`)
    log.warn('  2. Click "Install Certificate"')
    log.warn('  3. Select "Local Machine" and place in "Trusted Root Certification Authorities"')
    return false
  }

  return false
}

/**
 * Generate SSL certificates for a domain using rpx
 */
export async function generateCertificates(domain: string, verbose?: boolean): Promise<boolean> {
  try {
    const tlsxModule = await import('@stacksjs/tlsx')
    const { generateCertificate, createRootCA } = tlsxModule
    const httpsConfig = (tlsxModule as any).httpsConfig

    // Ensure SSL directory exists
    if (!fs.existsSync(SSL_DIR)) {
      fs.mkdirSync(SSL_DIR, { recursive: true })
    }

    const config = {
      domain,
      hostCertCN: domain,
      basePath: SSL_DIR,
      caCertPath: path.join(SSL_DIR, `${domain}.ca.crt`),
      certPath: path.join(SSL_DIR, `${domain}.crt`),
      keyPath: path.join(SSL_DIR, `${domain}.key`),
      altNameIPs: ['127.0.0.1', '::1'],
      altNameURIs: ['localhost', domain],
      organizationName: 'Stacks Development',
      countryName: 'US',
      stateName: 'California',
      localityName: 'Playa Vista',
      commonName: domain,
      validityDays: 825,
      verbose: verbose || false,
      subjectAltNames: [
        { type: 2, value: domain },
        { type: 2, value: `*.${domain.split('.').slice(1).join('.')}` },
        { type: 2, value: 'localhost' },
        { type: 2, value: '*.localhost' },
      ],
    }

    if (verbose)
      log.info('Generating Root CA certificate...')

    const caCert = await createRootCA(config)

    if (verbose)
      log.info(`Generating host certificate for ${domain}...`)

    const hostCert = await generateCertificate({
      ...config,
      rootCA: {
        certificate: caCert.certificate,
        privateKey: caCert.privateKey,
      },
    })

    // Save certificates
    fs.writeFileSync(config.caCertPath, caCert.certificate)
    fs.writeFileSync(config.certPath, hostCert.certificate)
    fs.writeFileSync(config.keyPath, hostCert.privateKey)

    if (verbose)
      log.success(`SSL certificates generated for ${domain}`)
    return true
  }
  catch (error) {
    log.error(`Failed to generate certificates: ${error}`)
    return false
  }
}

/**
 * Complete SSL setup for development
 */
export async function setupSSL(options: SSLSetupOptions = {}): Promise<boolean> {
  const domain = options.domain || process.env.APP_URL?.replace(/^https?:\/\//, '') || 'stacks.localhost'

  // Skip if domain is localhost
  if (domain === 'localhost' || domain.startsWith('localhost:')) {
    log.info('Skipping SSL setup for localhost')
    return true
  }

  let success = true

  // 1. Add to hosts file
  if (!options.skipHosts) {
    const hostsResult = await addDomainToHosts(domain, options.verbose)
    if (!hostsResult && options.verbose) {
      log.warn('Hosts file not updated - you may need to add the entry manually')
    }
  }

  // 2. Generate certificates if needed
  if (!sslCertificatesExist(domain)) {
    if (options.verbose)
      log.info('Generating SSL certificates...')
    const certResult = await generateCertificates(domain, options.verbose)
    if (!certResult) {
      log.error('Failed to generate SSL certificates')
      return false
    }
  }

  // 3. Trust certificates if needed
  if (!options.skipTrust && !isCertificateTrusted(domain)) {
    const trustResult = await trustCertificate(domain, options.verbose)
    if (!trustResult) {
      log.warn('Certificate not trusted - you may see browser warnings')
      success = false
    }
  }

  return success
}

/**
 * Check if SSL setup is complete for a domain
 */
export function isSSLSetupComplete(domain: string): boolean {
  return isDomainInHosts(domain) && sslCertificatesExist(domain)
}
