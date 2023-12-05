import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:cli --external @faker-js/faker --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
