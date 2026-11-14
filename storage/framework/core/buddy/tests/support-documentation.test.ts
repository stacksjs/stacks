import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSupportDocsSync, selectSupportDocuments } from '../src/support-documentation'

test('explicit documentation selection defaults private and refuses traversal or symlink escape', async () => {
  const root = await mkdtemp(join(tmpdir(), 'support-docs-'))
  try {
    await mkdir(join(root, 'app'))
    await writeFile(join(root, 'app', 'guide.md'), '# Guide\nSelected documentation.')
    await writeFile(join(root, 'secret.md'), '# Outside\nDo not publish.')
    await symlink(join(root, 'secret.md'), join(root, 'app', 'linked.md'))
    const documents = await selectSupportDocuments(join(root, 'app'), ['guide.md'])
    expect(documents[0]).toEqual({ source: 'guide.md', title: 'Guide', body: '# Guide\nSelected documentation.', locale: 'en', visibility: 'internal', publish: false })
    await expect(selectSupportDocuments(join(root, 'app'), ['../secret.md'])).rejects.toThrow('inside')
    await expect(selectSupportDocuments(join(root, 'app'), ['linked.md'])).rejects.toThrow('inside')
    await expect(selectSupportDocuments(join(root, 'app'), [])).rejects.toThrow('Select')
    await expect(selectSupportDocuments(join(root, 'app'), ['guide.md', 'guide.md'])).rejects.toThrow('once')
    let calls = 0
    const print: string[] = []
    const deps = { fetch: async () => { calls++; throw new Error('Never called') }, print: (line: string) => print.push(line) }
    expect(await runSupportDocsSync({}, documents, { dryRun: true }, deps)).toBe(true)
    expect(calls).toBe(0)
    expect(print.join('\n')).not.toContain('Selected documentation.')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('sync keeps integration keys server-only and does not print provider bodies or document content', async () => {
  const output: string[] = []
  const documents = [{ source: 'docs/guide.md', title: 'Guide', body: 'Private source text', locale: 'en', visibility: 'internal' as const, publish: false }]
  const config = { supporthq: { url: 'https://hq.support', key: 'integration-secret', project: 'public-project' } }
  let calls = 0
  const deps = { print: (line: string) => output.push(line), fetch: async (input: string, init?: RequestInit) => {
    calls++
    expect(input).toBe('https://hq.support/api/v1/projects/public-project/knowledge/sync')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer integration-secret')
    expect(init?.redirect).toBe('error')
    return calls === 1 ? Response.json({ documents: [{ source: 'docs/guide.md', revision: 2, changed: true }] }) : new Response('secret provider error with integration-secret', { status: 409 })
  } }
  expect(await runSupportDocsSync(config, documents, {}, deps)).toBe(true)
  expect(await runSupportDocsSync(config, documents, {}, deps)).toBe(false)
  expect(output.join('\n')).not.toContain('integration-secret')
  expect(output.join('\n')).not.toContain('Private source text')
  expect(await runSupportDocsSync({ supporthq: { ...config.supporthq, url: 'https://user:pass@hq.support' } }, documents, {}, deps)).toBe(false)
  expect(calls).toBe(2)
})
