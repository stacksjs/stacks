import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { frameworkCloudPath, frameworkPath, projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { slug } from '@stacksjs/strings'
import { $ } from 'bun'

export async function cleanCopy(sourcePath: string, targetPath: string) {
  $.cwd(frameworkPath('server'))
  await $`rm -rf ${targetPath}`.text()
  await $`cp -r ${sourcePath} ${targetPath}`.text()
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
  await $`rm -rf ${frameworkCloudPath('cdk.out/')}`
  await $`rm -rf ${frameworkCloudPath('cdk.context.json')}`
  await $`rm -rf ${frameworkCloudPath('dist.zip')}`

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
  // TODO: need to build index.ts into index.js and then run that from within the Dockerfile
  await $`bun run build`.text()

  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  await $`docker build --pull -t ${slug(app.name)} .`.text()

  log.success('Server ready to be built')
  // log.success('Docker image built successfully')
}
