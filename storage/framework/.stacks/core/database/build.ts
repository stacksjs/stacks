import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:config --external stacks:faker --external stacks:path --external stacks:query-builder --external stacks:storage --external stacks:strings --external stacks:utils --external kysely --external mysql2 --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
