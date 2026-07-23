import { appendFileSync } from 'node:fs'

export interface DeploymentTarget {
  environment: 'production'
  flag: '--prod'
}

const branchTargets: Readonly<Record<string, DeploymentTarget>> = {
  main: { environment: 'production', flag: '--prod' },
}

export function resolveDeploymentTarget(ref: string): DeploymentTarget | undefined {
  const prefix = 'refs/heads/'
  if (!ref.startsWith(prefix)) return undefined
  return branchTargets[ref.slice(prefix.length)]
}

if (import.meta.main) {
  const refIndex = process.argv.indexOf('--ref')
  const ref = refIndex === -1 ? process.env.GITHUB_REF : process.argv[refIndex + 1]
  if (!ref) throw new Error('deployment target resolution requires --ref or GITHUB_REF')
  const target = resolveDeploymentTarget(ref)
  if (!target) throw new Error(`No provisioned push-to-deploy target for ${ref}; see stacksjs/stacks#2068`)

  const outputIndex = process.argv.indexOf('--github-output')
  const outputPath = outputIndex === -1 ? undefined : process.argv[outputIndex + 1]
  if (outputIndex !== -1 && !outputPath) throw new Error('--github-output requires a path')
  if (outputPath) appendFileSync(outputPath, `environment=${target.environment}\nflag=${target.flag}\n`)
  console.log(JSON.stringify({ ref, ...target }))
}
