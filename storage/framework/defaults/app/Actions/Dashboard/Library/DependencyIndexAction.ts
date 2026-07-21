import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DependencyIndexAction',
  description: 'Returns dependency data for the dashboard.',
  method: 'GET',
  async handle() {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const projectRoot = process.cwd()

    const declared: Array<Record<string, unknown>> = []
    const transitive: Array<Record<string, unknown>> = []
    let workspaceCount = 0
    let thirdPartyCount = 0
    let transitiveCount = 0
    let totalCount = 0

    try {
      const declaredSet: Record<string, boolean> = {}
      const lockPath = join(projectRoot, 'bun.lock')
      const lockfile = Bun.JSONC.parse(readFileSync(lockPath, 'utf-8')) as {
        workspaces?: Record<string, { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }>
        packages?: Record<string, [string, ...unknown[]]>
      }
      const workspaces = lockfile.workspaces || {}

      for (const wsKey of Object.keys(workspaces)) {
        const ws = workspaces[wsKey]
        const allDeps = { ...ws.dependencies, ...ws.devDependencies }
        for (const depName of Object.keys(allDeps)) {
          if (declaredSet[depName]) continue
          declaredSet[depName] = true
          const version = allDeps[depName]
          const isWorkspace = version === 'workspace:*' || depName.startsWith('@stacksjs/')
          declared.push({ name: depName, version, isWorkspace, isScoped: depName.includes('/') })
        }
      }
      declared.sort((a, b) => String(a.name).localeCompare(String(b.name)))

      const transitiveSet = new Set<string>()
      for (const value of Object.values(lockfile.packages || {})) {
        const resolution = value[0]
        if (resolution.includes('@workspace:')) continue
        const versionSeparator = resolution.startsWith('@')
          ? resolution.indexOf('@', 1)
          : resolution.lastIndexOf('@')
        if (versionSeparator <= 0) continue
        const name = resolution.slice(0, versionSeparator)
        const version = resolution.slice(versionSeparator + 1)
        if (declaredSet[name] || transitiveSet.has(name)) continue
        transitiveSet.add(name)
        transitive.push({ name, version, isScoped: name.includes('/') })
      }
      transitive.sort((a, b) => String(a.name).localeCompare(String(b.name)))

      workspaceCount = declared.filter(p => p.isWorkspace).length
      thirdPartyCount = declared.length - workspaceCount
      transitiveCount = transitive.length
      totalCount = declared.length + transitiveCount
    }
    catch {
      // bun.lock may not exist yet
    }

    const thirdParty = declared.filter(p => !p.isWorkspace)
    const workspace = declared.filter(p => p.isWorkspace)

    const stats = [
      { label: 'Declared', value: String(declared.length) },
      { label: 'Third-Party', value: String(thirdPartyCount) },
      { label: 'Workspace', value: String(workspaceCount) },
      { label: 'Transitive', value: String(transitiveCount) },
    ]

    return { declared, thirdParty, workspace, transitive, stats, totalCount, transitiveCount, workspaceCount, thirdPartyCount }
  },
})
