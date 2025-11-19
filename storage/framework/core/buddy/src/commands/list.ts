import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/logging'

export function list(buddy: CLI): void {
  const descriptions = {
    list: 'List all available Buddy commands',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
    filter: 'Filter commands by name or group',
    namespace: 'Filter commands by namespace (e.g., make, env, db)',
    grouped: 'Group commands by category',
    format: 'Output format (text, json)',
  }

  buddy
    .command('list', descriptions.list)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-f, --filter [filter]', descriptions.filter)
    .option('-n, --namespace [namespace]', descriptions.namespace)
    .option('-g, --grouped', descriptions.grouped, { default: true })
    .option('--format [format]', descriptions.format, { default: 'text' })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy list')
    .example('buddy list --filter=make')
    .example('buddy list --namespace=make')
    .example('buddy list --namespace=env')
    .example('buddy list --no-grouped')
    .example('buddy list --format=json')
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy list` ...', options)

      const { bold, dim, green } = await import('@stacksjs/cli')

      // Get all registered commands
      const commands = buddy.commands || []

      // Filter commands if filter option is provided
      let filteredCommands = commands
      if (options.filter) {
        const filterStr = String(options.filter).toLowerCase()
        filteredCommands = commands.filter((cmd: any) => {
          const name = cmd.name || ''
          const desc = cmd.description || ''
          return name.toLowerCase().includes(filterStr) || desc.toLowerCase().includes(filterStr)
        })
      }

      // Filter by namespace if provided
      if (options.namespace) {
        const namespaceStr = String(options.namespace).toLowerCase()
        filteredCommands = filteredCommands.filter((cmd: any) => {
          const namespace = cmd.namespace || ''
          return namespace.toLowerCase() === namespaceStr
        })
      }

      if (filteredCommands.length === 0) {
        if (options.format === 'json') {
          console.log(JSON.stringify({ commands: [], total: 0 }, null, 2))
        }
        else {
          console.log(dim('No commands found'))
          if (options.filter) {
            console.log(dim(`Try removing the filter: ${options.filter}`))
          }
        }
        return
      }

      // Handle JSON output format
      if (options.format === 'json') {
        const jsonOutput = filteredCommands.map((cmd: any) => ({
          name: cmd.name || '',
          description: cmd.description || '',
          aliases: cmd.aliasNames || [],
        }))
        console.log(JSON.stringify({ commands: jsonOutput, total: jsonOutput.length }, null, 2))
        return
      }

      // Group commands by category (based on command name prefix)
      if (options.grouped) {
        const groups = new Map<string, any[]>()

        for (const cmd of filteredCommands) {
          const name = cmd.name || ''
          if (!name) continue

          // Extract group from command name (e.g., "env:get" -> "env", "make:model" -> "make")
          let group = 'General'
          if (name.includes(':')) {
            group = name.split(':')[0]
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

  buddy.on('list:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
