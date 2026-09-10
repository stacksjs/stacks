import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  // Every subpath the package advertises needs its own entry: the exports map
  // sends `@stacksjs/queue/bun-queue` to `dist/bun-queue.js`, and building only
  // `index.ts` meant that file never existed. The types resolved (dtsx emits a
  // `.d.ts` per source file), so the import typechecked and then failed at
  // runtime in every installed app - the documented way to reach `dispatch`,
  // `Queue` and the middleware classes has never worked (stacksjs/stacks#2581).
  entrypoints: ['./src/index.ts', './src/bun-queue.ts', './src/drivers/redis.ts'],
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
