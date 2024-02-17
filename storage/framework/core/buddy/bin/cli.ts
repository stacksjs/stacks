// 1. need to check if in stacks project scope by checking whether the file `buddy` exists or a storage/framework/core/buddy exists
// 2. if it does, then we proxy the command to the buddy cli via `./buddy <command> <args>`
// 3. if it doesn't, we go up the directory tree and check again until we reach the root
// 4. if we reach the root and still don't find the buddy cli, we throw an error asking the user if they want to set up a new stacks project
// 5. if the user says yes, we create a new stacks project and proxy the command via `bunx stacks new <project-name>`
// 6. if the user says no, we throw an error and exit

import process from 'node:process'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cac } from 'cac'

const cli = cac()

cli
  .command('new', 'Create a new stacks project')
  .alias('add')
  .action(() => {
    const buddyCli = 'buddy'

    if (existsSync(buddyCli))
      execSync(`${buddyCli} ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' })

    let currentDir = process.cwd()
    let found = false

    while (currentDir !== '/') {
      if (existsSync(`${currentDir}/storage/framework/core/buddy`)) {
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

    execSync(`bunx stacks new ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' })
  })

cli.parse()

// Path: storage/framework/core/buddy/bin/cli.ts
