import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CreateOptions } from '@stacksjs/types'
import { bold, cyan, dim, intro, log, runCommand } from '@stacksjs/cli'
import { useOnline } from '@stacksjs/utils'
import { isFolder } from '@stacksjs/storage'
import { resolve } from '@stacksjs/path'
import { Action } from '@stacksjs/enums'
import { runAction } from '@stacksjs/actions'

export function create(buddy: CLI) {
  const descriptions = {
    command: 'Create a new Stacks project',
    ui: 'Are you building a UI?',
    components: 'Are you building UI components?',
    webComponents: 'Automagically built optimized custom elements/web components?',
    vue: 'Automagically built a Vue component library?',
    pages: 'How about views/views?',
    functions: 'Are you developing functions/composables?',
    api: 'Are you building an API?',
    database: 'Do you need a database?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('new <name>', descriptions.command)
    .option('-u, --ui', descriptions.ui, { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', descriptions.components, { default: true }) // if no, -v and -w would be false
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('-v, --vue', descriptions.vue, { default: true })
    .option('-p, --views', descriptions.pages, { default: true }) // views need an HTTP server
    .option('-f, --functions', descriptions.functions, { default: true }) // if no, API would be false
    .option('-a, --api', descriptions.api, { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', descriptions.database, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    // .option('--auth', 'Scaffold an authentication?', { default: true })
    .action(async (options: CreateOptions) => {
      const startTime = await intro('stacks new')
      const name = options.name
      const path = resolve(process.cwd(), name)

      isFolderCheck(path)
      onlineCheck()
      const result = await download(name, path, options)

      if (result?.isErr()) {
        log.error(result.error)
        process.exit(ExitCode.FatalError)
      }

      await ensureEnv(path, options)
      await install(path, options)

      if (startTime) {
        const time = performance.now() - startTime
        log.success(dim(`[${time.toFixed(2)}ms] Completed`))
      }

      log.info(bold('Welcome to the Stacks Framework! ⚛️'))
      // console.log(`cd ${link(path, `vscode://file/${path}:1`)} && code .`)
      // console.log()
      log.info('To learn more, visit https://stacksjs.org')

      process.exit(ExitCode.Success)
    })

  buddy.on('new:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
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
  const result = await runCommand(`giget stacks ${name}`, options)
  log.success(`Successfully scaffolded your project at ${cyan(path)}`)

  return result
}

async function ensureEnv(path: string, options: CreateOptions) {
  log.info('Ensuring your environment is ready...')
  // todo: this should check for whether the proper Node version is installed because fnm is not a requirement
  await runCommand('tea -SE', { ...options, cwd: path })
  log.success('Environment is ready')
}

async function install(path: string, options: CreateOptions) {
  log.info('Installing & setting up Stacks')
  let result = await runCommand('bun install', { ...options, cwd: path })

  if (result?.isErr()) {
    log.error(result.error)
    process.exit()
  }

  result = await runCommand('cp .env.example .env', { ...options, cwd: path })

  if (result?.isErr()) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  await runAction(Action.KeyGenerate, { ...options, cwd: path })

  result = await runCommand('git init', { ...options, cwd: path })

  if (result.isErr()) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed & set-up 🚀')
}
