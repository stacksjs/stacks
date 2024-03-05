import { $ } from 'bun'
import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

await $`cp ./dist/src/index.js ./dist/index.js`
await $`rm -rf ./dist/src`
await $`cp ./dist/bin/cli.js ./dist/cli.js`
await $`rm -rf ./dist/bin`
await $`cp ./bin/cli.d.ts ./dist/cli.d.ts` // while bun-plugin-dts-auto doesn't support bin files well
await $`rm ./bin/cli.d.ts`
