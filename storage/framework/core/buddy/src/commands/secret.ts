import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

type SecretOptions = {
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
}

export function secret(buddy: CLI): void {
  const descriptions = {
    secret: 'Interact with your environment variables',
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
    .command('secret:get [key]', descriptions.get)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('--format [format]', descriptions.format, { default: 'json' })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-p, --pretty', descriptions.pretty, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy secret:get SECRET')
    .example('buddy secret:get SECRET --file .env.production')
    .example('buddy secret:get --all --pretty')
    .example('buddy secret:get --format shell')
    .example('buddy secret:get --format eval')
    .example('buddy secret:get --format json')
    .action(async (key: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:get` ...', options)

      // use dotenvx to get the secret
      const secret = Bun.spawn(['dotenvx', 'get', key])
      console.log(secret)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('secret:set [key] [value]', descriptions.set)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('--format [format]', descriptions.format, { default: 'json' })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-p, --pretty', descriptions.pretty, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy secret:set SECRET=value')
    .example('buddy secret:set SECRET=value --file .env.production')
    .example('buddy secret:set --all --pretty')
    .example('buddy secret:set --format shell')
    .example('buddy secret:set --format eval')
    .example('buddy secret:set --format json')
    .action(async (key: string, value: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:set` ...', options)

      // use dotenvx to set the secret
      const secret = Bun.spawn(['dotenvx', 'set', key, value])
      console.log(secret)
    })

  buddy
    .command('secret:encrypt [key]', descriptions.encrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [file-keys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .option('-ek, --exclude-key [exclude-key]', descriptions.excludeKey, { default: '' })
    .action(async (key: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:encrypt` ...', options)
    })

  buddy
    .command('secret:decrypt [key]', descriptions.decrypt)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [file-keys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:decrypt` ...', options)
    })

  buddy
    .command('secret:keypair [key]', descriptions.keypair)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [file-keys]', descriptions.fileKeys, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:keypair` ...', options)
    })

  buddy
    .command('secret:rotate [key]', descriptions.rotate)
    .option('-f, --file [file]', descriptions.file, { default: '' })
    .option('-fk, --file-keys [file-keys]', descriptions.fileKeys, { default: '' })
    .option('-k, --keypair [keypair]', descriptions.keypair, { default: '' })
    .option('-o, --stdout', descriptions.stdout, { default: false })
    .action(async (key: string, options: SecretOptions) => {
      log.debug('Running `buddy secret:rotate` ...', options)
    })

  buddy.on('secret:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
