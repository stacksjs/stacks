import process from 'node:process'
import { cli } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Ensuring Component Library Entry Point...')

if (!cli.command) {
  log.error('No command defined in the CLI configuration')
  process.exit(ExitCode.FatalError)
}

await writeTextFile({
  path: projectPath(cli.command),
  data: `#!/usr/bin/env bun
import('./storage/framework/core/buddy/src/custom-cli')
`,
}).catch((err: Error) => {
  log.error('There was an error generating your custom CLI file.', err)
  process.exit(ExitCode.FatalError)
})

log.success('Generated custom CLI file')
