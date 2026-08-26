import type { MakeOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { get, writeFile } from '@stacksjs/storage'

export interface MakeCommandOptions extends MakeOptions {
  /**
   * Add an entry to `app/Commands.ts`.
   *
   * Off by default: commands are discovered from `app/Commands/`, so the
   * registry is only worth touching when it already exists and the project
   * uses it to order or alias commands.
   */
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
  const signature = options.signature || toKebabCase(name)

  try {
    await writeFile(filePath, content)
    log.success(`Created command: ${filePath}`)

    // The registry is optional - the file is live either way. It is only
    // updated when the project keeps one and asked for the entry.
    if (options.register)
      await registerCommand(commandName, signature)
    else
      log.info(`Run it with: buddy ${signature}`)

    return true
  }
  catch (error) {
    log.error(`Failed to create command: ${(error as Error).message}`)
    return false
  }
}

/**
 * Generate command file content
 *
 * The declarative form: the flags are declared once and the handler's
 * `options` are inferred from them, so there is no hand-written options
 * interface to drift out of step with the flags above it.
 */
function generateCommandContent(name: string, options: MakeCommandOptions): string {
  const signature = options.signature || toKebabCase(name)
  const description = options.description || `The ${signature} command`

  return `import { defineCommand, log } from '@stacksjs/cli'

/**
 * ${name} Command
 *
 * ${description}
 *
 * Registered automatically - every file in app/Commands is a command.
 */
export default defineCommand({
  name: '${signature}',
  description: '${description}',
  options: {
    '--verbose': { description: 'Enable verbose output', default: false },
    // Add more options here. Their types flow into \`handle\`:
    // '--name <name>': 'Who to greet',
  },
  async handle(options) {
    try {
      if (options.verbose)
        log.info('Running ${signature} command...')

      log.info('No command logic implemented yet. Update this command to add behavior.')

      log.success('${signature} completed successfully!')
    }
    catch (error) {
      log.error('${signature} failed:', error)
      throw error
    }
  },
})
`
}

/**
 * Register the command in app/Commands.ts
 */
async function registerCommand(name: string, signature: string): Promise<void> {
  const commandsPath = p.appPath('Commands.ts')

  // Both registry shapes: `export default { ... } satisfies CommandRegistry`
  // and `export default defineCommands({ ... })`. `[\s\S]*` matches across
  // lines so commented-out braces in the file header do not end the match
  // early.
  const patterns = [
    { match: /export default \{([\s\S]*)\} satisfies/, open: 'export default {', close: '} satisfies' },
    { match: /export default defineCommands\(\{([\s\S]*)\}\)/, open: 'export default defineCommands({', close: '})' },
  ]

  try {
    const content = await get(commandsPath)
    const pattern = patterns.find(candidate => candidate.match.test(content))

    if (!pattern) {
      log.info(`Command '${signature}' is live without a registry entry.`)
      return
    }

    const existingCommands = content.match(pattern.match)?.[1] ?? ''

    if (existingCommands.includes(`'${signature}'`)) {
      log.info(`Command '${signature}' already registered in Commands.ts`)
      return
    }

    const updatedCommands = `${existingCommands.trimEnd()}\n  '${signature}': '${name}',\n`

    await writeFile(commandsPath, content.replace(
      pattern.match,
      `${pattern.open}${updatedCommands}${pattern.close}`,
    ))

    log.success(`Registered command '${signature}' in Commands.ts`)
  }
  catch {
    // No registry is the normal case: commands are discovered from disk.
    log.info(`Command '${signature}' is live without a registry entry.`)
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
