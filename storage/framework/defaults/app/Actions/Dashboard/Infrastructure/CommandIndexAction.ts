import { Action } from '@stacksjs/actions'
import { resolveCommands } from '@stacksjs/cli'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { parseCommandSource } from '../Source/source-inventory'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'CommandIndexAction',
  description: 'Lists commands registered by the application.',
  method: 'GET',
  async handle() {
    try {
      const projectRoot = process.cwd()
      const commandsDir = join(projectRoot, 'app/Commands')

      // Every file under app/Commands is a command; app/Commands.ts is an
      // optional overlay. Listing only registry entries used to hide any
      // command the project never bothered to register - which, now that
      // registering is unnecessary, would have been most of them.
      const commands = await resolveCommands({
        commandsDir,
        registryPath: join(projectRoot, 'app/Commands.ts'),
      })

      const items = commands.flatMap((command) => {
        if (!existsSync(command.path))
          return []

        return [parseCommandSource(
          readFileSync(command.path, 'utf8'),
          relative(projectRoot, command.path),
          command.signature ?? command.file,
          command.aliases,
          statSync(command.path).mtime.toISOString(),
        )]
      })

      return {
        items,
        stats: {
          total: items.length,
          aliases: items.reduce((sum, item) => sum + (item.aliases?.length || 0), 0),
          options: items.reduce((sum, item) => sum + (item.options?.length || 0), 0),
          registered: commands.filter(command => command.source === 'registry').length,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Command sources could not be loaded.', 'CommandIndexAction')
    }
  },
})
