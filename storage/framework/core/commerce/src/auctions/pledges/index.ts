import type { PledgeRow, PledgeStatus } from '../types'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { broadcastPledge } from '../realtime'

export interface PledgeRequest {
  auctionId: number
  donorName: string
  donorEmail: string
  amount: number
  /** The paddle-raise tier, e.g. `'2500'`, when the gift came from a level. */
  level?: string | null
  /**
   * Pledges made from the room are good the moment they are made; pledges
   * taken online are often confirmed by staff afterwards. Default is confirmed,
   * because the common case is a paddle in the air.
   */
  status?: PledgeStatus
}

/**
 * Record a fund-a-need pledge.
 *
 * Fund-a-need is the part of a benefit auction that is not an auction at all:
 * the room is asked to give at fixed levels and nobody competes for anything.
 * It shares the auction only for the tally board, which is why it lives beside
 * bidding but never passes through the bidding engine.
 */
export async function makePledge(request: PledgeRequest): Promise<PledgeRow> {
  const uuid = randomUUIDv7()

  await db
    .insertInto('pledges')
    .values({
      uuid,
      auction_id: request.auctionId,
      donor_name: request.donorName,
      donor_email: request.donorEmail.toLowerCase(),
      amount: request.amount,
      level: request.level ?? null,
      status: request.status ?? 'confirmed',
    })
    .execute()

  const pledge = (await db
    .selectFrom('pledges')
    .selectAll()
    .where('uuid', '=', uuid)
    .executeTakeFirst()) as unknown as PledgeRow

  await broadcastPledge(pledge, await pledgeTotal(request.auctionId)).catch(() => undefined)

  return pledge
}

/** Confirmed pledge money for an auction, in cents. */
export async function pledgeTotal(auctionId: number): Promise<number> {
  const rows = (await db
    .selectFrom('pledges')
    .select(['amount'])
    .where('auction_id', '=', auctionId)
    .where('status', '=', 'confirmed')
    .execute()) as { amount: number }[] | undefined

  return (rows ?? []).reduce((sum, row) => sum + row.amount, 0)
}

export async function fetchPledges(auctionId: number): Promise<PledgeRow[]> {
  const rows = await db
    .selectFrom('pledges')
    .selectAll()
    .where('auction_id', '=', auctionId)
    .orderBy('amount', 'desc')
    .execute()

  return (rows ?? []) as unknown as PledgeRow[]
}

/**
 * The tally board: how much each level has raised and how many gave at it.
 * Levels are reported in descending gift size, which is the order they are read
 * out in the room.
 */
export async function pledgeLevels(auctionId: number): Promise<{ level: string, amount: number, count: number }[]> {
  const pledges = (await fetchPledges(auctionId)).filter(p => p.status === 'confirmed')
  const byLevel = new Map<string, { amount: number, count: number }>()

  for (const pledge of pledges) {
    const key = pledge.level ?? 'other'
    const entry = byLevel.get(key) ?? { amount: 0, count: 0 }
    entry.amount += pledge.amount
    entry.count += 1
    byLevel.set(key, entry)
  }

  return [...byLevel.entries()]
    .map(([level, stats]) => ({ level, ...stats }))
    .sort((a, b) => b.amount - a.amount)
}
