import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { userServerPath } from '@stacksjs/path'
import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { build } from 'bun'
import { intro, outro } from '../core/build/src'
import { buildDockerImage, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  const { startTime } = await intro({
    dir: import.meta.dir,
  })

  log.info('Deleting old server files...', { styled: false })
  await runCommand(`rm -rf ${userServerPath('index.js*')}`)
  log.info('Deleted old server files', { styled: false })
  log.info('Deleting old *.node files...', { styled: false })
  await runCommand(`rm -rf ${userServerPath('*.node')}`)
  log.info('Deleted old *.node files', { styled: false })

  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    format: 'esm',
    target: 'bun',
    sourcemap: 'linked',
    // minify: true,
  })

  await outro({
    dir: import.meta.dir,
    startTime,
    result,
  })

  await useCustomOrDefaultServerConfig()

  log.info('Building app...', { styled: false })

  const { startTime: perf } = await intro({
    dir: import.meta.dir,
    pkgName: 'server',
  })

  const entrypoints = await glob([path.appPath('*.ts'), path.appPath('**/*.ts')])

  const r2 = await build({
    entrypoints,
    outdir: './dist',
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
    startTime: perf,
    result: r2,
    pkgName: 'server',
  })

  if (cloud.api?.deploy) await buildDockerImage()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
