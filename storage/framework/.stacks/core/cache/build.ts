import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --external ioredis --external stacks:config --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
