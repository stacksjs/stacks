import { expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// `library` from @stacksjs/config is the framework default until the app's
// config/*.ts files have loaded. `buddy libs:build` waited for them and
// `buddy libs:publish` did not, so an app that built its own package was told
// the framework's sample package matched no files and could never publish.
// Each check runs in its own process, inside a throwaway app, because config
// loading happens once per process from the working directory.
async function inApp(script: string): Promise<string> {
  const app = await mkdtemp(join(tmpdir(), 'stacks-library-config-'))
  try {
    await mkdir(join(app, 'config'), { recursive: true })
    await mkdir(join(app, 'resources/functions'), { recursive: true })
    await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'fixture-app', version: '1.0.0', type: 'module' }))
    await writeFile(join(app, 'config/app.ts'), 'export default { name: \'Fixture\' }\n')
    await writeFile(join(app, 'config/library.ts'), 'export default { packages: [{ name: \'fixture-fx\', kind: \'functions\', files: [\'greet\'] }] }\n')
    await writeFile(join(app, 'resources/functions/greet.ts'), 'export const greet = (name: string): string => `hi ${name}`\n')
    const child = Bun.spawn([process.execPath, '-e', script], { cwd: app, stdout: 'pipe', stderr: 'pipe' })
    const [out] = await Promise.all([new Response(child.stdout).text(), child.exited])
    return out.trim()
  }
  finally {
    await rm(app, { recursive: true, force: true })
  }
}

const src = resolve(import.meta.dir, '../src/library')

it('plans a publish from the app\'s own library config', async () => {
  const out = await inApp(`
    const { planLibraryPublish } = await import(${JSON.stringify(join(src, 'publish.ts'))})
    try { await planLibraryPublish() } catch (error) { console.log(error.message) }
  `)
  // Nothing is built in the fixture, so planning stops at the build check, naming the app's package.
  expect(out).toContain('fixture-fx')
  expect(out).not.toContain('hello-world')
}, 30_000)

it('lists the app\'s own library packages', async () => {
  const out = await inApp(`
    const { configuredLibrary, resolveLibraryPackages } = await import(${JSON.stringify(join(src, 'packages.ts'))})
    console.log((await resolveLibraryPackages(await configuredLibrary())).map(pkg => pkg.name).join())
  `)
  expect(out).toBe('fixture-fx')
}, 30_000)
