import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/collections...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',

  external: [
    'collect.js',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/collections`)
