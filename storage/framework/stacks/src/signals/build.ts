import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @maverick-js/signals', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
