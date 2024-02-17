import { log, runCommand } from '@stacksjs/cli'

// compiles the buddy binary
const result = await runCommand('bun build ./bin/cli.ts --compile --outfile dist/buddy', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
