import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --external fs-extra --external stacks:validation --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
