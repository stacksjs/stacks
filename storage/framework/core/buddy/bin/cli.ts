import process from 'node:process'
import { existsSync } from 'node:fs'
import { $ } from 'bun'
import { cac } from 'cac'
import { version } from '../package.json'

const cli = cac('stacks')

cli
  .command('new', 'Create a new Stacks project')
  .alias('create')
  .action(() => {
    const buddyCli = 'buddy'

    if (existsSync(buddyCli))
      $`${buddyCli} ${process.argv.slice(2).join(' ')}`

    let currentDir = process.cwd()
    let found = false

    while (currentDir !== '/') {
      if (existsSync(`${currentDir}/storage/framework/core/buddy`)) { // if the buddy directory exists, we know we are in a stacks project
        found = true
        break
      }
      currentDir = currentDir.split('/').slice(0, -1).join('/')
    }

    if (!found) {
      console.error('No stacks project found. Do you want to create a new stacks project?')
      // TODO: add prompt for user input
      process.exit(1)
    }

    $`bunx stacks new ${process.argv.slice(2).join(' ')}`
  })

cli
  .command('cd <project>', 'Change the current working directory to a different Stacks project')
  .action((project: string) => {
    const path = `storage/framework/core/buddy/${project}` // FIXME: this is not the correct path
    $`cd ${path}`
  })

cli
  .command('version', 'Show the version of the Stacks CLI')
  .action(() => {
    // eslint-disable-next-line no-console
    console.log(version)
  })

cli.version(version)
cli.help()
cli.parse()
