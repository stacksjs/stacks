import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app, cloud as cloudConfig } from '@stacksjs/config'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { cloud } from '../core/buddy/src'

// import { slug } from '@stacksjs/strings'

async function cleanAndCopy(sourcePath: string, targetPath: string) {
  await runCommand(`rm -rf ${targetPath}`, {
    cwd: frameworkPath('cloud'),
  })

  await runCommand(`cp -r ${sourcePath} ${targetPath}`, {
    cwd: frameworkPath('cloud'),
  })
}

async function useCustomOrDefaultServerConfig() {
  if (hasFiles(projectPath('server'))) {
    // if we have a custom server configuration, use it by copying it to the server directory
    await runCommand(`cp -r ../../../server .`, {
      cwd: frameworkPath('cloud'),
    })

    return log.info('Using custom server configuration')
  }

  log.info('Using default server configuration')
}

async function buildServer() {
  log.info('Preparing server...')

  await cleanAndCopy(frameworkPath('core'), frameworkPath('cloud/core'))
  await cleanAndCopy(projectPath('config'), frameworkPath('cloud/config'))
  await cleanAndCopy(projectPath('routes'), frameworkPath('cloud/routes'))
  await cleanAndCopy(projectPath('app'), frameworkPath('cloud/app'))
  await cleanAndCopy(projectPath('docs'), frameworkPath('cloud/docs'))
  await cleanAndCopy(projectPath('storage'), frameworkPath('cloud/storage'))

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  // TODO: also allow for a custom container name via a config option
  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  // await runCommand(`docker build --pull -t ${slug(app.name)} .`, {
  //   cwd: frameworkPath('cloud'),
  // })

  log.success('Server ready to be built')
}

async function main() {
  useCustomOrDefaultServerConfig()
  if (cloudConfig.api?.deploy)
    await buildServer()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
