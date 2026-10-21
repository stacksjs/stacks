import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBeforeDeployHook } from '../src/deploy/hooks'
import { assertPublicationAllowed } from '../src/publication-preflight'
import { runProjectScripts } from '../src/project-scripts'

const roots: string[] = []
function fixture(scripts: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-publication-policy-'))
  roots.push(root)
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts }))
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('a declared failing application policy blocks publication', async () => {
  const root = fixture({ 'publication:check': 'bun -e "process.exit(9)"' })
  await expect(assertPublicationAllowed({ cwd: root, channel: 'web' })).rejects.toThrow('publication:check failed with exit code 9')
})

test('publication delivers the actual channel to the application policy', async () => {
  const root = fixture({ 'publication:check': 'bun policy.ts' })
  writeFileSync(join(root, 'policy.ts'), 'await Bun.write("channel.txt", process.env.STACKS_PUBLICATION_CHANNEL!); if (process.env.STACKS_PUBLICATION_CHANNEL !== "ios") process.exit(1)')
  const result = await assertPublicationAllowed({ cwd: root, channel: 'ios' })
  expect(result.status).toBe('passed')
  expect(readFileSync(join(root, 'channel.txt'), 'utf8')).toBe('ios')
})

test('an absent policy is optional but an invalid declared policy cannot be ignored', async () => {
  expect((await assertPublicationAllowed({ cwd: fixture(), channel: 'github-release' })).status).toBe('not-configured')
  for (const value of [null, '', '  ', false])
    await expect(assertPublicationAllowed({ cwd: fixture({ 'publication:check': value }), channel: 'desktop' })).rejects.toThrow('nonempty application policy')
})

test('a present beforeDeploy hook must succeed for named and default exports', async () => {
  for (const source of ['export function beforeDeploy() { throw new Error("policy refused") }', 'export default { beforeDeploy() { throw new Error("policy refused") } }']) {
    const root = fixture()
    mkdirSync(join(root, 'cloud'))
    writeFileSync(join(root, 'cloud/deploy-script.ts'), source)
    await expect(runBeforeDeployHook(root, { environment: 'production', region: 'us-east-1' })).rejects.toThrow('policy refused')
  }
})

test('every explicitly declared non-function hook fails, including a named null before a valid default', async () => {
  for (const source of ['export const beforeDeploy = null; export default { beforeDeploy() {} }', 'export const beforeDeploy = undefined', 'export default { beforeDeploy: null }']) {
    const root = fixture()
    mkdirSync(join(root, 'cloud'))
    writeFileSync(join(root, 'cloud/deploy-script.ts'), source)
    await expect(runBeforeDeployHook(root, { environment: 'production', region: 'us-east-1' })).rejects.toThrow('must be a function')
  }
})

test('a project check cannot replace subsequent checks by changing the manifest', async () => {
  const root = fixture({ first: 'bun mutate.ts', second: 'bun -e "process.exit(9)"' })
  writeFileSync(join(root, 'mutate.ts'), 'const pkg = await Bun.file("package.json").json(); pkg.scripts.second = "true"; await Bun.write("package.json", JSON.stringify(pkg))')
  await expect(runProjectScripts({ cwd: root, scripts: ['first', 'second'] })).rejects.toThrow('changed the project manifest')
})

test('only an absent hook module is optional, a broken dependency blocks deployment', async () => {
  const root = fixture()
  expect(await runBeforeDeployHook(root, { environment: 'production', region: 'us-east-1' })).toBe(false)
  mkdirSync(join(root, 'cloud'))
  writeFileSync(join(root, 'cloud/deploy-script.ts'), 'import "./missing-required-policy.ts"; export function beforeDeploy() {}')
  await expect(runBeforeDeployHook(root, { environment: 'production', region: 'us-east-1' })).rejects.toThrow()
})
