import type { CLI, CliOptions } from '@stacksjs/types'
import type { Command } from '@stacksjs/cli'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { onUnknownSubcommand } from "@stacksjs/cli"

export function list(buddy: CLI): void {
  const descriptions = {
    list: 'List all available Buddy commands',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
    filter: 'Filter commands by name or group',
    namespace: 'Filter commands by namespace (e.g., make, env, db)',
    grouped: 'Group commands by category',
    format: 'Output format (text, json)',
    json: 'Output the complete command inventory as JSON',
  }

  buddy
    .command('list', descriptions.list)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-f, --filter [filter]', descriptions.filter)
    .option('-n, --namespace [namespace]', descriptions.namespace)
    .option('-g, --grouped', descriptions.grouped, { default: true })
    .option('--format [format]', descriptions.format, { default: 'text' })
    .option('-J, --json', descriptions.json, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy list')
    .example('buddy list --filter=make')
    .example('buddy list --namespace=make')
    .example('buddy list --namespace=env')
    .example('buddy list --no-grouped')
    .example('buddy list --format=json')
    .example('buddy list --json')
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy list` ...', options)

      const { bold, dim, green } = await import('@stacksjs/cli')

      // Get all registered commands
      const commands = buddy.commands || []

      // Filter commands if filter option is provided
      let filteredCommands = commands
      if ((options as any).filter) {
        const filterStr = String((options as any).filter).toLowerCase()
        filteredCommands = commands.filter((cmd: any) => {
          const name = cmd.name || ''
          const desc = cmd.description || ''
          return name.toLowerCase().includes(filterStr) || desc.toLowerCase().includes(filterStr)
        })
      }

      // Filter by namespace if provided
      if ((options as any).namespace) {
        const namespaceStr = String((options as any).namespace).toLowerCase()
        filteredCommands = filteredCommands.filter((cmd: any) => {
          const namespace = cmd.namespace || ''
          return namespace.toLowerCase() === namespaceStr
        })
      }

      if (filteredCommands.length === 0) {
        if (usesJsonOutput(options)) {
          console.log(JSON.stringify({ commands: [], total: 0 }, null, 2))
        }
        else {
          console.log(dim('No commands found'))
          if ((options as any).filter) {
            console.log(dim(`Try removing the filter: ${(options as any).filter}`))
          }
        }
        return
      }

      // Handle JSON output format
      if (usesJsonOutput(options)) {
        const jsonOutput = filteredCommands
          .map(commandInventoryEntry)
          .sort((a, b) => a.name.localeCompare(b.name))
        console.log(JSON.stringify({ commands: jsonOutput, total: jsonOutput.length }, null, 2))
        return
      }

      // Group commands by category (based on command name prefix)
      if ((options as any).grouped) {
        const groups = new Map<string, any[]>()

        for (const cmd of filteredCommands) {
          const name = cmd.name || ''
          if (!name) continue

          // Extract group from command name (e.g., "env:get" -> "env", "make:model" -> "make")
          let group = 'General'
          if (name.includes(':')) {
            group = name.split(':')[0] ?? 'General'
          }
          else if (['dev', 'build', 'test', 'lint'].includes(name)) {
            group = 'Development'
          }
          else if (['deploy', 'release', 'publish'].includes(name)) {
            group = 'Deployment'
          }
          else if (['migrate', 'seed', 'fresh'].includes(name)) {
            group = 'Database'
          }
          else if (['doctor', 'about', 'version'].includes(name)) {
            group = 'Info'
          }

          if (!groups.has(group)) {
            groups.set(group, [])
          }
          groups.get(group)!.push(cmd)
        }

        // Display grouped commands
        console.log('')
        console.log(bold(green('Available Commands:')))
        console.log('')

        // Sort groups alphabetically, but keep General and Development first
        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
          const order = ['Development', 'General', 'Info']
          const aIndex = order.indexOf(a[0])
          const bIndex = order.indexOf(b[0])

          if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex
          if (aIndex >= 0) return -1
          if (bIndex >= 0) return 1
          return a[0].localeCompare(b[0])
        })

        for (const [group, cmds] of sortedGroups) {
          console.log(bold(`${group}:`))

          // Sort commands within group
          cmds.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

          for (const cmd of cmds) {
            const name = (cmd.name || '').padEnd(20)
            const desc = cmd.description || ''
            console.log(`  ${green(name)} ${dim(desc)}`)
          }

          console.log('')
        }
      }
      else {
        // Display flat list
        console.log('')
        console.log(bold(green('Available Commands:')))
        console.log('')

        // Sort commands alphabetically
        filteredCommands.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

        for (const cmd of filteredCommands) {
          const name = (cmd.name || '').padEnd(20)
          const desc = cmd.description || ''
          console.log(`  ${green(name)} ${dim(desc)}`)
        }

        console.log('')
      }

      console.log(dim(`Total: ${filteredCommands.length} commands`))
      console.log('')
    })

  onUnknownSubcommand(buddy, "list")
}

export interface BuddyCommandInventoryOption {
  name: string
  flags: string[]
  description: string
  required: boolean
  boolean: boolean
  negated: boolean
  default?: unknown
}

export interface BuddyCommandInventoryEntry {
  name: string
  description: string
  aliases: string[]
  namespace?: string
  usage: string
  arguments: Array<{
    name: string
    required: boolean
    variadic: boolean
  }>
  options: BuddyCommandInventoryOption[]
  examples: string[]
}

export function commandInventoryEntry(command: Command): BuddyCommandInventoryEntry {
  const entry: BuddyCommandInventoryEntry = {
    name: command.name,
    description: command.description,
    aliases: [...command.aliasNames],
    usage: command.usageLine,
    arguments: command.args.map(argument => ({
      name: argument.value,
      required: argument.required,
      variadic: argument.variadic,
    })),
    options: command.options.map(option => ({
      name: option.name,
      flags: [...option.names],
      description: option.description,
      required: option.required === true,
      boolean: option.isBoolean === true,
      negated: option.negated,
      ...(option.config.default === undefined ? {} : { default: option.config.default }),
    })),
    examples: command.examples.map(example => typeof example === 'string' ? example : example('buddy')),
  }

  if (command.namespace)
    entry.namespace = command.namespace

  return entry
}

function usesJsonOutput(options: CliOptions): boolean {
  return (options as any).json === true || (options as any).format === 'json'
}
