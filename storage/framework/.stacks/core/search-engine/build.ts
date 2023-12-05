import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:config --external stacks:ui --external stacks:utils --external stacks:logging --external stacks:validation --external meilisearch --external bun --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
