import { runCommand } from '@stacksjs/cli'

await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @vinejs/vine --external @stacksjs/vite --external @stacksjs/strings --external @stacksjs/types --external @stacksjs/validation --external @dinero.js/currencies --external dinero.js --target bun', {
  cwd: import.meta.dir,
})
