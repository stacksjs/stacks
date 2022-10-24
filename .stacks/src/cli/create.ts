import type { CLI } from '@stacksjs/types'
import { console as consola, spawn } from '@stacksjs/cli'
import { bold, cyan, dim, link } from 'kolorist'
import { useOnline } from '@stacksjs/utils'
import { isFolder } from '@stacksjs/fs'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { version } from '../../package.json'
import { generate as generateAppKey } from './actions/key'

async function create(stack: CLI) {
  stack
    .option('-n, --name <name>', 'Name of the stack')
    .option('-u, --ui', 'Are you building a UI?', { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', 'Are you building UI components?', { default: true }) // if no, -v and -w would be false
    .option('-w, --web-components', 'Automagically built optimized custom elements/web components?', { default: true })
    .option('-v, --vue', 'Automagically built a Vue component library?', { default: true })
    .option('-p, --pages', 'How about pages?', { default: true }) // pages need an HTTP server
    .option('-f, --functions', 'Are you developing functions/composables?', { default: true }) // if no, API would be false
    .option('-a, --api', 'Are you building an API?', { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', 'Do you need a database?', { default: true })
    .option('--debug', 'Add additional debug logs', { default: false })
    // .option('--auth', 'Scaffold an authentication?', { default: true })

  stack
    .command('')
    .action(async (args: any) => {
      const name = stack.args[0] || args.name || '.'
      const path = p.resolve(process.cwd(), name)

      console.log()
      console.log(cyan(bold('Stacks CLI')) + dim(` v${version}`))
      console.log()

      if (await isFolder(path)) {
        consola.error(`Path ${path} already exists`)
        process.exit(ExitCode.FatalError)
      }

      const online = useOnline()
      if (!online) {
        consola.info('It appears you are disconnected from the internet. The Stacks setup requires a brief internet connection for setup.')
        process.exit(ExitCode.FatalError)
      }

      consola.info('Setting up your stack.')
      await spawn.async(`giget stacks ${name}`, { stdio: args.debug ? 'inherit' : 'ignore' }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
      consola.success(`Successfully scaffolded your project at ${cyan(path)}`)

      consola.info('Ensuring your environment is ready...')
      // todo: this should check for whether the proper Node version is installed because fnm is not a requirement
      await spawn.async('fnm use', { stdio: args.debug ? 'inherit' : 'ignore', cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
      consola.success('Environment is ready.')

      consola.info('Installing & setting up Stacks.')
      await spawn.async('pnpm install', { stdio: args.debug ? 'inherit' : 'ignore', cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
      await spawn.async('cp .env.example .env', { stdio: args.debug ? 'inherit' : 'ignore', cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
      await generateAppKey()
      await spawn.async('git init', { stdio: args.debug ? 'inherit' : 'ignore', cwd: path }) // todo: stdio should inherit when APP_DEBUG or debug flag is true
      consola.success('Installed & set-up 🚀')

      console.log()
      consola.info(bold('Welcome to the Stacks Framework! ⚛️'))
      console.log(`cd ${link(path, `vscode://file/${path}:1`)} && code .`)
      console.log()
      consola.log('To learn more, visit https://stacksjs.dev')
    })
}

export { create }
