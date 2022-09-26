/* eslint-disable no-console */
import type { CAC } from 'cac'
import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { resolve } from 'pathe'
import { bold, cyan, dim } from 'kolorist'
import { version } from '../../package.json'
import { isFolder } from '../../../src/core/fs'
import { ExitCode } from './exit-code'

// the logic to run to create/scaffold a new stack
async function initCommands(artisan: CAC) {
  artisan
    .version(version)
    .option('-n, --name <name>', 'Name of the stack')
    .option('-u, --ui', 'Are you building a UI?', { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', 'Are you building UI components?', { default: true }) // if no, -v and -w would be false
    .option('-w, --web-components', 'Automagically built optimized custom elements/web components?', { default: true })
    .option('-v, --vue', 'Automagically built a Vue component library?', { default: true })
    .option('-p, --pages', 'How about pages?', { default: true }) // pages need an HTTP server
    .option('-f, --functions', 'Are you developing functions/composables?', { default: true }) // if no, API would be false
    .option('-a, --api', 'Are you building an API?', { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', 'Do you need a database?', { default: true })
    // .option('--auth', 'Scaffold an authentication?', { default: true })
    .help()

  artisan
    .command('')
    .action(async (args: any) => {
      const name = artisan.args[0] || args.name || '.'
      const path = resolve(process.cwd(), name)

      console.log()
      console.log(cyan(bold('Artisan CLI')) + dim(` v${version}`))
      console.log()

      if (await isFolder(path)) {
        consola.error(`Path ${path} already exists`)
        process.exit(ExitCode.FatalError)
      }

      consola.info('Setting up your stack.')
      await ezSpawn.async(`giget stacks ${name}`, { stdio: 'ignore' })
      consola.success(`Successfully scaffolded your project at ${cyan(path)}`)

      // now we need to cd into the path and run the command initialize the code
      await ezSpawn.async('pnpm install', { stdio: 'inherit', cwd: path })

      console.log()
      consola.log('Welcome to Stacks! You are now successfully set up:')
      console.log(`cd ${path} && code .`)
      console.log()
      consola.log('To learn more, visit https://stacks.ow3.org/wip')
    })
}

export { initCommands }
