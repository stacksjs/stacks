import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { slug } from '@stacksjs/strings'

async function cleanAndCopy(sourcePath: string, targetPath: string) {
  await runCommand(`rm -rf ${targetPath}`, {
    cwd: frameworkPath('server'),
  })

  await runCommand(`cp -r ${sourcePath} ${targetPath}`, {
    cwd: frameworkPath('server'),
  })
}

async function useCustomOrDefaultServerConfig() {
  if (hasFiles(projectPath('server'))) {
    // if we have a custom server configuration, use it by copying it to the server directory
    await runCommand(`cp -r ../../../server .`, {
      cwd: frameworkPath('server'),
    })

    return log.info('Using custom server configuration')
  }

  log.info('Using default server configuration')
}

async function buildServer() {
  log.info('Preparing server...')

  await cleanAndCopy(frameworkPath('core'), frameworkPath('server/core'))
  await cleanAndCopy(projectPath('config'), frameworkPath('server/config'))
  await cleanAndCopy(projectPath('routes'), frameworkPath('server/routes'))
  await cleanAndCopy(projectPath('app'), frameworkPath('server/app'))
  await cleanAndCopy(projectPath('docs'), frameworkPath('server/docs'))
  await cleanAndCopy(projectPath('storage'), frameworkPath('server/storage'))

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  // TODO: also allow for a custom container name via a config option
  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  // await runCommand(`docker build --pull -t ${slug(app.name)} .`, {
  //   cwd: frameworkPath('server'),
  // })

  log.success('Server ready to be built')
}

async function main() {
  useCustomOrDefaultServerConfig()
  await buildServer()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
