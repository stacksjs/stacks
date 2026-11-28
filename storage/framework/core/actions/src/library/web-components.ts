import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { safeArchivePath } from './archive'
import { readsEnvironment } from './browser-syntax'

export interface StandaloneWebComponentOptions {
  name: string
  version?: string
  /** Expected custom element tags. If omitted, check all declarations in the catalog. */
  tags?: readonly string[]
  license?: string
  access?: 'public' | 'restricted'
  /** Application-specific strings forbidden in published browser files. */
  blockedMarkers?: RegExp
}

export interface StandaloneWebComponentReport {
  version: string
  classes: { name: string, tag: string }[]
}

const componentTag = /^[a-z][a-z0-9._]*-[a-z0-9._-]+$/
const packageFiles = new Set(['package.json', 'README.md', 'LICENSE', 'LICENSE.md'])

/** Check a self-contained Stacks web-component package without executing its files. */
export function inspectStandaloneWebComponentPackage(files: ReadonlyMap<string, Uint8Array>, options: StandaloneWebComponentOptions): StandaloneWebComponentReport {
  function text(path: string): string {
    const bytes = files.get(path)
    assert.ok(bytes, `Missing package file: ${path}`)
    return new TextDecoder().decode(bytes)
  }

  const manifest = JSON.parse(text('package.json'))
  assert.equal(manifest.name, options.name)
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.private, undefined)
  assert.ok(typeof manifest.version === 'string' && manifest.version, 'Package version is required')
  if (options.version) assert.equal(manifest.version, options.version, 'Candidate version must match the reviewed version')
  if (options.license) assert.equal(manifest.license, options.license)
  if (options.access) assert.deepEqual(manifest.publishConfig, { access: options.access })
  assert.deepEqual(manifest.dependencies ?? {}, {}, 'Standalone elements must not depend on server/framework packages')
  assert.deepEqual(manifest.optionalDependencies ?? {}, {})
  assert.deepEqual(manifest.peerDependencies ?? {}, {})
  assert.equal(manifest.devDependencies, undefined)
  assert.equal(manifest.scripts, undefined, 'Publish/consumer lifecycle scripts are not permitted')

  const packageExports = manifest.exports as Record<string, string | Record<string, string>>
  assert.ok(packageExports && typeof packageExports === 'object' && !Array.isArray(packageExports), 'Component exports are required')
  for (const [key, entry] of Object.entries(packageExports)) {
    assert.ok(!key.includes('*'), 'Component exports must name actual emitted files')
    const targets = typeof entry === 'string' ? [entry] : Object.values(entry)
    assert.ok(targets.length, `Export ${key} has no target`)
    for (const target of targets) {
      assert.ok(typeof target === 'string' && target.startsWith('./dist/') && !target.includes('*')
        && safeArchivePath(target.slice(2)), `Unsafe or invented export target: ${key}`)
      assert.ok(files.has(target.slice(2)), `Export ${key} points at missing ${target}`)
    }
  }
  function entry(key: string) {
    const value = packageExports[key]
    return typeof value === 'object' ? value : undefined
  }
  assert.equal(entry('.')?.types, './dist/index.d.ts')
  assert.equal(entry('.')?.import, './dist/bundle.js')
  assert.equal(packageExports['./custom-elements.json'], './dist/custom-elements.json')
  assert.equal(entry('./ssr')?.types, './dist/ssr.d.ts')
  assert.equal(entry('./ssr')?.import, './dist/ssr.js')
  assert.deepEqual(packageExports['./ssr.js'], packageExports['./ssr'])

  const catalog = JSON.parse(text('dist/custom-elements.json')) as {
    modules?: Array<{ declarations?: Array<{ customElement?: boolean, name?: string, tagName?: string }> }>
  }
  assert.ok(Array.isArray(catalog.modules), 'Custom elements catalog requires modules')
  const classes: StandaloneWebComponentReport['classes'] = []
  const tags = new Set<string>()
  for (const module of catalog.modules) {
    for (const component of module.declarations ?? []) {
      if (!component.customElement) continue
      const { name, tagName: tag } = component
      assert.ok(typeof name === 'string' && name && typeof tag === 'string' && componentTag.test(tag), 'Invalid custom element declaration')
      assert.ok(!tags.has(tag), `Duplicate custom element tag: ${tag}`)
      tags.add(tag)
      classes.push({ name, tag })
      const subpath = './' + tag
      assert.equal(entry(subpath)?.import, `./dist/${tag}.js`)
      assert.equal(entry(subpath)?.types, `./dist/${tag}.d.ts`)
      assert.deepEqual(packageExports[subpath + '.js'], packageExports[subpath], 'Explicit JS extension must resolve once')
      assert.equal(packageExports[subpath + '.css'], `./dist/${tag}.css`)
      assert.ok(text(`dist/${tag}.js`).length > 0)
      assert.ok(text(`dist/${tag}.d.ts`).includes('extends HTMLElement'))
    }
  }
  assert.ok(tags.size, 'No custom elements were emitted')
  if (options.tags) assert.deepEqual([...tags].sort(), [...options.tags].sort())

  const transpiler = new Bun.Transpiler({ loader: 'js' })
  // Clone a stateful caller expression so audit results cannot depend on prior files.
  const extra = options.blockedMarkers
  const blocked = extra && new RegExp(extra.source, extra.flags.replace(/[gy]/g, ''))
  for (const [path, bytes] of files) {
    assert.ok(safeArchivePath(path)
      && (packageFiles.has(path) || /^dist\/[a-zA-Z0-9._/-]+\.(?:js|css|json|d\.ts)$/.test(path)), `Unexpected published source or private file: ${path}`)
    const contents = new TextDecoder().decode(bytes)
    assert.ok(!/BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY/.test(contents) && !blocked?.test(contents), `Server/private marker in ${path}`)
    if (!path.endsWith('.js')) continue
    assert.ok(!readsEnvironment(contents, path), `Environment access in ${path}`)
    for (const dependency of transpiler.scanImports(contents)) {
      assert.ok(dependency.path.startsWith('./') || dependency.path.startsWith('../'), `Nonstandalone dependency ${dependency.path} in ${path}`)
      const target = posix.join(posix.dirname(path), dependency.path)
      assert.ok(safeArchivePath(target) && files.has(target), `Missing dependency ${dependency.path} in ${path}`)
    }
  }
  text('README.md')
  return { version: manifest.version, classes }
}
