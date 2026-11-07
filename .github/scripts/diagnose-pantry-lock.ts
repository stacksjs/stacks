import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/** A failed frozen check remains failed. This only retains the normal installer's candidate. */
export async function diagnosePantryLock(root: string, command: string[] = ['pantry']): Promise<number> {
  const lockPath = join(root, 'pantry.lock')
  const original = await readFile(lockPath)
  const output = join(root, 'artifacts', 'pantry-lock-diagnostic')
  await mkdir(output, { recursive: true })
  await writeFile(join(output, 'committed.lock'), original)
  try {
    const child = Bun.spawn([...command, 'install', '--ignore-scripts', '--quiet'], {
      cwd: root,
      stdout: Bun.file(join(output, 'regeneration.stdout.log')),
      stderr: Bun.file(join(output, 'regeneration.stderr.log')),
    })
    const exitCode = await child.exited
    await writeFile(join(output, 'candidate.lock'), await readFile(lockPath))
    await writeFile(join(output, 'result.json'), `${JSON.stringify({ exitCode, platform: process.platform, arch: process.arch }, null, 2)}\n`)
    return exitCode
  }
  finally {
    // Diagnostic regeneration must never change the failed build's inputs.
    await writeFile(lockPath, original)
  }
}

if (import.meta.main)
  process.exitCode = await diagnosePantryLock(resolve(import.meta.dir, '../..'))
