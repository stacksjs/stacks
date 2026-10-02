import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  // `money` is its own entrypoint so `@stacksjs/commerce/money` has a runtime
  // file: the dashboard bundles it into the browser, which the barrel (it
  // imports the database) cannot be (stacksjs/stacks#2851).
  entrypoints: ['./src/index.ts', './src/money.ts'],
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
