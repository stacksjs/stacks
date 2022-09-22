#!/usr/bin/env node
import { bold, cyan, dim, red, yellow } from 'kolorist'
import cac from 'cac'
import { version } from '../package.json'

const cli = cac('artisan-init')

cli
  .version(version)
  .option('--name <name>', 'Name of the stack')
  .help()

cli
  .command('')
  .action(async (args: any) => {
    const path = args

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
