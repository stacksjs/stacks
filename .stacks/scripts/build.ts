// loop through all of the core packages and build them via `bun run build`

import { glob } from '@stacksjs/utils'
import { ExitCode } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

// import { italic, command } from '@stacksjs/cli'

log.info('Building core packages')

const dirs = await glob(['../core/**/package.json'], {
  onlyDirectories: true,
})

if (dirs.length === 0) {
  log.info('No core packages found')
  process.exit(ExitCode.FatalError)
}

console.log('dirs', dirs)

// for (const folder of dirs) {
//   const path = folder

//   log.info(`Building ${italic(path)}`)

//   const result = await command.run('bun run build', {
//     cwd: path,
//   })

//   if (result.isErr())
//     process.exit(ExitCode.FatalError)

//   log.success(`Built ${italic(path)}`)
// }
