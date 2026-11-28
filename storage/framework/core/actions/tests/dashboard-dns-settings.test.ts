import type { DnsConfig } from '@stacksjs/types'
import type { DnsProvider, DnsRecord } from '@stacksjs/ts-cloud'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createDeploymentPreview } from '../../buddy/src/commands/deploy-preview'
import { syncDnsConfig } from '../../dns/src/sync'
import { appendConfigRecord, dashboardConfigRoutes } from '../src/dev/dashboard-config'

const cloud = `export const tsCloud = { sites: {
  app: { domain: 'postline.example.test' },
  redirect: { domain: 'postline.example.org', redirect: 'https://postline.example.test' },
} }`
const source = `const redirects = ['postline.example.org']
const dns = {
  // Preserve this deployment's routing rules.
  redirects: [...redirects],
  txt: [],
}
export default dns
`

describe('DNS declarations from Settings', () => {
  let directory: string
  let file: string
  let routes: ReturnType<typeof dashboardConfigRoutes>

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'stacks-dashboard-dns-'))
    file = join(directory, 'dns.ts')
    writeFileSync(file, source)
    writeFileSync(join(directory, 'cloud.ts'), cloud)
    routes = dashboardConfigRoutes({
      directory,
      hosts: () => ['localhost:3002'],
      validateWrite: async (request) => {
        if (request.headers.get('x-csrf-token') !== 'proof')
          throw Object.assign(new Error('Forbidden'), { status: 403 })
      },
    })
  })

  afterEach(() => rmSync(directory, { force: true, recursive: true }))

  function call(path: string, body?: unknown, token = 'proof') {
    const headers = { 'x-stacks-config': '1', 'x-csrf-token': token }
    return routes[path]!(new Request('http://localhost:3002' + path, body === undefined ? { headers } : {
      headers,
      method: 'POST',
      body: JSON.stringify(body),
    }))
  }

  it('saves a first record to the project and hands it to the real reconcile planner', async () => {
    const before = await (await call('/api/config/dns')).json()
    expect(before.domains).toEqual(['postline.example.test'])
    expect(before.records).toEqual([])
    const response = await call('/api/config/dns/add', {
      revision: before.revision,
      record: { domain: before.domains[0], type: 'TXT', host: '_verify', value: 'token=example', ttl: 600 },
    })
    expect(response.status).toBe(200)
    const onDisk = readFileSync(file, 'utf8')
    expect(onDisk).toContain('redirects: [...redirects]')
    expect(onDisk).toContain('Preserve this deployment')
    const after = await (await call('/api/config/dns')).json()
    expect(after.records).toEqual([{ name: '_verify.postline.example.test.', type: 'TXT', value: 'token=example', ttl: 600 }])

    const { default: declared } = await import(pathToFileURL(file).href) as { default: DnsConfig }
    const preview = createDeploymentPreview({
      config: { cloud: { provider: 'hetzner' }, sites: { app: { domain: 'postline.example.test' } } },
      dnsConfig: declared,
      environment: 'production',
      resolveSiteKind: () => 'server-app',
      applyEnvironmentToSites: sites => sites,
    })
    expect(preview.operations).toContainEqual({
      phase: 'dns', label: 'Add declared DNS records', detail: 'TXT _verify.postline.example.test', sites: [],
    })
    const writes: DnsRecord[] = []
    const provider = {
      name: 'fake',
      listRecords: async () => ({ success: true, records: writes }),
      createRecord: async (_domain: string, record: DnsRecord) => {
        writes.push(record)
        return { success: true }
      },
    } as unknown as DnsProvider
    expect((await syncDnsConfig('postline.example.org', declared, { provider })).created).toBe(0)
    expect((await syncDnsConfig('postline.example.test', declared, { provider })).created).toBe(1)
    expect((await syncDnsConfig('postline.example.test', declared, { provider })).kept).toBe(1)
    expect(writes).toEqual([{ name: '_verify.postline.example.test', type: 'TXT', content: 'token=example', ttl: 600 }])
  })

  it('rejects private addresses, duplicate policy, unrelated domains, stale changes, and missing CSRF', async () => {
    writeFileSync(file, source.replace('txt: []', "txt: [{ name: '@', content: 'v=spf1 -all', ttl: 600 }]"))
    const { revision, domains } = await (await call('/api/config/dns')).json()
    const base = { domain: domains[0], host: '@', type: 'TXT', value: 'v=spf1 include:someone.example -all', ttl: 600 }
    expect((await call('/api/config/dns/add', { revision, record: base })).status).toBe(422)
    expect((await call('/api/config/dns/add', { revision, record: { ...base, domain: 'example.test' } })).status).toBe(422)
    expect((await call('/api/config/dns/add', { revision, record: { ...base, host: 'extra', type: 'A', value: '192.168.0.1' } })).status).toBe(422)
    expect((await call('/api/config/dns/add', { revision, record: base }, '')).status).toBe(403)
    writeFileSync(file, source)
    expect((await call('/api/config/dns/add', { revision, record: base })).status).toBe(409)
    expect(readFileSync(file, 'utf8')).toBe(source)
  })

  it('preserves computed arrays and neighboring comments while adding to a literal list', () => {
    expect(appendConfigRecord("export default { txt: [/* billing verification */ ...derived] }", 'txt', { name: 'a', content: 'b' })).toContain('/* billing verification */ ...derived')
    expect(() => appendConfigRecord('export default { txt: computed() }', 'txt', { name: 'a' })).toThrow('record list is computed')
    expect(appendConfigRecord('export default {}', 'mx', { name: '@' })).toContain("mx: [{ name: '@' }]")
    expect(appendConfigRecord('export const dns = { txt: [] }', 'txt', { name: '@' }, 'dns')).toContain("{ name: '@' }")
  })
})
