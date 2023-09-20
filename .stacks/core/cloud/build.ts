import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/edge/origin-request.ts --outfile ./dist/origin-request.js && zip -r dist.zip dist/origin-request.js package.json', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
