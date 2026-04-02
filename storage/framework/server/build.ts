import process from 'node:process'
import { intro, outro } from '@stacksjs/build'
import { log, runCommand, runCommandSync } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { fs, deleteFolder, writeFileSync, readFileSync } from '@stacksjs/storage'
import { build } from 'bun'
import { buildDockerImage, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  const { startTime } = await intro({
    dir: import.meta.dir,
    pkgName: 'Server Docker Image',
  })

  // if stacks-container is running, stop it
  const stacksContainer = await runCommandSync(`timeout 2s docker ps -a --filter name=stacks-server --format "{{.ID}}"`)

  if (stacksContainer) {
    log.info(`Stopping stacks-server container: ${stacksContainer}`)
    await runCommand(`docker stop stacks-server`)
    log.info('Stopped stacks-server container')
  }

  log.info('Cleanup of previous build files...')
  log.info(`  ${path.userServerPath('app')}`, { styled: false })
  await deleteFolder(path.userServerPath('app'))
  log.info(`  ${path.userServerPath('config')}`, { styled: false })
  await deleteFolder(path.userServerPath('config'))
  log.info(`  ${path.userServerPath('dist')}`, { styled: false })
  await deleteFolder(path.userServerPath('dist'))
  log.info(`  ${path.userServerPath('docs')}`, { styled: false })
  await deleteFolder(path.userServerPath('docs'))
  log.info(`  ${path.userServerPath('storage')}`, { styled: false })
  // await deleteFolder(path.userServerPath('storage'))
  await Bun.$`rm -rf ${path.userServerPath('storage')}`.text()
  log.success('Cleaned up previous build files')

  log.info('Building...')
  const result = await build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    format: 'esm',
    target: 'bun',
    // sourcemap: 'linked',
    // minify: true,
  })

  if (result.success) {
    log.success('Server built')
  } else {
    log.error('Server Build failed')
    process.exit(1)
  }

  await useCustomOrDefaultServerConfig()

  log.info('Building app...')

  const { startTime: perf } = await intro({
    dir: import.meta.dir,
    pkgName: 'server',
  })

  const glob = new Bun.Glob('**/*.{ts,js}')
  const root = path.appPath()
  const scanOptions = { cwd: root, onlyFiles: true }
  const files: string[] = []

  for await (const file of glob.scan(scanOptions)) {
    files.push(file)
  }

  const r2 = await Bun.build({
    root,
    entrypoints: files.map((file) => path.resolve(root, file)),
    outdir: path.frameworkPath('server/app'),
    format: 'esm',
    target: 'bun',
    // sourcemap: 'linked',
    // minify: true,
    splitting: false, // Disabled to avoid duplicate output path issues
    external: ['@swc/wasm'],
  })

  if (r2.success) {
    log.success('App built')
  } else {
    log.error('Build failed')
    console.log(r2.logs)
    process.exit(1)
  }

  // Rewrite import paths in bundled app code.
  // The bundler emits imports relative to the source tree (storage/framework/server/...)
  // but in the Docker image these resolve from dist/. Only rewrite exact import path
  // segments to avoid corrupting unrelated strings.
  const glob2 = new Bun.Glob('**/*.js')
  const appPath = path.userServerPath('app')
  const scanOptions2 = { cwd: appPath, onlyFiles: true }
  const importPathPattern = /from\s+["']([^"']*storage\/framework\/server)([^"']*)["']/g

  for await (const file of glob2.scan(scanOptions2)) {
    const filePath = path.resolve(appPath, file)
    let content = readFileSync(filePath, 'utf-8')
    if (importPathPattern.test(content)) {
      importPathPattern.lastIndex = 0
      content = content.replace(importPathPattern, (_, _prefix, suffix) => `from "dist${suffix}"`)
      writeFileSync(filePath, content, 'utf-8')
      log.info(`Rewrote import paths in ${file}`)
    }
  }

  // Strip re-exported env internals from the bundled dist.
  // Bun's bundler sometimes hoists and re-exports these from @stacksjs/env,
  // which causes duplicate export errors at runtime. We strip the specific
  // export statement rather than a broad string match.
  const glob3 = new Bun.Glob('**/*.js')
  const distPath = path.userServerPath('dist')
  const scanOptions3 = { cwd: distPath, onlyFiles: true }
  const envExportPattern = /export\s*\{\s*ENV_KEY\s*,\s*ENV_SECRET\s*,\s*fromEnv\s*\}\s*;?/g

  for await (const file of glob3.scan(scanOptions3)) {
    const filePath = path.resolve(distPath, file)
    let content = readFileSync(filePath, 'utf-8')
    if (envExportPattern.test(content)) {
      envExportPattern.lastIndex = 0
      content = content.replace(envExportPattern, '/* stripped: env re-export */')
      writeFileSync(filePath, content, 'utf-8')
      log.info(`Stripped env re-export in ${file}`)
      break
    }
  }

  await outro({
    dir: import.meta.dir,
    startTime: perf,
    result: r2,
    pkgName: 'server',
  })

  if (cloud.api?.deploy) await buildDockerImage()
}

main()
  .catch((error) => {
    log.error(`Build failed: ${error}`)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })
