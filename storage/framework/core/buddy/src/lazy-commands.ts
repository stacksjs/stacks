import type { CLI } from '@stacksjs/types'

/**
 * Lazy Command Registry
 *
 * This module provides lazy loading for Buddy commands to optimize cold start performance.
 * Commands are only loaded when actually needed, reducing initial bundle size and startup time.
 */

interface CommandLoader {
  path: string
  exportName: string
}

// Map of command names to their lazy loaders
const commandRegistry: Record<string, CommandLoader> = {
  'about': { path: './commands/about.ts', exportName: 'about' },
  'add': { path: './commands/add.ts', exportName: 'add' },
  'auth': { path: './commands/auth.ts', exportName: 'auth' },
  'build': { path: './commands/build.ts', exportName: 'build' },
  'changelog': { path: './commands/changelog.ts', exportName: 'changelog' },
  'clean': { path: './commands/clean.ts', exportName: 'clean' },
  'cloud': { path: './commands/cloud.ts', exportName: 'cloud' },
  'commit': { path: './commands/commit.ts', exportName: 'commit' },
  'completion': { path: './commands/completion.ts', exportName: 'completion' },
  'configure': { path: './commands/configure.ts', exportName: 'configure' },
  'create': { path: './commands/create.ts', exportName: 'create' },
  'deploy': { path: './commands/deploy.ts', exportName: 'deploy' },
  'dev': { path: './commands/dev.ts', exportName: 'dev' },
  'dns': { path: './commands/dns.ts', exportName: 'dns' },
  'doctor': { path: './commands/doctor.ts', exportName: 'doctor' },
  'domains': { path: './commands/domains.ts', exportName: 'domains' },
  'email': { path: './commands/email.ts', exportName: 'email' },
  'env': { path: './commands/env.ts', exportName: 'env' },
  'fresh': { path: './commands/fresh.ts', exportName: 'fresh' },
  'generate': { path: './commands/generate.ts', exportName: 'generate' },
  'http': { path: './commands/http.ts', exportName: 'http' },
  'install': { path: './commands/install.ts', exportName: 'install' },
  'key': { path: './commands/key.ts', exportName: 'key' },
  'lint': { path: './commands/lint.ts', exportName: 'lint' },
  'list': { path: './commands/list.ts', exportName: 'list' },
  'mail': { path: './commands/mail.ts', exportName: 'mailCommands' },
  'maintenance': { path: './commands/maintenance.ts', exportName: 'maintenance' },
  'down': { path: './commands/maintenance.ts', exportName: 'maintenance' },
  'up': { path: './commands/maintenance.ts', exportName: 'maintenance' },
  'status': { path: './commands/maintenance.ts', exportName: 'maintenance' },
  'make': { path: './commands/make.ts', exportName: 'make' },
  'migrate': { path: './commands/migrate.ts', exportName: 'migrate' },
  'outdated': { path: './commands/outdated.ts', exportName: 'outdated' },
  'phone': { path: './commands/phone.ts', exportName: 'phone' },
  'ports': { path: './commands/ports.ts', exportName: 'ports' },
  'prepublish': { path: './commands/prepublish.ts', exportName: 'prepublish' },
  'projects': { path: './commands/projects.ts', exportName: 'projects' },
  'queue': { path: './commands/queue.ts', exportName: 'queue' },
  'release': { path: './commands/release.ts', exportName: 'release' },
  'route': { path: './commands/route.ts', exportName: 'route' },
  'saas': { path: './commands/saas.ts', exportName: 'saas' },
  'schedule': { path: './commands/schedule.ts', exportName: 'schedule' },
  'search': { path: './commands/search.ts', exportName: 'search' },
  'seed': { path: './commands/seed.ts', exportName: 'seed' },
  'setup': { path: './commands/setup.ts', exportName: 'setup' },
  'sms': { path: './commands/sms.ts', exportName: 'sms' },
  'telemetry': { path: './commands/telemetry.ts', exportName: 'telemetryCommand' },
  'test': { path: './commands/test.ts', exportName: 'test' },
  'tinker': { path: './commands/tinker.ts', exportName: 'tinker' },
  'types': { path: './commands/types.ts', exportName: 'types' },
  'undeploy': { path: './commands/cloud.ts', exportName: 'cloud' }, // Alias for cloud:remove
  'upgrade': { path: './commands/upgrade.ts', exportName: 'upgrade' },
  'version': { path: './commands/version.ts', exportName: 'version' },
}

// Commands that are commonly used together (for batch loading optimization)
const commandGroups = {
  'minimal': ['version', 'help'],
  'development': ['dev', 'build', 'test', 'lint'],
  'database': ['migrate', 'seed', 'fresh'],
  'scaffolding': ['make', 'generate'],
  'deployment': ['deploy', 'release', 'cloud'],
  'info': ['about', 'doctor', 'list'],
}

/**
 * Load a specific command lazily
 */
export async function loadCommand(commandName: string, buddy: CLI): Promise<boolean> {
  const loader = commandRegistry[commandName]

  if (!loader) {
    // Don't warn for unknown commands - they may be dynamically loaded later
    return false
  }

  try {
    const module = await import(loader.path)
    const commandFunction = module[loader.exportName]

    if (typeof commandFunction === 'function') {
      commandFunction(buddy)
      return true
    }
    else {
      // Silent fail - don't spam the console during list
      return false
    }
  }
  catch {
    // Silent fail - command will not be available but won't crash the CLI
    return false
  }
}

/**
 * Load multiple commands with timeout
 */
export async function loadCommands(commandNames: string[], buddy: CLI): Promise<void> {
  const timeout = (ms: number) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms))

  await Promise.all(commandNames.map(async (name) => {
    try {
      await Promise.race([
        loadCommand(name, buddy),
        timeout(5000), // 5 second timeout per command
      ])
    }
    catch {
      // Command timed out or failed, continue
    }
  }))
}

/**
 * Load a group of related commands
 */
export async function loadCommandGroup(groupName: keyof typeof commandGroups, buddy: CLI): Promise<void> {
  const commands = commandGroups[groupName]
  if (commands) {
    await loadCommands(commands, buddy)
  }
}

/**
 * Load all commands (for interactive mode or list command)
 */
export async function loadAllCommands(buddy: CLI): Promise<void> {
  const allCommands = Object.keys(commandRegistry)
  await loadCommands(allCommands, buddy)
}

/**
 * Get command names for autocomplete/suggestions
 * (without actually loading the commands)
 */
export function getCommandNames(): string[] {
  return Object.keys(commandRegistry)
}

/**
 * Determine which commands to load based on CLI arguments
 */
export function getCommandsToLoad(args: string[]): string[] {
  const requestedCommand = args[0]

  if (!requestedCommand || requestedCommand.startsWith('-')) {
    // No command or just flags, load minimal set
    return ['version']
  }

  // Extract base command (before ':')
  const baseCommand = requestedCommand.split(':')[0]

  // Special case: 'list' command needs all commands to display them
  if (baseCommand === 'list') {
    // Load list first, then other commands
    return ['list', ...Object.keys(commandRegistry).filter(k => k !== 'list')]
  }

  // Check if it's a known command
  if (commandRegistry[baseCommand]) {
    return [baseCommand]
  }

  // Check if it's a namespaced command like 'make:model'
  if (requestedCommand.includes(':')) {
    const namespace = baseCommand
    if (commandRegistry[namespace]) {
      return [namespace]
    }
  }

  // Unknown command, load help commands
  return ['version']
}
