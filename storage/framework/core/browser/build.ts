import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'browser',
  // sourcemap: 'linked',
  // `bun:sqlite`, `stream/promises`, etc. leak into the browser graph
  // through `bun-query-builder`'s shared entry — they're guarded behind
  // server-only branches at runtime but the bundler still walks them.
  // Marking the bun/node namespaces external keeps the browser bundle
  // small; if a browser code path ever actually needs them the runtime
  // import will fail loudly.
  //
  // Targeting `browser` enforces node-builtin rejection, so we list the
  // bare module names explicitly (bun's external glob doesn't catch
  // `child_process`/`fs` written without the `node:` prefix).
  external: frameworkExternal([
    'bun',
    'bun:*',
    'node:*',
    'child_process',
    'fs',
    'fs/promises',
    'path',
    'os',
    'stream',
    'stream/promises',
    'crypto',
    'http',
    'https',
    'net',
    'tls',
    'url',
    'util',
    'readline',
    'worker_threads',
    'process',
  ]),
  // minify: true,
  plugins: [
    dts({
      root: '.',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
