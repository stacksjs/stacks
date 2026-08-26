import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { frameworkPath, join } from '@stacksjs/path'
import { AI_PROVIDERS, isAiProvider, materialize, setupAiProvider } from '../src/commands/setup-ai'
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

/**
 * `buddy upgrade` runs the AI setup with `--force` so the generated per-agent
 * files get refreshed. A project that had written its own CLAUDE.md instead of
 * AGENTS.md lost the entire file to a symlink in that step, and the upgrade's
 * own output said "AGENTS.md (already present, left alone)" while it happened.
 *
 * The rule these pin: a symlink is ours to re-point, a real file is the
 * developer's, and no flag changes that for CLAUDE.md.
 */
describe('materialize: what --force is allowed to replace', () => {
  const scratch = join(tmpdir(), `stacks-setup-ai-${process.pid}-${Math.trunc(performance.now())}`)

  beforeEach(() => {
    rmSync(scratch, { recursive: true, force: true })
    mkdirSync(scratch, { recursive: true })
    writeFileSync(join(scratch, 'AGENTS.md'), '# AGENTS\n')
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('creates the link when nothing is there', () => {
    const claude = join(scratch, 'CLAUDE.md')
    expect(materialize(join(scratch, 'AGENTS.md'), claude, { copy: false })).toBe(true)
    expect(lstatSync(claude).isSymbolicLink()).toBe(true)
  })

  it('re-points an existing symlink without --force', () => {
    const claude = join(scratch, 'CLAUDE.md')
    symlinkSync('OLD-TARGET.md', claude)

    expect(materialize(join(scratch, 'AGENTS.md'), claude, { copy: false })).toBe(true)
    expect(readlinkSync(claude)).toBe('AGENTS.md')
  })

  it('leaves a real file alone when force is off', () => {
    const claude = join(scratch, 'CLAUDE.md')
    const authored = '# Claude Code Guidelines\n\nProject rules nobody wants deleted.\n'
    writeFileSync(claude, authored)

    expect(materialize(join(scratch, 'AGENTS.md'), claude, { copy: false })).toBe(false)
    expect(lstatSync(claude).isSymbolicLink()).toBe(false)
    expect(readFileSync(claude, 'utf-8')).toBe(authored)
  })

  // The regression itself: `buddy upgrade` passes --force, and the claude
  // branch has to drop it before touching CLAUDE.md. Run the real provider
  // setup against a throwaway project rather than re-asserting materialize's
  // own semantics, which are correct — --force is meant to replace the skills
  // directory and the per-agent rule files; it was never meant to reach this.
  it('setupAiProvider(claude, --force) does not replace an authored CLAUDE.md', () => {
    const previousCwd = process.cwd()
    const authored = '# Claude Code Guidelines\n\nProject rules nobody wants deleted.\n'
    writeFileSync(join(scratch, 'CLAUDE.md'), authored)

    // The templates the claude branch copies, so the run reaches the end
    // instead of stopping at the first missing file and passing by accident.
    const templates = join(scratch, 'storage/framework/defaults/ai')
    mkdirSync(join(templates, 'claude'), { recursive: true })
    writeFileSync(join(templates, 'AGENTS.md'), '# AGENTS template\n')
    writeFileSync(join(templates, 'claude/launch.json'), '{}\n')

    try {
      process.chdir(scratch)
      setupAiProvider('claude', { force: true })
    }
    finally {
      process.chdir(previousCwd)
    }

    const claude = join(scratch, 'CLAUDE.md')
    expect(lstatSync(claude).isSymbolicLink()).toBe(false)
    expect(readFileSync(claude, 'utf-8')).toBe(authored)
  })
})
