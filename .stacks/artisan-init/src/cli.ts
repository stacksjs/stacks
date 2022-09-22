#!/usr/bin/env node
import { bold, cyan, dim, red, yellow } from 'kolorist'
import cac from 'cac'
import { version } from '../package.json'
import { stack as makeStack } from '../../src/scripts/make'

const cli = cac('artisan-init')

cli
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

cli
  .command('')
  .action(async (args: any) => {
    const path = args

    await makeStack('testing')

    // eslint-disable-next-line no-console
    console.log('path is', path)

    try {
      // eslint-disable-next-line no-console
      console.log()
      // eslint-disable-next-line no-console
      console.log(cyan(bold('Artisan CLI')) + dim(` v${version}`))
      // eslint-disable-next-line no-console
      console.log()

      if (args.name) {
        // eslint-disable-next-line no-console
        console.log(yellow('Name option is set.'))
        return
      }
    }
    catch (e: any) {
      console.error(red(String(e)))
      if (e?.stack)
        console.error(dim(e.stack?.split('\n').slice(1).join('\n')))
      process.exit(1)
    }
  })

cli.parse()
