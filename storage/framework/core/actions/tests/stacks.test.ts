import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const { installStack, uninstallStack, listStacks } = await import('../src/stacks')
const p = await import('@stacksjs/path')

const pantryDir = p.projectPath('pantry')

// Track everything we create for cleanup
const createdPaths: string[] = []

function createTestStack(name: string, stackName: string, files: Record<string, string> = {}): string {
  const stackDir = join(pantryDir, name)
  mkdirSync(stackDir, { recursive: true })
  createdPaths.push(stackDir)

  writeFileSync(join(stackDir, 'package.json'), JSON.stringify({
    name,
    version: '1.0.0',
    stacks: {
      name: stackName,
      description: `Test ${stackName} stack`,
    },
  }, null, 2))

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(stackDir, filePath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content)
  }

  return stackDir
}

function trackProjectFile(relPath: string): void {
  createdPaths.push(p.projectPath(relPath))
}

function createExistingProjectFile(relPath: string, content: string): void {
  const fullPath = p.projectPath(relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
  createdPaths.push(fullPath)
}

function cleanup() {
  // Remove created files/dirs in reverse order
  for (const path of createdPaths.reverse()) {
    try {
      if (existsSync(path)) {
        const stat = require('node:fs').statSync(path)
        if (stat.isDirectory())
          rmSync(path, { recursive: true, force: true })
        else
          rmSync(path)
      }
    }
    catch {}
  }
  createdPaths.length = 0

  // Clean up lock file
  try {
    const lockPath = p.stacksLockPath()
    if (existsSync(lockPath)) rmSync(lockPath)
  }
  catch {}

  // Clean up backup dir
  try {
    const backupDir = p.stacksBackupPath()
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true })
  }
  catch {}
}

afterEach(cleanup)

describe('Stack Extensions', () => {
  describe('installStack', () => {
    it('should return null when stack is not found in pantry', async () => {
      const result = await installStack({ name: 'nonexistent-test-stack-xyz' })
      expect(result).toBeNull()
    })

    it('should install a stack and copy files to project', async () => {
      createTestStack('__test-blog-stack', 'testblog', {
        'config/__test-blog.ts': 'export default { enabled: true }',
      })

      const result = await installStack({ name: '__test-blog-stack' })

      expect(result).not.toBeNull()
      expect(result!.name).toBe('testblog')
      expect(result!.packageName).toBe('__test-blog-stack')
      expect(result!.version).toBe('1.0.0')
      expect(result!.files).toContain('config/__test-blog.ts')
      expect(result!.files.length).toBe(1)
      expect(result!.skipped.length).toBe(0)

      // Verify file was actually copied
      const dest = p.projectPath('config/__test-blog.ts')
      expect(existsSync(dest)).toBe(true)
      trackProjectFile('config/__test-blog.ts')

      const content = readFileSync(dest, 'utf-8')
      expect(content).toBe('export default { enabled: true }')
    })

    it('should create a lock file after install', async () => {
      createTestStack('__test-lock-stack', 'testlock', {
        'config/__test-lock.ts': 'export default {}',
      })

      await installStack({ name: '__test-lock-stack' })
      trackProjectFile('config/__test-lock.ts')

      const lockPath = p.stacksLockPath()
      expect(existsSync(lockPath)).toBe(true)

      const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
      expect(lock.version).toBe(1)
      expect(lock.stacks['__test-lock-stack']).toBeDefined()
      expect(lock.stacks['__test-lock-stack'].name).toBe('testlock')
      expect(lock.stacks['__test-lock-stack'].files).toContain('config/__test-lock.ts')
    })

    it('should skip existing files with default conflict strategy', async () => {
      // Create existing file first
      createExistingProjectFile('config/__test-existing.ts', 'export default { user: true }')

      createTestStack('__test-conflict-stack', 'testconflict', {
        'config/__test-existing.ts': 'export default { stack: true }',
        'config/__test-new.ts': 'export default { new: true }',
      })

      const result = await installStack({ name: '__test-conflict-stack' })

      expect(result).not.toBeNull()
      expect(result!.skipped).toContain('config/__test-existing.ts')
      expect(result!.files).toContain('config/__test-new.ts')
      expect(result!.files).not.toContain('config/__test-existing.ts')
      expect(result!.conflictStrategy).toBe('skip')

      // Verify original file was NOT overwritten
      const content = readFileSync(p.projectPath('config/__test-existing.ts'), 'utf-8')
      expect(content).toBe('export default { user: true }')

      trackProjectFile('config/__test-new.ts')
    })

    it('should overwrite files when force is true', async () => {
      createExistingProjectFile('config/__test-overwrite.ts', 'export default { original: true }')

      createTestStack('__test-force-stack', 'testforce', {
        'config/__test-overwrite.ts': 'export default { fromStack: true }',
      })

      const result = await installStack({ name: '__test-force-stack', force: true })

      expect(result).not.toBeNull()
      expect(result!.files).toContain('config/__test-overwrite.ts')
      expect(result!.skipped.length).toBe(0)

      const content = readFileSync(p.projectPath('config/__test-overwrite.ts'), 'utf-8')
      expect(content).toBe('export default { fromStack: true }')
    })

    it('should backup files with backup conflict strategy', async () => {
      createExistingProjectFile('config/__test-backup.ts', 'export default { original: true }')

      createTestStack('__test-backup-stack', 'testbackup', {
        'config/__test-backup.ts': 'export default { fromStack: true }',
      })

      const result = await installStack({
        name: '__test-backup-stack',
        conflict: 'backup',
      })

      expect(result).not.toBeNull()
      expect(result!.files).toContain('config/__test-backup.ts')

      // Verify backup was created
      const backupPath = join(p.stacksBackupPath('testbackup'), 'config/__test-backup.ts')
      expect(existsSync(backupPath)).toBe(true)
      const backupContent = readFileSync(backupPath, 'utf-8')
      expect(backupContent).toBe('export default { original: true }')

      // Verify the project file has the stack version
      const content = readFileSync(p.projectPath('config/__test-backup.ts'), 'utf-8')
      expect(content).toBe('export default { fromStack: true }')
    })

    it('should handle dry run without making changes', async () => {
      createTestStack('__test-dry-stack', 'testdry', {
        'config/__test-dry.ts': 'export default {}',
      })

      const result = await installStack({ name: '__test-dry-stack', dryRun: true })

      expect(result).toBeNull()
      expect(existsSync(p.projectPath('config/__test-dry.ts'))).toBe(false)
      expect(existsSync(p.stacksLockPath())).toBe(false)
    })

    it('should not reinstall already installed stack without force', async () => {
      createTestStack('__test-double-stack', 'testdouble', {
        'config/__test-double.ts': 'export default {}',
      })

      const first = await installStack({ name: '__test-double-stack' })
      expect(first).not.toBeNull()
      trackProjectFile('config/__test-double.ts')

      // Second install should return existing entry without error
      const second = await installStack({ name: '__test-double-stack' })
      expect(second).not.toBeNull()
      expect(second!.name).toBe('testdouble')
    })

    it('should handle nested directory structures', async () => {
      createTestStack('__test-nested-stack', 'testnested', {
        'resources/views/__test-blog/index.stx': '<div>Blog</div>',
        'resources/views/__test-blog/post.stx': '<div>Post</div>',
        'resources/components/__TestCard.vue': '<template>Card</template>',
      })

      const result = await installStack({ name: '__test-nested-stack' })

      expect(result).not.toBeNull()
      expect(result!.files.length).toBe(3)
      expect(existsSync(p.projectPath('resources/views/__test-blog/index.stx'))).toBe(true)
      expect(existsSync(p.projectPath('resources/views/__test-blog/post.stx'))).toBe(true)
      expect(existsSync(p.projectPath('resources/components/__TestCard.vue'))).toBe(true)

      trackProjectFile('resources/views/__test-blog/index.stx')
      trackProjectFile('resources/views/__test-blog/post.stx')
      trackProjectFile('resources/components/__TestCard.vue')
      // Also track the parent dir we created
      createdPaths.push(p.projectPath('resources/views/__test-blog'))
    })

    it('should resolve stack by stacks.name field', async () => {
      createTestStack('__test-random-pkg', 'testbyname', {
        'config/__test-byname.ts': 'export default {}',
      })

      const result = await installStack({ name: 'testbyname' })

      expect(result).not.toBeNull()
      expect(result!.name).toBe('testbyname')
      trackProjectFile('config/__test-byname.ts')
    })

    it('should handle scoped package names', async () => {
      const scopedDir = join(pantryDir, '@__test-scope', 'blog')
      mkdirSync(scopedDir, { recursive: true })
      createdPaths.push(join(pantryDir, '@__test-scope'))

      writeFileSync(join(scopedDir, 'package.json'), JSON.stringify({
        name: '@__test-scope/blog',
        version: '2.0.0',
        stacks: { name: 'testscoped', description: 'Scoped stack' },
      }))
      mkdirSync(join(scopedDir, 'config'), { recursive: true })
      writeFileSync(join(scopedDir, 'config/__test-scoped.ts'), 'export default { scoped: true }')

      const result = await installStack({ name: '@__test-scope/blog' })

      expect(result).not.toBeNull()
      expect(result!.name).toBe('testscoped')
      expect(result!.version).toBe('2.0.0')
      trackProjectFile('config/__test-scoped.ts')
    })

    it('should return null for package without stacks field', async () => {
      const pkgDir = join(pantryDir, '__test-no-stacks')
      mkdirSync(pkgDir, { recursive: true })
      createdPaths.push(pkgDir)
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
        name: '__test-no-stacks',
        version: '1.0.0',
      }))

      const result = await installStack({ name: '__test-no-stacks' })
      expect(result).toBeNull()
    })

    it('should return null when stack has no files in known directories', async () => {
      createTestStack('__test-empty-stack', 'testempty', {})

      const result = await installStack({ name: '__test-empty-stack' })
      expect(result).toBeNull()
    })
  })

  describe('uninstallStack', () => {
    it('should return false when stack is not installed', async () => {
      const result = await uninstallStack({ name: 'never-installed-xyz' })
      expect(result).toBe(false)
    })

    it('should remove installed files and update lock file', async () => {
      createTestStack('__test-uninstall-stack', 'testuninstall', {
        'config/__test-uninstall.ts': 'export default {}',
      })

      await installStack({ name: '__test-uninstall-stack' })
      expect(existsSync(p.projectPath('config/__test-uninstall.ts'))).toBe(true)

      const result = await uninstallStack({ name: 'testuninstall' })
      expect(result).toBe(true)

      expect(existsSync(p.projectPath('config/__test-uninstall.ts'))).toBe(false)

      const lock = JSON.parse(readFileSync(p.stacksLockPath(), 'utf-8'))
      expect(lock.stacks['__test-uninstall-stack']).toBeUndefined()
    })

    it('should skip user-modified files without force', async () => {
      createTestStack('__test-modified-stack', 'testmodified', {
        'config/__test-modified.ts': 'export default { original: true }',
      })

      await installStack({ name: '__test-modified-stack' })

      // Modify the installed file
      writeFileSync(p.projectPath('config/__test-modified.ts'), 'export default { userChanged: true }')

      const result = await uninstallStack({ name: 'testmodified' })
      expect(result).toBe(true)

      // Modified file should still exist
      expect(existsSync(p.projectPath('config/__test-modified.ts'))).toBe(true)
      const content = readFileSync(p.projectPath('config/__test-modified.ts'), 'utf-8')
      expect(content).toBe('export default { userChanged: true }')

      trackProjectFile('config/__test-modified.ts')
    })

    it('should remove user-modified files with force', async () => {
      createTestStack('__test-force-rm-stack', 'testforcerm', {
        'config/__test-force-rm.ts': 'export default { original: true }',
      })

      await installStack({ name: '__test-force-rm-stack' })
      writeFileSync(p.projectPath('config/__test-force-rm.ts'), 'export default { modified: true }')

      const result = await uninstallStack({ name: 'testforcerm', force: true })
      expect(result).toBe(true)
      expect(existsSync(p.projectPath('config/__test-force-rm.ts'))).toBe(false)
    })

    it('should restore backups on uninstall', async () => {
      createExistingProjectFile('config/__test-restore.ts', 'export default { myOriginal: true }')

      createTestStack('__test-restore-stack', 'testrestore', {
        'config/__test-restore.ts': 'export default { fromStack: true }',
      })

      // Install with backup
      await installStack({ name: '__test-restore-stack', conflict: 'backup' })

      // Verify stack version is in place
      let content = readFileSync(p.projectPath('config/__test-restore.ts'), 'utf-8')
      expect(content).toBe('export default { fromStack: true }')

      // Uninstall should restore original
      const result = await uninstallStack({ name: 'testrestore', force: true })
      expect(result).toBe(true)

      expect(existsSync(p.projectPath('config/__test-restore.ts'))).toBe(true)
      content = readFileSync(p.projectPath('config/__test-restore.ts'), 'utf-8')
      expect(content).toBe('export default { myOriginal: true }')
    })

    it('should find stack by package name', async () => {
      createTestStack('__test-pkg-name-stack', 'testpkgname', {
        'config/__test-pkg-name.ts': 'export default {}',
      })

      await installStack({ name: '__test-pkg-name-stack' })

      const result = await uninstallStack({ name: '__test-pkg-name-stack' })
      expect(result).toBe(true)
    })

    it('should handle already-removed files gracefully', async () => {
      createTestStack('__test-already-gone', 'testalreadygone', {
        'config/__test-gone.ts': 'export default {}',
      })

      await installStack({ name: '__test-already-gone' })
      rmSync(p.projectPath('config/__test-gone.ts'))

      const result = await uninstallStack({ name: 'testalreadygone' })
      expect(result).toBe(true)
    })
  })

  describe('listStacks', () => {
    it('should return an array', async () => {
      const entries = await listStacks()
      expect(Array.isArray(entries)).toBe(true)
    })

    it('should list installed stacks', async () => {
      createTestStack('__test-list-stack', 'testlist', {
        'config/__test-list.ts': 'export default {}',
      })

      await installStack({ name: '__test-list-stack' })
      trackProjectFile('config/__test-list.ts')

      const entries = await listStacks()
      const found = entries.find(e => e.name === 'testlist')

      expect(found).toBeDefined()
      expect(found!.installed).toBe(true)
      expect(found!.packageName).toBe('__test-list-stack')
      expect(found!.version).toBe('1.0.0')
      expect(found!.fileCount).toBe(1)
    })

    it('should list available but not installed stacks', async () => {
      createTestStack('__test-avail-stack', 'testavail', {
        'config/__test-avail.ts': 'export default {}',
      })

      const entries = await listStacks()
      const found = entries.find(e => e.name === 'testavail')

      expect(found).toBeDefined()
      expect(found!.installed).toBe(false)
      expect(found!.description).toBe('Test testavail stack')
    })
  })

  describe('lock file', () => {
    it('should create lock file with correct structure', async () => {
      createTestStack('__test-lockfile-stack', 'testlockfile', {
        'config/__test-lockfile.ts': 'export default {}',
      })

      await installStack({ name: '__test-lockfile-stack' })
      trackProjectFile('config/__test-lockfile.ts')

      const lockPath = p.stacksLockPath()
      expect(existsSync(lockPath)).toBe(true)

      const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
      expect(lock.version).toBe(1)
      expect(typeof lock.generatedAt).toBe('string')

      const entry = lock.stacks['__test-lockfile-stack']
      expect(entry.packageName).toBe('__test-lockfile-stack')
      expect(entry.name).toBe('testlockfile')
      expect(entry.version).toBe('1.0.0')
      expect(typeof entry.installedAt).toBe('string')
      expect(Array.isArray(entry.files)).toBe(true)
      expect(Array.isArray(entry.skipped)).toBe(true)
      expect(entry.conflictStrategy).toBe('skip')
    })

    it('should support multiple stacks in lock file', async () => {
      createTestStack('__test-multi-a', 'testmultia', {
        'config/__test-multi-a.ts': 'export default { a: true }',
      })
      createTestStack('__test-multi-b', 'testmultib', {
        'config/__test-multi-b.ts': 'export default { b: true }',
      })

      await installStack({ name: '__test-multi-a' })
      await installStack({ name: '__test-multi-b' })

      trackProjectFile('config/__test-multi-a.ts')
      trackProjectFile('config/__test-multi-b.ts')

      const lock = JSON.parse(readFileSync(p.stacksLockPath(), 'utf-8'))
      expect(lock.stacks['__test-multi-a']).toBeDefined()
      expect(lock.stacks['__test-multi-b']).toBeDefined()
      expect(lock.stacks['__test-multi-a'].name).toBe('testmultia')
      expect(lock.stacks['__test-multi-b'].name).toBe('testmultib')
    })

    it('should remove entry from lock file on uninstall', async () => {
      createTestStack('__test-lock-rm', 'testlockrm', {
        'config/__test-lock-rm.ts': 'export default {}',
      })

      await installStack({ name: '__test-lock-rm' })

      let lock = JSON.parse(readFileSync(p.stacksLockPath(), 'utf-8'))
      expect(lock.stacks['__test-lock-rm']).toBeDefined()

      await uninstallStack({ name: 'testlockrm', force: true })

      lock = JSON.parse(readFileSync(p.stacksLockPath(), 'utf-8'))
      expect(lock.stacks['__test-lock-rm']).toBeUndefined()
    })
  })

  describe('conflict strategies', () => {
    it('should record conflict strategy in manifest', async () => {
      createTestStack('__test-strategy', 'teststrategy', {
        'config/__test-strategy.ts': 'export default {}',
      })

      const result = await installStack({
        name: '__test-strategy',
        conflict: 'backup',
      })

      trackProjectFile('config/__test-strategy.ts')

      expect(result).not.toBeNull()
      expect(result!.conflictStrategy).toBe('backup')
    })

    it('should use overwrite when force is set regardless of conflict option', async () => {
      createExistingProjectFile('config/__test-force-ow.ts', 'original')

      createTestStack('__test-force-conflict', 'testforceconflict', {
        'config/__test-force-ow.ts': 'from stack',
      })

      const result = await installStack({
        name: '__test-force-conflict',
        force: true,
        conflict: 'skip',
      })

      expect(result).not.toBeNull()
      expect(result!.conflictStrategy).toBe('overwrite')
      expect(result!.files).toContain('config/__test-force-ow.ts')

      const content = readFileSync(p.projectPath('config/__test-force-ow.ts'), 'utf-8')
      expect(content).toBe('from stack')
    })
  })
})
