import type { CLI, CreateOptions } from '@stacksjs/types'
import { chmodSync } from 'node:fs'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { bold, cyan, dim, intro, log, onUnknownSubcommand, runCommand } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { resolve } from '@stacksjs/path'
import { isFolder } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'
import { useOnline } from '@stacksjs/utils'
import { ensurePantryDependencies, ensurePantryInstalled } from './setup'

export function create(buddy: CLI): void {
  const descriptions = {
    name: 'The name of the project',
    command: 'Create a new Stacks project',
    ui: 'Are you building a UI?',
    components: 'Are you building UI components?',
    webComponents: 'Automagically built optimized custom elements/web components?',
    vue: 'Automagically built a Vue component library?',
    views: 'How about views?',
    functions: 'Are you developing functions/composables?',
    api: 'Are you building an API?',
    database: 'Do you need a database?',
    notifications: 'Do you need notifications? e.g. email, SMS, push or chat notifications',
    cache: 'Do you need caching?',
    email: 'Do you need email?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('new [name]', descriptions.command)
    .alias('create [name]')
    .option('-n, --name [name]', descriptions.name, { default: false })
    .option('-u, --ui', descriptions.ui, { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', descriptions.components, { default: true }) // if no, -v and -w would be false
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('-v, --vue', descriptions.vue, { default: true })
    .option('-p, --views', descriptions.views, { default: true }) // i.e. `buddy dev`
    .option('-f, --functions', descriptions.functions, { default: true }) // if no, API would be false
    .option('-a, --api', descriptions.api, { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', descriptions.database, { default: true })
    .option('-ca, --cache', descriptions.cache, { default: false })
    .option('-e, --email', descriptions.email, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    // .option('--auth', 'Scaffold an authentication?', { default: true })
    .action(async (name, options: CreateOptions) => {
      log.debug('Running `buddy new <name>` ...', options)

      const startTime = await intro('buddy new')

      name = name ?? options.name
      const path = resolve(process.cwd(), name)

      isFolderCheck(path)
      onlineCheck()

      const result = await download(name, path, options)

      if (result.isErr) {
        log.error(result.error)
        process.exit(ExitCode.FatalError)
      }

  await ensureEnv(path, options)
  ensureExecutableScripts(path)
  await install(path, options)

      if (startTime) {
        const time = performance.now() - startTime
        log.success(dim(`[${time.toFixed(2)}ms] Completed`))
      }

      log.info(bold('Welcome to the Stacks Framework! ⚛️'))
      log.info('To learn more, visit https://stacksjs.com')

      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "new")
}

function isFolderCheck(path: string) {
  if (isFolder(path)) {
    log.error(`Path ${path} already exists`)
    process.exit(ExitCode.FatalError)
  }
}

function onlineCheck() {
  const online = useOnline()
  if (!online) {
    log.info('It appears you are disconnected from the internet.')
    log.info('The Stacks setup requires a brief internet connection for setup.')
    log.info('For instance, it installs your dependencies from.')
    process.exit(ExitCode.FatalError)
  }
}

async function download(name: string, path: string, options: CreateOptions) {
  log.info('Setting up your stack.')
  const result = await runCommand(`bunx --bun @stacksjs/gitit stacks ${name}`, options)
  log.success(`Successfully scaffolded your project at ${cyan(path)}`)

  return result
}

function ensureExecutableScripts(path: string) {
  for (const script of ['buddy', 'bootstrap']) {
    try {
      chmodSync(resolve(path, script), 0o755)
    }
    catch {
      // If the template changes and a script is not present, install() will
      // surface the missing executable in the command that needs it.
    }
  }
}

async function ensureEnv(path: string, _options: CreateOptions) {
  log.info('Ensuring your environment is ready...')
  // Bootstrap the Pantry CLI (idempotent) and install the new project's
  // system-level dependencies declared in `config/deps.ts` — bun, sqlite,
  // craft, etc. — so the subsequent `bun install` runs against the right
  // toolchain.
  await ensurePantryInstalled()
  await ensurePantryDependencies(path)
  log.success('Environment is ready')
}

async function install(path: string, options: CreateOptions) {
  log.info('Installing & setting up Stacks')

  log.info('Running bun install...')
  let result = await runCommand('bun install', { ...options, cwd: path })

  if (result?.isErr) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('Copying .env.example → .env')
  result = await runCommand('cp .env.example .env', { ...options, cwd: path })

  if (result?.isErr) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('Generating application key...')
  const keyResult = await runAction(Action.KeyGenerate, { ...options, cwd: path })
  if (keyResult.isErr) {
    log.error(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('Initializing git repository...')
  result = await runCommand('git init', { ...options, cwd: path })
  if (result.isErr) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed & set-up 🚀')
}
