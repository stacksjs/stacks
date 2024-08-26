import process from 'node:process'
import { log, runCommand, runCommandSync } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { userServerPath } from '@stacksjs/path'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { build } from 'bun'
import { intro, outro } from '../core/build/src'
import { buildDockerImage, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  const { startTime } = await intro({
    dir: import.meta.dir,
  })

  // if stacks-container is running, stop it
  const stacksContainer = await runCommandSync(`docker ps -a --filter name=stacks-server --format "{{.ID}}"`)

  if (stacksContainer) {
    log.info('Stopping stacks-server container...', { styled: false })
    await runCommand(`docker stop stacks-server`)
    log.info('Stopped stacks-server container', { styled: false })
  }

  log.info('Deleting old files...', { styled: false })
  await runCommand(`rm -rf ${userServerPath('app')}`)
  await runCommand(`rm -rf ${userServerPath('config')}`)
  await runCommand(`rm -rf ${userServerPath('dist')}`)
  await runCommand(`rm -rf ${userServerPath('docs')}`)
  await runCommand(`rm -rf ${userServerPath('storage')}`)
  log.info('Deleted old files', { styled: false })

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

  const r2 = await build({
    entrypoints: await glob([path.appPath('*.ts'), path.appPath('**/*.ts')]),
    outdir: path.frameworkPath('server/dist'),
    format: 'esm',
    target: 'bun',
    sourcemap: 'linked',
    // minify: true,
    splitting: true,
    external: ['@swc/wasm'],
  })

  // TODO: this is a bundler issue and those files should not need to be copied, and that's why we handle the cleanup here as well
  await runCommand(`cp -r ${path.storagePath('app')} ${path.userServerPath()}`)
  await runCommand(`rm -rf ${path.storagePath('app')}`)

  // Process files in the ./app folder
  const appFiles = await glob([path.userServerPath('app/**/*.js')])
  for (const file of appFiles) {
    let content = await fs.readFile(file, 'utf-8')
    if (content.includes('storage/framework/server')) {
      content = content.replace(/storage\/framework\/server/g, 'dist')
      await fs.writeFile(file, content, 'utf-8')
      log.info(`Updated imports in ${file}`, { styled: false })
    }
  }

  // Process files in the ./dist folder
  // need to remove export `{ ENV_KEY, ENV_SECRET, fromEnv };` from whatever file that contains it in the dist/*
  // TODO: test later, potentially a bundler issue
  const distFiles = await glob([path.userServerPath('dist/*.js')])
  for (const file of distFiles) {
    let content = await fs.readFile(file, 'utf-8')
    if (content.includes('export { ENV_KEY, ENV_SECRET, fromEnv };')) {
      content = content.replace(/export { ENV_KEY, ENV_SECRET, fromEnv };/g, '')
      await fs.writeFile(file, content, 'utf-8')
      log.info(`Updated imports in ${file}`, { styled: false })
      break
    }
  }

  // Process the storage folder and remove the .DS_Store files
  const storageFolder = path.storagePath()
  const storageFiles = await glob([storageFolder, '**/*.DS_Store'])

  for (const file of storageFiles) {
    await fs.unlink(file)
  }

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
