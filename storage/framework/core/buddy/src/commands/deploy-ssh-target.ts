/**
 * Where an SSH deploy is going, and what it is allowed to do when it gets there.
 *
 * `buddy deploy` has two SSH-shaped targets: a Hetzner box ts-cloud provisioned
 * and a plain Linux host somebody already owns (`cloud.provider: 'ssh'`, a
 * Raspberry Pi being the case this was built for). Everything they differ on is
 * decided here, in pure functions, so the decisions can be tested without a box:
 * which host and user to talk to, whether the address is one the public DNS may
 * ever hear about, and what to tell the user at the end.
 *
 * The Hetzner path keeps its exact behaviour. `hetznerTarget` reproduces the
 * `root@<ip>` on port 22 the raw `execSync('ssh ...')` call sites built inline,
 * argument for argument, so routing them through here changes nothing for it.
 */

/** A provider whose deploy runs over SSH rather than CloudFormation. */
export type SshPipelineProvider = 'hetzner' | 'ssh'

/** Tuning that only applies to a small single-board computer. */
export type SshProfile = 'raspberry-pi' | 'generic'

/** How much the deploy trusts a host key it has not seen before. */
export type SshHostKeyPolicy = 'pin' | 'accept-new' | 'insecure'

/** Everything needed to open an SSH connection to the deploy target. */
export interface SshTarget {
  host: string
  user: string
  port: number
  /** Absolute path to a private key, or undefined to let ssh decide (agent, ~/.ssh/config). */
  identityFile?: string
  profile: SshProfile
  hostKey: SshHostKeyPolicy
}

/** One host as declared in `ssh.hosts`. */
export interface SshHostConfig {
  host?: string
  user?: string
  port?: number
  privateKeyPath?: string
  role?: string
}

/** The `ssh` block of a ts-cloud config. */
export interface SshConfigBlock {
  hosts?: SshHostConfig[]
  hostKey?: SshHostKeyPolicy
  sudo?: boolean
  profile?: SshProfile
  /** A public address for DNS, or 'auto' to discover it at deploy time. */
  publicIp?: 'auto' | string
  lan?: { hostname?: string, tls?: 'local-ca' | 'off' }
}

const DEFAULT_SSH_PORT = 22
const DEFAULT_CONNECT_TIMEOUT_SECS = 15

/** True for the providers that deploy by copying a tarball over SSH. */
export function isSshPipelineProvider(provider: string | undefined): provider is SshPipelineProvider {
  return provider === 'hetzner' || provider === 'ssh'
}

/** Expand a leading `~/` against the current user's home directory. */
function expandHome(value: string, env: NodeJS.ProcessEnv): string {
  if (!value.startsWith('~/'))
    return value

  const home = env.HOME || env.USERPROFILE
  return home ? `${home}/${value.slice(2)}` : value
}

/**
 * The target a Hetzner deploy has always used: root, port 22, key left to ssh.
 *
 * Passing an already-built target through unchanged lets a call site accept
 * either an IP string (every existing caller) or a full target.
 */
export function hetznerTarget(ip: string): SshTarget {
  return { host: ip, user: 'root', port: DEFAULT_SSH_PORT, profile: 'generic', hostKey: 'accept-new' }
}

/** Normalise a call-site argument that may still be a bare IP string. */
export function toSshTarget(value: string | SshTarget): SshTarget {
  return typeof value === 'string' ? hetznerTarget(value) : value
}

/**
 * Resolve the SSH target for a `provider: 'ssh'` deploy.
 *
 * Precedence is env over config, so a CI run or a one-off can point at another
 * box without editing `config/cloud.ts`. Returns null when no host is known at
 * all; the caller turns that into a message about what to configure, because
 * "no host" is a setup mistake rather than a failure worth a stack trace.
 */
export function resolveSshTarget(
  tsCloudConfig: { ssh?: SshConfigBlock } | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SshTarget | null {
  const ssh = tsCloudConfig?.ssh
  const hosts = Array.isArray(ssh?.hosts) ? ssh.hosts : []
  // A host with no role is the app host; that is the only role v1 deploys to.
  const declared = hosts.find(entry => !entry?.role || entry.role === 'app')

  const host = env.TS_CLOUD_SSH_HOST || declared?.host
  if (!host)
    return null

  const user = env.TS_CLOUD_SSH_USER || declared?.user || 'root'

  const envPort = env.TS_CLOUD_SSH_PORT ? Number.parseInt(env.TS_CLOUD_SSH_PORT, 10) : Number.NaN
  const configPort = Number(declared?.port)
  const port = Number.isFinite(envPort) && envPort > 0
    ? envPort
    : Number.isFinite(configPort) && configPort > 0 ? configPort : DEFAULT_SSH_PORT

  const key = env.TS_CLOUD_SSH_KEY || declared?.privateKeyPath
  const hostKeyRaw = env.TS_CLOUD_SSH_HOST_KEY || ssh?.hostKey
  const hostKey: SshHostKeyPolicy = hostKeyRaw === 'accept-new' || hostKeyRaw === 'insecure' ? hostKeyRaw : 'pin'

  const profileRaw = env.TS_CLOUD_SSH_PROFILE || ssh?.profile
  const profile: SshProfile = profileRaw === 'raspberry-pi' ? 'raspberry-pi' : 'generic'

  return {
    host,
    user,
    port,
    identityFile: key ? expandHome(key, env) : undefined,
    profile,
    hostKey,
  }
}

/**
 * The argv for an `ssh` invocation against a target.
 *
 * For a Hetzner target this is byte-identical to the array the call sites built
 * inline, so nothing about that path changes. A pinned host key is expressed as
 * `StrictHostKeyChecking=yes` against a known_hosts the caller supplies; ts-cloud
 * writes the pin, so buddy only has to honour it.
 */
export function sshCliArgs(
  target: SshTarget,
  options: { connectTimeoutSec?: number, knownHostsFile?: string } = {},
): string[] {
  const timeout = options.connectTimeoutSec ?? DEFAULT_CONNECT_TIMEOUT_SECS
  const args: string[] = []

  if (target.hostKey === 'insecure') {
    args.push('-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null')
  }
  else if (target.hostKey === 'pin' && options.knownHostsFile) {
    args.push('-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${options.knownHostsFile}`)
  }
  else {
    args.push('-o', 'StrictHostKeyChecking=accept-new')
    if (options.knownHostsFile)
      args.push('-o', `UserKnownHostsFile=${options.knownHostsFile}`)
  }

  args.push('-o', 'BatchMode=yes', '-o', `ConnectTimeout=${timeout}`)

  if (target.port !== DEFAULT_SSH_PORT)
    args.push('-p', String(target.port))

  if (target.identityFile)
    args.push('-i', target.identityFile)

  args.push(`${target.user}@${target.host}`)
  return args
}

/** The options object ts-cloud's own SSH helpers take for this target. */
export function remoteExecOptions(
  target: SshTarget,
  connectTimeoutSec: number = DEFAULT_CONNECT_TIMEOUT_SECS,
): { user: string, port?: number, identityFile?: string, connectTimeoutSec: number } {
  return {
    user: target.user,
    ...(target.port !== DEFAULT_SSH_PORT ? { port: target.port } : {}),
    ...(target.identityFile ? { identityFile: target.identityFile } : {}),
    connectTimeoutSec,
  }
}

/**
 * True for an address the public internet cannot route to.
 *
 * A LAN deploy must never publish its own address: an A record pointing at
 * 192.168.x.y is not merely useless, it hands every visitor's browser a name
 * that resolves to whatever sits at that address on THEIR network. Bare
 * hostnames and mDNS names count as private for the same reason.
 */
export function isPrivateHost(host: string): boolean {
  const value = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!value)
    return true

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || a === 0)
      return true
    if (a === 172 && b >= 16 && b <= 31)
      return true
    if (a === 192 && b === 168)
      return true
    // Carrier-grade NAT: routable-looking, unreachable from outside the ISP.
    if (a === 100 && b >= 64 && b <= 127)
      return true
    if (a === 169 && b === 254)
      return true
    return false
  }

  if (value.includes(':')) {
    if (value === '::1' || value === '::')
      return true
    // Unique-local fc00::/7 and link-local fe80::/10.
    if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value))
      return true
    return false
  }

  if (value === 'localhost')
    return true

  // mDNS and the conventional private suffixes, plus any single-label name.
  if (/\.(local|localhost|internal|lan|intranet|home\.arpa)$/.test(value))
    return true

  return !value.includes('.')
}

/**
 * Whether this deploy may publish DNS, request certificates and touch the CDN.
 *
 * Hetzner always may. An SSH host may only when it has an address the world can
 * reach and at least one site that claims a domain, because ACME validation and
 * an A record are both meaningless otherwise. `TS_CLOUD_SSH_PUBLISH_DNS` forces
 * the answer either way, for a Pi behind a port forward whose public address
 * this process cannot see.
 */
export function dnsPublishingAllowed(input: {
  provider: string
  publicIp?: string
  /** A site may declare one domain or several; either counts as claiming one. */
  sites?: Record<string, { domain?: string | string[] } | null | undefined>
  env?: NodeJS.ProcessEnv
}): boolean {
  if (input.provider !== 'ssh')
    return true

  const override = (input.env ?? process.env).TS_CLOUD_SSH_PUBLISH_DNS
  if (override === '0' || override === 'false')
    return false

  const hasDomain = Object.values(input.sites ?? {}).some((site) => {
    const domain = site?.domain
    return Array.isArray(domain) ? domain.length > 0 : Boolean(domain)
  })
  if (!hasDomain)
    return false

  if (override === '1' || override === 'true')
    return true

  return Boolean(input.publicIp) && !isPrivateHost(input.publicIp as string)
}

/**
 * Merge a pin over whatever is already recorded for this stack.
 *
 * The driver writes its own pin while provisioning, carrying things only it
 * learns: the host key fingerprint it pinned, the address the box reports on
 * the local network, which bootstrap version ran. A caller that then writes its
 * own pin over the top silently discards them. Only keys this caller actually
 * has a value for are allowed to win.
 */
export function mergeSshStatePin(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || existing.provider !== 'ssh')
    return next

  const merged: Record<string, unknown> = { ...existing }
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== null && value !== '')
      merged[key] = value
  }
  return merged
}

/** The persisted pin an SSH deploy writes so the next one skips discovery. */
export function sshStatePin(input: {
  stackName: string
  target: SshTarget
  deployStoragePath?: string
  hostKeyFingerprint?: string
  lanIp?: string
  bootstrapVersion?: number
}): Record<string, unknown> {
  return {
    provider: 'ssh',
    stackName: input.stackName,
    host: input.target.host,
    // ts-cloud resolves a target from `publicIp`; keeping it means the shared
    // lookup path needs no special case for this provider.
    publicIp: input.target.host,
    sshUser: input.target.user,
    sshPort: input.target.port,
    ...(input.target.identityFile ? { sshPrivateKeyPath: input.target.identityFile } : {}),
    ...(input.hostKeyFingerprint ? { hostKeyFingerprint: input.hostKeyFingerprint } : {}),
    ...(input.lanIp ? { lanIp: input.lanIp } : {}),
    profile: input.target.profile,
    deployStoragePath: input.deployStoragePath ?? '/var/ts-cloud/staging',
    ...(input.bootstrapVersion ? { bootstrapVersion: input.bootstrapVersion } : {}),
  }
}

/**
 * Where to reach the app on the local network after a LAN deploy.
 *
 * The gateway answers on 443 for the hostname it holds a local certificate for,
 * so that is the address to lead with. Each site's own port is listed too: only
 * one name resolves over mDNS, so a second site is reachable by port until the
 * user gives it a name their router or hosts file can resolve.
 */
export function lanUrls(
  sites: Record<string, { domain?: string | string[], port?: number } | null | undefined> | undefined,
  target: SshTarget,
  lanHostname?: string,
): string[] {
  const gatewayHost = lanHostname || target.host
  const urls = [`https://${gatewayHost}`]

  for (const site of Object.values(sites ?? {})) {
    const port = Number(site?.port)
    // 127.0.0.1-bound sites are internal; they never answer from off the box.
    if (Number.isFinite(port) && port > 0)
      urls.push(`http://${gatewayHost}:${port}`)
  }

  return urls
}

/** What to call this deploy target in log lines the user reads. */
export function deployTargetLabel(provider: string, profile?: SshProfile): string {
  if (provider === 'hetzner')
    return 'Hetzner Cloud'

  if (provider === 'ssh')
    return profile === 'raspberry-pi' ? 'Raspberry Pi over SSH' : 'SSH host'

  return provider
}

/** One server as the fleet listing reports it. */
export interface SshInventoryServer {
  id: string
  name: string
  status: string
  ipv4?: string
  ipv6?: string
  type?: string
  location?: string
  labels: Record<string, string>
  project?: string
  environment?: string
  role?: string
}

/**
 * The fleet of an `ssh` project, assembled without a provider API.
 *
 * There is nothing to enumerate: a host is in the fleet because the config or a
 * previous deploy's state pin names it. Hosts are keyed by address so a pin and
 * the config entry it came from do not list the same box twice, and the config
 * wins, because it is what the next deploy will actually use.
 */
export function sshFleetFromConfigAndState(
  tsCloudConfig: { ssh?: SshConfigBlock, project?: { slug?: string } } | undefined,
  pins: Array<Record<string, unknown>> = [],
): SshInventoryServer[] {
  const project = tsCloudConfig?.project?.slug
  const byHost = new Map<string, SshInventoryServer>()

  for (const pin of pins) {
    if (pin?.provider !== 'ssh')
      continue

    const host = typeof pin.host === 'string'
      ? pin.host
      : typeof pin.publicIp === 'string' ? pin.publicIp : ''
    if (!host)
      continue

    const stackName = typeof pin.stackName === 'string' ? pin.stackName : ''
    byHost.set(host, {
      id: host,
      name: stackName || host,
      // Nothing polls these hosts, so 'running' would be a claim rather than an
      // observation. `buddy server:doctor` is what actually asks.
      status: 'unknown',
      ipv4: isPrivateHost(host) ? undefined : host,
      labels: {},
      project,
      environment: stackName.includes('-') ? stackName.slice(stackName.lastIndexOf('-') + 1) : undefined,
      role: 'app',
    })
  }

  for (const entry of tsCloudConfig?.ssh?.hosts ?? []) {
    if (!entry?.host)
      continue

    const existing = byHost.get(entry.host)
    byHost.set(entry.host, {
      ...existing,
      id: entry.host,
      name: existing?.name || entry.host,
      status: existing?.status || 'unknown',
      ipv4: isPrivateHost(entry.host) ? undefined : entry.host,
      labels: existing?.labels ?? {},
      project,
      role: entry.role || 'app',
    })
  }

  return [...byHost.values()].sort((a, b) => a.name.localeCompare(b.name))
}
