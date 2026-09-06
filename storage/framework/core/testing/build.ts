import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  /*
   * Every entry point `package.json` exports, not just the root.
   *
   * `exports` declares `./database` and `./dynamodb` pointing at
   * `dist/database.js` and `dist/dynamodb.js`, and this built only
   * `src/index.ts` - so both subpaths resolved to nothing, and importing
   * `@stacksjs/testing/database` could not work from an installed package.
   */
  entrypoints: ['./src/index.ts', './src/database.ts', './src/dynamodb.ts'],
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
