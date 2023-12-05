import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:config --external stacks:cli --external stacks:path --external stacks:storage --external stacks:arrays --external stacks:types --external stacks:actions --external stacks:env --external export-size --external yaml --external js-yaml --external vue --external rimraf --external stacks:enums --external @dinero.js/currencies --external dinero.js --external neverthrow --external macroable --external hookable --external perfect-debounce --external vue-demi --external @vueuse/shared --external @vueuse/math --external p-limit --external @vueuse/core --external @vueuse/head --external stacks:error-handling --external stacks:strings --external stacks:validation --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
