import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { cloudPath, frameworkCloudPath, frameworkPath, projectPath, userServerPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { slug } from '@stacksjs/strings'
import { $ } from 'bun'

export async function cleanCopy(sourcePath: string, targetPath: string) {
  try {
    log.debug(`Deleting ${targetPath} ...`)
    await runCommand(`rm -rf ${targetPath}`)
    log.debug(`Copying ${sourcePath} to ${targetPath} ...`)
    await runCommand(`cp -r ${sourcePath} ${targetPath}`)
    log.debug(`Done copying ${sourcePath} to ${targetPath}`)
  } catch (error) {
    log.error(`Error copying ${sourcePath} to ${targetPath}: ${error}`)
  }
}

export async function useCustomOrDefaultServerConfig() {
  if (hasFiles(projectPath('server'))) {
    $.cwd(frameworkPath('server'))

    // if we have a custom server configuration, use it by copying it to the server directory
    await $`cp -r ../../../server .`

    return log.debug('Using custom server configuration')
  }

  log.debug('Using default server configuration')
}

export async function buildDockerImage() {
  log.info('Preparing build...')

  // delete old CDK relating files, to always build fresh
  log.info('Deleting old CDK files...')
  log.info('Deleting old cdk.out ...')
  await runCommand(`rm -rf ${frameworkCloudPath('cdk.out/')}`)
  log.success('Deleted old cdk.out')

  log.info('Deleting old CDK context file...')
  await runCommand(`rm -rf ${frameworkCloudPath('cdk.context.json')}`)
  log.success('Deleted old cdk.context.json')

  log.info('Deleting old dist.zip file...')
  await runCommand(`rm -rf ${cloudPath('dist.zip')}`)
  log.success('Deleted old dist.zip')

  log.info('Deleting .DS_Store files...')
  await runCommand(`rm -rf ${frameworkPath('**/.DS_Store')}`)
  log.success('Deleted .DS_Store files')

  log.info('Deleting sourcemaps...')
  await runCommand(`rm -rf ${frameworkPath('**/*.map')}`)
  log.success('Deleted sourcemaps')

  log.info('Deleting cache files...')
  await runCommand(`rm -rf ${frameworkPath('cache/dashboard')}`)
  await runCommand(`rm -rf ${frameworkPath('cache/docs')}`)
  log.success('Deleted cache files')

  log.info('Copying project files...')
  log.info('Copying config files...')
  await cleanCopy(projectPath('config'), frameworkPath('server/config'))
  log.success('Copied config files')

  log.info('Copying docs files...')
  await cleanCopy(projectPath('docs'), frameworkPath('server/docs'))
  log.success('Copied docs files')

  log.info('Copying storage files...')
  await cleanCopy(projectPath('storage'), frameworkPath('server/storage'))
  log.success('Copied storage files')

  log.info('Copying .env file...')
  await cleanCopy(projectPath('.env'), frameworkPath('server/.env'))
  log.success('Copied .env file')

  Bun.$.cwd(userServerPath())
  await Bun.$`rm -rf ./storage/framework/**/dist/*.js.map`.nothrow()
  await Bun.$`rm -rf ./storage/**/*.lockb`.nothrow()
  await Bun.$`rm -rf ./storage/framework/core/**/tests`.nothrow()
  await Bun.$`rm -rf ./storage/framework/**/src`.nothrow()
  await Bun.$`rm -rf ./storage/framework/docs`.nothrow()
  await Bun.$`rm -rf ./storage/framework/types`.nothrow()
  await Bun.$`rm -rf ./storage/framework/cloud/cdk_out`.nothrow()
  await Bun.$`rm -rf ./storage/**/node_modules`.nothrow()
  await Bun.$`rm -rf .DS_Store`.nothrow()
  await Bun.$`rm -rf **/README.md`.nothrow()
  await Bun.$`rm -rf **/.DS_Store`.nothrow()
  await Bun.$`rm -rf **/browser-auto-imports.json`.nothrow()
  await Bun.$`rm -rf **/server-auto-imports.json`.nothrow()

  log.success('Optimized Docker Image size')
  log.success('Server ready to be built')

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  await runCommand(`docker build --pull -t ${slug(app.name)} .`, { cwd: frameworkPath('server') })
  // await $`docker build --pull -t ${slug(app.name)} .`.text()

  log.debug('Server built')
}
