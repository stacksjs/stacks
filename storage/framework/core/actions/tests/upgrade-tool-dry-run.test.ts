import { afterAll, beforeAll, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'

// Real stage sources with only native path and external command boundaries
// redirected into an owned fixture. HOME is never changed, including on red.
const root = mkdtempSync(join(tmpdir(), 'upgrade-tool-preview-'))
const sources = join(import.meta.dir, '../src/upgrade')
const stages = ['framework', 'dependencies', 'bun', 'shell', 'binary']
const dispatcher = join(root, 'dispatcher.js')

beforeAll(async () => {
  const result = await Bun.build({ entrypoints: [join(sources, 'index.ts')], target: 'bun', conditions: ['development'], outdir: root, naming: 'dispatcher.js' })
  expect(result.success, result.logs.join('\n')).toBe(true)
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

async function campaign(args: string[], options: { direct?: 'shell' | 'binary' | 'dependencies' | 'bun', failCompile?: boolean } = {}) {
  const app = mkdtempSync(join(root, 'project with spaces '))
  const directory = join(app, 'storage/framework/core/actions/src/upgrade')
  const home = join(app, 'fixture home')
  const tools = join(app, 'tools')
  const checkout = join(app, 'local checkout')
  mkdirSync(directory, { recursive: true })
  mkdirSync(home, { recursive: true })
  mkdirSync(join(tools, 'dist'), { recursive: true })
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { stacks: '0.0.1-fixture.1' } }))
  mkdirSync(join(checkout, 'storage/framework/core/buddy'), { recursive: true })
  writeFileSync(join(checkout, 'storage/framework/core/buddy/package.json'), JSON.stringify({ name: '@stacksjs/buddy', version: '0.70.113' }))
  writeFileSync(join(checkout, 'buddy'), 'new buddy')
  writeFileSync(join(app, 'buddy'), 'old buddy')
  writeFileSync(join(home, '.zshrc'), 'plugins=(git)\n')
  writeFileSync(join(tools, 'buddy.plugin.zsh'), 'fixture plugin')
  for (const stage of stages.slice(0, 1))
    writeFileSync(join(directory, `${stage}.ts`), `throw new Error('Old project action must not execute during preview')`)
  for (const stage of stages.slice(1)) {
    const built = await Bun.build({
      entrypoints: [join(sources, `${stage}.ts`)], banner: `console.log('STAGE ${stage}');
${stage === 'shell' ? `
import { appendFileSync as fixtureAppend } from 'node:fs'
const nativeShell = Bun.$
Bun.$ = (strings, ...values) => {
  fixtureAppend(${JSON.stringify(join(app, 'commands'))}, strings.join('?') + '\\n')
  if (strings.join('') === 'echo $HOME') return { text: async () => ${JSON.stringify(home)} }
  return nativeShell(strings, ...values)
}
Bun.$.cwd = (value) => nativeShell.cwd(value)
` : ''}`, target: 'bun', conditions: ['development'], outdir: directory, naming: `${stage}.ts`,
      plugins: [{
        name: 'owned-external-tool-boundaries',
        setup(build) {
          build.onResolve({ filter: /^@stacksjs\/(path|cli|storage|logging)$/ }, (args) => {
            if (args.importer === join(sources, `${stage}.ts`))
              return { path: args.path, namespace: 'fixture-boundary' }
          })
          build.onLoad({ filter: /.*/, namespace: 'fixture-boundary' }, (args) => {
            if (args.path === '@stacksjs/path') {
              return { contents: `
import * as native from 'node:path'
export const path = { ...native,
  homeDir: (value = '') => native.join(${JSON.stringify(home)}, value),
  shellPath: () => ${JSON.stringify(join(tools, 'buddy.plugin.zsh'))},
  buddyPath: (value = '') => native.join(${JSON.stringify(tools)}, value),
}
`, loader: 'ts' }
            }
            if (args.path === '@stacksjs/storage') {
              return { contents: `
import * as native from 'node:fs'
const record = name => native.appendFileSync(${JSON.stringify(join(app, 'file-operations'))}, name + '\\n')
const promises = Object.fromEntries(['mkdir', 'copyFile', 'unlink'].map(name => [name, (...args) => { record(name); return native.promises[name](...args) }]))
export const fs = { promises }
export const storage = { exists: async value => native.existsSync(value) }
export const writeFile = (path, data) => { record('writeFile'); return native.promises.writeFile(path, data) }
`, loader: 'ts' }
            }
            if (args.path === '@stacksjs/logging') {
              return { contents: `export const log = { info: console.log, success: console.log, error: console.error }`, loader: 'ts' }
            }
            return { contents: `
export { parseOptions } from ${JSON.stringify(join(import.meta.dir, '../../cli/src/parse.ts'))}
import { appendFileSync, writeFileSync } from 'node:fs'
export const italic = value => value
export const print = console.log
export async function runCommand(command, options) {
  appendFileSync(${JSON.stringify(join(app, 'commands'))}, command + '\\n')
  if (${options.failCompile ?? false}) return { isErr: true, error: new Error('fixture compile failure') }
  writeFileSync(${JSON.stringify(join(tools, 'dist/stacks'))}, 'fixture executable')
  return { isErr: false }
}
`, loader: 'ts' }
          })
        },
      }],
    })
    expect(built.success, built.logs.join('\n')).toBe(true)
  }
  try {
    const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}` }
    const command = options.direct ? join(directory, `${options.direct}.ts`) : dispatcher
    const stdout = join(app, 'stdout')
    const stderr = join(app, 'stderr')
    const child = Bun.spawn([process.execPath, command, ...args, ...options.direct ? [] : ['--from', checkout]], { cwd: app, env, stdout: Bun.file(stdout), stderr: Bun.file(stderr), timeout: 15_000 })
    const code = await child.exited
    return {
      code, stdout: readFileSync(stdout, 'utf8'), stderr: readFileSync(stderr, 'utf8'),
      operations: existsSync(join(app, 'file-operations')) ? readFileSync(join(app, 'file-operations'), 'utf8') : '',
      commands: existsSync(join(app, 'commands')) ? readFileSync(join(app, 'commands'), 'utf8') : '',
      shell: readFileSync(join(home, '.zshrc'), 'utf8'),
      plugin: existsSync(join(home, '.oh-my-zsh/custom/plugins/buddy/buddy.plugin.zsh')),
      installed: existsSync(join(home, '.stacks/bin/stacks')),
      compiled: existsSync(join(tools, 'dist/stacks')),
    }
  }
  finally { rmSync(app, { recursive: true, force: true }) }
}

for (const stage of ['dependencies', 'bun', 'shell', 'binary'] as const) {
  for (const flag of ['--dry-run', '--dryRun']) {
    test(`the real ${stage} stage honors ${flag} before external commands or writes`, async () => {
      const result = await campaign([flag], { direct: stage })
      expect(result.code, result.stderr).toBe(0)
      expect(result.commands).toBe('')
      expect(result.operations).toBe('')
      expect(result.shell).toBe('plugins=(git)\n')
      expect(result.plugin).toBe(false)
      expect(result.installed).toBe(false)
      expect(result.compiled).toBe(false)
      expect(result.stdout).toContain('DRY RUN')
    })
  }
}

test('the actual --all --dry-run dispatcher previews every stage without executing project action bodies', async () => {
  const result = await campaign(['--all', '--dry-run'])
  expect(result.code, result.stderr).toBe(0)
  expect(result.stdout).not.toContain('STAGE')
  expect(result.stdout).toContain('would update')
  expect(result.stdout).toContain('Dependency upgrades are not implemented')
  expect(result.stdout).toContain('Bun upgrades are not implemented')
  expect(result.stdout).toContain('would update the Oh My Zsh configuration')
  expect(result.stdout).toContain('would compile and install the Stacks binary')
  expect(result.commands).toBe('')
  expect(result.operations).toBe('')
  expect(result.shell).toBe('plugins=(git)\n')
  expect(result.plugin).toBe(false)
  expect(result.installed).toBe(false)
  expect(result.compiled).toBe(false)
})

test('a normal real shell stage updates only the fixture shell and plugin', async () => {
  const result = await campaign([], { direct: 'shell' })
  expect(result.code, result.stderr).toBe(0)
  expect(result.shell).toContain('buddy')
  expect(result.plugin).toBe(true)
  expect(result.operations).toContain('writeFile')
})

test('a normal real binary stage compiles, copies, and unlinks its fixture source', async () => {
  const result = await campaign([], { direct: 'binary' })
  expect(result.code, result.stderr).toBe(0)
  expect(result.commands).toContain('bun compile.ts')
  expect(result.operations.trim().split('\n')).toEqual(['mkdir', 'copyFile', 'unlink'])
  expect(result.installed).toBe(true)
  expect(result.compiled).toBe(false)
})

test('a real binary compile failure remains nonzero without installing', async () => {
  const result = await campaign([], { direct: 'binary', failCompile: true })
  expect(result.code).not.toBe(0)
  expect(result.installed).toBe(false)
  expect(result.stderr).toContain('fixture compile failure')
})

for (const [selector, description] of [
  ['dependencies', 'Dependency upgrades are not implemented'],
  ['bun', 'Bun upgrades are not implemented'],
  ['shell', 'would update the Oh My Zsh configuration'],
  ['binary', 'would compile and install the Stacks binary'],
]) {
  test(`the actual dispatcher previews only ${selector} without executing its project body`, async () => {
    const result = await campaign([`--${selector}`, '--dry-run'])
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).not.toContain('STAGE')
    expect(result.stdout.match(/DRY RUN:/g)).toHaveLength(1)
    expect(result.stdout).toContain(description!)
    expect(result.commands).toBe('')
    expect(result.operations).toBe('')
    expect(result.shell).toBe('plugins=(git)\n')
    expect(result.installed).toBe(false)
  })
}

test('remote framework preview confines template writes to owned temporary staging and removes it after partial download failure', async () => {
  const app = mkdtempSync(join(root, 'remote preview '))
  mkdirSync(join(app, 'storage/framework/core'), { recursive: true })
  writeFileSync(join(app, 'buddy'), 'original buddy')
  const entry = join(app, 'preview-entry.ts')
  const output = join(app, 'preview.js')
  const observations = join(app, 'template-staging.jsonl')
  writeFileSync(entry, `
import { previewFrameworkUpgrade } from ${JSON.stringify(join(sources, 'framework-preview.ts'))}
await previewFrameworkUpgrade(process.cwd(), { version: '0.70.113', force: true, dryRun: true })
`)
  const built = await Bun.build({
    entrypoints: [entry], target: 'bun', conditions: ['development'], outdir: app, naming: 'preview.js',
    plugins: [{
      name: 'owned-template-transport',
      setup(build) {
        build.onResolve({ filter: /^@stacksjs\/gitit$/ }, () => ({ path: 'template-transport', namespace: 'fixture-template' }))
        build.onLoad({ filter: /.*/, namespace: 'fixture-template' }, () => ({
          contents: `
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
export async function downloadTemplate(template, options) {
  appendFileSync(${JSON.stringify(observations)}, JSON.stringify({ template, directory: options.dir }) + '\\n')
  mkdirSync(options.dir, { recursive: true })
  writeFileSync(join(options.dir, 'inspected.txt'), 'owned temporary download')
  if (template.includes('/defaults')) throw new Error('fixture partial template failure')
  writeFileSync(join(options.dir, 'buddy'), 'remote buddy')
}
`, loader: 'ts',
        }))
      },
    }],
  })
  expect(built.success, built.logs.join('\n')).toBe(true)
  try {
    const stdout = join(app, 'stdout')
    const stderr = join(app, 'stderr')
    const child = Bun.spawn([process.execPath, output], { cwd: app, stdout: Bun.file(stdout), stderr: Bun.file(stderr), timeout: 15_000 })
    expect(await child.exited, readFileSync(stderr, 'utf8')).toBe(0)
    expect(readFileSync(stdout, 'utf8')).toContain('fixture partial template failure')
    expect(readFileSync(join(app, 'buddy'), 'utf8')).toBe('original buddy')
    expect(existsSync(join(app, '.stacks-version'))).toBe(false)
    expect(existsSync(join(app, '.stacks-channel'))).toBe(false)
    const downloads = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { directory: string })
    expect(downloads.length).toBeGreaterThan(1)
    for (const download of downloads) {
      expect(download.directory.startsWith(app)).toBe(false)
      expect(download.directory).toContain('stacks-upgrade-dry-run-')
      expect(existsSync(download.directory)).toBe(false)
    }
  }
  finally { rmSync(app, { recursive: true, force: true }) }
})
