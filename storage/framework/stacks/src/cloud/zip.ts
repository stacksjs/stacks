import { log, runCommand } from 'src/cli/src'

const result = await runCommand('zip -r dist.zip dist/origin-request.js package.json', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
