import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  // Build every entry (not just index) so subpath imports like
  // `@stacksjs/env/plugin` (used as a bunfig `preload`) resolve to real JS in
  // `dist/`, not just a `.d.ts`. The export map maps `./*` → `./dist/*`.
  entrypoints: [
    './src/index.ts',
    './src/plugin.ts',
    './src/parser.ts',
    './src/crypto.ts',
    './src/cli.ts',
    './src/utils.ts',
  ],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  external: frameworkExternal(),
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
