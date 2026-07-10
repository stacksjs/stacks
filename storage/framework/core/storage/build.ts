import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  // `./src/image.ts` is a separate entrypoint because it lazy-loads
  // `sharp` (a native module) — emitting it as its own dist file lets
  // consumers `import { transform } from '@stacksjs/storage/image'`
  // without pulling the lazy-import into the main bundle's static
  // dependency graph (stacksjs/stacks#1856 Stage 5).
  entrypoints: ['./src/index.ts', './src/image.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
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
