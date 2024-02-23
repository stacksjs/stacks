import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/alias...`)

await Bun.build({
  entrypoints: [
    './src/index.ts',
  ],

  outdir: './dist',

  external: [
    '@stacksjs/path',
  ],

  format: 'esm',

  plugins: [
    dts({
      withSourceMap: true, // optional
    }),
  ],
})

log.success(`Built @stacksjs/alias`)
