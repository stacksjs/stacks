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
  // `frameworkExternal` was imported here but never passed, so the bundle
  // INLINED bun-query-builder — freezing whatever version was current at
  // publish time into dist/index.js. Since this package is the only route
  // stacks takes to the query builder, that snapshot is what actually ran in
  // every app, and upgrading bun-query-builder in the app changed nothing.
  // It cost a long debugging session: `setConfig({ snapshotDir })` wrote to
  // the live config while the frozen copy read a hardcoded `.qb`, so the
  // snapshot kept landing in the project root and every fix looked correct
  // and did nothing. Keep it external so the consumer's installed version
  // wins, exactly as the helper's own contract describes.
  external: frameworkExternal(),
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
