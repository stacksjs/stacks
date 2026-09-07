import type { OperationPlan } from '@stacksjs/ts-cloud'
import type { CLI, CloudCliOptions } from '@stacksjs/types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { intro, italic, log, onUnknownSubcommand, outro, prompts, runCommand, text, underline } from "@stacksjs/cli"
import {
  addJumpBox,
  deleteCdkRemnants,
  deleteIamUsers,
  deleteJumpBox,
  deleteLogGroups,
  deleteParameterStore,
  deleteStacksBuckets,
  deleteStacksFunctions,
  deleteSubnets,
  deleteVpcs,
  getCloudFrontDistributionId,
  getJumpBoxInstanceId,
} from '@stacksjs/cloud'
import { hasTTY, isCI } from '@stacksjs/env'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'
import { isSshPipelineProvider, sshFleetFromConfigAndState } from './deploy-ssh-target'

/**
 * Create a temporary IAM role to allow CloudFormation to delete a stuck stack
 * Uses raw AWS API calls since AWS SDK has dependency issues with Bun
 */
async function createTemporaryCdkRole(roleName: string): Promise<void> {
  // Import AWSClient for direct IAM API calls
  const { AWSClient } = await import('@stacksjs/ts-cloud')
  const client = new AWSClient()

  // Trust policy that allows CloudFormation to assume this role
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'cloudformation.amazonaws.com',
        },
        Action: 'sts:AssumeRole',
      },
    ],
  }

  try {
    // Check if role already exists
    try {
      const getRoleParams = new URLSearchParams({
        Action: 'GetRole',
        RoleName: roleName,
        Version: '2010-05-08',
      })

      await client.request({
        service: 'iam',
        region: 'us-east-1', // IAM is global but needs us-east-1 for signing
        method: 'POST',
        path: '/',
        body: getRoleParams.toString(),
      })

      log.debug(`Role ${roleName} already exists`)
      return
    }
    catch (e: any) {
      // Role doesn't exist - this is expected, continue to create it
      if (!e.message?.includes('NoSuchEntity') && !e.message?.includes('cannot be found')) {
        throw e
      }
    }

    // Create the role
    log.info('Creating temporary IAM role to enable stack deletion...')

    const createRoleParams = new URLSearchParams({
      Action: 'CreateRole',
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: 'Temporary role to allow CloudFormation to delete stuck stack',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: createRoleParams.toString(),
    })

    log.success('Created IAM role')

    // Attach AdministratorAccess policy to ensure it can delete any resources
    log.info('Attaching permissions...')

    const attachPolicyParams = new URLSearchParams({
      Action: 'AttachRolePolicy',
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: attachPolicyParams.toString(),
    })

    log.success('IAM role ready for stack deletion')

    // Wait a few seconds for IAM to propagate
    log.info('Waiting for IAM role to propagate...')
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  catch (error: any) {
    if (error.message?.includes('EntityAlreadyExists')) {
      log.debug('Role already exists')
    }
    else {
      throw error
    }
  }
}

/**
 * Delete the temporary IAM role after stack deletion
 * Uses raw AWS API calls since AWS SDK has dependency issues with Bun
 */
async function deleteTemporaryCdkRole(roleName: string): Promise<void> {
  const { AWSClient } = await import('@stacksjs/ts-cloud')
  const client = new AWSClient()

  try {
    // First, detach the AdministratorAccess policy
    const detachPolicyParams = new URLSearchParams({
      Action: 'DetachRolePolicy',
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: detachPolicyParams.toString(),
    })

    // Then delete the role
    const deleteRoleParams = new URLSearchParams({
      Action: 'DeleteRole',
      RoleName: roleName,
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: deleteRoleParams.toString(),
    })

    log.success('Cleaned up temporary IAM role')
  }
  catch (error: any) {
    // Don't fail if cleanup doesn't work - role will be orphaned but harmless
    log.debug(`Could not clean up temporary role: ${error.message}`)
  }
}

interface ResultLike {
  isErr?: boolean | (() => boolean)
  error?: string | Error
  value?: unknown
}

function isResultError(result: unknown): result is ResultLike & { error: string } {
  // The shared reader, which handles both a real Result (where `isErr` is a
  // method) and the plain `{ isErr: boolean }` several commands build.
  return resultFailed(result)
}

function getResultError(result: unknown): string {
  if (!result || typeof result !== 'object') return 'Unknown error'
  return String((result as ResultLike).error || 'Unknown error')
}

function getResultValue(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined
  return (result as ResultLike).value
}

/**
 * What happened to `config/cloud.ts` when an attach was applied.
 *
 * `refused` is not a failure of the attach: ts-cloud's editor only rewrites the
 * shape the templates generate and reports anything else, so the operator makes
 * a one-line edit by hand instead of the tool guessing at their file.
 */
type AttachEditOutcome =
  | { state: 'written' | 'would-write' | 'already-set' }
  | { state: 'refused', reason: string }

/**
 * Print every line, then exit non-zero on the last one.
 *
 * `log.error` writes asynchronously and `process.exit` does not wait for it, so
 * pairing the two plainly printed the refusal nowhere and exited 1 - a blocked
 * command that looks like a broken one.
 */
async function refuse(...messages: string[]): Promise<never> {
  for (const message of messages.slice(0, -1))
    await log.error(message)
  return log.exit(messages[messages.length - 1] as string, ExitCode.FatalError)
}

/**
 * The side effects a rename needs, wired to whichever fleet this project has.
 *
 * `ServerRenameEffects` keeps every capability optional but the taken-name check
 * and the inventory, and DROPS the step for anything a fleet cannot do - so this
 * supplies what it can and lets the plan come out shorter rather than pretending
 * a step ran.
 *
 * The four records and where each one lives here:
 *
 * 1. **Provider.** `HetznerClient.renameServer`. Only Hetzner has one; an ssh
 *    fleet is named in `config/cloud.ts`, which a command must not rewrite
 *    behind the author's back, so that fleet gets no provider step.
 * 2. **State pin** (`storage/cloud/state/<stack>.json`). Offered only when a pin
 *    exists AND names this server: `findComputeTargets` rejects a pin whose
 *    recorded name no longer matches the live one, so a provider rename that
 *    skips this quietly invalidates the pin. A pin naming some other server is
 *    not this rename's business.
 * 3. **Hostname.** Set over SSH, and only when the box has an address to reach.
 * 4. **Inventory.** Derived, not stored (`toInventoryServer`) - so for a
 *    provider fleet the provider record IS the inventory, and the write here is
 *    against the snapshot this run is holding.
 */
export async function renameEffects(
  tsCloudConfig: any,
  servers: any[],
  current: any,
  environment: string,
): Promise<any> {
  const taken = servers.map((s: any) => String(s?.name)).filter(Boolean)

  const effects: Record<string, unknown> = {
    takenNames: async () => taken,
    inventoryName: () => String(current?.name ?? ''),
    // Derived rather than stored: the provider record above is the inventory,
    // so all that is left is keeping this run's own snapshot honest.
    renameInventory: (next: string) => {
      current.name = next
    },
  }

  const stackName = tsCloudConfig?.project?.stackName || `${tsCloudConfig?.project?.slug || 'app'}-${environment}`
  const { readDriverState, writeDriverState } = await import('@stacksjs/ts-cloud')
  const pin = await readDriverState(stackName).catch(() => null)
  // Only a provider pin records a server name at all: the ssh driver pins the
  // host it adopted, which a rename does not touch.
  if (pin?.provider === 'hetzner' && pin.serverName && pin.serverName === current?.name) {
    effects.stateName = async () => {
      const latest = await readDriverState(stackName)
      return latest?.provider === 'hetzner' ? latest.serverName : undefined
    }
    effects.writeStateName = async (next: string) => {
      const latest = await readDriverState(stackName)
      if (latest?.provider === 'hetzner')
        await writeDriverState(stackName, { ...latest, serverName: next })
    }
  }

  const host = current?.ipv4
  if (host) {
    const { sshExec, buildSetHostnameScript } = await import('@stacksjs/ts-cloud')
    const ssh = { user: 'root', connectTimeoutSec: 10 }
    effects.remoteHostname = async () => {
      const result = await sshExec(host, 'hostname', ssh)
      // An unreachable box resolves the step to `unknown`, which the plan then
      // shows and runs, rather than being read as "the hostname is already right".
      if (result.code !== 0)
        throw new Error(result.stderr.trim() || `Could not reach ${host} over SSH.`)
      return result.stdout.trim()
    }
    effects.setRemoteHostname = async (next: string) => {
      const result = await sshExec(host, buildSetHostnameScript(next), ssh)
      if (result.code !== 0)
        throw new Error(result.stderr.trim() || `Setting the hostname on ${host} failed.`)
    }
  }

  const provider = tsCloudConfig?.cloud?.provider || process.env.CLOUD_PROVIDER || 'aws'
  if (provider !== 'hetzner')
    return effects

  const { HetznerClient } = await import('@stacksjs/ts-cloud')
  const { resolveHetznerApiToken } = await import('./deploy')
  const apiToken = resolveHetznerApiToken(tsCloudConfig)
  const serverId = Number(current?.id)
  if (!apiToken || !Number.isFinite(serverId))
    return effects

  const client = new HetznerClient({ apiToken })
  effects.providerName = async () => (await client.getServer(serverId))?.name
  effects.renameProvider = async (next: string) => {
    await client.renameServer(serverId, next)
  }

  return effects
}

/**
 * What tearing a server down needs, so the plan can be built without a provider.
 *
 * Two records, not four: a destroy is the reverse of a provision, and the box's
 * own hostname and inventory row go away with it. What does NOT go away on its
 * own is the state pin, which would otherwise keep naming a server that no
 * longer exists and send the next deploy looking for it.
 */
export interface ServerDestroyEffects {
  /** Is the server still there? This is what makes a half-finished teardown resumable. */
  providerExists: () => Promise<boolean>
  deleteProvider: () => Promise<void>
  /** Name recorded in the local driver state pin, when a pin names this server. */
  pinnedName?: () => Promise<string | undefined>
  clearPin?: () => Promise<void>
}

/**
 * The plan that destroys `name`.
 *
 * Built here rather than upstream because ts-cloud has no destroy planner: it
 * supplies the drained-site scan that decides whether a teardown may run at all,
 * and leaves the teardown itself to the driver that provisioned the box.
 *
 * Deleting the server comes FIRST, and the pin is cleared after. The other order
 * reads as safer and is not: a crash between the two would leave a live server
 * that nothing points at, which is the state that gets forgotten and billed.
 */
export function planServerDestroy(name: string, effects: ServerDestroyEffects): OperationPlan {
  const steps: OperationPlan['steps'] = [
    {
      id: 'provider:delete',
      title: `Delete the server ${name}`,
      change: { from: name, to: 'gone' },
      destructive: true,
      satisfied: async () => !(await effects.providerExists()),
      apply: async () => await effects.deleteProvider(),
    },
  ]

  if (effects.pinnedName && effects.clearPin) {
    steps.push({
      id: 'state:clear',
      title: 'Clear the state pin that names it',
      change: { from: name, to: 'none' },
      satisfied: async () => (await effects.pinnedName!()) !== name,
      apply: async () => await effects.clearPin!(),
    })
  }

  return { operation: 'server:destroy', target: name, steps }
}

/** {@link ServerDestroyEffects} wired to this project's fleet. */
export async function destroyEffects(tsCloudConfig: any, current: any, environment: string): Promise<ServerDestroyEffects> {
  const stackName = tsCloudConfig?.project?.stackName || `${tsCloudConfig?.project?.slug || 'app'}-${environment}`
  const { readDriverState, writeDriverState } = await import('@stacksjs/ts-cloud')
  const pin = await readDriverState(stackName).catch(() => null)

  const effects: ServerDestroyEffects = {
    // Without a provider there is nothing this command can delete, and saying so
    // beats a plan whose one step silently does nothing.
    providerExists: async () => true,
    deleteProvider: async () => {
      throw new Error(`No provider API for this fleet, so ${current?.name} cannot be deleted from here.`)
    },
  }

  if (pin?.provider === 'hetzner' && pin.serverName === current?.name) {
    effects.pinnedName = async () => {
      const latest = await readDriverState(stackName)
      return latest?.provider === 'hetzner' ? latest.serverName : undefined
    }
    effects.clearPin = async () => {
      const latest = await readDriverState(stackName)
      if (latest?.provider !== 'hetzner')
        return
      // The pin is emptied rather than deleted: a stack whose box is gone should
      // re-provision on the next deploy, and the file is where that decision is
      // recorded. `destroyCompute` clears the same two fields.
      const { serverId: _id, serverName: _name, ...rest } = latest
      await writeDriverState(stackName, rest as typeof latest)
    }
  }

  const provider = tsCloudConfig?.cloud?.provider || process.env.CLOUD_PROVIDER || 'aws'
  if (provider !== 'hetzner')
    return effects

  const { HetznerClient } = await import('@stacksjs/ts-cloud')
  const { resolveHetznerApiToken } = await import('./deploy')
  const apiToken = resolveHetznerApiToken(tsCloudConfig)
  const serverId = Number(current?.id)
  if (!apiToken || !Number.isFinite(serverId))
    return effects

  const client = new HetznerClient({ apiToken })
  effects.providerExists = async () => {
    try {
      return Boolean(await client.getServer(serverId))
    }
    catch {
      // A server that is already gone answers 404, which is this step being
      // satisfied rather than the plan failing.
      return false
    }
  }
  effects.deleteProvider = async () => {
    await client.deleteServer(serverId)
  }

  return effects
}

/**
 * The side effects a site move needs, wired to two boxes of this project's fleet.
 *
 * Everything here is the SAME primitive the deploy path uses, deliberately: the
 * DNS cutover is `reconcileHetznerDns`, the gateway refresh is the rpx fragment
 * refresh, the certificates are ts-cloud's own pack/unpack scripts. A move that
 * published its hostnames differently from a deploy would be a second answer to
 * "which names does this site serve", and the two would drift.
 *
 * The archive is carried THROUGH the operator rather than box-to-box: a direct
 * hop needs the source to hold a key for the target, which is a trust
 * relationship a move should not create on its own.
 */
async function moveEffects(context: {
  tsCloudConfig: any
  slug: string
  siteName: string
  rawSite: any
  source: any
  target: any
  hostnames: string[]
}): Promise<any> {
  const { slug, siteName, rawSite, source, target, tsCloudConfig } = context
  const {
    buildCertificatePackScript,
    buildCertificateStateScript,
    buildCertificateUnpackScript,
    buildRpxConfig,
    buildRpxFragmentRefreshScript,
    buildSshArgs,
    certificatesMatch,
    DEFAULT_RPX_CERTS_DIR,
    parseCertificateState,
    probeHostRoutes,
    sshExec,
    sshExecOrThrow,
  } = await import('@stacksjs/ts-cloud')
  const { reconcileHetznerDns } = await import('./deploy')

  const ssh = { user: 'root', connectTimeoutSec: 10 }
  const runOnSource = (script: string) => sshExecOrThrow(source.ipv4, script, ssh)
  const runOnTarget = (script: string) => sshExecOrThrow(target.ipv4, script, ssh)

  /** Stream a file from one box to the other through this process. */
  async function carry(path: string): Promise<void> {
    const args = buildSshArgs(ssh, 'ssh')
    const reader = Bun.spawn(['ssh', ...args, `root@${source.ipv4}`, `cat ${path}`], { stdout: 'pipe', stderr: 'pipe' })
    const writer = Bun.spawn(['ssh', ...args, `root@${target.ipv4}`, `cat > ${path}`], {
      stdin: reader.stdout,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [readCode, writeCode] = await Promise.all([reader.exited, writer.exited])
    if (readCode !== 0 || writeCode !== 0) {
      const why = (await new Response(readCode === 0 ? writer.stderr : reader.stderr).text()).trim()
      throw new Error(why || `Carrying ${path} from ${source.name} to ${target.name} failed.`)
    }
  }

  const staged = async (path: string): Promise<boolean> =>
    (await sshExec(target.ipv4, `test -s ${path} && echo staged`, ssh)).stdout.includes('staged')

  const { siteMoveArchivePath, siteMoveCertArchivePath } = await import('@stacksjs/ts-cloud')
  const archive = siteMoveArchivePath(slug, siteName)

  const effects: Record<string, unknown> = {
    runOnSource,
    runOnTarget,
    archiveStaged: () => staged(archive),
    transferArchive: () => carry(archive),

    publishedAddress: async () => {
      const host = context.hostnames[0]
      if (!host)
        return undefined
      try {
        const { resolve4 } = await import('node:dns/promises')
        return (await resolve4(host))[0]
      }
      catch {
        // A name that does not resolve yet is not a cutover that failed - it is
        // a cutover that has not happened, which is what the step is for.
        return undefined
      }
    },

    cutoverDns: async () => {
      const warnings: string[] = []
      const collect = new Proxy(log, {
        get: (target_, key) => key === 'warn'
          ? (message: string) => { warnings.push(String(message)) }
          : (target_ as any)[key],
      })
      await reconcileHetznerDns(
        { [siteName]: rawSite },
        target.ipv4,
        collect as typeof log,
        target.ipv6,
        tsCloudConfig?.infrastructure?.compute?.proxy?.autoWww,
      )
      return warnings
    },

    targetRoutesSite: async () => {
      const probe = await probeHostRoutes(target, (host: string, command: string) => sshExec(host, command, ssh))
      if (probe.unavailable)
        return false
      return probe.routes.some((route: any) => context.hostnames.includes(String(route.host)))
    },

    refreshTargetGateway: async () => {
      const rpx = buildRpxConfig(tsCloudConfig?.sites ?? {}, {
        proxy: tsCloudConfig?.infrastructure?.compute?.proxy ?? {},
        slug,
      })
      await runOnTarget(buildRpxFragmentRefreshScript({ config: rpx, slug }).join('\n'))
    },
  }

  // TLS lives in the gateway's cert directory, which belongs to the box rather
  // than to the site: left behind, the cutover lands on a box with no
  // certificate for the hostname and every browser refuses it.
  const certArchive = siteMoveCertArchivePath(slug, siteName)
  effects.certificates = {
    inPlace: async () => {
      const read = async (run: (script: string) => Promise<string>) =>
        parseCertificateState(await run(buildCertificateStateScript(DEFAULT_RPX_CERTS_DIR, context.hostnames)))
      return certificatesMatch(await read(runOnSource), await read(runOnTarget))
    },
    carry: async () => {
      await runOnSource(buildCertificatePackScript(DEFAULT_RPX_CERTS_DIR, context.hostnames, certArchive))
      await carry(certArchive)
      await runOnTarget(buildCertificateUnpackScript(DEFAULT_RPX_CERTS_DIR, certArchive))
    },
  }

  return effects
}

/**
 * The box whose gateway currently answers for one of these hostnames.
 *
 * Asked of the boxes rather than read from config, because config says where a
 * site is DECLARED to live and a move is about where it actually is - which are
 * the same thing right up until the moment somebody needs to move it.
 */
export async function serverServing(
  servers: any[],
  hosts: string[],
  probe: (server: any) => Promise<{ routes?: any[], unavailable?: string }>,
): Promise<any | undefined> {
  for (const candidate of servers) {
    if (!candidate?.ipv4)
      continue
    const result = await probe(candidate)
    // A box that could not be asked is not a box that said no, but it is also
    // not an answer - so it is skipped and the operator is told to name --from.
    if (!result.unavailable && (result.routes ?? []).some((route: any) => hosts.includes(String(route.host))))
      return candidate
  }
  return undefined
}

/**
 * The on-box engine database this project owns, when it has one.
 *
 * Named in `SiteMoveOptions` and NOT given effects, which is what makes
 * `planSiteMove` refuse: a Postgres or MySQL database lives in the engine's own
 * data directory rather than in the site tree, so moving the tree alone would
 * pass every check in the plan - the app starts, answers its health gate, takes
 * the DNS cutover - and then serve production an empty database. Carrying one
 * needs a dump, a role, and a restore on the target, and until that exists the
 * honest answer is to refuse the move rather than to make it silently.
 *
 * SQLite is not this case: it lives under `shared/`, which the tree carries
 * already. An external database is not either - the target reaches the same
 * endpoint the source did.
 */
export async function onBoxDatabase(tsCloudConfig: any): Promise<{ name: string } | undefined> {
  const { isLocalDatabase, resolveAppDatabase } = await import('@stacksjs/ts-cloud')
  const database = resolveAppDatabase(tsCloudConfig)
  if (!database || !isLocalDatabase(database))
    return undefined

  const engine = String((database as any).engine || (database as any).driver || '')
  if (engine === 'sqlite' || engine === 'better-sqlite3')
    return undefined

  const name = String((database as any).name || '')
  return name ? { name } : undefined
}

/** Only an SSH-deployed fleet can be listed, and saying so beats printing an empty one. */
async function assertFleetProvider(tsCloudConfig: any, command: string): Promise<void> {
  const provider = tsCloudConfig?.cloud?.provider || process.env.CLOUD_PROVIDER || 'aws'
  if (isSshPipelineProvider(provider))
    return

  await log.info('The on-box half (the rpx gateway registry) is provider-independent; the server listing is not yet.')
  await log.exit(`\`buddy ${command}\` can list Hetzner and ssh servers, and this project's provider is '${provider}'.`, ExitCode.FatalError)
}

/** Every ssh state pin this project has written, newest layout only. */
function readSshStatePins(cwd = process.cwd()): Array<Record<string, unknown>> {
  const dir = join(cwd, 'storage', 'cloud', 'state')
  if (!existsSync(dir))
    return []

  const pins: Array<Record<string, unknown>> = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json'))
      continue
    try {
      pins.push(JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>)
    }
    catch {
      // A pin this process cannot read is one the deploy will rewrite; it is
      // not worth failing a listing over.
    }
  }
  return pins
}

/**
 * Every server in the provider project, not just this one's.
 *
 * Deliberately unfiltered: consolidation asks "which boxes could these sites
 * move onto", so a box this project has no connection to is exactly what needs
 * listing. A missing token, a 401 and a genuinely empty project are three
 * different answers and each gets its own sentence, which is the lesson
 * `describeAttachLookupFailure` already learned in the deploy command.
 */
async function listFleet(tsCloudConfig: any): Promise<{ servers: any[], problem?: string }> {
  // An ssh project has no API to enumerate: its fleet is exactly the hosts the
  // config names plus the ones previous deploys pinned.
  if ((tsCloudConfig?.cloud?.provider || process.env.CLOUD_PROVIDER) === 'ssh') {
    const servers = sshFleetFromConfigAndState(tsCloudConfig, readSshStatePins())
    return {
      servers,
      problem: servers.length === 0
        ? 'No ssh hosts are configured. Add one under `ssh.hosts` in config/cloud.ts, or set TS_CLOUD_SSH_HOST.'
        : undefined,
    }
  }

  const { HetznerClient, toInventoryServer } = await import('@stacksjs/ts-cloud')
  // ts-cloud exports a resolver of the same name whose first parameter is the
  // token, not the config - passing a config there made it call `.trim()` on an
  // object and every Hetzner listing died with `t?.trim is not a function`. The
  // buddy resolver takes the config, and is the one the deploy path already uses.
  const { resolveHetznerApiToken } = await import('./deploy')
  const apiToken = resolveHetznerApiToken(tsCloudConfig)

  if (!apiToken) {
    return {
      servers: [],
      problem: 'No Hetzner API token, so no servers were looked up. '
        + 'Set HCLOUD_TOKEN (or HETZNER_API_TOKEN, or hetzner.apiToken in config/cloud.ts).',
    }
  }

  try {
    const servers = await new HetznerClient({ apiToken }).listServers()
    return { servers: servers.map(server => toInventoryServer(server)).sort((a, b) => a.name.localeCompare(b.name)) }
  }
  catch (error: any) {
    const status = Number(error?.status)
    const where = Number.isFinite(status) && status > 0 ? `returned HTTP ${status}` : 'could not be reached'
    return {
      servers: [],
      problem: `The Hetzner API ${where}, so the server list is incomplete. ${error?.message ?? String(error)}`
        + (status === 401 || status === 403
          ? ' That is an auth failure, not an empty project: check the token is valid for this Hetzner project.'
          : ''),
    }
  }
}

/**
 * This project's sites, in the terms the box reports them.
 *
 * `resolveSiteKind` and `siteInstallBase` come from ts-cloud because it owns
 * both rules - `siteInstallBase` is documented as the single source of truth
 * for the install path - and re-deriving either here would be free to drift
 * from what the deploy actually does.
 */
async function declaredSitesFor(tsCloudConfig: any, slug: string): Promise<any[]> {
  const { resolveSiteKind, siteInstallBase } = await import('@stacksjs/ts-cloud')

  return Object.entries((tsCloudConfig?.sites ?? {}) as Record<string, any>).map(([name, site]) => {
    const domain = typeof site?.domain === 'string' && site.domain.trim() ? site.domain.trim() : undefined
    const port = Number(site?.port)

    return {
      name,
      kind: resolveSiteKind(site),
      domain,
      path: typeof site?.path === 'string' && site.path.trim() ? site.path.trim() : '/',
      port: Number.isFinite(port) && port > 0 ? port : undefined,
      installBase: siteInstallBase(slug, name),
      // No `domain`, so the gateway never routes it: a loopback-only service
      // reached through another site's proxy, not a missing deploy.
      loopbackOnly: !domain,
    }
  })
}

/**
 * The two edits an attach needs, in two different repositories.
 *
 * Stays here rather than in ts-cloud because `tenants` is a Stacks config key:
 * it is what lets a project recognise another project's env namespace as
 * somebody else's, so `buddy deploy` drops those keys instead of shipping them.
 * The owner's repository is not this one, so that edit is printed, never made.
 */
function describeAttachEdits(slug: string, owner: string, edit: AttachEditOutcome, dryRun: boolean): string[] {
  const lines = ['  Two edits make the attach real, in two different repositories:', '']

  if (edit.state === 'refused') {
    lines.push(`    1. config/cloud.ts here: could not edit it (${edit.reason})`)
    lines.push(`       Add \`attachTo: '${owner}'\` to the \`cloud\` block by hand.`)
  }
  else if (edit.state === 'already-set') {
    lines.push(`    1. config/cloud.ts here: already sets attachTo: '${owner}'. Nothing to do.`)
  }
  else {
    lines.push(`    1. config/cloud.ts here: ${dryRun ? `would set attachTo: '${owner}' (--dry-run, not written)` : `set attachTo: '${owner}'`}`)
  }

  lines.push('')
  lines.push(`    2. In the '${owner}' project's own repository, which this command cannot edit:`)
  lines.push(`       add '${slug}' to the \`tenants\` array in its config/cloud.ts.`)
  lines.push(`       Without it, that project's deploy ships ${slug.toUpperCase()}_* keys from its`)
  lines.push('       env files into this project\'s .env instead of dropping them.')
  lines.push('')
  lines.push('  Then `buddy deploy` from here puts these sites on that box.')

  return lines
}

export function cloud(buddy: CLI): void {
  const descriptions = {
    cloud: 'Interact with the Stacks Cloud',
    ssh: 'SSH into the Stacks Cloud',
    add: 'Add a resource to the Stacks Cloud',
    remove: 'Remove the Stacks Cloud. In case it fails, try again',
    optimizeCost: 'Remove certain resources that may be re-applied at a later time',
    cleanUp: 'Remove all resources that were retained during the cloud deletion',
    invalidateCache: 'Invalidate the CloudFront cache',
    diff: 'Show the diff of the current, undeployed cloud changes ',
    dashboard: 'Run the local Stacks Cloud management cockpit (servers, sites, deploys)',
    sites: 'List every server and what each one is hosting, across projects',
    attach: 'Attach this project to a server another project owns, after checking it is safe',
    rename: 'Rename a server in place, keeping the provider, state pin, hostname and inventory in step',
    renameTo: 'The new server name',
    renameEnv: 'Environment whose fleet and state pin to rename in',
    renameJson: 'Emit the rename plan as JSON',
    destroy: 'Destroy a drained server, once nothing on it is anyone\'s rollback',
    destroyEnv: 'Environment whose fleet and state pin the server belongs to',
    destroyJson: 'Emit the teardown plan as JSON',
    destroyConfirm: 'The exact server name, which an irreversible step requires before it runs',
    destroyDiscardDrained: 'Destroy it even though it still holds site trees that are somebody\'s rollback',
    move: 'Move a deployed site to another server, cutting DNS over once the target serves it',
    moveTo: 'Server to move the site to, by provider name or by owning project slug',
    moveFrom: 'Server the site is on now, when more than one could be serving it',
    moveEnv: 'Environment whose fleet and sites to move within',
    moveJson: 'Emit the move plan as JSON',
    moveConfirm: 'The exact site name, which the irreversible steps require before they run',
    attachServer: 'Server to attach to, by provider name or by owning project slug',
    dryRun: 'Print the plan and change nothing',
    sitesEnv: 'Environment to take the inventory for',
    remote: 'Skip the SSH read of each box\'s gateway registry (co-tenants are then not listed)',
    json: 'Emit the inventory as JSON',
    host: 'Host to bind the dashboard to',
    port: 'Port to bind the dashboard to',
    env: 'Environment to manage',
    paths: 'The paths to invalidate',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('cloud', descriptions.cloud)
    .option('--ssh', descriptions.ssh, { default: false })
    .option('--connect', descriptions.ssh, { default: false })
    .option('--invalidate-cache', descriptions.invalidateCache, { default: false })
    .option('--paths [paths]', descriptions.paths)
    .option('--diff', descriptions.diff, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud` ...', options)
      const startTime = performance.now()

      if (options.ssh || options.connect) {
        const jumpBoxId = await getJumpBoxInstanceId()
        const result = await runCommand(`aws ssm start-session --target ${jumpBoxId}`, {
          ...options,
          cwd: p.projectPath(),
          stdin: 'pipe',
        })

        if (isResultError(result)) {
          await outro(
            'While running the cloud command, there was an issue',
            { startTime, useSeconds: true },
            getResultError(result),
          )
          process.exit(ExitCode.FatalError)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (options.invalidateCache) {
        // `prompts` is an object of prompt functions, not the callable the npm
        // package of that name exports - calling it threw "prompts is not a
        // function" at every one of these interactive paths. Behind
        // `(prompts)(...)`, nothing said so.
        const confirm = await prompts.confirm('Would you like to invalidate the CDN (CloudFront) cache?')

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        log.info('Invalidating the CloudFront cache...')

        // Use ts-cloud CloudFront client instead of AWS SDK
        const { AWSCloudFrontClient } = await import('@stacksjs/ts-cloud')
        const cloudfront = new AWSCloudFrontClient()
        const distributionId = await getCloudFrontDistributionId()

        try {
          const invalidationId = await cloudfront.invalidateAll(distributionId)
          log.success(`Invalidation created: ${invalidationId}`)
          log.info(`Status: pending`)
        }
        catch (err: any) {
          log.error(`Failed to invalidate CloudFront cache: ${err.message}`)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (options.diff) {
        try {
          const { InfrastructureGenerator } = await import('@stacksjs/ts-cloud')
          const { CloudFormationClient } = await import('@stacksjs/ts-cloud/aws')
          const { tsCloud: cloudConfig } = await import('~/config/cloud')

          const environment = (process.env.APP_ENV || process.env.NODE_ENV || 'production') as 'production' | 'staging' | 'development'
          const generator = new InfrastructureGenerator({
            config: cloudConfig,
            environment,
          })

          const newTemplate = generator.generate().toJSON()
          const stackName = `${cloudConfig.project?.slug || 'stacks'}-${environment}`
          const cfn = new CloudFormationClient(process.env.AWS_REGION || 'us-east-1')

          let currentTemplate = '{}'
          try {
            const result = await cfn.getTemplate(stackName)
            currentTemplate = result.TemplateBody
          }
          catch {
            log.info('No deployed stack found. Showing full template as diff.')
          }

          if (currentTemplate === newTemplate) {
            log.info('No changes detected.')
          }
          else {
            log.info('Changes detected between deployed and local template:')
            log.info(`Current template: ${currentTemplate.length} bytes`)
            log.info(`New template: ${newTemplate.length} bytes`)
          }
        }
        catch (error: any) {
          log.error(`Failed to compute diff: ${error.message}`)
        }

        await outro('Cloud diff complete', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Read more about `buddy cloud` here: https://stacksjs.com/docs/cloud')
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:add', descriptions.add)
    .option('--jump-box', 'Remove the jump-box', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:add` ...', options)

      const startTime = await intro('buddy cloud:add')

      if (options.jumpBox) {
        // `prompts` is an object of prompt functions, not the callable the npm
        // package of that name exports - calling it threw "prompts is not a
        // function" at every one of these interactive paths. Behind
        // `(prompts)(...)`, nothing said so.
        const confirm = await prompts.confirm('Would you like to add a jump-box to your cloud?')

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        log.info('The jump-box is getting added to your cloud resources...')
        log.info('This takes a few moments, please be patient.')
        // sleep for 2 seconds to get the user to read the message
        await new Promise(resolve => setTimeout(resolve, 2000))

        const result = await addJumpBox()

        if (isResultError(result)) {
          await outro(
            'While running the cloud:add command, there was an issue',
            { startTime, useSeconds: true },
            getResultError(result),
          )
          process.exit(ExitCode.FatalError)
        }

        log.info(italic('View the jump-box in the AWS console:'))
        log.info(
          underline(
            'https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:instanceState=running',
          ),
        )
        log.info(italic('Once it finished initializing, you may SSH into it:'))
        log.info(underline('buddy cloud --ssh'))

        await outro('Your jump-box was added.', {
          startTime,
          useSeconds: true,
        })
        process.exit(ExitCode.Success)
      }

      log.info('This functionality is not yet implemented.')
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:remove', descriptions.remove)
    .alias('cloud:destroy')
    .alias('cloud:rm')
    .alias('undeploy')
    .option('--jump-box', 'Remove the jump-box', { default: false })
    .option('--force', 'Force deletion of stack in bad state', { default: false })
    .option('--yes', 'Skip confirmation prompts', { default: false })
    // .option('--realtime-cdn-logs', 'Remove the CDN Realtime Log Stream', { default: false }) // TODO: implement this
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:remove` ...', options)

      const startTime = await intro('buddy cloud:remove')

      // Determine environment first, the confirmation guard below names it.
      const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

      // Safety guard (stacksjs/stacks#2002): this command deletes real cloud
      // infrastructure and previously did so with no confirmation at all,
      // leaving the declared `--yes` flag inert. Now `--yes` is the explicit
      // bypass; without it, a non-interactive shell (CI, piped stdin) refuses
      // to run instead of hanging on a prompt no one can answer, and an
      // interactive shell must confirm before any AWS call is made.
      if (!options.yes && (isCI || !hasTTY || !process.stdin.isTTY)) {
        log.syncError(`Refusing to remove the "${environment}" cloud infrastructure from a non-interactive shell without confirmation.`)
        log.syncError(`   ➡️  Re-run with \`--yes\` to confirm (e.g. in CI): \`buddy cloud:remove --yes\``)
        await outro('cloud:remove cancelled.', { startTime, useSeconds: true })
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      if (options.jumpBox) {
        if (!options.yes) {
          // `prompts` is an object of prompt functions, not the callable the npm
          // package of that name exports - calling it threw "prompts is not a
          // function" at every one of these interactive paths. Behind
          // `(prompts)(...)`, nothing said so.
          const confirm = await prompts.confirm('Would you like to remove your jump-box for now?')

          if (!confirm) {
            await outro('Exited', { startTime, useSeconds: true })
            process.exit(ExitCode.Success)
          }
        }

        const result = await deleteJumpBox()

        if (isResultError(result)) {
          await outro('While removing your jump-box, there was an issue', { startTime, useSeconds: true }, getResultError(result))
          process.exit(ExitCode.FatalError)
        }

        await outro('Your jump-box was removed.', {
          startTime,
          useSeconds: true,
        })
        process.exit(ExitCode.Success)
      }

      // Typed confirmation for a full infrastructure teardown, mirroring the
      // `migrate:fresh` guard: no accidental keystroke may delete production.
      // Only `--yes` skips this.
      if (!options.yes) {
        log.warning(`This will permanently delete the "${environment}" cloud infrastructure (compute, storage, CDN, and DNS managed by Stacks). This cannot be undone.`)
        const typed = await text({ message: `Type the environment name "${environment}" to confirm (blank to cancel):` })
        if (typed.trim() !== environment) {
          await outro('cloud:remove cancelled - confirmation did not match.', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }
      }

      console.log('')
      console.log('Removing cloud infrastructure...')
      console.log(`   ${italic('This typically takes 2-5 minutes.')}`)
      console.log('')

      // Load AWS credentials from environment-specific .env file if not already set
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        const { existsSync, readFileSync } = await import('node:fs')
        const { projectPath } = await import('@stacksjs/path')

        // Try environment-specific file first (e.g., .env.staging, .env.production)
        const envFiles = [
          projectPath(`.env.${environment}`),
          projectPath('.env'),
        ]

        for (const envPath of envFiles) {
          if (existsSync(envPath)) {
            const envContent = readFileSync(envPath, 'utf-8')
            const lines = envContent.split('\n')

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('#') || !trimmed.includes('='))
                continue

              const [key, ...valueParts] = trimmed.split('=')
              const value = valueParts.join('=').replace(/^["']|["']$/g, '')

              if (key === 'AWS_ACCESS_KEY_ID' || key === 'AWS_SECRET_ACCESS_KEY' || key === 'AWS_REGION' || key === 'AWS_ACCOUNT_ID') {
                process.env[key] = value
              }
            }
            break // Stop after loading the first existing file
          }
        }
      }

      // Use static credentials from environment-specific .env file
      delete process.env.AWS_PROFILE

      // Use the new undeployStack function with CDK-style status updates
      try {
        const { undeployStack } = await import('../../../actions/deploy')

        const region = process.env.AWS_REGION || 'us-east-1'

        await undeployStack({
          environment,
          region,
          verbose: options.verbose,
        })

        // Cleanup is already handled by CloudFormation - retained resources (like S3)
        // are intentional and can be cleaned up separately with `./buddy cloud:cleanup`

        await outro('Cloud infrastructure removed', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }
      catch (error: any) {
        console.log('')
        console.error('✗ Failed to remove cloud infrastructure')

        // Check for common error patterns
        const errorStr = String(error.message || error)
        if (errorStr.includes('security token') || errorStr.includes('credentials')) {
          console.log('')
          console.error('  AWS credentials are invalid or expired')
          console.log('  Check your AWS credentials in .env.production:')
          console.log('    - AWS_ACCESS_KEY_ID')
          console.log('    - AWS_SECRET_ACCESS_KEY')
        }
        else if (errorStr.includes('region') || errorStr.includes('AWS_REGION')) {
          console.log('')
          console.error('  AWS Region not configured')
          console.log('  Add AWS_REGION to your .env.production file')
        }
        else if (errorStr.includes('AccessDenied')) {
          console.log('')
          console.error('  Access denied')
          console.log('  Your AWS credentials may not have permission to delete stacks')
        }
        else {
          console.error(`  ${errorStr}`)
        }

        console.log('')
        console.log('Troubleshooting:')
        console.log('  ./buddy cloud:cleanup   - Clean up resources manually')
        console.log('  --verbose               - Show detailed error information')
        console.log('')

        if (options.verbose) {
          console.error('Error details:', error)
        }

        await outro('Failed to remove infrastructure', { startTime, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('cloud:optimize-cost', descriptions.optimizeCost)
    .option('--jump-box', 'Remove the jump-box', { default: true }) // removes the ec2 instance
    // .option('--realtime-cdn-logs', 'Remove the CDN Realtime Log Stream', { default: true }) // TODO: implement this - removes the Kinesis Data Stream
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:optimize-cost` ...', options)

      const startTime = await intro('buddy cloud:optimize-cost')

      if (options.jumpBox) {
        // `prompts` is an object of prompt functions, not the callable the npm
        // package of that name exports - calling it threw "prompts is not a
        // function" at every one of these interactive paths. Behind
        // `(prompts)(...)`, nothing said so.
        const confirm = await prompts.confirm('Would you like to remove your jump-box to optimize your costs?')

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        // at the moment, the jump-box is the only resource that is removed to optimize costs
        // because it can be re-applied at any later time
        await deleteJumpBox()

        await outro('Your jump-box was removed & cost optimizations are applied.', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      await outro('No cost optimization was applied', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:cleanup', descriptions.cleanUp)
    .alias('cloud:clean-up')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:cleanup` ...', options)

      const startTime = await intro('buddy cloud:cleanup')

      // Unset AWS_PROFILE to force AWS SDK to use static credentials from .env.production
      delete process.env.AWS_PROFILE

      log.info(`Cleaning up your cloud resources will take a while to complete. Please be patient.`)

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      const cleanupSteps: { label: string; fn: () => Promise<unknown>; ignoreErrors?: string[] }[] = [
        { label: 'jump-boxes', fn: deleteJumpBox, ignoreErrors: ['Jump-box not found'] },
        { label: 'retained S3 buckets', fn: deleteStacksBuckets },
        { label: 'retained Lambda functions', fn: deleteStacksFunctions, ignoreErrors: ['No stacks functions found'] },
        { label: 'remaining Stacks logs', fn: deleteLogGroups },
        { label: 'stored parameters', fn: deleteParameterStore },
        { label: 'VPCs', fn: deleteVpcs },
        { label: 'Subnets', fn: deleteSubnets },
        { label: 'CDK remnants', fn: deleteCdkRemnants },
        { label: 'IAM users', fn: deleteIamUsers },
      ]

      const errors: { label: string; error: string }[] = []

      for (const step of cleanupSteps) {
        log.info(`Removing any ${step.label}...`)
        try {
          const result = await step.fn()
          if (isResultError(result)) {
            const errMsg = getResultError(result)
            if (!step.ignoreErrors?.includes(errMsg)) {
              log.warn(`${step.label} cleanup issue: ${errMsg}`)
              errors.push({ label: step.label, error: errMsg })
            }
          }
          else {
            const value = getResultValue(result)
            if (value) log.info(String(value))
          }
        }
        catch (e: any) {
          const errMsg = e.message || 'AWS SDK error'
          log.warn(`${step.label} cleanup skipped: ${errMsg}`)
          errors.push({ label: step.label, error: errMsg })
        }
      }

      if (errors.length > 0) {
        log.warn(`Cleanup completed with ${errors.length} issue(s):`)
        for (const { label, error } of errors) {
          log.warn(`  - ${label}: ${error}`)
        }
      }

      await outro('AWS resources have been removed', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:invalidate-cache', descriptions.invalidateCache)
    .option('--paths [paths]', descriptions.paths, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:invalidate-cache` ...', options)

      const startTime = await intro('buddy cloud:invalidate-cache')

      // `prompts` is an object of prompt functions, not the callable the npm
      // package of that name exports - calling it threw "prompts is not a
      // function" at every one of these interactive paths. Behind
      // `(prompts)(...)`, nothing said so.
      const confirm = await prompts.confirm('Would you like to invalidate the CloudFront cache?')

      if (!confirm) {
        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Invalidating the CloudFront cache...')
      const distributionId = await getCloudFrontDistributionId()
      if (!distributionId) {
        await outro(
          'Could not resolve CloudFront distribution ID',
          { startTime, useSeconds: true },
          'Ensure your cloud stack is deployed before invalidating cache.',
        )
        process.exit(ExitCode.FatalError)
      }

      const paths = options.paths ? String(options.paths) : '/*'
      const result = await runCommand(
        `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths ${paths}`,
        {
          ...options,
          cwd: p.projectPath(),
          stdin: 'pipe',
        },
      )

      if (isResultError(result)) {
        await outro(
          'While running the cloud command, there was an issue',
          { startTime, useSeconds: true },
          getResultError(result),
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Exited', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:diff', descriptions.diff)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:diff` ...', options)

      const startTime = await intro('buddy cloud:diff')

      try {
        const { InfrastructureGenerator } = await import('@stacksjs/ts-cloud')
        const { CloudFormationClient } = await import('@stacksjs/ts-cloud/aws')
        const { tsCloud: cloudConfig } = await import('~/config/cloud')

        const environment = (process.env.APP_ENV || process.env.NODE_ENV || 'production') as 'production' | 'staging' | 'development'
        const generator = new InfrastructureGenerator({
          config: cloudConfig,
          environment,
        })

        const newTemplate = generator.generate().toJSON()
        const stackName = `${cloudConfig.project?.slug || 'stacks'}-${environment}`
        const cfn = new CloudFormationClient(process.env.AWS_REGION || 'us-east-1')

        let currentTemplate = '{}'
        try {
          const result = await cfn.getTemplate(stackName)
          currentTemplate = result.TemplateBody
        }
        catch {
          log.info('No deployed stack found. Showing full template as diff.')
        }

        if (currentTemplate === newTemplate) {
          log.info('No changes detected.')
        }
        else {
          log.info('Changes detected between deployed and local template:')
          log.info(`Current template: ${currentTemplate.length} bytes`)
          log.info(`New template: ${newTemplate.length} bytes`)
        }
      }
      catch (error: any) {
        await outro(
          'While running the cloud diff command, there was an issue',
          { startTime, useSeconds: true },
          error.message,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Cloud diff complete', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:dashboard', descriptions.dashboard)
    .alias('cloud:cockpit')
    .option('--host [host]', descriptions.host, { default: '127.0.0.1' })
    .option('--port [port]', descriptions.port, { default: '7676' })
    .option('--env [env]', descriptions.env)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions & { host?: string, port?: string, env?: string }) => {
      log.debug('Running `buddy cloud:dashboard` ...', options)
      const startTime = await intro('buddy cloud:dashboard')

      // The cockpit (server management UI) lives in ts-cloud; it builds the stx
      // dashboard with this project's LIVE data and serves it locally with a small
      // control API (run deploys, manage SSH keys + sites, restart services).
      const tsCloud = await import('@stacksjs/ts-cloud') as { startLocalDashboardServer?: (opts: any) => Promise<{ url: string }> }
      if (typeof tsCloud.startLocalDashboardServer !== 'function') {
        await outro(
          'The installed @stacksjs/ts-cloud does not provide the local cockpit yet',
          { startTime, useSeconds: true },
          'Update your dependencies (requires @stacksjs/ts-cloud >= 0.5.27).',
        )
        process.exit(ExitCode.FatalError)
      }

      try {
        const server = await tsCloud.startLocalDashboardServer({
          host: options.host ? String(options.host) : undefined,
          port: options.port ? Number(options.port) : undefined,
          environment: options.env,
          verbose: !!options.verbose,
        })
        log.success(`Stacks Cloud cockpit running at ${underline(server.url)}`)
        log.info(italic('Manage servers, sites, SSH keys and deploys. Press Ctrl+C to stop.'))
        // Hold the process open while the dashboard server runs.
        await new Promise(() => {})
      }
      catch (error: any) {
        await outro(
          'While starting the cloud dashboard, there was an issue',
          { startTime, useSeconds: true },
          error?.message ?? String(error),
        )
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('cloud:sites', descriptions.sites)
    .option('--env [env]', descriptions.sitesEnv)
    .option('--no-remote', descriptions.remote)
    .option('-J, --json', descriptions.json, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions & { env?: string, remote?: boolean, json?: boolean }) => {
      log.debug('Running `buddy cloud:sites` ...', options)

      const { formatInventory, probeHostRoutes } = await import('@stacksjs/ts-cloud')
      const { loadTsCloudConfig } = await import('./deploy')

      const environment = String(options.env || process.env.APP_ENV || process.env.NODE_ENV || 'production')
      const tsCloudConfig = await loadTsCloudConfig(options.env ? environment : undefined)
      const slug = tsCloudConfig?.project?.slug || 'app'
      await assertFleetProvider(tsCloudConfig, 'cloud:sites')

      const listing = await listFleet(tsCloudConfig)
      if (listing.problem)
        await log.error(listing.problem)

      const declared = await declaredSitesFor(tsCloudConfig, slug)
      const probes = options.remote === false ? [] : await probeFleet(listing.servers)
      const inventory = { slug, servers: listing.servers, probes, declared }

      if (options.json) {
        console.log(JSON.stringify({ environment, ...inventory }, null, 2))
      }
      else {
        for (const line of formatInventory(inventory))
          console.log(line)
      }

      // An empty fleet is a fine answer; an empty fleet BECAUSE the lookup
      // failed is not, and the two must not exit the same way.
      process.exit(listing.problem && listing.servers.length === 0 ? ExitCode.FatalError : ExitCode.Success)

      async function probeFleet(servers: any[]): Promise<any[]> {
        const { sshExec } = await import('@stacksjs/ts-cloud')
        const probes: any[] = []
        // Batched rather than one Promise.all over the fleet: each probe opens
        // an SSH connection, and a large project should not fire forty at once.
        for (let index = 0; index < servers.length; index += 6) {
          probes.push(...await Promise.all(
            servers.slice(index, index + 6).map(server =>
              probeHostRoutes(server, (host: string, command: string) =>
                sshExec(host, command, { user: 'root', connectTimeoutSec: 10 })),
            ),
          ))
        }
        return probes
      }
    })

  buddy
    .command('cloud:attach', descriptions.attach)
    .option('--server <server>', descriptions.attachServer)
    .option('--env [env]', descriptions.sitesEnv)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-J, --json', descriptions.json, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions & { server?: string, env?: string, dryRun?: boolean, json?: boolean }) => {
      log.debug('Running `buddy cloud:attach` ...', options)

      const {
        attachConflicts,
        attachIsViable,
        attachPreconditions,
        formatAttachPlan,
        probeHostRoutes,
        resolveAttachTarget,
        setAttachToInCloudConfig,
        sshExec,
      } = await import('@stacksjs/ts-cloud')
      const { loadTsCloudConfig } = await import('./deploy')

      if (!options.server)
        return await refuse('Which server? Pass --server <name|owner-slug>. `buddy cloud:sites` lists them.')

      const environment = String(options.env || process.env.APP_ENV || process.env.NODE_ENV || 'production')
      const tsCloudConfig = await loadTsCloudConfig(options.env ? environment : undefined)
      const slug = tsCloudConfig?.project?.slug || 'app'
      await assertFleetProvider(tsCloudConfig, 'cloud:attach')

      const listing = await listFleet(tsCloudConfig)
      if (listing.problem)
        return await refuse(listing.problem)

      const target = resolveAttachTarget(listing.servers, String(options.server), environment)
      if ('problem' in target)
        return await refuse(`${target.problem} \`buddy cloud:sites\` lists what is there.`)

      const server = target.server
      const preconditions = attachPreconditions(slug, server)
      if (preconditions.length > 0)
        return await refuse(...preconditions)

      const declared = await declaredSitesFor(tsCloudConfig, slug)
      const probe = await probeHostRoutes(server, (host: string, command: string) =>
        sshExec(host, command, { user: 'root', connectTimeoutSec: 10 }))

      const plan = {
        slug,
        owner: server.project as string,
        server,
        declared,
        conflicts: probe.unavailable ? [] : attachConflicts(slug, declared, probe.routes),
        registryRead: !probe.unavailable,
        registryProblem: probe.unavailable,
      }

      // The config is only edited once the box has been asked and answered
      // clean. Writing first and checking after would leave a repo claiming an
      // attach that must not happen.
      const viable = attachIsViable(plan)
      const edit = viable ? await applyAttachToConfig(plan.owner, Boolean(options.dryRun)) : undefined

      if (options.json) {
        console.log(JSON.stringify({ environment, ...plan, edit }, null, 2))
      }
      else {
        for (const line of formatAttachPlan(plan))
          console.log(line)
        if (edit)
          console.log(['', ...describeAttachEdits(plan.slug, plan.owner, edit, Boolean(options.dryRun))].join('\n'))
      }

      // An unchecked attach is not a successful one: exiting 0 after failing to
      // read the box would let a CI job proceed on a check that never ran.
      process.exit(viable ? ExitCode.Success : ExitCode.FatalError)

      async function applyAttachToConfig(owner: string, dryRun: boolean): Promise<AttachEditOutcome> {
        const configPath = p.projectPath('config/cloud.ts')
        const { readFileSync, writeFileSync } = await import('node:fs')
        const before = readFileSync(configPath, 'utf8')

        try {
          const after = setAttachToInCloudConfig({ configText: before, owner })
          if (after === before)
            return { state: 'already-set' }

          if (dryRun)
            return { state: 'would-write' }

          writeFileSync(configPath, after)
          return { state: 'written' }
        }
        catch (error) {
          return { state: 'refused', reason: error instanceof Error ? error.message : String(error) }
        }
      }
    })

  buddy
    .command('cloud:rename <server>', descriptions.rename)
    .option('--to <name>', descriptions.renameTo)
    .option('--env [env]', descriptions.renameEnv)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-J, --json', descriptions.renameJson, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string, options: CloudCliOptions & { to?: string, env?: string, dryRun?: boolean, json?: boolean }) => {
      log.debug('Running `buddy cloud:rename` ...', options)

      const { applyPlan, formatPlan, pendingSteps, planServerRename, resolvePlan, validateServerName } = await import('@stacksjs/ts-cloud')
      const { loadTsCloudConfig } = await import('./deploy')

      if (!options.to)
        return await refuse('Rename it to what? Pass --to <name>.')

      const next = String(options.to)
      try {
        // A server name becomes a hostname, so the provider's rules are the
        // framework's rules. Saying which character is wrong beats a 422 from
        // the provider three steps later.
        validateServerName(next)
      }
      catch (error) {
        return await refuse(error instanceof Error ? error.message : String(error))
      }

      const environment = String(options.env || process.env.APP_ENV || process.env.NODE_ENV || 'production')
      const tsCloudConfig = await loadTsCloudConfig(options.env ? environment : undefined)
      await assertFleetProvider(tsCloudConfig, 'cloud:rename')

      const listing = await listFleet(tsCloudConfig)
      if (listing.problem)
        return await refuse(listing.problem)

      const current = listing.servers.find((s: any) => s?.name === server)
      if (!current)
        return await refuse(`No server named ${server}. \`buddy cloud:sites\` lists what is there.`)

      if (server === next)
        return await refuse(`${server} is already called that.`)

      const plan = await planServerRename(server, next, await renameEffects(tsCloudConfig, listing.servers, current, environment))
      const resolved = await resolvePlan(plan)
      const pending = pendingSteps(resolved)

      if (options.json) {
        console.log(JSON.stringify({
          operation: plan.operation,
          target: plan.target,
          to: next,
          steps: resolved.map(entry => ({
            id: entry.step.id,
            title: entry.step.title,
            state: entry.state,
            reason: entry.reason,
            change: entry.step.change,
          })),
        }, null, 2))
        return
      }

      console.log('')
      // ts-cloud formats its own plans, so two runs of an unchanged plan print
      // identically and can be diffed - which is the point of planning first.
      for (const line of formatPlan(plan, resolved))
        console.log(line)
      console.log('')

      if (options.dryRun) {
        await log.info(`Dry run: ${pending.length} step(s) would run. Nothing changed.`)
        return
      }

      if (pending.length === 0) {
        await log.success(`${server} is already named ${next} everywhere. Nothing to do.`)
        return
      }

      const outcome = await applyPlan(plan, resolved, { log: message => console.log(`  ${message}`) })

      if (!outcome.success) {
        // Steps re-derive their own state, so a run that stopped part-way is
        // fixed by running it again rather than by undoing anything.
        const failed = outcome.steps.find(step => step.state === 'failed')
        return await refuse(
          `Stopped at: ${failed?.title ?? 'an unnamed step'}`,
          failed?.error ?? 'The step gave no reason.',
          `Re-run \`buddy cloud:rename ${server} --to ${next}\` to continue: completed steps skip themselves.`,
        )
      }

      await log.success(`Renamed ${server} to ${next}`)
    })

  buddy
    .command('cloud:destroy <server>', descriptions.destroy)
    .option('--env [env]', descriptions.destroyEnv)
    .option('--confirm <name>', descriptions.destroyConfirm)
    .option('--discard-drained', descriptions.destroyDiscardDrained, { default: false })
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-J, --json', descriptions.destroyJson, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string, options: CloudCliOptions & { confirm?: string, discardDrained?: boolean, env?: string, dryRun?: boolean, json?: boolean }) => {
      log.debug('Running `buddy cloud:destroy` ...', options)

      const {
        applyPlan,
        buildDrainedSiteScanScript,
        formatDrainedSiteRefusal,
        formatPlan,
        parseDrainedSites,
        pendingSteps,
        resolvePlan,
        sshExec,
      } = await import('@stacksjs/ts-cloud')
      const { loadTsCloudConfig } = await import('./deploy')

      const environment = String(options.env || process.env.APP_ENV || process.env.NODE_ENV || 'production')
      const tsCloudConfig = await loadTsCloudConfig(options.env ? environment : undefined)
      await assertFleetProvider(tsCloudConfig, 'cloud:destroy')

      const listing = await listFleet(tsCloudConfig)
      if (listing.problem)
        return await refuse(listing.problem)

      const current = listing.servers.find((s: any) => s?.name === server)
      if (!current)
        return await refuse(`No server named ${server}. \`buddy cloud:sites\` lists what is there.`)

      const slug = String(tsCloudConfig?.project?.slug || 'app')

      // A precondition, not a step: whether this box is holding somebody's
      // rollback decides whether the teardown may run at all, and a plan that
      // printed as runnable and then refused would be worse than not printing.
      if (current.ipv4 && !options.discardDrained) {
        const scan = await sshExec(current.ipv4, buildDrainedSiteScanScript(slug).join('\n'), {
          user: 'root',
          connectTimeoutSec: 10,
        })
        if (scan.code === 0) {
          const drained = parseDrainedSites(scan.stdout)
          if (drained.length > 0)
            return await refuse(formatDrainedSiteRefusal(drained, slug, '--discard-drained'))
        }
        else if (!options.dryRun) {
          // Unreachable means unscanned, and unscanned is not the same as clean.
          return await refuse(
            `Could not scan ${server} for drained sites: ${scan.stderr.trim() || 'the box did not answer over SSH.'}`,
            'A box that cannot be scanned may still be holding a rollback. Re-run with --discard-drained if it is not.',
          )
        }
      }

      const plan = planServerDestroy(server, await destroyEffects(tsCloudConfig, current, environment))
      const resolved = await resolvePlan(plan)
      const pending = pendingSteps(resolved)

      if (options.json) {
        console.log(JSON.stringify({
          operation: plan.operation,
          target: plan.target,
          steps: resolved.map(entry => ({
            id: entry.step.id,
            title: entry.step.title,
            state: entry.state,
            reason: entry.reason,
            destructive: entry.step.destructive,
            change: entry.step.change,
          })),
        }, null, 2))
        return
      }

      console.log('')
      for (const line of formatPlan(plan, resolved))
        console.log(line)
      console.log('')

      if (options.dryRun) {
        await log.info(`Dry run: ${pending.length} step(s) would run. Nothing changed.`)
        return
      }

      if (pending.length === 0) {
        await log.success(`${server} is already gone, and nothing still points at it.`)
        return
      }

      if (options.confirm !== server) {
        // A flag rather than a prompt, so a teardown is drivable from CI - and
        // the exact name rather than a yes, so the flag cannot be pasted from a
        // run against a different box.
        return await refuse(
          `Destroying ${server} cannot be undone.`,
          `Re-run with \`--confirm ${server}\` to go ahead.`,
        )
      }

      const outcome = await applyPlan(plan, resolved, {
        log: message => console.log(`  ${message}`),
        confirm: options.confirm,
      })

      if (!outcome.success) {
        const failed = outcome.steps.find(step => step.state === 'failed')
        return await refuse(
          `Stopped at: ${failed?.title ?? 'an unnamed step'}`,
          failed?.error ?? 'The step gave no reason.',
          `Re-run \`buddy cloud:destroy ${server} --confirm ${server}\` to continue: completed steps skip themselves.`,
        )
      }

      await log.success(`Destroyed ${server}`)
    })

  buddy
    .command('cloud:move <site>', descriptions.move)
    .option('--to <server>', descriptions.moveTo)
    .option('--from <server>', descriptions.moveFrom)
    .option('--env [env]', descriptions.moveEnv)
    .option('--confirm <site>', descriptions.moveConfirm)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-J, --json', descriptions.moveJson, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (site: string, options: CloudCliOptions & { to?: string, from?: string, confirm?: string, env?: string, dryRun?: boolean, json?: boolean }) => {
      log.debug('Running `buddy cloud:move` ...', options)

      const {
        applyPlan,
        formatPlan,
        gatewayHostnames,
        pendingSteps,
        planSiteMove,
        probeHostRoutes,
        resolveAttachTarget,
        resolvePlan,
        siteInstallBase,
        sshExec,
      } = await import('@stacksjs/ts-cloud')
      const { loadTsCloudConfig } = await import('./deploy')

      if (!options.to)
        return await refuse('Move it where? Pass --to <name|owner-slug>. `buddy cloud:sites` lists them.')

      const environment = String(options.env || process.env.APP_ENV || process.env.NODE_ENV || 'production')
      const tsCloudConfig = await loadTsCloudConfig(options.env ? environment : undefined)
      const slug = String(tsCloudConfig?.project?.slug || 'app')
      await assertFleetProvider(tsCloudConfig, 'cloud:move')

      // Deliberately untyped: this is handed straight to ts-cloud, whose
      // SiteConfig is the authority on the shape, and buddy re-declaring it is
      // how the two drift.
      const rawSite: any = (tsCloudConfig?.sites ?? {})[site]
      if (!rawSite)
        return await refuse(`config/cloud.ts declares no site named '${site}'.`)

      const listing = await listFleet(tsCloudConfig)
      if (listing.problem)
        return await refuse(listing.problem)

      const resolvedTarget = resolveAttachTarget(listing.servers, String(options.to), environment)
      if ('problem' in resolvedTarget)
        return await refuse(`${resolvedTarget.problem} \`buddy cloud:sites\` lists what is there.`)
      const target = resolvedTarget.server

      const hostnames: string[] = gatewayHostnames(
        { [site]: rawSite },
        { autoWww: Boolean(tsCloudConfig?.infrastructure?.compute?.proxy?.autoWww) },
      )

      const source = options.from
        ? listing.servers.find((s: any) => s?.name === options.from)
        : await serverServing(listing.servers, hostnames, (candidate: any) =>
            probeHostRoutes(candidate, (host: string, command: string) => sshExec(host, command, { user: 'root', connectTimeoutSec: 10 })))

      if (!source) {
        return await refuse(
          options.from
            ? `No server named ${options.from}.`
            : `Could not tell which server serves '${site}'. Pass --from <name> to say.`,
        )
      }

      if (source.name === target.name)
        return await refuse(`'${site}' is already on ${target.name}.`)
      if (!source.ipv4 || !target.ipv4)
        return await refuse(`A move needs an address for both boxes, and ${(source.ipv4 ? target : source).name} has none.`)

      let plan
      try {
        plan = await planSiteMove(
          {
            slug,
            siteName: site,
            appBase: siteInstallBase(slug, site),
            from: source.name,
            to: target.name,
            targetAddress: target.ipv4,
            port: Number(rawSite?.port) || undefined,
            database: await onBoxDatabase(tsCloudConfig),
          },
          await moveEffects({ tsCloudConfig, slug, siteName: site, rawSite, source, target, hostnames }),
        )
      }
      catch (error) {
        // Preconditions are checked while the plan is built, so this is a move
        // that must not happen rather than one that failed part-way.
        return await refuse(error instanceof Error ? error.message : String(error))
      }

      const resolved = await resolvePlan(plan)
      const pending = pendingSteps(resolved)

      if (options.json) {
        console.log(JSON.stringify({
          operation: plan.operation,
          target: plan.target,
          from: source.name,
          to: target.name,
          hostnames,
          steps: resolved.map(entry => ({
            id: entry.step.id,
            title: entry.step.title,
            state: entry.state,
            reason: entry.reason,
            destructive: entry.step.destructive,
            change: entry.step.change,
          })),
        }, null, 2))
        return
      }

      console.log('')
      for (const line of formatPlan(plan, resolved))
        console.log(line)
      console.log('')

      if (options.dryRun) {
        await log.info(`Dry run: ${pending.length} step(s) would run. Nothing changed.`)
        return
      }

      if (pending.length === 0) {
        await log.success(`'${site}' is already on ${target.name}, serving and cut over.`)
        return
      }

      const outcome = await applyPlan(plan, resolved, {
        log: message => console.log(`  ${message}`),
        confirm: options.confirm,
      })

      if (!outcome.success) {
        const failed = outcome.steps.find(step => step.state === 'failed')
        return await refuse(
          `Stopped at: ${failed?.title ?? 'an unnamed step'}`,
          failed?.error ?? 'The step gave no reason.',
          `The source still holds the site's files - that is the rollback. Re-run `
          + `\`buddy cloud:move ${site} --to ${target.name}\` to continue: completed steps skip themselves.`,
        )
      }

      await log.success(`Moved '${site}' from ${source.name} to ${target.name}`)

    })

  onUnknownSubcommand(buddy, "cloud")
}
