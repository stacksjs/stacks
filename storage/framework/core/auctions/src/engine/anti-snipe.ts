import type { AuctionItemRow, AuctionRules } from '../types'

/**
 * Whether a bid landing at `now` should push this lot's close out, and to when.
 *
 * Sniping is the reason paper bid sheets get guarded by a parent with a
 * stopwatch: a bid dropped in the last four seconds wins not because it was the
 * highest anyone would pay, but because nobody could answer it. Extending the
 * close whenever a bid lands inside the window converts the last minute back
 * into an auction - the lot ends when bidding actually stops.
 *
 * `max_extensions` is the counterweight. Without it two determined bidders can
 * hold one lot open indefinitely, and the gala staff cannot go home. Once a lot
 * has been extended that many times it closes on schedule, and the bidding war
 * is settled by whoever was ahead.
 *
 * Returns null when nothing should change.
 */
export function extendedCloseAt(item: Pick<AuctionItemRow, 'closes_at' | 'extension_count'>, closesAt: Date, rules: Pick<AuctionRules, 'antiSnipeMinutes' | 'extendOnBidWindowMinutes' | 'maxExtensions'>, now: Date): Date | null {
  if (rules.antiSnipeMinutes <= 0 || rules.extendOnBidWindowMinutes <= 0)
    return null

  if (item.extension_count >= rules.maxExtensions)
    return null

  const msLeft = closesAt.getTime() - now.getTime()
  if (msLeft <= 0)
    return null

  if (msLeft > rules.extendOnBidWindowMinutes * 60_000)
    return null

  const extended = new Date(now.getTime() + rules.antiSnipeMinutes * 60_000)

  // Never pull a close time backwards. A long extension window with a short
  // anti-snipe would otherwise shorten the lot instead of prolonging it.
  return extended > closesAt ? extended : null
}

/**
 * The close time in force for a lot: its own override, else the auction's.
 */
export function effectiveCloseAt(item: Pick<AuctionItemRow, 'closes_at'>, auctionClosesAt: string | Date): Date {
  return new Date(item.closes_at ?? auctionClosesAt)
}
