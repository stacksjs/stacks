import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { frameworkPath, join } from '@stacksjs/path'
import { AI_PROVIDERS, isAiProvider } from '../src/commands/setup-ai'
import { commandInventoryEntry } from '../src/commands/list'
import { setup } from '../src/commands/setup'
import { shouldSkipAppKeyCheck } from '../src/project-setup'

/**
 * `buddy setup:ai` materializes the templates in
 * `storage/framework/defaults/ai` into whatever files the chosen agent reads.
 *
 * The behaviour worth pinning here is the contract, not the filesystem work:
 * the command is registered, every provider is reachable, and the templates the
 * command copies from actually exist. The destructive paths (overwriting a
 * project's AGENTS.md) are covered by keeping `--force` away from it, which the
 * provider table below documents.
 */

function registeredCommands(): ReturnType<typeof commandInventoryEntry>[] {
  const commands: any[] = []
  const buddy: any = {
    command(name: string, description: string) {
      const command = {
        name,
        description,
        options: [] as any[],
        aliasNames: [] as string[],
        args: [] as any[],
        rawName: name,
        alias(value: string) {
          this.aliasNames.push(value)
          return this
        },
        option(flags: string, description: string, config?: any) {
          this.options.push({ rawName: flags, description, config, name: flags })
          return this
        },
        action() {
          return this
        },
        example() {
          return this
        },
      }
      commands.push(command)
      return command
    },
    on() {},
  }

  setup(buddy)

  return commands
}

describe('setup:ai command registration', () => {
  it('registers setup:ai alongside the rest of the setup family', () => {
    const names = registeredCommands().map(command => (command as any).name)

    expect(names).toContain('setup:ai [provider]')
    expect(names).toContain('setup:ssl')
    expect(names).toContain('setup:oh-my-zsh')
  })

  it('accepts --copy and --force', () => {
    const command = registeredCommands().find(entry => (entry as any).name.startsWith('setup:ai')) as any
    const flags = command.options.map((option: any) => option.rawName)

    expect(flags).toContain('--copy')
    expect(flags).toContain('--force')
  })

  it('does not require an application key', () => {
    expect(shouldSkipAppKeyCheck('setup:ai')).toBeTrue()
  })
})

describe('AI providers', () => {
  it('covers the agents Stacks supports', () => {
    expect(AI_PROVIDERS.map(provider => provider.id)).toEqual([
      'claude',
      'codex',
      'cursor',
      'copilot',
      'gemini',
    ])
  })

  it('has every provider read AGENTS.md, the one shared file', () => {
    for (const provider of AI_PROVIDERS)
      expect(provider.reads).toContain('AGENTS.md')
  })

  it('recognises known provider ids and rejects anything else', () => {
    expect(isAiProvider('claude')).toBeTrue()
    expect(isAiProvider('gemini')).toBeTrue()
    expect(isAiProvider('Claude')).toBeFalse()
    expect(isAiProvider('copilot-chat')).toBeFalse()
    expect(isAiProvider('')).toBeFalse()
  })
})

describe('AI defaults', () => {
  it('ships the templates setup:ai copies from', () => {
    const defaults = frameworkPath('defaults/ai')

    expect(existsSync(join(defaults, 'AGENTS.md'))).toBeTrue()
    expect(existsSync(join(defaults, 'README.md'))).toBeTrue()
    expect(existsSync(join(defaults, 'claude/launch.json'))).toBeTrue()
    expect(existsSync(join(defaults, 'skills'))).toBeTrue()
  })

  it('ships the cursor rules the cursor provider links to', () => {
    expect(existsSync(frameworkPath('defaults/ide/cursor/rules'))).toBeTrue()
  })
})
