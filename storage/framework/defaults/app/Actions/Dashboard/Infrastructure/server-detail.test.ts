import type { DashboardCloudSnapshot } from '../Cloud/cloud-overview'
import { describe, expect, test } from 'bun:test'
import { resolveDashboardServer } from './server-detail'

const snapshot: DashboardCloudSnapshot = {
  project: {
    name: 'Stacks',
    slug: 'stacks',
    mode: 'server',
    provider: 'hetzner',
    region: 'ash',
  },
  environments: [{
    name: 'production',
    type: 'production',
    branch: 'main',
    domain: 'stacks.test',
    region: 'ash',
    serverless: false,
    status: 'deployed',
  }],
  serverDefinitions: [{
    id: 'server:compute',
    key: 'compute',
    name: 'Application compute',
    role: 'app',
    region: 'ash',
    size: 'cpx22',
    instances: 1,
    diskGb: 40,
    diskType: 'local',
    encrypted: true,
    domain: null,
    operatingSystem: null,
    bunVersion: null,
    database: 'sqlite',
    status: 'configured',
  }],
  deployments: [{
    id: 'deployment:stacks-production',
    stackName: 'stacks-production',
    environment: 'production',
    serverName: 'stacks-app',
    provider: 'hetzner',
    publicIp: '203.0.113.10',
    publicIpv6: null,
    sshUser: 'deploy',
    recordedAt: '2026-07-29T12:00:00.000Z',
    status: 'deployed',
    operation: null,
  }],
  resources: [],
  serverlessServices: [],
  serverlessLinks: [],
  events: [],
  generatedAt: '2026-07-29T12:00:00.000Z',
}

describe('resolveDashboardServer', () => {
  test('resolves server definitions by key or stable id', () => {
    expect(resolveDashboardServer(snapshot, 'compute')?.server?.name).toBe('Application compute')
    expect(resolveDashboardServer(snapshot, 'server%3Acompute')?.kind).toBe('configuration')
  })

  test('resolves deployments by stack name or encoded stable id', () => {
    expect(resolveDashboardServer(snapshot, 'stacks-production')?.deployment?.serverName).toBe('stacks-app')
    const detail = resolveDashboardServer(snapshot, 'deployment%3Astacks-production')
    expect(detail?.kind).toBe('deployment')
    expect(detail?.environment?.name).toBe('production')
  })

  test('does not invent records for malformed or unknown identifiers', () => {
    expect(resolveDashboardServer(snapshot, '%')).toBeNull()
    expect(resolveDashboardServer(snapshot, 'missing')).toBeNull()
    expect(resolveDashboardServer(snapshot, '')).toBeNull()
  })
})
