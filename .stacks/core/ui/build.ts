import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external unocss --external @julr/unocss-preset-forms --external @unocss/transformer-compile-class --external vue --external pinia --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
