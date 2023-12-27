import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/storage --external local-pkg --external debug --target node', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)