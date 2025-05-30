import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// TODO: ensure browser support works
const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  // sourcemap: 'linked',
  minify: true,
  external: ['@stacksjs/cli', '@stacksjs/path', '@stacksjs/types', '@stacksjs/validation'],
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
