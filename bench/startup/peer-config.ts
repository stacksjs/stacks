import type { Target } from '../routing/targets'
import { balancedTargetOrder } from '../routing/schedule'
import { targetById } from '../routing/targets'

export const MIN_PEER_STARTUP_RUNS = 15
export const DEFAULT_PEER_STARTUP_TARGET_IDS = [
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
] as const

export interface PeerStartupOptions {
  output: string
  runs: number
  targets: Target[]
}

export interface ScheduledPeerSample {
  order: number
  run: number
  target: Target
}

export function parsePeerStartupOptions(args: readonly string[]): PeerStartupOptions {
  let output = 'bench/startup/results/peers-latest.json'
  let runs = MIN_PEER_STARTUP_RUNS
  let targetIds: readonly string[] = DEFAULT_PEER_STARTUP_TARGET_IDS

  for (const argument of args) {
    if (argument === '--') continue
    if (argument.startsWith('--runs=')) {
      runs = Number(argument.slice('--runs='.length))
      continue
    }
    if (argument.startsWith('--targets=')) {
      targetIds = argument.slice('--targets='.length).split(',')
      continue
    }
    if (argument.startsWith('--output=')) {
      output = argument.slice('--output='.length)
      continue
    }
    throw new Error(`Unknown peer startup benchmark option: ${argument}`)
  }

  if (!Number.isSafeInteger(runs) || runs < MIN_PEER_STARTUP_RUNS)
    throw new Error(`--runs must be an integer of at least ${MIN_PEER_STARTUP_RUNS}, received ${runs}`)
  if (!output.trim())
    throw new Error('--output must not be empty')
  if (targetIds.length < 2 || targetIds.some(id => !id))
    throw new Error('--targets must contain at least two non-empty target IDs')
  if (new Set(targetIds).size !== targetIds.length)
    throw new Error('--targets must not contain duplicates')
  if (!targetIds.includes('bun-raw'))
    throw new Error('--targets must include bun-raw as the paired baseline')

  const targets = targetIds.map((id) => {
    const target = targetById(id)
    if (!target) throw new Error(`Unknown peer startup target: ${id}`)
    return target
  })
  return { output, runs, targets }
}

export function peerStartupSchedule(targets: readonly Target[], runs: number): ScheduledPeerSample[] {
  if (!Number.isSafeInteger(runs) || runs < MIN_PEER_STARTUP_RUNS)
    throw new Error(`runs must be an integer of at least ${MIN_PEER_STARTUP_RUNS}, received ${runs}`)
  return Array.from({ length: runs }, (_, run) => balancedTargetOrder(targets, run, runs)
    .map((target, order) => ({ order, run, target }))).flat()
}
