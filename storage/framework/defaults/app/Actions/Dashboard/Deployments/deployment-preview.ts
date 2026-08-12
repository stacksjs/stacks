import type { DeploymentPreview } from '@stacksjs/types'
import { join } from 'node:path'
import process from 'node:process'

const previewPrefix = 'STACKS_DEPLOY_PREVIEW_JSON='

export function parseDeploymentPreview(output: string): DeploymentPreview {
  const line = output.split(/\r?\n/).find(entry => entry.startsWith(previewPrefix))
  if (!line)
    throw new Error('Buddy did not return a deployment preview contract.')

  const plan = JSON.parse(line.slice(previewPrefix.length)) as DeploymentPreview
  if (plan.version !== 1 || plan.dryRun !== true || !Array.isArray(plan.operations) || !Array.isArray(plan.sites))
    throw new Error('Buddy returned an invalid deployment preview contract.')
  return plan
}

export async function runDeploymentPreview(args: string[], timeoutMs = 30_000): Promise<DeploymentPreview> {
  const child = Bun.spawn([join(process.cwd(), 'buddy'), ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdoutPromise = new Response(child.stdout).text()
  const stderrPromise = new Response(child.stderr).text()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const exitPromise = Promise.race([
    child.exited,
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        child.kill()
        reject(new Error(`Deployment preview timed out after ${timeoutMs}ms.`))
      }, timeoutMs)
    }),
  ])
  const [exitCode, stdout, stderr] = await Promise.all([exitPromise, stdoutPromise, stderrPromise])
    .finally(() => clearTimeout(timeout))
  if (exitCode !== 0)
    throw new Error(stderr.trim() || `buddy deploy preview exited with code ${exitCode}`)
  return parseDeploymentPreview(stdout)
}
