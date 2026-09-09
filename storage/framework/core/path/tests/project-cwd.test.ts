import { expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

it('resolves live working directories and suffixes through both path entrypoints', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-project-cwd-'))
  const first = join(fixture, 'first')
  const second = join(fixture, 'second')
  const nested = join(first, 'storage/framework/core/path')
  const substring = join(first, 'storage-copy/nested')
  for (const dir of [first, second, nested, substring])
    mkdirSync(dir, { recursive: true })

  try {
    // Directory changes run in a child so other tests keep their own cwd.
    const result = Bun.spawnSync([process.execPath, '-e', `
      import assert from 'node:assert/strict'
      import { realpathSync } from 'node:fs'
      const [first, second, nested, substring] = process.argv.slice(1).map(realpathSync)
      for (const source of ${JSON.stringify([new URL('../src/index.ts', import.meta.url).href, new URL('../src/project.ts', import.meta.url).href])}) {
        const { projectPath, appPath, storagePath, frameworkPath } = await import(source)
        for (const [cwd, root] of [[first, first], [nested, first], [second, second], [substring, first], [nested, first], [first, first]]) {
          process.chdir(cwd)
          assert.equal(projectPath(), root)
          assert.equal(projectPath('config/app.ts'), root + '/config/app.ts')
          assert.equal(projectPath('app/../routes/web.ts'), root + '/routes/web.ts')
          assert.equal(projectPath(second + '/absolute.ts'), second + '/absolute.ts')
          assert.equal(appPath('Models/User.ts'), root + '/app/Models/User.ts')
          assert.equal(storagePath('logs'), root + '/storage/logs')
          assert.equal(frameworkPath('core/path'), root + '/storage/framework/core/path')
          assert.equal(appPath('Jobs', { relative: true, cwd: root }), 'app/Jobs')
          assert.equal(frameworkPath('core', { relative: true, cwd: root }), 'storage/framework/core')
        }
        process.chdir(nested)
        assert.equal(projectPath('config/app.ts', { relative: true }), '../../../../config/app.ts')
        process.chdir(second)
        assert.equal(projectPath('config/app.ts', { relative: true }), 'config/app.ts')
      }
      console.log('live working directories passed')
    `, first, second, nested, substring], { stdout: 'pipe', stderr: 'pipe' })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString()).toContain('live working directories passed')
  }
  finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
