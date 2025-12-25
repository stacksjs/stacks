import type { MakeOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { get, writeFile } from '@stacksjs/storage'

export interface MakeCommandOptions extends MakeOptions {
  /** Whether to register the command in Commands.ts */
  register?: boolean
  /** Command description */
  description?: string
  /** Command signature (the command name used in CLI) */
  signature?: string
}

/**
 * Create a new command file in app/Commands
 */
export async function makeCommand(options: MakeCommandOptions): Promise<boolean> {
  const name = options.name

  if (!name) {
    log.error('Command name is required')
    return false
  }

  // Pascal case the name
  const commandName = toPascalCase(name)

  // Generate command content
  const content = generateCommandContent(commandName, options)

  // Write the file
  const filePath = p.commandsPath(`${commandName}.ts`)

  try {
    await writeFile(filePath, content)
    log.success(`Created command: ${filePath}`)

    // Register in Commands.ts if requested
    if (options.register !== false) {
      await registerCommand(commandName, options.signature || toKebabCase(name))
    }

    return true
  }
  catch (error) {
    log.error(`Failed to create command: ${(error as Error).message}`)
    return false
  }
}

/**
 * Generate command file content
 */
function generateCommandContent(name: string, options: MakeCommandOptions): string {
  const signature = options.signature || toKebabCase(name)
  const description = options.description || `The ${signature} command`

  return `import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * ${name} Command
 *
 * ${description}
 */

interface ${name}Options {
  verbose: boolean
  // Add your command options here
}

export default function (cli: CLI) {
  cli
    .command('${signature}', '${description}')
    .option('--verbose', 'Enable verbose output', { default: false })
    // Add more options here
    // .option('-n, --name <name>', 'Your name')
    .action(async (options: ${name}Options) => {
      try {
        if (options.verbose) {
          log.info('Running ${signature} command...')
        }

        // TODO: Implement your command logic here

        log.success('${signature} completed successfully!')
        process.exit(ExitCode.Success)
      }
      catch (error) {
        log.error('${signature} failed:', error)
        process.exit(ExitCode.FatalError)
      }
    })

  // Handle unknown subcommands
  cli.on('${signature}:*', () => {
    log.error('Invalid command: %s\\nSee --help for a list of available commands.', cli.args.join(' '))
    process.exit(1)
  })
}
`
}

/**
 * Register the command in app/Commands.ts
 */
async function registerCommand(name: string, signature: string): Promise<void> {
  const commandsPath = p.appPath('Commands.ts')

  try {
    let content = await get(commandsPath)

    // Find the default export object and add the new command
    const exportMatch = content.match(/export default \{([^}]*)\} satisfies/)

    if (exportMatch) {
      const existingCommands = exportMatch[1]

      // Check if command already exists
      if (existingCommands.includes(`'${signature}'`)) {
        log.info(`Command '${signature}' already registered in Commands.ts`)
        return
      }

      // Add the new command before the closing brace
      const newCommand = `  '${signature}': '${name}',\n`
      const updatedCommands = existingCommands.trimEnd() + '\n' + newCommand

      content = content.replace(
        /export default \{([^}]*)\} satisfies/,
        `export default {${updatedCommands}} satisfies`,
      )

      await writeFile(commandsPath, content)
      log.success(`Registered command '${signature}' in Commands.ts`)
    }
  }
  catch (error) {
    log.warn(`Could not register command in Commands.ts: ${(error as Error).message}`)
    log.info('You may need to manually add it to app/Commands.ts')
  }
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toUpperCase())
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}
