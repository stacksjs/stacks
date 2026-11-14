import type { LibraryConfig } from '@stacksjs/types'
import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { projectPath } from '@stacksjs/path'
import { launch, navigate } from '@stacksjs/testing/browser'
import { buildLibraryPackages } from '../src/library/build'
import { planLibraryPublish } from '../src/library/publish'
import { hostedLibraryRetentionInput, inspectLibraryRelease, retainLibraryRelease } from '../src/library/release-artifacts'

// Public build seam: real stx compilation and emitted bytes, no publisher.
test('native web components emit an immutable hosted revision and a stable loader', async () => {
  const components = projectPath('resources/components/hosted-fixture')
  const functions = projectPath('resources/functions/hosted-fixture')
  const output = projectPath('public/hosted-fixture')
  const layoutCss = '\n:host{display:grid}\r\n/* café */\n'
  const componentCss = ':host {\r\n color: red;\r}\r\n/* café\0 */'
  const emittedComponentCss = ':host {\n color: red;\n}\n/* café\uFFFD */'
  const consumer = await mkdtemp(resolve(tmpdir(), 'native-hosted-consumer-'))
  const dirs = [consumer, components, functions, output, projectPath('storage/framework/libs/packages/hosted-fixture'), projectPath('storage/framework/libs/packages/hosted-fx')]
  try {
    await mkdir(components, { recursive: true })
    await mkdir(functions, { recursive: true })
    await Bun.write(resolve(components, 'Greeting.stx'), `<script component>{"shadowDOM":true}</script><template><p>Hello</p></template><style>${componentCss}</style>`)
    await Bun.write(resolve(components, 'Counter.stx'), '<script component>{"shadowDOM":true}</script><template><button>Count</button></template><style>:host { display: block; }</style>')
    await Bun.write(resolve(functions, 'math.ts'), 'export function twice(value: number): number { return value * 2 }\n')
    await Bun.write(resolve(functions, 'layout.css'), layoutCss)
    await Bun.write(resolve(functions, 'loader.ts'), `import layoutCss from './layout.css' with { type: 'text' }
export { layoutCss }
declare const ELEMENT_MODULE: string
export async function boot() { return import(new URL(ELEMENT_MODULE, import.meta.url).href) }
export default boot
`)
    const config: LibraryConfig = { packages: [
      { name: '@fixture/hosted-fixture', kind: 'web-components', prefix: 'fixture', version: '2.3.4', include: ['hosted-fixture/*.stx'], hosted: {
        outputDir: 'public/hosted-fixture/revisions', base: '/hosted-fixture/revisions', entry: 'public/hosted-fixture/elements.js', styles: ['resources/functions/hosted-fixture/layout.css'],
        loader: { source: 'resources/functions/hosted-fixture/loader.ts', exports: ['default', 'boot', 'layoutCss'], define: { ELEMENT_MODULE: JSON.stringify('./bundle.js') } },
      } },
      { name: '@fixture/hosted-fx', kind: 'functions', include: ['hosted-fixture/math.ts'] },
    ] }
    const reports = await buildLibraryPackages({ config })
    const hosted = reports[0]!.hosted!
    expect(hosted).toBeDefined()
    expect(hosted.manifest.version).toBe('2.3.4')
    expect(hosted.revision).toMatch(/^2\.3\.4-[a-f0-9]{32}$/)
    const bundle = await Bun.file(resolve(reports[0]!.dir, 'dist/bundle.js')).bytes()
    expect(await Bun.file(resolve(hosted.immutableDir, 'bundle.js')).bytes()).toEqual(bundle)
    const entry = await Bun.file(hosted.entryPath).text()
    expect(entry).toContain(`${hosted.revision}/elements.js`)
    expect(hosted.manifest.csp.styleSrc).toContain(`'sha256-${createHash('sha256').update(layoutCss).digest('base64')}'`)
    expect(hosted.manifest.csp.styleSrc).toContain(`'sha256-${createHash('sha256').update(emittedComponentCss).digest('base64')}'`)
    expect(reports[1]!.hosted).toBeUndefined()
    const functionsModule = await import(resolve(reports[1]!.dir, 'dist/index.js'))
    expect(functionsModule.twice(4)).toBe(8)
    // Real archives and a clean install prove no app paths or ambient modules
    // are needed by either ordinary functions or the hosted package bundle.
    const run = (cmd: string[], cwd: string) => {
      const proc = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' })
      expect(proc.exitCode, new TextDecoder().decode(proc.stderr)).toBe(0)
    }
    for (const report of reports) run([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', resolve(consumer, `${report.kind}.tgz`)], report.dir)
    const plans = await planLibraryPublish(config)
    const candidateDir = resolve(consumer, 'candidate')
    const source = { repository: 'example/native-library', commit: '1234567890abcdef1234567890abcdef12345678' }
    const candidate = await retainLibraryRelease({ directory: candidateDir, source, tag: 'alpha', packages: plans.map((plan, i) => ({
      ...plan, archivePath: resolve(consumer, `${reports[i]!.kind}.tgz`),
      ...(reports[i]!.hosted ? { hosted: hostedLibraryRetentionInput(reports[i]!.hosted!) } : {}),
    })) })
    expect((await inspectLibraryRelease(candidateDir, source)).packages).toEqual(candidate.packages)
    const visibleFiles = new Set(await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: candidateDir, onlyFiles: true, dot: false })))
    expect(visibleFiles.has('candidate.json')).toBe(true)
    for (const [index, pkg] of candidate.packages.entries()) {
      expect(visibleFiles.has(pkg.archive.path)).toBe(true)
      for (const path of Object.keys(pkg.hosted?.files ?? {})) expect(visibleFiles.has(`hosted/${index}/${path}`), path).toBe(true)
    }
    await Bun.write(resolve(consumer, 'package.json'), JSON.stringify({ name: 'native-library-consumer', type: 'module', private: true, dependencies: {
      '@fixture/hosted-fixture': `file:${resolve(consumer, 'web-components.tgz')}`,
      '@fixture/hosted-fx': `file:${resolve(consumer, 'functions.tgz')}`,
    } }))
    run([process.execPath, 'install', '--ignore-scripts'], consumer)
    expect(await Bun.file(resolve(consumer, 'node_modules/@fixture/hosted-fixture/dist/bundle.js')).bytes()).toEqual(bundle)
    const exportTargets = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(exportTargets) : []
    for (const name of ['@fixture/hosted-fixture', '@fixture/hosted-fx']) {
      const installed = resolve(consumer, 'node_modules', name)
      const manifest = await Bun.file(resolve(installed, 'package.json')).json() as { exports: unknown }
      for (const target of exportTargets(manifest.exports).filter(path => !path.includes('*')))
        expect(await Bun.file(resolve(installed, target)).exists(), `${name}: ${target}`).toBe(true)
    }
    await Bun.write(resolve(consumer, 'consumer.ts'), `import { twice } from '@fixture/hosted-fx'
import { Greeting } from '@fixture/hosted-fixture'
import manifest from '@fixture/hosted-fixture/custom-elements.json'
import { twice as subpathTwice } from '@fixture/hosted-fx/hosted-fixture/math'
if (subpathTwice(3) !== 6) throw new Error('Invalid function subpath')
if (twice(5) !== 10 || typeof Greeting !== 'function' || manifest.modules.length !== 2) throw new Error('Invalid installed exports')
`)
    run([process.execPath, 'run', 'consumer.ts'], consumer)
    await Bun.write(resolve(consumer, 'types.ts'), `import type { Greeting } from '@fixture/hosted-fixture'
const greeting: Greeting = document.createElement('fixture-greeting')
greeting.classList.add('consumer')
`)
    await Bun.write(resolve(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'], types: [], strict: true, skipLibCheck: false, noEmit: true }, files: ['types.ts'] }))
    run([process.execPath, '--bun', 'tsc', '-p', resolve(consumer, 'tsconfig.json'), '--pretty', 'false'], projectPath())

    if (process.env.STACKS_BROWSER_TESTS === '1') {
      const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
        const path = new URL(request.url).pathname
        const headers = { 'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src ${hosted.manifest.csp.styleSrc.join(' ')}` }
        if (path === '/') return new Response('<!doctype html><fixture-greeting></fixture-greeting><fixture-counter></fixture-counter><div id="layout"></div><script type="module" src="/consumer.js"></script>', { headers: { ...headers, 'Content-Type': 'text/html' } })
        if (path === '/consumer.js') return new Response(`globalThis.violations = []; document.addEventListener('securitypolicyviolation', event => globalThis.violations.push(event.violatedDirective)); const { default: boot, layoutCss } = await import('/hosted-fixture/elements.js'); await boot(); const root = document.getElementById('layout').attachShadow({mode:'open'}); const style = document.createElement('style'); style.textContent = layoutCss; root.append(style); globalThis.ready = true;`, { headers: { ...headers, 'Content-Type': 'text/javascript' } })
        const file = Bun.file(projectPath(`public${path}`))
        if (!await file.exists()) return new Response('Missing', { status: 404 })
        return new Response(file, { headers })
      } })
      let browser: Awaited<ReturnType<typeof launch>> | undefined
      try {
        browser = await launch()
        const { cdp } = browser
        await navigate(cdp, `http://127.0.0.1:${server.port}/`)
        expect(await cdp.evaluate('globalThis.ready')).toBe(true)
        expect(await cdp.evaluate(`['fixture-greeting','fixture-counter'].every(tag => !!customElements.get(tag))`)).toBe(true)
        expect(await cdp.evaluate(`getComputedStyle(document.querySelector('fixture-greeting')).color`)).toBe('rgb(255, 0, 0)')
        expect(await cdp.evaluate(`document.querySelector('fixture-greeting').shadowRoot.querySelector('style').textContent`)).toBe(emittedComponentCss)
        expect(await cdp.evaluate('globalThis.violations')).toEqual([])
        expect(cdp.errors).toEqual([])
      }
      finally {
        try { await browser?.close() }
        finally { server.stop(true) }
      }
    }
    const again = await buildLibraryPackages({ config, kinds: ['web-components'] })
    expect(again[0]!.hosted!.revision).toBe(hosted.revision)
    await Bun.write(resolve(hosted.immutableDir, 'bundle.js'), 'tampered')
    await expect(buildLibraryPackages({ config, kinds: ['web-components'] })).rejects.toThrow(/Immutable hosted/)
  }
  finally {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true })
  }
}, 60_000)

// Same public build seam: rejects unsafe config before generated dist or public writes.
test('hosted builds reject traversal, overlapping outputs, missing exports and privileged browser inputs', async () => {
  const component = projectPath('resources/components/hosted-invalid/Panel.stx')
  const loader = projectPath('resources/functions/hosted-invalid/loader.ts')
  const output = projectPath('public/hosted-invalid')
  const dirs = [dirname(component), dirname(loader), output, projectPath('storage/framework/libs/packages/hosted-invalid')]
  const hosted = { outputDir: 'public/hosted-invalid/revisions', base: '/hosted-invalid/revisions', entry: 'public/hosted-invalid/elements.js' }
  const pkg = { name: 'hosted-invalid', kind: 'web-components' as const, include: ['hosted-invalid/*.stx'], hosted }
  try {
    await Bun.write(component, '<template><p>Safe</p></template>')
    await Bun.write(loader, 'export const boot = () => true')
    for (const invalid of [
      { ...hosted, outputDir: '../public/escape' },
      { ...hosted, entry: 'public/a/../escape.js' },
      { ...hosted, base: '/widgets/../escape' },
      { ...hosted, base: 'https://static.example/widgets/../escape' },
      { ...hosted, loader: { source: 'resources/functions/hosted-invalid/missing.ts' } },
      { ...hosted, loader: { source: 'resources/functions/hosted-invalid/loader.ts', exports: ['missing'] } },
      { ...hosted, styles: ['resources/functions/hosted-invalid/loader.ts'] },
      { ...hosted, styles: ['resources/functions/hosted-invalid/missing.css'] },
    ]) await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, hosted: invalid }] } })).rejects.toThrow()
    await expect(buildLibraryPackages({ config: { packages: [pkg, { ...pkg, name: 'another-package' }] } })).rejects.toThrow(/collides/)
    await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, include: ['../outside/*.stx'] }] } })).rejects.toThrow(/glob/)
    for (const code of [
      "import { readFile } from 'node:fs/promises'; export const boot = readFile",
      'export const boot = process.env.PRIVATE_TOKEN',
      "import { env } from '@stacksjs/env'; export const boot = env.PRIVATE_TOKEN",
    ]) {
      await Bun.write(loader, code)
      await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, hosted: { ...hosted, loader: { source: 'resources/functions/hosted-invalid/loader.ts' } } }] } })).rejects.toThrow(/hosted browser|environment access|privileged import/)
    }
    expect(await Bun.file(resolve(output, 'elements.js')).exists()).toBe(false)
  }
  finally { for (const dir of dirs) await rm(dir, { recursive: true, force: true }) }
}, 30_000)

test('hosted output defaults to the native bundle and generation writes no public files', async () => {
  const component = projectPath('resources/components/hosted-default/Panel.stx')
  const output = projectPath('public/hosted-default')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-default')
  const config: LibraryConfig = { packages: [{ name: 'hosted-default', kind: 'web-components', include: ['hosted-default/*.stx'], hosted: {
    outputDir: 'public/hosted-default/revisions', base: '/hosted-default/revisions', entry: 'public/hosted-default/elements.js',
  } }] }
  try {
    await Bun.write(component, '<template><p>First revision</p></template><style>:host { display: block; }</style>')
    const generated = await buildLibraryPackages({ config, compile: false })
    expect(generated[0]?.hosted).toBeUndefined()
    expect(await Bun.file(resolve(output, 'elements.js')).exists()).toBe(false)
    const first = (await buildLibraryPackages({ config }))[0]!.hosted!
    expect(first.manifest.immutableEntrypoint).toEndWith('/bundle.js')
    expect(await Bun.file(resolve(first.immutableDir, 'bundle.css')).bytes()).toEqual(await Bun.file(resolve(packageDir, 'dist/bundle.css')).bytes())
    expect(first.manifest.csp.styleSrc).toContain(`'sha256-${createHash('sha256').update(':host { display: block; }').digest('base64')}'`)
    expect(await Bun.file(first.entryPath).text()).toContain('export * from ')
    for (const file of first.files) {
      const bytes = await Bun.file(file.path).bytes()
      expect(file.bytes).toBe(bytes.byteLength)
      expect(file.gzipBytes).toBe(gzipSync(bytes).byteLength)
      expect(file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(file.integrity).toBe(`sha384-${createHash('sha384').update(bytes).digest('base64')}`)
    }
    await Bun.write(component, '<template><p>Second revision</p></template>')
    const second = (await buildLibraryPackages({ config }))[0]!.hosted!
    expect(second.revision).not.toBe(first.revision)
    expect(await Bun.file(first.manifestPath).exists()).toBe(true)
    expect(await Bun.file(second.entryPath).text()).toContain(second.revision)
  }
  finally { for (const dir of [dirname(component), output, packageDir]) await rm(dir, { recursive: true, force: true }) }
}, 30_000)

test('hosted build paths reject hidden segments before creating a CI candidate', async () => {
  const component = projectPath('resources/components/hosted-hidden/Panel.stx')
  const output = projectPath('public/hosted-hidden')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-hidden')
  try {
    await Bun.write(component, '<template><p>Retained in CI</p></template>')
    const hosted = { outputDir: 'public/hosted-hidden/revisions', base: '/hosted-hidden/revisions', entry: 'public/hosted-hidden/elements.js' }
    for (const paths of [
      { outputDir: 'public/hosted-hidden/.revisions' },
      { outputDir: 'public/hosted-hidden/.assets/revisions' },
      { entry: 'public/hosted-hidden/.elements.js' },
      { entry: 'public/hosted-hidden/.assets/elements.js' },
    ]) {
      await expect(buildLibraryPackages({ compile: false, config: { packages: [{ name: 'hosted-hidden', kind: 'web-components', include: ['hosted-hidden/*.stx'], hosted: { ...hosted, ...paths } }] } })).rejects.toThrow(/hidden.*retention/)
      expect(await Bun.file(resolve(packageDir, 'package.json')).exists()).toBe(false)
    }
  }
  finally { for (const path of [dirname(component), output, packageDir]) await rm(path, { recursive: true, force: true }) }
})
