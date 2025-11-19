import type { CLI } from '@stacksjs/cli'
import { existsSync } from 'node:fs'
import { log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

export interface BuddyPlugin {
  /**
   * Plugin name
   */
  name: string

  /**
   * Plugin version
   */
  version?: string

  /**
   * Plugin setup function
   */
  setup: (cli: CLI) => void | Promise<void>

  /**
   * Plugin hooks
   */
  hooks?: {
    beforeCommand?: (context: any) => void | Promise<void>
    afterCommand?: (context: any) => void | Promise<void>
  }
}

export interface BuddyConfig {
  /**
   * CLI theme to use (default, dracula, nord, solarized, monokai)
   */
  theme?: string

  /**
   * Whether to use emoji in output
   */
  emoji?: boolean

  /**
   * Custom commands to register
   */
  commands?: Array<(cli: CLI) => void>

  /**
   * Default flags for all commands
   */
  defaultFlags?: {
    verbose?: boolean
    quiet?: boolean
    debug?: boolean
  }

  /**
   * Aliases for commands
   */
  aliases?: Record<string, string>

  /**
   * Plugins to load
   */
  plugins?: Array<BuddyPlugin | string>
}

interface ValidationError {
  path: string
  message: string
  value?: any
}

/**
 * Validate the buddy config structure
 */
export function validateConfig(config: any): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof config !== 'object' || config === null) {
    errors.push({
      path: 'config',
      message: 'Config must be an object',
      value: config,
    })
    return errors
  }

  // Validate theme
  if (config.theme !== undefined) {
    const validThemes = ['default', 'dracula', 'nord', 'solarized', 'monokai']
    if (typeof config.theme !== 'string' || !validThemes.includes(config.theme)) {
      errors.push({
        path: 'theme',
        message: `Theme must be one of: ${validThemes.join(', ')}`,
        value: config.theme,
      })
    }
  }

  // Validate emoji
  if (config.emoji !== undefined && typeof config.emoji !== 'boolean') {
    errors.push({
      path: 'emoji',
      message: 'Emoji must be a boolean',
      value: config.emoji,
    })
  }

  // Validate commands
  if (config.commands !== undefined) {
    if (!Array.isArray(config.commands)) {
      errors.push({
        path: 'commands',
        message: 'Commands must be an array',
        value: config.commands,
      })
    }
    else {
      config.commands.forEach((cmd: any, index: number) => {
        if (typeof cmd !== 'function') {
          errors.push({
            path: `commands[${index}]`,
            message: 'Each command must be a function',
            value: cmd,
          })
        }
      })
    }
  }

  // Validate defaultFlags
  if (config.defaultFlags !== undefined) {
    if (typeof config.defaultFlags !== 'object' || config.defaultFlags === null) {
      errors.push({
        path: 'defaultFlags',
        message: 'Default flags must be an object',
        value: config.defaultFlags,
      })
    }
    else {
      const flagKeys = ['verbose', 'quiet', 'debug']
      for (const key of Object.keys(config.defaultFlags)) {
        if (!flagKeys.includes(key)) {
          errors.push({
            path: `defaultFlags.${key}`,
            message: `Unknown flag. Valid flags are: ${flagKeys.join(', ')}`,
            value: config.defaultFlags[key],
          })
        }
        else if (typeof config.defaultFlags[key] !== 'boolean') {
          errors.push({
            path: `defaultFlags.${key}`,
            message: 'Flag value must be a boolean',
            value: config.defaultFlags[key],
          })
        }
      }
    }
  }

  // Validate aliases
  if (config.aliases !== undefined) {
    if (typeof config.aliases !== 'object' || config.aliases === null || Array.isArray(config.aliases)) {
      errors.push({
        path: 'aliases',
        message: 'Aliases must be an object mapping alias names to command names',
        value: config.aliases,
      })
    }
    else {
      for (const [alias, command] of Object.entries(config.aliases)) {
        if (typeof command !== 'string') {
          errors.push({
            path: `aliases.${alias}`,
            message: 'Alias target must be a string',
            value: command,
          })
        }
      }
    }
  }

  // Validate plugins
  if (config.plugins !== undefined) {
    if (!Array.isArray(config.plugins)) {
      errors.push({
        path: 'plugins',
        message: 'Plugins must be an array',
        value: config.plugins,
      })
    }
    else {
      config.plugins.forEach((plugin: any, index: number) => {
        if (typeof plugin === 'string') {
          // String plugins are module paths, which is valid
          return
        }
        if (typeof plugin !== 'object' || plugin === null) {
          errors.push({
            path: `plugins[${index}]`,
            message: 'Each plugin must be an object or a string (module path)',
            value: plugin,
          })
          return
        }
        if (!plugin.name || typeof plugin.name !== 'string') {
          errors.push({
            path: `plugins[${index}].name`,
            message: 'Plugin must have a name property of type string',
            value: plugin.name,
          })
        }
        if (!plugin.setup || typeof plugin.setup !== 'function') {
          errors.push({
            path: `plugins[${index}].setup`,
            message: 'Plugin must have a setup function',
            value: plugin.setup,
          })
        }
        if (plugin.hooks !== undefined) {
          if (typeof plugin.hooks !== 'object' || plugin.hooks === null) {
            errors.push({
              path: `plugins[${index}].hooks`,
              message: 'Plugin hooks must be an object',
              value: plugin.hooks,
            })
          }
        }
      })
    }
  }

  // Check for unknown keys
  const validKeys = ['theme', 'emoji', 'commands', 'defaultFlags', 'aliases', 'plugins']
  for (const key of Object.keys(config)) {
    if (!validKeys.includes(key)) {
      errors.push({
        path: key,
        message: `Unknown configuration key. Valid keys are: ${validKeys.join(', ')}`,
        value: config[key],
      })
    }
  }

  return errors
}

let cachedConfig: BuddyConfig | null = null

/**
 * Load buddy.config.ts from the project root
 */
export async function loadBuddyConfig(): Promise<BuddyConfig> {
  if (cachedConfig) {
    return cachedConfig
  }

  const configPaths = [
    p.projectPath('buddy.config.ts'),
    p.projectPath('buddy.config.js'),
    p.projectPath('.buddy.config.ts'),
    p.projectPath('.buddy.config.js'),
  ]

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        log.debug(`Loading buddy config from ${configPath}`)
        const configModule = await import(configPath)
        const config = configModule.default || configModule

        // Validate config
        const validationErrors = validateConfig(config)
        if (validationErrors.length > 0) {
          log.error('Invalid buddy.config.ts:')
          for (const error of validationErrors) {
            log.error(`  - ${error.path}: ${error.message}`)
          }
          throw new Error('Configuration validation failed')
        }

        cachedConfig = config
        return cachedConfig
      }
      catch (error) {
        log.warn(`Failed to load buddy config from ${configPath}:`, error)
      }
    }
  }

  // Return empty config if no config file found
  cachedConfig = {}
  return cachedConfig
}

/**
 * Load and initialize plugins
 */
export async function loadPlugins(cli: CLI, config: BuddyConfig): Promise<void> {
  if (!config.plugins || config.plugins.length === 0) {
    return
  }

  log.debug(`Loading ${config.plugins.length} plugin(s)`)

  for (const pluginConfig of config.plugins) {
    let plugin: BuddyPlugin

    // If plugin is a string, it's a module path
    if (typeof pluginConfig === 'string') {
      try {
        const pluginModule = await import(pluginConfig)
        plugin = pluginModule.default || pluginModule
      }
      catch (error) {
        log.error(`Failed to load plugin from ${pluginConfig}:`, error)
        continue
      }
    }
    else {
      plugin = pluginConfig
    }

    // Run plugin setup
    try {
      log.debug(`Initializing plugin: ${plugin.name}${plugin.version ? ` v${plugin.version}` : ''}`)
      await plugin.setup(cli)

      // Register plugin hooks if provided
      if (plugin.hooks) {
        if (plugin.hooks.beforeCommand) {
          cli.on('command:*', async (command) => {
            if (plugin.hooks?.beforeCommand) {
              await plugin.hooks.beforeCommand({ command })
            }
          })
        }
        if (plugin.hooks.afterCommand) {
          cli.on('command:*', async (command) => {
            if (plugin.hooks?.afterCommand) {
              await plugin.hooks.afterCommand({ command })
            }
          })
        }
      }

      log.debug(`Plugin ${plugin.name} initialized successfully`)
    }
    catch (error) {
      log.error(`Failed to initialize plugin ${plugin.name}:`, error)
    }
  }
}

/**
 * Apply buddy config to CLI instance
 */
export async function applyBuddyConfig(buddy: CLI): Promise<void> {
  const config = await loadBuddyConfig()

  // Apply theme if specified
  if (config.theme && !buddy.theme) {
    const { applyTheme, getAvailableThemes } = await import('@stacksjs/cli')
    const availableThemes = getAvailableThemes()
    if (availableThemes.includes(config.theme)) {
      applyTheme(config.theme as any)
      buddy.theme = config.theme
    }
  }

  // Apply emoji setting if specified
  if (config.emoji !== undefined && buddy.options.noEmoji === undefined) {
    buddy.useEmoji = config.emoji
  }

  // Apply default flags
  if (config.defaultFlags) {
    if (config.defaultFlags.verbose && !buddy.isVerbose) {
      buddy.isVerbose = true
    }
    if (config.defaultFlags.quiet && !buddy.isQuiet) {
      buddy.isQuiet = true
    }
    if (config.defaultFlags.debug && !buddy.isDebug) {
      buddy.isDebug = true
    }
  }

  // Register custom commands
  if (config.commands && Array.isArray(config.commands)) {
    for (const registerCommand of config.commands) {
      if (typeof registerCommand === 'function') {
        registerCommand(buddy)
      }
    }
  }

  // Register command aliases
  if (config.aliases) {
    for (const [alias, command] of Object.entries(config.aliases)) {
      // Find the target command and add the alias
      const targetCommand = buddy.commands.find(cmd => cmd.name === command)
      if (targetCommand && !targetCommand.aliasNames.includes(alias)) {
        targetCommand.aliasNames.push(alias)
      }
    }
  }
}
