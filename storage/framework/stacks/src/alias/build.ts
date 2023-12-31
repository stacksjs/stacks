import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts --external @stacksjs/path --outdir dist --format esm', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
