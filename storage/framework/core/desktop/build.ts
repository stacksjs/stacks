import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  // The launcher ships alongside the library: `buddy build:desktop` compiles it
  // into the native bundle, and a consumer app only has the published package
  // to compile from — without it here, desktop builds work in this monorepo and
  // nowhere else.
  // The interactive-content probe (stacksjs/stacks#877) ships too: the runner
  // bundles page.js for the browser at run time, so both must be in dist/.
  entrypoints: ['./src/index.ts', './src/launcher.ts', './src/probe/index.ts', './src/probe/runner.ts', './src/probe/page.ts'],
  root: './src',
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
