import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = import.meta.dir
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, { types: string, import: string }>
  dependencies: Record<string, string>
}
const output = join(root, 'dist')
const transpiler = new Bun.Transpiler({ loader: 'ts' })
const entries: { types: string, runtime: string, source: string }[] = []

// Generate package re-exports rather than copying sibling dist trees. The
// ordinary installer owns those modules, including shared runtime singletons.
for (const [subpath, targets] of Object.entries(manifest.exports)) {
  const directory = subpath === '.' ? 'buddy' : subpath.slice(2)
  if (!/^[a-z][a-z-]*$/.test(directory))
    throw new Error(`Unsupported umbrella export: ${subpath}`)
  if (targets.types !== `./dist/${directory}.d.ts` || targets.import !== `./dist/${directory}.js`)
    throw new Error(`Umbrella export must point inside dist: ${subpath}`)

  const sibling = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8')) as {
    name: string
    private?: boolean
  }
  let source: string
  if (sibling.private) {
    // Development has always been an empty module. Keep that entrypoint
    // without depending on a private package that cannot be installed.
    const original = await readFile(join(root, directory, 'index.ts'), 'utf8')
    const scanned = transpiler.scan(original)
    if (directory !== 'development' || scanned.imports.length || scanned.exports.length)
      throw new Error(`Private umbrella module needs a public package: ${subpath}`)
    source = 'export {}\n'
  }
  else {
    if (!manifest.dependencies[sibling.name])
      throw new Error(`Umbrella export requires a declared dependency: ${sibling.name}`)
    const original = await readFile(join(root, directory, 'src/index.ts'), 'utf8')
    const hasDefault = transpiler.scan(original).exports.includes('default')
    source = `export * from '${sibling.name}'\n`
    if (hasDefault)
      source += `export { default } from '${sibling.name}'\n`
  }
  entries.push({ types: targets.types, runtime: targets.import, source })
}

// Validate the entire manifest before replacing a previous successful build.
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
for (const entry of entries) {
  await writeFile(join(root, entry.types), entry.source)
  await writeFile(join(root, entry.runtime), entry.source)
}
console.log(`Built ${entries.length} public umbrella entrypoints`)
