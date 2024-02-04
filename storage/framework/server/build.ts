import { $ } from 'bun'
import { projectPath } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { log } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { slug } from '@stacksjs/strings'

if (hasFiles(projectPath('server'))) {
  await $`rm -rf ../../../server/build.ts`
  await $`cp -r ../../../server .`

  log.info('Using custom server configuration')
}
else {
  log.info('Using default server configuration')
}

await $`cp -r ../../../config ./config`
await $`cp -r ../../../routes ./routes`

// TODO: also allow for a custom container name via a config
await $`docker build --pull -t ${slug(app.name)} .`
