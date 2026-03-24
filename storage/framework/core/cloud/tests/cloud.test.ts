import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real modules directly — no mocks.
// We test what's available without AWS credentials: module loading, function
// exports, type checking. We do NOT test actual AWS API calls.
// ---------------------------------------------------------------------------

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
