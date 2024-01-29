import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/cli.ts --compile --outfile buddy', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
