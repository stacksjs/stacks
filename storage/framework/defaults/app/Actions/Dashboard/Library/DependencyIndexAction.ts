import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DependencyIndexAction',
  description: 'Returns dependency data for the dashboard.',
  method: 'GET',
  async handle() {
    const { readFileSync, readdirSync } = await import('node:fs')
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
      const lockPath = join(projectRoot, 'pantry.lock')
      const lockfile = JSON.parse(readFileSync(lockPath, 'utf-8'))
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

      // Scan pantry directory for transitive deps
      const pantryDir = join(projectRoot, 'pantry')
      const entries = readdirSync(pantryDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('@')) {
          const scopeDir = join(pantryDir, entry.name)
          try {
            const scopedEntries = readdirSync(scopeDir, { withFileTypes: true })
            for (const se of scopedEntries) {
              if (!se.isDirectory()) continue
              const pkgName = `${entry.name}/${se.name}`
              if (!declaredSet[pkgName]) {
                let ver = '0.0.0'
                try { ver = JSON.parse(readFileSync(join(scopeDir, se.name, 'package.json'), 'utf-8')).version || '0.0.0' }
                catch { /* ignore */ }
                transitive.push({ name: pkgName, version: ver, isScoped: true })
              }
            }
          }
          catch { /* ignore */ }
        }
        else if (entry.name !== '.bin' && entry.name !== 'node_modules') {
          if (!declaredSet[entry.name]) {
            let ver = '0.0.0'
            try { ver = JSON.parse(readFileSync(join(pantryDir, entry.name, 'package.json'), 'utf-8')).version || '0.0.0' }
            catch { /* ignore */ }
            transitive.push({ name: entry.name, version: ver, isScoped: false })
          }
        }
      }
      transitive.sort((a, b) => String(a.name).localeCompare(String(b.name)))

      workspaceCount = declared.filter(p => p.isWorkspace).length
      thirdPartyCount = declared.length - workspaceCount
      transitiveCount = transitive.length
      totalCount = declared.length + transitiveCount
    }
    catch {
      // pantry.lock or pantry/ may not exist
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
