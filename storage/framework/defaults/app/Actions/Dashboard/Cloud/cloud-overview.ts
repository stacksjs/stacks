import type { CloudConfig } from '@stacksjs/ts-cloud'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { cloudStatePath } from '@stacksjs/path'

type CloudRecord = Record<string, unknown>

export type DashboardCloudStatus = 'attention' | 'configured' | 'deployed' | 'inactive'

export interface DashboardCloudProject {
  name: string
  slug: string
  mode: 'server' | 'serverless'
  provider: string
  region: string
}

export interface DashboardCloudEnvironment {
  name: string
  type: string
  branch: string | null
  domain: string | null
  region: string
  serverless: boolean
  status: DashboardCloudStatus
}

export interface DashboardServerDefinition {
  id: string
  key: string
  name: string
  role: string
  region: string
  size: string
  instances: number
  diskGb: number | null
  diskType: string | null
  encrypted: boolean
  domain: string | null
  operatingSystem: string | null
  bunVersion: string | null
  database: string | null
  status: 'configured'
}

export interface DashboardCloudOperation {
  kind: 'resize'
  phase: string
  status: string
  sourceType: string | null
  targetType: string | null
  startedAt: string | null
  updatedAt: string | null
  attempts: number
}

export interface DashboardServerDeployment {
  id: string
  stackName: string
  environment: string | null
  serverName: string
  provider: string
  publicIp: string | null
  publicIpv6: string | null
  sshUser: string | null
  recordedAt: string
  status: 'attention' | 'deployed'
  operation: DashboardCloudOperation | null
}

export interface DashboardCloudResourceDetail {
  label: string
  value: string
}

export interface DashboardCloudResource {
  id: string
  name: string
  type: string
  category: string
  status: DashboardCloudStatus
  environment: string | null
  description: string
  details: DashboardCloudResourceDetail[]
}

export interface DashboardCloudService {
  id: string
  name: string
  type: string
  description: string
  icon: string
  color: string
  status: DashboardCloudStatus
  environment: string | null
  details: DashboardCloudResourceDetail[]
}

export interface DashboardCloudLink {
  source: string
  target: string
  type: 'routes' | 'serves' | 'uses'
}

export interface DashboardCloudEvent {
  id: string
  service: string
  type: 'attention' | 'info' | 'success'
  message: string
  timestamp: string
}

export interface DashboardCloudSnapshot {
  project: DashboardCloudProject
  environments: DashboardCloudEnvironment[]
  serverDefinitions: DashboardServerDefinition[]
  deployments: DashboardServerDeployment[]
  resources: DashboardCloudResource[]
  serverlessServices: DashboardCloudService[]
  serverlessLinks: DashboardCloudLink[]
  events: DashboardCloudEvent[]
  generatedAt: string
}

interface CloudStateDependencies {
  stateDir?: string
  now?: () => Date
}

interface StateFile {
  path: string
  modifiedAt: string
  value: CloudRecord
}

function record(value: unknown): CloudRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as CloudRecord
    : {}
}

function entries(value: unknown): Array<[string, CloudRecord]> {
  return Object.entries(record(value)).map(([key, item]) => [key, record(item)])
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boolean(value: unknown): boolean {
  return value === true
}

function providerName(config: CloudRecord): string {
  const cloud = record(config.cloud)
  return text(cloud.provider) ?? text(config.provider) ?? 'not configured'
}

function inferredMode(config: CloudRecord): 'server' | 'serverless' {
  if (config.mode === 'server' || config.mode === 'serverless')
    return config.mode

  const hasServerlessEnvironment = entries(config.environments)
    .some(([, environment]) => Object.keys(record(environment.app)).length > 0)
  return hasServerlessEnvironment ? 'serverless' : 'server'
}

function environmentFromStack(stackName: string, slug: string, environments: string[]): string | null {
  const prefix = `${slug}-`
  const suffix = stackName.startsWith(prefix) ? stackName.slice(prefix.length) : ''
  return environments.includes(suffix) ? suffix : null
}

function detail(label: string, value: unknown): DashboardCloudResourceDetail | null {
  if (value === undefined || value === null || value === '')
    return null
  return { label, value: String(value) }
}

function details(...values: Array<DashboardCloudResourceDetail | null>): DashboardCloudResourceDetail[] {
  return values.filter((value): value is DashboardCloudResourceDetail => value !== null)
}

async function readStateFiles(stateDir: string): Promise<StateFile[]> {
  const directory = join(stateDir, 'state')
  let names: string[] = []
  try {
    names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return []
    throw new Error(`Could not read cloud state directory: ${error instanceof Error ? error.message : String(error)}`)
  }

  return await Promise.all(names.map(async (name): Promise<StateFile> => {
    const path = join(directory, name)
    try {
      const [contents, metadata] = await Promise.all([readFile(path, 'utf8'), stat(path)])
      const parsed = JSON.parse(contents)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new TypeError('state root must be an object')
      return {
        path,
        modifiedAt: metadata.mtime.toISOString(),
        value: parsed as CloudRecord,
      }
    }
    catch (error) {
      throw new Error(`Could not read cloud state ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }))
}

function operationFromState(value: CloudRecord): DashboardCloudOperation | null {
  if (!text(value.operationId) || !text(value.stackName))
    return null

  return {
    kind: 'resize',
    phase: text(value.phase) ?? 'unknown',
    status: text(value.status) ?? 'unknown',
    sourceType: text(value.sourceType),
    targetType: text(value.targetType),
    startedAt: text(value.startedAt),
    updatedAt: text(value.updatedAt),
    attempts: number(value.attempts) ?? 0,
  }
}

function operationNeedsAttention(operation: DashboardCloudOperation | null): boolean {
  if (!operation)
    return false
  return !['complete', 'completed', 'succeeded', 'success'].includes(operation.status.toLowerCase())
}

function deploymentFromState(
  state: StateFile,
  operation: DashboardCloudOperation | null,
  slug: string,
  environmentNames: string[],
): DashboardServerDeployment | null {
  const stackName = text(state.value.stackName)
  const serverName = text(state.value.serverName)
  const provider = text(state.value.provider)
  if (!stackName || !serverName || !provider || text(state.value.operationId))
    return null

  return {
    id: `deployment:${stackName}`,
    stackName,
    environment: environmentFromStack(stackName, slug, environmentNames),
    serverName,
    provider,
    publicIp: text(state.value.publicIp),
    publicIpv6: text(state.value.publicIpv6),
    sshUser: text(state.value.sshUser),
    recordedAt: state.modifiedAt,
    status: operationNeedsAttention(operation) ? 'attention' : 'deployed',
    operation,
  }
}

function serverDefinitions(config: CloudRecord, project: DashboardCloudProject): DashboardServerDefinition[] {
  const infrastructure = record(config.infrastructure)
  const compute = record(infrastructure.compute)
  const computeDisk = record(compute.disk)
  const definitions = entries(infrastructure.servers).map(([key, definition]) => {
    const definitionDisk = record(definition.disk)
    return {
      id: `server:${key}`,
      key,
      name: text(definition.name) ?? key,
      role: text(definition.type) ?? key,
      region: text(definition.region) ?? project.region,
      size: text(definition.size) ?? text(definition.instanceType) ?? text(compute.size) ?? 'not set',
      instances: number(definition.instances) ?? 1,
      diskGb: number(definition.diskSize) ?? number(definitionDisk.size) ?? number(computeDisk.size),
      diskType: text(definitionDisk.type) ?? text(computeDisk.type),
      encrypted: boolean(definitionDisk.encrypted) || boolean(computeDisk.encrypted),
      domain: text(definition.domain),
      operatingSystem: text(definition.serverOS) ?? text(definition.os),
      bunVersion: text(definition.bunVersion) ?? text(definition.bun),
      database: text(definition.database),
      status: 'configured' as const,
    }
  })

  if (definitions.length || !Object.keys(compute).length)
    return definitions

  return [{
    id: 'server:compute',
    key: 'compute',
    name: 'Application compute',
    role: 'app',
    region: project.region,
    size: text(compute.size) ?? text(compute.instanceType) ?? 'not set',
    instances: number(compute.instances) ?? 1,
    diskGb: number(computeDisk.size),
    diskType: text(computeDisk.type),
    encrypted: boolean(computeDisk.encrypted),
    domain: null,
    operatingSystem: null,
    bunVersion: null,
    database: text(infrastructure.database),
    status: 'configured',
  }]
}

function configuredResources(config: CloudRecord, project: DashboardCloudProject): DashboardCloudResource[] {
  const infrastructure = record(config.infrastructure)
  const resources: DashboardCloudResource[] = []
  const pushEntries = (
    value: unknown,
    category: string,
    type: string,
    description: string,
    status: DashboardCloudStatus = 'configured',
    getDetails: (item: CloudRecord) => DashboardCloudResourceDetail[] = () => [],
  ) => {
    for (const [key, item] of entries(value)) {
      resources.push({
        id: `${category}:${key}`,
        name: key,
        type,
        category,
        status,
        environment: null,
        description,
        details: getDetails(item),
      })
    }
  }

  const dns = record(infrastructure.dns)
  if (Object.keys(dns).length) {
    resources.push({
      id: 'network:dns',
      name: text(dns.domain) ?? 'DNS',
      type: 'DNS',
      category: 'network',
      status: 'configured',
      environment: null,
      description: 'Configured DNS entry point.',
      details: details(detail('Hosted zone', text(dns.hostedZoneId)), detail('Region', project.region)),
    })
  }

  const loadBalancer = record(infrastructure.loadBalancer)
  if (boolean(loadBalancer.enabled)) {
    resources.push({
      id: 'network:load-balancer',
      name: 'Load balancer',
      type: text(loadBalancer.type) ?? 'load balancer',
      category: 'network',
      status: project.mode === 'server' ? 'configured' : 'inactive',
      environment: null,
      description: 'Configured traffic distribution and health checks.',
      details: details(detail('Health path', text(record(loadBalancer.healthCheck).path))),
    })
  }

  pushEntries(infrastructure.storage, 'storage', 'Bucket', 'Configured object storage.', 'configured', item => details(
    detail('Visibility', boolean(item.public) ? 'public' : 'private'),
    detail('Encryption', boolean(item.encryption) ? 'enabled' : 'not enabled'),
    detail('Versioning', boolean(item.versioning) ? 'enabled' : 'not enabled'),
  ))
  pushEntries(infrastructure.queues, 'queue', 'Queue', 'Configured background queue.')
  pushEntries(infrastructure.functions, 'function', 'Function', 'Configured standalone function.')
  pushEntries(infrastructure.databases, 'database', 'Database', 'Configured managed database.')
  pushEntries(infrastructure.cdn, 'cdn', 'CDN', 'Configured content delivery endpoint.')
  pushEntries(infrastructure.containers, 'container', 'Container', 'Configured container service.', project.mode === 'serverless' ? 'configured' : 'inactive', item => details(
    detail('CPU', number(item.cpu)),
    detail('Memory', number(item.memory)),
    detail('Port', number(item.port)),
    detail('Desired count', number(item.desiredCount)),
  ))
  pushEntries(config.sites, 'site', 'Site', 'Configured deployment site.', 'configured', item => details(
    detail('Domain', text(item.domain)),
    detail('Path', text(item.path)),
    detail('Deploy target', text(item.deploy) ?? (text(item.start) ? 'server app' : 'server static')),
    detail('Port', number(item.port)),
  ))

  return resources
}

const servicePresentation: Record<string, { color: string, icon: string }> = {
  api: { color: '#A166FF', icon: 'i-hugeicons-globe' },
  assets: { color: '#6CAE3E', icon: 'i-hugeicons-folder-01' },
  cache: { color: '#F59E0B', icon: 'i-hugeicons-database-02' },
  cli: { color: '#64748B', icon: 'i-hugeicons-command-line' },
  database: { color: '#527FFF', icon: 'i-hugeicons-database-02' },
  firewall: { color: '#EF4444', icon: 'i-hugeicons-shield-01' },
  queue: { color: '#FF4F8B', icon: 'i-hugeicons-message-multiple-02' },
}

function serverlessOverview(config: CloudRecord): {
  services: DashboardCloudService[]
  links: DashboardCloudLink[]
} {
  const services: DashboardCloudService[] = []
  const links: DashboardCloudLink[] = []

  for (const [environmentName, environment] of entries(config.environments)) {
    const app = record(environment.app)
    if (!Object.keys(app).length)
      continue

    const add = (
      suffix: string,
      name: string,
      type: keyof typeof servicePresentation,
      description: string,
      serviceDetails: DashboardCloudResourceDetail[] = [],
    ) => {
      const id = `serverless:${environmentName}:${suffix}`
      const presentation = servicePresentation[type]
      services.push({
        id,
        name,
        type,
        description,
        icon: presentation.icon,
        color: presentation.color,
        status: 'configured',
        environment: environmentName,
        details: serviceDetails,
      })
      return id
    }

    const httpId = add('http', `${environmentName} HTTP`, 'api', 'Serverless HTTP application.', details(
      detail('Runtime', text(app.kind)),
      detail('Version', text(app.runtimeVersion)),
      detail('Memory', number(app.memory) === null ? null : `${number(app.memory)} MB`),
      detail('Timeout', number(app.timeout) === null ? null : `${number(app.timeout)} seconds`),
      detail('Domain', text(app.domain)),
    ))
    const cliId = add('cli', `${environmentName} CLI`, 'cli', 'Remote commands, deploy hooks, and scheduled work.', details(
      detail('Memory', number(app.cliMemory) === null ? null : `${number(app.cliMemory)} MB`),
      detail('Timeout', number(app.cliTimeout) === null ? null : `${number(app.cliTimeout)} seconds`),
      detail('Scheduler', text(app.scheduler)),
    ))
    links.push({ source: cliId, target: httpId, type: 'serves' })

    if (app.queues) {
      const queueId = add('queue', `${environmentName} queue`, 'queue', 'Serverless queue worker.', details(
        detail('Concurrency', number(app.queueConcurrency)),
        detail('Memory', number(app.queueMemory) === null ? null : `${number(app.queueMemory)} MB`),
        detail('Timeout', number(app.queueTimeout) === null ? null : `${number(app.queueTimeout)} seconds`),
      ))
      links.push({ source: httpId, target: queueId, type: 'uses' })
    }
    if (app.assets) {
      const assetsId = add('assets', `${environmentName} assets`, 'assets', 'Static assets published with the application.', details(
        detail('Source', text(app.assets)),
      ))
      links.push({ source: httpId, target: assetsId, type: 'uses' })
    }
    if (Object.keys(record(app.database)).length) {
      const databaseId = add('database', `${environmentName} database`, 'database', 'Managed serverless application database.')
      links.push({ source: httpId, target: databaseId, type: 'uses' })
    }
    if (Object.keys(record(app.cache)).length) {
      const cacheId = add('cache', `${environmentName} cache`, 'cache', 'Configured application cache.', details(
        detail('Driver', text(record(app.cache).driver)),
      ))
      links.push({ source: httpId, target: cacheId, type: 'uses' })
    }
    if (boolean(record(app.firewall).enabled)) {
      const firewallId = add('firewall', `${environmentName} firewall`, 'firewall', 'Managed firewall for the HTTP endpoint.', details(
        detail('Rate limit', number(record(app.firewall).rateLimit)),
      ))
      links.push({ source: firewallId, target: httpId, type: 'routes' })
    }
  }

  return { services, links }
}

function eventsFromState(files: StateFile[], deployments: DashboardServerDeployment[]): DashboardCloudEvent[] {
  const events: DashboardCloudEvent[] = []

  for (const deployment of deployments) {
    events.push({
      id: `event:${deployment.id}`,
      service: deployment.serverName,
      type: deployment.status === 'attention' ? 'attention' : 'success',
      message: deployment.status === 'attention'
        ? `Deployment recorded; ${deployment.operation?.kind ?? 'operation'} is ${deployment.operation?.status ?? 'pending'}.`
        : 'Deployment state recorded.',
      timestamp: deployment.operation?.updatedAt ?? deployment.recordedAt,
    })
  }

  for (const file of files) {
    const operation = operationFromState(file.value)
    if (!operation || deployments.some(deployment => deployment.stackName === text(file.value.stackName)))
      continue
    events.push({
      id: `event:operation:${text(file.value.operationId)}`,
      service: text(file.value.serverName) ?? text(file.value.stackName) ?? 'Cloud operation',
      type: operationNeedsAttention(operation) ? 'attention' : 'success',
      message: `Resize operation is ${operation.status}.`,
      timestamp: operation.updatedAt ?? file.modifiedAt,
    })
  }

  return events.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export async function getDashboardCloudSnapshot(
  cloudConfig: CloudConfig,
  dependencies: CloudStateDependencies = {},
): Promise<DashboardCloudSnapshot> {
  const config = record(cloudConfig)
  const projectConfig = record(config.project)
  const environmentEntries = entries(config.environments)
  const environmentNames = environmentEntries.map(([name]) => name)
  const project: DashboardCloudProject = {
    name: text(projectConfig.name) ?? 'Cloud project',
    slug: text(projectConfig.slug) ?? 'app',
    mode: inferredMode(config),
    provider: providerName(config),
    region: text(projectConfig.region) ?? 'not configured',
  }
  const stateFiles = await readStateFiles(dependencies.stateDir ?? cloudStatePath())
  const operations = new Map<string, DashboardCloudOperation>()
  for (const file of stateFiles) {
    const operation = operationFromState(file.value)
    const stackName = text(file.value.stackName)
    if (operation && stackName)
      operations.set(stackName, operation)
  }
  const deployments = stateFiles
    .map(state => deploymentFromState(
      state,
      operations.get(text(state.value.stackName) ?? '') ?? null,
      project.slug,
      environmentNames,
    ))
    .filter((deployment): deployment is DashboardServerDeployment => deployment !== null)

  const environments = environmentEntries.map(([name, environment]): DashboardCloudEnvironment => {
    const hasDeployment = deployments.some(deployment => deployment.environment === name)
    return {
      name,
      type: text(environment.type) ?? name,
      branch: text(environment.deployBranch),
      domain: text(environment.domain),
      region: text(environment.region) ?? project.region,
      serverless: Object.keys(record(environment.app)).length > 0,
      status: hasDeployment ? 'deployed' : 'configured',
    }
  })
  const serverless = serverlessOverview(config)

  return {
    project,
    environments,
    serverDefinitions: serverDefinitions(config, project),
    deployments,
    resources: configuredResources(config, project),
    serverlessServices: serverless.services,
    serverlessLinks: serverless.links,
    events: eventsFromState(stateFiles, deployments),
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
  }
}
