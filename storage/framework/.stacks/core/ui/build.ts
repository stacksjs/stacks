import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:config --external unocss --external @julr/unocss-preset-forms --external vue --external pinia --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
