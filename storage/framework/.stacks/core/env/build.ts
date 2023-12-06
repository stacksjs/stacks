import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --external fs-extra --external @stacksjs/validation --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
