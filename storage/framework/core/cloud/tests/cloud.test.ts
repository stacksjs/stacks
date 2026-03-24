import { describe, expect, mock, test } from 'bun:test'

// Mock all AWS clients and dependencies to prevent real API calls
mock.module('@stacksjs/ts-cloud', () => ({
  AWSClient: class MockAWSClient {
    async request() { return {} }
  },
  AWSCloudFormationClient: class MockCFClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async listStacks() { return { StackSummaries: [] } }
  },
  CloudWatchLogsClient: class MockCWLClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async describeLogGroups() { return { logGroups: [] } }
  },
  EC2Client: class MockEC2Client {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async describeSecurityGroups() { return { SecurityGroups: [] } }
    async describeInstances() { return { Reservations: [] } }
    async terminateInstances() { return {} }
    async describeVpcs() { return { Vpcs: [] } }
    async describeSubnets() { return { Subnets: [] } }
  },
  IAMClient: class MockIAMClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async listUsers() { return { Users: [] } }
    async listInstanceProfiles() { return { InstanceProfiles: [] } }
  },
  LambdaClient: class MockLambdaClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async listFunctions() { return { Functions: [] } }
  },
  Route53DomainsClient: class MockRoute53DomainsClient {
    async registerDomain() { return { OperationId: 'mock-op' } }
  },
  S3Client: class MockS3Client {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async listBuckets() { return { Buckets: [] } }
  },
  SSMClient: class MockSSMClient {
    // eslint-disable-next-line no-useless-constructor
    constructor(_region?: string) {}
    async getParameter() { return { Parameter: { Value: '1234567890' } } }
    async putParameter() { return {} }
    async describeParameters() { return { Parameters: [] } }
    async deleteParameter() { return {} }
  },
}))

mock.module('@stacksjs/config', () => ({
  config: {
    app: { url: 'stacksjs.com', env: 'local', name: 'stacks' },
    team: { name: 'stacks' },
  },
}))

mock.module('@stacksjs/error-handling', () => ({
  ok: (v: any) => ({ isOk: true, isErr: false, value: v, unwrap: () => v }),
  err: (e: any) => ({ isOk: false, isErr: true, error: e }),
  handleError: (msg: any, _e?: any) => typeof msg === 'string' ? msg : String(msg),
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
  path: { cloudPath: (p: string) => `/cloud/${p}` },
}))

mock.module('@stacksjs/strings', () => ({
  slug: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
}))

describe('Cloud Module Exports', () => {
  test('cloud helpers module loads', async () => {
    const mod = await import('../src/helpers')
    expect(mod).toBeDefined()
  })

  test('cloud types module loads', async () => {
    const mod = await import('../src/types')
    expect(mod).toBeDefined()
  })
})

describe('Cloud Helper Functions', () => {
  test('getSecurityGroupId is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.getSecurityGroupId).toBe('function')
  })

  test('purchaseDomain is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.purchaseDomain).toBe('function')
  })

  test('getJumpBoxInstanceId is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.getJumpBoxInstanceId).toBe('function')
  })

  test('deleteEc2Instance is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.deleteEc2Instance).toBe('function')
  })

  test('deleteJumpBox is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.deleteJumpBox).toBe('function')
  })

  test('deleteIamUsers is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.deleteIamUsers).toBe('function')
  })

  test('deleteStacksBuckets is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.deleteStacksBuckets).toBe('function')
  })

  test('deleteStacksFunctions is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.deleteStacksFunctions).toBe('function')
  })

  test('isFirstDeployment is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.isFirstDeployment).toBe('function')
  })

  test('hasBeenDeployed is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.hasBeenDeployed).toBe('function')
  })

  test('getOrCreateTimestamp is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.getOrCreateTimestamp).toBe('function')
  })

  test('getCloudFrontDistributionId is exported', async () => {
    const mod = await import('../src/helpers')
    expect(typeof mod.getCloudFrontDistributionId).toBe('function')
  })
})

describe('Cloud Helper Behavior', () => {
  test('getCloudFrontDistributionId returns empty string', async () => {
    const { getCloudFrontDistributionId } = await import('../src/helpers')
    const result = await getCloudFrontDistributionId()
    expect(result).toBe('')
  })

  test('deleteEc2Instance returns error for empty id', async () => {
    const { deleteEc2Instance } = await import('../src/helpers')
    const result = await deleteEc2Instance('')
    expect(result.isErr).toBe(true)
  })

  test('getSecurityGroupId returns error when no groups found', async () => {
    const { getSecurityGroupId } = await import('../src/helpers')
    const result = await getSecurityGroupId('nonexistent-sg')
    expect(result.isErr).toBe(true)
  })
})

describe('Cloud Types', () => {
  test('CloudOptions type is exported', async () => {
    const mod = await import('../src/types')
    // Verify the module can be imported (type exports produce no runtime value)
    expect(mod).toBeDefined()
  })

  test('PurchaseOptions interface is usable', async () => {
    const mod = await import('../src/helpers')
    // PurchaseOptions is used as a parameter type in purchaseDomain
    expect(typeof mod.purchaseDomain).toBe('function')
  })
})
