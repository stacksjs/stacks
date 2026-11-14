import type { HqServicesConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

export async function installSupportMessenger(config: HqServicesConfig, input: { directory: string, origin: string, frameworkVersion: string, componentSource: string, layout?: string }, deps: { fetch: (input: string, init?: RequestInit) => Promise<Response>, print: (line: string) => void, writeEnv: (entries: Record<string, string>) => Promise<void> }): Promise<boolean> {
  try {
    const service = config.supporthq
    if (!service?.key || !service.project) throw new Error('Connect first')
    const endpoint = new URL(service.url), origin = new URL(input.origin)
    for (const url of [endpoint, origin]) {
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Invalid origin')
    }
    const root = await realpath(input.directory)
    const inside = (path: string) => { const result = relative(root, path); if (result.startsWith('..') || result.startsWith('/')) throw new Error('Path outside app'); return result }
    const chosen = input.layout ?? (existsSync(resolve(root, 'resources/views/layouts/default.stx')) ? 'resources/views/layouts/default.stx' : 'resources/layouts/default.stx')
    const layout = await realpath(resolve(root, chosen))
    if (!layout.endsWith('.stx')) throw new Error('Choose an stx layout')
    const layoutName = inside(layout), before = await readFile(layout, 'utf8')
    const component = resolve(root, 'resources/components/HqSupport.stx')
    await mkdir(dirname(component), { recursive: true })
    inside(await realpath(dirname(component)))
    if (existsSync(component)) {
      inside(await realpath(component))
      if (await readFile(component, 'utf8') !== input.componentSource) throw new Error('Existing customized support component')
    }
    const result = await deps.fetch(`${endpoint.origin}/api/v1/projects/${encodeURIComponent(service.project)}/installation`, { method: 'POST', headers: { Authorization: `Bearer ${service.key}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ origin: origin.origin, frameworkVersion: input.frameworkVersion }), redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (!result.ok) { deps.print(`HQ.support refused the installation origin (${result.status}). No messenger was enabled.`); return false }
    const body = await result.json() as Record<string, unknown>
    if (body.project !== service.project || body.origin !== origin.origin || body.allowed !== true) throw new Error('Origin not confirmed')
    await writeFile(component, input.componentSource)
    if (!before.includes('<HqSupport')) {
      const after = /<\/body\s*>/i.test(before) ? before.replace(/<\/body\s*>/i, '  <HqSupport />\n</body>') : `${before.trimEnd()}\n\n<HqSupport />\n`
      await writeFile(layout, after)
    }
    await deps.writeEnv({ SUPPORTHQ_ENABLED: 'true', SUPPORTHQ_MESSENGER: 'true' })
    deps.print('Configured resources/components/HqSupport.stx.')
    deps.print(`Mounted <HqSupport /> in ${layoutName}.`)
    deps.print(`Approved exact messenger origin ${origin.origin}.`)
    deps.print('Enabled SUPPORTHQ_ENABLED and SUPPORTHQ_MESSENGER in .env. Optional name/email sharing remains off.')
    return true
  }
  catch { deps.print('Messenger installation did not complete. Use an app-local stx layout and a public HTTPS or local app origin; existing customized components are preserved.'); return false }
}
