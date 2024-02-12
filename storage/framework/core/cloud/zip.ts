import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('zip -r ../../cloud/dist.zip dist/origin-request.js package.json', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
