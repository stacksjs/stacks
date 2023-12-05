import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --external stacks:path --outdir dist --format esm', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
