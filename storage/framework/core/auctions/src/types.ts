/**
 * Auction types.
 *
 * Money is integer minor units (cents) everywhere - amounts, increments,
 * ceilings, goals and totals alike. A silent auction adds thousands of bids
 * together and then reports the number to a board of trustees; floats lose that
 * argument. Formatting happens at the edge, never in this package.
 *
 * The row shapes below are declared here rather than imported from
 * `@stacksjs/orm`'s generated model types on purpose. This package has to build
 * and run against an app whose ORM types were generated before the auction
 * models existed - which is every app that installs the published framework
 * before the next release. The models under
 * `storage/framework/defaults/app/Models/auctions/` are the source of the
 * columns; these interfaces are the contract the engine reads them through.
 */

/** Where an auction is in its life. */
export type AuctionStatus = 'draft' | 'preview' | 'open' | 'closed' | 'settled'

/** Where a single lot is in its life. */
export type AuctionItemStatus = 'open' | 'closed' | 'sold' | 'passed'

/**
 * Bid state. `leading` is the one bid per item that currently wins; every
 * other live bid is `outbid`. Both resolve to `won` / `lost` at close.
 * `invalid` is a bid an organizer retracted (a mis-keyed amount, a guest who
 * bid on the wrong lot), kept for the audit trail rather than deleted.
 */
export type BidStatus = 'leading' | 'outbid' | 'won' | 'lost' | 'invalid'

export type PledgeStatus = 'pending' | 'confirmed' | 'cancelled'

export interface AuctionRow {
  id: number
  uuid?: string
  event_id: number
  title: string
  description?: string | null
  status: AuctionStatus
  currency: string
  /** Fundraising target in cents, or null when the school does not set one. */
  goal_amount?: number | null
  opens_at: string | Date
  closes_at: string | Date
  /** Minutes a lot's close is pushed out by when a bid lands in the window. */
  anti_snipe_minutes: number
  /** How close to the end a bid has to land to trigger an extension. */
  extend_on_bid_window_minutes: number
  /** Hard stop, so a bidding war cannot keep a gala running until sunrise. */
  max_extensions: number
}

export interface AuctionItemRow {
  id: number
  uuid?: string
  auction_id: number
  lot_number: number
  title: string
  description?: string | null
  image_url?: string | null
  category?: string | null
  donor_name?: string | null
  /** What the lot is worth, for the tax letter and the sell-through report. */
  fair_market_value?: number | null
  starting_bid: number
  /**
   * A fixed increment for this lot. Null means the auction-wide ladder in
   * `config/auction.ts` applies, which is the normal case - a fixed increment
   * is for the rare lot that wants round numbers.
   */
  min_increment?: number | null
  /** Bid at or above this and the lot sells immediately. */
  buy_now_price?: number | null
  /** Below this the lot passes rather than selling. Null means no reserve. */
  reserve_price?: number | null
  status: AuctionItemStatus
  /** Per-lot close, so a gala can stagger sections. Falls back to the auction. */
  closes_at?: string | Date | null
  extension_count: number
}

export interface BidRow {
  id: number
  uuid?: string
  auction_item_id: number
  auction_id: number
  bidder_name: string
  bidder_email: string
  /** The public number: what this bidder is currently committed to. */
  amount: number
  /**
   * The private ceiling. Null means "no proxy, this amount only". The engine
   * bids up to this on the bidder's behalf without ever exceeding it.
   */
  max_amount?: number | null
  status: BidStatus
  placed_at: string | Date
}

export interface PledgeRow {
  id: number
  uuid?: string
  auction_id: number
  donor_name: string
  donor_email: string
  amount: number
  /** The paddle-raise tier this came from, e.g. `'1000'`, for the tally board. */
  level?: string | null
  status: PledgeStatus
  created_at?: string | Date
}

/**
 * One rung of the increment ladder: below `upTo` cents, bids step by `step`
 * cents. The last rung carries `upTo: null` and applies to everything above.
 */
export interface IncrementTier {
  upTo: number | null
  step: number
}

export interface AuctionRules {
  increments: IncrementTier[]
  antiSnipeMinutes: number
  extendOnBidWindowMinutes: number
  maxExtensions: number
}

/** What a caller passes to `placeBid`. */
export interface BidRequest {
  itemId: number
  bidderName: string
  bidderEmail: string
  /** The amount the bidder typed. */
  amount: number
  /** Their optional ceiling for proxy bidding. Must be >= `amount`. */
  maxAmount?: number | null
  /** Injected clock, so tests and the close job are deterministic. */
  now?: Date
}

export type BidRejectionReason
  = | 'auction_not_open'
    | 'item_not_open'
    | 'below_minimum'
    | 'max_below_amount'
    | 'already_leading'
    | 'item_not_found'

/**
 * The result of resolving one bid against the current leader. This is what the
 * pure engine returns; the persistence layer turns it into row writes and the
 * caller turns it into notifications.
 */
export interface BidResolution {
  accepted: boolean
  reason?: BidRejectionReason
  /** Human-readable, safe to show a parent standing in a gym holding a phone. */
  message?: string
  /** Who leads after this bid, and at what visible amount. */
  leader?: {
    bidderEmail: string
    bidderName: string
    amount: number
    maxAmount: number | null
    /** True when the incoming bid took the lead from someone else. */
    isChallenger: boolean
  }
  /** The visible amount the challenger's own row should be recorded at. */
  challengerAmount?: number
  /** Set when an existing leader lost the lead and should be told. */
  outbid?: {
    bidderEmail: string
    bidderName: string
    amount: number
  }
  /** The lot sold outright via buy-now. */
  buyNow?: boolean
  /** The minimum a next bid has to clear, for the UI to prefill. */
  nextMinimumBid: number
}

export interface PlacedBid extends BidResolution {
  /** The persisted bid row, when the bid was accepted. */
  bid?: BidRow
  item?: AuctionItemRow
  /** A new close time, when anti-snipe extended this lot. */
  extendedTo?: Date
}

export interface ItemOutcome {
  itemId: number
  lotNumber: number
  title: string
  status: AuctionItemStatus
  winningBidId?: number
  winnerName?: string
  winnerEmail?: string
  amount: number
  /** Set when the lot passed because the leading bid missed the reserve. */
  passedReason?: 'no_bids' | 'reserve_not_met'
}

export interface AuctionSettlement {
  auctionId: number
  currency: string
  /** Won lots plus confirmed pledges, in cents. */
  totalRaised: number
  bidRevenue: number
  pledgeRevenue: number
  goalAmount: number | null
  itemsSold: number
  itemsPassed: number
  /** Sold lots as a share of lots offered, 0-1. */
  sellThrough: number
  /** Winning bids over fair market value, in cents. Negative means under. */
  valueDelta: number
  outcomes: ItemOutcome[]
}
