import type { FlyDeployResult } from '@stacksjs/ts-cloud'

/**
 * `buddy deploy` for `cloud.provider: 'fly'` (stacksjs/stacks#1044).
 *
 * A Fly app is a container image on Machines, so this is a different deploy
 * from the box providers' tarball-over-SSH:
 *
 *   1. make sure the Fly app exists - its registry repository does not until
 *      it does, so the push would be refused
 *   2. build `storage/framework/Dockerfile` for linux/amd64 and push it to
 *      `registry.fly.io/<app>:<release>`, logged in with the deploy token
 *   3. converge the app with ts-cloud's `deployToFly()`: secrets, addresses,
 *      Machines rolled under their leases, certificates
 *
 * Every value in `.env.<environment>` becomes a Fly secret rather than plain
 * Machine env: any of them may be a credential, and a secret is encrypted at
 * rest and absent from the Machine config anyone with read access can see.
 */

export const FLY_DOCKERFILE = 'storage/framework/Dockerfile'

export interface FlyDeployInput {
  config: any
  environment: string
  /** `FLY_API_TOKEN`. */
  token: string | undefined
  /** The commit being deployed; it tags the image. */
  release: string
  /** The decrypted `.env.<environment>` values. */
  envValues: Record<string, string>
  projectRoot: string
}

export interface FlyDeployDeps {
  api: Pick<typeof import('@stacksjs/ts-cloud'), 'FlyClient' | 'deployToFly' | 'flyDeployOptions'>
  /** Run a command, returning its exit code and output. */
  run: (command: string[], options: { cwd: string, stdin?: string }) => { exitCode: number, output: string }
  exists: (path: string) => boolean
  log: (line: string) => void
}

export class FlyDeployError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message)
    this.name = 'FlyDeployError'
  }
}

export async function runFlyDeploy(input: FlyDeployInput, deps: FlyDeployDeps): Promise<FlyDeployResult> {
  if (!input.token)
    throw new FlyDeployError('Fly.io needs an API token to deploy.', 'Set FLY_API_TOKEN (`fly tokens create deploy` makes one scoped to the app; an org token lets the first deploy create it).')
  if (!deps.exists(`${input.projectRoot}/${FLY_DOCKERFILE}`))
    throw new FlyDeployError(`No ${FLY_DOCKERFILE} to build the Fly image from.`, 'Regenerate it with `pantry container:generate`, or restore it from the framework.')

  const { secrets, env } = splitFlyEnv(input.envValues, input.environment)
  // The image name needs the app name, so resolve the options once without it.
  const planned = deps.api.flyDeployOptions(input.config, { environment: input.environment, image: '', release: input.release, env, secrets })
  const image = `registry.fly.io/${planned.app}:${input.release}`
  const options = { ...planned, image }

  const client = new deps.api.FlyClient({ token: input.token })
  if (!(await client.getApp(options.app))) {
    deps.log(`Creating Fly app ${options.app} in ${options.org}`)
    await client.createApp(options.app, options.org)
  }

  deps.log(`Building ${image}`)
  must(deps.run(['docker', 'build', '--platform', 'linux/amd64', '-t', image, '-f', FLY_DOCKERFILE, '.'], { cwd: input.projectRoot }), 'docker build')
  // The token on stdin, never in argv where `ps` shows it.
  must(deps.run(['docker', 'login', 'registry.fly.io', '--username', 'x', '--password-stdin'], { cwd: input.projectRoot, stdin: input.token }), 'docker login registry.fly.io')
  deps.log(`Pushing ${image}`)
  must(deps.run(['docker', 'push', image], { cwd: input.projectRoot }), 'docker push')

  return deps.api.deployToFly(client, options, deps.log)
}

/**
 * Split the environment file into Fly secrets and the few plain variables the
 * Machine config carries. Every file value is a secret; the plain ones say
 * which environment this is, and nothing else.
 */
export function splitFlyEnv(values: Record<string, string>, environment: string): { secrets: Record<string, string>, env: Record<string, string> } {
  const secrets: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    // PORT is the Machine's own (`fly.internalPort`); a file value would point
    // the app at a port nothing routes to.
    if (key === 'PORT')
      continue
    secrets[key] = value
  }
  return {
    secrets,
    env: { APP_ENV: environment, NODE_ENV: environment === 'production' ? 'production' : 'development' },
  }
}

function must(result: { exitCode: number, output: string }, step: string): void {
  if (result.exitCode !== 0)
    throw new FlyDeployError(`${step} failed (exit ${result.exitCode}).`, result.output.trim().split('\n').slice(-5).join('\n') || undefined)
}
