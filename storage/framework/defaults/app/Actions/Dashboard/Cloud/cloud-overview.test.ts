import type { CloudConfig } from '@stacksjs/ts-cloud'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDashboardCloudSnapshot } from './cloud-overview'

let stateDir = ''

beforeEach(async () => {
  stateDir = await mkdtemp(join(tmpdir(), 'stacks-dashboard-cloud-'))
  await mkdir(join(stateDir, 'state'), { recursive: true })
})

afterEach(async () => {
  await rm(stateDir, { force: true, recursive: true })
})

const cloudConfig: CloudConfig = {
  project: { name: 'Example', slug: 'example', region: 'us-west-2' },
  cloud: { provider: 'hetzner' },
  mode: 'server',
  environments: {
    production: { type: 'production', deployBranch: 'main', region: 'us-east-1' },
    staging: { type: 'staging', deployBranch: 'stage' },
  },
  infrastructure: {
    compute: {
      instances: 1,
      size: 'medium',
      disk: { size: 80, type: 'ssd', encrypted: true },
    },
    servers: {
      app: {
        name: 'app-server',
        type: 'app',
        domain: 'example.com',
        size: 'small',
        serverOS: 'ubuntu',
        bunVersion: '1.3.0',
        database: 'sqlite',
      },
    },
    loadBalancer: { enabled: true, type: 'application', healthCheck: { path: '/health' } },
    dns: { domain: 'example.com' },
    storage: {
      public: { public: true, encryption: true, versioning: true },
    },
    queues: {
      jobs: { visibilityTimeout: 120 },
    },
    containers: {
      api: { cpu: 512, memory: 1024, port: 3000 },
    },
  },
  sites: {
    main: { root: '.', domain: 'example.com', start: 'bun server.ts', port: 3000 },
  },
}

describe('dashboard cloud overview', () => {
  test('reports configured and persisted deployment state without invented metrics', async () => {
    await writeFile(join(stateDir, 'state', 'example-production.json'), JSON.stringify({
      stackName: 'example-production',
      provider: 'hetzner',
      serverName: 'example-production-app',
      publicIp: '203.0.113.20',
      sshUser: 'root',
    }))
    await writeFile(join(stateDir, 'state', 'example-production-resize.json'), JSON.stringify({
      operationId: 'resize-1',
      stackName: 'example-production',
      serverName: 'example-production-app',
      phase: 'waiting-capacity',
      status: 'waiting-capacity',
      sourceType: 'small',
      targetType: 'medium',
      attempts: 2,
      updatedAt: '2026-07-29T10:00:00.000Z',
    }))

    const snapshot = await getDashboardCloudSnapshot(cloudConfig, {
      stateDir,
      now: () => new Date('2026-07-29T12:00:00.000Z'),
    })

    expect(snapshot.project).toEqual({
      mode: 'server',
      name: 'Example',
      provider: 'hetzner',
      region: 'us-west-2',
      slug: 'example',
    })
    expect(snapshot.serverDefinitions).toContainEqual(expect.objectContaining({
      diskGb: 80,
      encrypted: true,
      name: 'app-server',
      size: 'small',
    }))
    expect(snapshot.deployments).toEqual([
      expect.objectContaining({
        environment: 'production',
        operation: expect.objectContaining({ attempts: 2, status: 'waiting-capacity' }),
        publicIp: '203.0.113.20',
        status: 'attention',
      }),
    ])
    expect(snapshot.environments.find(item => item.name === 'production')?.status).toBe('deployed')
    expect(snapshot.resources.map(item => item.id)).toEqual([
      'network:dns',
      'network:load-balancer',
      'storage:public',
      'queue:jobs',
      'container:api',
      'site:main',
    ])
    expect(snapshot.resources.find(item => item.id === 'container:api')?.status).toBe('inactive')
    expect(snapshot.events[0]).toMatchObject({
      message: 'Deployment recorded; resize is waiting-capacity.',
      timestamp: '2026-07-29T10:00:00.000Z',
      type: 'attention',
    })
    expect(JSON.stringify(snapshot)).not.toContain('Monthly Spend')
    expect(JSON.stringify(snapshot)).not.toContain('99.99%')
  })

  test('reports malformed state instead of presenting a configured-only snapshot', async () => {
    await writeFile(join(stateDir, 'state', 'broken.json'), '{')

    expect(getDashboardCloudSnapshot(cloudConfig, { stateDir })).rejects.toThrow(
      'Could not read cloud state broken.json',
    )
  })

  test('treats an absent state directory as no deployment state', async () => {
    const missingStateDir = join(stateDir, 'not-created')
    const snapshot = await getDashboardCloudSnapshot(cloudConfig, { stateDir: missingStateDir })

    expect(snapshot.deployments).toEqual([])
    expect(snapshot.events).toEqual([])
    expect(snapshot.environments.every(environment => environment.status === 'configured')).toBe(true)
  })

  test('derives serverless services only from environment app manifests', async () => {
    const serverlessConfig: CloudConfig = {
      project: { name: 'Lambda App', slug: 'lambda-app', region: 'us-east-1' },
      mode: 'serverless',
      environments: {
        production: {
          type: 'production',
          app: {
            kind: 'bun',
            runtimeVersion: '1.3.0',
            entry: 'server.ts',
            memory: 1024,
            queues: true,
            queueMemory: 512,
            scheduler: 'on',
            assets: 'public',
            cache: { driver: 'dynamodb' },
            firewall: { enabled: true, rateLimit: 2000 },
          },
        },
      },
    }

    const snapshot = await getDashboardCloudSnapshot(serverlessConfig, { stateDir })

    expect(snapshot.serverlessServices.map(service => service.type)).toEqual([
      'api',
      'cli',
      'queue',
      'assets',
      'cache',
      'firewall',
    ])
    expect(snapshot.serverlessLinks).toHaveLength(5)
    expect(snapshot.serverlessServices.every(service => service.environment === 'production')).toBe(true)
  })
})
