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

// Public builder seam catches generated-input order and immutable bytes; provider
// publication is deliberately outside this fixture.
test('native prebuild generates current hosted loader dependencies and literal styles exactly once', async () => {
  const component = projectPath('resources/components/hosted-prebuild/Panel.stx')
  const inputs = projectPath('resources/functions/hosted-prebuild')
  const output = projectPath('public/hosted-prebuild')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-prebuild')
  const config: LibraryConfig = { packages: [{ name: 'hosted-prebuild', kind: 'web-components', include: ['hosted-prebuild/*.stx'],
    prebuild: 'bun resources/functions/hosted-prebuild/generate.ts', hosted: {
      outputDir: 'public/hosted-prebuild/revisions', base: '/hosted-prebuild/revisions', entry: 'public/hosted-prebuild/elements.js',
      styles: ['resources/functions/hosted-prebuild/generated.css'], loader: { source: 'resources/functions/hosted-prebuild/loader.ts' },
    },
  }] }
  try {
    await Bun.write(component, '<template><p>Generated inputs</p></template>')
    await Bun.write(resolve(inputs, 'loader.ts'), "import css from './generated.css' with { type: 'text' }; export { marker } from './generated.ts'; export { css }")
    await Bun.write(resolve(inputs, 'generate.ts'), `const root = import.meta.dir; const n = Number(await Bun.file(root + '/count').text().catch(() => '0')) + 1; await Bun.write(root + '/count', String(n)); await Bun.write(root + '/generated.ts', 'export const marker = "after-' + n + '"'); await Bun.write(root + '/generated.css', ':host { color: rgb(' + n + ', 0, 0); }')`)
    await buildLibraryPackages({ config, compile: false })
    expect(await Bun.file(resolve(inputs, 'count')).exists()).toBe(false)
    for (const count of [1, 2]) {
      const result = (await buildLibraryPackages({ config }))[0]!
      const hosted = result.hosted!
      const module = await import(resolve(hosted.immutableDir, 'elements.js'))
      const css = await Bun.file(resolve(inputs, 'generated.css')).text()
      expect(module.marker).toBe(`after-${count}`)
      expect(module.css).toBe(css)
      expect(await Bun.file(resolve(inputs, 'count')).text()).toBe(String(count))
      expect(hosted.manifest.csp.styleSrc).toContain(`'sha256-${createHash('sha256').update(css).digest('base64')}'`)
      expect(await Bun.file(resolve(hosted.immutableDir, 'bundle.js')).bytes()).toEqual(await Bun.file(resolve(result.dir, 'dist/bundle.js')).bytes())
    }
  }
  finally { for (const path of [dirname(component), inputs, output, packageDir]) await rm(path, { recursive: true, force: true }) }
}, 30_000)

test('hosted browser validation distinguishes executable environment reads from literal copy', async () => {
  const component = projectPath('resources/components/hosted-code/Panel.stx')
  const inputs = projectPath('resources/functions/hosted-code')
  const output = projectPath('public/hosted-code')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-code')
  const config: LibraryConfig = { packages: [{ name: 'hosted-code', kind: 'web-components', include: ['hosted-code/*.stx'], hosted: {
    outputDir: 'public/hosted-code/revisions', base: '/hosted-code/revisions', entry: 'public/hosted-code/elements.js', loader: { source: 'resources/functions/hosted-code/loader.ts' },
  } }] }
  try {
    await Bun.write(component, '<script>const label = "process.env.SECRET"; /* Bun.env.PRIVATE */</script><template><p>Set process.env.SUPPORTHQ_KEY on the server.</p><p>{{ "Bun.env.SECRET" }}</p><p>{{ label }}</p></template>')
    await Bun.write(resolve(inputs, 'loader.ts'), `// process.env.SECRET\nexport const copy = 'process.env.SECRET'; export const pattern = /Bun.env.SECRET/; export const literal = \`import.meta.env.SECRET\``)
    const result = (await buildLibraryPackages({ config }))[0]!.hosted!
    expect(await Bun.file(resolve(result.immutableDir, 'bundle.js')).text()).toContain('process.env.SUPPORTHQ_KEY')
    for (const expression of ['process.env.SECRET', 'process["env"].SECRET', 'process[`env`].SECRET', 'globalThis.process.env.SECRET', 'Bun.env.SECRET', 'import.meta.env.SECRET', '`secret:${process.env.SECRET}`']) {
      await Bun.write(resolve(inputs, 'dependency.ts'), `export const value = ${expression}`)
      await Bun.write(resolve(inputs, 'loader.ts'), "export { value } from './dependency.ts'")
      await expect(buildLibraryPackages({ config })).rejects.toThrow(/environment access/)
    }
    await Bun.write(resolve(inputs, 'loader.ts'), 'export const boot = true')
    for (const source of [
      '<script>const secret = process.env.SECRET</script><template><p>{{ secret }}</p></template>',
      '<script client>export function secret() { return Bun.env.SECRET }</script><template><p>Private</p></template>',
      '<template><p>{{ process.env.SECRET }}</p></template>',
      '<template><p>{{ `secret:${process.env.SECRET}` }}</p></template>',
    ]) {
      await Bun.write(component, source)
      await expect(buildLibraryPackages({ config })).rejects.toThrow(/environment access/)
    }
  }
  finally { for (const path of [dirname(component), inputs, output, packageDir]) await rm(path, { recursive: true, force: true }) }
}, 30_000)

// Build, archive and browser seams catch omitted assets and drift. This does
// not exercise an external registry or deployment.
test('configured native assets retain their nested paths, browser URLs and archive identity', async () => {
  const component = projectPath('resources/components/hosted-assets/Panel.stx')
  const inputs = projectPath('resources/functions/hosted-assets')
  const output = projectPath('public/hosted-assets')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-assets')
  const consumer = await mkdtemp(resolve(tmpdir(), 'native-hosted-assets-'))
  const config: LibraryConfig = { packages: [{ name: 'hosted-assets', registry: 'npm', kind: 'web-components', include: ['hosted-assets/*.stx'], version: '1.2.3',
    assets: { 'payload.json': 'resources/functions/hosted-assets/payload.json', data: 'resources/functions/hosted-assets/data' },
    hosted: { outputDir: 'public/hosted-assets/revisions', base: '/hosted-assets/revisions', entry: 'public/hosted-assets/elements.js', loader: { source: 'resources/functions/hosted-assets/loader.ts' } },
  }] }
  const source = { repository: 'example/native-assets', commit: '1234567890abcdef1234567890abcdef12345678' }
  try {
    await Bun.write(component, '<template><p>Native assets</p></template>')
    await Bun.write(resolve(inputs, 'loader.ts'), "export async function read() { return Promise.all(['./payload.json', './data/nested/value.json'].map(async path => (await fetch(new URL(path, import.meta.url))).json())) }")
    await Bun.write(resolve(inputs, 'payload.json'), '{"revision":1}')
    await Bun.write(resolve(inputs, 'data/nested/value.json'), '{"nested":true}')
    const result = (await buildLibraryPackages({ config }))[0]!
    const first = result.hosted!
    for (const name of ['payload.json', 'data/nested/value.json']) {
      const bytes = await Bun.file(resolve(packageDir, 'dist', name)).bytes()
      expect(await Bun.file(resolve(first.immutableDir, name)).bytes()).toEqual(bytes)
      const metadata = first.manifest.files.find(file => file.path.endsWith(`/${name}`))!
      expect(metadata.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(metadata.bytes).toBe(bytes.length)
      expect(metadata.gzipBytes).toBe(gzipSync(bytes).length)
      expect(metadata.integrity).toBe(`sha384-${createHash('sha384').update(bytes).digest('base64')}`)
      expect(hostedLibraryRetentionInput(first).files.find(file => file.source === resolve(first.immutableDir, name))?.packagePath).toBe(`dist/${name}`)
    }
    expect(first.manifest.files.some(file => /\.ssr\.|\.d\.ts$|\.map$/.test(file.path))).toBe(false)
    const archive = resolve(consumer, 'assets.tgz')
    const pack = () => {
      const proc = Bun.spawnSync({ cmd: [process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive], cwd: packageDir, stdout: 'pipe', stderr: 'pipe' })
      expect(proc.exitCode, proc.stderr.toString()).toBe(0)
    }
    pack()
    const plans = await planLibraryPublish(config)
    const candidateDir = resolve(consumer, 'candidate')
    const candidate = await retainLibraryRelease({ directory: candidateDir, source, packages: [{ ...plans[0]!, archivePath: archive, hosted: hostedLibraryRetentionInput(first) }] })
    expect((await inspectLibraryRelease(candidateDir, source)).packages).toEqual(candidate.packages)
    await Bun.write(resolve(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { 'hosted-assets': 'file:assets.tgz' } }))
    for (const cmd of [
      [process.execPath, 'install', '--ignore-scripts'],
      ['node', '--input-type=module', '-e', 'import value from "hosted-assets/data/nested/value.json" with { type: "json" }; if (!value.nested) throw new Error("Missing nested package asset")'],
    ]) {
      const proc = Bun.spawnSync({ cmd, cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
      expect(proc.exitCode, proc.stderr.toString()).toBe(0)
    }
    if (process.env.STACKS_BROWSER_TESTS === '1') {
      const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/') return new Response('<script type="module" src="/test.js"></script>', { headers: { 'Content-Type': 'text/html' } })
        if (path === '/test.js') return new Response("const { read } = await import('/hosted-assets/elements.js'); globalThis.result = await read()", { headers: { 'Content-Type': 'text/javascript' } })
        if (path === '/favicon.ico') return new Response(null, { status: 204 })
        const file = Bun.file(projectPath(`public${path}`))
        return await file.exists() ? new Response(file) : new Response('Missing', { status: 404 })
      } })
      let browser: Awaited<ReturnType<typeof launch>> | undefined
      try {
        browser = await launch()
        await navigate(browser.cdp, `http://127.0.0.1:${server.port}/`)
        expect(await browser.cdp.evaluate('globalThis.result')).toEqual([{ revision: 1 }, { nested: true }])
        expect(browser.cdp.errors).toEqual([])
      }
      finally { try { await browser?.close() } finally { server.stop(true) } }
    }
    // A newly packed package cannot silently disagree with the hosted revision.
    await Bun.write(resolve(packageDir, 'dist/payload.json'), '{"revision":999}')
    pack()
    await expect(retainLibraryRelease({ directory: resolve(consumer, 'wrong-archive'), source, packages: [{ ...plans[0]!, archivePath: archive, hosted: hostedLibraryRetentionInput(first) }] })).rejects.toThrow(/hosted|Hosted/)
    await Bun.write(resolve(inputs, 'payload.json'), '{"revision":2}')
    const second = (await buildLibraryPackages({ config }))[0]!.hosted!
    expect(second.revision).not.toBe(first.revision)
    expect(await Bun.file(resolve(first.immutableDir, 'payload.json')).text()).toBe('{"revision":1}')
    await Bun.write(resolve(second.immutableDir, 'data/nested/value.json'), 'corrupted')
    await expect(buildLibraryPackages({ config })).rejects.toThrow(/Immutable hosted/)
  }
  finally { for (const path of [dirname(component), inputs, output, packageDir, consumer]) await rm(path, { recursive: true, force: true }) }
}, 60_000)

test('hosted assets and generated paths fail closed before public writes', async () => {
  const component = projectPath('resources/components/hosted-paths/Panel.stx')
  const inputs = projectPath('resources/functions/hosted-paths')
  const output = projectPath('public/hosted-paths')
  const packageDir = projectPath('storage/framework/libs/packages/hosted-paths')
  const outside = await mkdtemp(resolve(tmpdir(), 'hosted-outside-'))
  const hosted = { outputDir: 'public/hosted-paths/revisions', base: '/hosted-paths/revisions', entry: 'public/hosted-paths/elements.js', loader: { source: 'resources/functions/hosted-paths/loader.ts' } }
  const pkg = { name: 'hosted-paths', kind: 'web-components' as const, include: ['hosted-paths/*.stx'], hosted, prebuild: 'bun resources/functions/hosted-paths/generate.ts' }
  try {
    await Bun.write(component, '<template><p>Safe paths</p></template>')
    await Bun.write(resolve(inputs, 'loader.ts'), 'export const ready = true')
    await Bun.write(resolve(inputs, 'payload.json'), '{}')
    await Bun.write(resolve(inputs, 'generate.ts'), "await Bun.write(import.meta.dir + '/ran', 'yes')")
    for (const dest of ['.hidden.json', 'data/.private/payload.json', 'manifest.json', 'elements.js', 'elements.js/nested.json']) {
      await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, assets: { [dest]: 'resources/functions/hosted-paths/payload.json' } }] } })).rejects.toThrow(/hidden|collides/)
      expect(await Bun.file(resolve(inputs, 'ran')).exists()).toBe(false)
      expect(await Bun.file(resolve(packageDir, 'package.json')).exists()).toBe(false)
    }
    await Bun.write(resolve(outside, 'private.css'), ':host { color: red; }')
    await Bun.write(resolve(inputs, 'generate.ts'), `import { symlink } from 'node:fs/promises'; await symlink(${JSON.stringify(resolve(outside, 'private.css'))}, import.meta.dir + '/generated.css')`)
    await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, hosted: { ...hosted, styles: ['resources/functions/hosted-paths/generated.css'] } }] } })).rejects.toThrow(/symbolic link/)
    expect(await Bun.file(resolve(output, 'elements.js')).exists()).toBe(false)
    // A nested copy result cannot smuggle a hidden artifact past CI retention.
    await Bun.write(resolve(inputs, 'generate.ts'), "await Bun.write(import.meta.dir + '/data/.private.json', '{}')")
    await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, assets: { data: 'resources/functions/hosted-paths/data' } }] } })).rejects.toThrow(/hidden/)
    expect(await Bun.file(resolve(output, 'elements.js')).exists()).toBe(false)
    await Bun.write(resolve(inputs, '.env.secret'), 'PRIVATE_TOKEN=private')
    await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, prebuild: undefined, assets: { 'payload.json': 'resources/functions/hosted-paths/.env.secret' } }] } })).rejects.toThrow(/server source/)
    await Bun.write(resolve(inputs, 'unsafe.js'), 'export const secret = process.env.PRIVATE')
    await expect(buildLibraryPackages({ config: { packages: [{ ...pkg, prebuild: undefined, assets: { 'public.js': 'resources/functions/hosted-paths/unsafe.js' } }] } })).rejects.toThrow(/environment access/)
    expect(await Bun.file(resolve(output, 'elements.js')).exists()).toBe(false)
  }
  finally { for (const path of [dirname(component), inputs, output, packageDir, outside]) await rm(path, { recursive: true, force: true }) }
}, 30_000)
