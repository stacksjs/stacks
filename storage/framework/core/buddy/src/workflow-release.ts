import type { WorkflowConfig } from '@stacksjs/types'
import { evaluateReviewOsEvidence } from '@stacksjs/actions/reviewos-evidence'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bumpedVersion, nextBuildTag, pushIosReleaseTag } from './release-ios'
import { projectWorkflowClient } from './workflow-client'
import { workflowReleaseIdentity } from './workflow-project'
import { renderReviewOsWorkflow } from './workflow-template'

type Client = ReturnType<typeof projectWorkflowClient>

function projectWorkflowEvidence(root: string, config: WorkflowConfig, upload: boolean) {
  const path = '.reviewos/workflows/ci.yml'
  const source = readFileSync(join(root, path), 'utf8')
  if (source !== renderReviewOsWorkflow(config)) throw new Error('The committed workflow differs from config/workflows.ts. Run buddy workflow:setup and qualify that source first')
  if ((config.branch ?? 'main') !== 'main') throw new Error('Native releases require the main branch')
  const workflow = Bun.YAML.parse(source) as { jobs: Record<string, { 'runs-on': string[], steps: Array<{ name: string, run?: string, uses?: string, if?: string }> }> }
  const [owner, repository] = config.repository.split('/') as [string, string]
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const digest = createHash('sha256').update(source).digest('hex')
  const jobs = Object.entries(workflow.jobs).map(([job, definition]) => {
    const steps = definition.steps.filter(step => !step.if || step.if === 'always()' || upload).map(step => step.name)
    return { origin: config.origin, owner, repository, commit, workflow: path, workflowDigest: digest, job, labels: definition['runs-on'], steps }
  })
  return {
    commit,
    evaluate(run: unknown): 'pending' | 'accepted' {
      for (const job of jobs) {
        if (evaluateReviewOsEvidence(job, { workflow_run: run }).state === 'pending') return 'pending'
      }
      return 'accepted'
    },
  }
}

/** Every configured job must have executed its real acceptance steps. */
export function evaluateProjectWorkflow(root: string, config: WorkflowConfig, run: unknown, upload = false): 'pending' | 'accepted' {
  return projectWorkflowEvidence(root, config, upload).evaluate(run)
}

/** Allocate from both the committed number and all immutable build tags. */
export function nextWorkflowRelease(root: string, config: WorkflowConfig, bump?: string): { version: string, build: number, tag: string } {
  if (!config.release || !config.native) throw new Error('Configure a native workflow and its release manifest first')
  const current = workflowReleaseIdentity(root, config.release)
  const version = bump ? bumpedVersion(current.version, bump) : current.version
  const tags = execFileSync('git', ['tag', '--list', 'v*-build.*'], { cwd: root, encoding: 'utf8' }).trim().split('\n')
  // Build numbers remain monotonic when the marketing version changes too.
  const numbers = tags.map(tag => /^v\d+\.\d+\.\d+-build\.(\d+)$/.exec(tag)?.[1]).filter(Boolean).map(Number)
  tags.push(`v${version}-build.${Math.max(current.build, ...numbers)}`)
  const tag = nextBuildTag(version, tags)
  return { version, build: Number(tag.split('-build.')[1]), tag }
}

export async function requireQualifiedWorkflow(root: string, config: WorkflowConfig, client: Client = projectWorkflowClient(config)): Promise<number> {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const runs = await client.runs('ci.yml', { branch: 'main', sha })
  const newest = runs.sort((a, b) => b.number - a.number)[0]
  if (!newest) throw new Error('This exact main source has no workflow acceptance yet. Run buddy workflow:run and wait before releasing')
  if (evaluateProjectWorkflow(root, config, await client.run(newest.number)) !== 'accepted') throw new Error(`Workflow ${newest.number} is still pending. No release number has been consumed`)
  return newest.number
}

/** Commit only reviewed metadata and notes; push the commit and tag atomically. */
export function commitWorkflowRelease(root: string, config: WorkflowConfig, identity: { version: string, build: number, tag: string }, notes: string[]): void {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  if (git('branch', '--show-current') !== 'main') throw new Error('Release from main')
  const changed = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean)
  if (changed.some(file => !notes.includes(file))) throw new Error('Only the reviewed release notes may have changed since preflight')
  if (!config.release) throw new Error('Configure the release manifest')
  const file = join(root, config.release.versionFile)
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest[config.release.versionField ?? 'version'] = identity.version
  manifest[config.release.buildField ?? 'build'] = identity.build
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  const paths = [config.release.versionFile, ...notes]
  const packageFile = join(root, 'package.json')
  if (config.release.packageVersion !== false && existsSync(packageFile) && config.release.versionFile !== 'package.json') {
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
    pkg.version = config.release.packageVersion === 'version' ? identity.version : `${identity.version}-build.${identity.build}`
    writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`)
    paths.push('package.json')
  }
  git('add', '--', ...paths)
  git('commit', '-m', `chore(release): ${identity.tag}`)
  pushIosReleaseTag(root, identity.tag)
}

/** Await the exact committed release; retrying delivery never uploads again. */
export async function waitForWorkflowRelease(root: string, config: WorkflowConfig, minutes: number, client: Client = projectWorkflowClient(config)): Promise<number> {
  const deadline = Date.now() + minutes * 60000
  const evidence = projectWorkflowEvidence(root, config, true)
  do {
    const runs = await client.runs('ci.yml', { branch: 'main', sha: evidence.commit })
    const newest = runs.sort((a, b) => b.number - a.number)[0]
    if (newest && evidence.evaluate(await client.run(newest.number)) === 'accepted') return newest.number
    if (Date.now() >= deadline) break
    await Bun.sleep(Math.min(10000, deadline - Date.now()))
  } while (Date.now() <= deadline)
  throw new Error('Release delivery is still pending. Inspect buddy workflow:runs and workflow:show. Resume tester delivery with buddy release:testflight; do not create another upload')
}
