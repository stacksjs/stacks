import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/env...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: [
    'fs-extra',
    '@stacksjs/validation',
  ],
  plugins: [
    dts({
      withSourceMap: true, // optional
    }),
  ],
})

log.success(`Built @stacksjs/env`)
