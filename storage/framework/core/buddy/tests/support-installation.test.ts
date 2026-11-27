import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installSupportMessenger, installSupportSdk } from '../src/support-installation'

test('support setup declares the released SDK and preserves an application-selected version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'support-sdk-install-'))
  try {
    const manifest = join(root, 'package.json')
    await writeFile(manifest, JSON.stringify({ name: 'support-consumer' }))
    const calls: string[][] = []
    const output: string[] = []
    let unavailable = true
    const deps = {
      print: (line: string) => output.push(line),
      install: async (directory: string, args: string[]) => {
        expect(directory).toBe(root)
        calls.push(args)
        if (unavailable) return false
        if (args[0] === 'add') await writeFile(manifest, JSON.stringify({ name: 'support-consumer', dependencies: { '@stacksjs/support': '0.75.695' } }))
        return true
      },
    }
    expect(await installSupportSdk(root, '0.75.695', deps)).toBe(false)
    expect(JSON.parse(await readFile(manifest, 'utf8')).dependencies).toBeUndefined()
    unavailable = false
    expect(await installSupportSdk(root, '0.75.695', deps)).toBe(true)
    expect(await installSupportSdk(root, '0.75.696', deps)).toBe(true)
    expect(calls).toEqual([
      ['add', '--exact', '@stacksjs/support@0.75.695'],
      ['add', '--exact', '@stacksjs/support@0.75.695'],
      ['install'],
    ])
    expect(JSON.parse(await readFile(manifest, 'utf8')).dependencies['@stacksjs/support']).toBe('0.75.695')
    expect(output.join('\n')).toContain('could not install')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('support setup moves a development SDK to runtime without replacing its range', async () => {
  const root = await mkdtemp(join(tmpdir(), 'support-sdk-promote-'))
  try {
    const manifest = join(root, 'package.json')
    const original = '{"name":"support-consumer","devDependencies":{"@stacksjs/support":"^0.75.643","test-helper":"1.0.0"}}\n'
    await writeFile(manifest, original)
    let unavailable = true
    const deps = {
      print: () => {},
      install: async (directory: string, args: string[]) => {
        expect(directory).toBe(root)
        expect(args).toEqual(['install'])
        const pkg = JSON.parse(await readFile(manifest, 'utf8'))
        expect(pkg.dependencies).toEqual({ '@stacksjs/support': '^0.75.643' })
        expect(pkg.devDependencies).toEqual({ 'test-helper': '1.0.0' })
        return !unavailable
      },
    }
    expect(await installSupportSdk(root, '0.75.695', deps)).toBe(false)
    expect(await readFile(manifest, 'utf8')).toBe(original)
    unavailable = false
    expect(await installSupportSdk(root, '0.75.695', deps)).toBe(true)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

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
