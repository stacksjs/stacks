import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  plugins: [
    // Every public ORM type is generic over the model definition and every
    // one of them originates here: `ModelStatic`, `ModelRecord`,
    // `ModelQueryBuilder`, `FillableAttributes`. Shipping this package with no
    // declarations collapsed all of them to `any` in every Stacks app, so
    // `Feature.orderBy('sort_order').get()` resolved to `Promise<any>` and
    // callers had to hand-write the row shape back in with a cast.
    dts({
      root: './src',
      outdir: './dist',
      exclude: ['tests/**'],
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
