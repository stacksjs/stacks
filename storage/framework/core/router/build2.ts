import { projectStoragePath, routesPath } from '@stacksjs/path'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: [routesPath('api.ts'), projectStoragePath('framework/orm/routes.ts')],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
