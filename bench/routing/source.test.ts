import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSourceState } from './source'

it('records the revision and tracked, staged, or untracked changes in a real repository', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-bench-source-'))
  async function git(...args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', '-C', directory, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { stdout: 'pipe', stderr: 'pipe' })
    const [output, error, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    if (code !== 0) throw new Error(error)
    return output.trim()
  }
  try {
    await git('init')
    expect(await readSourceState(directory)).toEqual({ revision: null, dirty: null })
    writeFileSync(join(directory, '.gitignore'), 'ignored\n')
    writeFileSync(join(directory, 'source.ts'), 'export const value = 1\n')
    await git('add', '.')
    await git('commit', '-m', 'fixture')
    const revision = await git('rev-parse', 'HEAD')
    expect(await readSourceState(directory)).toEqual({ revision, dirty: false })
    writeFileSync(join(directory, 'ignored'), 'local output')
    expect(await readSourceState(directory)).toEqual({ revision, dirty: false })
    writeFileSync(join(directory, 'source.ts'), 'export const value = 2\n')
    expect(await readSourceState(directory)).toEqual({ revision, dirty: true })
    await git('add', 'source.ts')
    expect(await readSourceState(directory)).toEqual({ revision, dirty: true })
    await git('commit', '-m', 'updated fixture')
    const updatedRevision = await git('rev-parse', 'HEAD')
    expect(updatedRevision).not.toBe(revision)
    expect(await readSourceState(directory)).toEqual({ revision: updatedRevision, dirty: false })
    writeFileSync(join(directory, 'untracked.ts'), 'export const extra = 1\n')
    expect(await readSourceState(directory)).toEqual({ revision: updatedRevision, dirty: true })
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('reports unavailable source state outside a repository', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-bench-archive-'))
  try {
    expect(await readSourceState(directory)).toEqual({ revision: null, dirty: null })
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
