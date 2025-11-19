import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { decryptEnv, encryptEnv, getEnv, getKeypair, rotateKeypair, setEnv } from '@stacksjs/env'
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
        file: options.file,
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

      if (!key || !value) {
        console.error('Both key and value are required')
        process.exit(ExitCode.FatalError)
      }

      const result = setEnv(key, value, {
        file: options.file,
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
        file: options.file,
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
        file: options.file,
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
        file: options.file,
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
        file: options.file,
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
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy env:check')
    .example('buddy env:check --file .env.production')
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
          const envContent = await storage.readTextFile(envPath)
          const contentStr = String(envContent)
          const lines = contentStr.split('\n').filter(line => line.trim() && !line.startsWith('#'))
          const varCount = lines.length

          checks.push({
            name: 'Environment variables',
            status: 'pass',
            message: `${varCount} variables defined`,
          })

          // Check for APP_KEY
          const hasAppKey = lines.some(line => line.startsWith('APP_KEY='))
          if (hasAppKey) {
            const appKeyLine = lines.find(line => line.startsWith('APP_KEY='))
            const appKeyValue = appKeyLine?.split('=')[1]?.trim()
            if (appKeyValue && appKeyValue.length > 0) {
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

          // Check for encryption keys
          const hasPublicKey = lines.some(line => line.startsWith('DOTENV_PUBLIC_KEY='))
          const hasPrivateKey = lines.some(line => line.startsWith('DOTENV_PRIVATE_KEY='))

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

  buddy.on('env:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
