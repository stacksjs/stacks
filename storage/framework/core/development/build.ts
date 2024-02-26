import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/development...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/development`)
