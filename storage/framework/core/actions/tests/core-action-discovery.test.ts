import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function invoke(actionFile?: string): Promise<{ exitCode: number, imported: boolean, core: boolean, override: boolean }> {
  const root = mkdtempSync(join(tmpdir(), 'stacks-core-action-discovery-'))
  roots.push(root)
  mkdirSync(join(root, 'app/Actions'), { recursive: true })
  mkdirSync(join(root, 'storage/framework/core/actions/src'), { recursive: true })
  // Importing an unrelated action can start a worker or register message ports.
  // A durable marker detects that side effect without leaving a live worker.
  writeFileSync(join(root, 'app/Actions/Unrelated.ts'), `await Bun.write(${JSON.stringify(join(root, 'imported'))}, 'unrelated')`)
  writeFileSync(join(root, 'storage/framework/core/actions/src/typecheck.ts'), `await Bun.write(${JSON.stringify(join(root, 'core'))}, 'core')`)
  if (actionFile) writeFileSync(join(root, 'app/Actions/typecheck.ts'), actionFile.replace('OVERRIDE_MARKER', JSON.stringify(join(root, 'override'))))
  const source = new URL('../src/helpers/utils.ts', import.meta.url).pathname
  writeFileSync(join(root, 'driver.ts'), `import { runAction } from ${JSON.stringify(source)}; const result = await runAction('typecheck', { cwd: ${JSON.stringify(root)}, verbose: true }); if(result.isErr) throw result.error`)
  const child = Bun.spawn([process.execPath, '--conditions=development', join(root, 'driver.ts')], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text(), new Response(child.stdout).text()])
  if (exitCode !== 0) throw new Error(stderr)
  return { exitCode, imported: existsSync(join(root, 'imported')), core: existsSync(join(root, 'core')), override: existsSync(join(root, 'override')) }
}

describe('built-in action discovery', () => {
  it('runs the core entry without importing unrelated application actions', async () => {
    expect(await invoke()).toEqual({ exitCode: 0, imported: false, core: true, override: false })
  })

  it('preserves an explicit application filename override', async () => {
    expect(await invoke(`export default { async handle() { await Bun.write(OVERRIDE_MARKER, 'override'); return { isOk: true, isErr: false } } }`))
      .toEqual({ exitCode: 0, imported: false, core: false, override: true })
  })
})
