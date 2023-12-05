import { runCommand } from 'stacks:cli'

await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @vinejs/vine --external stacks:vite --external stacks:strings --external stacks:types --external @dinero.js/currencies --external dinero.js --target bun', {
  cwd: import.meta.dir,
})
