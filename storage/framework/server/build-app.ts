import { runCommand } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { build } from 'bun'
import { intro, outro } from '../core/build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
  pkgName: 'server',
})

const entrypoints = await glob([path.appPath('*.ts'), path.appPath('**/*.ts')])

const result = await build({
  entrypoints,
  outdir: path.frameworkPath('server/dist'),
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',
  minify: true,
  splitting: true,
})

// TODO: this is a bundler issue and those files should not need to be copied, and that's why we handle the cleanup here as well

await runCommand(`cp -r ${path.projectStoragePath('app')} ${path.userServerPath()}`)
await runCommand(`rm -rf ${path.projectStoragePath('app')}`)

await outro({
  dir: import.meta.dir,
  startTime,
  result,
  pkgName: 'server',
})
