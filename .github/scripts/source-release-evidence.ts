import { resolve } from 'node:path'
import { subpathBuildTargets } from './subpath-packages'

/** One source contract shared by GitHub's Linux/Windows and ReviewOS's Mac. */
export const releaseEvidenceTests = [
  'actions/tests/release-evidence.test.ts', 'buddy/tests/release-evidence.test.ts',
  'actions/tests/reviewos-evidence.test.ts',
  'actions/tests/publication-preflight.test.ts', 'actions/tests/publication-entrypoints.test.ts',
  'buddy/tests/publication-entrypoints.test.ts', 'actions/tests/project-scripts.test.ts',
  'testing/tests/process-tree.test.ts', 'testing/tests/owned-artifacts.test.ts',
  'testing/tests/schema-package.test.ts', 'testing/tests/isolated.test.ts', 'testing/tests/service.test.ts',
].map(path => `./storage/framework/core/${path}`)

if (import.meta.main) {
  const root = resolve(import.meta.dir, '../..')
  async function run(args: string[], cwd = root): Promise<void> {
    console.log(`::group::${args.join(' ')}`)
    const child = Bun.spawn(args, { cwd, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' })
    const code = await child.exited
    if (code !== 0) throw new Error(`Source evidence command exited ${code}: ${args.join(' ')}`)
    console.log('::endgroup::')
  }
  switch (process.argv[2]) {
    case 'build':
      for (const name of subpathBuildTargets()) await run([process.execPath, 'run', 'build'], resolve(root, 'storage/framework/core', name))
      break
    case 'test': await run([process.execPath, 'test', ...releaseEvidenceTests]); break
    case 'stress': await run([process.execPath, 'test', './storage/framework/core/testing/tests/process-tree.test.ts', '--test-name-pattern', 'service-early-exit', '--rerun-each=20']); break
    default: throw new Error('Pass build, test or stress')
  }
}
