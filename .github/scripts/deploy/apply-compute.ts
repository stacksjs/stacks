import type { ApplyComputeChangesOptions, CloudConfig, CloudDriver, ComputeChangePlan, EnvironmentType } from '@stacksjs/ts-cloud'
import { appendFileSync } from 'node:fs'

/** The scheduled resize uses the owner's declaration and the SDK's recovery checks. */
export async function applyConfiguredCompute(
  driver: Pick<CloudDriver, 'applyComputeChanges'>,
  config: CloudConfig,
  environment: EnvironmentType,
  dryRun: boolean,
): Promise<{ state: 'waiting' | 'ready' | 'done', plan: ComputeChangePlan }> {
  if (!driver.applyComputeChanges) throw new Error('Configured provider cannot apply compute changes')
  const apply = driver.applyComputeChanges.bind(driver)
  const options: ApplyComputeChangesOptions = { config, environment }
  const plan = await apply({ ...options, dryRun: true })
  if (plan.waitingForCapacity) return { state: 'waiting', plan }
  if (!plan.changes.some(change => change.action === 'resize')) return { state: 'done', plan }
  if (dryRun) return { state: 'ready', plan }
  await apply(options)
  const verified = await apply({ ...options, dryRun: true })
  if (verified.waitingForCapacity || verified.changes.some(change => change.action === 'resize'))
    throw new Error('The configured server resize is still pending after apply')
  return { state: 'done', plan: verified }
}

if (import.meta.main) {
  const { createCloudDriver } = await import('@stacksjs/ts-cloud')
  const { tsCloud } = await import('../../../config/cloud')
  const result = await applyConfiguredCompute(createCloudDriver({ config: tsCloud }), tsCloud, 'production', process.env.COMPUTE_DRY_RUN === 'true')
  console.log(JSON.stringify(result, null, 2))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `state=${result.state}\n`)
}
