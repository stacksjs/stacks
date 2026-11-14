import type { CLI } from '@stacksjs/types'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

interface LibraryPhaseOptions { directory?: string, dryRun?: boolean, output?: string, tag?: string, runId?: string, historical?: boolean }
async function output(values: Record<string, string | boolean>): Promise<void> {
  console.log(JSON.stringify(values))
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(values)) {
      if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(String(value))) throw new Error('Invalid workflow output')
      await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
    }
  }
}
async function save(path: string | undefined, value: unknown): Promise<void> {
  if (!path) { console.log(JSON.stringify(value, null, 2)); return }
  await mkdir(dirname(resolve(path)), { recursive: true })
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`)
}
/** CI/resume phases of normal release; all work stays in native lifecycle APIs. */
export function releaseLibrary(buddy: CLI): void {
  const command = (name: string, description: string) => buddy.command(name, description)
    .option('--directory <path>', 'Retained native library candidate directory')
  command('release:prepare', 'Build, check and retain the exact source library candidate for normal CI')
    .option('--dry-run', 'Validate the real library plan without writing files', { default: false })
    .action(async (options: LibraryPhaseOptions) => {
      const { prepareNativeLibraryRelease, LIBRARY_CANDIDATE_DIRECTORY } = await import('@stacksjs/actions/library/release-lifecycle')
      const result = await prepareNativeLibraryRelease({ cwd: process.cwd(), directory: resolve(options.directory ?? LIBRARY_CANDIDATE_DIRECTORY), dryRun: options.dryRun,
        runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME })
      await output({ prepared: result.prepared, source_eligible: result.prepared && result.sourceEligible })
    })
  command('release:accept', 'Accept exact successful source CI and download its original library candidate')
    .option('--tag <tag>', 'Actual release tag (defaults to GITHUB_REF_NAME)')
    .option('--run-id <id>', 'Exact source CI run for a historical readback or retry')
    .option('--historical', 'Read-only acquisition using current source policy, independent of current public package definitions', { default: false })
    .action(async (options: LibraryPhaseOptions) => {
      const { acceptNativeLibraryRelease, LIBRARY_CANDIDATE_DIRECTORY } = await import('@stacksjs/actions/library/release-lifecycle')
      const receipt = await acceptNativeLibraryRelease({ cwd: process.cwd(), directory: resolve(options.directory ?? LIBRARY_CANDIDATE_DIRECTORY), tag: options.tag ?? process.env.GITHUB_REF_NAME ?? '',
        token: process.env.GITHUB_TOKEN, historical: options.historical, runId: options.runId === undefined ? undefined : Number(options.runId) })
      await output({ accepted: !!receipt, ...(receipt ? { source_sha: receipt.source.commit, artifact_id: String(receipt.artifact.id) } : {}) })
    })
  command('release:publish', 'Publish only accepted original archives and verify actual registry bytes and tags')
    .option('--dry-run', 'Validate retained publisher input without uploading', { default: false })
    .action(async (options: LibraryPhaseOptions) => {
      const { publishNativeLibraryRelease, LIBRARY_CANDIDATE_DIRECTORY } = await import('@stacksjs/actions/library/release-lifecycle')
      await save(undefined, await publishNativeLibraryRelease({ cwd: process.cwd(), directory: resolve(options.directory ?? LIBRARY_CANDIDATE_DIRECTORY), token: process.env.GITHUB_TOKEN, dryRun: options.dryRun }))
    })
  command('release:readback', 'Verify retained historical library bytes using only the current verifier')
    .option('--output <path>', 'Save the read-only registry verification receipt')
    .action(async (options: LibraryPhaseOptions) => {
      const { readbackNativeLibraryRelease, LIBRARY_CANDIDATE_DIRECTORY } = await import('@stacksjs/actions/library/release-lifecycle')
      await save(options.output, await readbackNativeLibraryRelease({ cwd: process.cwd(), directory: resolve(options.directory ?? LIBRARY_CANDIDATE_DIRECTORY), token: process.env.GITHUB_TOKEN }))
    })
}
