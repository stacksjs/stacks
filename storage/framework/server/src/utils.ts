import process from 'node:process'
import { log } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { frameworkCloudPath, frameworkPath, projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { slug } from '@stacksjs/strings'
import { $ } from 'bun'

export async function cleanCopy(sourcePath: string, targetPath: string) {
  $.cwd(frameworkPath('server'))
  log.debug(`Deleting ${targetPath} ...`)
  await $`rm -rf ${targetPath}`.text()
  log.debug(`Copying ${sourcePath} to ${targetPath} ...`)
  await $`cp -r ${sourcePath} ${targetPath}`.text()
  log.debug(`Done copying ${sourcePath} to ${targetPath}`)
}

export async function useCustomOrDefaultServerConfig() {
  if (hasFiles(projectPath('server'))) {
    $.cwd(frameworkPath('server'))

    // if we have a custom server configuration, use it by copying it to the server directory
    await $`cp -r ../../../server .`

    return log.info('Using custom server configuration')
  }

  log.info('Using default server configuration')
}

export async function buildDockerImage() {
  log.info('Preparing build...')

  // delete old CDK relating files, to always build fresh
  log.debug('Deleting old CDK files...')
  await $`rm -rf ${frameworkCloudPath('cdk.out/')}`.text()
  log.debug('Deleting old CDK context file...')
  await $`rm -rf ${frameworkCloudPath('cdk.context.json')}`.text()
  log.debug('Deleting old dist.zip file...')
  await $`rm -rf ${frameworkCloudPath('dist.zip')}`.text()

  log.info('Copying project files...')
  await cleanCopy(projectPath('config'), frameworkPath('server/config'))
  await cleanCopy(projectPath('routes'), frameworkPath('server/routes'))
  await cleanCopy(projectPath('app'), frameworkPath('server/app'))
  await cleanCopy(projectPath('docs'), frameworkPath('server/docs'))
  await cleanCopy(projectPath('storage'), frameworkPath('server/storage'))

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  $.cwd(frameworkPath('server'))

  // build index.ts into index.js, to then use within the Dockerfile
  await $`bun run build`.text()

  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  await $`docker build --pull -t ${slug(app.name)} .`.text()

  log.success('Server ready to be built')
  // log.success('Docker image built successfully')
}
