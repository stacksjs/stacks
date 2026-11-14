import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installSupportMessenger } from '../src/support-installation'

test('messenger install approves only exact configured origin and makes idempotent opt-in stx changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'support-install-'))
  try {
    await mkdir(join(root, 'resources/views/layouts'), { recursive: true })
    const layout = join(root, 'resources/views/layouts/default.stx')
    await writeFile(layout, '<body><main>Existing application</main></body>')
    const config = { supporthq: { url: 'https://hq.support', key: 'server-secret', project: 'public-project' } }
    const changes: unknown[] = [], output: string[] = []
    const deps = { print: (line: string) => output.push(line), writeEnv: async (entries: Record<string, string>) => { changes.push(entries) }, fetch: async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-secret')
      expect(JSON.parse(String(init?.body)).origin).toBe('https://native-app.example')
      return Response.json({ project: 'public-project', origin: 'https://native-app.example', allowed: true })
    } }
    const input = { directory: root, origin: 'https://native-app.example', frameworkVersion: '0.75.576', componentSource: '<div>Native stx support component</div>' }
    expect(await installSupportMessenger(config, input, deps)).toBe(true)
    expect(await installSupportMessenger(config, input, deps)).toBe(true)
    expect((await readFile(layout, 'utf8')).match(/<HqSupport \/>/g)).toHaveLength(1)
    expect(changes[0]).toEqual({ SUPPORTHQ_ENABLED: 'true', SUPPORTHQ_MESSENGER: 'true' })
    expect(output.join('\n')).not.toContain('server-secret')
    await writeFile(join(root, 'resources/components/HqSupport.stx'), '<div>Custom user work</div>')
    expect(await installSupportMessenger(config, input, deps)).toBe(false)
    expect(await readFile(join(root, 'resources/components/HqSupport.stx'), 'utf8')).toContain('Custom user work')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
