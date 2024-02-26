import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/ai...`)

await Bun.build({
  root: './src',

  entrypoints: [
    './src/index.ts',
  ],

  outdir: './dist',
  format: 'esm',

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/ai`)
