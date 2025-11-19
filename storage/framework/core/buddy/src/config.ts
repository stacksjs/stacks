import type { CLI } from '@stacksjs/cli'
import { existsSync } from 'node:fs'
import { log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

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
        cachedConfig = configModule.default || configModule
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
