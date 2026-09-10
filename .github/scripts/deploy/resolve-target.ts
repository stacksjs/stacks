import { appendFileSync } from 'node:fs'

/**
 * Which branch deploys where, and what that environment needs to be able to
 * (stacksjs/stacks#2068).
 *
 * `main` -> `production` is the only provisioned mapping, and that is the point
 * of this file rather than an omission. CI used to route `stage`, `dev` and
 * beta tags at environments and credentials that do not exist, so a push to an
 * unconfigured branch selected a target that could not work - or worse, one
 * that could.
 *
 * Adding an environment means provisioning it AND adding a row here. The
 * `requires` list is what makes the second half meaningful: it is checked
 * before the deploy runs, so a half-provisioned environment fails in seconds
 * naming what is missing, rather than minutes later inside `buddy deploy`.
 */
export interface DeploymentTarget {
  environment: 'production'
  flag: '--prod'
  /**
   * Secrets and variables the deploy cannot run without, by the name CI
   * exposes them under.
   *
   * Only the ones whose absence is FATAL. `DEPLOY_SSH_KEY`, `SSH_KNOWN_HOSTS`
   * and the Cloudflare pair are all deliberately optional - the workflow says
   * so at each - and listing them here would turn a documented degradation into
   * a failed deploy.
   */
  requires: readonly string[]
}

const branchTargets: Readonly<Record<string, DeploymentTarget>> = {
  main: {
    environment: 'production',
    flag: '--prod',
    // Without this the production env file cannot be decrypted, so every value
    // the deploy reads is the default rather than the configured one - which
    // fails late and confusingly, after the release has been built.
    requires: ['DOTENV_PRIVATE_KEY_PRODUCTION'],
  },
}

export function resolveDeploymentTarget(ref: string): DeploymentTarget | undefined {
  const prefix = 'refs/heads/'
  if (!ref.startsWith(prefix)) return undefined
  return branchTargets[ref.slice(prefix.length)]
}

/**
 * The required names this environment is missing, in declaration order.
 *
 * A name present but empty counts as missing: an unset GitHub secret arrives as
 * the empty string rather than being absent, so checking for the key alone
 * passes for a secret nobody ever set.
 */
export function missingRequirements(
  target: DeploymentTarget,
  env: Record<string, string | undefined>,
): string[] {
  return target.requires.filter(name => !String(env[name] ?? '').trim())
}

/** Every environment this repository can deploy to, for documentation and tests. */
export function provisionedEnvironments(): Array<{ branch: string, target: DeploymentTarget }> {
  return Object.entries(branchTargets).map(([branch, target]) => ({ branch, target }))
}

if (import.meta.main) {
  const refIndex = process.argv.indexOf('--ref')
  const ref = refIndex === -1 ? process.env.GITHUB_REF : process.argv[refIndex + 1]
  if (!ref) throw new Error('deployment target resolution requires --ref or GITHUB_REF')
  const target = resolveDeploymentTarget(ref)
  if (!target) throw new Error(`No provisioned push-to-deploy target for ${ref}; see stacksjs/stacks#2068`)

  // `--preflight` is a separate invocation from target resolution because the
  // two run in different jobs: resolution happens without any environment's
  // secrets in scope, and only the deploy job itself can see them.
  if (process.argv.includes('--preflight')) {
    const missing = missingRequirements(target, process.env)
    if (missing.length > 0) {
      throw new Error(
        `The ${target.environment} environment is missing ${missing.length} required value(s): ${missing.join(', ')}. `
        + 'Set them on the GitHub environment before deploying; see stacksjs/stacks#2068.',
      )
    }
    console.log(`${target.environment}: all ${target.requires.length} required value(s) present`)
  }

  const outputIndex = process.argv.indexOf('--github-output')
  const outputPath = outputIndex === -1 ? undefined : process.argv[outputIndex + 1]
  if (outputIndex !== -1 && !outputPath) throw new Error('--github-output requires a path')
  if (outputPath) appendFileSync(outputPath, `environment=${target.environment}\nflag=${target.flag}\n`)
  if (!process.argv.includes('--preflight'))
    console.log(JSON.stringify({ ref, environment: target.environment, flag: target.flag }))
}
