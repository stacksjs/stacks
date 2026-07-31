import { describe, expect, test } from 'bun:test'
import {
  normalizePrintDeviceRecord,
  summarizePrintDevices,
} from './print-device-records'

describe('dashboard print device records', () => {
  test('normalizes persisted model columns and Unix timestamps', () => {
    expect(normalizePrintDeviceRecord({
      id: 7,
      name: 'Kitchen printer',
      mac_address: '00:11:22:33:44:55',
      location: 'Kitchen',
      terminal: 'KDS-1',
      status: 'warning',
      last_ping: 1785360000,
      print_count: '81',
      created_at: '2026-07-29 10:00:00',
    })).toEqual({
      id: '7',
      name: 'Kitchen printer',
      macAddress: '00:11:22:33:44:55',
      location: 'Kitchen',
      terminal: 'KDS-1',
      status: 'warning',
      lastPing: 1785360000000,
      printCount: 81,
      createdAt: '2026-07-29T10:00:00.000Z',
    })
  })

  test('rejects invalid operational values', () => {
    const base = {
      id: 8,
      name: 'Kitchen printer',
      macAddress: '00:11:22:33:44:55',
      location: 'Kitchen',
      terminal: 'KDS-1',
      status: 'online',
      lastPing: 0,
      printCount: 0,
      createdAt: '2026-07-29 10:00:00',
    }
    expect(() => normalizePrintDeviceRecord({ ...base, status: 'unknown' }))
      .toThrow('PrintDevice 8.status must be online or offline or warning')
    expect(() => normalizePrintDeviceRecord({ ...base, lastPing: 'not-a-date' }))
      .toThrow('PrintDevice 8.last_ping must be a valid timestamp')
    expect(() => normalizePrintDeviceRecord({ ...base, printCount: -2 }))
      .toThrow('PrintDevice 8.print_count must be at least 0')
  })

  test('summarizes only persisted print device fields', () => {
    expect(summarizePrintDevices([
      { id: '1', name: 'One', macAddress: '', location: 'North', terminal: '', status: 'online', lastPing: 0, printCount: 10, createdAt: '' },
      { id: '2', name: 'Two', macAddress: '', location: 'North', terminal: '', status: 'warning', lastPing: 0, printCount: 20, createdAt: '' },
      { id: '3', name: 'Three', macAddress: '', location: 'South', terminal: '', status: 'offline', lastPing: 0, printCount: 30, createdAt: '' },
    ])).toEqual({
      total: 3,
      online: 1,
      offline: 1,
      warning: 1,
      locations: 2,
      totalPrints: 60,
    })
  })
})
