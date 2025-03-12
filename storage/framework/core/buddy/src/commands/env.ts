import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
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
}

export function env(buddy: CLI): void {
  const descriptions = {
    env: 'Interact with your environment variables',
    get: 'Get an environment variable',
    set: 'Set an environment variable',
    encrypt: 'Encrypt a value',
    decrypt: 'Decrypt a value',
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

      const args = ['get']

      if (key)
        args.push(key)
      if (options.all)
        args.push('--all')
      if (options.pretty)
        args.push('--pretty-print')
      if (options.file)
        args.push('--file', options.file)
      if (options.format)
        args.push('--format', options.format)

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:set [key] [value]', descriptions.set)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('--format [format]', descriptions.format, { default: 'json' })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-p, --pretty', descriptions.pretty, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy env:set SECRET=value')
    .example('buddy env:set SECRET value')
    .example('buddy env:set SECRET value --file .env.production')
    .example('buddy env:set --format shell')
    .action(async (key: string, value: string, options: EnvOptions) => {
      log.debug('Running `buddy env:set` ...', options)

      const args = ['set']

      if (key) {
        args.push(key)
        if (value)
          args.push(value)
      }

      if (options.file)
        args.push('--file', options.file)
      if (options.format)
        args.push('--format', options.format)
      if (options.pretty)
        args.push('--pretty-print')

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:encrypt [key]', descriptions.encrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .option('-ek, --exclude-key [excludeKey]', descriptions.excludeKey, { default: '' })
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:encrypt` ...', options)

      const args = ['encrypt']

      if (key)
        args.push(key)
      if (options.file)
        args.push('--file', options.file)
      if (options.fileKeys)
        args.push('--file-keys', options.fileKeys)
      if (options.keypair)
        args.push('--keypair', options.keypair)
      if (options.stdout)
        args.push('--stdout')
      if (options.excludeKey)
        args.push('--exclude-key', options.excludeKey)

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:decrypt [key]', descriptions.decrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:decrypt` ...', options)

      const args = ['decrypt']

      if (key)
        args.push(key)
      if (options.file)
        args.push('--file', options.file)
      if (options.fileKeys)
        args.push('--file-keys', options.fileKeys)
      if (options.keypair)
        args.push('--keypair', options.keypair)
      if (options.stdout)
        args.push('--stdout')

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:keypair [key]', descriptions.keypair)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:keypair` ...', options)

      const args = ['keypair']

      if (key)
        args.push(key)
      if (options.file)
        args.push('--file', options.file)
      if (options.fileKeys)
        args.push('--file-keys', options.fileKeys)
      if (options.stdout)
        args.push('--stdout')

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('env:rotate [key]', descriptions.rotate)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [fileKeys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: EnvOptions) => {
      log.debug('Running `buddy env:rotate` ...', options)

      const args = ['rotate']

      if (key)
        args.push(key)
      if (options.file)
        args.push('--file', options.file)
      if (options.fileKeys)
        args.push('--file-keys', options.fileKeys)
      if (options.keypair)
        args.push('--keypair', options.keypair)
      if (options.stdout)
        args.push('--stdout')

      const result = Bun.spawnSync(['dotenvx', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        const output = new TextDecoder().decode(result.stdout)
        console.log(output)
        process.exit(ExitCode.Success)
      }
      else {
        const error = new TextDecoder().decode(result.stderr)
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy.on('env:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
