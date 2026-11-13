import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'

// #3288: SDK candidates must retain the canonical publisher's inherited docs
// and nested template files, without changing the owner's source package.
test('the installed publication packer retains inherited docs and hidden template files', async () => {
  const base = resolve(process.env.STACKS_PACK_EVIDENCE ?? tmpdir())
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'stacks canonical pack '))
  const owner = join(root, 'packages/library')
  const archive = join(root, 'candidate.tgz')
  const commands: Array<Record<string, unknown>> = []
  let completed = false
  const packer = Bun.which('pantry')
  try {
    expect(packer).not.toBeNull()
    await mkdir(join(owner, 'dist'), { recursive: true })
    await mkdir(join(owner, 'templates'))
    await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, workspaces: ['packages/*'] }))
    await writeFile(join(root, 'LICENSE.md'), 'inherited license bytes\n')
    await writeFile(join(root, 'README.md'), 'inherited readme bytes\n')
    const manifest = JSON.stringify({ name: '@fixture/canonical-stacks-package', version: '1.0.0', files: ['dist', 'templates'], scripts: { prepack: 'exit 47' } })
    await writeFile(join(owner, 'package.json'), manifest)
    await writeFile(join(owner, 'dist/index.js'), 'export const value = 7\n')
    await writeFile(join(owner, 'dist/index.d.ts'), 'export declare const value: 7\n')
    await writeFile(join(owner, 'templates/.gitignore'), 'template-cache\n')
    await writeFile(join(owner, 'excluded.txt'), 'not published\n')
    const args = [packer!, 'pack', owner, '--ignore-scripts', '--filename', archive]
    const child = Bun.spawn(args, { cwd: root, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    commands.push({ args, cwd: root, code, signal: child.signalCode, stdout, stderr })
    expect(code, stdout + stderr).toBe(0)
    expect(child.signalCode).toBeNull()
    const bytes = await readFile(archive)
    const files = await new Bun.Archive(bytes).files()
    expect(await files.get('package/LICENSE.md')?.text()).toBe('inherited license bytes\n')
    expect(await files.get('package/README.md')?.text()).toBe('inherited readme bytes\n')
    expect(await files.get('package/templates/.gitignore')?.text()).toBe('template-cache\n')
    expect(await files.get('package/dist/index.d.ts')?.text()).toBe('export declare const value: 7\n')
    expect(files.has('package/excluded.txt')).toBe(false)
    expect(await Bun.file(join(owner, 'LICENSE.md')).exists()).toBe(false)
    expect(await Bun.file(join(owner, 'README.md')).exists()).toBe(false)
    expect(await readFile(join(owner, 'package.json'), 'utf8')).toBe(manifest)
    completed = true
  }
  finally {
    const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
    await writeFile(join(root, 'receipt.json'), JSON.stringify({ completed, commands, packer: packer ? { executable: await realpath(packer), sha256: sha256(await readFile(packer)) } : null, archive: await Bun.file(archive).exists() ? { path: archive, sha256: sha256(await readFile(archive)) } : null }, null, 2))
    if (completed && !process.env.STACKS_PACK_EVIDENCE) await rm(root, { recursive: true, force: true })
    else console.error(`Canonical package evidence: ${root}`)
  }
})
