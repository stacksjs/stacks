import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts --external fs-extra --external @stacksjs/validation --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
