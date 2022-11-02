import type { CLI, CreateOptions } from '@stacksjs/types'
import { bold, consola, cyan, dim, link, spawn } from '@stacksjs/cli'
import { useOnline } from '@stacksjs/utils'
import { debugLevel } from '@stacksjs/config'
import { isFolder } from '@stacksjs/storage'
import { resolve } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { version } from '../../package.json'
import { generate as generateAppKey } from './actions/key'

const descriptions = {
  command: 'Create a new Stacks project',
  name: 'Name of the stack',
  ui: 'Are you building a UI?',
  components: 'Are you building UI components?',
  webComponents: 'Automagically built optimized custom elements/web components?',
  vue: 'Automagically built a Vue component library?',
  pages: 'How about pages?',
  functions: 'Are you developing functions/composables?',
  api: 'Are you building an API?',
  database: 'Do you need a database?',
  debug: 'Add additional debug logging',
}

async function create(stacks: CLI) {
  stacks
    .command('', descriptions.command)
    .option('-n, --name <name>', descriptions.name)
    .option('-u, --ui', descriptions.ui, { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', descriptions.components, { default: true }) // if no, -v and -w would be false
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('-v, --vue', descriptions.vue, { default: true })
    .option('-p, --pages', descriptions.pages, { default: true }) // pages need an HTTP server
    .option('-f, --functions', descriptions.functions, { default: true }) // if no, API would be false
    .option('-a, --api', descriptions.api, { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', descriptions.database, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    // .option('--auth', 'Scaffold an authentication?', { default: true })
    .action(async (options: CreateOptions) => {
      const name = stacks.args[0] || options.name || '.'
      const path = resolve(process.cwd(), name)

      console.log()
      console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
      console.log()

      await isFolderCheck(path)
      await onlineCheck()
      await download(name, path, options)
      await ensureEnv(path, options)
      await install(path, options)

      console.log()
      consola.info(bold('Welcome to the Stacks Framework! ⚛️'))
      console.log(`cd ${link(path, `vscode://file/${path}:1`)} && code .`)
      console.log()
      consola.log('To learn more, visit https://stacksjs.dev')
      process.exit(ExitCode.Success)
    })
}

async function isFolderCheck(path: string) {
  if (await isFolder(path)) {
    consola.error(`Path ${path} already exists`)
    process.exit(ExitCode.FatalError)
  }
}

async function onlineCheck() {
  const online = useOnline()
  if (!online) {
    consola.info('It appears you are disconnected from the internet.')
    consola.info('The Stacks setup requires a brief internet connection for setup.')
    consola.info('For instance, it installs your dependencies from.')
    process.exit(ExitCode.FatalError)
  }
}

async function download(name: string, path: string, options: CreateOptions) {
  const debug = debugLevel(options)

  consola.info('Setting up your stack.')
  await spawn.async(`giget stacks ${name}`, { stdio: debug }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
  consola.success(`Successfully scaffolded your project at ${cyan(path)}`)
}

async function ensureEnv(path: string, options: CreateOptions) {
  const debug = debugLevel(options)

  consola.info('Ensuring your environment is ready...')
  // todo: this should check for whether the proper Node version is installed because fnm is not a requirement
  await spawn.async('fnm use', { stdio: debug, cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
  consola.success('Environment is ready.')
}

async function install(path: string, options: CreateOptions) {
  const debug = debugLevel(options)

  consola.info('Installing & setting up Stacks.')
  await spawn.async('pnpm install', { stdio: debug, cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
  await spawn.async('cp .env.example .env', { stdio: debug, cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
  await generateAppKey(options)
  await spawn.async('git init', { stdio: debug, cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
  consola.success('Installed & set-up 🚀')
}

export { create }
