import { createHash } from 'node:crypto'
import { inspectReviewOsEvidence } from '../../storage/framework/core/actions/src/reviewos-evidence'

const commit = process.env.GITHUB_SHA ?? ''
if (process.env.GITHUB_REPOSITORY !== 'stacksjs/stacks' || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected the exact Stacks source commit')
const workflow = '.reviewos/workflows/release-evidence.yml'
const workflowDigest = createHash('sha256').update(Buffer.from(await Bun.file(new URL(`../../${workflow}`, import.meta.url)).arrayBuffer())).digest('hex')
const deadline = performance.now() + 80 * 60_000
while (true) {
  const result = await inspectReviewOsEvidence({
    origin: 'https://reviewos.org', owner: 'stacks', repository: 'stacks', commit, workflow, workflowDigest,
    job: 'macos', labels: ['self-hosted', 'macos-arm64', 'stacks-release'],
    steps: ['Verify native platform', 'Install committed dependencies', 'Build source packages', 'Verify release evidence', 'Stress immediate exit ordering'],
  })
  if (result.state === 'accepted') {
    console.log(`Accepted exact-source macOS arm64 execution: ${result.url}`)
    break
  }
  if (performance.now() >= deadline) throw new Error('ReviewOS macOS evidence did not finish; publication remains blocked')
  console.log(`Waiting for ReviewOS macOS arm64 execution of ${commit}`)
  await Bun.sleep(15_000)
}
