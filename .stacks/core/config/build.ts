import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/types --external @stacksjs/env --external @stacksjs/path --external @stacksjs/validation --external @stacksjs/path --external @vinejs/compiler --external pluralize --external @stacksjs/strings --external dinero.js --external @dinero.js/currencies --external validator --external @vinejs/vine --external @stacksjs/validation --target node', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
