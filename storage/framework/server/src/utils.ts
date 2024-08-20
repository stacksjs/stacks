import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { path, frameworkCloudPath, frameworkPath, projectPath } from '@stacksjs/path'
import { fs, hasFiles } from '@stacksjs/storage'
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

    return log.info('Using custom server configuration')
  }

  log.info('Using default server configuration')
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
  await runCommand(`rm -rf ${frameworkCloudPath('dist.zip')}`)
  log.success('Deleted old dist.zip')

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

  // move files out of the frameworkPath('server/storage/dist') folder to the frameworkPath('server/storage') folder
  if (fs.existsSync(frameworkPath('server/storage/dist'))) {
    log.info('Moving files...')
    const sourceDir = frameworkPath('server/storage/dist')
    const targetDir = frameworkPath('server/storage')

    // Read all items in the source directory
    const items = await fs.readdir(sourceDir)

    // Move each item to the target directory
    for (const item of items) {
      const srcPath = path.join(sourceDir, item)
      const destPath = path.join(targetDir, item)
      await fs.move(srcPath, destPath, { overwrite: true })
    }

    // Remove the now-empty dist folder
    await fs.remove(sourceDir)
    log.success('Moved files')
  }

  log.info('Copying .env file...')
  await cleanCopy(projectPath('.env'), frameworkPath('server/.env'))
  log.success('Copied .env file')
  log.success('Server ready to be built')

  if (!app.name) {
    log.error('Please provide a name for your app in your config file')
    process.exit(1)
  }

  // this currently does not need to be enabled because our CDK deployment handles the docker build process
  await runCommand(`docker build --pull -t ${slug(app.name)} .`, { cwd: frameworkPath('server') })
  // await $`docker build --pull -t ${slug(app.name)} .`.text()

  log.success('Server built')
  // log.success('Docker image built successfully')
}
