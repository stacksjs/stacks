import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external @stacksjs/cli --external @stacksjs/path --external @stacksjs/storage --external @stacksjs/arrays --external @stacksjs/types --external @stacksjs/actions --external @stacksjs/env --external export-size --external yaml --external js-yaml --external vue --external rimraf --external semver --external @dinero.js/currencies --external dinero.js --external neverthrow --external macroable --external hookable --external perfect-debounce --external vue-demi --external @vueuse/shared --external @vueuse/math --external p-limit --external @vueuse/core --external @unhead/shared --external @unhead/dom --external unhead --external @unhead/vue --external @unhead/ssr --target node', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
