// import { log, runCommand } from '@stacksjs/cli'

// const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external @stacksjs/logging --target bun', {
//   cwd: import.meta.dir,
// })

// if (result.isErr())
//   log.error(result.error)

import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/router...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    '@stacksjs/logging',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/router`)
