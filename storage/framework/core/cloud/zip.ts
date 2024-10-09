import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'

// eslint-disable-next-line antfu/no-top-level-await
const result = await runCommand('zip -r ./dist.zip dist/origin-request.js package.json', {
  cwd: import.meta.dir,
})

if (result.isErr()) {
  log.error(result.error)
  process.exit(1)
}

log.success('dist is zipped')
