import { lstatSync, readdirSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { path as p } from '@stacksjs/path'

/** All parent directories must be owned paths, never symlink aliases. */
function ownedDirectory(root: string, directory: string): boolean {
  const path = relative(root, directory)
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) return false
  let current = root
  for (const part of path.split(sep).filter(Boolean)) {
    current = join(current, part)
    try {
      const stat = lstatSync(current)
      if (!stat.isDirectory() || stat.isSymbolicLink()) return false
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }
  return true
}

/** Remove generated artifacts with native filesystem operations, bounded to this project. */
export async function cleanProject(): Promise<void> {
  const root = p.projectPath()
  const remove = (path: string) => {
    if (ownedDirectory(root, dirname(path))) rmSync(path, { recursive: true, force: true })
  }
  for (const path of [p.projectPath('bun.lock'), p.projectPath('yarn.lock'), p.projectPath('node_modules'),
    p.frameworkCloudPath('cdk.out'), p.frameworkCloudPath('cdk.context.json'), p.cloudPath('dist.zip')]) remove(path)

  const walk = (directory: string): void => {
    if (!ownedDirectory(root, directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.name === 'dist' || entry.name === 'node_modules') remove(path)
      else if (entry.isDirectory() && !entry.isSymbolicLink()) walk(path)
    }
  }
  walk(p.frameworkPath())
}
