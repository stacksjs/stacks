import { log, runCommand } from '@stacksjs/cli'

const result = runCommand('bun build ./src/index.ts --external redis --external @stacksjs/config --outdir dist --format esm', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
