import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:types --external stacks:tunnel --external stacks:env --external stacks:path --external stacks:validation --external stacks:path --external @vinejs/compiler --external pluralize --external stacks:strings --external dinero.js --external @dinero.js/currencies --external validator --external @vinejs/vine --external stacks:validation', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
