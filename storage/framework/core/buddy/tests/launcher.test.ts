import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { projectCliEntry, registerProject } from '@stacksjs/path'
import { findProjectSelector, isMachineCommand, planInvocation, projectAfterCommand, SHORT_P_IS_NOT_PROJECT } from '../src/launcher'
import { CLI_SHEBANG, isIsolatedRuntime, ISOLATED_RUNTIME_FLAGS } from '../src/runtime-flags'
import { getCommandNames } from '../src/lazy-commands'

const builtInCommands = new Set(getCommandNames())
const cliEntry = resolve(import.meta.dir, '../src/cli.ts')
const repoRoot = resolve(import.meta.dir, '../../../../..')

let sandbox: string
let previousHome: string | undefined

/** A project the way a package-based app is one. */
function makeProject(name: string, options: { installed?: boolean, shim?: boolean } = {}): string {
  const root = join(sandbox, name)
  mkdirSync(join(root, 'config'), { recursive: true })
  mkdirSync(join(root, 'app/Models'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
  writeFileSync(join(root, 'config/app.ts'), 'export default {}')

  if (options.installed) {
    mkdirSync(join(root, 'node_modules/@stacksjs/buddy/dist'), { recursive: true })
    writeFileSync(join(root, 'node_modules/@stacksjs/buddy/dist/cli.js'), '')
  }
  if (options.shim) {
    writeFileSync(join(root, 'buddy'), '#!/bin/sh\n')
    chmodSync(join(root, 'buddy'), 0o755)
  }

  return realpathSync(root)
}

function plan(args: string[], cwd: string, overrides: { main?: string, handedRoot?: string } = {}) {
  return planInvocation({
    args,
    cwd,
    main: overrides.main ?? '/opt/global/buddy/dist/cli.js',
    execArgv: [],
    handedRoot: overrides.handedRoot,
    builtInCommands,
  })
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-launcher-')))
  previousHome = process.env.STACKS_HOME
  process.env.STACKS_HOME = join(sandbox, '.stacks')
})

afterEach(() => {
  if (previousHome === undefined)
    delete process.env.STACKS_HOME
  else
    process.env.STACKS_HOME = previousHome
  rmSync(sandbox, { recursive: true, force: true })
})

describe('which project a command runs for', () => {
  it('runs where it is when there is no project around', () => {
    expect(plan(['env:get', 'KEY'], sandbox)).toEqual({ kind: 'run', root: null, args: ['env:get', 'KEY'] })
  })

  it('installs a project that has nothing installed, in place', () => {
    const root = makeProject('fresh')
    expect(plan(['install'], root)).toEqual({ kind: 'run', root, args: ['install'] })
  })

  it('runs nothing else for a project that has nothing installed, and says how to install it', () => {
    const root = makeProject('fresh', { shim: true })

    // Its code imports packages that are not there; run by a buddy from
    // elsewhere they would resolve through Bun's auto-install instead.
    // Describing the commands means loading them: `list` and `--help` too.
    for (const args of [['migrate'], ['dev'], ['sync:clients'], ['list'], ['--help'], []]) {
      expect(plan(args, root)).toEqual({
        kind: 'refuse',
        message: expect.stringContaining('buddy install --project fresh'),
      })
    }
  })

  it('restarts in the project root when run from a directory inside it', () => {
    const root = makeProject('shop', { installed: true })
    const own = join(root, 'node_modules/@stacksjs/buddy/dist/cli.js')
    const invocation = plan(['migrate'], join(root, 'app/Models'), { main: own })

    // Bun reads bunfig.toml, and the preload that loads .env, only from the
    // directory it starts in: changing directory afterwards would not do.
    expect(invocation).toEqual({ kind: 'handoff', root, command: [process.execPath, own, 'migrate'] })
  })

  it('hands over to the project\'s own buddy, through its shim', () => {
    const root = makeProject('shop', { installed: true, shim: true })

    expect(plan(['migrate', '--diff'], join(root, 'app'))).toEqual({
      kind: 'handoff',
      root,
      command: [join(root, 'buddy'), 'migrate', '--diff'],
    })
  })

  it('runs the installed entry directly when the project has no shim', () => {
    const root = makeProject('shop', { installed: true })

    expect(plan(['migrate'], root)).toEqual({
      kind: 'handoff',
      root,
      command: [process.execPath, join(root, 'node_modules/@stacksjs/buddy/dist/cli.js'), 'migrate'],
    })
  })

  it('does not hand over to itself', () => {
    const root = makeProject('shop', { installed: true, shim: true })
    const own = join(root, 'node_modules/@stacksjs/buddy/dist/cli.js')

    expect(plan(['migrate'], root, { main: own })).toEqual({ kind: 'run', root, args: ['migrate'] })
  })

  it('restarts under the project\'s config when the executable turns out to be the project\'s own', () => {
    const root = makeProject('shop', { installed: true, shim: true })
    const own = join(root, 'node_modules/@stacksjs/buddy/dist/cli.js')
    const isolated = [...ISOLATED_RUNTIME_FLAGS]

    // `node_modules/.bin/buddy` in an npm script: started without the
    // project's bunfig, in the project. Its env plugin and preloader have to run.
    expect(planInvocation({ args: ['migrate'], cwd: root, main: own, execArgv: isolated, builtInCommands })).toEqual({
      kind: 'handoff',
      root,
      command: [process.execPath, own, 'migrate'],
    })
    // Once restarted it is where it should be.
    expect(planInvocation({ args: ['migrate'], cwd: root, main: own, execArgv: [], handedRoot: root, builtInCommands })).toEqual({ kind: 'run', root, args: ['migrate'] })
  })

  it('keeps a project with nothing installed away from the config that preloads what is missing', () => {
    const root = makeProject('fresh')
    const isolated = [...ISOLATED_RUNTIME_FLAGS]

    expect(planInvocation({ args: ['install'], cwd: root, main: cliEntry, execArgv: isolated, builtInCommands })).toEqual({ kind: 'run', root, args: ['install'] })
    expect(planInvocation({ args: ['install'], cwd: join(root, 'app'), main: cliEntry, execArgv: isolated, builtInCommands })).toEqual({
      kind: 'handoff',
      root,
      command: [process.execPath, ...isolated, cliEntry, 'install'],
    })
  })

  it('publishes an executable that starts Bun isolated', () => {
    expect(CLI_SHEBANG).toBe('#!/usr/bin/env -S bun --config=/dev/null --no-install')
    expect(isIsolatedRuntime(['--config=/dev/null', '--no-install', '--smol'])).toBe(true)
    expect(isIsolatedRuntime(['--no-install'])).toBe(false)
  })

  it('stays put once it has been handed the project, whatever the entries look like', () => {
    const root = makeProject('shop', { installed: true, shim: true })

    expect(plan(['migrate'], root, { handedRoot: root })).toEqual({ kind: 'run', root, args: ['migrate'] })
    // Handed a different project than the one it stands in: decide afresh.
    expect(plan(['migrate'], root, { handedRoot: makeProject('other') }).kind).toBe('handoff')
  })
})

describe('--project', () => {
  it('targets a listed project by name and starts the command in it', () => {
    const shop = makeProject('shop', { installed: true, shim: true })
    registerProject(shop)

    // The selector is spent on choosing the project. The command starts in
    // its root, which every command reading --project falls back to, and a
    // project's own buddy from before this launcher never sees the option it
    // would resolve by running a `buddy` from PATH.
    expect(plan(['migrate', '--project', 'shop', '--diff'], sandbox)).toEqual({
      kind: 'handoff',
      root: shop,
      command: [join(shop, 'buddy'), 'migrate', '--diff'],
    })
    expect(plan(['migrate', '--project=shop'], sandbox)).toMatchObject({ command: [join(shop, 'buddy'), 'migrate'] })
    expect(plan(['dev:dashboard', '-p', 'shop', '--verbose'], sandbox)).toMatchObject({ root: shop, command: [join(shop, 'buddy'), 'dev:dashboard', '--verbose'] })
  })

  it('takes a path as well as a name', () => {
    const shop = makeProject('shop', { installed: true, shim: true })

    expect(plan(['migrate', '--project', './shop/app'], sandbox)).toMatchObject({ kind: 'handoff', root: shop })
  })

  it('takes the project in front of the command too, for any command', () => {
    const shop = makeProject('shop', { installed: true, shim: true })
    registerProject(shop)

    expect(projectAfterCommand(['-p', 'shop', 'serve', '-p', '3000'])).toEqual(['serve', '--project', 'shop', '-p', '3000'])
    expect(projectAfterCommand(['--project=shop', 'migrate'])).toEqual(['migrate', '--project', 'shop'])
    // Nothing to move it behind.
    expect(projectAfterCommand(['-p', 'shop'])).toEqual(['-p', 'shop'])

    // `serve -p` is a port behind the command, and still the project in front of it.
    expect(plan(['-p', 'shop', 'serve', '-p', '3000'], sandbox)).toEqual({ kind: 'handoff', root: shop, command: [join(shop, 'buddy'), 'serve', '-p', '3000'] })
    // An application command's own --project is its own only behind it.
    expect(plan(['--project', 'shop', 'sync:clients'], sandbox)).toEqual({ kind: 'handoff', root: shop, command: [join(shop, 'buddy'), 'sync:clients'] })
    // A machine command reads it itself.
    expect(plan(['-p', 'shop', 'dashboard'], sandbox)).toEqual({ kind: 'run', root: null, args: ['dashboard', '--project', 'shop'] })
  })

  it('installs a project named from outside it', () => {
    const fresh = makeProject('fresh')
    registerProject(fresh)

    expect(plan(['install', '--project', 'fresh'], sandbox, { main: cliEntry })).toEqual({
      kind: 'handoff',
      root: fresh,
      command: [process.execPath, cliEntry, 'install'],
    })
  })

  it('refuses a project it cannot identify rather than running in the wrong one', () => {
    registerProject(makeProject('shop-admin'))
    registerProject(makeProject('shop-api'))
    const here = makeProject('here')

    const ambiguous = plan(['migrate', '--project', 'shop'], here)
    expect(ambiguous.kind).toBe('refuse')
    expect(ambiguous).toMatchObject({ message: expect.stringContaining('shop-admin') })

    expect(plan(['migrate', '--project', 'nowhere'], here)).toMatchObject({
      kind: 'refuse',
      message: expect.stringContaining('No Stacks project matches "nowhere"'),
    })
  })

  it('reads -p as the project only where the command declares it so', () => {
    expect(findProjectSelector(['dev', '-p', 'shop'], builtInCommands)).toEqual({ value: 'shop', index: 2, attached: null })
    expect(findProjectSelector(['serve', '-p', '3000'], builtInCommands)).toBeNull()
    expect(findProjectSelector(['serve', '--project', 'shop'], builtInCommands)).toMatchObject({ value: 'shop' })
    // An optional value: the bare flag selects nothing.
    expect(findProjectSelector(['dev', '--project'], builtInCommands)).toBeNull()
    expect(findProjectSelector(['dev', '--project', '--verbose'], builtInCommands)).toBeNull()
    // Past `--` the arguments belong to whatever the command runs.
    expect(findProjectSelector(['test', '--', '--project', 'tsconfig.json'], builtInCommands)).toBeNull()
  })

  it('leaves an application command\'s own --project alone', () => {
    const here = makeProject('here', { installed: true })

    expect(findProjectSelector(['sync:clients', '--project', 'acme'], builtInCommands)).toBeNull()
    expect(plan(['sync:clients', '--project', 'acme'], here)).toEqual({
      kind: 'handoff',
      root: here,
      command: [process.execPath, join(here, 'node_modules/@stacksjs/buddy/dist/cli.js'), 'sync:clients', '--project', 'acme'],
    })
  })
})

describe('machine commands', () => {
  it('run where they are typed and are never handed to a project', () => {
    const shop = makeProject('shop', { installed: true, shim: true })

    for (const command of ['projects', 'projects:scan', 'cd', 'daemon', 'daemon:status', 'dashboard', 'new', 'create'])
      expect(plan([command], join(shop, 'app')), command).toEqual({ kind: 'run', root: shop, args: [command] })
  })

  it('do not include a project\'s feature switches', () => {
    expect(isMachineCommand('dashboard')).toBe(true)
    expect(isMachineCommand('dashboard:install')).toBe(false)
    expect(isMachineCommand('dev')).toBe(false)
  })
})

describe('agreement with the rest of the framework', () => {
  it('looks for a project\'s CLI where the buddy shim does, in the same order', () => {
    const shim = readFileSync(join(repoRoot, 'buddy'), 'utf8')
    const body = shim.slice(shim.indexOf('resolve_buddy_entry() {'), shim.indexOf('if ! BUDDY_ENTRY='))
    const fromShim = [...body.matchAll(/"\$\{(ROOT_DIR|PANTRY_DIR)\}\/([^"]+)"/g)]
      .map(match => `${match[1] === 'PANTRY_DIR' ? 'pantry/' : ''}${match[2]}`)

    expect(fromShim.length).toBeGreaterThan(0)
    // The first candidate present wins, so each one is created alone.
    for (const candidate of fromShim) {
      const root = makeProject(`entry-${fromShim.indexOf(candidate)}`)
      mkdirSync(join(root, candidate, '..'), { recursive: true })
      writeFileSync(join(root, candidate), '')
      expect(projectCliEntry(root)).toBe(join(root, candidate))
    }

    // And with all of them present, the shim's first is the one chosen.
    const all = makeProject('entry-all')
    for (const candidate of fromShim) {
      mkdirSync(join(all, candidate, '..'), { recursive: true })
      writeFileSync(join(all, candidate), '')
    }
    expect(projectCliEntry(all)).toBe(join(all, fromShim[0]!))
  })

  it('knows every built-in command whose -p is not the project', () => {
    const commandsDir = resolve(import.meta.dir, '../src/commands')
    const exceptions = new Set<string>()

    for (const file of readdirSync(commandsDir).filter(name => name.endsWith('.ts'))) {
      const source = readFileSync(join(commandsDir, file), 'utf8')
      // Each `.command(` up to the next one is one command and its options.
      for (const chunk of source.split('.command(').slice(1)) {
        const name = chunk.match(/^\s*['"`]([\w:-]+)/)?.[1]
        const short = chunk.match(/['"`]-p, --([\w-]+)/)?.[1]
        if (!name || !short || short === 'project')
          continue

        exceptions.add(name)
        for (const alias of chunk.matchAll(/\.alias\(['"`]([\w:-]+)/g))
          exceptions.add(alias[1]!)
      }
    }

    expect([...exceptions].sort()).toEqual([...SHORT_P_IS_NOT_PROJECT].sort())
  })
})

describe('the CLI, from outside every project', () => {
  async function buddy(args: string[], cwd: string): Promise<{ code: number, stdout: string, stderr: string }> {
    const child = Bun.spawn([process.execPath, cliEntry, ...args], {
      cwd,
      env: { ...process.env, STACKS_HOME: process.env.STACKS_HOME! },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    return { code, stdout, stderr }
  }

  it('lists the machine\'s projects and finds one by name', async () => {
    const shop = makeProject('shop')
    const outside = join(sandbox, 'elsewhere')
    mkdirSync(outside)

    const added = await buddy(['projects:add', shop], outside)
    expect(added.code, added.stderr).toBe(0)

    const listed = await buddy(['projects', '--quiet'], outside)
    expect(listed.code, listed.stderr).toBe(0)
    expect(listed.stdout.trim().split('\n')).toEqual([shop])

    const found = await buddy(['cd', 'shop'], outside)
    expect(found.code, found.stderr).toBe(0)
    expect(found.stdout.trim()).toBe(shop)

    const missing = await buddy(['cd', 'nowhere'], outside)
    expect(missing.code).not.toBe(0)
    expect(missing.stderr).toContain('No Stacks project matched: nowhere')
  }, 60_000)
})
