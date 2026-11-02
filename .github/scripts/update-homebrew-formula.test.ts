import { afterEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { updateHomebrewFormula } from './update-homebrew-formula'

const roots: string[] = []
const source = join(import.meta.dir, '../homebrew/stacks.rb')
const platforms = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-homebrew-'))
  roots.push(root)
  mkdirSync(join(root, '.github/homebrew'), { recursive: true })
  mkdirSync(join(root, '.github/temp'), { recursive: true })
  const formula = join(root, '.github/homebrew/stacks.rb')
  writeFileSync(formula, readFileSync(source))
  return { root, formula }
}
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))

test('the public shell entrypoint hashes all four real files without executing platform binaries', async () => {
  const f = fixture()
  const checksums = platforms.map((platform) => {
    const bytes = Buffer.from(`archive bytes for ${platform}\n`)
    writeFileSync(join(f.root, `.github/temp/buddy-${platform}.zip`), bytes)
    return createHash('sha256').update(bytes).digest('hex')
  })
  const child = Bun.spawn(['bash', join(import.meta.dir, 'update-homebrew-formula.sh'), 'v0.75.999'], {
    cwd: f.root, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` }, stdout: 'pipe', stderr: 'pipe',
  })
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(code, out + error).toBe(0)
  const formula = readFileSync(f.formula, 'utf8')
  expect(formula).toContain('version "0.75.999"')
  expect([...formula.matchAll(/sha256 "([a-f0-9]{64})"/g)].map(match => match[1])).toEqual(checksums)
  expect(formula).not.toContain('PLACEHOLDER_')
  expect(formula).toContain('on_macos do')
  expect(formula).toContain('on_linux do')
})

test('missing archives use real HTTP bytes and an unsuccessful response preserves the template', async () => {
  const f = fixture()
  const original = readFileSync(f.formula, 'utf8')
  let missing = true
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
    const path = new URL(request.url).pathname
    if (missing && path.endsWith('buddy-linux-x64.zip')) return new Response('not found', { status: 404 })
    return new Response(`actual HTTP bytes at ${path}`)
  } })
  try {
    const options = { root: f.root, releaseOrigin: server.url.origin }
    await expect(updateHomebrewFormula('0.75.999', options)).rejects.toThrow('HTTP 404')
    expect(readFileSync(f.formula, 'utf8')).toBe(original)
    missing = false
    await updateHomebrewFormula('0.75.999', options)
    const checksums = platforms.map(platform => createHash('sha256').update(`actual HTTP bytes at /stacksjs/stacks/releases/download/v0.75.999/buddy-${platform}.zip`).digest('hex'))
    expect([...readFileSync(f.formula, 'utf8').matchAll(/sha256 "([a-f0-9]{64})"/g)].map(match => match[1])).toEqual(checksums)
  }
  finally { server.stop(true) }
})

test('invalid versions, empty cached archives and malformed templates cannot update a formula', async () => {
  const f = fixture()
  const original = readFileSync(f.formula, 'utf8')
  await expect(updateHomebrewFormula('../latest', { root: f.root })).rejects.toThrow('semantic release version')
  writeFileSync(join(f.root, '.github/temp/buddy-darwin-arm64.zip'), '')
  await expect(updateHomebrewFormula('v0.75.999', { root: f.root })).rejects.toThrow('Empty release archive')
  expect(readFileSync(f.formula, 'utf8')).toBe(original)
  writeFileSync(f.formula, original.replace('PLACEHOLDER_SHA_ARM64', 'already-replaced'))
  await expect(updateHomebrewFormula('v0.75.999', { root: f.root })).rejects.toThrow('Expected one PLACEHOLDER_SHA_ARM64')
  expect(readFileSync(f.formula, 'utf8')).toBe(original.replace('PLACEHOLDER_SHA_ARM64', 'already-replaced'))
})
