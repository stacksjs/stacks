import process from 'node:process'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { log, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { slug } from '@stacksjs/strings'

// TODO: we cannot use Bun Shell scripts here yet because we need to use 1.0.8 for deployments, and Shell scripts were introduced after 1.0.8
// this allows for a custom "server configuration" by the user
if (hasFiles(projectPath('server'))) {
  await runCommand(`rm -rf ../../../server/build.ts`, {
    cwd: projectPath('server'),
  })
  await runCommand(`cp -r ../../../server .`, {
    cwd: projectPath('server'),
  })

  log.info('Using custom server configuration')
}
else {
  log.info('Using default server configuration')
}

await runCommand(`rm -rf ${frameworkPath('server/config')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('config')} ${frameworkPath('server/config')}`, {
  cwd: frameworkPath('server'),
})

await runCommand(`rm -rf ${frameworkPath('server/routes')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('routes')} ${frameworkPath('server/routes')}`, {
  cwd: frameworkPath('server'),
})

await runCommand(`rm -rf ${frameworkPath('server/app')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('app')} ${frameworkPath('server/app')}`, {
  cwd: frameworkPath('server'),
})

await runCommand(`rm -rf ${frameworkPath('server/docs')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('docs')} ${frameworkPath('server/docs')}`, {
  cwd: frameworkPath('server'),
})

await runCommand(`rm -rf ${frameworkPath('server/Actions')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('app/Actions')} ${frameworkPath('server/Actions')}`, {
  cwd: frameworkPath('server'),
})

await runCommand(`rm -rf ${frameworkPath('server/storage')}`, {
  cwd: frameworkPath('server'),
})
await runCommand(`cp -r ${projectPath('storage')} ${frameworkPath('server/storage')}`, {
  cwd: frameworkPath('server'),
})

if (!app.name) {
  log.error('Please provide a name for your app in your config file')
  process.exit(1)
}

// TODO: also allow for a custom container name via a config option
await runCommand(`docker build --pull -t ${slug(app.name)} .`, {
  cwd: frameworkPath('server'),
})
