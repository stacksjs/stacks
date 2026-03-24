import { describe, expect, test } from 'bun:test'

describe('Health Module Exports', () => {
  test('health index re-exports drivers and notifications', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('ohdear driver is exported', async () => {
    const mod = await import('../src/drivers/ohdear')
    expect(mod).toBeDefined()
    expect(mod.ohdearWip).toBe(1)
  })

  test('notifications module is exported', async () => {
    const mod = await import('../src/notifications/index')
    expect(mod).toBeDefined()
    expect(mod.healthNotificationsWip).toBe(1)
  })
})

describe('Health Driver Interface', () => {
  test('drivers index re-exports ohdear', async () => {
    const drivers = await import('../src/drivers/index')
    expect(drivers).toBeDefined()
    // The module should expose the ohdear placeholder
    expect(drivers.ohdearWip).toBe(1)
  })

  test('ohdear placeholder value is correct', async () => {
    const { ohdearWip } = await import('../src/drivers/ohdear')
    expect(typeof ohdearWip).toBe('number')
    expect(ohdearWip).toBe(1)
  })

  test('healthNotificationsWip placeholder value is correct', async () => {
    const { healthNotificationsWip } = await import('../src/notifications/index')
    expect(typeof healthNotificationsWip).toBe('number')
    expect(healthNotificationsWip).toBe(1)
  })
})
