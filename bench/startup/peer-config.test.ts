import { describe, expect, test } from 'bun:test'
import { DEFAULT_PEER_STARTUP_TARGET_IDS, parsePeerStartupOptions, peerStartupSchedule } from './peer-config'

describe('peer startup benchmark configuration', () => {
  test('uses the complete default comparison set', () => {
    const options = parsePeerStartupOptions([])
    expect(options.runs).toBe(15)
    expect(options.output).toBe('bench/startup/results/peers-latest.json')
    expect(DEFAULT_PEER_STARTUP_TARGET_IDS).toEqual([
      'stacks',
      'stacks-warm',
      'stacks-no-csrf',
      'stacks-no-request-ids',
      'stacks-no-security-headers',
      'stacks-minimal',
      'elysia',
      'express',
      'fastify',
      'hono',
      'bun-raw',
    ])
    expect(options.targets.map(target => target.id)).toEqual([...DEFAULT_PEER_STARTUP_TARGET_IDS])
  })

  test('requires a unique target set with the Bun baseline', () => {
    expect(parsePeerStartupOptions(['--runs=30', '--targets=stacks,bun-raw', '--output=/tmp/peers.json'])).toMatchObject({
      runs: 30,
      output: '/tmp/peers.json',
    })
    expect(() => parsePeerStartupOptions(['--runs=14'])).toThrow('at least 15')
    expect(() => parsePeerStartupOptions(['--targets=stacks,hono'])).toThrow('must include bun-raw')
    expect(() => parsePeerStartupOptions(['--targets=stacks,stacks,bun-raw'])).toThrow('must not contain duplicates')
    expect(() => parsePeerStartupOptions(['--targets=unknown,bun-raw'])).toThrow('Unknown peer startup target')
  })

  test('balances every target across process positions', () => {
    const targets = parsePeerStartupOptions([]).targets
    const schedule = peerStartupSchedule(targets, 15)
    expect(schedule).toHaveLength(targets.length * 15)
    for (const target of targets) {
      const counts = Array.from({ length: targets.length }, (_, order) =>
        schedule.filter(sample => sample.target.id === target.id && sample.order === order).length)
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })
})
