import { expect, it } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const root = join(import.meta.dir, '..')
const configs = [
  'storage/framework/tsconfig.base.json',
  'storage/framework/tsconfig.framework.json',
  'storage/framework/core/tsconfig.json',
  'storage/framework/core/tsconfig.build.json',
]

it.each([
  '../tsconfig.build.json',
  '../tsconfig.json',
  '../../tsconfig.framework.json',
])('prefers installed dependencies with %s and retains the Pantry fallback', async (extendsPath) => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-dependency-resolution-'))
  const entry = join(directory, 'storage/framework/core/example/src/index.ts')
  function write(path: string, contents: string): void {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, contents)
  }
  async function run(...args: string[]): Promise<string> {
    const proc = Bun.spawn([process.execPath, `--config=${join(directory, 'bunfig.toml')}`, ...args], {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [output, errors, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    if (code !== 0) throw new Error(errors)
    return output.trim()
  }
  try {
    for (const config of configs) {
      const destination = join(directory, config)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(join(root, config), destination)
    }
    write(join(directory, 'bunfig.toml'), '# Isolated dependency-resolution fixture\n')
    write(join(directory, 'storage/framework/core/example/tsconfig.json'), JSON.stringify({ extends: extendsPath }))
    write(entry, "import version from 'fixture-dependency'\nconsole.log(version)\n")
    for (const [tree, version] of [['node_modules', 'installed'], ['pantry', 'pantry']] as const) {
      const dependency = join(directory, tree, 'fixture-dependency')
      write(join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-dependency', type: 'module', exports: './index.ts' }))
      write(join(dependency, 'index.ts'), `export default '${version}'\n`)
    }

    for (const expected of ['installed', 'pantry']) {
      expect(await run(entry)).toBe(expected)
      const bundle = join(directory, 'bundle.js')
      await run('build', entry, '--target=bun', '--outfile', bundle)
      expect(await run(bundle)).toBe(expected)
      rmSync(join(directory, 'node_modules'), { recursive: true, force: true })
    }
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
