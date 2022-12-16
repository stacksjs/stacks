import type { CLI, CreateOptions } from '@stacksjs/types'
import { bold, cyan, green, intro, link, log, runCommand } from '@stacksjs/cli'
import { useOnline } from '@stacksjs/utils'
import { isFolder } from '@stacksjs/storage'
import { resolve } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { generate as generateAppKey } from '@stacksjs/actions/key'

async function create(buddy: CLI) {
  const descriptions = {
    command: 'Create a new Stacks project',
    ui: 'Are you building a UI?',
    components: 'Are you building UI components?',
    webComponents: 'Automagically built optimized custom elements/web components?',
    vue: 'Automagically built a Vue component library?',
    pages: 'How about pages?',
    functions: 'Are you developing functions/composables?',
    api: 'Are you building an API?',
    database: 'Do you need a database?',
    debug: 'Enable debug mode',
  }

  buddy
    .command('new <name>', descriptions.command)
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
      const startTime = intro('stacks new')
      const name = options.name
      const path = resolve(process.cwd(), name)

      await isFolderCheck(path)
      await onlineCheck()
      const result = await download(name, path, options)

      if (result.isErr()) {
        log.error(result.error)
        process.exit(ExitCode.FatalError)
      }

      await ensureEnv(path, options)
      await install(path, options)

      // a custom outro
      console.log()

      if (startTime) {
        const time = performance.now() - startTime
        log.success(green(`Done in ${time}ms`))
      }

      log.info(bold('Welcome to the Stacks Framework! ⚛️'))
      console.log(`cd ${link(path, `vscode://file/${path}:1`)} && code .`)
      console.log()
      log.info('To learn more, visit https://stacksjs.dev')

      process.exit(ExitCode.Success)
    })
}

async function isFolderCheck(path: string) {
  if (await isFolder(path)) {
    log.error(`Path ${path} already exists`)
    process.exit(ExitCode.FatalError)
  }
}

async function onlineCheck() {
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
  await runCommand('fnm use', { ...options, cwd: path })
  log.success('Environment is ready')
}

async function install(path: string, options: CreateOptions) {
  log.info('Installing & setting up Stacks')
  const res1 = await runCommand('pnpm install', { ...options, cwd: path })

  if (res1.isErr()) {
    log.error(res1.error)
    process.exit(ExitCode.FatalError)
  }

  const res2 = await runCommand('cp .env.example .env', { ...options, cwd: path })

  if (res2.isErr()) {
    log.error(res2.error)
    process.exit(ExitCode.FatalError)
  }

  await generateAppKey(options)

  const res3 = await runCommand('git init', { ...options, cwd: path })

  if (res3.isErr()) {
    log.error(res3.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed & set-up 🚀')
}

export { create }
