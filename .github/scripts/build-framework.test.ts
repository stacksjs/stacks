import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildFramework, frameworkBuildTargets } from './build-framework'

test('release builds include the umbrella and every buildable public package without app feature gates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-release-build-'))
  try {
    const core = join(root, 'storage/framework/core')
    for (const [directory, manifest] of [
      ['', { name: 'stacks', scripts: { build: 'bun build.ts' } }],
      ['cms', { name: '@stacksjs/cms', scripts: { build: 'bun build.ts' } }],
      ['private', { private: true, scripts: { build: 'bun build.ts' } }],
      ['without-build', { name: 'no-build' }],
    ] as const) {
      const dir = join(core, directory)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify(manifest))
    }
    await mkdir(join(core, 'without-manifest'))
    expect((await frameworkBuildTargets(root)).sort()).toEqual([core, join(core, 'cms')].sort())
    const workflow = await readFile(new URL('../workflows/release.yml', import.meta.url), 'utf8')
    expect(workflow).toContain('run: bun .github/scripts/build-framework.ts')
    expect(workflow).toContain('- name: Verify built dist')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('the release entrypoint executes an umbrella and its children once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-release-once-'))
  try {
    const core = join(root, 'storage/framework/core'), child = join(core, 'child'), ledger = join(root, 'executions.txt')
    await mkdir(child, { recursive: true })
    for (const [dir, name] of [[core, 'umbrella'], [child, 'child']] as const)
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name, scripts: { build: 'bun build.ts' } }))
    const helper = new URL('../../storage/framework/core/build/src/workspace.ts', import.meta.url).pathname
    await writeFile(join(core, 'build.ts'), `import {appendFileSync} from 'node:fs'; import {buildWorkspacePackages,workspaceBuildTargets} from ${JSON.stringify(helper)}; const results=await buildWorkspacePackages(workspaceBuildTargets(import.meta.dir).filter(dir=>dir!==import.meta.dir)); if(results.some(result=>result.exitCode!==0)) throw new Error('child failed'); appendFileSync(${JSON.stringify(ledger)}, 'umbrella\\n')`)
    await writeFile(join(child, 'build.ts'), `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(ledger)}, 'child\\n')`)
    expect((await buildFramework(root)).map(result => result.exitCode)).toEqual([0])
    expect(await readFile(ledger, 'utf8')).toBe('child\numbrella\n')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
