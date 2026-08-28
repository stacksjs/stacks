/**
 * Attaching this project to a server another project owns.
 *
 * The mechanism already exists and works: set `cloud.attachTo` to the owner's
 * slug and `buddy deploy` puts this project's sites on that box instead of
 * provisioning one. What has never existed is the check BEFORE the deploy.
 *
 * Every way an attach goes wrong is currently discovered while it is going
 * wrong. `assertPortsAreFree` catches a port clash from the deploying machine
 * over SSH, and the deploy's slug guard catches a tenant claiming the owner's
 * own gateway fragment - both good, both late, both after the operator has
 * committed a config change and started shipping. The worst case does not even
 * error: ts-cloud's units do not bind exclusively, so two services on one port
 * both bind and the kernel load-balances between them, which is how
 * predicthq.org spent a day and a half serving a storefront to half its
 * visitors (see `deploy-port-collision.test.ts`).
 *
 * So this module answers one question, from data rather than from config:
 * given the box's own gateway registry, is it safe for this project to attach?
 * Ports, hostnames and slug identity are all checked against what the box is
 * actually serving for OTHER projects, which is the only place that is
 * knowable - the tenants deploy from their own repositories and appear in no
 * file here.
 *
 * One thing it deliberately cannot do: the attach needs an edit in the owner's
 * repository too, adding this slug to `tenants` so this project's env keys are
 * recognised as somebody else's. That file is in a different repository, so the
 * edit is printed rather than made.
 */

import type { DeclaredSite, HostedRoute, InventoryServer } from './cloud-inventory'

/** The server an attach would target, or why one could not be picked. */
export type AttachTarget =
  | { server: InventoryServer }
  | { problem: string }

/**
 * Pick the box named by `--server`, by provider name or by owning project.
 *
 * Both spellings are accepted because both are what an operator has: the
 * provider console shows `stacks-production-app`, while `cloud.attachTo` takes
 * the owner's slug (`stacks`). Matching either avoids making the operator
 * translate between them, and an ambiguous match refuses rather than guessing.
 */
export function resolveAttachTarget(servers: readonly InventoryServer[], wanted: string, environment?: string): AttachTarget {
  const target = wanted.trim()
  if (!target)
    return { problem: 'No server named. Pass --server <name|owner-slug>.' }

  const [named, ...alsoNamed] = servers.filter(server => server.name === target)
  if (named && alsoNamed.length === 0)
    return { server: named }

  let byOwner = servers.filter(server => server.project === target)
  if (byOwner.length > 1 && environment)
    byOwner = byOwner.filter(server => !server.environment || server.environment === environment)

  const [owned, ...alsoOwned] = byOwner
  if (owned && alsoOwned.length === 0)
    return { server: owned }

  if (byOwner.length > 1) {
    return {
      problem: `'${target}' owns ${byOwner.length} servers (${byOwner.map(server => server.name).join(', ')}). `
        + 'Name one of them with --server, or narrow it with --env.',
    }
  }

  return {
    problem: `No server matched '${target}'. Nothing is named that, and no box carries the label `
      + `ts-cloud/project=${target}. \`buddy cloud:sites\` lists what is there.`,
  }
}

/**
 * Reasons this attach must not proceed at all, independent of what is on the box.
 *
 * Separate from conflicts because these are about identity rather than
 * occupancy: no amount of moving ports would make them safe.
 */
export function attachPreconditions(slug: string, server: InventoryServer): string[] {
  const problems: string[] = []

  if (!server.project) {
    problems.push(
      `'${server.name}' carries no ts-cloud/project label, so it is not a box ts-cloud provisioned. `
      + 'Attaching to it would deploy into a host nothing here manages.',
    )
  }
  else if (server.project === slug) {
    // The deploy refuses this too, but only once it is already running: a
    // tenant's deploy owns /etc/rpx/sites.d/<slug>.json, so sharing a slug with
    // the owner means overwriting the owner's own gateway fragment and taking
    // its sites down.
    problems.push(
      `This project's slug is '${slug}', which is also the slug that owns '${server.name}'. `
      + 'A tenant deploy owns /etc/rpx/sites.d/<slug>.json, so attaching would overwrite the owner\'s '
      + 'gateway fragment and take its sites down. Change this project\'s slug first.',
    )
  }

  if (server.status !== 'running')
    problems.push(`'${server.name}' is ${server.status}, so what it serves could not be read.`)

  if (!server.ipv4)
    problems.push(`'${server.name}' has no public IPv4 address, so it cannot be reached to check what it serves.`)

  return problems
}

/** A port on the box, and the project already serving it. */
export type PortOwners = Map<number, string>

/**
 * The port from an rpx upstream (`host:port`).
 *
 * Splits on the LAST colon so a bracketed IPv6 literal (`[::1]:3022`) parses as
 * port 3022 rather than as part of the address. Anything that is not a valid
 * TCP port yields nothing, so a malformed route narrows the map instead of
 * poisoning it.
 */
export function parseUpstreamPort(upstream: string): number | undefined {
  const separator = upstream.lastIndexOf(':')
  if (separator < 0)
    return undefined

  const port = Number(upstream.slice(separator + 1))
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

/**
 * Every port the box already serves, mapped to the project that owns it.
 *
 * `ignoreSlug` is this project's own slug: a re-attach finds its own fragment
 * already on the box from the last deploy, and counting it would make every
 * repeat run conflict with itself. Only app routes are read - a static, redirect
 * or proxy route binds no port, and their targets are paths and URLs that
 * happen to contain colons.
 *
 * First writer wins, so two fragments disagreeing produce one stable owner
 * rather than an order-dependent one.
 */
export function portOwners(routes: readonly HostedRoute[], ignoreSlug?: string): PortOwners {
  const owners: PortOwners = new Map()

  for (const route of routes) {
    if (route.kind !== 'app' || route.slug === ignoreSlug)
      continue

    for (const upstream of route.target.split(',')) {
      const port = parseUpstreamPort(upstream.trim())
      if (port !== undefined && !owners.has(port))
        owners.set(port, route.slug)
    }
  }

  return owners
}

export interface AttachConflict {
  kind: 'port' | 'route'
  site: string
  detail: string
  heldBy: string
}

/**
 * Where this project's sites would land on top of another project's.
 *
 * Two independent collisions, and the port one is the dangerous half: a route
 * clash produces a visibly wrong page, while a port clash produces a working
 * box that serves the wrong site to about half its visitors with nothing logged.
 */
export function attachConflicts(slug: string, declared: readonly DeclaredSite[], routes: readonly HostedRoute[]): AttachConflict[] {
  const conflicts: AttachConflict[] = []
  const ports = portOwners(routes, slug)

  const taken = new Map<string, string>()
  for (const route of routes) {
    if (route.slug !== slug)
      taken.set(routeKey(route.host, route.path), route.slug)
  }

  for (const site of declared) {
    if (site.port !== undefined) {
      const holder = ports.get(site.port)
      if (holder)
        conflicts.push({ kind: 'port', site: site.name, detail: `port ${site.port}`, heldBy: holder })
    }

    if (site.domain) {
      const holder = taken.get(routeKey(site.domain, site.path))
      if (holder)
        conflicts.push({ kind: 'route', site: site.name, detail: `${site.domain}${site.path === '/' ? '/' : site.path}`, heldBy: holder })
    }
  }

  return conflicts
}

function routeKey(host: string, path: string): string {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '')
  return `${host.toLowerCase()}${normalized || '/'}`
}

/** The result of editing `config/cloud.ts`, or why it was left alone. */
export type AttachEdit =
  | { text: string, changed: boolean }
  | { problem: string }

/**
 * Set `cloud.attachTo` in a `config/cloud.ts`.
 *
 * Deliberately narrow. This edits TypeScript source with text, which is only
 * defensible while it refuses everything it does not certainly understand, so
 * it handles exactly the shape the scaffold generates:
 *
 *     cloud: {
 *       provider: 'hetzner',
 *     },
 *
 * Anything else - two `cloud:` blocks, a nested object inside it, a one-line
 * form - is reported rather than rewritten, and the caller prints the edit for
 * a person to make. A config mangled by a clever regex is a far worse outcome
 * than a config the tool declined to touch. (ts-cloud has real editors for
 * this in `deploy/site-config-editor`, but they are not reachable from the
 * published package: stacksjs/ts-cloud#191.)
 */
export function setAttachTo(configText: string, owner: string): AttachEdit {
  const blocks = [...configText.matchAll(/\n( {2})cloud: \{\n([\s\S]*?)\n\1\},\n/g)]

  const [match] = blocks
  if (!match)
    return { problem: 'No `cloud: { ... }` block found in config/cloud.ts.' }
  if (blocks.length > 1)
    return { problem: `Found ${blocks.length} \`cloud: { ... }\` blocks in config/cloud.ts, so which one to edit is ambiguous.` }

  const [whole, indent, body] = match
  if (indent === undefined || body === undefined)
    return { problem: 'The `cloud: { ... }` block did not parse into an indent and a body.' }

  if (body.includes('{'))
    return { problem: 'The `cloud: { ... }` block holds a nested object, which this edit does not attempt to rewrite.' }

  const existing = body.match(/^\s*attachTo:\s*(['"])([^'"]*)\1\s*,?\s*$/m)
  if (existing) {
    const [line, quote = '\'', current = ''] = existing
    if (current === owner)
      return { text: configText, changed: false }

    const repointed = line.replace(`${quote}${current}${quote}`, `'${owner}'`)
    return { text: configText.replace(whole, whole.replace(line, repointed)), changed: true }
  }

  const inner = `${indent}  `
  const replacement = whole.replace(
    `\n${indent}},\n`,
    `\n${inner}// Deploy onto the box '${owner}' owns rather than provisioning one.\n${inner}attachTo: '${owner}',\n${indent}},\n`,
  )

  return { text: configText.replace(whole, replacement), changed: true }
}

export interface AttachPlan {
  slug: string
  owner: string
  server: InventoryServer
  declared: readonly DeclaredSite[]
  conflicts: readonly AttachConflict[]
  /** Was the box's registry actually read? A conflict check that saw nothing proves nothing. */
  registryRead: boolean
  /** Why the registry could not be read, when it could not. */
  registryProblem?: string
  /**
   * The `config/cloud.ts` edit, present only when the attach is viable.
   *
   * Absent under a conflict or an unread box on purpose: printing "would set
   * attachTo" underneath a refusal reads as though the operation is going ahead.
   */
  edit?: AttachEdit
  dryRun: boolean
}

/** The plan an operator reads, as lines. */
export function describeAttachPlan(plan: AttachPlan): string[] {
  const { slug, owner, server, declared, conflicts } = plan
  const lines: string[] = []

  lines.push(`Attach '${slug}' to '${server.name}' (${server.ipv4 ?? 'no IPv4'}), owned by '${owner}'.`, '')

  lines.push(`  ${declared.length} site${declared.length === 1 ? '' : 's'} would deploy onto this box:`)
  for (const site of declared) {
    const where = site.loopbackOnly
      ? `loopback only${site.port ? ` on :${site.port}` : ''}`
      : `${site.domain}${site.path === '/' ? '/' : site.path}${site.port ? ` on :${site.port}` : ''}`
    lines.push(`    ${site.name}  ${where}  ->  ${site.installBase ?? '(install path unresolved)'}`)
  }
  lines.push('')

  if (!plan.registryRead) {
    // Saying "no conflicts" here would be a claim about a box nobody asked.
    lines.push(`  Could not read what '${server.name}' already serves: ${plan.registryProblem ?? 'unknown reason'}`)
    lines.push('  So this attach is UNCHECKED: a port or hostname already taken by another')
    lines.push('  project would not error, it would serve that project\'s site from your domain.')
    lines.push('')
  }
  else if (conflicts.length > 0) {
    lines.push(`  ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} with what the box already serves:`)
    for (const conflict of conflicts)
      lines.push(`    site '${conflict.site}' wants ${conflict.detail}, held by '${conflict.heldBy}'`)
    lines.push('')
    lines.push('  Two services on one port do not error: the kernel load-balances, and each')
    lines.push('  domain serves the other\'s site about half the time. Pick free ports and')
    lines.push('  hostnames in config/cloud.ts, then re-run.')
    lines.push('')
  }
  else {
    lines.push(`  No conflicts with what '${server.name}' already serves.`, '')
  }

  if (plan.edit)
    lines.push(...describeEdits(plan, plan.edit))

  return lines
}

function describeEdits(plan: AttachPlan, edit: AttachEdit): string[] {
  const lines: string[] = ['  Two edits make the attach real, in two different repositories:', '']

  if ('problem' in edit) {
    lines.push(`    1. config/cloud.ts here: could not edit it (${edit.problem})`)
    lines.push(`       Add \`attachTo: '${plan.owner}'\` to the \`cloud\` block by hand.`)
  }
  else if (!edit.changed) {
    lines.push(`    1. config/cloud.ts here: already sets attachTo: '${plan.owner}'. Nothing to do.`)
  }
  else if (plan.dryRun) {
    lines.push(`    1. config/cloud.ts here: would set attachTo: '${plan.owner}' (--dry-run, not written)`)
  }
  else {
    lines.push(`    1. config/cloud.ts here: set attachTo: '${plan.owner}'`)
  }

  // The half no command can perform: it lives in the owner's repository.
  lines.push('')
  lines.push(`    2. In the '${plan.owner}' project's own repository, which this command cannot edit:`)
  lines.push(`       add '${plan.slug}' to the \`tenants\` array in its config/cloud.ts.`)
  lines.push(`       Without it, that project's deploy ships ${plan.slug.toUpperCase()}_* keys from its`)
  lines.push('       env files into this project\'s .env instead of dropping them.')
  lines.push('')
  lines.push('  Then `buddy deploy` from here puts these sites on that box.')

  return lines
}
