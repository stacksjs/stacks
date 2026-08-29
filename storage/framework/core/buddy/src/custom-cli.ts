import process from 'node:process'
import { cli, loadCommands, log } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

// setup global error handlers
process.on('uncaughtException', handleError)
process.on('unhandledRejection', handleError)

async function main() {
  const buddy = cli(config.cli.name)

  if (!fs.existsSync(p.projectPath(config.cli.command)))
    fs.writeFileSync(p.projectPath(config.cli.command), `import('./storage/framework/core/buddy/src/custom-cli')`)

  // Register the commands the application defines in ./app/Commands/*. The
  // same loader buddy uses, so a command behaves identically whether it runs
  // through buddy or through the application's own binary.
  await loadCommands(buddy, {
    commandsDir: p.appPath('Commands'),
    registryPath: p.appPath('Commands.ts'),
    onError: (message, error) => log.error(`${message}:`, error),
    onDebug: message => log.debug(message),
  })

  buddy.parse()
}

await main()
