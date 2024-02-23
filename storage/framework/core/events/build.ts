import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/events...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  plugins: [
    dts({
      withSourceMap: true, // optional
    }),
  ],
})

log.success(`Built @stacksjs/events`)