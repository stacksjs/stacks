import { expect, test } from 'bun:test'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildWorkspacePackages } from '../src/workspace'

test.each(['missing', 'stale'])('a consumer builds once after its provider with %s output, regardless of directory order', async (output) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-workspace-build-'))
  try {
    const provider = join(root, 'z-provider'), consumer = join(root, 'a-consumer'), ledger = join(root, 'executions.txt')
    for (const dir of [provider, consumer]) await mkdir(join(dir, 'dist'), { recursive: true })
    await writeFile(join(provider, 'package.json'), JSON.stringify({ name: 'provider', type: 'module', scripts: { build: 'bun build.ts' } }))
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', dependencies: { provider: '1.2.3' }, scripts: { build: 'bun build.ts' } }))
    if (output === 'stale') await writeFile(join(provider, 'dist/index.js'), 'export const obsolete = true')
    await writeFile(join(provider, 'build.ts'), `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(ledger)}, 'provider\\n'); await Bun.write('./dist/index.js', 'export const current = 42')`)
    await writeFile(join(consumer, 'build.ts'), `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(ledger)}, 'consumer\\n'); await Bun.write('./dist/index.js', 'import {current} from "../../z-provider/dist/index.js"; if(current !== 42) throw new Error("wrong provider"); export {current}'); await import('./dist/index.js')`)
    const results = await buildWorkspacePackages([consumer, provider])
    expect(results.map(result => result.exitCode)).toEqual([0, 0])
    expect(await readFile(ledger, 'utf8')).toBe('provider\nconsumer\n')
    expect((await import(join(consumer, 'dist/index.js'))).current).toBe(42)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('failed dependencies block their consumers while independent link failures are retained', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-workspace-failures-'))
  try {
    const packages = [
      { name: 'provider', dependencies: {}, code: 'throw new Error("provider compile failed")' },
      { name: 'consumer', dependencies: { provider: '*' }, code: 'throw new Error("blocked consumer must not run")' },
      { name: 'transitive', dependencies: { consumer: '*' }, code: 'throw new Error("blocked transitive consumer must not run")' },
      { name: 'independent', dependencies: { external: '*' }, code: 'await Bun.write("dist.js", "export {missing}"); await import("./dist.js")' },
    ]
    for (const pkg of packages) {
      const dir = join(root, pkg.name)
      await mkdir(dir)
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: pkg.name, type: 'module', dependencies: pkg.dependencies, scripts: { build: 'bun build.ts' } }))
      await writeFile(join(dir, 'build.ts'), `await Bun.write('executed', 'yes'); ${pkg.code}`)
    }
    const results = await buildWorkspacePackages(packages.map(pkg => join(root, pkg.name)))
    expect(results.filter(result => result.exitCode !== null).map(result => [result.name, result.exitCode])).toEqual([['independent', 1], ['provider', 1]])
    expect(results.filter(result => result.exitCode === null).map(result => [result.name, result.blockedBy])).toEqual([['consumer', ['provider']], ['transitive', ['consumer']]])
    for (const name of ['consumer', 'transitive']) expect(await Bun.file(join(root, name, 'executed')).exists()).toBe(false)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test.each(['cycle', 'duplicate'])('invalid %s graph is rejected before any package runs', async (kind) => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-workspace-graph-'))
  try {
    for (const name of ['a', 'b']) {
      const dir = join(root, name)
      await mkdir(dir)
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: kind === 'duplicate' ? 'a' : name, dependencies: { [name === 'a' ? 'b' : 'a']: '*' }, scripts: { build: 'bun build.ts' } }))
      await writeFile(join(dir, 'build.ts'), 'await Bun.write("executed", "yes")')
    }
    await expect(buildWorkspacePackages(['a', 'b'].map(name => join(root, name)))).rejects.toThrow(kind === 'duplicate' ? 'duplicate package name: a' : 'dependency cycle: a -> b -> a')
    for (const name of ['a', 'b']) await expect(access(join(root, name, 'executed'))).rejects.toThrow()
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
