import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external vitepress --external stacks:config --external stacks:alias --external stacks:path --external stacks:vite --external stacks:server --external stacks:env --external stacks:cli --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
