# @stacksjs/auctions

Proxy bidding, anti-sniping, pledges and settlement for Stacks.

A benefit auction is not a storefront. Nothing has a price, the money is a
donation, bidding runs against other people rather than against a checkout, and
the whole thing ends at a fixed time in a room full of people holding phones.
That is why this is its own package rather than a corner of
`@stacksjs/commerce`.

## Layers

```
engine/     pure rules - increments, proxy bidding, anti-snipe, winners
bids/       auctions/  pledges/   persistence on top of those rules
realtime    notifications         how the room and the bidders find out
```

The engine reads no clock, no config and no database - every input is an
argument. That is what makes a bidding war testable in milliseconds, and it is
why the persistence layer stays as thin as it does.

Every amount is integer minor units (cents).

## Placing a bid

```ts
import { placeBid } from '@stacksjs/auctions'

const result = await placeBid({
  itemId: 42,
  bidderName: 'Dana Reyes',
  bidderEmail: 'dana@example.com',
  amount: 25_000, //     $250
  maxAmount: 60_000, //  willing to go to $600
})

if (!result.accepted)
  return { error: result.message, nextMinimumBid: result.nextMinimumBid }
```

`placeBid` writes every row in one transaction. A silent auction's worst
failure mode is two leading bids on one lot: two people are told they won the
same vacation package, and someone has to call one of them back.

## Proxy bidding

A bidder states a ceiling and the house bids on their behalf only as far as it
must, so **the loser sets the price**. A $1,000 ceiling against a $300 ceiling
takes the lead at $325 - one rung over what the other side was willing to pay -
not at $1,000.

Consequences that fall out of that, all covered by tests:

- Raising your own maximum never moves the visible price. Nobody is bidding
  against you.
- A bid that clears the minimum but not the leader's hidden ceiling is still
  recorded, because it is what pushed the price up, and its bidder is told
  immediately rather than at closing.
- An exact tie goes to whoever committed first.
- `maxAmount` never leaves the server. The catalogue queries select columns
  explicitly and the `Bid` model marks it hidden.

## Anti-sniping

A bid dropped in the last four seconds wins because nobody could answer it, not
because it was the most anyone would pay. When a bid lands inside
`extendOnBidWindowMinutes` of a lot's close, the close moves out by
`antiSnipeMinutes` - so the lot ends when bidding actually stops.

`maxExtensions` is the counterweight: two determined bidders would otherwise
hold one lot open indefinitely and the gala staff could not go home.

## Increment ladder

Configured in `config/auction.ts`. Bids step by more as the money gets bigger,
the way a live auctioneer does by instinct - $5 steps would turn a $4,000 travel
package into a hundred-bid slog, and $100 steps would price everyone out of the
$60 class art project. A lot may override the ladder with a fixed increment.

## Closing and settlement

```ts
import { closeDueItems, settleAuction } from '@stacksjs/auctions'

// From a per-minute job. Honours anti-snipe extensions.
const outcomes = await closeDueItems(auctionId)

// Read-only until the school has actually invoiced.
const sheet = await settleAuction(auctionId, { markSettled: true })
```

The settlement sheet reports what the night raised, sell-through, and how
winning bids measured against fair market value - positive means donors paid
over the value of what they took home, which is the point of a benefit auction.
Lots with no stated value are excluded rather than counted as zero.

## Models

`Auction`, `AuctionItem`, `Bid`, `Pledge` ship under
`storage/framework/defaults/app/Models/auctions/`. An auction's `event_id` is a
plain column, not a `belongsTo` - the thing an auction hangs off is the
application's own event model, which the framework does not ship.

The row shapes in `src/types.ts` are declared by this package rather than
imported from the generated ORM types, so it builds and runs against an app
whose types were generated before these models existed.

## Realtime

Bids, pledges and closings broadcast on `auction.{id}` when
`@stacksjs/realtime` is installed. It is resolved at call time, so an app
without it degrades to "no live updates" rather than to a crash - and a
websocket that is down never fails a bid the database already accepted.
