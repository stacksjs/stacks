/**
 * Publish the framework packages a dependency layer at a time, each layer in
 * parallel.
 *
 * `pantry publish 'storage/framework/core/*'` publishes the 85 packages one
 * after another, and each one waits for npm to show the upload publicly before
 * the next starts: 60 to 130 seconds a package, so a release spent two hours
 * or more in this step (v0.75.233: 51 of 85 out after 90 minutes), and every
 * `buddy upgrade` waited on it.
 *
 * Nothing about that wait needs to be serial. A package only has to wait for
 * the packages it depends on (pantry holds back one whose dependency it cannot
 * read yet, and that check stays). So the packages are grouped into layers by
 * their `dependencies` (17 today): everything in a layer depends only on
 * earlier layers, so a layer publishes all at once, and the next starts when
 * every package in it is out. Peer and optional dependencies don't order
 * anything here, for the same reason they don't for pantry: they form cycles
 * (database and orm name each other) and nothing installs them.
 *
 * Each package still goes through publish-npm.sh, so an upload npm accepted
 * but has not shown yet is verified and resumed exactly as before, per
 * package. A package already on the registry is skipped by pantry, so a rerun
 * after a failure continues where it stopped.
 *
 * Usage: bun .github/scripts/publish-layers.ts <pantry publish arguments...>
 *   PUBLISH_CONCURRENCY  packages published at once within a layer (default 8)
 */
import { join } from 'node:path'
import process from 'node:process'
import { publishables } from './promote-latest'

export interface LayeredPackage {
  name: string
  dir: string
  dependencies: string[]
}

/**
 * The packages in publish order: layer 0 depends on none of the others, and
 * each later layer only on earlier ones. Throws on a cycle, which a registry
 * could never satisfy in any order.
 */
export function publishLayers(packages: readonly LayeredPackage[]): LayeredPackage[][] {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (name: string, trail: string[]): number => {
    const known = depth.get(name)
    if (known !== undefined) return known
    if (visiting.has(name)) throw new Error(`dependency cycle: ${[...trail, name].join(' -> ')}`)
    visiting.add(name)
    const internal = byName.get(name)!.dependencies.filter(dep => dep !== name && byName.has(dep))
    const value = internal.length ? 1 + Math.max(...internal.map(dep => depthOf(dep, [...trail, name]))) : 0
    visiting.delete(name)
    depth.set(name, value)
    return value
  }
  const layers: LayeredPackage[][] = []
  for (const pkg of [...packages].sort((a, b) => a.name.localeCompare(b.name)))
    (layers[depthOf(pkg.name, [])] ||= []).push(pkg)
  return layers.filter(Boolean)
}

/** Run `task` over `items`, at most `limit` at a time, in their order. */
export async function inBatches<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const at = next++
      results[at] = await task(items[at]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

async function publishOne(root: string, args: string[], pkg: LayeredPackage): Promise<{ pkg: LayeredPackage, ok: boolean, seconds: number }> {
  const started = performance.now()
  const child = Bun.spawn([join(root, '.github/scripts/publish-npm.sh'), ...args, pkg.dir], { cwd: root, stdout: 'pipe', stderr: 'pipe', env: process.env })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const seconds = Math.round((performance.now() - started) / 1000)
  // Printed whole when it finishes, so parallel packages don't interleave.
  console.log(`::group::${pkg.name} (${code === 0 ? 'ok' : `exit ${code}`}, ${seconds}s)`)
  process.stdout.write(stdout)
  if (stderr) process.stdout.write(stderr)
  console.log('::endgroup::')
  return { pkg, ok: code === 0, seconds }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const root = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
  const concurrency = Math.max(1, Number(process.env.PUBLISH_CONCURRENCY) || 8)
  const packages: LayeredPackage[] = []
  for (const found of await publishables(root)) {
    const manifest = await Bun.file(join(root, found.dir, 'package.json')).json()
    packages.push({ name: found.name, dir: found.dir, dependencies: Object.keys(manifest.dependencies ?? {}) })
  }
  const layers = publishLayers(packages)
  console.log(`${packages.length} packages in ${layers.length} layers, up to ${concurrency} at a time`)
  const started = performance.now()
  for (const [index, layer] of layers.entries()) {
    const layerStarted = performance.now()
    console.log(`Layer ${index + 1}/${layers.length}: ${layer.map(pkg => pkg.name).join(', ')}`)
    const results = await inBatches(layer, concurrency, pkg => publishOne(root, args, pkg))
    const failed = results.filter(result => !result.ok)
    console.log(`Layer ${index + 1} done in ${Math.round((performance.now() - layerStarted) / 1000)}s`)
    // The next layer depends on this one: nothing after a failure can install.
    if (failed.length) {
      for (const result of failed) console.log(`::error::${result.pkg.name} was not published`)
      process.exit(1)
    }
  }
  console.log(`All ${packages.length} packages published in ${Math.round((performance.now() - started) / 1000)}s`)
}

if (import.meta.main)
  await main()
