import type { AuctionItemRow, ItemOutcome, PlacedBid } from './types'

/**
 * Notification payloads for the three things a bidder must be told.
 *
 * These are builders, not senders. The auction package has no opinion about
 * whether a school reaches parents by email, SMS or a row in their dashboard
 * inbox - it knows what happened and phrases it; `@stacksjs/notifications`
 * decides where it goes. That split is also what lets an app schedule a notice
 * for later (the closing-soon nudge) rather than sending it inline.
 */

export interface AuctionNotification {
  to: { name: string, email: string }
  subject: string
  body: string
  /** Machine-readable, for the app's own scheduling and reporting. */
  type: 'outbid' | 'winner' | 'closing_soon'
  data: Record<string, unknown>
}

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100)
}

/**
 * Told to the bidder who just lost the lead.
 *
 * It names the lot and the number to beat, because the entire purpose of the
 * message is to let someone re-bid from their phone in one tap. A notice that
 * only says "you have been outbid" makes them go find the lot themselves, and
 * most of them do not.
 */
export function outbidNotification(result: PlacedBid, currency = 'USD'): AuctionNotification | null {
  if (!result.outbid || !result.item)
    return null

  const lot = result.item

  return {
    to: { name: result.outbid.bidderName, email: result.outbid.bidderEmail },
    type: 'outbid',
    subject: `You have been outbid on lot ${lot.lot_number}: ${lot.title}`,
    body: `Someone has bid higher on "${lot.title}". The next bid is ${money(result.nextMinimumBid, currency)}. Bidding closes ${new Date(lot.closes_at ?? '').toLocaleString()}.`,
    data: {
      itemId: lot.id,
      lotNumber: lot.lot_number,
      title: lot.title,
      nextMinimumBid: result.nextMinimumBid,
      closesAt: lot.closes_at,
    },
  }
}

/** Told to the winner of a lot once it closes. */
export function winnerNotification(outcome: ItemOutcome, currency = 'USD'): AuctionNotification | null {
  if (outcome.status !== 'sold' || !outcome.winnerEmail)
    return null

  return {
    to: { name: outcome.winnerName ?? 'Bidder', email: outcome.winnerEmail },
    type: 'winner',
    subject: `You won lot ${outcome.lotNumber}: ${outcome.title}`,
    body: `Congratulations - you won "${outcome.title}" at ${money(outcome.amount, currency)}. The school will be in touch with payment and pickup details.`,
    data: {
      itemId: outcome.itemId,
      lotNumber: outcome.lotNumber,
      title: outcome.title,
      amount: outcome.amount,
    },
  }
}

/**
 * Told to everyone still leading a lot that is about to close, and to bidders
 * watching one. Sent by the app's scheduler rather than inline, because "soon"
 * is a decision about the school's evening, not about this bid.
 */
export function closingSoonNotification(item: AuctionItemRow, to: { name: string, email: string }, currentBid: number, currency = 'USD'): AuctionNotification {
  return {
    to,
    type: 'closing_soon',
    subject: `Closing soon: lot ${item.lot_number}, ${item.title}`,
    body: `"${item.title}" closes at ${new Date(item.closes_at ?? '').toLocaleString()}. The current bid is ${money(currentBid, currency)}.`,
    data: {
      itemId: item.id,
      lotNumber: item.lot_number,
      title: item.title,
      currentBid,
      closesAt: item.closes_at,
    },
  }
}
