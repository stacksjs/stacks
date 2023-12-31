import { italic } from 'src/cli/src'
import { log } from 'src/logging/src'

// import { italic } from '@stacksjs/cli'
// import { ExitCode } from '@stacksjs/types'

const version = 'alpha' // todo: get version from package.json

log.info(`Getting all packages published to version: ${version}`)

// then, we need to publish all the packages (a prepublish hook builds them)
log.info(italic('Publishing all packages...'))

// move dts files

Bun.spawn(['bun', 'server.ts'], {
  stdout: 'pipe',
  cwd: import.meta.dir,
})

// Bun.spawn(['npm', 'run', 'dev'], {
//   stdout: 'pipe',
//   cwd: join(import.meta.dir, 'client'),
// })

// console.log(
//   'If things work properly, see http://localhost:5173',
// )

// await runCommand('bun publish --access public')

log.success(`Successfully released v${version}`)
