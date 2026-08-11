import { dts } from 'bun-plugin-dtsx'
import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await rm('./dist', { recursive: true, force: true })

const result = await Bun.build({
  // `routes` is an entrypoint of its own so an installed app can reach it:
  // the vendored `storage/framework/orm/routes.ts` re-exports
  // `@stacksjs/orm/routes`, and without this there is nothing behind that
  // specifier — which is why every npm-installed app logged "model useApi
  // endpoints are unavailable" and served none of them.
  entrypoints: ['./src/index.ts', './src/routes.ts'],
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
      exclude: ['tests/**'],
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
