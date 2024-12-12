import { routesPath, storagePath } from '@stacksjs/path'
import { intro, outro } from '../build/src'

/* eslint-disable-next-line antfu/no-top-level-await */
const { startTime } = await intro({
  dir: import.meta.dir,
})

/* eslint-disable-next-line antfu/no-top-level-await */
const result = await Bun.build({
  entrypoints: [routesPath('api.ts'), storagePath('framework/orm/routes.ts')],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
})

/* eslint-disable-next-line antfu/no-top-level-await */
await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
