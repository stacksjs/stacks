import { afterAll, beforeAll, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'

// Real compiled CLI and dispatcher, with task-owned action overrides at the
// external upgrade boundary. No installed packages, shell or tools are changed.
const root = mkdtempSync(join(tmpdir(), 'buddy-upgrade-stages-'))
const binary = join(root, 'buddy')
const dispatcher = join(root, 'dispatch')
const stages = ['framework', 'dependencies', 'bun', 'shell', 'binary']

async function run(cmd: string[], cwd: string, env = process.env) {
  const child = Bun.spawn(cmd, { cwd, env, stdout: 'pipe', stderr: 'pipe', timeout: 15_000 })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

beforeAll(async () => {
  const entry = join(root, 'entry.ts')
  writeFileSync(entry, `
const { cli } = await import(${JSON.stringify(join(import.meta.dir, '../../cli/src/index.ts'))})
const { upgrade } = await import(${JSON.stringify(join(import.meta.dir, '../src/commands/upgrade.ts'))})
const buddy = cli('buddy')
upgrade(buddy)
buddy.parse()
`)
  for (const [source, output] of [[entry, binary], [join(import.meta.dir, '../../actions/src/upgrade/index.ts'), dispatcher]]) {
    const built = await run([process.execPath, 'build', source!, '--compile', '--conditions=development', '--outfile', output!], root)
    expect(built.code, built.stderr).toBe(0)
  }
}, 35_000)

afterAll(() => rmSync(root, { recursive: true, force: true }))

async function campaign(args: string[], options: { direct?: boolean, fail?: string, repeat?: boolean, separateCwd?: boolean } = {}) {
  const app = mkdtempSync(join(root, 'older project '))
  const directory = join(app, 'storage/framework/core/actions/src/upgrade')
  const checkout = join(app, 'preview source')
  mkdirSync(join(checkout, 'storage/framework/core/buddy'), { recursive: true })
  writeFileSync(join(checkout, 'storage/framework/core/buddy/package.json'), JSON.stringify({ name: '@stacksjs/buddy', version: '0.70.113' }))
  writeFileSync(join(checkout, 'buddy'), 'preview buddy')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'older-project', dependencies: { stacks: '0.0.1-fixture.1' } }))
  // An old project dispatcher must not decide what a newer CLI means by all.
  writeFileSync(join(directory, 'index.ts'), `await Bun.write('old-dispatcher-ran', 'old'); process.exit(74)`)
  for (const stage of stages) {
    writeFileSync(join(directory, `${stage}.ts`), `
import { appendFileSync } from 'node:fs'
appendFileSync('observations.jsonl', JSON.stringify({ stage: ${JSON.stringify(stage)}, cwd: process.cwd(), argv: process.argv.slice(2) }) + '\\n')
process.exit(${stage === options.fail ? 17 : 0})
`)
  }
  const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}` }
  try {
    const cmd = [options.direct ? dispatcher : binary, ...args, ...args.includes('--dry-run') && args[0] === 'upgrade:all' ? ['--from', checkout] : [], ...options.separateCwd ? ['--cwd', app] : []]
    const result = await run(cmd, options.separateCwd ? root : app, env)
    const repeated = options.repeat ? await run(cmd, app, env) : undefined
    const observations = existsSync(join(app, 'observations.jsonl')) ? readFileSync(join(app, 'observations.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as { stage: string, cwd: string, argv: string[] }) : []
    return { ...result, repeated, app: realpathSync(app), observations, oldRan: existsSync(join(app, 'old-dispatcher-ran')) }
  }
  finally { rmSync(app, { recursive: true, force: true }) }
}

test('the actual dispatcher runs --all in documented order with intact option tokens', async () => {
  const result = await campaign(['--all', '--from', 'source with spaces', '--project', 'project with spaces', '--verbose'], { direct: true })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.observations.map(value => value.stage)).toEqual(stages)
  for (const observation of result.observations) {
    expect(observation.cwd).toBe(result.app)
    expect(observation.argv).toEqual(expect.arrayContaining(['--from', 'source with spaces', '--project', 'project with spaces']))
  }
})

test('the compiled upgrade:all owns stage dispatch in an older project and repeats every stage', async () => {
  const result = await campaign(['upgrade:all'], { repeat: true })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.repeated!.code).toBe(0)
  expect(result.oldRan).toBe(false)
  expect(result.observations.map(value => value.stage)).toEqual([...stages, ...stages])
})

for (const stage of stages) {
  test(`the actual dispatcher selects only ${stage}`, async () => {
    const result = await campaign([`--${stage}`], { direct: true })
    expect(result.code, result.stdout + result.stderr).toBe(0)
    expect(result.observations.map(value => value.stage)).toEqual([stage])
  })

  test(`a real ${stage} child failure stops all later dispatcher stages`, async () => {
    const result = await campaign(['--all'], { direct: true, fail: stage })
    expect(result.code, result.stdout + result.stderr).not.toBe(0)
    expect(result.observations.map(value => value.stage)).toEqual(stages.slice(0, stages.indexOf(stage) + 1))
    expect(result.stdout).not.toContain('All upgrades complete.')
  })
}

test('a dispatcher without a selection performs no upgrades', async () => {
  const result = await campaign([], { direct: true })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.observations).toEqual([])
})

test('the actual dispatcher honors an explicit cwd without splitting its path', async () => {
  const result = await campaign(['--all'], { direct: true, separateCwd: true })
  expect(result.code, result.stdout + result.stderr).toBe(0)
  expect(result.observations.map(value => value.stage)).toEqual(stages)
  expect(result.observations.map(value => value.cwd)).toEqual(stages.map(() => result.app))
})

test('a compiled upgrade:all reports a real stage failure without claiming completion', async () => {
  const result = await campaign(['upgrade:all'], { fail: 'dependencies' })
  expect(result.code, result.stdout + result.stderr).not.toBe(0)
  expect(result.oldRan).toBe(false)
  expect(result.observations.map(value => value.stage)).toEqual(['framework', 'dependencies'])
  expect(result.stdout).not.toContain('All upgrades complete.')
})

for (const [command, stage] of [['upgrade', 'framework'], ['upgrade:dependencies', 'dependencies'], ['upgrade:deps', 'dependencies'], ['upgrade:bun', 'bun'], ['upgrade:shell', 'shell']]) {
  test(`the compiled ${command} selects its own stage`, async () => {
    const result = await campaign([command!])
    expect(result.code, result.stdout + result.stderr).toBe(0)
    expect(result.oldRan).toBe(false)
    expect(result.observations.map(value => value.stage)).toEqual([stage])
  })
}

test('upgrade:binary retains its existing root authorization before invoking tools', async () => {
  const result = await campaign(['upgrade:binary'])
  if (process.getuid && process.getuid() !== 0) {
    expect(result.code).not.toBe(0)
    expect(result.observations).toEqual([])
    expect(result.stdout + result.stderr).toContain('sudo, or as root')
  }
  else {
    expect(result.code, result.stdout + result.stderr).toBe(0)
    expect(result.observations.map(value => value.stage)).toEqual(['binary'])
  }
})

for (const [command, selected] of [['upgrade:all', stages], ['upgrade:dependencies', ['dependencies']], ['upgrade:bun', ['bun']], ['upgrade:shell', ['shell']]] as const) {
  test(`the compiled ${command} previews --dry-run without executing older project stages`, async () => {
    const result = await campaign([command, '--dry-run'])
    expect(result.code, result.stdout + result.stderr).toBe(0)
    expect(result.observations).toEqual([])
    expect(result.oldRan).toBe(false)
    expect(result.stdout.match(/DRY RUN:/g)).toHaveLength(selected.filter(stage => stage !== 'framework').length)
    expect(result.stdout).not.toContain('All upgrades complete.')
  })
}

test('upgrade:binary --dry-run preserves its existing authorization boundary', async () => {
  const result = await campaign(['upgrade:binary', '--dry-run'])
  if (process.getuid && process.getuid() !== 0) {
    expect(result.code).not.toBe(0)
    expect(result.observations).toEqual([])
    expect(result.stdout + result.stderr).toContain('sudo, or as root')
  }
  else {
    expect(result.code, result.stdout + result.stderr).toBe(0)
    expect(result.observations).toEqual([])
    expect(result.stdout).toContain('would compile and install the Stacks binary')
  }
})
