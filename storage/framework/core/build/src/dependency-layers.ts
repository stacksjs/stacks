export interface DependencyPackage {
  name: string
  dependencies: readonly string[]
}

/** Stable layers of selected packages, each after its declared dependencies. */
export function dependencyLayers<T extends DependencyPackage>(packages: readonly T[]): T[][] {
  const byName = new Map<string, T>()
  for (const pkg of packages) {
    if (byName.has(pkg.name)) throw new Error(`duplicate package name: ${pkg.name}`)
    byName.set(pkg.name, pkg)
  }
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
  const layers: T[][] = []
  for (const pkg of [...packages].sort((a, b) => a.name.localeCompare(b.name)))
    (layers[depthOf(pkg.name, [])] ||= []).push(pkg)
  return layers.filter(Boolean)
}
