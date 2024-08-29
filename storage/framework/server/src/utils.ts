import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { frameworkCloudPath, frameworkPath, projectPath } from '@stacksjs/path'
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
  log.debug('Deleting old CDK files...')
  log.debug('Deleting old cdk.out ...')
  await runCommand(`rm -rf ${frameworkCloudPath('cdk.out/')}`)
  log.debug('Deleted old cdk.out')

  log.debug('Deleting old CDK context file...')
  await runCommand(`rm -rf ${frameworkCloudPath('cdk.context.json')}`)
  log.debug('Deleted old cdk.context.json')

  log.debug('Deleting old dist.zip file...')
  await runCommand(`rm -rf ${frameworkCloudPath('dist.zip')}`)
  log.debug('Deleted old dist.zip')

  log.debug('Deleting .DS_Store files...')
  await runCommand(`rm -rf ${frameworkPath('**/.DS_Store')}`)
  log.debug('Deleted .DS_Store files')

  log.debug('Deleting sourcemaps...')
  await runCommand(`rm -rf ${frameworkPath('**/*.map')}`)
  log.debug('Deleted sourcemaps')

  log.debug('Deleting cache files...')
  await runCommand(`rm -rf ${frameworkPath('cache/dashboard')}`)
  await runCommand(`rm -rf ${frameworkPath('cache/docs')}`)
  log.debug('Deleted cache files')

  log.debug('Copying project files...')
  log.debug('Copying config files...')
  await cleanCopy(projectPath('config'), frameworkPath('server/config'))
  log.debug('Copied config files')

  log.debug('Copying docs files...')
  await cleanCopy(projectPath('docs'), frameworkPath('server/docs'))
  log.debug('Copied docs files')

  log.debug('Copying storage files...')
  await cleanCopy(projectPath('storage'), frameworkPath('server/storage'))
  log.debug('Copied storage files')

  log.debug('Copying .env file...')
  await cleanCopy(projectPath('.env'), frameworkPath('server/.env'))
  log.debug('Copied .env file')
  log.debug('Server ready to be built')

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  await runCommand(`docker build --pull -t ${slug(app.name)} .`, { cwd: frameworkPath('server') })
  // await $`docker build --pull -t ${slug(app.name)} .`.text()

  log.debug('Server built')
}
