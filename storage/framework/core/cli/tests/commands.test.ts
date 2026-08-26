import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyAliases, defineCommand, discoverCommandFiles, loadCommands, resolveCommands } from '../src/commands'

/**
 * Commands are discovered from `app/Commands/`. `app/Commands.ts` used to be
 * mandatory - every application carried a generated registry that re-declared
 * the framework's own types, and a command the registry did not mention was
 * silently absent from the CLI despite `make:command` promising otherwise.
 */

const roots: string[] = []

function project(files: Record<string, string>): { commandsDir: string, registryPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'stacks-commands-'))
  roots.push(root)

  for (const [name, content] of Object.entries(files)) {
    const file = join(root, name)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, content)
  }

  return { commandsDir: join(root, 'app/Commands'), registryPath: join(root, 'app/Commands.ts') }
}

function command(name: string, aliases: string[] = []): string {
  return `export default (cli) => {
    const c = cli.command('${name}', '${name} command')
    ${aliases.map(alias => `c.alias('${alias}')`).join('\n')}
    return c
  }`
}

function fakeCli() {
  const commands: Array<{ name: string, aliases: string[], alias: (a: string) => unknown }> = []

  return {
    commands,
    command(name: string) {
      const entry = {
        name: name.split(/\s+/)[0] as string,
        aliases: [] as string[],
        alias(value: string) {
          entry.aliases.push(value)
          return entry
        },
      }
      commands.push(entry)
      return entry
    },
  } as any
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('discoverCommandFiles', () => {
  it('finds every command file, including nested ones', () => {
    const { commandsDir } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Archive/Run.ts': command('archive:run'),
    })

    expect(discoverCommandFiles(commandsDir)).toEqual(['Archive/Run', 'Inspire'])
  })

  it('ignores tests, declarations, underscore-prefixed helpers and non-TypeScript files', () => {
    const { commandsDir } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Inspire.test.ts': 'export default () => {}',
      'app/Commands/shared.d.ts': 'export {}',
      'app/Commands/_helpers.ts': 'export const x = 1',
      'app/Commands/README.md': '# commands',
    })

    expect(discoverCommandFiles(commandsDir)).toEqual(['Inspire'])
  })

  it('returns nothing when the directory does not exist', () => {
    expect(discoverCommandFiles(join(tmpdir(), 'stacks-commands-missing'))).toEqual([])
  })
})

describe('resolveCommands', () => {
  it('resolves every file with no registry at all', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Deploy.ts': command('deploy'),
    })

    const resolved = await resolveCommands({ commandsDir, registryPath })

    expect(resolved.map(c => c.file)).toEqual(['Deploy', 'Inspire'])
    expect(resolved.every(c => c.enabled && c.source === 'auto')).toBe(true)
  })

  it('layers registry configuration onto the files it names', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/SendEmails.ts': command('send-emails'),
      'app/Commands.ts': `export default {
        'send-emails': { file: 'SendEmails', aliases: ['emails'], enabled: false },
      }`,
    })

    const resolved = await resolveCommands({ commandsDir, registryPath })
    const emails = resolved.find(c => c.file === 'SendEmails')

    expect(emails?.signature).toBe('send-emails')
    expect(emails?.aliases).toEqual(['emails'])
    expect(emails?.enabled).toBe(false)
    expect(emails?.source).toBe('registry')
  })

  it('still resolves a file the registry never mentions', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Deploy.ts': command('deploy'),
      'app/Commands.ts': `export default { inspire: 'Inspire' }`,
    })

    const resolved = await resolveCommands({ commandsDir, registryPath })

    // Registry order first, then the rest of the directory.
    expect(resolved.map(c => c.file)).toEqual(['Inspire', 'Deploy'])
  })

  it('drops registry entries whose file is gone', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands.ts': `export default { inspire: 'Inspire', deleted: 'Deleted' }`,
    })

    const resolved = await resolveCommands({ commandsDir, registryPath })

    expect(resolved.map(c => c.file)).toEqual(['Inspire'])
  })
})

describe('loadCommands', () => {
  it('registers every command with no registry present', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Archive/Run.ts': command('archive:run'),
    })
    const cli = fakeCli()

    expect(existsSync(registryPath)).toBe(false)

    await loadCommands(cli, { commandsDir, registryPath })

    expect(cli.commands.map((c: any) => c.name).sort()).toEqual(['archive:run', 'inspire'])
  })

  it('skips a command the registry disabled', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/Deploy.ts': command('deploy'),
      'app/Commands.ts': `export default { deploy: { file: 'Deploy', enabled: false } }`,
    })
    const cli = fakeCli()

    await loadCommands(cli, { commandsDir, registryPath })

    expect(cli.commands.map((c: any) => c.name)).toEqual(['inspire'])
  })

  it('skips a command that opted itself out', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Draft.ts': `export const enabled = false\n${command('draft')}`,
    })
    const cli = fakeCli()

    await loadCommands(cli, { commandsDir, registryPath })

    expect(cli.commands).toEqual([])
  })

  it('applies aliases a module declares next to its own code', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/SendEmails.ts': `export const aliases = ['emails', 'mail']\n${command('send-emails')}`,
    })
    const cli = fakeCli()

    await loadCommands(cli, { commandsDir, registryPath })

    expect(cli.commands[0].aliases).toEqual(['emails', 'mail'])
  })

  it('applies aliases the registry declares', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/SendEmails.ts': command('send-emails <type>'),
      'app/Commands.ts': `export default { 'send-emails <type>': { file: 'SendEmails', aliases: ['emails'] } }`,
    })
    const cli = fakeCli()

    await loadCommands(cli, { commandsDir, registryPath })

    expect(cli.commands[0].aliases).toEqual(['emails'])
  })

  it('reports a broken command without dropping the others', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Broken.ts': 'throw new Error("boom")',
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands/NotAFunction.ts': 'export default 42',
    })
    const cli = fakeCli()
    const errors: string[] = []

    const loaded = await loadCommands(cli, { commandsDir, registryPath, onError: message => errors.push(message) })

    expect(cli.commands.map((c: any) => c.name)).toEqual(['inspire'])
    expect(loaded.map(c => c.file)).toEqual(['Inspire'])
    expect(errors).toHaveLength(2)
  })

  it('reports a registry that cannot be read instead of silently ignoring it', async () => {
    const { commandsDir, registryPath } = project({
      'app/Commands/Inspire.ts': command('inspire'),
      'app/Commands.ts': 'export default {',
    })
    const cli = fakeCli()
    const errors: string[] = []

    await loadCommands(cli, { commandsDir, registryPath, onError: message => errors.push(message) })

    // The command still loads - a broken registry is not a broken command.
    expect(cli.commands.map((c: any) => c.name)).toEqual(['inspire'])
    expect(errors).toHaveLength(1)
  })
})

describe('applyAliases', () => {
  it('aliases the command the signature names, arguments and all', () => {
    const cli = fakeCli()
    cli.command('send-emails')
    cli.command('inspire')

    expect(applyAliases(cli, 'send-emails <type>', ['emails', 'mail'])).toBe(true)
    expect(cli.commands[0].aliases).toEqual(['emails', 'mail'])
    expect(cli.commands[1].aliases).toEqual([])
  })

  it('does not throw when nothing matches', () => {
    expect(applyAliases(fakeCli(), 'missing', ['nope'])).toBe(false)
    expect(applyAliases({} as any, 'missing', ['nope'])).toBe(false)
  })
})

describe('defineCommand', () => {
  it('passes an imperative factory straight through', () => {
    const factory = (cli: any) => cli.command('inspire')

    expect(defineCommand(factory)).toBe(factory)
  })

  it('registers a declarative definition, options and aliases included', () => {
    const cli = fakeCli()
    const registered: any[] = []

    cli.command = (name: string) => {
      const entry = {
        name,
        options: [] as any[],
        aliases: [] as string[],
        action: (fn: any) => { entry.handler = fn; return entry },
        option: (flag: string, description: string, config: any) => { entry.options.push({ flag, description, config }); return entry },
        alias: (value: string) => { entry.aliases.push(value); return entry },
        usage: () => entry,
        example: () => entry,
        handler: undefined as any,
      }
      registered.push(entry)
      return entry
    }

    defineCommand({
      name: 'archive:run <project>',
      description: 'Export aged partitions',
      aliases: ['archive'],
      options: {
        '--dry-run': { description: 'Change nothing', default: false },
        '--day <YYYY-MM-DD>': 'Restrict the run to one UTC day',
      },
      handle: (options, project) => ({ options, project }),
    })(cli)

    const entry = registered[0]

    expect(entry.name).toBe('archive:run <project>')
    expect(entry.aliases).toEqual(['archive'])
    expect(entry.options.map((o: any) => o.flag)).toEqual(['--dry-run', '--day <YYYY-MM-DD>'])
    expect(entry.options[0].config).toEqual({ default: false })
    // A description-only option carries no config keys clapp would misread.
    expect(entry.options[1].config).toEqual({})

    // clapp hands the action positional arguments first and options last; the
    // handler takes options first, because most commands have no arguments.
    expect(entry.handler('loghq', { dryRun: true })).toEqual({
      options: { dryRun: true },
      project: 'loghq',
    })
  })
})
