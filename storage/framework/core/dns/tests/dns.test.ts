import { describe, expect, mock, test } from 'bun:test'

// Mock AWS clients and dependencies to prevent real API calls
mock.module('@stacksjs/ts-cloud', () => ({
  Route53Client: class MockRoute53Client {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async listHostedZonesByName() { return { HostedZones: [] } }
    async createHostedZone() { return { HostedZone: { Id: 'mock-id' } } }
    async deleteHostedZone() { return {} }
    async changeResourceRecordSets() { return {} }
    async listResourceRecordSets() { return { ResourceRecordSets: [] } }
    async getHostedZone() { return { DelegationSet: { NameServers: [] } } }
  },
  Route53DomainsClient: class MockRoute53DomainsClient {
    async getDomainDetail() { return { Nameservers: [] } }
    async updateDomainNameservers() { return {} }
    async registerDomain() { return { OperationId: 'mock-op' } }
  },
  AWSClient: class MockAWSClient {
    async request() { return {} }
  },
  AWSCloudFormationClient: class MockCFClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  CloudWatchLogsClient: class MockCWLClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  EC2Client: class MockEC2Client {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  IAMClient: class MockIAMClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  LambdaClient: class MockLambdaClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  S3Client: class MockS3Client {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
  SSMClient: class MockSSMClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
  },
}))

mock.module('@stacksjs/config', () => ({
  config: { app: { url: 'stacksjs.com', env: 'local', name: 'stacks' }, team: { name: 'stacks' } },
}))

mock.module('@stacksjs/error-handling', () => ({
  ok: (v: any) => ({ isOk: true, isErr: false, value: v, unwrap: () => v }),
  err: (e: any) => ({ isOk: false, isErr: true, error: e }),
  handleError: (msg: any) => new Error(typeof msg === 'string' ? msg : String(msg)),
}))

mock.module('@stacksjs/logging', () => ({
  log: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    success: mock(() => {}),
  },
}))

mock.module('@stacksjs/path', () => ({
  path: { projectConfigPath: (p: string) => `/config/${p}` },
}))

mock.module('@stacksjs/storage', () => ({
  fs: {
    readFileSync: () => 'nameservers: []',
    writeFileSync: mock(() => {}),
  },
}))

mock.module('@stacksjs/actions', () => ({
  runAction: mock(() => Promise.resolve({ isOk: true })),
}))

mock.module('@stacksjs/enums', () => ({
  Action: { DomainsAdd: 'domains:add' },
}))

describe('DNS Module Exports', () => {
  test('dns index re-exports AWS driver functions', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('deleteHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.deleteHostedZone).toBe('function')
  })

  test('createHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.createHostedZone).toBe('function')
  })

  test('deleteHostedZoneRecords function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.deleteHostedZoneRecords).toBe('function')
  })

  test('findHostedZone function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.findHostedZone).toBe('function')
  })

  test('getNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.getNameservers).toBe('function')
  })

  test('getHostedZoneNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.getHostedZoneNameservers).toBe('function')
  })

  test('updateNameservers function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.updateNameservers).toBe('function')
  })

  test('hasUserDomainBeenAddedToCloud function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.hasUserDomainBeenAddedToCloud).toBe('function')
  })

  test('addDomain function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.addDomain).toBe('function')
  })

  test('writeNameserversToConfig function exists', async () => {
    const mod = await import('../src/drivers/aws')
    expect(typeof mod.writeNameserversToConfig).toBe('function')
  })
})

describe('DNS AWS Driver Behavior', () => {
  test('getNameservers returns empty array for undefined domain', async () => {
    const { getNameservers } = await import('../src/drivers/aws')
    const result = await getNameservers(undefined)
    expect(result).toEqual([])
  })

  test('getNameservers returns empty array for empty domain', async () => {
    const { getNameservers } = await import('../src/drivers/aws')
    const result = await getNameservers('')
    expect(result).toEqual([])
  })
})
