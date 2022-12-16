import { log } from '@stacksjs/logging'
import { frameworkPath, runtimePath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

log.info('Building Stacks...')

// run the `npx mkdist -d` command to build the dist folder
let result = await runCommand('npx mkdist -d', { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error running `npx mkdist -d`.', result.error)
  process.exit()
}

// run the `pnpm build:cli` command to build the Buddy CLI
result = await runCommand('pnpm build:cli', { debug: true, cwd: runtimePath() })

if (result.isErr()) {
  log.error('There was an error running `pnpm build:cli`.', result.error)
  process.exit()
}

// run the `pnpm build:core` command to build the Stacks Core
result = await runCommand('pnpm build:core', { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error running `pnpm build:core`.', result.error)
  process.exit()
}

// run the `cp ./core/* ./` command to copy the core stacks to the famework's root
// result = await runCommand(`cp ./core/* ./`, { debug: true, cwd: frameworkPath() })

// if (result.isErr()) {
//   log.error('There was an error running `cp ./core/* ./`.', result.error)
//   process.exit()
// }

log.success('Building Stacks was successful.')
