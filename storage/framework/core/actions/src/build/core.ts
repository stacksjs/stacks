import { $ } from 'bun'
import process from 'node:process'
import { dim, italic, log } from '@stacksjs/cli'
import { corePath } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Building core packages')

const dirs = (await glob([corePath('*')], { onlyDirectories: true })).sort()

if (dirs.length === 0) {
  log.info('No core packages found')
  process.exit(ExitCode.FatalError)
}

for (const folder of dirs) {
  log.info(`🏗️  Building ${italic(dim(folder))}`)

  $.cwd(folder)
  await $`bun run build`
  log.success(`${italic(dim(folder))} built`)

  console.log(``)
}

// dirs.forEach(async (folder) => {
//   log.info(`🏗️  Building ${italic(dim(folder))}`)

//   $.cwd(folder)
//   const text = await $`bun run build`.text()
//   console.log(text)
// })
