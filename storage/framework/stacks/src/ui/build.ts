import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts ./src/components.ts --outdir dist --format esm --external @stacksjs/config --external unocss --external @julr/unocss-preset-forms --external vue --external pinia --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
