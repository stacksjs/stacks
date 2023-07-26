// loop through all of the core packages and build them via `bun run build`

import { glob } from '@stacksjs/utils'
import { path as p } from '@stacksjs/path'
import { log } from '@stacksjs/logging'
import { Arr } from '@stacksjs/arrays'
import { ExitCode } from '@stacksjs/types'

// import { italic, command } from '@stacksjs/cli'

log.info('Building core packages')

const dirsToIgnore = ['src', 'dist', 'snippets', 'scripts', 'tests', 'node_modules', 'art']
const dirs = (await glob([p.corePath('*'), p.corePath('*/*')], { onlyDirectories: true }))
  // filter out any directories that are not "core packages"
  .filter(dir => !Arr.contains(dir, dirsToIgnore))

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
