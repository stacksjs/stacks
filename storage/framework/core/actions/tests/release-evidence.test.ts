import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { verifyReleaseEvidence } from '../src/release-evidence'

// Public release verification catches false adoption receipts. It does not
// establish platform fidelity or verify a registry's signing authority.
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const commit = '1234567890abcdef1234567890abcdef12345678'
const packageEntries = {
  'package/package.json': JSON.stringify({ name: '@example/runtime', version: '1.2.3', main: 'index.js' }),
  'package/index.js': 'export default "installed runtime"',
}
const bytes = await new Bun.Archive(packageEntries, { compress: 'gzip' }).bytes()
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const plan = {
  schemaVersion: 1 as const,
  sources: [{
    repository: 'example/runtime', commit, tag: 'v1.2.3',
    gates: [{ runId: 123, workflow: '.github/workflows/release.yml', requiredJobs: ['publish'] }],
    packages: [{ name: '@example/runtime', version: '1.2.3', integrity }],
  }],
  checks: ['check'],
}

function consumer(): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-release-evidence-'))
  roots.push(root)
  mkdirSync(join(root, 'node_modules/@example/runtime'), { recursive: true })
  for (const [path, contents] of Object.entries(packageEntries))
    writeFileSync(join(root, 'node_modules/@example/runtime', path.slice('package/'.length)), contents)
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun -e "process.exit(0)"' } }))
  writeFileSync(join(root, 'bun.lock'), JSON.stringify({ packages: { '@example/runtime': ['@example/runtime@1.2.3', '', {}, integrity] } }))
  return root
}

function publishedSource(change?: (url: string) => Response | undefined): (url: string) => Promise<Response> {
  return async (url) => {
    const changed = change?.(url)
    if (changed) return changed
    if (url.endsWith('/git/ref/tags/v1.2.3')) return Response.json({ object: { type: 'commit', sha: commit } })
    if (url.includes('/contents/package.json')) return Response.json({ content: Buffer.from(JSON.stringify({ scripts: { 'release:patch': 'existing-release patch' } })).toString('base64'), encoding: 'base64' })
    if (url.includes('/jobs?')) return Response.json({ jobs: [{ name: 'publish', status: 'completed', conclusion: 'success' }] })
    if (url.includes('/actions/runs/')) return Response.json({ id: 123, status: 'completed', conclusion: 'success', head_sha: commit, path: '.github/workflows/release.yml', repository: { full_name: 'example/runtime' } })
    if (url.endsWith('.tgz')) return new Response(bytes)
    return Response.json({ name: '@example/runtime', version: '1.2.3', dist: { integrity, tarball: 'https://registry.npmjs.org/@example/runtime/-/runtime-1.2.3.tgz' } })
  }
}

describe('source release and consumer evidence', () => {
  test('rejects a failed exact-source release gate before checking adoption', async () => {
    const requests: string[] = []
    await expect(verifyReleaseEvidence(plan, {
      cwd: consumer(),
      fetch: async (url) => {
        requests.push(url)
        if (url.endsWith('/git/ref/tags/v1.2.3')) return Response.json({ object: { type: 'commit', sha: commit } })
        if (url.includes('/contents/package.json')) return Response.json({ content: Buffer.from(JSON.stringify({ scripts: { 'release:patch': 'existing-release patch' } })).toString('base64'), encoding: 'base64' })
        return Response.json({ id: 123, status: 'completed', conclusion: 'failure', head_sha: commit, path: '.github/workflows/release.yml', repository: { full_name: 'example/runtime' } })
      },
    })).rejects.toThrow('Release gate 123 is not successful')
    expect(requests.every(url => url.startsWith('https://api.github.com/'))).toBe(true)
  })

  test('retains exact source, published bytes, installed lock and executed consumer evidence', async () => {
    const root = consumer()
    writeFileSync(join(root, 'check.ts'), 'import runtime from "@example/runtime"; if (runtime !== "installed runtime") process.exit(1)')
    writeFileSync(join(root, 'node_modules/@example/runtime/index.js'), 'export default "installed runtime"')
    writeFileSync(join(root, 'node_modules/@example/runtime/package.json'), JSON.stringify({ name: '@example/runtime', version: '1.2.3', main: 'index.js' }))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
    const receipt = await verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })
    expect(receipt.sources[0]?.commit).toBe(commit)
    expect(receipt.sources[0]?.releaseCommand).toBe('bun run release:patch')
    expect(receipt.sources[0]?.packages[0]).toEqual({ ...plan.sources[0]!.packages[0], tarball: 'https://registry.npmjs.org/@example/runtime/-/runtime-1.2.3.tgz', bytes: bytes.length, filesSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(receipt.consumer.sha256).toBe(createHash('sha256').update(readFileSync(join(root, 'bun.lock'))).digest('hex'))
    expect(receipt.consumer.checks).toEqual([{ script: 'check', exitCode: 0, outputSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }])
  })

  test('rejects a successful workflow for another source commit and a skipped required job', async () => {
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(url => url.includes('/actions/runs/')
      ? Response.json({ id: 123, status: 'completed', conclusion: 'success', head_sha: '0'.repeat(40), path: '.github/workflows/release.yml', repository: { full_name: 'example/runtime' } })
      : undefined) })).rejects.toThrow('does not verify the exact source')
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(url => url.includes('/jobs?')
      ? Response.json({ jobs: [{ name: 'publish', status: 'completed', conclusion: 'skipped' }] })
      : undefined) })).rejects.toThrow('Required release job publish did not pass exactly once')
  })

  test('rejects an absent package and substituted archive bytes', async () => {
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(url => url.startsWith('https://registry.npmjs.org/')
      ? new Response('', { status: 404 }) : undefined) })).rejects.toThrow('HTTP 404')
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(url => url.endsWith('.tgz')
      ? new Response('substituted archive') : undefined) })).rejects.toThrow('archive bytes failed SHA-512')
  })

  test('rejects installed and locked versions that differ from the tested release', async () => {
    const root = consumer()
    writeFileSync(join(root, 'node_modules/@example/runtime/package.json'), JSON.stringify({ name: '@example/runtime', version: '1.2.4' }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('does not match tested version')
    writeFileSync(join(root, 'bun.lock'), JSON.stringify({ packages: { '@example/runtime': ['@example/runtime@1.2.4', '', {}, integrity] } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('Consumer lock does not contain')
  })

  test('rejects a failing consumer check and lock mutation by an otherwise successful check', async () => {
    const root = consumer()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun -e "process.exit(7)"' } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('Consumer script check failed with exit code 7')
    writeFileSync(join(root, 'check.ts'), 'await Bun.write("bun.lock", (await Bun.file("bun.lock").text()) + "\\n")')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('changed the verified lockfile')
  })

  test('bounds archive bytes, refuses redirect destinations and propagates cancellation', async () => {
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(), maxArchiveBytes: 4 })).rejects.toThrow('byte budget')
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(url => url.startsWith('https://registry.npmjs.org/')
      ? Response.json({ name: '@example/runtime', version: '1.2.3', dist: { integrity, tarball: 'https://unrelated.invalid/archive.tgz' } }) : undefined) })).rejects.toThrow('outside the public npm registry')
    const controller = new AbortController()
    controller.abort()
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(), signal: controller.signal })).rejects.toThrow()
  })

  test('does not mistake a Bun option for a successful consumer script', async () => {
    await expect(verifyReleaseEvidence({ ...plan, checks: ['--help'] }, { cwd: consumer(), fetch: publishedSource() })).rejects.toThrow('named consumer checks')
  })

  test('kills a check that exceeds its execution budget', async () => {
    const root = consumer()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun -e "await Bun.sleep(60000)"' } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource(), checkTimeoutMs: 100 })).rejects.toThrow('was interrupted or exceeded its execution budget')
  })

  test('does not accept a timed-out check that handles termination and exits zero', async () => {
    const root = consumer()
    writeFileSync(join(root, 'check.ts'), 'process.on("SIGTERM", () => process.exit(0)); await Bun.sleep(60000)')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource(), checkTimeoutMs: 300 })).rejects.toThrow('was interrupted or exceeded its execution budget')
  })

  test.each([false, true])('bounds termination with descendant-held output pipes (detached descendant: %s)', async (detached) => {
    const root = consumer()
    writeFileSync(join(root, 'descendant.ts'), 'import {writeFileSync} from "node:fs"; process.on("SIGTERM", () => {}); writeFileSync("descendant.pid", String(process.pid)); console.log("descendant started"); await Bun.sleep(60000)')
    writeFileSync(join(root, 'check.ts'), `import {writeFileSync} from "node:fs"; writeFileSync("parent.pid", String(process.pid)); Bun.spawn([process.execPath, "descendant.ts"], {stdout:"inherit", stderr:"inherit", detached:${detached}}); await Bun.sleep(60000)`)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
    let watchdog: ReturnType<typeof setTimeout> | undefined
    try {
      const execution = verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource(), checkTimeoutMs: 1000 })
      const bounded = new Promise<never>((_, reject) => { watchdog = setTimeout(() => reject(new Error('Verification remained blocked by descendant output pipes')), 4000) })
      await expect(Promise.race([execution, bounded])).rejects.toThrow('was interrupted or exceeded its execution budget')
      expect(existsSync(join(root, 'descendant.pid'))).toBe(true)
      const pid = Number(readFileSync(join(root, 'descendant.pid'), 'utf8'))
      if (!detached) {
        let alive = true
        for (let attempt = 0; attempt < 40 && alive; attempt++) {
          try { process.kill(pid, 0) }
          catch { alive = false }
          if (alive) await Bun.sleep(25)
        }
        expect(alive, 'the owned check descendant must be disposed').toBe(false)
      }
      // A deliberately detached escape is outside POSIX group ownership. Its
      // inherited pipe must still not defeat the verification deadline, and
      // the test always disposes its own escape in finally below.
    }
    finally {
      if (watchdog) clearTimeout(watchdog)
      for (const file of ['descendant.pid', 'parent.pid']) {
        if (!existsSync(join(root, file))) continue
        const pid = Number(readFileSync(join(root, file), 'utf8'))
        if (!Number.isSafeInteger(pid) || pid <= 0) continue
        try {
          if (process.platform === 'win32') Bun.spawnSync(['taskkill', '/PID', String(pid), '/T', '/F'], { stdout: 'ignore', stderr: 'ignore', timeout: 2000 })
          else process.kill(pid, 'SIGKILL')
        }
        catch { /* An already disposed test-owned process needs no cleanup. */ }
      }
    }
  }, 10_000)

  test('a compiled verifier executes consumer scripts through Bun instead of reentering itself', async () => {
    const root = consumer()
    const runner = join(root, 'verifier.ts')
    writeFileSync(runner, `import { verifyReleaseEvidence } from ${JSON.stringify(resolve(import.meta.dir, '../src/release-evidence.ts'))}
const commit = ${JSON.stringify(commit)}
const integrity = ${JSON.stringify(integrity)}
const bytes = new Uint8Array(${JSON.stringify([...bytes])})
const publishedSource = ${publishedSource.toString()}
const result = await verifyReleaseEvidence(${JSON.stringify(plan)}, {cwd: process.cwd(), fetch: publishedSource()})
console.log(JSON.stringify(result.consumer))
`)
    const binary = join(root, process.platform === 'win32' ? 'verifier.exe' : 'verifier')
    const build = await Bun.build({ entrypoints: [runner], compile: { outfile: binary } })
    expect(build.success).toBe(true)
    const child = Bun.spawn([binary], { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, stderr).toBe(0)
    const receipt = JSON.parse(stdout)
    expect(receipt.checks[0].exitCode).toBe(0)
    expect(receipt.bunVersion).toMatch(/^\d+\.\d+\.\d+/)
  }, 30_000)

  test('rejects source-patched installed code even when its version, lock and consumer checks agree', async () => {
    const root = consumer()
    writeFileSync(join(root, 'node_modules/@example/runtime/index.js'), 'export default "patched source"')
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('index.js differs from the verified archive')
  })

  test('rejects extra installed code and a check that patches package code', async () => {
    const root = consumer()
    writeFileSync(join(root, 'node_modules/@example/runtime/injected.js'), 'export default true')
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('injected.js differs from the verified archive')
    rmSync(join(root, 'node_modules/@example/runtime/injected.js'))
    writeFileSync(join(root, 'check.ts'), 'await Bun.write("node_modules/@example/runtime/index.js", "export default 42")')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
    await expect(verifyReleaseEvidence(plan, { cwd: root, fetch: publishedSource() })).rejects.toThrow('index.js differs from the verified archive')
  })

  test('bounds expanded archives before allocating parsed file contents', async () => {
    await expect(verifyReleaseEvidence(plan, { cwd: consumer(), fetch: publishedSource(), maxExpandedBytes: 512 })).rejects.toThrow('byte budget')
  })

  test('rejects a tar header claiming more data than its bounded payload', async () => {
    const tar = await new Bun.Archive(packageEntries).bytes()
    tar.set(new TextEncoder().encode('77777777777\0'), 124)
    const malformed = Bun.gzipSync(tar)
    const changedIntegrity = `sha512-${createHash('sha512').update(malformed).digest('base64')}`
    const changed = structuredClone(plan)
    changed.sources[0]!.packages[0]!.integrity = changedIntegrity
    await expect(verifyReleaseEvidence(changed, {
      cwd: consumer(),
      fetch: publishedSource(url => url.endsWith('.tgz') ? new Response(malformed) : url.startsWith('https://registry.npmjs.org/')
        ? Response.json({ name: '@example/runtime', version: '1.2.3', dist: { integrity: changedIntegrity, tarball: 'https://registry.npmjs.org/@example/runtime/-/runtime-1.2.3.tgz' } }) : undefined),
    })).rejects.toThrow('declares bytes outside its tar bounds')
  })
})
